import Peer, { type DataConnection } from 'peerjs'
import { useEffect, useRef, useState } from 'react'
import { randomCode, type RoomError } from '../net/online'
import { COLORS, type Card, type Color } from './cards'
import {
  reducer,
  roundPoints,
  startRound,
  topCard,
  type Action,
  type Phase,
  type UnoMode,
  type UnoState,
} from './state'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6
/** Pemain pertama yang mencapai skor ini memenangkan permainan; skor direset di permainan berikutnya. */
export const TARGET_SCORE = 500
export const DEFAULT_UNO_TURN_SECONDS = 20

export interface UnoLobby {
  /** Mode aturan room ini, ditentukan host saat membuat room. */
  mode: UnoMode
  /** Batas waktu per aksi (detik), ditentukan host saat membuat room. */
  turnSeconds: number
  /** `score`: total poin selama permainan menuju TARGET_SCORE. */
  players: { name: string; connected: boolean; score: number }[]
  /** Pemenang permainan (skor mencapai target); null selama belum ada. */
  champion: number | null
}

/** State permainan yang dilihat satu kursi: tangan lawan hanya berupa jumlah kartu. */
export interface UnoView {
  mode: UnoMode
  phase: Phase
  current: number
  direction: 1 | -1
  color: Color
  top: Card
  drawCount: number
  players: { name: string; count: number; declared: boolean }[]
  /** Tangan kursi ini. */
  hand: Card[]
  drawnId: number | null
  vulnerable: number | null
  /** Fase `challenge`: siapa yang mengeluarkan Wild Draw Four, dan warna yang berlaku sebelumnya. */
  challengeFrom: number | null
  challengeColor: Color | null
  /** Fase `stack`: jumlah kartu hukuman +2/+4 yang menumpuk. */
  pendingDraw: number
  dealer: number
  winner: number | null
  /** Setelah ronde berakhir, semua tangan dibuka untuk perhitungan poin. */
  hands: Card[][] | null
  points: number
  log: string[]
}

export type UnoHostMessage =
  | { type: 'sync'; lobby: UnoLobby; seat: number; view: UnoView | null; timeLeft: number | null }
  | { type: 'rejected'; reason: 'started' | 'full' }

export type UnoGuestMessage = { type: 'join'; name: string; token: string } | { type: 'action'; action: Action }

export interface UnoRoomSnapshot {
  status: 'connecting' | 'ready' | 'error'
  error: RoomError | null
  code: string
  lobby: UnoLobby
  seat: number
  view: UnoView | null
  /** Kapan waktu aksi yang sedang ditunggu habis (jam perangkat ini, ms). */
  deadline: number | null
}

