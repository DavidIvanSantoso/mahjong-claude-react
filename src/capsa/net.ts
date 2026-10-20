import Peer, { type DataConnection } from 'peerjs'
import { useEffect, useRef, useState } from 'react'
import { CONNECT_TIMEOUT_MS, iceDetail, PEER_OPTIONS } from '../net/ice'
import { randomCode, type RoomError } from '../net/online'
import type { Card } from './cards'
import { reducer, roundDeltas, startRound, type Action, type CapsaState, type Play } from './state'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4

/** Capsa tidak memakai batas waktu giliran; pemain berpikir selama yang dibutuhkan. */
export interface CapsaLobby {
  /** `score`: total poin selama room ini dibuka, bisa negatif. */
  players: { name: string; connected: boolean; score: number }[]
}

/** State permainan yang dilihat satu kursi: tangan lawan hanya berupa jumlah kartu. */
export interface CapsaView {
  phase: CapsaState['phase']
  current: number
  leader: number
  trick: Play[]
  mustInclude: number | null
  fiveCardPlayed: boolean
  reversed: boolean
  players: { name: string; count: number; passed: boolean }[]
  /** Tangan kursi ini. */
  hand: Card[]
  winner: number | null
  /** Setelah ronde berakhir, semua tangan dibuka dan perubahan skornya dikirim. */
  hands: Card[][] | null
  deltas: number[] | null
  log: string[]
}

export type CapsaHostMessage =
  | { type: 'sync'; lobby: CapsaLobby; seat: number; view: CapsaView | null }
  | { type: 'rejected'; reason: 'started' | 'full' }

export type CapsaGuestMessage = { type: 'join'; name: string; token: string } | { type: 'action'; action: Action }

export interface CapsaRoomSnapshot {
  status: 'connecting' | 'ready' | 'error'
  error: RoomError | null
  code: string
  lobby: CapsaLobby
  seat: number
  view: CapsaView | null
}

export interface CapsaRoom extends CapsaRoomSnapshot {
  isHost: boolean
  send: (action: Action) => void
  /** Host: mulai permainan atau ronde berikutnya. */
  start: () => void
  /** Tamu: coba sambung lagi setelah putus. */
  retry: () => void
}

const NAME_MAX = 16
/** Waktu tunggu sebelum pemain yang terputus dianggap keluar (cukup untuk refresh halaman). */
const GRACE_MS = 15_000

/** Awalan berbeda dari room mahjong dan UNO, supaya kode room tidak bertabrakan. */
function peerId(code: string): string {
  return `capsa-claude-room-${code}`
}

export function viewFor(s: CapsaState, seat: number): CapsaView {
  const over = s.phase === 'over'
  return {
    phase: s.phase,
    current: s.current,
    leader: s.leader,
    trick: s.trick,
    mustInclude: s.mustInclude,
    fiveCardPlayed: s.fiveCardPlayed,
    reversed: s.reversed,
    players: s.players.map((player) => ({ name: player.name, count: player.hand.length, passed: player.passed })),
    hand: s.players[seat]?.hand ?? [],
    winner: s.winner,
    hands: over ? s.players.map((player) => player.hand) : null,
    deltas: over ? roundDeltas(s) : null,
    log: s.log,
  }
}

/** Aksi hanya dari pemain yang sedang ditunggu; `timeout` hanya dijalankan host sendiri. */
function isAllowed(s: CapsaState, seat: number, action: Action): boolean {
  if (s.phase !== 'play' || s.current !== seat) return false
  if (action.type === 'pass') return true
  return (
    action.type === 'play' &&
    Array.isArray(action.cardIds) &&
    action.cardIds.every(Number.isInteger) &&
    (action.walik === undefined || typeof action.walik === 'boolean')
  )
}

function emptySnapshot(code: string): CapsaRoomSnapshot {
  return {
    status: 'connecting',
    error: null,
    code,
    lobby: { players: [] },
    seat: 0,
    view: null,
  }
}

