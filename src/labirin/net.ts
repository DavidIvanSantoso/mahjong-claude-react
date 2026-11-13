import Peer, { type DataConnection } from 'peerjs'
import { useEffect, useRef, useState } from 'react'
import { CONNECT_TIMEOUT_MS, iceDetail, PEER_OPTIONS } from '../net/ice'
import { randomCode, type RoomError } from '../net/online'
import { generateMaze, isMazeSize, randomSeed, remaining, sizeFor, type Maze, type MazeSize } from './maze'
import { atExit, isDirs, spawnBody, step, STEP, type Body } from './sim'

/**
 * Room online LABIRIN (topologi bintang, host berwenang), memakai PeerJS dan `net/ice.ts` yang sama
 * dengan game lain.
 *
 * - Pesan lobi dan pertandingan (`sync`) dikirim saat berubah; posisi (`state`) ±20× per detik.
 * - Tamu hanya mengirim tombol arah per langkah simulasi (`input`), bukan posisi. Host menjalankan
 *   langkah-langkah itu dengan `sim.ts` yang sama, dibatasi waktu nyata supaya tidak bisa dipercepat.
 * - Tamu memprediksi geraknya sendiri lalu menyamakan dengan host (replay input yang belum diakui);
 *   pemain lain digambar dengan interpolasi ±120 ms di belakang.
 * - Waktu finis = jumlah langkah pemain itu sendiri (adil walau latensi berbeda). Finis pertama yang
 *   diterima host membuka jendela singkat untuk finis yang hampir bersamaan, lalu hasil dikunci.
 */

export const PROTOCOL = 1
export const MAX_PLAYERS = 8
export const MIN_PLAYERS = 2
const NAME_MAX = 16
/** Hitung mundur sebelum GO. */
const COUNTDOWN_MS = 3500
/** Jendela untuk finis yang hampir bersamaan sebelum pemenang dikunci. */
const FINISH_WINDOW_MS = 300
/** Kirim posisi ke tamu tiap sekian ms. */
const STATE_MS = 50
/** Kirim input tamu tiap sekian ms. */
const INPUT_MS = 50
/** Tamu boleh mendahului jam host sebanyak ini (langkah) karena perbedaan jam; lebih dari itu dibuang. */
const STEP_SLACK = 20
/** Penundaan gambar pemain lain (ms), supaya ada dua posisi untuk diinterpolasi. */
const INTERP_DELAY_MS = 120
const MAX_BATCH = 120
/**
 * Heartbeat: WebRTC bisa butuh ±30 detik untuk menyadari perangkat lain menutup tab. Host dan tamu
 * saling mengirim `ping` tiap PING_MS; tamu yang diam lebih dari GUEST_TIMEOUT_MS ditandai terputus,
 * host yang diam lebih dari HOST_TIMEOUT_MS dianggap hilang.
 */
const PING_MS = 2000
const GUEST_TIMEOUT_MS = 6000
const HOST_TIMEOUT_MS = 8000

export interface LobbyPlayer {
  name: string
  connected: boolean
  ready: boolean
  wins: number
}

export interface LobbyInfo {
  players: LobbyPlayer[]
  size: MazeSize
}

export interface MatchResult {
  /** Urutan akhir (indeks pembalap). */
  order: number[]
  /** Waktu finis (ms) per pembalap; null = belum sampai. */
  times: (number | null)[]
  /** Sisa jarak (ubin) ke pintu keluar per pembalap saat pertandingan berakhir. */
  left: number[]
  winner: number
  /** Lama pertandingan (ms) sampai pemenang dikunci. */
  endMs: number
}

export interface MatchInfo {
  id: number
  seed: number
  size: MazeSize
  checksum: number
  /** Pembalap (indeks = nomor pembalap = spawn); `seat` = kursi di lobi. */
  roster: { seat: number; name: string }[]
  phase: 'countdown' | 'race' | 'over'
  /** Sisa hitung mundur (ms) saat pesan dikirim. */
  countdownLeft: number
  /** Waktu sejak GO (ms) saat pesan dikirim. */
  elapsed: number
  result: MatchResult | null
}

