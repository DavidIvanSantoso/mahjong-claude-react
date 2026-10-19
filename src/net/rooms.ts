import Peer, { type DataConnection } from 'peerjs'
import { useEffect, useRef, useState } from 'react'
import { roundDeltas } from '../game/scoring'
import {
  initialState,
  nextDeal,
  reducer,
  rollForDealer,
  type Action,
  type GameState,
  type Ruleset,
} from '../game/state'
import { DEFAULT_TURN_SECONDS, isTimed, timeoutAction, turnLimit } from '../game/timer'
import {
  absentAction,
  awaitedSeat,
  isAllowed,
  peerId,
  randomCode,
  viewFor,
  type GuestMessage,
  type HostMessage,
  type LobbyInfo,
  type RoomError,
} from './online'
import { t } from '../i18n'
import { CONNECT_TIMEOUT_MS, iceDetail, PEER_OPTIONS } from './ice'

export interface RoomSnapshot {
  status: 'connecting' | 'ready' | 'error'
  error: RoomError | null
  code: string
  lobby: LobbyInfo
  /** Kursi perangkat ini. */
  seat: number
  /** State permainan yang sudah disaring untuk kursi ini; null selama masih di lobi. */
  view: GameState | null
  /** Kapan waktu aksi yang sedang ditunggu habis (jam perangkat ini, ms); null kalau tidak ada. */
  deadline: number | null
  /** Batas waktu aksi itu sedang dipercepat karena time attack. */
  rush: boolean
}

export interface Room extends RoomSnapshot {
  isHost: boolean
  send: (action: Action) => void
  /** Host: mulai permainan (atau ronde baru). */
  start: () => void
  /** Tamu: coba sambung lagi setelah putus. */
  retry: () => void
}

const NAME_MAX = 16
/** Waktu tunggu sebelum pemain yang terputus dianggap keluar (cukup untuk refresh halaman). */
const GRACE_MS = 15_000

function emptySnapshot(
  code: string,
  capacity: number,
  turnSeconds: number,
  timeAttack: boolean,
  ruleset: Ruleset = 'classic',
): RoomSnapshot {
  return {
    status: 'connecting',
    error: null,
    code,
    lobby: { capacity, turnSeconds, timeAttack, ruleset, players: [] },
    seat: 0,
    view: null,
    deadline: null,
    rush: false,
  }
}

/**
 * Host memegang state asli permainan: mengocok, memvalidasi aksi tiap kursi, lalu
 * mengirim ke setiap pemain versi state yang hanya memuat tangannya sendiri.
 */
class HostRoom {
  private peer: Peer
  private seats: {
    name: string
    token: string
    conn: DataConnection | null
    /** Kapan koneksinya putus; null selama tersambung. */
    offlineSince: number | null
    /** Skor selama room ini dibuka (lihat LobbyInfo). */
    score: number
  }[]
  private game: GameState | null = null
  /** Ronde selesai yang hasilnya sudah dicatat, supaya skornya tidak terhitung dua kali. */
  private scoredGame: GameState | null = null
  private graceTimer: ReturnType<typeof setTimeout> | undefined
  /** State yang batas waktunya sedang berjalan; berganti state berarti waktu dihitung ulang. */
  private timedGame: GameState | null = null
  private deadline: number | null = null
  private rush = false
  private turnTimer: ReturnType<typeof setTimeout> | undefined
  private status: RoomSnapshot['status'] = 'connecting'
  private error: RoomError | null = null

