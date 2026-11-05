import Peer, { type DataConnection } from 'peerjs'
import { useEffect, useRef, useState } from 'react'
import { CONNECT_TIMEOUT_MS, iceDetail, PEER_OPTIONS } from '../net/ice'
import { randomCode, type RoomError } from '../net/online'
import { assignRoles, isPresetId, MAX_PLAYERS, MIN_PLAYERS, roleSplit } from './roles'
import { activeSeats, guessResolved, newGame, reducer, SKIP_VOTE, viewFor, type Action, type AsbunState, type AsbunView, type PlayerAction, type Settings } from './state'
import { ANY, CLUE_MAX, GUESS_MAX, loadLibrary, pairKey, selectPair, type PairLibrary } from './words'

/** Batas waktu membuka berkas peran; setelah itu putaran petunjuk dimulai. */
const REVEAL_SECONDS = 25
/** Batas waktu Si Asbun menebak setelah tereliminasi. */
export const GUESS_SECONDS = 40
/** Pemain yang terputus dilewati lebih cepat saat gilirannya. */
const OFFLINE_SECONDS = 6
/** Lama hasil voting ditampilkan sebelum lanjut. */
const ELIMINATION_MS = 5000
/** Lama hasil tebakan yang salah ditampilkan sebelum lanjut. */
const GUESS_RESULT_MS = 4000
/** Jeda minimal antarreaksi emoji dari satu pemain. */
export const REACTION_COOLDOWN_MS = 800

export const TIMER_OPTIONS = {
  clueSeconds: [20, 30, 45, 60],
  discussionSeconds: [20, 30, 45, 60, 90, 120],
  votingSeconds: [20, 30, 45, 60],
}

export interface LobbySettings extends Settings {
  /** Jumlah pemain maksimal di room ini. */
  capacity: number
}

export const DEFAULT_SETTINGS: LobbySettings = {
  capacity: 8,
  preset: 'standar',
  category: ANY,
  difficulty: ANY,
  clueSeconds: 30,
  discussionSeconds: 30,
  votingSeconds: 30,
}

export interface AsbunLobby {
  /** `wins`: jumlah permainan yang dimenangkan selama room ini dibuka. Host selalu siap. */
  players: { name: string; connected: boolean; ready: boolean; wins: number }[]
  settings: LobbySettings
  categories: { id: string; name: string }[]
  library: 'loading' | 'ready' | 'error'
}

/**
 * Pesan dari host ke tamu. `view` sudah disaring untuk kursi penerima (hanya peran dan katanya
 * sendiri). `timeLeft` adalah sisa waktu fase (ms), dikirim sebagai sisa karena jam perangkat berbeda.
 */
export type HostMessage =
  | { type: 'sync'; lobby: AsbunLobby; seat: number; view: AsbunView | null; timeLeft: number | null }
  | { type: 'rejected'; reason: 'started' | 'full' }

export type GuestMessage =
  | { type: 'join'; name: string; token: string }
  | { type: 'ready'; ready: boolean }
  | { type: 'action'; action: PlayerAction }

export interface AsbunRoomSnapshot {
  status: 'connecting' | 'ready' | 'error'
  error: RoomError | null
  code: string
  lobby: AsbunLobby
  seat: number
  view: AsbunView | null
  /** Kapan waktu fase habis (jam perangkat ini, ms); null kalau tidak ada. */
  deadline: number | null
}

export interface AsbunRoom extends AsbunRoomSnapshot {
  isHost: boolean
  send: (action: PlayerAction) => void
  /** Tamu: tandai siap/belum di lobi. */
  setReady: (ready: boolean) => void
  /** Host: ubah pengaturan room (hanya di lobi). */
  configure: (patch: Partial<LobbySettings>) => void
  /** Host: mulai permainan (dari lobi, atau main lagi setelah selesai). */
  start: () => void
  /** Host: akhiri diskusi lebih cepat dan buka voting. */
  skipDiscussion: () => void
  /** Host: kembali ke lobi setelah permainan selesai. */
  toLobby: () => void
  retry: () => void
}

const NAME_MAX = 16
/** Batas panjang teks dari tamu sebelum diperiksa lebih jauh. */
const TEXT_LIMIT = 200

function peerId(code: string): string {
  return `asbun-claude-room-${code}`
}

const isCount = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0