export type HostMessage =
  | { v: number; type: 'sync'; seat: number; lobby: LobbyInfo; match: MatchInfo | null }
  | { v: number; type: 'state'; id: number; pos: number[]; ack: number; done: number[] }
  | { v: number; type: 'rejected'; reason: 'started' | 'full' | 'version' }
  | { v: number; type: 'ping' }

export type GuestMessage =
  | { v: number; type: 'join'; name: string; token: string }
  | { v: number; type: 'ready'; ready: boolean }
  | { v: number; type: 'input'; id: number; seq: number; dirs: number[] }
  | { v: number; type: 'ping' }

export type LabirinError = RoomError | { code: 'version' | 'desync' }

/** Posisi dikirim sebagai bilangan bulat (×1000) supaya pesannya ringkas. */
const pack = (bodies: Body[]) => bodies.flatMap((b) => [Math.round(b.x * 1000), Math.round(b.y * 1000)])
const unpack = (pos: number[], index: number): Body => ({ x: pos[index * 2] / 1000, y: pos[index * 2 + 1] / 1000 })

/** Penyangga posisi untuk interpolasi pemain lain. */
class Interpolator {
  private snaps: { t: number; pos: number[] }[] = []
  push(t: number, pos: number[]) {
    this.snaps.push({ t, pos })
    if (this.snaps.length > 40) this.snaps.shift()
  }
  sample(t: number, racer: number): Body | null {
    const snaps = this.snaps
    if (!snaps.length) return null
    const at = t - INTERP_DELAY_MS
    let i = snaps.length - 1
    while (i > 0 && snaps[i - 1].t > at) i--
    const b = snaps[i]
    const a = snaps[i - 1]
    if (!a || at >= b.t) return unpack(b.pos, racer)
    const k = Math.max(0, Math.min(1, (at - a.t) / Math.max(1, b.t - a.t)))
    const pa = unpack(a.pos, racer)
    const pb = unpack(b.pos, racer)
    return { x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k }
  }
  clear() {
    this.snaps = []
  }
}

// ---------- Snapshot untuk React ----------

export interface RoomSnapshot {
  status: 'connecting' | 'ready' | 'error'
  error: LabirinError | null
  code: string
  lobby: LobbyInfo
  /** Kursi lobi perangkat ini. */
  seat: number
  match: MatchInfo | null
  /** Labirin pertandingan ini (dibuat sendiri dari seed). */
  maze: Maze | null
  /** Pembalap perangkat ini dalam pertandingan (null = tidak ikut). */
  racer: number | null
  /** Kapan GO menurut jam perangkat ini (performance.now). */
  goAt: number | null
}

export interface LabirinRoom extends RoomSnapshot {
  isHost: boolean
  /** Posisi semua pembalap untuk digambar sekarang; `dirs` = tombol arah lokal. */
  sample: (now: number, dirs: number) => Map<number, Body>
  setReady: (ready: boolean) => void
  configure: (size: MazeSize) => void
  canStart: boolean
  start: () => void
  toLobby: () => void
  retry: () => void
}

const EMPTY_LOBBY: LobbyInfo = { players: [], size: 'sedang' }

function emptySnapshot(code: string): RoomSnapshot {
  return { status: 'connecting', error: null, code, lobby: EMPTY_LOBBY, seat: 0, match: null, maze: null, racer: null, goAt: null }
}

function peerId(code: string): string {
  return `labirin-claude-room-${code}`
}

// ---------- Host ----------

interface HostMatch {
  info: MatchInfo
  maze: Maze
  bodies: Body[]
  /** Langkah berikutnya yang ditunggu dari tiap pembalap (= jumlah langkah yang sudah dijalankan). */
  next: number[]
  /** Langkah saat sampai di pintu keluar. */
  finish: (number | null)[]
  goAt: number
  closeAt: number | null
  interp: Interpolator
}

class HostRoom {
  private peer: Peer
  private seats: { name: string; token: string; conn: DataConnection | null; ready: boolean; wins: number; seen: number }[]
  private size: MazeSize = 'sedang'
  private lastPing = 0
  /** Status tersambung yang terakhir diumumkan, supaya perubahan karena heartbeat ikut dikirim. */
  private announced = ''
  private match: HostMatch | null = null
  private matchId = 0
  private hostDirs = 0
  private loop: ReturnType<typeof setInterval> | undefined
  private lastState = 0
  private status: RoomSnapshot['status'] = 'connecting'
  private error: LabirinError | null = null

