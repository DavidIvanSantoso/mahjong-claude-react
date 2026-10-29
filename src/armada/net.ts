import Peer, { type DataConnection } from 'peerjs'
import { useEffect, useRef, useState } from 'react'
import { CONNECT_TIMEOUT_MS, iceDetail, PEER_OPTIONS } from '../net/ice'
import { randomCode, type RoomError } from '../net/online'
import { DEFAULT_PRESET, isPresetId, PRESETS, randomFleet, type PresetId } from './grid'
import { isSkillId } from './skills'
import { newGame, planTurn, reducer, viewFor, type Action, type ArmadaState, type ArmadaView, type PlayerAction } from './state'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6

/** Batas waktu menyusun armada; armada yang belum siap diacak saat waktunya habis. */
export const PLACEMENT_SECONDS = 90
/** Batas waktu membidik; saat habis, host menembak sel acak untuk penyerang. */
export const TURN_SECONDS = 20
/** Jeda setelah semua siap sebelum giliran pertama. */
const START_MS = 1500
/** Lama animasi undian target. */
const TARGET_MS = 1800
/** Lama hasil tembakan ditampilkan sebelum giliran berikutnya. */
const RESULT_MS = 1800

export interface ArmadaLobby {
  /** `wins`: jumlah permainan yang dimenangkan selama room ini dibuka. */
  players: { name: string; connected: boolean; wins: number }[]
  preset: PresetId
}

/**
 * Pesan dari host ke tamu. `timeLeft` adalah sisa waktu penempatan atau bidikan (ms), dikirim
 * sebagai sisa, bukan jam, karena jam tiap perangkat bisa berbeda.
 */
export type HostMessage =
  | { type: 'sync'; lobby: ArmadaLobby; seat: number; view: ArmadaView | null; timeLeft: number | null }
  | { type: 'rejected'; reason: 'started' | 'full' }

export type GuestMessage = { type: 'join'; name: string; token: string } | { type: 'action'; action: PlayerAction }

export interface ArmadaRoomSnapshot {
  status: 'connecting' | 'ready' | 'error'
  error: RoomError | null
  code: string
  lobby: ArmadaLobby
  seat: number
  view: ArmadaView | null
  /** Kapan waktu penempatan/bidikan habis (jam perangkat ini, ms); null kalau tidak ada. */
  deadline: number | null
}

export interface ArmadaRoom extends ArmadaRoomSnapshot {
  isHost: boolean
  send: (action: PlayerAction) => void
  /** Host: mulai permainan (atau main lagi setelah selesai). */
  start: () => void
  retry: () => void
}

const NAME_MAX = 16

function peerId(code: string): string {
  return `armada-claude-room-${code}`
}

const isCell = (value: unknown) => typeof value === 'number' && Number.isInteger(value)

/** Bentuk aksi dari tamu; aturan fase, giliran, dan SP diperiksa di reducer. */
function isAllowed(action: PlayerAction): boolean {
  switch (action.type) {
    case 'ready':
      return action.fleet === null || Array.isArray(action.fleet)
    case 'fire':
      return isCell(action.cell)
    case 'skill':
      return isSkillId(action.skill) && (action.center === undefined || isCell(action.center))
    default:
      return false
  }
}

function emptySnapshot(code: string, preset: PresetId = DEFAULT_PRESET): ArmadaRoomSnapshot {
  return { status: 'connecting', error: null, code, lobby: { players: [], preset }, seat: 0, view: null, deadline: null }
}

/**
 * Host memegang state asli (termasuk armada semua pemain) dan semua pewaktu: batas penempatan,
 * undian target, batas bidikan, dan jeda hasil tembakan. Tamu hanya menerima `viewFor` kursinya.
 */
class HostRoom {
  private peer: Peer
  private seats: { name: string; token: string; conn: DataConnection | null; wins: number }[]
  private game: ArmadaState | null = null
  private timers: ReturnType<typeof setTimeout>[] = []
  /** Naik tiap permainan baru atau saat room ditutup; pewaktu lama yang terlambat diabaikan. */
  private generation = 0
  private deadline: number | null = null
  private deadlineTimer: ReturnType<typeof setTimeout> | undefined
  /** Giliran yang batas bidikannya sedang berjalan, supaya tidak dipasang ulang oleh aksi lain. */
  private aimKey = ''
  private status: ArmadaRoomSnapshot['status'] = 'connecting'
  private error: RoomError | null = null

  constructor(
    private code: string,
    hostName: string,
    private preset: PresetId,
    private onChange: (snapshot: ArmadaRoomSnapshot) => void,
  ) {
    this.seats = [{ name: hostName, token: '', conn: null, wins: 0 }]
    this.peer = new Peer(peerId(code), PEER_OPTIONS)
    this.peer.on('open', () => {
      this.status = 'ready'
      this.publish()
    })
    this.peer.on('connection', (conn) => this.accept(conn))
    this.peer.on('disconnected', () => {
      if (!this.peer.destroyed) this.peer.reconnect()
    })
    this.peer.on('error', (err) => {
      if (this.status !== 'connecting') return
      this.status = 'error'
      this.error = err.type === 'unavailable-id' ? { code: 'id-taken' } : { code: 'host-failed', detail: err.type }
      this.publish()
    })
    this.publish()
  }

