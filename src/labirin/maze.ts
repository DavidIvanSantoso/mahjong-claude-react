/**
 * Pembuat labirin LABIRIN: deterministik dari seed, tanpa DOM. Host hanya mengirim seed + ukuran +
 * jumlah pemain; tiap perangkat membuat labirin yang sama persis lalu mencocokkan `checksum`.
 *
 * Algoritma: recursive backtracker (lorong panjang berliku), lalu sebagian jalan buntu dibuka
 * ("braiding") supaya ada beberapa rute, dan 3×3 sel di tengah dijadikan alun-alun pintu keluar.
 * Spawn dipilih di tepi labirin, satu per sektor (berjauhan), dengan jarak BFS ke pintu keluar
 * yang sedekat mungkin satu sama lain.
 */

/** Ukuran labirin dalam sel per sisi (ganjil, supaya ada sel tepat di tengah). */
export const SIZES = { kecil: 13, sedang: 17, besar: 21 } as const
export type MazeSize = keyof typeof SIZES
export const isMazeSize = (value: unknown): value is MazeSize => typeof value === 'string' && value in SIZES

const ORDER: MazeSize[] = ['kecil', 'sedang', 'besar']

/**
 * Ukuran yang benar-benar dipakai: labirin kecil terlalu sempit untuk membagi rute yang sama
 * panjang ke banyak pemain, jadi 5–6 pemain minimal "sedang" dan 7–8 pemain selalu "besar".
 */
export function sizeFor(size: MazeSize, players: number): MazeSize {
  const minimum: MazeSize = players >= 7 ? 'besar' : players >= 5 ? 'sedang' : 'kecil'
  return ORDER.indexOf(size) >= ORDER.indexOf(minimum) ? size : minimum
}

/** Peluang jalan buntu dibuka ke sel tetangga. */
const BRAID = 0.14
/** Selisih jarak spawn terjauh dan terdekat ke pintu keluar yang masih diterima (pecahan). */
const FAIRNESS = 0.06
const MAX_ATTEMPTS = 80
/** Rute terpendek yang boleh dipakai spawn: sekian ubin per sel sisi (labirin 17 sel → 51 ubin). */
const MIN_ROUTE_PER_CELL = 3

export interface Tile {
  x: number
  y: number
}

export interface Maze {
  seed: number
  size: MazeSize
  players: number
  /** Ukuran dalam ubin: (2 × sel + 1) per sisi. */
  w: number
  h: number
  /** 1 = dinding, 0 = lantai; indeks y × w + x. */
  walls: Uint8Array
  /** Ubin pintu keluar (tengah labirin). */
  exit: Tile
  /** Ubin awal tiap kursi (indeks = kursi). */
  spawns: Tile[]
  /** Jarak BFS (langkah ubin) dari tiap ubin ke pintu keluar; −1 untuk dinding. */
  distance: Int32Array
  /** Selisih relatif jarak spawn ke pintu keluar (0 = sama persis). */
  spread: number
  checksum: number
}

/** PRNG kecil dan cepat (mulberry32): hasilnya sama di semua browser. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

/** FNV-1a 32-bit atas deretan angka. */
function fnv(values: Iterable<number>): number {
  let hash = 0x811c9dc5
  for (const value of values) {
    hash ^= value & 0xff
    hash = Math.imul(hash, 0x01000193)
    hash ^= (value >>> 8) & 0xff
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

const DIRS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

/** Recursive backtracker (iteratif) di atas sel; mengembalikan grid ubin. */
function carve(cells: number, rand: () => number): Uint8Array {
  const w = cells * 2 + 1
  const walls = new Uint8Array(w * w).fill(1)
  const visited = new Uint8Array(cells * cells)
  const open = (cx: number, cy: number) => (walls[(cy * 2 + 1) * w + cx * 2 + 1] = 0)
  const start = [Math.floor(rand() * cells), Math.floor(rand() * cells)]
  const stack = [start]
  visited[start[1] * cells + start[0]] = 1
  open(start[0], start[1])
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]
    const options = DIRS.filter(([dx, dy]) => {
      const nx = cx + dx
      const ny = cy + dy
      return nx >= 0 && ny >= 0 && nx < cells && ny < cells && !visited[ny * cells + nx]
    })
    if (!options.length) {
      stack.pop()
      continue
    }
    const [dx, dy] = options[Math.floor(rand() * options.length)]
    const nx = cx + dx
    const ny = cy + dy
    walls[(cy * 2 + 1 + dy) * w + cx * 2 + 1 + dx] = 0
    open(nx, ny)
    visited[ny * cells + nx] = 1
    stack.push([nx, ny])
  }
  return walls
}

/** Membuka sebagian jalan buntu ke tetangganya, supaya labirin punya beberapa rute. */
function braid(walls: Uint8Array, cells: number, rand: () => number) {
  const w = cells * 2 + 1
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const tx = cx * 2 + 1
      const ty = cy * 2 + 1
      const closed = DIRS.filter(([dx, dy]) => walls[(ty + dy) * w + tx + dx] === 1)
      if (closed.length !== 3 || rand() >= BRAID) continue
      const inside = closed.filter(([dx, dy]) => cx + dx >= 0 && cy + dy >= 0 && cx + dx < cells && cy + dy < cells)
      if (!inside.length) continue
      const [dx, dy] = inside[Math.floor(rand() * inside.length)]
      walls[(ty + dy) * w + tx + dx] = 0
    }
  }
}