/** Bentuk aksi dari tamu; aturan fase, giliran, dan ronde diperiksa di reducer. */
function isWellFormed(action: PlayerAction): boolean {
  if (!action || typeof action !== 'object' || !isCount(action.round) || typeof action.phase !== 'string') return false
  switch (action.type) {
    case 'ack':
      return true
    case 'clue':
    case 'guess':
      return typeof action.text === 'string' && action.text.length <= TEXT_LIMIT
    case 'vote':
      return isCount(action.target) || action.target === SKIP_VOTE
    case 'react':
      return typeof action.emoji === 'string' && action.emoji.length <= 8
    default:
      return false
  }
}

/** Pengaturan dari host, dirapikan ke nilai yang didukung. */
function cleanSettings(current: LobbySettings, patch: Partial<LobbySettings>, players: number, library: PairLibrary | null): LobbySettings {
  const next = { ...current, ...patch }
  const pick = (value: number, options: number[], fallback: number) => (options.includes(value) ? value : fallback)
  return {
    capacity: Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, players, Math.round(Number(next.capacity)) || current.capacity)),
    preset: isPresetId(next.preset) ? next.preset : current.preset,
    category: next.category === ANY || library?.categories.some((c) => c.id === next.category) ? next.category : current.category,
    difficulty: [ANY, 'easy', 'medium', 'hard'].includes(next.difficulty) ? next.difficulty : current.difficulty,
    clueSeconds: pick(next.clueSeconds, TIMER_OPTIONS.clueSeconds, current.clueSeconds),
    discussionSeconds: pick(next.discussionSeconds, TIMER_OPTIONS.discussionSeconds, current.discussionSeconds),
    votingSeconds: pick(next.votingSeconds, TIMER_OPTIONS.votingSeconds, current.votingSeconds),
  }
}

function emptySnapshot(code: string): AsbunRoomSnapshot {
  return {
    status: 'connecting',
    error: null,
    code,
    lobby: { players: [], settings: DEFAULT_SETTINGS, categories: [], library: 'loading' },
    seat: 0,
    view: null,
    deadline: null,
  }
}

/**
 * Host memegang state asli (peran dan kata semua pemain), kamus pasangan kata, dan semua pewaktu.
 * Tiap tamu hanya menerima `viewFor` kursinya.
 */
class HostRoom {
  private peer: Peer
  private seats: { name: string; token: string; conn: DataConnection | null; ready: boolean; wins: number }[]
  private game: AsbunState | null = null
  private settings: LobbySettings = DEFAULT_SETTINGS
  private library: PairLibrary | null = null
  private libraryStatus: AsbunLobby['library'] = 'loading'
  /** Pasangan kata yang sudah dipakai di room ini, supaya tidak cepat berulang. */
  private used = new Set<string>()
  /** Naik tiap permainan baru, kembali ke lobi, atau room ditutup; pewaktu lama diabaikan. */
  private generation = 0
  private deadline: number | null = null
  private deadlineTimer: ReturnType<typeof setTimeout> | undefined
  /** Langkah yang pewaktunya sedang berjalan, supaya tidak dipasang ulang oleh aksi lain. */
  private timerKey = ''
  /** Waktu reaksi emoji terakhir per kursi, untuk membatasi spam. */
  private lastReaction: number[] = []
  private status: AsbunRoomSnapshot['status'] = 'connecting'
  private error: RoomError | null = null

