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

const SUIT_NAMES: Record<'man' | 'pin' | 'sou', string> = {
  man: 'Karakter',
  pin: 'Bulat',
  sou: 'Bambu',
}
const WIND_NAMES = ['Timur', 'Selatan', 'Barat', 'Utara']
const DRAGON_NAMES = ['Merah', 'Hijau', 'Putih']
const FLOWER_NAMES = [
  'Bunga Plum',
  'Bunga Anggrek',
  'Bunga Krisan',
  'Bunga Bambu',
  'Musim Semi',
  'Musim Panas',
  'Musim Gugur',
  'Musim Dingin',
]

/** Penjelasan singkat jenis ubin dan set apa saja yang bisa dibentuk dengannya. */
export function tileDescription(tile: Tile): string {
  if (tile.suit === 'wind') return 'Ubin angin. Hanya bisa dijadikan pong atau kong, tidak bisa chi.'
  if (tile.suit === 'dragon') return 'Ubin naga. Hanya bisa dijadikan pong atau kong, tidak bisa chi.'
  if (tile.suit === 'flower') return 'Ubin bunga. Disisihkan dan diganti ubin baru.'
  return `Suit ${SUIT_NAMES[tile.suit]}, angka ${tile.rank}. Bisa dijadikan chi (urutan), pong, atau kong.`
}

export function tileName(tile: Tile): string {
  if (tile.suit === 'wind') return `Angin ${WIND_NAMES[tile.rank - 1]}`
  if (tile.suit === 'dragon') return `Naga ${DRAGON_NAMES[tile.rank - 1]}`
  if (tile.suit === 'flower') return FLOWER_NAMES[tile.rank - 1]
  return `${tile.rank} ${SUIT_NAMES[tile.suit]}`
}