/** Alun-alun 3×3 sel di tengah tempat pintu keluar, dengan beberapa pintu masuk dari lorong sekitarnya. */
function plaza(walls: Uint8Array, cells: number) {
  const w = cells * 2 + 1
  const c = (cells - 1) / 2
  for (let ty = (c - 1) * 2 + 1; ty <= (c + 1) * 2 + 1; ty++) {
    for (let tx = (c - 1) * 2 + 1; tx <= (c + 1) * 2 + 1; tx++) walls[ty * w + tx] = 0
  }
}

function bfs(walls: Uint8Array, w: number, h: number, from: Tile): Int32Array {
  const distance = new Int32Array(w * h).fill(-1)
  const queue = new Int32Array(w * h)
  let head = 0
  let tail = 0
  distance[from.y * w + from.x] = 0
  queue[tail++] = from.y * w + from.x
  while (head < tail) {
    const index = queue[head++]
    const x = index % w
    const y = (index - x) / w
    for (const [dx, dy] of DIRS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const next = ny * w + nx
      if (walls[next] || distance[next] >= 0) continue
      distance[next] = distance[index] + 1
      queue[tail++] = next
    }
  }
  return distance
}

/**
 * Spawn adil: sel di 3 cincin terluar dibagi ke `players` sektor sudut di sekitar pusat (diputar
 * acak). Dicari jarak target bersama yang bisa didekati semua sektor; di tiap sektor dipilih sel
 * yang jarak BFS-nya paling dekat dengan target itu (seri: rute lebih panjang).
 */
function pickSpawns(distance: Int32Array, cells: number, players: number, rand: () => number): Tile[] {
  const w = cells * 2 + 1
  const middle = (cells - 1) / 2
  const center = (w - 1) / 2
  const offset = rand() * Math.PI * 2
  const sectors: { tile: Tile; d: number }[][] = Array.from({ length: players }, () => [])
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      // Cincin terluar saja (4 cincin untuk 6–8 pemain supaya tiap sektor punya cukup pilihan).
      if (Math.max(Math.abs(cx - middle), Math.abs(cy - middle)) < middle - (players >= 6 ? 3 : 2)) continue
      const tile = { x: cx * 2 + 1, y: cy * 2 + 1 }
      const angle = Math.atan2(tile.y - center, tile.x - center)
      const turn = (((angle - offset) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      // Sel di dekat batas sektor dilewati supaya dua spawn tidak berdekatan.
      const position = (turn / (Math.PI * 2)) * players
      if (players > 1 && (position % 1 < 0.12 || position % 1 > 0.88)) continue
      sectors[Math.min(players - 1, Math.floor(position))].push({ tile, d: distance[tile.y * w + tile.x] })
    }
  }
  const pickFor = (target: number) =>
    sectors.map((sector) =>
      sector.reduce((best, cell) => {
        const gap = Math.abs(cell.d - target) - Math.abs(best.d - target)
        return gap < 0 || (gap === 0 && cell.d > best.d) ? cell : best
      }),
    )
  let best = pickFor(0)
  let bestScore = Infinity
  const minRoute = cells * MIN_ROUTE_PER_CELL
  const targets = [...new Set(sectors.flat().map((cell) => cell.d))].filter((d) => d >= minRoute)
  for (const target of targets) {
    const picked = pickFor(target)
    const ds = picked.map((cell) => cell.d)
    // Selisih relatif sekecil mungkin; rute yang lebih panjang sedikit diutamakan; rute terlalu
    // pendek (spawn dekat pintu keluar) sangat dihindari.
    const tooShort = ds.some((d) => d < minRoute) ? 1 : 0
    const score = (Math.max(...ds) - Math.min(...ds)) / Math.max(...ds) - Math.min(...ds) * 1e-4 + tooShort
    if (score < bestScore) {
      bestScore = score
      best = picked
    }
  }
  return best.map((cell) => cell.tile)
}

/** Labirin yang sama untuk seed, ukuran, dan jumlah pemain yang sama. */
export function generateMaze(seed: number, size: MazeSize, players: number): Maze {
  const cells = SIZES[size]
  const w = cells * 2 + 1
  const count = Math.max(1, Math.min(8, Math.floor(players)))
  const exit = { x: (w - 1) / 2, y: (w - 1) / 2 }
  let best: Omit<Maze, 'checksum'> | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rand = mulberry32((seed ^ Math.imul(attempt + 1, 0x9e3779b1)) >>> 0)
    const walls = carve(cells, rand)
    braid(walls, cells, rand)
    plaza(walls, cells)
    const distance = bfs(walls, w, w, exit)
    const spawns = pickSpawns(distance, cells, count, rand)
    const ds = spawns.map((tile) => distance[tile.y * w + tile.x])
    const spread = (Math.max(...ds) - Math.min(...ds)) / Math.max(1, Math.max(...ds))
    if (!best || spread < best.spread) {
      // Urutan spawn diacak supaya kursi 0 (host) tidak selalu di sudut yang sama.
      for (let i = spawns.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[spawns[i], spawns[j]] = [spawns[j], spawns[i]]
      }
      best = { seed, size, players: count, w, h: w, walls, exit, spawns, distance, spread }
    }
    if (spread <= FAIRNESS) break
  }
  const maze = best!
  return { ...maze, checksum: fnv([...maze.walls, ...maze.spawns.flatMap((tile) => [tile.x, tile.y])]) }
}

/** Ubin dinding? (di luar labirin dianggap dinding). */
export function solid(maze: Maze, x: number, y: number): boolean {
  return x < 0 || y < 0 || x >= maze.w || y >= maze.h || maze.walls[y * maze.w + x] === 1
}

/** Sisa jarak (langkah ubin) dari posisi ke pintu keluar. */
export function remaining(maze: Maze, x: number, y: number): number {
  const d = maze.distance[Math.floor(y) * maze.w + Math.floor(x)]
  return d < 0 ? 9999 : d
}