export interface UnoRoom extends UnoRoomSnapshot {
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

/** Awalan berbeda dari room mahjong, supaya kode room kedua game tidak bertabrakan. */
function peerId(code: string): string {
  return `uno-claude-room-${code}`
}

export function viewFor(s: UnoState, seat: number): UnoView {
  const over = s.phase === 'over'
  return {
    mode: s.mode,
    phase: s.phase,
    current: s.current,
    direction: s.direction,
    color: s.color,
    top: topCard(s),
    drawCount: s.drawPile.length,
    players: s.players.map((player) => ({ name: player.name, count: player.hand.length, declared: player.declared })),
    hand: s.players[seat]?.hand ?? [],
    drawnId: s.current === seat ? s.drawnId : null,
    vulnerable: s.vulnerable,
    challengeFrom: s.challenge?.from ?? null,
    challengeColor: s.challenge?.color ?? null,
    pendingDraw: s.pendingDraw,
    dealer: s.dealer,
    winner: s.winner,
    hands: over ? s.players.map((player) => player.hand) : null,
    points: over ? roundPoints(s) : 0,
    log: s.log,
  }
}

/** Aksi giliran hanya dari pemain yang ditunggu; UNO dan tangkap boleh dari siapa saja. */
function isAllowed(s: UnoState, seat: number, action: Action): boolean {
  switch (action.type) {
    case 'play':
      return (
        (s.phase === 'turn' || s.phase === 'drawn' || s.phase === 'stack') &&
        s.current === seat &&
        Number.isInteger(action.cardId) &&
        (action.under === undefined || (Array.isArray(action.under) && action.under.every(Number.isInteger))) &&
        (action.target === undefined || Number.isInteger(action.target))
      )
    case 'draw':
      return (s.phase === 'turn' || s.phase === 'stack') && s.current === seat
    case 'pass':
      return s.phase === 'drawn' && s.current === seat
    case 'chooseColor':
      return s.phase === 'color' && s.current === seat && COLORS.includes(action.color)
    case 'challenge':
    case 'accept':
      return s.phase === 'challenge' && s.current === seat
    case 'uno':
      return s.phase !== 'over'
    case 'catch':
      return s.phase !== 'over' && Number.isInteger(action.target)
    default:
      // `timeout` hanya dijalankan host sendiri.
      return false
  }
}

function emptySnapshot(code: string, turnSeconds: number, mode: UnoMode = 'classic'): UnoRoomSnapshot {
  return {
    status: 'connecting',
    error: null,
    code,
    lobby: { mode, turnSeconds, players: [], champion: null },
    seat: 0,
    view: null,
    deadline: null,
  }
}

/**
 * Host memegang state asli: mengocok, memvalidasi aksi tiap kursi, menjalankan batas waktu,
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
  private game: UnoState | null = null
  private scoredGame: UnoState | null = null
  private champion: number | null = null
  private graceTimer: ReturnType<typeof setTimeout> | undefined
  /** State yang batas waktunya sedang berjalan; dibandingkan lewat `step` (lihat UnoState.step). */
  private timedGame: UnoState | null = null
  private deadline: number | null = null
  private turnTimer: ReturnType<typeof setTimeout> | undefined
  private status: UnoRoomSnapshot['status'] = 'connecting'
  private error: RoomError | null = null

  constructor(
    private code: string,
    hostName: string,
    private turnSeconds: number,
    private mode: UnoMode,
    private onChange: (snapshot: UnoRoomSnapshot) => void,
  ) {
    this.seats = [{ name: hostName, token: '', conn: null, offlineSince: null, score: 0 }]
    this.peer = new Peer(peerId(code))
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
      const message = raw as UnoGuestMessage
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
      conn.send({ type: 'rejected', reason: this.game ? 'started' : 'full' } satisfies UnoHostMessage)
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
    // Kursi pelaku UNO/tangkap diambil dari koneksinya, bukan dari isi pesan.
    const trusted = action.type === 'uno' || action.type === 'catch' ? { ...action, seat } : action
    if (!isAllowed(this.game, seat, trusted)) return
    this.game = reducer(this.game, trusted)
    this.update()
  }

  start() {
    if (this.seats.length < MIN_PLAYERS) return
    if (this.game && this.game.phase !== 'over') return
    // Permainan sebelumnya sudah punya juara: mulai dari nol lagi.
    if (this.champion !== null) {
      this.champion = null
      this.seats.forEach((seat) => (seat.score = 0))
    }
    const names = this.seats.map((seat) => seat.name)
    // Pembagi pertama diacak; ronde berikutnya pindah ke pemain di sebelah kirinya.
    const dealer = this.game ? (this.game.dealer + 1) % names.length : Math.floor(Math.random() * names.length)
    this.game = startRound(names, dealer, this.mode)
    this.update()
  }

  private isAbsent(seat: number): boolean {
    return seat > 0 && !this.seats[seat].conn?.open
  }

  /**
   * Pemain yang terputus lebih lama dari GRACE_MS dijalankan otomatis (seperti waktu habis).
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

  /** Batas waktu dipasang ulang hanya saat giliran berganti, bukan saat ada yang bilang UNO. */
  private armTimer() {
    const game = this.game
    if (game && this.timedGame && game.step === this.timedGame.step && game.phase === this.timedGame.phase) return
    clearTimeout(this.turnTimer)
    this.timedGame = game
    this.deadline = null
    if (!game || game.phase === 'over') return
    this.deadline = Date.now() + this.turnSeconds * 1000
    this.turnTimer = setTimeout(() => this.expire(), this.turnSeconds * 1000)
  }

