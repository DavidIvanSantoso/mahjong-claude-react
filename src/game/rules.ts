import { KIND_COUNT, isSuited, kindIndex, sameKind, type Tile } from './tiles'

/**
 * Menang = 4 set + 1 pair (14 ubin). Set yang sudah dibuka (pong/chi/kong) dihitung
 * lewat meldCount, sisanya harus terbentuk dari ubin di tangan. Kong tetap dihitung
 * satu set karena ubin keempatnya sudah diganti ubin tambahan dari dinding.
 */
export function isWinningHand(concealed: Tile[], meldCount: number): boolean {
  if (concealed.length !== 14 - meldCount * 3) return false
  return hasWinningShape(countKinds(concealed))
}

/**
 * Tangan "menunggu": tinggal butuh 1 ubin lagi untuk menang. Saat pemain sedang memegang ubin
 * ambilan (satu ubin lebih banyak), cukup ada satu buangan yang menyisakan tangan menunggu.
 */
export function isWaitingHand(concealed: Tile[], meldCount: number): boolean {
  const resting = 13 - meldCount * 3
  if (concealed.length === resting + 1) {
    return concealed.some((_, i) =>
      isWaitingHand(
        concealed.filter((_, j) => j !== i),
        meldCount,
      ),
    )
  }
  if (concealed.length !== resting) return false

  const counts = countKinds(concealed)
  for (let i = 0; i < KIND_COUNT; i++) {
    // Jenis yang keempat ubinnya sudah di tangan tidak mungkin didapat lagi.
    if (counts[i] >= 4) continue
    counts[i]++
    const ok = hasWinningShape(counts)
    counts[i]--
    if (ok) return true
  }
  return false
}

function countKinds(tiles: Tile[]): number[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  for (const tile of tiles) counts[kindIndex(tile)]++
  return counts
}

/** Apakah ubin-ubin ini tepat membentuk 1 pair ditambah set-set (pong/chi). */
function hasWinningShape(counts: number[]): boolean {
  for (let i = 0; i < KIND_COUNT; i++) {
    if (counts[i] < 2) continue
    counts[i] -= 2
    const ok = canFormSets(counts)
    counts[i] += 2
    if (ok) return true
  }
  return false
}

/** Apakah semua ubin tersisa bisa dibagi habis menjadi pong (3 kembar) atau chi (3 berurutan). */
function canFormSets(counts: number[]): boolean {
  const i = counts.findIndex((count) => count > 0)
  if (i === -1) return true

  if (counts[i] >= 3) {
    counts[i] -= 3
    const ok = canFormSets(counts)
    counts[i] += 3
    if (ok) return true
  }

  // Urutan hanya untuk ubin bernomor dan tidak boleh melewati batas suit (8-9-1 tidak sah).
  const isSuitedKind = i < 27
  if (isSuitedKind && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i]--
    counts[i + 1]--
    counts[i + 2]--
    const ok = canFormSets(counts)
    counts[i]++
    counts[i + 1]++
    counts[i + 2]++
    if (ok) return true
  }

  return false
}

/** Ubin di tangan yang kembar dengan `target`: 2 cukup untuk pong, 3 untuk kong dari buangan. */
export function matchingTiles(hand: Tile[], target: Tile): Tile[] {
  return hand.filter((tile) => sameKind(tile, target))
}

/** Semua pasangan ubin di tangan yang membentuk urutan dengan ubin buangan. */
export function chiOptions(hand: Tile[], discard: Tile): [Tile, Tile][] {
  if (!isSuited(discard)) return []

  const find = (rank: number) =>
    hand.find((tile) => tile.suit === discard.suit && tile.rank === rank)

  const options: [Tile, Tile][] = []
  for (const [a, b] of [
    [-2, -1],
    [-1, 1],
    [1, 2],
  ]) {
    const first = find(discard.rank + a)
    const second = find(discard.rank + b)
    if (first && second) options.push([first, second])
  }
  return options
}