  constructor(
    private code: string,
    hostName: string,
    private onChange: (snapshot: AsbunRoomSnapshot) => void,
  ) {
    this.seats = [{ name: hostName, token: '', conn: null, ready: true, wins: 0 }]
    loadLibrary()
      .then((library) => {
        this.library = library
        this.libraryStatus = library.pairs.length ? 'ready' : 'error'
      })
      .catch(() => (this.libraryStatus = 'error'))
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
      const seat = this.seats.findIndex((s) => s.conn === conn)
      if (message?.type === 'join') this.join(conn, message)
      else if (message?.type === 'ready') this.markReady(seat, message.ready === true)
      else if (message?.type === 'action') this.act(seat, message.action)
    })
    conn.on('close', () => this.drop(conn))
    conn.on('error', () => this.drop(conn))
  }

  private join(conn: DataConnection, message: { name: unknown; token: unknown }) {
    const token = typeof message.token === 'string' ? message.token.slice(0, 64) : ''
    const returning = token ? this.seats.findIndex((seat, i) => i > 0 && seat.token === token) : -1
    if (returning > 0) this.seats[returning].conn = conn
    else if (!token || this.game || this.seats.length >= this.settings.capacity) {
      conn.send({ type: 'rejected', reason: this.game ? 'started' : 'full' } satisfies HostMessage)
      return
    } else {
      const name = String(message.name ?? '').trim().slice(0, NAME_MAX)
      this.seats.push({ name: name || `Pemain ${this.seats.length + 1}`, token, conn, ready: false, wins: 0 })
    }
    this.update()
  }

  private drop(conn: DataConnection) {
    const index = this.seats.findIndex((seat) => seat.conn === conn)
    if (index < 1) return
    // Di lobi kursinya dilepas; saat bermain kursinya ditahan untuk sambung ulang.
    if (this.game) this.seats[index].conn = null
    else this.seats.splice(index, 1)
    this.update()
  }

  private connected(seat: number): boolean {
    return seat === 0 || Boolean(this.seats[seat]?.conn?.open)
  }

  private markReady(seat: number, ready: boolean) {
    if (seat < 1 || this.game) return
    this.seats[seat].ready = ready
    this.publish()
  }

  configure(patch: Partial<LobbySettings>) {
    if (this.game && this.game.phase !== 'over') return
    this.settings = cleanSettings(this.settings, patch, this.seats.length, this.library)
    this.publish()
  }

  act(seat: number, action: PlayerAction) {
    if (!this.game || seat < 0 || !isWellFormed(action)) return
    if (action.type === 'react') {
      const now = Date.now()
      if (now - (this.lastReaction[seat] ?? 0) < REACTION_COOLDOWN_MS) return
      this.lastReaction[seat] = now
    }
    const text = 'text' in action ? action.text.slice(0, Math.max(CLUE_MAX, GUESS_MAX) + 1) : undefined
    this.apply({ ...action, ...(text !== undefined ? { text } : {}), by: seat } as Action)
  }

  private apply(action: Action) {
    if (!this.game) return
    const next = reducer(this.game, action)
    if (next === this.game) return
    const previous = this.game
    this.game = next
    if (previous.phase !== 'over' && next.phase === 'over') next.winner?.seats.forEach((seat) => this.seats[seat].wins++)
    this.update()
  }

  /** Kursi yang masih tersambung tetap dipertahankan saat permainan baru atau kembali ke lobi. */
  private pruneOffline() {
    this.seats = this.seats.filter((_, i) => this.connected(i))
  }

  /** Bisa mulai: jumlah pemain sah, semua tamu siap, dan kamus sudah dimuat. */
  canStart(): boolean {
    const players = this.seats.filter((_, i) => this.connected(i))
    return (
      this.libraryStatus === 'ready' &&
      players.length >= MIN_PLAYERS &&
      roleSplit(this.settings.preset, players.length) !== null &&
      (this.game?.phase === 'over' || players.every((seat) => seat.ready))
    )
  }

  start() {
    if (!this.library || !this.canStart() || (this.game && this.game.phase !== 'over')) return
    this.pruneOffline()
    const roles = assignRoles(this.settings.preset, this.seats.length)
    const words = selectPair(this.library, this.settings, this.used)
    if (!roles || !words) return
    this.used.add(pairKey(words))
    // Pembuka putaran pertama dipilih acak, tapi bukan Si Asbun.
    const openers = roles.flatMap((role, i) => (role === 'asbun' ? [] : [i]))
    const starter = openers[Math.floor(Math.random() * openers.length)]
    this.generation++
    this.clearTimers()
    this.game = newGame(
      this.seats.map((seat) => seat.name),
      roles,
      words,
      this.settings,
      starter,
    )
    this.update()
  }

  toLobby() {
    if (!this.game || this.game.phase !== 'over') return
    this.generation++
    this.clearTimers()
    this.game = null
    this.pruneOffline()
    this.seats.forEach((seat, i) => (seat.ready = i === 0))
    this.settings = cleanSettings(this.settings, {}, this.seats.length, this.library)
    this.update()
  }

  skipDiscussion() {
    if (this.game?.phase === 'discussion') this.apply({ type: 'startVoting' })
  }

  private clearTimers() {
    clearTimeout(this.deadlineTimer)
    this.deadline = null
    this.timerKey = ''
  }

  /** Memasang pewaktu sekali per langkah (`key`); `ms` null = tanpa batas waktu yang terlihat. */
  private arm(key: string, ms: number, run: () => void, visible = true) {
    if (key === this.timerKey) return
    this.timerKey = key
    clearTimeout(this.deadlineTimer)
    this.deadline = visible ? Date.now() + ms : null
    const generation = this.generation
    this.deadlineTimer = setTimeout(() => {
      if (generation === this.generation) run()
    }, ms)
  }

  /**
   * Langkah otomatis host setelah state atau koneksi berubah: lanjut lebih cepat kalau semua
   * pemain yang tersambung sudah bertindak, dan pasang pewaktu untuk langkah yang sedang ditunggu.
   */
  private advance() {
    const game = this.game
    if (!game) {
      this.clearTimers()
      return
    }
    const waiting = activeSeats(game).filter((seat) => this.connected(seat))
    switch (game.phase) {
      case 'reveal':
        if (waiting.every((seat) => game.players[seat].acknowledged)) return this.apply({ type: 'beginClues' })
        return this.arm('reveal', REVEAL_SECONDS * 1000, () => this.apply({ type: 'beginClues' }))
      case 'clue': {
        const speaker = game.order[game.turn]
        const seconds = this.connected(speaker) ? game.settings.clueSeconds : OFFLINE_SECONDS
        return this.arm(`clue-${game.round}-${game.turn}`, seconds * 1000, () => this.apply({ type: 'clueTimeout' }))
      }
      case 'discussion':
        return this.arm(`talk-${game.round}`, game.settings.discussionSeconds * 1000, () => this.apply({ type: 'startVoting' }))
      case 'voting': {
        const voted = viewFor(game, 0).voted
        if (waiting.length && waiting.every((seat) => voted[seat])) return this.apply({ type: 'closeVoting' })
        return this.arm(`vote-${game.round}`, game.settings.votingSeconds * 1000, () => this.apply({ type: 'closeVoting' }))
      }
      case 'elimination':
        return this.arm(`out-${game.round}`, ELIMINATION_MS, () => this.apply({ type: 'proceed' }), false)
      case 'guess': {
        if (guessResolved(game)) return this.arm(`guessed-${game.round}`, GUESS_RESULT_MS, () => this.apply({ type: 'proceed' }), false)
        const seconds = game.eliminated !== null && this.connected(game.eliminated) ? GUESS_SECONDS : OFFLINE_SECONDS
        return this.arm(`guess-${game.round}`, seconds * 1000, () => this.apply({ type: 'guessTimeout' }))
      }
      case 'over':
        clearTimeout(this.deadlineTimer)
        this.deadline = null
        this.timerKey = 'over'
    }
  }

  private update() {
    this.advance()
    this.publish()
  }

  private publish() {
    const lobby: AsbunLobby = {
      players: this.seats.map((seat, i) => ({ name: seat.name, connected: this.connected(i), ready: seat.ready, wins: seat.wins })),
      settings: this.settings,
      categories: this.library?.categories ?? [],
      library: this.libraryStatus,
    }
    const timeLeft = this.deadline === null ? null : Math.max(0, this.deadline - Date.now())
    this.seats.forEach((seat, i) => {
      if (i === 0 || !seat.conn?.open) return
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
  const key = `asbun-token:${code}`
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
  private snapshot: AsbunRoomSnapshot

  constructor(
    code: string,
    name: string,
    private onChange: (snapshot: AsbunRoomSnapshot) => void,
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

  private update(patch: Partial<AsbunRoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.onChange(this.snapshot)
  }

  private fail(error: RoomError) {
    if (this.snapshot.status !== 'error') this.update({ status: 'error', error })
  }

  send(message: GuestMessage) {
    if (this.conn?.open) this.conn.send(message)
  }

  destroy() {
    clearTimeout(this.connectTimer)
    this.onChange = () => {}
    this.peer.destroy()
  }
}

export function useAsbunHostRoom(name: string): AsbunRoom {
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
    setReady: () => {},
    configure: (patch) => roomRef.current?.configure(patch),
    start: () => roomRef.current?.start(),
    skipDiscussion: () => roomRef.current?.skipDiscussion(),
    toLobby: () => roomRef.current?.toLobby(),
    retry: () => {},
  }
}

export function useAsbunGuestRoom(code: string, name: string): AsbunRoom {
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
    send: (action) => roomRef.current?.send({ type: 'action', action }),
    setReady: (ready) => roomRef.current?.send({ type: 'ready', ready }),
    configure: () => {},
    start: () => {},
    skipDiscussion: () => {},
    toLobby: () => {},
    retry: () => setAttempt((n) => n + 1),
  }
}