  constructor(
    private code: string,
    hostName: string,
    private onChange: (snapshot: RoomSnapshot) => void,
  ) {
    this.seats = [{ name: hostName, token: '', conn: null, ready: true, wins: 0, seen: 0 }]
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
    this.loop = setInterval(() => this.tick(), 1000 / 60)
    this.publish()
  }

  private accept(conn: DataConnection) {
    conn.on('data', (raw) => {
      const message = raw as GuestMessage
      if (!message || typeof message !== 'object') return
      if (message.v !== PROTOCOL) {
        if (message.type === 'join') conn.send({ v: PROTOCOL, type: 'rejected', reason: 'version' } satisfies HostMessage)
        return
      }
      const seat = this.seats.findIndex((s) => s.conn === conn)
      if (seat > 0) this.seats[seat].seen = performance.now()
      if (message.type === 'join') this.join(conn, message)
      else if (message.type === 'ready') this.markReady(seat, message.ready === true)
      else if (message.type === 'input') this.input(seat, message)
    })
    conn.on('close', () => this.drop(conn))
    conn.on('error', () => this.drop(conn))
  }

  private join(conn: DataConnection, message: { name: unknown; token: unknown }) {
    const token = typeof message.token === 'string' ? message.token.slice(0, 64) : ''
    const returning = token ? this.seats.findIndex((seat, i) => i > 0 && seat.token === token) : -1
    if (returning > 0) {
      this.seats[returning].conn = conn
      this.seats[returning].seen = performance.now()
    } else if (!token || (this.match && this.match.info.phase !== 'over') || this.seats.length >= MAX_PLAYERS) {
      const reason = this.match && this.match.info.phase !== 'over' ? 'started' : 'full'
      conn.send({ v: PROTOCOL, type: 'rejected', reason } satisfies HostMessage)
      return
    } else {
      const name = String(message.name ?? '').trim().slice(0, NAME_MAX)
      this.seats.push({ name: name || `Pemain ${this.seats.length + 1}`, token, conn, ready: false, wins: 0, seen: performance.now() })
    }
    this.publish()
  }

  private drop(conn: DataConnection) {
    const index = this.seats.findIndex((seat) => seat.conn === conn)
    if (index < 1) return
    // Di lobi kursinya dilepas; selama pertandingan ditahan untuk sambung ulang.
    if (this.match) this.seats[index].conn = null
    else this.seats.splice(index, 1)
    this.publish()
  }

  private connected(seat: number): boolean {
    const entry = this.seats[seat]
    return seat === 0 || (Boolean(entry?.conn?.open) && performance.now() - entry.seen < GUEST_TIMEOUT_MS)
  }

  /** Kursi yang tidak tersambung dilepas (koneksinya ditutup supaya tamu tahu dan bisa masuk ulang). */
  private pruneOffline() {
    this.seats = this.seats.filter((seat, i) => {
      if (this.connected(i)) return true
      seat.conn?.close()
      return false
    })
  }

  private markReady(seat: number, ready: boolean) {
    if (seat < 1 || (this.match && this.match.info.phase !== 'over')) return
    this.seats[seat].ready = ready
    this.publish()
  }

  configure(size: MazeSize) {
    if ((this.match && this.match.info.phase !== 'over') || !isMazeSize(size)) return
    this.size = size
    this.publish()
  }

  canStart(): boolean {
    if (this.match && this.match.info.phase !== 'over') return false
    const present = this.seats.filter((_, i) => this.connected(i))
    // Setelah pertandingan, "Main lagi" tidak perlu menunggu tombol Siap.
    return present.length >= MIN_PLAYERS && (this.match !== null || present.every((seat) => seat.ready))
  }

  start() {
    if (!this.canStart()) return
    this.pruneOffline()
    const roster = this.seats.map((seat, i) => ({ seat: i, name: seat.name }))
    const size = sizeFor(this.size, roster.length)
    const seed = randomSeed()
    const maze = generateMaze(seed, size, roster.length)
    const goAt = performance.now() + COUNTDOWN_MS
    this.match = {
      info: { id: ++this.matchId, seed, size, checksum: maze.checksum, roster, phase: 'countdown', countdownLeft: COUNTDOWN_MS, elapsed: 0, result: null },
      maze,
      bodies: roster.map((_, racer) => spawnBody(maze, racer)),
      next: roster.map(() => 0),
      finish: roster.map(() => null),
      goAt,
      closeAt: null,
      interp: new Interpolator(),
    }
    this.publish()
  }

