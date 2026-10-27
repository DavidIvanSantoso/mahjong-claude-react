import Peer, { type DataConnection } from 'peerjs'
import { useEffect, useRef, useState } from 'react'
import { CONNECT_TIMEOUT_MS, iceDetail, PEER_OPTIONS } from '../net/ice'
import { randomCode, type RoomError } from '../net/online'
import { aliveSeats, newGame, nextAlive, reducer, type Action, type BomKataState, type Heat } from './state'
import { drawFromBag, RECENT_WINDOW, shuffled, TWIST_CHANCE, twistOptions } from './rounds'
import { loadCategory, loadIndex, normalizeWord, type CategoryEntry } from './words'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6

/** Lama kategori baru ditampilkan (termasuk animasi undian) sebelum bom mulai berdetak. */
const READY_MS = 3200
/** Lama ledakan ditampilkan sebelum kategori berikutnya diundi. */
const BOOM_MS = 3500
/** Durasi sumbu bom diacak di antara dua nilai ini, dan tidak pernah diperlihatkan sebagai angka. */
const FUSE_MIN_MS = 12_000
const FUSE_MAX_MS = 30_000
/** Sisa waktu (ms) saat kedipan naik tingkat: makin dekat ledakan, makin cepat. */
const HEAT_AT: [Heat, number][] = [
  [1, 12_000],
  [2, 6_000],
  [3, 2_500],
]
export interface BomKataLobby {
  /** `wins`: jumlah permainan yang dimenangkan selama room ini dibuka. */
  players: { name: string; connected: boolean; wins: number }[]
  /** Nama semua kategori, untuk animasi undian di semua perangkat. */
  categoryNames: string[]
  library: 'loading' | 'ready' | 'error'
}

/** State yang dikirim ke tamu: tanpa daftar jawaban. */
export type BomKataView = Omit<BomKataState, 'answers'>

export type HostMessage =
  | { type: 'sync'; lobby: BomKataLobby; seat: number; view: BomKataView | null }
  | { type: 'rejected'; reason: 'started' | 'full' }

export type GuestMessage = { type: 'join'; name: string; token: string } | { type: 'action'; action: Action }

export interface BomKataRoomSnapshot {
  status: 'connecting' | 'ready' | 'error'
  error: RoomError | null
  code: string
  lobby: BomKataLobby
  seat: number
  view: BomKataView | null
}

export interface BomKataRoom extends BomKataRoomSnapshot {
  isHost: boolean
  send: (action: Action) => void
  /** Host: mulai permainan (atau main lagi setelah selesai). */
  start: () => void
  retry: () => void
}

const NAME_MAX = 16

function peerId(code: string): string {
  return `bomkata-claude-room-${code}`
}

export function viewFor(s: BomKataState): BomKataView {
  const { answers: _answers, ...view } = s
  return view
}

/** Hanya pemegang bom yang boleh mengetik dan mengirim kata; aksi lain hanya dijalankan host. */
function isAllowed(s: BomKataState, seat: number, action: Action): boolean {
  if (s.phase !== 'play' || s.current !== seat) return false
  if (action.type === 'type') return typeof action.text === 'string'
  if (action.type === 'submit') return typeof action.word === 'string'
  return false
}

function emptySnapshot(code: string): BomKataRoomSnapshot {
  return {
    status: 'connecting',
    error: null,
    code,
    lobby: { players: [], categoryNames: [], library: 'loading' },
    seat: 0,
    view: null,
  }
}

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min))
}

/**
 * Host memegang state asli, kamus kata, dan semua pewaktu: undian kategori, sumbu bom,
 * tingkat kedipan, dan jeda setelah ledakan.
 */
class HostRoom {
  private peer: Peer
  private seats: { name: string; token: string; conn: DataConnection | null; wins: number }[]
  private game: BomKataState | null = null
  private index: CategoryEntry[] = []
  private library: BomKataLobby['library'] = 'loading'
  /**
   * Kantong acak kategori: tiap kategori keluar sekali dalam urutan acak sebelum ada yang terulang
   * (seperti shuffle playlist). Bertahan selama room dibuka, termasuk antarpermainan.
   */
  private bag: CategoryEntry[] = []
  /** Kategori terakhir yang dipakai, paling baru di depan (lihat RECENT_WINDOW). */
  private recent: CategoryEntry[] = []
  private timers: ReturnType<typeof setTimeout>[] = []
  /** Naik tiap permainan baru atau saat room ditutup; pewaktu lama yang terlambat diabaikan. */
  private generation = 0
  private status: BomKataRoomSnapshot['status'] = 'connecting'
  private error: RoomError | null = null

