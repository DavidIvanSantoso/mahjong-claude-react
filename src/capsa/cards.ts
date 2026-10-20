/** Urutan bunga dari yang terendah: Wajik < Keriting < Hati < Sekop. */
export const SUITS = ['diamonds', 'clubs', 'hearts', 'spades'] as const
export type Suit = (typeof SUITS)[number]

export const SUIT_NAMES: Record<Suit, string> = {
  diamonds: 'Wajik',
  clubs: 'Keriting',
  hearts: 'Hati',
  spades: 'Sekop',
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  diamonds: '♦',
  clubs: '♣',
  hearts: '♥',
  spades: '♠',
}

/** Angka 3–10, lalu 11 = J, 12 = Q, 13 = K, 14 = A, 15 = 2 (kartu tertinggi). */
export const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const

export interface Card {
  /**
   * Kekuatan kartu sekaligus ID-nya: (angka - 3) * 4 + urutan bunga, jadi 0 = 3♦ dan 51 = 2♠.
   * Membandingkan dua kartu tunggal cukup membandingkan ID-nya.
   */
  id: number
  rank: number
  suit: Suit
}

export const HAND_SIZE = 13

export function cardFromId(id: number): Card {
  return { id, rank: Math.floor(id / 4) + 3, suit: SUITS[id % 4] }
}

export function buildDeck(): Card[] {
  return Array.from({ length: 52 }, (_, id) => cardFromId(id))
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds'
}

export function rankLabel(rank: number): string {
  return ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2' } as Record<number, string>)[rank] ?? String(rank)
}

/** Nama pendek, mis. "K♠". */
export function cardLabel(card: Card): string {
  return `${rankLabel(card.rank)}${SUIT_SYMBOLS[card.suit]}`
}

/** Nama untuk pembaca layar, mis. "K Sekop". */
export function cardName(card: Card): string {
  return `${rankLabel(card.rank)} ${SUIT_NAMES[card.suit]}`
}

/**
 * Kekuatan kartu tunggal. Normal sama dengan ID (3♦ terlemah, 2♠ terkuat). Saat walik, urutan angka
 * dan bunga sama-sama terbalik: 3 terbesar, 2 terkecil, ♦ terbesar, ♠ terkecil (3♦ jadi terkuat).
 */
export function strength(card: Card, reversed = false): number {
  return reversed ? 51 - card.id : card.id
}

/** Kekuatan angka saja (untuk tris, full house, four of a kind). */
function rankStrength(rank: number, reversed: boolean): number {
  return reversed ? 18 - rank : rank
}

/** Urut angka (lalu bunga) dari yang terlemah, mengikuti urutan yang sedang berlaku. */
export function sortByRank(cards: Card[], reversed = false): Card[] {
  return [...cards].sort((a, b) => strength(a, reversed) - strength(b, reversed))
}

/** Urut bunga dulu (dari yang terlemah), lalu angka, mengikuti urutan yang sedang berlaku. */
export function sortBySuit(cards: Card[], reversed = false): Card[] {
  const suitRank = (card: Card) => (reversed ? 3 - SUITS.indexOf(card.suit) : SUITS.indexOf(card.suit))
  return [...cards].sort(
    (a, b) => suitRank(a) - suitRank(b) || rankStrength(a.rank, reversed) - rankStrength(b.rank, reversed),
  )
}

export type ComboKind = 'single' | 'pair' | 'triple' | 'straight' | 'flush' | 'fullhouse' | 'fourkind' | 'straightflush'

export const COMBO_NAMES: Record<ComboKind, string> = {
  single: 'Single',
  pair: 'Pair',
  triple: 'Tris',
  straight: 'Straight',
  flush: 'Flush',
  fullhouse: 'Full House',
  fourkind: 'Four of a Kind',
  straightflush: 'Straight Flush',
}

/** Tingkatan kombinasi 5 kartu, dari yang terendah. Tidak ikut terbalik saat walik. */
export const FIVE_CARD_ORDER: ComboKind[] = ['straight', 'flush', 'fullhouse', 'fourkind', 'straightflush']

export interface Combo {
  kind: ComboKind
  /** Kartu kombinasi, diurutkan dari yang terkuat (menurut urutan saat dinilai). */
  cards: Card[]
  /** Nilai pembanding; dibandingkan dari depan, makin besar makin kuat. */
  key: number[]
}

/** Nilai angka biasa untuk straight: A bisa 1 atau 14, 2 bernilai 2. */
function naturalValues(rank: number): number[] {
  if (rank === 14) return [14, 1]
  if (rank === 15) return [2]
  return [rank]
}