  toLobby() {
    if (!this.match || this.match.info.phase !== 'over') return
    this.match = null
    this.pruneOffline()
    this.seats.forEach((seat, i) => (seat.ready = i === 0))
    this.publish()
  }

  private racerOf(seat: number): number {
    return this.match ? this.match.info.roster.findIndex((entry) => entry.seat === seat) : -1
  }

  /** Langkah-langkah input dari pembalap: dijalankan berurutan, dibatasi jam host. */
  private run(racer: number, seq: number, dirs: number[], now: number) {
    const match = this.match
    if (!match || match.info.phase === 'over' || now < match.goAt) return
    const limit = Math.floor((now - match.goAt) / (STEP * 1000)) + STEP_SLACK
    // Langkah yang terlewat (mis. setelah terputus) dianggap diam; yang sudah dijalankan diabaikan.
    let at = seq
    for (const d of dirs) {
      if (at >= match.next[racer] && at < limit && match.finish[racer] === null) {
        if (!isDirs(d)) return
        step(match.maze, match.bodies[racer], d)
        match.next[racer] = at + 1
        if (atExit(match.maze, match.bodies[racer])) {
          match.finish[racer] = at + 1
          match.closeAt ??= now + FINISH_WINDOW_MS
        }
      }
      at++
    }
  }

  private input(seat: number, message: { id: unknown; seq: unknown; dirs: unknown }) {
    const racer = this.racerOf(seat)
    if (racer < 0 || !this.match || message.id !== this.match.info.id) return
    if (typeof message.seq !== 'number' || !Number.isInteger(message.seq) || message.seq < 0) return
    if (!Array.isArray(message.dirs) || message.dirs.length > MAX_BATCH) return
    this.run(racer, message.seq, message.dirs as number[], performance.now())
  }

  /** Host: posisi semua pembalap; pembalap host dijalankan langsung dengan tombolnya. */
  sample(now: number, dirs: number): Map<number, Body> {
    this.hostDirs = dirs
    const match = this.match
    const out = new Map<number, Body>()
    if (!match) return out
    this.advanceHost(now)
    const hostRacer = this.racerOf(0)
    match.info.roster.forEach((_, racer) => {
      if (racer === hostRacer || match.info.phase === 'over') out.set(racer, { ...match.bodies[racer] })
      else out.set(racer, match.interp.sample(now, racer) ?? { ...match.bodies[racer] })
    })
    return out
  }

  /** Langkah pembalap host sampai waktu sekarang. */
  private advanceHost(now: number) {
    const match = this.match
    const racer = this.racerOf(0)
    if (!match || racer < 0 || now < match.goAt) return
    const due = Math.floor((now - match.goAt) / (STEP * 1000))
    const count = Math.min(due - match.next[racer], 30)
    if (count > 0) this.run(racer, match.next[racer], Array(count).fill(this.hostDirs), now)
  }

  /** Heartbeat: kirim ping, dan umumkan perubahan status tersambung yang hanya terlihat dari heartbeat. */
  private heartbeat(now: number) {
    if (now - this.lastPing < 1000) return
    this.lastPing = now
    const status = this.seats.map((_, i) => (this.connected(i) ? 1 : 0)).join('')
    if (status !== this.announced) this.publish()
    // Saat balapan, pesan posisi (20× per detik) sudah menjadi tanda host masih ada.
    if (this.match?.info.phase === 'race') return
    for (const seat of this.seats) if (seat.conn?.open) seat.conn.send({ v: PROTOCOL, type: 'ping' } satisfies HostMessage)
  }

  private tick() {
    const now = performance.now()
    this.heartbeat(now)
    const match = this.match
    if (!match) return
    this.advanceHost(now)
    if (match.info.phase === 'countdown' && now >= match.goAt) {
      match.info.phase = 'race'
      this.publish()
    }
    if (match.info.phase === 'race' && match.closeAt !== null && now >= match.closeAt) this.finishMatch(now)
    if (match.info.phase === 'race' && now - this.lastState >= STATE_MS) {
      this.lastState = now
      this.broadcastState(now)
    }
  }