  constructor(
    private code: string,
    hostName: string,
    private onChange: (snapshot: BomKataRoomSnapshot) => void,
  ) {
    this.seats = [{ name: hostName, token: '', conn: null, wins: 0 }]
    loadIndex()
      .then((index) => {
        this.index = index
        this.library = index.length ? 'ready' : 'error'
      })
      .catch(() => (this.library = 'error'))
      .finally(() => this.publish())
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
    // Di lobi kursinya dilepas; saat bermain kursinya ditahan (bomnya tetap meledak kalau ia diam).
    if (this.game) this.seats[index].conn = null
    else this.seats.splice(index, 1)
    this.publish()
  }

  act(seat: number, action: Action) {
    if (!this.game || seat < 0 || !action || typeof action !== 'object' || !isAllowed(this.game, seat, action)) return
    this.apply(action)
  }

  private apply(action: Action) {
    if (!this.game) return
    const next = reducer(this.game, action)
    if (next === this.game) return
    this.game = next
    this.publish()
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
  }

  start() {
    if (this.seats.length < MIN_PLAYERS || this.library !== 'ready') return
    if (this.game && this.game.phase !== 'over') return
    this.generation++
    this.clearTimers()
    this.game = newGame(this.seats.map((seat) => seat.name))
    this.publish()
    void this.nextRound(Math.floor(Math.random() * this.seats.length))
  }

  private drawCategory(): CategoryEntry {
    if (this.bag.length === 0) this.bag = shuffled(this.index)
    const entry = drawFromBag(this.bag, this.recent)
    this.recent = [entry, ...this.recent].slice(0, Math.min(RECENT_WINDOW, this.index.length - 1))
    return entry
  }

  /** Undi kategori (kadang dengan tantangan), unduh kata-katanya, lalu tampilkan sebelum bom berdetak. */
  private async nextRound(starter: number) {
    const generation = this.generation
    let entry = this.drawCategory()
    let category = await loadCategory(entry).catch(() => null)
    // Satu file gagal diunduh: coba kategori berikutnya sekali.
    if (!category) {
      entry = this.drawCategory()
      category = await loadCategory(entry).catch(() => null)
    }
    if (generation !== this.generation || !this.game) return
    if (!category) {
      this.library = 'error'
      this.publish()
      return
    }
    let answers = [...new Set(category.words.map(normalizeWord).filter(Boolean))]
    let twist: string | undefined
    const options = Math.random() < TWIST_CHANCE ? twistOptions(answers) : []
    if (options.length) {
      const pick = options[Math.floor(Math.random() * options.length)]
      twist = pick.twist
      answers = pick.answers
    }
    this.apply({ type: 'round', category: { id: category.id, name: category.name, twist }, answers, starter })
    this.later(READY_MS, () => this.light())
  }

  /** Nyalakan sumbu: durasi acak, kedipan makin cepat menjelang akhir. */
  private light() {
    this.apply({ type: 'go' })
    const fuse = randomBetween(FUSE_MIN_MS, FUSE_MAX_MS)
    for (const [heat, left] of HEAT_AT) {
      if (fuse <= left) this.apply({ type: 'heat', heat })
      else this.later(fuse - left, () => this.apply({ type: 'heat', heat }))
    }
    this.later(fuse, () => this.explode())
  }

  private explode() {
    this.apply({ type: 'explode' })
    const game = this.game
    if (!game) return
    if (game.phase === 'over') {
      if (game.winner !== null) this.seats[game.winner].wins++
      this.publish()
      return
    }
    // Ronde berikutnya dimulai pemain hidup sesudah yang terkena ledakan.
    const starter = nextAlive(game, game.exploded ?? game.current)
    this.later(BOOM_MS, () => void this.nextRound(aliveSeats(game).includes(starter) ? starter : aliveSeats(game)[0]))
  }

  private publish() {
    const lobby: BomKataLobby = {
      players: this.seats.map((seat, i) => ({ name: seat.name, connected: i === 0 || Boolean(seat.conn?.open), wins: seat.wins })),
      categoryNames: this.index.map((entry) => entry.name),
      library: this.library,
    }
    const view = this.game ? viewFor(this.game) : null
    this.seats.forEach((seat, i) => {
      if (seat.conn?.open) seat.conn.send({ type: 'sync', lobby, seat: i, view } satisfies HostMessage)
    })
    this.onChange({ status: this.status, error: this.error, code: this.code, lobby, seat: 0, view })
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
  const key = `bomkata-token:${code}`
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
  private snapshot: BomKataRoomSnapshot

  constructor(
    code: string,
    name: string,
    private onChange: (snapshot: BomKataRoomSnapshot) => void,
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

  private update(patch: Partial<BomKataRoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.onChange(this.snapshot)
  }

  private fail(error: RoomError) {
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

export function useBomKataHostRoom(name: string): BomKataRoom {
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

export function useBomKataGuestRoom(code: string, name: string): BomKataRoom {
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
