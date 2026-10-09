import type { Action, GameState } from '../game/state'
import { timeoutAction } from '../game/timer'
import type { Tile } from '../game/tiles'

export interface LobbyInfo {
  capacity: number
  /** Batas waktu per aksi (detik), ditentukan host saat membuat room. */
  turnSeconds: number
  players: { name: string; connected: boolean }[]
}

/**
 * Pesan dari host ke tamu. `timeLeft` adalah sisa waktu aksi yang sedang ditunggu (ms), atau
 * null kalau tidak ada; dikirim sebagai sisa, bukan jam, karena jam tiap perangkat bisa berbeda.
 */
export type HostMessage =
  | { type: 'sync'; lobby: LobbyInfo; seat: number; view: GameState | null; timeLeft: number | null }
  | { type: 'rejected'; reason: string }

/** Pesan dari tamu ke host. `token` dipakai untuk kembali ke kursi yang sama setelah putus. */
export type GuestMessage =
  | { type: 'join'; name: string; token: string }
  | { type: 'action'; action: Action }

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 5

export function randomCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ).join('')
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)
}

/** ID di server PeerJS publik dipakai bersama aplikasi lain, jadi diberi awalan. */
export function peerId(code: string): string {
  return `mahjong-claude-room-${code}`
}

/** Pemain yang aksinya sedang ditunggu, atau null kalau permainan tidak berjalan. */
export function awaitedSeat(state: GameState): number | null {
  if (state.phase === 'claim') return state.claims[0]?.player ?? null
  if (state.phase === 'handoff' || state.phase === 'turn') return state.current
  return null
}

/**
 * Aksi pengganti untuk pemain yang terputus: gilirannya dilewati tanpa mengambil ubin,
 * klaimnya dilewatkan, dan kalau ia terputus setelah mengambil, ubin ambilannya dibuang.
 */
export function absentAction(state: GameState): Action {
  return timeoutAction(state) ?? { type: 'skip' }
}

/** Aksi yang boleh dikirim pemain di kursi `seat` pada keadaan sekarang. */
export function isAllowed(state: GameState, seat: number, action: Action): boolean {
  switch (action.type) {
    case 'discard':
    case 'kong':
    case 'declareWin':
      return state.phase === 'turn' && state.current === seat
    case 'claim':
    case 'pass':
      return state.phase === 'claim' && state.claims[0]?.player === seat
    default:
      // start/reset/reveal/skip hanya dijalankan host sendiri.
      return false
  }
}

function hideTiles(tiles: Tile[], salt: number): Tile[] {
  return tiles.map((_, i) => ({ id: -(salt * 1000 + i + 1), suit: 'man', rank: 0 }))
}

/**
 * State yang dikirim ke pemain di kursi `seat`: tangan lawan dan dinding diganti ubin kosong
 * (jumlahnya tetap), supaya isinya tidak pernah sampai ke perangkat pemain lain.
 */
export function viewFor(state: GameState, seat: number): GameState {
  const wall = hideTiles(state.wall, 0)
  if (state.phase === 'over') return { ...state, wall }

  const claim = state.claims[0]
  const isMyTurn = state.current === seat
  return {
    ...state,
    wall,
    players: state.players.map((player, i) =>
      i === seat ? player : { ...player, hand: hideTiles(player.hand, i + 1) },
    ),
    drawnId: isMyTurn ? state.drawnId : null,
    flowersDrawn: isMyTurn ? state.flowersDrawn : 0,
    // Pemain lain hanya perlu tahu siapa yang ditunggu; isi klaimnya membocorkan tangan pengklaim.
    claims: !claim || claim.player === seat ? state.claims.slice(0, 1) : [{ player: claim.player, type: 'chi', options: [] }],
  }
}