  private finishMatch(now: number) {
    const match = this.match!
    const racers = match.info.roster.map((_, racer) => racer)
    const left = racers.map((racer) => (match.finish[racer] !== null ? 0 : remaining(match.maze, match.bodies[racer].x, match.bodies[racer].y)))
    const order = [...racers].sort((a, b) => {
      const fa = match.finish[a]
      const fb = match.finish[b]
      if (fa !== null || fb !== null) return (fa ?? Infinity) - (fb ?? Infinity)
      return left[a] - left[b]
    })
    const times = racers.map((racer) => (match.finish[racer] === null ? null : Math.round(match.finish[racer]! * STEP * 1000)))
    const winner = order[0]
    match.info.phase = 'over'
    match.info.result = { order, times, left, winner, endMs: Math.round(now - match.goAt) }
    this.seats[match.info.roster[winner].seat].wins++
    this.broadcastState(now)
    this.publish()
  }

  private broadcastState(now: number) {
    const match = this.match
    if (!match || match.info.phase === 'countdown') return
    const pos = pack(match.bodies)
    match.interp.push(now, pos)
    const done = match.finish.flatMap((step, racer) => (step === null ? [] : [racer]))
    this.seats.forEach((seat, i) => {
      if (i === 0 || !seat.conn?.open) return
      const racer = this.racerOf(i)
      const ack = racer < 0 ? -1 : match.next[racer] - 1
      seat.conn.send({ v: PROTOCOL, type: 'state', id: match.info.id, pos, ack, done } satisfies HostMessage)
    })
  }

  private publish() {
    const lobby: LobbyInfo = {
      players: this.seats.map((seat, i) => ({ name: seat.name, connected: this.connected(i), ready: seat.ready, wins: seat.wins })),
      size: this.size,
    }
    this.announced = lobby.players.map((player) => (player.connected ? 1 : 0)).join('')
    const now = performance.now()
    const match = this.match
    const info = match ? { ...match.info, countdownLeft: Math.max(0, match.goAt - now), elapsed: Math.max(0, now - match.goAt) } : null
    this.seats.forEach((seat, i) => {
      if (i === 0 || !seat.conn?.open) return
      seat.conn.send({ v: PROTOCOL, type: 'sync', seat: i, lobby, match: info } satisfies HostMessage)
    })
    const racer = this.racerOf(0)
    this.onChange({
      status: this.status,
      error: this.error,
      code: this.code,
      lobby,
      seat: 0,
      match: info,
      maze: match?.maze ?? null,
      racer: racer < 0 ? null : racer,
      goAt: match?.goAt ?? null,
    })
  }

  destroy() {
    clearInterval(this.loop)
    this.onChange = () => {}
    this.peer.destroy()
  }
}

// ---------- Tamu ----------

