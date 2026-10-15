import { seatWind, type GameState, type Player } from './state'
import { KIND_COUNT, kindIndex } from './tiles'
import { t } from '../i18n'

/**
 * Penilaian Hong Kong Points: tiap pola di tangan menang bernilai sekian faan, jumlah faan
 * menentukan poin dasar, dan poin dasar itulah yang dibayar pemain lain ke pemenang.
 */

/** Faan di atas batas ini tidak menambah poin lagi. */
export const LIMIT_FAAN = 10
/** Poin dasar untuk 0..LIMIT_FAAN faan. */
export const BASE_POINTS = [1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128]

/** Semua pola yang dinilai, dengan nama [Indonesia, Inggris]; contoh ubinnya ada di tutorial (FAAN_EXAMPLES). */
export const FAAN = {
  selfDraw: { label: ['Menang dari ambilan sendiri (Zimo)', 'Self-drawn win (Zimo)'], faan: 1 },
  concealed: { label: ['Tangan tertutup, tanpa set terbuka (Mun Chin)', 'Concealed hand, no exposed sets (Mun Chin)'], faan: 1 },
  allChi: { label: ['Semua chi (Ping Wu)', 'All chi (Ping Wu)'], faan: 1 },
  seatWind: { label: ['Pong angin kursi', 'Pong of your seat wind'], faan: 1 },
  roundWind: { label: ['Pong angin ronde', 'Pong of the round wind'], faan: 1 },
  dragon: { label: ['Pong naga', 'Dragon pong'], faan: 1 },
  noFlower: { label: ['Tanpa bunga', 'No flowers'], faan: 1 },
  ownFlower: { label: ['Bunga kursi sendiri', 'Own seat flower'], faan: 1 },
  flowerSet: { label: ['Satu set bunga atau musim lengkap', 'Complete set of flowers or seasons'], faan: 2 },
  allPong: { label: ['Semua pong (Dui Dui Wu)', 'All pongs (Dui Dui Wu)'], faan: 3 },
  halfFlush: { label: ['Satu suit + angin/naga (Wan Yat Sik)', 'One suit + winds/dragons (Wan Yat Sik)'], faan: 3 },
  smallDragons: { label: ['Tiga naga kecil (Siu Sam Yun)', 'Small three dragons (Siu Sam Yun)'], faan: 5 },
  smallWinds: { label: ['Empat angin kecil (Siu Sei Hei)', 'Small four winds (Siu Sei Hei)'], faan: 6 },
  fullFlush: { label: ['Satu suit penuh (Ching Yat Sik)', 'Full flush, one suit (Ching Yat Sik)'], faan: 7 },
  bigDragons: { label: ['Tiga naga besar (Dai Sam Yun)', 'Big three dragons (Dai Sam Yun)'], faan: 8 },
  bigWinds: { label: ['Empat angin besar (Dai Sei Hei)', 'Big four winds (Dai Sei Hei)'], faan: 10 },
  allHonors: { label: ['Semua angin dan naga (Tsz Yat Sik)', 'All winds and dragons (Tsz Yat Sik)'], faan: 10 },
}

export type FaanKey = keyof typeof FAAN

/** Pola `key` dengan namanya dalam bahasa aktif. */
export function faanItem(key: FaanKey): FaanItem {
  const [id, en] = FAAN[key].label
  return { label: t(id, en), faan: FAAN[key].faan }
}

export interface FaanItem {
  label: string
  faan: number
}

export interface HandScore {
  items: FaanItem[]
  /** Jumlah faan setelah dibatasi LIMIT_FAAN. */
  faan: number
  /** Jumlah faannya menyentuh atau melewati batas. */
  limit: boolean
  /** Poin dasar; pembayaran tiap pemain adalah kelipatannya. */
  base: number
}

const WIND_START = 27
const DRAGON_START = 31
const isWind = (kind: number) => kind >= WIND_START && kind < DRAGON_START
const isDragon = (kind: number) => kind >= DRAGON_START

/** Satu set: pong/kong jenis `kind`, atau chi yang dimulai dari jenis `kind`. */
interface Shape {
  pong: boolean
  kind: number
}

function times(item: FaanItem, count: number): FaanItem {
  return count === 1 ? item : { label: `${item.label} ×${count}`, faan: item.faan * count }
}

/** Semua cara membagi habis ubin menjadi pong dan chi. */
function setSplits(counts: number[], sets: Shape[], out: Shape[][]) {
  const i = counts.findIndex((count) => count > 0)
  if (i === -1) {
    out.push([...sets])
    return
  }
  if (counts[i] >= 3) {
    counts[i] -= 3
    setSplits(counts, [...sets, { pong: true, kind: i }], out)
    counts[i] += 3
  }
  if (i < WIND_START && i % 9 <= 6 && counts[i + 1] > 0 && counts[i + 2] > 0) {
    counts[i]--
    counts[i + 1]--
    counts[i + 2]--
    setSplits(counts, [...sets, { pong: false, kind: i }], out)
    counts[i]++
    counts[i + 1]++
    counts[i + 2]++
  }
}