  constructor(
    private code: string,
    hostName: string,
    private capacity: number,
    private turnSeconds: number,
    private timeAttack: boolean,
    private ruleset: Ruleset,
    private onChange: (snapshot: RoomSnapshot) => void,
  ) {
    this.seats = [{ name: hostName, token: '', conn: null, offlineSince: null, score: 0 }]
    this.peer = new Peer(peerId(code), PEER_OPTIONS)
    this.peer.on('open', () => {
      this.status = 'ready'
      this.publish()
    })
    this.peer.on('connection', (conn) => this.accept(conn))
    // Putus dari server perantara tidak memutus pemain yang sudah terhubung,
    // tapi perlu disambung lagi supaya pemain baru/yang putus bisa masuk.
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
    } else if (!token || this.game || this.seats.length >= this.capacity) {
      const reason = this.game ? 'started' : 'full'
      conn.send({ type: 'rejected', reason } satisfies HostMessage)
      return
    } else {
      const name = String(message.name ?? '').trim().slice(0, NAME_MAX)
      this.seats.push({
        name: name || t(`Pemain ${this.seats.length + 1}`, `Player ${this.seats.length + 1}`),
        token,
        conn,
        offlineSince: null,
        score: 0,
      })
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
    if (this.seats.length !== this.capacity) return
    if (this.game && this.game.phase !== 'over') return
    const names = this.seats.map((seat) => seat.name)
    const deal = this.game ? nextDeal(this.game) : rollForDealer(this.ruleset, names.length)
    this.game = reducer(initialState, { type: 'start', names, deal })
    this.update()
  }

  private isAbsent(seat: number): boolean {
    return seat > 0 && !this.seats[seat].conn?.open
  }

  /**
   * Menjalankan semua langkah yang tidak butuh keputusan pemain:
   * - langkah "berikan perangkat" (tiap pemain online punya layar sendiri);
   * - aksi pengganti untuk pemain yang terputus lebih lama dari GRACE_MS.
   * Kalau yang tersambung tinggal satu orang, permainan menunggu, tidak dilewati.
   */
  private advance() {
    clearTimeout(this.graceTimer)
    for (;;) {
      const game = this.game
      if (!game) return
      if (game.phase === 'claim' && !game.claimRevealed) {
        this.game = reducer(game, { type: 'reveal' })
        continue
      }
      const seat = awaitedSeat(game)
      if (seat === null) return

      if (!this.isAbsent(seat)) {
        if (game.phase !== 'handoff') return
        this.game = reducer(game, { type: 'reveal' })
        continue
      }

      const present = this.seats.filter((_, i) => !this.isAbsent(i)).length
      if (present < 2) return
      const graceLeft = GRACE_MS - (Date.now() - (this.seats[seat].offlineSince ?? 0))
      if (graceLeft > 0) {
        this.graceTimer = setTimeout(() => this.update(), graceLeft)
        return
      }
      this.game = reducer(game, absentAction(game))
    }
  }

  /** Memasang batas waktu untuk aksi yang sedang ditunggu; saat habis, aksinya dijalankan otomatis. */
  private armTimer() {
    if (this.game === this.timedGame) return
    clearTimeout(this.turnTimer)
    this.timedGame = this.game
    this.deadline = null
    this.rush = false
    if (!this.game || !isTimed(this.game)) return
    const { seconds, rush } = turnLimit(this.game, this.turnSeconds, this.timeAttack)
    this.rush = rush
    this.deadline = Date.now() + seconds * 1000
    this.turnTimer = setTimeout(() => this.expire(), seconds * 1000)
  }

  private expire() {
    const action = this.game && timeoutAction(this.game)
    if (!this.game || !action) return
    this.game = reducer(this.game, action)
    this.update()
  }

  /** Mencatat hasil ronde yang baru selesai; ronde seri tidak mengubah skor siapa pun. */
  private score() {
    const game = this.game
    if (!game || game.phase !== 'over' || game === this.scoredGame) return
    this.scoredGame = game
    roundDeltas(game).forEach((delta, i) => {
      this.seats[i].score += delta
    })
  }

  private update() {
    this.advance()
    this.score()
    this.armTimer()
    this.publish()
  }