/** Token acak per room, disimpan per tab supaya refresh bisa kembali ke kursi yang sama. */
function guestToken(code: string): string {
  const key = `labirin-token:${code}`
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

interface GuestMatch {
  id: number
  maze: Maze
  racer: number
  goAt: number
  /** Posisi hasil prediksi. */
  body: Body
  /** Langkah berikutnya yang akan disimulasikan. */
  next: number
  /** Input yang sudah dijalankan tapi belum diakui host (seq → dirs). */
  pending: Map<number, number>
  /** Input yang belum terkirim. */
  unsent: number[]
  unsentFrom: number
  lastSend: number
  /** Selisih tampilan setelah koreksi dari host, dihilangkan perlahan supaya tidak melompat. */
  offset: Body
  lastFrame: number
  interp: Interpolator
  done: number[]
  over: boolean
}

class GuestRoom {
  private peer: Peer
  private conn: DataConnection | null = null
  private connectTimer: ReturnType<typeof setTimeout> | undefined
  private snapshot: RoomSnapshot
  private match: GuestMatch | null = null
  private heard = performance.now()
  private sent = 0
  private pulse: ReturnType<typeof setInterval> | undefined

  constructor(
    code: string,
    name: string,
    private onChange: (snapshot: RoomSnapshot) => void,
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
        this.heard = performance.now()
        this.send({ v: PROTOCOL, type: 'join', name, token: guestToken(code) })
        this.pulse = setInterval(() => this.heartbeat(), 1000)
      })
      conn.on('data', (raw) => {
        this.heard = performance.now()
        this.receive(raw as HostMessage)
      })
      conn.on('close', () => this.fail({ code: 'host-lost' }))
    })
    this.peer.on('error', (err) => {
      this.fail(err.type === 'peer-unavailable' ? { code: 'not-found' } : { code: 'connect-failed', detail: err.type })
    })
    this.update({})
  }

  private receive(message: HostMessage) {
    if (!message || typeof message !== 'object') return
    if (message.v !== PROTOCOL) return this.fail({ code: 'version' })
    if (message.type === 'rejected') return this.fail(message.reason === 'version' ? { code: 'version' } : { code: message.reason })
    if (message.type === 'sync') return this.sync(message)
    if (message.type === 'state') this.state(message)
  }

  private sync(message: Extract<HostMessage, { type: 'sync' }>) {
    const info = message.match
    const now = performance.now()
    if (!info) this.match = null
    else if (this.match?.id !== info.id) {
      // Pertandingan baru (atau sambung ulang): buat labirin sendiri lalu cocokkan checksum.
      const maze = generateMaze(info.seed, info.size, info.roster.length)
      if (maze.checksum !== info.checksum) return this.fail({ code: 'desync' })
      const racer = info.roster.findIndex((entry) => entry.seat === message.seat)
      const goAt = info.phase === 'countdown' ? now + info.countdownLeft : now - info.elapsed
      this.match =
        racer < 0
          ? null
          : {
              id: info.id,
              maze,
              racer,
              goAt,
              body: spawnBody(maze, racer),
              next: Math.max(0, Math.floor((now - goAt) / (STEP * 1000))),
              pending: new Map(),
              unsent: [],
              unsentFrom: Math.max(0, Math.floor((now - goAt) / (STEP * 1000))),
              lastSend: now,
              offset: { x: 0, y: 0 },
              lastFrame: now,
              interp: new Interpolator(),
              done: [],
              over: false,
            }
      this.update({ maze, racer: racer < 0 ? null : racer, goAt })
    }
    if (this.match && info) this.match.over = info.phase === 'over'
    this.update({ status: 'ready', error: null, lobby: message.lobby, seat: message.seat, match: info })
    if (!info) this.update({ maze: null, racer: null, goAt: null })
  }

  /** Posisi dari host: simpan untuk interpolasi, lalu samakan prediksi diri sendiri. */
  private state(message: Extract<HostMessage, { type: 'state' }>) {
    const match = this.match
    if (!match || message.id !== match.id || !Array.isArray(message.pos)) return
    const now = performance.now()
    match.interp.push(now, message.pos)
    match.done = Array.isArray(message.done) ? message.done : []
    const ack = typeof message.ack === 'number' ? message.ack : -1
    for (const seq of [...match.pending.keys()]) if (seq <= ack) match.pending.delete(seq)
    const server = unpack(message.pos, match.racer)
    if (ack + 1 >= match.next) {
      // Host sudah sejauh prediksi (atau lebih): pakai posisi host.
      match.offset = { x: match.offset.x + match.body.x - server.x, y: match.offset.y + match.body.y - server.y }
      match.body = server
      match.next = Math.max(match.next, ack + 1)
      return
    }
    // Ulang input yang belum diakui di atas posisi host.
    const replay = { ...server }
    for (let seq = ack + 1; seq < match.next; seq++) {
      const dirs = match.pending.get(seq)
      if (dirs === undefined) continue
      if (!atExit(match.maze, replay)) step(match.maze, replay, dirs)
    }
    match.offset = { x: match.offset.x + match.body.x - replay.x, y: match.offset.y + match.body.y - replay.y }
    match.body = replay
  }

  sample(now: number, dirs: number): Map<number, Body> {
    const match = this.match
    const out = new Map<number, Body>()
    if (!match) return out
    if (!match.over && now >= match.goAt) {
      const due = Math.floor((now - match.goAt) / (STEP * 1000))
      // Tab yang sempat tidur tidak boleh "berlari" mengejar: langkah yang terlewat dianggap diam.
      if (due - match.next > 30) {
        match.next = due
        match.unsentFrom = due
        match.unsent = []
      }
      while (match.next < due) {
        const input = atExit(match.maze, match.body) ? 0 : dirs
        step(match.maze, match.body, input)
        match.pending.set(match.next, input)
        if (!match.unsent.length) match.unsentFrom = match.next
        match.unsent.push(input)
        match.next++
      }
      if (match.unsent.length && (now - match.lastSend >= INPUT_MS || match.unsent.length >= MAX_BATCH)) {
        this.send({ v: PROTOCOL, type: 'input', id: match.id, seq: match.unsentFrom, dirs: match.unsent })
        match.unsent = []
        match.lastSend = now
      }
    }
    // Koreksi dari host dihaluskan dalam ±100 ms.
    const dt = Math.min(0.1, (now - match.lastFrame) / 1000)
    match.lastFrame = now
    const decay = Math.exp(-dt * 14)
    match.offset = { x: match.offset.x * decay, y: match.offset.y * decay }
    const info = this.snapshot.match
    info?.roster.forEach((_, racer) => {
      if (racer === match.racer) out.set(racer, { x: match.body.x + match.offset.x, y: match.body.y + match.offset.y })
      else {
        const at = match.over ? match.interp.sample(now + INTERP_DELAY_MS, racer) : match.interp.sample(now, racer)
        out.set(racer, at ?? spawnBody(match.maze, racer))
      }
    })
    return out
  }

  private update(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.onChange(this.snapshot)
  }

  private heartbeat() {
    const now = performance.now()
    if (this.snapshot.status === 'ready' && now - this.heard > HOST_TIMEOUT_MS) return this.fail({ code: 'host-lost' })
    if (now - this.sent >= PING_MS) this.send({ v: PROTOCOL, type: 'ping' })
  }

  private fail(error: LabirinError) {
    if (this.snapshot.status !== 'error') this.update({ status: 'error', error })
    clearInterval(this.pulse)
    if (error.code === 'desync' || error.code === 'version' || error.code === 'host-lost') this.conn?.close()
  }

  send(message: GuestMessage) {
    if (!this.conn?.open) return
    this.conn.send(message)
    this.sent = performance.now()
  }

  destroy() {
    clearTimeout(this.connectTimer)
    clearInterval(this.pulse)
    this.onChange = () => {}
    this.peer.destroy()
  }
}