  private expire() {
    if (!this.game || this.game.phase === 'over') return
    this.game = reducer(this.game, { type: 'timeout' })
    this.update()
  }

  private score() {
    const game = this.game
    if (!game || game.phase !== 'over' || game === this.scoredGame || game.winner === null) return
    this.scoredGame = game
    const winner = this.seats[game.winner]
    winner.score += roundPoints(game)
    if (winner.score >= TARGET_SCORE) this.champion = game.winner
  }

  private update() {
    this.advance()
    this.score()
    this.armTimer()
    this.publish()
  }

  private publish() {
    const timeLeft = this.deadline === null ? null : Math.max(0, this.deadline - Date.now())
    const lobby: UnoLobby = {
      mode: this.mode,
      turnSeconds: this.turnSeconds,
      champion: this.champion,
      players: this.seats.map((seat, i) => ({
        name: seat.name,
        connected: i === 0 || Boolean(seat.conn?.open),
        score: seat.score,
      })),
    }
    this.seats.forEach((seat, i) => {
      if (!seat.conn?.open) return
      const view = this.game ? viewFor(this.game, i) : null
      seat.conn.send({ type: 'sync', lobby, seat: i, view, timeLeft } satisfies UnoHostMessage)
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
    clearTimeout(this.graceTimer)
    clearTimeout(this.turnTimer)
    this.onChange = () => {}
    this.peer.destroy()
  }
}

/** Token acak per room, disimpan per tab supaya refresh bisa kembali ke kursi yang sama. */
function guestToken(code: string): string {
  const key = `uno-token:${code}`
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
  private snapshot: UnoRoomSnapshot

  constructor(
    code: string,
    name: string,
    private onChange: (snapshot: UnoRoomSnapshot) => void,
  ) {
    this.snapshot = emptySnapshot(code, DEFAULT_UNO_TURN_SECONDS)
    this.peer = new Peer()
    this.peer.on('open', () => {
      const conn = this.peer.connect(peerId(code), { reliable: true, serialization: 'json' })
      this.conn = conn
      conn.on('open', () => {
        conn.send({ type: 'join', name, token: guestToken(code) } satisfies UnoGuestMessage)
      })
      conn.on('data', (raw) => {
        const message = raw as UnoHostMessage
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

  private update(patch: Partial<UnoRoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.onChange(this.snapshot)
  }

  private fail(error: RoomError) {
    if (this.snapshot.status !== 'error') this.update({ status: 'error', error })
  }

  send(action: Action) {
    if (this.conn?.open) this.conn.send({ type: 'action', action } satisfies UnoGuestMessage)
  }

  destroy() {
    this.onChange = () => {}
    this.peer.destroy()
  }
}

export function useUnoHostRoom(name: string, turnSeconds: number, mode: UnoMode): UnoRoom {
  const [snapshot, setSnapshot] = useState(() => emptySnapshot('', turnSeconds, mode))
  const roomRef = useRef<HostRoom | null>(null)

  useEffect(() => {
    // Kode dibuat di sini supaya tiap pemasangan efek memakai ID baru (lihat net/rooms.ts).
    const room = new HostRoom(randomCode(), name, turnSeconds, mode, setSnapshot)
    roomRef.current = room
    return () => room.destroy()
  }, [name, turnSeconds, mode])

  return {
    ...snapshot,
    isHost: true,
    send: (action) => roomRef.current?.act(0, action),
    start: () => roomRef.current?.start(),
    retry: () => {},
  }
}

export function useUnoGuestRoom(code: string, name: string): UnoRoom {
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(code, DEFAULT_UNO_TURN_SECONDS))
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
