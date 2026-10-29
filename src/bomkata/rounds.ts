import type { CategoryEntry } from './words'

/*
 * Pemilihan kategori dan tantangan tiap ronde KA-BOOM!. Dipisah dari net.ts supaya murni
 * (tanpa PeerJS/browser) dan bisa diuji sendiri.
 */

/** Peluang sebuah ronde mendapat tantangan tambahan (mis. "berakhiran A"), kalau Next Level dinyalakan. */
export const TWIST_CHANCE = 0.4
/** Tantangan hanya dipakai kalau kamus masih menyisakan sebanyak ini jawaban yang sah. */
const TWIST_MIN_ANSWERS = 8
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

/** Jenis tantangan Next Level yang bisa dinyalakan host saat membuat room. */
export type TwistKind = 'start' | 'end' | 'length'

export const TWIST_KINDS: { id: TwistKind; label: string; example: string }[] = [
  { id: 'start', label: 'Awalan huruf', example: 'Buah berawalan "M"' },
  { id: 'end', label: 'Akhiran huruf', example: 'Hewan berakhiran "A"' },
  { id: 'length', label: 'Minimal huruf', example: 'Negara minimal 7 huruf' },
]

export function isTwistKind(value: unknown): value is TwistKind {
  return TWIST_KINDS.some((kind) => kind.id === value)
}

/**
 * Tantangan yang mungkin untuk satu kategori, dari jenis yang dinyalakan (`kinds`): berawalan huruf,
 * berakhiran huruf, atau minimal sekian huruf. Hanya tantangan yang menyisakan cukup banyak jawaban yang dipakai.
 */
export function twistOptions(answers: string[], kinds: TwistKind[]): { twist: string; answers: string[] }[] {
  const options: { twist: string; answers: string[] }[] = []
  for (const letter of LETTERS) {
    const starts = answers.filter((word) => word.startsWith(letter))
    if (kinds.includes('start') && starts.length >= TWIST_MIN_ANSWERS) options.push({ twist: `berawalan "${letter.toUpperCase()}"`, answers: starts })
    const ends = answers.filter((word) => word.endsWith(letter))
    if (kinds.includes('end') && ends.length >= TWIST_MIN_ANSWERS) options.push({ twist: `berakhiran "${letter.toUpperCase()}"`, answers: ends })
  }
  if (!kinds.includes('length')) return options
  for (const min of [6, 7, 8, 9, 10]) {
    const long = answers.filter((word) => word.replace(/ /g, '').length >= min)
    // Kalau hampir semua jawaban sudah sepanjang itu, tantangannya tidak berarti.
    if (long.length >= TWIST_MIN_ANSWERS && long.length <= answers.length * 0.7) {
      options.push({ twist: `minimal ${min} huruf`, answers: long })
    }
  }
  return options
}

export function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Kategori yang muncul dalam sekian ronde terakhir dilewati dulu, juga saat kantong baru diisi ulang. */
export const RECENT_WINDOW = 10

/**
 * Ambil (dan buang) kategori berikutnya dari kantong acak `bag`. `recent` berisi kategori terakhir
 * (paling baru di depan). Urutan prioritas: bukan kategori yang baru muncul dan bukan segrup dengan
 * kategori sebelumnya (mis. Ikan setelah Hewan); lalu cukup bukan yang baru muncul; lalu apa saja
 * selain kategori sebelumnya. Isi kantong yang tersisa di akhir siklus tetap keluar semua.
 */
export function drawFromBag(bag: CategoryEntry[], recent: CategoryEntry[]): CategoryEntry {
  const last = recent[0]
  const fresh = (entry: CategoryEntry) => !recent.some((r) => r.id === entry.id)
  const otherGroup = (entry: CategoryEntry) => !entry.group || entry.group !== last?.group
  const rules = [
    (entry: CategoryEntry) => fresh(entry) && otherGroup(entry),
    fresh,
    (entry: CategoryEntry) => entry.id !== last?.id && otherGroup(entry),
    (entry: CategoryEntry) => entry.id !== last?.id,
  ]
  for (const rule of rules) {
    const i = bag.findIndex(rule)
    if (i >= 0) return bag.splice(i, 1)[0]
  }
  return bag.splice(0, 1)[0]
}