/**
 * Host memegang state asli: mengocok, memvalidasi aksi tiap kursi, menjalankan pemain yang terputus,
 * lalu mengirim ke tiap pemain versi state yang hanya memuat tangannya sendiri.
 */
class HostRoom {
  private peer: Peer
  private seats: {
    name: string
    token: string
    conn: DataConnection | null
    offlineSince: number | null
    score: number
  }[]
  private game: CapsaState | null = null
  private scoredGame: CapsaState | null = null
  private graceTimer: ReturnType<typeof setTimeout> | undefined
  private status: CapsaRoomSnapshot['status'] = 'connecting'
  private error: RoomError | null = null

  constructor(
    private code: string,
    hostName: string,
    private onChange: (snapshot: CapsaRoomSnapshot) => void,
  ) {
    this.seats = [{ name: hostName, token: '', conn: null, offlineSince: null, score: 0 }]
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
      const message = raw as CapsaGuestMessage
      if (message?.type === 'join') this.join(conn, message)
      else if (message?.type === 'action') {
        this.act(this.seats.findIndex((seat) => seat.conn === conn), message.action)
      }
    })
    conn.on('close', () => this.drop(conn))
    conn.on('error', () => this.drop(conn))
  }

  private join(conn: DataConnection, message: { name: unknown; token: unknown }) {
    const token = typeof message.token === 'string' ? message.token : ''
    const returning = token ? this.seats.findIndex((seat, i) => i > 0 && seat.token === token) : -1

    if (returning > 0) {
      this.seats[returning].conn = conn
      this.seats[returning].offlineSince = null
    } else if (!token || this.game || this.seats.length >= MAX_PLAYERS) {
      conn.send({ type: 'rejected', reason: this.game ? 'started' : 'full' } satisfies CapsaHostMessage)
      return
    } else {
      const name = String(message.name ?? '').trim().slice(0, NAME_MAX)
      this.seats.push({ name: name || `Pemain ${this.seats.length + 1}`, token, conn, offlineSince: null, score: 0 })
    }
    this.update()
  }

  private drop(conn: DataConnection) {
    const index = this.seats.findIndex((seat) => seat.conn === conn)
    if (index < 1) return
    // Di lobi kursinya dilepas; saat permainan berjalan kursinya ditahan untuk sambung ulang.
    if (this.game) {
      this.seats[index].conn = null
      this.seats[index].offlineSince = Date.now()
    } else this.seats.splice(index, 1)
    this.update()
  }

  act(seat: number, action: Action) {
    if (!this.game || seat < 0 || !action || typeof action !== 'object') return
    if (!isAllowed(this.game, seat, action)) return
    this.game = reducer(this.game, action)
    this.update()
  }

  start() {
    if (this.seats.length < MIN_PLAYERS) return
    if (this.game && this.game.phase !== 'over') return
    const names = this.seats.map((seat) => seat.name)
    // Tiap ronde dimulai pemegang 3♦ (atau kartu terkecil kalau 3♦ tidak terbagi).
    this.game = startRound(names)
    this.update()
  }

  private isAbsent(seat: number): boolean {
    return seat > 0 && !this.seats[seat].conn?.open
  }

  /**
   * Pemain yang terputus lebih lama dari GRACE_MS dijalankan otomatis: lewat, atau kalau sedang
   * memimpin, kartu terkecilnya dikeluarkan (aksi `timeout`).
   * Kalau yang tersambung tinggal satu orang, permainan menunggu.
   */
  private advance() {
    clearTimeout(this.graceTimer)
    for (;;) {
      const game = this.game
      if (!game || game.phase === 'over' || !this.isAbsent(game.current)) return
      const present = this.seats.filter((_, i) => !this.isAbsent(i)).length
      if (present < 2) return
      const graceLeft = GRACE_MS - (Date.now() - (this.seats[game.current].offlineSince ?? 0))
      if (graceLeft > 0) {
        this.graceTimer = setTimeout(() => this.update(), graceLeft)
        return
      }
      this.game = reducer(game, { type: 'timeout' })
    }
  }

  private score() {
    const game = this.game
    if (!game || game.phase !== 'over' || game === this.scoredGame) return
    this.scoredGame = game
    roundDeltas(game).forEach((delta, i) => (this.seats[i].score += delta))
  }

  private update() {
    this.advance()
    this.score()
    this.publish()
  }

  private publish() {
    const lobby: CapsaLobby = {
      players: this.seats.map((seat, i) => ({
        name: seat.name,
        connected: i === 0 || Boolean(seat.conn?.open),
        score: seat.score,
      })),
    }
    this.seats.forEach((seat, i) => {
      if (!seat.conn?.open) return
      const view = this.game ? viewFor(this.game, i) : null
      seat.conn.send({ type: 'sync', lobby, seat: i, view } satisfies CapsaHostMessage)
    })
    this.onChange({
      status: this.status,
      error: this.error,
      code: this.code,
      lobby,
      seat: 0,
      view: this.game ? viewFor(this.game, 0) : null,
    })
  }

  destroy() {
    clearTimeout(this.graceTimer)
    this.onChange = () => {}
    this.peer.destroy()
  }
}