/**
 * Straight: lima angka berurutan menurut urutan biasa, dengan A boleh di bawah (A-2-3-4-5) atau di
 * atas (10-J-Q-K-A); tidak boleh memutar lewat 2 (J-Q-K-A-2). Hasilnya kartu tertinggi dan terendah
 * straight itu, atau null kalau bukan straight.
 */
function straightEnds(cards: Card[]): { top: number; topCard: Card; low: number; lowCard: Card } | null {
  // Coba A sebagai 14, lalu sebagai 1.
  for (const aceLow of [false, true]) {
    const values = cards.map((card) => {
      const options = naturalValues(card.rank)
      return aceLow ? options[options.length - 1] : options[0]
    })
    const sorted = [...values].sort((a, b) => a - b)
    if (sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1)) {
      const top = sorted[4]
      const low = sorted[0]
      return { top, topCard: cards[values.indexOf(top)], low, lowCard: cards[values.indexOf(low)] }
    }
  }
  return null
}

/**
 * Jenis kombinasi dari kartu yang dipilih, atau null kalau bukan kombinasi yang sah.
 * `reversed`: walik sedang berlaku, jadi kekuatan kartunya dinilai dengan urutan terbalik.
 */
export function evaluate(cards: Card[], reversed = false): Combo | null {
  const str = (card: Card) => strength(card, reversed)
  const suitStr = (card: Card) => (reversed ? 3 - SUITS.indexOf(card.suit) : SUITS.indexOf(card.suit))
  const sorted = [...cards].sort((a, b) => str(b) - str(a))
  const counts = new Map<number, number>()
  sorted.forEach((card) => counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1))
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || rankStrength(b[0], reversed) - rankStrength(a[0], reversed))

  switch (sorted.length) {
    case 1:
      return { kind: 'single', cards: sorted, key: [str(sorted[0])] }
    case 2:
      return groups.length === 1 ? { kind: 'pair', cards: sorted, key: [str(sorted[0])] } : null
    case 3:
      return groups.length === 1 ? { kind: 'triple', cards: sorted, key: [rankStrength(sorted[0].rank, reversed)] } : null
    case 5: {
      const flush = sorted.every((card) => card.suit === sorted[0].suit)
      const straight = straightEnds(sorted)
      // Straight: normal dinilai dari kartu tertingginya; saat walik, dari kartu terendahnya.
      const straightKey = straight
        ? reversed
          ? [-straight.low, suitStr(straight.lowCard)]
          : [straight.top, suitStr(straight.topCard)]
        : []
      if (straight && flush) return { kind: 'straightflush', cards: sorted, key: straightKey }
      if (groups[0][1] === 4) return { kind: 'fourkind', cards: sorted, key: [rankStrength(groups[0][0], reversed)] }
      if (groups[0][1] === 3 && groups[1][1] === 2) {
        return { kind: 'fullhouse', cards: sorted, key: [rankStrength(groups[0][0], reversed)] }
      }
      if (flush) return { kind: 'flush', cards: sorted, key: sorted.map(str) }
      if (straight) return { kind: 'straight', cards: sorted, key: straightKey }
      return null
    }
    default:
      return null
  }
}

/**
 * Apakah `next` mengalahkan `current`: jumlah kartunya harus sama; untuk 5 kartu, jenis yang lebih
 * tinggi selalu menang, dan jenis yang sama dibandingkan lewat `key`. Keduanya harus dinilai dengan
 * urutan yang sama (walik atau tidak).
 */
export function beats(next: Combo, current: Combo): boolean {
  if (next.cards.length !== current.cards.length) return false
  if (next.cards.length === 5) {
    const diff = FIVE_CARD_ORDER.indexOf(next.kind) - FIVE_CARD_ORDER.indexOf(current.kind)
    if (diff !== 0) return diff > 0
  }
  for (let i = 0; i < Math.max(next.key.length, current.key.length); i++) {
    const diff = (next.key[i] ?? 0) - (current.key[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

/** Angka yang paling banyak muncul di kombinasi (angka tris / empat kartu). */
function mainRank(cards: Card[]): number {
  const counts = new Map<number, number>()
  cards.forEach((card) => counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1))
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

/** Nama kombinasi untuk ditampilkan, mis. "Pair K" atau "Full House 7". */
export function comboLabel(combo: Combo): string {
  const top = combo.cards[0]
  switch (combo.kind) {
    case 'single':
      return cardLabel(top)
    case 'pair':
    case 'triple':
      return `${COMBO_NAMES[combo.kind]} ${rankLabel(top.rank)}`
    case 'fullhouse':
    case 'fourkind':
      return `${COMBO_NAMES[combo.kind]} ${rankLabel(mainRank(combo.cards))}`
    default:
      return COMBO_NAMES[combo.kind]
  }
}
