import Peer, { type DataConnection } from 'peerjs'
import { useEffect, useRef, useState } from 'react'
import { initialState, reducer, type Action, type GameState } from '../game/state'
import {
  isAllowed,
  peerId,
  randomCode,
  settle,
  viewFor,
  type GuestMessage,
  type HostMessage,
  type LobbyInfo,
} from './online'

export interface RoomSnapshot {
  status: 'connecting' | 'ready' | 'error'
  error: string | null
  code: string
  lobby: LobbyInfo
  /** Kursi perangkat ini. */
  seat: number
  /** State permainan yang sudah disaring untuk kursi ini; null selama masih di lobi. */
  view: GameState | null
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

function emptySnapshot(code: string, capacity: number): RoomSnapshot {
  return {
    status: 'connecting',
    error: null,
    code,
    lobby: { capacity, players: [] },
    seat: 0,
    view: null,
  }
}

/**
 * Host memegang state asli permainan: mengocok, memvalidasi aksi tiap kursi, lalu
 * mengirim ke setiap pemain versi state yang hanya memuat tangannya sendiri.
 */
class HostRoom {
  private peer: Peer
  private seats: { name: string; token: string; conn: DataConnection | null }[]
  private game: GameState | null = null
  private status: RoomSnapshot['status'] = 'connecting'
  private error: string | null = null

  constructor(
    private code: string,
    hostName: string,
    private capacity: number,
    private onChange: (snapshot: RoomSnapshot) => void,
  ) {
    this.seats = [{ name: hostName, token: '', conn: null }]
    this.peer = new Peer(peerId(code))
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
      this.error =
        err.type === 'unavailable-id'
          ? 'Kode room sudah dipakai. Coba buat room lagi.'
          : `Gagal membuat room (${err.type}). Periksa koneksi internet.`
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
    } else if (!token || this.game || this.seats.length >= this.capacity) {
      const reason = this.game ? 'Permainan di room ini sudah dimulai.' : 'Room sudah penuh.'
      conn.send({ type: 'rejected', reason } satisfies HostMessage)
      return
    } else {
      const name = String(message.name ?? '').trim().slice(0, NAME_MAX)
      this.seats.push({ name: name || `Pemain ${this.seats.length + 1}`, token, conn })
    }
    this.publish()
  }

  private drop(conn: DataConnection) {
    const index = this.seats.findIndex((seat) => seat.conn === conn)
    if (index < 1) return
    // Di lobi kursinya dilepas; saat permainan berjalan kursinya ditahan untuk sambung ulang.
    if (this.game) this.seats[index].conn = null
    else this.seats.splice(index, 1)
    this.publish()
  }

  act(seat: number, action: Action) {
    if (!this.game || seat < 0 || !action || typeof action !== 'object') return
    if (!isAllowed(this.game, seat, action)) return
    this.game = settle(reducer(this.game, action))
    this.publish()
  }

  start() {
    if (this.seats.length !== this.capacity) return
    if (this.game && this.game.phase !== 'over') return
    const names = this.seats.map((seat) => seat.name)
    this.game = settle(reducer(initialState, { type: 'start', names }))
    this.publish()
  }

  private publish() {
    const lobby: LobbyInfo = {
      capacity: this.capacity,
      players: this.seats.map((seat, i) => ({
        name: seat.name,
        connected: i === 0 || Boolean(seat.conn?.open),
      })),
    }
    this.seats.forEach((seat, i) => {
      if (!seat.conn?.open) return
      const view = this.game ? viewFor(this.game, i) : null
      seat.conn.send({ type: 'sync', lobby, seat: i, view } satisfies HostMessage)
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
  private snapshot: RoomSnapshot

  constructor(
    code: string,
    name: string,
    private onChange: (snapshot: RoomSnapshot) => void,
  ) {
    this.snapshot = emptySnapshot(code, 0)
    this.peer = new Peer()
    this.peer.on('open', () => {
      const conn = this.peer.connect(peerId(code), { reliable: true, serialization: 'json' })
      this.conn = conn
      conn.on('open', () => {
        conn.send({ type: 'join', name, token: guestToken(code) } satisfies GuestMessage)
      })
      conn.on('data', (raw) => {
        const message = raw as HostMessage
        if (message.type === 'rejected') this.fail(message.reason)
        else if (message.type === 'sync') {
          const { lobby, seat, view } = message
          this.update({ status: 'ready', error: null, lobby, seat, view })
        }
      })
      conn.on('close', () => this.fail('Koneksi ke host terputus.'))
    })
    this.peer.on('error', (err) => {
      this.fail(
        err.type === 'peer-unavailable'
          ? 'Room tidak ditemukan. Periksa kodenya dan pastikan host masih membuka room.'
          : `Gagal terhubung (${err.type}). Periksa koneksi internet.`,
      )
    })
    this.update({})
  }

  private update(patch: Partial<RoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    this.onChange(this.snapshot)
  }

  private fail(error: string) {
    // Kesalahan pertama yang paling informatif; penutupan koneksi sesudahnya diabaikan.
    if (this.snapshot.status !== 'error') this.update({ status: 'error', error })
  }

  send(action: Action) {
    if (this.conn?.open) this.conn.send({ type: 'action', action } satisfies GuestMessage)
  }

  destroy() {
    this.onChange = () => {}
    this.peer.destroy()
  }
}

export function useHostRoom(name: string, capacity: number): Room {
  const [snapshot, setSnapshot] = useState(() => emptySnapshot('', capacity))
  const roomRef = useRef<HostRoom | null>(null)

  useEffect(() => {
    // Kode dibuat di sini (bukan saat render) supaya tiap pemasangan efek memakai ID baru;
    // server PeerJS tidak langsung melepas ID lama.
    const room = new HostRoom(randomCode(), name, capacity, setSnapshot)
    roomRef.current = room
    return () => room.destroy()
  }, [name, capacity])

  return {
    ...snapshot,
    isHost: true,
    send: (action) => roomRef.current?.act(0, action),
    start: () => roomRef.current?.start(),
    retry: () => {},
  }
}

export function useGuestRoom(code: string, name: string): Room {
  const [snapshot, setSnapshot] = useState(() => emptySnapshot(code, 0))
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
