import { t } from '../i18n'

export type Suit = 'man' | 'pin' | 'sou' | 'wind' | 'dragon' | 'flower'

export interface Tile {
  /** Unik per ubin fisik (0..143), dipakai sebagai React key. */
  id: number
  suit: Suit
  /**
   * 1-9 untuk man/pin/sou, 1-4 untuk angin (T/S/B/U), 1-3 untuk naga (merah/hijau/putih),
   * 1-8 untuk bunga (1-4 bunga, 5-8 musim).
   */
  rank: number
}

/** [suit, jumlah jenis, salinan per jenis] */
const SUIT_SIZES: [Suit, number, number][] = [
  ['man', 9, 4],
  ['pin', 9, 4],
  ['sou', 9, 4],
  ['wind', 4, 4],
  ['dragon', 3, 4],
  ['flower', 8, 1],
]

const SUIT_OFFSET: Record<Suit, number> = {
  man: 0,
  pin: 9,
  sou: 18,
  wind: 27,
  dragon: 31,
  flower: 34,
}

/** Jumlah jenis ubin yang bisa ada di tangan (bunga tidak termasuk). */
export const KIND_COUNT = 34

/** 144 ubin: 34 jenis x 4 salinan + 8 bunga. */
export function createWall(): Tile[] {
  const wall: Tile[] = []
  let id = 0
  for (const [suit, size, copies] of SUIT_SIZES) {
    for (let rank = 1; rank <= size; rank++) {
      for (let copy = 0; copy < copies; copy++) wall.push({ id: id++, suit, rank })
    }
  }
  return wall
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Indeks jenis ubin, sama untuk keempat salinannya. Bunga mulai dari 34. */
export function kindIndex(tile: Tile): number {
  return SUIT_OFFSET[tile.suit] + tile.rank - 1
}

export function sameKind(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.rank === b.rank
}

export function isSuited(tile: Tile): boolean {
  return tile.suit === 'man' || tile.suit === 'pin' || tile.suit === 'sou'
}

export function isFlower(tile: Tile): boolean {
  return tile.suit === 'flower'
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => kindIndex(a) - kindIndex(b) || a.id - b.id)
}

const SUIT_NAMES: Record<'man' | 'pin' | 'sou', [string, string]> = {
  man: ['Karakter', 'Characters'],
  pin: ['Bulat', 'Dots'],
  sou: ['Bambu', 'Bamboo'],
}
const WIND_NAMES = [
  ['Timur', 'East'],
  ['Selatan', 'South'],
  ['Barat', 'West'],
  ['Utara', 'North'],
]
const DRAGON_NAMES = [
  ['Merah', 'Red'],
  ['Hijau', 'Green'],
  ['Putih', 'White'],
]
const FLOWER_NAMES = [
  ['Bunga Plum', 'Plum Blossom'],
  ['Bunga Anggrek', 'Orchid'],
  ['Bunga Krisan', 'Chrysanthemum'],
  ['Bunga Bambu', 'Bamboo Flower'],
  ['Musim Semi', 'Spring'],
  ['Musim Panas', 'Summer'],
  ['Musim Gugur', 'Autumn'],
  ['Musim Dingin', 'Winter'],
]

/** Nama dalam bahasa aktif dari pasangan [Indonesia, Inggris]. */
const pick = ([id, en]: string[]) => t(id, en)

/** Nama angin: 0 Timur, 1 Selatan, 2 Barat, 3 Utara. */
export function windName(index: number): string {
  return pick(WIND_NAMES[index])
}

/** Penjelasan singkat jenis ubin dan set apa saja yang bisa dibentuk dengannya. */
export function tileDescription(tile: Tile): string {
  if (tile.suit === 'wind') {
    return t(
      'Ubin angin. Hanya bisa dijadikan pong atau kong, tidak bisa chi.',
      'Wind tile. Can only form a pong or kong, not a chi.',
    )
  }
  if (tile.suit === 'dragon') {
    return t(
      'Ubin naga. Hanya bisa dijadikan pong atau kong, tidak bisa chi.',
      'Dragon tile. Can only form a pong or kong, not a chi.',
    )
  }
  if (tile.suit === 'flower') {
    return t('Ubin bunga. Disisihkan dan diganti ubin baru.', 'Flower tile. Set aside and replaced with a new tile.')
  }
  const suit = pick(SUIT_NAMES[tile.suit])
  return t(
    `Suit ${suit}, angka ${tile.rank}. Bisa dijadikan chi (urutan), pong, atau kong.`,
    `${suit} suit, number ${tile.rank}. Can form a chi (sequence), pong, or kong.`,
  )
}

export function tileName(tile: Tile): string {
  if (tile.suit === 'wind') return t(`Angin ${windName(tile.rank - 1)}`, `${windName(tile.rank - 1)} Wind`)
  if (tile.suit === 'dragon') {
    const color = pick(DRAGON_NAMES[tile.rank - 1])
    return t(`Naga ${color}`, `${color} Dragon`)
  }
  if (tile.suit === 'flower') return pick(FLOWER_NAMES[tile.rank - 1])
  return `${tile.rank} ${pick(SUIT_NAMES[tile.suit])}`
}
