import type { Action, GameState } from './state'

/** Batas waktu per aksi (detik) kalau pembuat ruangan tidak mengisinya. */
export const DEFAULT_TURN_SECONDS = 15
export const MIN_TURN_SECONDS = 5
export const MAX_TURN_SECONDS = 300

/** Isi kolom "waktu per giliran": kosong atau tidak sah jadi nilai bawaan, sisanya dijepit ke batas. */
export function parseTurnSeconds(input: string): number {
  const value = Number.parseInt(input, 10)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TURN_SECONDS
  return Math.min(MAX_TURN_SECONDS, Math.max(MIN_TURN_SECONDS, value))
}

/**
 * Waktu hanya berjalan selama seorang pemain sedang melihat tangannya dan harus memutuskan:
 * saat gilirannya, atau saat ditawari klaim. Layar "berikan perangkat" tidak dihitung.
 */
export function isTimed(state: GameState): boolean {
  return state.phase === 'turn' || (state.phase === 'claim' && state.claimRevealed)
}

/**
 * Aksi otomatis saat waktu habis: ubin yang terakhir didapat dibuang (setelah pong/chi tidak ada
 * ubin ambilan, jadi ubin paling kanan di tangan), dan tawaran klaim dilewatkan.
 */
export function timeoutAction(state: GameState): Action | null {
  if (state.phase === 'claim') return { type: 'pass' }
  if (state.phase !== 'turn') return null
  const hand = state.players[state.current].hand
  const tile = hand.find((t) => t.id === state.drawnId) ?? hand[hand.length - 1]
  return tile ? { type: 'discard', tileId: tile.id } : null
}