  private accept(conn: DataConnection) {
    conn.on('data', (raw) => {
      const message = raw as GuestMessage
      if (message?.type === 'join') this.join(conn, message)
      else if (message?.type === 'action') this.act(this.seats.findIndex((seat) => seat.conn === conn), message.action)
    })
    conn.on('close', () => this.drop(conn))
    conn.on('error', () => this.drop(conn))
  }

  private join(conn: DataConnection, message: { name: unknown; token: unknown }) {
    const token = typeof message.token === 'string' ? message.token : ''
    const returning = token ? this.seats.findIndex((seat, i) => i > 0 && seat.token === token) : -1
    if (returning > 0) this.seats[returning].conn = conn
    else if (!token || this.game || this.seats.length >= MAX_PLAYERS) {
      conn.send({ type: 'rejected', reason: this.game ? 'started' : 'full' } satisfies HostMessage)
      return
    } else {
      const name = String(message.name ?? '').trim().slice(0, NAME_MAX)
      this.seats.push({ name: name || `Pemain ${this.seats.length + 1}`, token, conn, wins: 0 })
    }
    this.publish()
  }

  private drop(conn: DataConnection) {
    const index = this.seats.findIndex((seat) => seat.conn === conn)
    if (index < 1) return
    // Di lobi kursinya dilepas; saat bermain kursinya ditahan (pewaktu tetap berjalan kalau ia diam).
    if (this.game) this.seats[index].conn = null
    else this.seats.splice(index, 1)
    this.publish()
  }

  act(seat: number, action: PlayerAction) {
    if (!this.game || seat < 0 || !action || typeof action !== 'object' || !isAllowed(action)) return
    this.apply({ ...action, by: seat } as Action)
  }

  private apply(action: Action) {
    const previous = this.game
    if (!previous) return
    const next = reducer(previous, action)
    if (next === previous) return
    this.game = next
    this.react(previous, next)
    this.publish()
  }

  /** Langkah otomatis host setelah state berubah. */
  private react(previous: ArmadaState, next: ArmadaState) {
    if (next.phase === 'placement' && next.players.every((player) => player.ready)) this.begin()
    if (next.phase === 'aim') this.armAim(next)
    else this.aimKey = ''
    if (next.phase !== 'placement' && next.phase !== 'aim') this.setDeadline(null)
    if (previous.phase !== 'result' && next.phase === 'result') this.later(RESULT_MS, () => this.nextTurn())
    if (previous.phase !== 'over' && next.phase === 'over' && next.winner !== null) this.seats[next.winner].wins++
  }

  private later(ms: number, run: () => void) {
    const generation = this.generation
    this.timers.push(
      setTimeout(() => {
        if (generation === this.generation) run()
      }, ms),
    )
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout)
    this.timers = []
    this.setDeadline(null)
    this.aimKey = ''
  }

  /** Memasang batas waktu yang terlihat semua pemain; saat habis, `run` dijalankan. */
  private setDeadline(ms: number | null, run?: () => void) {
    clearTimeout(this.deadlineTimer)
    this.deadline = ms === null ? null : Date.now() + ms
    if (ms === null || !run) return
    const generation = this.generation
    this.deadlineTimer = setTimeout(() => {
      if (generation === this.generation) run()
    }, ms)
  }

  start() {
    if (this.seats.length < MIN_PLAYERS) return
    if (this.game && this.game.phase !== 'over') return
    this.generation++
    this.clearTimers()
    this.game = newGame(
      this.seats.map((seat) => seat.name),
      this.preset,
    )
    this.setDeadline(PLACEMENT_SECONDS * 1000, () => this.begin())
    this.publish()
  }

  /** Mengunci semua armada (yang belum siap diacak), lalu memulai giliran pertama. */
  private begin() {
    const game = this.game
    if (!game || game.phase !== 'placement') return
    const preset = PRESETS[game.preset]
    this.setDeadline(null)
    this.apply({ type: 'begin', fleets: game.players.map((player) => (player.ready ? null : randomFleet(preset))) })
    this.later(START_MS, () => this.nextTurn())
  }

  private nextTurn() {
    const game = this.game
    if (!game || (game.phase !== 'start' && game.phase !== 'result')) return
    const turn = planTurn(game)
    if (!turn) return
    this.apply(turn)
    this.later(TARGET_MS, () => this.apply({ type: 'aim' }))
  }

  /** Batas bidikan per tembakan: Tembakan Ganda mendapat waktu baru untuk tembakan keduanya. */
  private armAim(game: ArmadaState) {
    const key = `${game.round}-${game.turn}-${game.fired}`
    if (key === this.aimKey) return
    this.aimKey = key
    this.setDeadline(TURN_SECONDS * 1000, () => this.autoFire())
  }

  private autoFire() {
    const game = this.game
    if (!game || game.phase !== 'aim' || game.attacker === null || game.target === null) return
    const free = game.players[game.target].shots.flatMap((shot, cell) => (shot === null ? [cell] : []))
    if (!free.length) return
    this.apply({ type: 'fire', by: game.attacker, cell: free[Math.floor(Math.random() * free.length)] })
  }

  private publish() {
    const lobby: ArmadaLobby = {
      players: this.seats.map((seat, i) => ({ name: seat.name, connected: i === 0 || Boolean(seat.conn?.open), wins: seat.wins })),
      preset: this.preset,
    }
    const timeLeft = this.deadline === null ? null : Math.max(0, this.deadline - Date.now())
    this.seats.forEach((seat, i) => {
      if (!seat.conn?.open) return
      const view = this.game ? viewFor(this.game, i) : null
      seat.conn.send({ type: 'sync', lobby, seat: i, view, timeLeft } satisfies HostMessage)
    })
    this.onChange({
      status: this.status,
      error: this.error,
      code: this.code,
      lobby,
      seat: 0,
      view: this.game ? viewFor(this.game, 0) : null,
      deadline: this.deadline,
    })
  }

  destroy() {
    this.generation++
    this.clearTimers()
    this.onChange = () => {}
    this.peer.destroy()
  }
}