/** Semua susunan pair + set dari ubin di tangan; satu tangan bisa punya lebih dari satu susunan. */
function arrangements(player: Player): { pair: number; sets: Shape[] }[] {
  const counts = new Array<number>(KIND_COUNT).fill(0)
  for (const tile of player.hand) counts[kindIndex(tile)]++

  const result: { pair: number; sets: Shape[] }[] = []
  for (let pair = 0; pair < KIND_COUNT; pair++) {
    if (counts[pair] < 2) continue
    counts[pair] -= 2
    const splits: Shape[][] = []
    setSplits(counts, [], splits)
    counts[pair] += 2
    for (const sets of splits) result.push({ pair, sets })
  }
  return result
}

/** Faan dari bentuk tangan (pair + 4 set), tidak termasuk cara menang dan bunga. */
function patternItems(pair: number, sets: Shape[], seat: number, round: number): FaanItem[] {
  const kinds = [pair, ...sets.flatMap((set) => (set.pong ? [set.kind] : [set.kind, set.kind + 1, set.kind + 2]))]
  const suits = new Set(kinds.filter((kind) => kind < WIND_START).map((kind) => Math.floor(kind / 9)))
  const hasHonor = kinds.some((kind) => kind >= WIND_START)
  const pongs = sets.filter((set) => set.pong).map((set) => set.kind)
  const windPongs = pongs.filter(isWind).length
  const dragonPongs = pongs.filter(isDragon).length

  const items: FaanItem[] = []
  if (suits.size === 0) items.push(faanItem('allHonors'))
  else if (suits.size === 1) items.push(hasHonor ? faanItem('halfFlush') : faanItem('fullFlush'))

  // Pola angin/naga besar-kecil sudah mencakup nilai pong-pongnya.
  if (windPongs === 4) items.push(faanItem('bigWinds'))
  else if (windPongs === 3 && isWind(pair)) items.push(faanItem('smallWinds'))
  else {
    if (pongs.includes(WIND_START + seat)) items.push(faanItem('seatWind'))
    if (pongs.includes(WIND_START + round)) items.push(faanItem('roundWind'))
  }

  if (dragonPongs === 3) items.push(faanItem('bigDragons'))
  else if (dragonPongs === 2 && isDragon(pair)) items.push(faanItem('smallDragons'))
  else if (dragonPongs > 0) items.push(times(faanItem('dragon'), dragonPongs))

  if (pongs.length === sets.length && suits.size > 0) items.push(faanItem('allPong'))
  if (pongs.length === 0) items.push(faanItem('allChi'))
  return items
}

function flowerItems(player: Player, seat: number): FaanItem[] {
  const ranks = player.flowers.map((tile) => tile.rank)
  if (ranks.length === 0) return [faanItem('noFlower')]

  const items: FaanItem[] = []
  // Bunga dan musim sama-sama bernomor 1-4; nomor itu berpasangan dengan angin kursi.
  const own = ranks.filter((rank) => (rank - 1) % 4 === seat).length
  if (own > 0) items.push(times(faanItem('ownFlower'), own))
  const fullSets = [0, 4].filter((start) => [1, 2, 3, 4].every((n) => ranks.includes(start + n))).length
  if (fullSets > 0) items.push(times(faanItem('flowerSet'), fullSets))
  return items
}

function total(items: FaanItem[]): number {
  return items.reduce((sum, item) => sum + item.faan, 0)
}

/** Nilai tangan pemenang; null kalau ronde ini seri atau tidak memakai Hong Kong Points. */
export function scoreWin(state: GameState): HandScore | null {
  if (state.ruleset !== 'hk' || state.phase !== 'over' || state.winner === null) return null
  const player = state.players[state.winner]
  const seat = seatWind(state, state.winner)
  const melds: Shape[] = player.melds.map((meld) => ({
    pong: meld.type !== 'chi',
    kind: Math.min(...meld.tiles.map(kindIndex)),
  }))

  // Susunan yang nilainya paling tinggi yang dipakai.
  let pattern: FaanItem[] = []
  for (const { pair, sets } of arrangements(player)) {
    const items = patternItems(pair, [...melds, ...sets], seat, state.roundWind)
    if (total(items) > total(pattern)) pattern = items
  }

  const items = [...pattern]
  if (player.melds.every((meld) => meld.concealed)) items.push(faanItem('concealed'))
  if (state.winType === 'self') items.push(faanItem('selfDraw'))
  items.push(...flowerItems(player, seat))

  const sum = total(items)
  const faan = Math.min(sum, LIMIT_FAAN)
  return { items, faan, limit: sum >= LIMIT_FAAN, base: BASE_POINTS[faan] }
}

/**
 * Perubahan skor tiap pemain dari ronde yang baru selesai (nol semua selama ronde berjalan
 * atau kalau seri). Normal: pemenang +1. Hong Kong Points: menang dari ambilan sendiri dibayar
 * 2× poin dasar oleh semua pemain lain; menang dari buangan dibayar 2× oleh pembuangnya dan
 * 1× oleh pemain lainnya.
 */
export function roundDeltas(state: GameState): number[] {
  const deltas = state.players.map(() => 0)
  const { winner } = state
  if (state.phase !== 'over' || winner === null) return deltas

  const score = scoreWin(state)
  if (!score) {
    deltas[winner] = 1
    return deltas
  }
  state.players.forEach((_, i) => {
    if (i === winner) return
    const double = state.winType === 'self' || state.lastDiscard?.from === i
    const paid = score.base * (double ? 2 : 1)
    deltas[i] -= paid
    deltas[winner] += paid
  })
  return deltas
}

export function formatPoints(points: number): string {
  if (points > 0) return `+${points}`
  return points < 0 ? `−${-points}` : '0'
}