  private publish() {
    const timeLeft = this.deadline === null ? null : Math.max(0, this.deadline - Date.now())
    const lobby: LobbyInfo = {
      capacity: this.capacity,
      turnSeconds: this.turnSeconds,
      timeAttack: this.timeAttack,
      ruleset: this.ruleset,
      players: this.seats.map((seat, i) => ({
        name: seat.name,
        connected: i === 0 || Boolean(seat.conn?.open),
        score: seat.score,
      })),
    }
    this.seats.forEach((seat, i) => {
      if (!seat.conn?.open) return
      const view = this.game ? viewFor(this.game, i) : null
      seat.conn.send({ type: 'sync', lobby, seat: i, view, timeLeft, rush: this.rush } satisfies HostMessage)
    })
    this.onChange({
      status: this.status,
      error: this.error,
      code: this.code,
      lobby,
      seat: 0,
      view: this.game ? viewFor(this.game, 0) : null,
      deadline: this.deadline,
      rush: this.rush,
    })
  }

  destroy() {
    clearTimeout(this.graceTimer)
    clearTimeout(this.turnTimer)
    this.onChange = () => {}
    this.peer.destroy()
  }
}

/** Token acak per room, disimpan per tab supaya refresh bisa kembali ke kursi yang sama. */
function guestToken(code: string): string {
  const key = `mahjong-token:${code}`
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
  private snapshot: RoomSnapshot

  constructor(
    code: string,
    name: string,
    private onChange: (snapshot: RoomSnapshot) => void,
  ) {
    this.snapshot = emptySnapshot(code, 0, DEFAULT_TURN_SECONDS, false)
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
        conn.send({ type: 'join', name, token: guestToken(code) } satisfies GuestMessage)
      })
      conn.on('data', (raw) => {
        const message = raw as HostMessage
        if (message.type === 'rejected') this.fail({ code: message.reason })
        else if (message.type === 'sync') {
          const { lobby, seat, view, timeLeft } = message
          const rush = message.rush === true
          const deadline = typeof timeLeft === 'number' ? Date.now() + timeLeft : null
          this.update({ status: 'ready', error: null, lobby, seat, view, deadline, rush })
        }
      })
      conn.on('close', () => this.fail({ code: 'host-lost' }))
    })
    this.peer.on('error', (err) => {
      this.fail(err.type === 'peer-unavailable' ? { code: 'not-found' } : { code: 'connect-failed', detail: err.type })
    })
    this.update({})
  }

  private update(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.onChange(this.snapshot)
  }

  private fail(error: RoomError) {
    // Kesalahan pertama yang paling informatif; penutupan koneksi sesudahnya diabaikan.
    if (this.snapshot.status !== 'error') this.update({ status: 'error', error })
  }

  send(action: Action) {
    if (this.conn?.open) this.conn.send({ type: 'action', action } satisfies GuestMessage)
  }

  destroy() {
    clearTimeout(this.connectTimer)
    this.onChange = () => {}
    this.peer.destroy()
  }
}

export function useHostRoom(
  name: string,
  capacity: number,
  turnSeconds: number,
  timeAttack: boolean,
  ruleset: Ruleset,
): Room {
  const [snapshot, setSnapshot] = useState(() =>
    emptySnapshot('', capacity, turnSeconds, timeAttack, ruleset),
  )
  const roomRef = useRef<HostRoom | null>(null)

  useEffect(() => {
    // Kode dibuat di sini (bukan saat render) supaya tiap pemasangan efek memakai ID baru;
    // server PeerJS tidak langsung melepas ID lama.
    const room = new HostRoom(randomCode(), name, capacity, turnSeconds, timeAttack, ruleset, setSnapshot)
    roomRef.current = room
    return () => room.destroy()
  }, [name, capacity, turnSeconds, timeAttack, ruleset])

  return {
    ...snapshot,
    isHost: true,
    send: (action) => roomRef.current?.act(0, action),
    start: () => roomRef.current?.start(),
    retry: () => {},
  }
}

export function useGuestRoom(code: string, name: string): Room {
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(code, 0, DEFAULT_TURN_SECONDS, false))
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
