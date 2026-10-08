import { reducer, type Action, type GameState } from '../game/state'
import type { Tile } from '../game/tiles'

export interface LobbyInfo {
  capacity: number
  players: { name: string; connected: boolean }[]
}

/** Pesan dari host ke tamu. */
export type HostMessage =
  | { type: 'sync'; lobby: LobbyInfo; seat: number; view: GameState | null }
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

/**
 * Di mode online tiap pemain punya layar sendiri, jadi langkah "berikan perangkat"
 * (handoff dan klaim yang belum dibuka) langsung dilewati.
 */
export function settle(state: GameState): GameState {
  while (state.phase === 'handoff' || (state.phase === 'claim' && !state.claimRevealed)) {
    state = reducer(state, { type: 'reveal' })
  }
  return state
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
      // start/reset/reveal hanya dijalankan host sendiri.
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