/** Token acak per room, disimpan per tab supaya refresh bisa kembali ke kursi yang sama. */
function guestToken(code: string): string {
  const key = `capsa-token:${code}`
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
  private snapshot: CapsaRoomSnapshot

  constructor(
    code: string,
    name: string,
    private onChange: (snapshot: CapsaRoomSnapshot) => void,
  ) {
    this.snapshot = emptySnapshot(code)
    // Koneksi yang tidak pernah terbuka (biasanya karena jaringan) dilaporkan, bukan ditunggu terus.
    this.connectTimer = setTimeout(() => {
      void iceDetail(this.conn).then((detail) => this.fail({ code: 'unreachable', detail }))
    }, CONNECT_TIMEOUT_MS)
    this.peer = new Peer(PEER_OPTIONS)
    this.peer.on('open', () => {
      const conn = this.peer.connect(peerId(code), { reliable: true, serialization: 'json' })
      this.conn = conn
      conn.on('open', () => {
        clearTimeout(this.connectTimer)
        conn.send({ type: 'join', name, token: guestToken(code) } satisfies CapsaGuestMessage)
      })
      conn.on('data', (raw) => {
        const message = raw as CapsaHostMessage
        if (message.type === 'rejected') this.fail({ code: message.reason })
        else if (message.type === 'sync') {
          const { lobby, seat, view } = message
          this.update({ status: 'ready', error: null, lobby, seat, view })
        }
      })
      conn.on('close', () => this.fail({ code: 'host-lost' }))
    })
    this.peer.on('error', (err) => {
      this.fail(err.type === 'peer-unavailable' ? { code: 'not-found' } : { code: 'connect-failed', detail: err.type })
    })
    this.update({})
  }

  private update(patch: Partial<CapsaRoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.onChange(this.snapshot)
  }

  private fail(error: RoomError) {
    if (this.snapshot.status !== 'error') this.update({ status: 'error', error })
  }

  send(action: Action) {
    if (this.conn?.open) this.conn.send({ type: 'action', action } satisfies CapsaGuestMessage)
  }

  destroy() {
    clearTimeout(this.connectTimer)
    this.onChange = () => {}
    this.peer.destroy()
  }
}

export function useCapsaHostRoom(name: string): CapsaRoom {
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(''))
  const roomRef = useRef<HostRoom | null>(null)

  useEffect(() => {
    const room = new HostRoom(randomCode(), name, setSnapshot)
    roomRef.current = room
    return () => room.destroy()
  }, [name])

  return {
    ...snapshot,
    isHost: true,
    send: (action) => roomRef.current?.act(0, action),
    start: () => roomRef.current?.start(),
    retry: () => {},
  }
}

export function useCapsaGuestRoom(code: string, name: string): CapsaRoom {
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