/** Token acak per room, disimpan per tab supaya refresh bisa kembali ke kursi yang sama. */
function guestToken(code: string): string {
  const key = `armada-token:${code}`
  const fresh = Math.random().toString(36).slice(2) + Date.now().toString(36)
  try {
    const saved = sessionStorage.getItem(key)
    if (saved) return saved
    sessionStorage.setItem(key, fresh)
  } catch {
    // sessionStorage bisa diblokir; token tetap berlaku selama tab tidak di-refresh.
  }
  return fresh
}

class GuestRoom {
  private peer: Peer
  private conn: DataConnection | null = null
  private connectTimer: ReturnType<typeof setTimeout> | undefined
  private snapshot: ArmadaRoomSnapshot

  constructor(
    code: string,
    name: string,
    private onChange: (snapshot: ArmadaRoomSnapshot) => void,
  ) {
    this.snapshot = emptySnapshot(code)
    this.connectTimer = setTimeout(() => {
      void iceDetail(this.conn).then((detail) => this.fail({ code: 'unreachable', detail }))
    }, CONNECT_TIMEOUT_MS)
    this.peer = new Peer(PEER_OPTIONS)
    this.peer.on('open', () => {
      const conn = this.peer.connect(peerId(code), { reliable: true, serialization: 'json' })
      this.conn = conn
      conn.on('open', () => {
        clearTimeout(this.connectTimer)
        conn.send({ type: 'join', name, token: guestToken(code) } satisfies GuestMessage)
      })
      conn.on('data', (raw) => {
        const message = raw as HostMessage
        if (message.type === 'rejected') this.fail({ code: message.reason })
        else if (message.type === 'sync') {
          const { lobby, seat, view, timeLeft } = message
          const deadline = typeof timeLeft === 'number' ? Date.now() + timeLeft : null
          this.update({ status: 'ready', error: null, lobby, seat, view, deadline })
        }
      })
      conn.on('close', () => this.fail({ code: 'host-lost' }))
    })
    this.peer.on('error', (err) => {
      this.fail(err.type === 'peer-unavailable' ? { code: 'not-found' } : { code: 'connect-failed', detail: err.type })
    })
    this.update({})
  }

  private update(patch: Partial<ArmadaRoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.onChange(this.snapshot)
  }

  private fail(error: RoomError) {
    if (this.snapshot.status !== 'error') this.update({ status: 'error', error })
  }

  send(action: PlayerAction) {
    if (this.conn?.open) this.conn.send({ type: 'action', action } satisfies GuestMessage)
  }

  destroy() {
    clearTimeout(this.connectTimer)
    this.onChange = () => {}
    this.peer.destroy()
  }
}

export function useArmadaHostRoom(name: string, preset: PresetId): ArmadaRoom {
  const [snapshot, setSnapshot] = useState(() => emptySnapshot('', preset))
  const roomRef = useRef<HostRoom | null>(null)

  useEffect(() => {
    const room = new HostRoom(randomCode(), name, isPresetId(preset) ? preset : DEFAULT_PRESET, setSnapshot)
    roomRef.current = room
    return () => room.destroy()
  }, [name, preset])

  return {
    ...snapshot,
    isHost: true,
    send: (action) => roomRef.current?.act(0, action),
    start: () => roomRef.current?.start(),
    retry: () => {},
  }
}

export function useArmadaGuestRoom(code: string, name: string): ArmadaRoom {
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(code))
  const [attempt, setAttempt] = useState(0)
  const roomRef = useRef<GuestRoom | null>(null)

  useEffect(() => {
    const room = new GuestRoom(code, name, setSnapshot)
    roomRef.current = room
    return () => room.destroy()
  }, [code, name, attempt])

  return {
    ...snapshot,
    isHost: false,
    send: (action) => roomRef.current?.send(action),
    start: () => {},
    retry: () => setAttempt((n) => n + 1),
  }
}
