import { normalizeWord } from './words'

export const LIVES = 2
/** Panjang maksimal kata yang diketik. */
export const WORD_MAX = 32

/** Seberapa dekat bom dengan ledakan; dipakai untuk kecepatan kedip, tanpa memperlihatkan angka. */
export type Heat = 0 | 1 | 2 | 3

export interface Player {
  name: string
  /** 0 berarti sudah gugur. */
  lives: number
}

export interface Feedback {
  by: number
  word: string
  ok: boolean
  /** Alasan ditolak: tidak termasuk kategori, sudah dipakai, atau kosong. */
  reason?: 'unknown' | 'used' | 'empty'
  /** Naik tiap kiriman, supaya kiriman salah yang sama dua kali tetap dikenali sebagai kiriman baru. */
  seq: number
}

/**
 * - `ready`: kategori baru sedang diundi dan ditampilkan; bom belum berdetak.
 * - `play`: bom berdetak; pemain `current` harus mengetik kata dari kategori.
 * - `boom`: bom baru meledak di tangan `exploded`; sebentar lagi ronde baru.
 * - `over`: tinggal satu pemain yang masih punya nyawa.
 */
export type Phase = 'ready' | 'play' | 'boom' | 'over'

export interface BomKataState {
  players: Player[]
  phase: Phase
  round: number
  category: { id: string; name: string } | null
  /** Semua jawaban sah kategori ini (sudah dinormalisasi). Hanya ada di host, tidak dikirim ke tamu. */
  answers: string[]
  /** Kata yang sudah dipakai di ronde ini, urut dari yang pertama. */
  used: string[]
  current: number
  /** Kata yang sedang diketik pemain `current`, terlihat oleh semua pemain. */
  typing: string
  heat: Heat
  feedback: Feedback | null
  exploded: number | null
  winner: number | null
  log: string[]
}

export type Action =
  // Dari pemain yang sedang memegang bom:
  | { type: 'type'; text: string }
  | { type: 'submit'; word: string }
  // Hanya dijalankan host:
  | { type: 'round'; category: { id: string; name: string }; answers: string[]; starter: number }
  | { type: 'go' }
  | { type: 'heat'; heat: Heat }
  | { type: 'explode' }

const LOG_SIZE = 6

function log(s: BomKataState, text: string) {
  s.log = [...s.log, text].slice(-LOG_SIZE)
}

export function newGame(names: string[]): BomKataState {
  return {
    players: names.map((name) => ({ name, lives: LIVES })),
    phase: 'ready',
    round: 0,
    category: null,
    answers: [],
    used: [],
    current: 0,
    typing: '',
    heat: 0,
    feedback: null,
    exploded: null,
    winner: null,
    log: [],
  }
}

export function aliveSeats(s: { players: Player[] }): number[] {
  return s.players.map((player, i) => (player.lives > 0 ? i : -1)).filter((i) => i >= 0)
}

/** Pemain hidup berikutnya searah jarum jam setelah `from` (bukan `from` sendiri kecuali tinggal ia). */
export function nextAlive(s: { players: Player[] }, from: number): number {
  const n = s.players.length
  for (let k = 1; k <= n; k++) {
    const seat = (from + k) % n
    if (s.players[seat].lives > 0) return seat
  }
  return from
}

export function reducer(state: BomKataState, action: Action): BomKataState {
  const s = structuredClone(state)
  switch (action.type) {
    case 'round': {
      if (s.phase === 'over' || s.players[action.starter]?.lives === 0) return state
      s.phase = 'ready'
      s.round++
      s.category = action.category
      s.answers = action.answers
      s.used = []
      s.current = action.starter
      s.typing = ''
      s.heat = 0
      s.feedback = null
      s.exploded = null
      log(s, `Ronde ${s.round}: kategori ${action.category.name}.`)
      return s
    }
    case 'go':
      if (s.phase !== 'ready' || !s.category) return state
      s.phase = 'play'
      return s
    case 'heat':
      if (s.phase !== 'play' || action.heat === s.heat) return state
      s.heat = action.heat
      return s
    case 'type':
      if (s.phase !== 'play') return state
      s.typing = String(action.text ?? '').slice(0, WORD_MAX)
      return s
    case 'submit': {
      if (s.phase !== 'play') return state
      const word = normalizeWord(String(action.word ?? '').slice(0, WORD_MAX))
      const by = s.current
      const seq = (state.feedback?.seq ?? 0) + 1
      if (!word) s.feedback = { by, word, ok: false, reason: 'empty', seq }
      else if (s.used.some((used) => normalizeWord(used) === word)) s.feedback = { by, word, ok: false, reason: 'used', seq }
      else if (!s.answers.includes(word)) s.feedback = { by, word, ok: false, reason: 'unknown', seq }
      else {
        s.used.push(word)
        s.feedback = { by, word, ok: true, seq }
        s.typing = ''
        s.current = nextAlive(s, by)
        log(s, `${s.players[by].name}: "${word}" ✓`)
      }
      return s
    }
    case 'explode': {
      if (s.phase !== 'play') return state
      const loser = s.current
      s.players[loser].lives = Math.max(0, s.players[loser].lives - 1)
      s.exploded = loser
      s.typing = ''
      log(
        s,
        s.players[loser].lives > 0
          ? `DUAR! Bom meledak di tangan ${s.players[loser].name}. Sisa nyawa: ${s.players[loser].lives}.`
          : `DUAR! ${s.players[loser].name} gugur.`,
      )
      const alive = aliveSeats(s)
      if (alive.length <= 1) {
        s.phase = 'over'
        s.winner = alive[0] ?? null
        if (s.winner !== null) log(s, `${s.players[s.winner].name} menang!`)
      } else s.phase = 'boom'
      return s
    }
    default:
      return state
  }
}
