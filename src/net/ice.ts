import type { DataConnection, PeerOptions } from 'peerjs'

/**
 * Server ICE untuk semua room (mahjong, UNO, Capsa).
 *
 * TURN bawaan PeerJS (eu-0/us-0.turn.peerjs.com) sudah tidak berfungsi, jadi tidak dipakai.
 * STUN cukup kalau kedua pemain bisa tersambung langsung. Jaringan yang menghalanginya (data
 * seluler/CGNAT, WiFi kantor atau kampus) butuh server TURN sebagai perantara; isi lewat variabel
 * lingkungan saat build (lihat documentation.md, "Server TURN"):
 * - VITE_TURN_URLS: satu atau beberapa URL dipisah koma, mis. "turn:host:80,turns:host:443?transport=tcp"
 * - VITE_TURN_USERNAME dan VITE_TURN_CREDENTIAL
 */
const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.relay.metered.ca:80' },
]

function turnServers(): RTCIceServer[] {
  const urls = String(import.meta.env.VITE_TURN_URLS ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean)
  if (urls.length === 0) return []
  return [
    {
      urls,
      username: String(import.meta.env.VITE_TURN_USERNAME ?? ''),
      credential: String(import.meta.env.VITE_TURN_CREDENTIAL ?? ''),
    },
  ]
}

export const PEER_OPTIONS: PeerOptions = {
  config: { iceServers: [...STUN_SERVERS, ...turnServers()] },
}

/** Tamu yang belum tersambung ke host setelah selama ini dianggap gagal, supaya tidak menunggu tanpa akhir. */
export const CONNECT_TIMEOUT_MS = 20_000

/**
 * Ringkasan keadaan WebRTC saat tamu gagal tersambung, ditampilkan sebagai "detail teknis":
 * status sinyal dan ICE, serta jenis kandidat alamat yang ditemukan di perangkat ini dan di host
 * (host = alamat lokal, srflx = alamat publik dari STUN, relay = lewat TURN).
 */
export async function iceDetail(conn: DataConnection | null): Promise<string> {
  const pc = conn?.peerConnection
  if (!pc) return 'koneksi WebRTC belum dibuat'
  const local = new Set<string>()
  const remote = new Set<string>()
  try {
    ;(await pc.getStats()).forEach((report) => {
      if (report.type === 'local-candidate') local.add(report.candidateType)
      if (report.type === 'remote-candidate') remote.add(report.candidateType)
    })
  } catch {
    // getStats bisa gagal kalau koneksinya sudah ditutup; status di bawah tetap berguna.
  }
  const list = (set: Set<string>) => [...set].join('/') || '-'
  return `sinyal ${pc.signalingState}, ICE ${pc.iceConnectionState}, kandidat kamu: ${list(local)}, kandidat host: ${list(remote)}`
}
