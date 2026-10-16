/** Empat warna kartu UNO. Kartu Wild tidak berwarna sampai dimainkan. */
export const COLORS = ['red', 'yellow', 'green', 'blue'] as const
export type Color = (typeof COLORS)[number]

export const COLOR_NAMES: Record<Color, string> = {
  red: 'Merah',
  yellow: 'Kuning',
  green: 'Hijau',
  blue: 'Biru',
}

export type ActionValue = 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'
/** Angka 0–9, atau jenis kartu aksi. */
export type CardValue = number | ActionValue

export interface Card {
  id: number
  /** null untuk Wild dan Wild Draw Four. */
  color: Color | null
  value: CardValue
}

export const HAND_SIZE = 7

/**
 * Dek standar 108 kartu: per warna satu angka 0, dua tiap angka 1–9, dan dua tiap
 * Skip, Reverse, Draw Two; ditambah empat Wild dan empat Wild Draw Four.
 */
export function buildDeck(): Card[] {
  const deck: Card[] = []
  let id = 0
  for (const color of COLORS) {
    deck.push({ id: id++, color, value: 0 })
    for (let copy = 0; copy < 2; copy++) {
      for (let n = 1; n <= 9; n++) deck.push({ id: id++, color, value: n })
      for (const value of ['skip', 'reverse', 'draw2'] as const) deck.push({ id: id++, color, value })
    }
  }
  for (let copy = 0; copy < 4; copy++) {
    deck.push({ id: id++, color: null, value: 'wild' })
    deck.push({ id: id++, color: null, value: 'wild4' })
  }
  return deck
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function isWild(card: Card): boolean {
  return card.value === 'wild' || card.value === 'wild4'
}

/**
 * Kartu boleh dimainkan kalau warnanya sama dengan warna yang berlaku, angka/simbolnya sama
 * dengan kartu teratas, atau kartu Wild. Wild Draw Four selalu boleh dikeluarkan; kalau
 * sebenarnya masih ada kartu berwarna sama, pemain berikutnya bisa menantangnya.
 */
export function canPlay(card: Card, top: Card, color: Color): boolean {
  if (isWild(card)) return true
  return card.color === color || card.value === top.value
}

/** Nilai kartu yang tersisa di tangan lawan saat ronde berakhir. */
export function cardPoints(card: Card): number {
  if (typeof card.value === 'number') return card.value
  return isWild(card) ? 50 : 20
}

const VALUE_NAMES: Record<ActionValue, string> = {
  skip: 'Skip',
  reverse: 'Reverse',
  draw2: 'Draw Two',
  wild: 'Wild',
  wild4: 'Wild Draw Four',
}

/** Nilai kartu tanpa warna, mis. "angka 7" atau "Skip". */
export function valueName(card: Card): string {
  return typeof card.value === 'number' ? `angka ${card.value}` : VALUE_NAMES[card.value]
}

/** Nama kartu untuk pesan dan pembaca layar, mis. "Merah 7" atau "Draw Two Biru". */
export function cardName(card: Card): string {
  if (typeof card.value === 'number') return `${COLOR_NAMES[card.color!]} ${card.value}`
  if (isWild(card)) return VALUE_NAMES[card.value]
  return `${VALUE_NAMES[card.value]} ${COLOR_NAMES[card.color!]}`
}

const VALUE_ORDER: CardValue[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'skip', 'reverse', 'draw2', 'wild', 'wild4']

/** Urutan tampilan di tangan: per warna, lalu angka, kartu aksi, dan Wild paling kanan. */
export function sortHand(hand: Card[]): Card[] {
  const colorRank = (card: Card) => (card.color ? COLORS.indexOf(card.color) : COLORS.length)
  return [...hand].sort(
    (a, b) =>
      colorRank(a) - colorRank(b) || VALUE_ORDER.indexOf(a.value) - VALUE_ORDER.indexOf(b.value) || a.id - b.id,
  )
}
