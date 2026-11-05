/**
 * Kamus pasangan kata ASBUN: file JSON statis di public/asbun/word-pairs.json, terpisah dari logika
 * permainan. Hanya host yang mengunduhnya; tamu hanya menerima kata miliknya sendiri.
 *
 * Format: { "version": 1, "locale": "id", "categories": [{ "id", "name" }],
 *           "pairs": [{ "category", "difficulty", "warga", "penyusup", "tags"? }] }
 */
export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  easy: 'Mudah',
  medium: 'Sedang',
  hard: 'Sulit',
}

export interface WordPair {
  category: string
  difficulty: Difficulty
  warga: string
  penyusup: string
  tags?: string[]
}

export interface PairLibrary {
  version: number
  locale: string
  categories: { id: string; name: string }[]
  pairs: WordPair[]
}

/** Pasangan yang dipakai satu permainan (kata Warga dan Penyusup sudah ditentukan). */
export interface RoundWords {
  category: string
  difficulty: Difficulty
  warga: string
  penyusup: string
}

export const ANY = 'semua'

export const CLUE_MAX = 30
export const GUESS_MAX = 40

export async function loadLibrary(): Promise<PairLibrary> {
  const response = await fetch(`${import.meta.env.BASE_URL}asbun/word-pairs.json`)
  if (!response.ok) throw new Error(`word-pairs.json: ${response.status}`)
  const data = (await response.json()) as PairLibrary
  return {
    ...data,
    pairs: data.pairs.filter(
      (pair) => pair && pair.warga && pair.penyusup && normalizeText(pair.warga) !== normalizeText(pair.penyusup),
    ),
  }
}

/**
 * Normalisasi untuk membandingkan kata: Unicode NFKD tanpa tanda diakritik, huruf kecil,
 * tanda hubung dianggap spasi, spasi berlebih dirapikan.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Bentuk rapat (tanpa spasi dan tanda baca), supaya "es krim" = "eskrim" = "Es-Krim". */
function compact(text: string): string {
  return normalizeText(text).replace(/[^a-z0-9]/g, '')
}

/** Tebakan Si Asbun benar kalau sama persis dengan kata Warga setelah normalisasi. Sinonim tidak diterima. */
export function sameWord(guess: string, word: string): boolean {
  const a = compact(guess)
  return a.length > 0 && a === compact(word)
}

/**
 * Alasan petunjuk ditolak, atau null kalau boleh. Petunjuk hanya dibandingkan dengan kata milik
 * pemain itu sendiri; membandingkan dengan kata Warga akan membocorkannya ke Penyusup.
 */
export function clueProblem(clue: string, ownWord: string | null): 'empty' | 'long' | 'word' | null {
  const text = clue.trim()
  if (!compact(text)) return 'empty'
  if (text.length > CLUE_MAX) return 'long'
  if (ownWord) {
    const word = compact(ownWord)
    const given = compact(text)
    if (given === word || (word.length >= 3 && given.includes(word))) return 'word'
  }
  return null
}

/**
 * Pilih pasangan untuk satu permainan: sesuai kategori dan tingkat kesulitan kalau ada (kalau tidak,
 * syaratnya dilonggarkan), utamakan yang belum dipakai di room ini, dan acak kata mana yang
 * menjadi kata Warga supaya satu pasangan bisa dimainkan dua arah.
 */
export function selectPair(
  library: PairLibrary,
  filter: { category: string; difficulty: string },
  used: Set<string>,
  rand: () => number = Math.random,
): RoundWords | null {
  const matchCategory = (pair: WordPair) => filter.category === ANY || pair.category === filter.category
  const matchDifficulty = (pair: WordPair) => filter.difficulty === ANY || pair.difficulty === filter.difficulty
  const fresh = (pair: WordPair) => !used.has(pairKey(pair))
  const tiers = [
    (pair: WordPair) => matchCategory(pair) && matchDifficulty(pair) && fresh(pair),
    (pair: WordPair) => matchCategory(pair) && matchDifficulty(pair),
    (pair: WordPair) => matchCategory(pair) && fresh(pair),
    matchCategory,
    () => true,
  ]
  for (const tier of tiers) {
    const options = library.pairs.filter(tier)
    if (!options.length) continue
    const pair = options[Math.floor(rand() * options.length)]
    const swap = rand() < 0.5
    return {
      category: pair.category,
      difficulty: pair.difficulty,
      warga: swap ? pair.penyusup : pair.warga,
      penyusup: swap ? pair.warga : pair.penyusup,
    }
  }
  return null
}

export function pairKey(pair: { warga: string; penyusup: string }): string {
  return [normalizeText(pair.warga), normalizeText(pair.penyusup)].sort().join('|')
}