export function useLabirinHostRoom(name: string): LabirinRoom {
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(''))
  const roomRef = useRef<HostRoom | null>(null)
  useEffect(() => {
    const room = new HostRoom(randomCode(), name, setSnapshot)
    roomRef.current = room
    return () => room.destroy()
  }, [name])
  const present = snapshot.lobby.players.filter((player) => player.connected)
  const canStart = present.length >= MIN_PLAYERS && (snapshot.match !== null ? snapshot.match.phase === 'over' : present.every((player) => player.ready))
  return {
    ...snapshot,
    isHost: true,
    sample: (now, dirs) => roomRef.current?.sample(now, dirs) ?? new Map(),
    setReady: () => {},
    configure: (size) => roomRef.current?.configure(size),
    canStart,
    start: () => roomRef.current?.start(),
    toLobby: () => roomRef.current?.toLobby(),
    retry: () => {},
  }
}

export function useLabirinGuestRoom(code: string, name: string): LabirinRoom {
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(code))
  const [attempt, setAttempt] = useState(0)
  const roomRef = useRef<GuestRoom | null>(null)
  useEffect(() => {
    const room = new GuestRoom(code, name, setSnapshot)
    roomRef.current = room
    // Hanya saat pengembangan: tes browser memakai ini untuk mengirim pesan palsu ke host (uji anti-curang).
    if (import.meta.env.DEV) (window as unknown as { __labirinGuest?: unknown }).__labirinGuest = room
    return () => room.destroy()
  }, [code, name, attempt])
  return {
    ...snapshot,
    isHost: false,
    sample: (now, dirs) => roomRef.current?.sample(now, dirs) ?? new Map(),
    setReady: (ready) => roomRef.current?.send({ v: PROTOCOL, type: 'ready', ready }),
    configure: () => {},
    canStart: false,
    start: () => {},
    toLobby: () => {},
    retry: () => setAttempt((n) => n + 1),
  }
}
