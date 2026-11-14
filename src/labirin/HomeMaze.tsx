import { useEffect, useRef, type RefObject } from 'react'
import { mulberry32, randomSeed } from './maze'
import { COLORS } from './render'

/**
 * Latar animasi beranda LABIRIN: labirin selebar layar, beberapa penjelajah berwarna mencari portal
 * (maju, salah belok, mundur dari jalan buntu). Yang pertama sampai menyalakan rutenya, lalu labirin
 * memudar dan diganti yang baru. Murni hiasan: tidak memakai simulasi atau jaringan game.
 *
 * Labirin di sini persegi panjang (mengikuti layar), jadi dibuat sendiri, bukan lewat generateMaze().
 */

/** Ukuran ubin dalam piksel CSS. */
const TILE = 26
/** Kecepatan penjelajah (ubin per detik), sedikit berbeda tiap penjelajah. */
const SPEED = [11.5, 13]
/** Peluang penjelajah memilih cabang yang benar-benar mendekati portal; sisanya acak (bisa salah belok). */
const GREED = 0.7
/** Salah belok hanya ditelusuri sejauh ini (ubin, diacak) sebelum penjelajah sadar dan berbalik. */
const DETOUR = [3, 9]
/** Peluang jalan buntu dibuka (labirin punya beberapa rute). */
const BRAID = 0.12
const EXPLORERS = 4
/** Rute terpendek minimal dari titik awal penjelajah ke portal (ubin), supaya pencarian tidak langsung selesai. */
const MIN_ROUTE = 40
/** Radius cahaya di sekitar penjelajah dan portal (ubin). */
const LIGHT = 4.2
const PORTAL_LIGHT = 3.2
/** Lama tiap fase (detik). */
const REVEAL = 1
const FOUND = 2.6
const FADE = 0.9
/** Batas lama pencarian; lewat dari ini labirin diganti walau belum ada yang sampai. */
const MAX_SEARCH = 45
const MAX_DPR = 1.5
/** Kecerahan dinding di luar cahaya. */
const DIM = 0.2
const PORTAL = '#78ffc8'

const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

interface Grid {
  w: number
  h: number
  /** Posisi piksel ubin (0, 0); bisa negatif supaya labirin menutup layar sampai tepi. */
  ox: number
  oy: number
  walls: Uint8Array
  exit: number
  distance: Int32Array
}

interface Explorer {
  color: string
  speed: number
  /** Rute dari titik awal sampai ubin sekarang (indeks ubin). */
  path: number[]
  visited: Uint8Array
  /** Ubin yang sudah ditinggalkan karena buntu. */
  dead: number[]
  /** Indeks `path` tempat salah belok dimulai (−1 = sedang di rute yang mendekat), dan batas panjangnya. */
  detourFrom: number
  detourMax: number
  from: number
  to: number
  t: number
}

type Phase = 'reveal' | 'search' | 'found' | 'fade'

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Recursive backtracker di atas sel cw × ch; hasilnya grid ubin (2 × sel + 1).
 * Sel `blocked` (di bawah kartu menu) tetap dinding, jadi labirin melingkari kartu.
 */
function carve(cw: number, ch: number, blocked: Uint8Array, rand: () => number): Uint8Array {
  const w = cw * 2 + 1
  const walls = new Uint8Array(w * (ch * 2 + 1)).fill(1)
  const seen = blocked.slice()
  const open = (cx: number, cy: number) => (walls[(cy * 2 + 1) * w + cx * 2 + 1] = 0)
  let start = [Math.floor(rand() * cw), Math.floor(rand() * ch)]
  if (seen[start[1] * cw + start[0]]) start = [0, 0]
  const stack = [start]
  seen[start[1] * cw + start[0]] = 1
  open(start[0], start[1])
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1]
    const options = DIRS.filter(([dx, dy]) => {
      const nx = cx + dx
      const ny = cy + dy
      return nx >= 0 && ny >= 0 && nx < cw && ny < ch && !seen[ny * cw + nx]
    })
    if (!options.length) {
      stack.pop()
      continue
    }
    const [dx, dy] = options[Math.floor(rand() * options.length)]
    walls[(cy * 2 + 1 + dy) * w + cx * 2 + 1 + dx] = 0
    open(cx + dx, cy + dy)
    seen[(cy + dy) * cw + cx + dx] = 1
    stack.push([cx + dx, cy + dy])
  }
  // Braiding: sebagian jalan buntu dibuka ke sel tetangga.
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const x = cx * 2 + 1
      const y = cy * 2 + 1
      if (blocked[cy * cw + cx]) continue
      const exits = DIRS.filter(([dx, dy]) => !walls[(y + dy) * w + x + dx]).length
      if (exits !== 1 || rand() > BRAID) continue
      const closed = DIRS.filter(([dx, dy]) => {
        const nx = cx + dx
        const ny = cy + dy
        return nx >= 0 && ny >= 0 && nx < cw && ny < ch && !blocked[ny * cw + nx] && walls[(y + dy) * w + x + dx]
      })
      if (!closed.length) continue
      const [dx, dy] = closed[Math.floor(rand() * closed.length)]
      walls[(y + dy) * w + x + dx] = 0
    }
  }
  return walls
}

function bfs(walls: Uint8Array, w: number, h: number, from: number): Int32Array {
  const distance = new Int32Array(w * h).fill(-1)
  const queue = [from]
  distance[from] = 0
  for (let head = 0; head < queue.length; head++) {
    const tile = queue[head]
    const x = tile % w
    const y = (tile - x) / w
    for (const [dx, dy] of DIRS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const next = ny * w + nx
      if (walls[next] || distance[next] >= 0) continue
      distance[next] = distance[tile] + 1
      queue.push(next)
    }
  }
  return distance
}

/**
 * Labirin yang menutup layar; portal di tempat yang terlihat. `covers[0]` = kartu menu (jadi blok
 * dinding), sisanya elemen lain di atas latar (navbar, tombol musik, kredit) yang tidak boleh menutupi portal.
 */
function buildGrid(width: number, height: number, covers: Box[], rand: () => number): { grid: Grid; starts: number[] } {
  const cw = Math.ceil(width / TILE / 2) + 1
  const ch = Math.ceil(height / TILE / 2) + 1
  const w = cw * 2 + 1
  const h = ch * 2 + 1
  const ox = Math.round((width - w * TILE) / 2)
  const oy = Math.round((height - h * TILE) / 2)
  // Kartu menu jadi blok dinding, kecuali kartu hampir selebar/setinggi layar (labirin akan terbelah).
  const blocked = new Uint8Array(cw * ch)
  const avoid = covers[0]
  if (avoid && avoid.right - avoid.left < width - TILE * 8 && avoid.bottom - avoid.top < height - TILE * 6) {
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        const left = ox + (cx * 2 + 1) * TILE
        const top = oy + (cy * 2 + 1) * TILE
        if (left + TILE > avoid.left - TILE / 2 && left < avoid.right + TILE / 2 && top + TILE > avoid.top - TILE / 2 && top < avoid.bottom + TILE / 2) blocked[cy * cw + cx] = 1
      }
    }
  }
  const walls = carve(cw, ch, blocked, rand)
  const cellAt = (px: number, py: number) => {
    const cx = Math.min(cw - 1, Math.max(0, Math.round(((px - ox) / TILE - 1) / 2)))
    const cy = Math.min(ch - 1, Math.max(0, Math.round(((py - oy) / TILE - 1) / 2)))
    return (cy * 2 + 1) * w + cx * 2 + 1
  }
  // Penjelajah mulai dari keempat sudut layar.
  const inset = TILE * 1.5
  const starts = [
    cellAt(inset, inset),
    cellAt(width - inset, height - inset),
    cellAt(width - inset, inset),
    cellAt(inset, height - inset),
  ].slice(0, EXPLORERS)
  // Calon portal: sel yang terlihat, tidak di bawah kartu, tidak terlalu dekat tepi layar. Di layar
  // sempit (kartu hampir selebar layar) syaratnya dilonggarkan bertahap supaya portal tetap terlihat.
  const pick = (margin: number, gap: number) => {
    const found: number[] = []
    for (let cy = 0; cy < ch; cy++) {
      for (let cx = 0; cx < cw; cx++) {
        const px = ox + (cx * 2 + 1.5) * TILE
        const py = oy + (cy * 2 + 1.5) * TILE
        if (px < margin || py < margin * 1.6 || px > width - margin || py > height - margin) continue
        if (covers.some((box) => px > box.left - gap && px < box.right + gap && py > box.top - gap && py < box.bottom + gap)) continue
        found.push((cy * 2 + 1) * w + cx * 2 + 1)
      }
    }
    return found
  }
  let candidates = pick(TILE * 2.5, TILE * 2)
  if (!candidates.length) candidates = pick(TILE * 0.8, TILE * 0.5)
  let best: Grid | null = null
  let bestScore = -Infinity
  for (let attempt = 0; attempt < 12; attempt++) {
    const exit = candidates.length ? candidates[Math.floor(rand() * candidates.length)] : cellAt(width / 2, height / 2)
    const distance = bfs(walls, w, h, exit)
    // Utamakan portal yang cukup jauh dari semua penjelajah dan jaraknya tidak timpang.
    const routes = starts.map((start) => distance[start])
    const score = Math.min(...routes) - (Math.max(...routes) - Math.min(...routes)) * 0.5
    if (score > bestScore) {
      bestScore = score
      best = { w, h, ox, oy, walls, exit, distance }
    }
  }
  // Penjelajah yang terlalu dekat portal (layar sempit) dipindah ke sel terlihat yang cukup jauh.
  const grid = best!
  const far: number[] = []
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const tile = (cy * 2 + 1) * w + cx * 2 + 1
      const px = ox + (cx * 2 + 1.5) * TILE
      const py = oy + (cy * 2 + 1.5) * TILE
      if (px > 0 && py > 0 && px < width && py < height && !blocked[cy * cw + cx] && grid.distance[tile] >= MIN_ROUTE) far.push(tile)
    }
  }
  const placed = starts.map((start) => (grid.distance[start] >= MIN_ROUTE || !far.length ? start : far[Math.floor(rand() * far.length)]))
  return { grid, starts: placed }
}

/** Dinding (gaya sama dengan arena balapan) di kanvas terpisah, digambar sekali per labirin. */
function bake(grid: Grid, width: number, height: number, dpr: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const solid = (x: number, y: number) => x < 0 || y < 0 || x >= grid.w || y >= grid.h || grid.walls[y * grid.w + x] === 1
  ctx.strokeStyle = 'rgba(130, 225, 255, 0.5)'
  ctx.lineWidth = 1.5
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      if (!solid(x, y)) continue
      const px = grid.ox + x * TILE
      const py = grid.oy + y * TILE
      if (px > width || py > height || px + TILE < 0 || py + TILE < 0) continue
      ctx.fillStyle = '#36437f'
      ctx.fillRect(px, py, TILE, TILE)
      if (!solid(x, y + 1)) {
        ctx.fillStyle = '#222b57'
        ctx.fillRect(px, py + TILE * 0.62, TILE, TILE * 0.38)
      }
    }
  }
  ctx.beginPath()
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      if (!solid(x, y)) continue
      const px = grid.ox + x * TILE
      const py = grid.oy + y * TILE
      if (!solid(x, y - 1)) {
        ctx.moveTo(px, py + 0.75)
        ctx.lineTo(px + TILE, py + 0.75)
      }
      if (!solid(x - 1, y)) {
        ctx.moveTo(px + 0.75, py)
        ctx.lineTo(px + 0.75, py + TILE)
      }
      if (!solid(x + 1, y)) {
        ctx.moveTo(px + TILE - 0.75, py)
        ctx.lineTo(px + TILE - 0.75, py + TILE)
      }
    }
  }
  ctx.stroke()
  return canvas
}

class Scene {
  private ctx: CanvasRenderingContext2D
  private light = document.createElement('canvas')
  private lightCtx = this.light.getContext('2d')!
  private width = 0
  private height = 0
  private dpr = 1
  private grid!: Grid
  private walls!: HTMLCanvasElement
  private explorers: Explorer[] = []
  private phase: Phase = 'reveal'
  private elapsed = 0
  private clock = 0
  private winner: Explorer | null = null
  private rand = mulberry32(randomSeed())
  private canvas: HTMLCanvasElement
  private avoid: () => Box[]

  constructor(canvas: HTMLCanvasElement, avoid: () => Box[]) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.avoid = avoid
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    this.canvas.width = this.light.width = Math.round(width * this.dpr)
    this.canvas.height = this.light.height = Math.round(height * this.dpr)
    this.reset()
  }

  private reset() {
    const { grid, starts } = buildGrid(this.width, this.height, this.avoid(), this.rand)
    this.grid = grid
    this.walls = bake(grid, this.width, this.height, this.dpr)
    this.explorers = starts.map((start, i) => {
      const visited = new Uint8Array(grid.w * grid.h)
      visited[start] = 1
      return {
        color: COLORS[(i * 2 + Math.floor(this.rand() * 2)) % COLORS.length],
        speed: SPEED[0] + this.rand() * (SPEED[1] - SPEED[0]),
        path: [start],
        visited,
        dead: [],
        detourFrom: -1,
        detourMax: 0,
        from: start,
        to: start,
        t: 1,
      }
    })
    this.winner = null
    this.phase = 'reveal'
    this.elapsed = 0
  }

  /** Langkah berikut penjelajah yang baru tiba di sebuah ubin (DFS dengan sedikit "naluri" ke portal). */
  private advance(explorer: Explorer) {
    const { w, walls, distance } = this.grid
    const here = explorer.path[explorer.path.length - 1]
    const x = here % w
    const y = (here - x) / w
    const options: number[] = []
    for (const [dx, dy] of DIRS) {
      const next = (y + dy) * w + x + dx
      if (x + dx < 0 || y + dy < 0 || x + dx >= w || y + dy >= this.grid.h) continue
      if (!walls[next] && !explorer.visited[next]) options.push(next)
    }
    explorer.from = here
    // Sudah terlalu jauh salah belok: anggap buntu dan berbalik.
    if (explorer.detourFrom >= 0 && explorer.path.length - 1 - explorer.detourFrom >= explorer.detourMax) options.length = 0
    if (options.length) {
      const nearest = options.reduce((a, b) => (distance[b] < distance[a] ? b : a))
      const next = this.rand() < GREED ? nearest : options[Math.floor(this.rand() * options.length)]
      if (explorer.detourFrom < 0 && distance[next] >= distance[here]) {
        explorer.detourFrom = explorer.path.length - 1
        explorer.detourMax = DETOUR[0] + Math.floor(this.rand() * (DETOUR[1] - DETOUR[0] + 1))
      }
      explorer.visited[next] = 1
      explorer.path.push(next)
      explorer.to = next
    } else if (explorer.path.length > 1) {
      explorer.dead.push(explorer.path.pop()!)
      explorer.to = explorer.path[explorer.path.length - 1]
      if (explorer.path.length - 1 <= explorer.detourFrom) explorer.detourFrom = -1
    } else {
      // Semua ubin terjangkau sudah dijelajah (tidak terjadi pada labirin tersambung): ulangi.
      explorer.visited.fill(0)
      explorer.visited[here] = 1
      explorer.dead = []
      explorer.detourFrom = -1
      explorer.to = here
    }
    explorer.t = 0
  }

  update(dt: number) {
    this.clock += dt
    this.elapsed += dt
    if (this.phase === 'reveal' && this.elapsed >= REVEAL) {
      this.phase = 'search'
      this.elapsed = 0
    } else if (this.phase === 'found' && this.elapsed >= FOUND) {
      this.phase = 'fade'
      this.elapsed = 0
    } else if (this.phase === 'fade' && this.elapsed >= FADE) {
      this.reset()
      return
    }
    if (this.phase !== 'search') return
    if (this.elapsed >= MAX_SEARCH) {
      this.phase = 'fade'
      this.elapsed = 0
      return
    }
    for (const explorer of this.explorers) {
      explorer.t += dt * explorer.speed
      while (explorer.t >= 1) {
        const leftover = explorer.t - 1
        if (explorer.to === this.grid.exit) {
          explorer.t = 1
          this.winner = explorer
          this.phase = 'found'
          this.elapsed = 0
          return
        }
        this.advance(explorer)
        explorer.t = leftover
      }
    }
  }

  /** Tanpa animasi (prefers-reduced-motion): jalankan pencarian sampai selesai, tampilkan hasilnya. */
  settle() {
    this.phase = 'search'
    for (let i = 0; i < 60 * MAX_SEARCH && this.phase === 'search'; i++) this.update(1 / 60)
    this.phase = 'found'
    this.elapsed = 0.6
  }

  private center(tile: number): [number, number] {
    const x = tile % this.grid.w
    const y = (tile - x) / this.grid.w
    return [this.grid.ox + (x + 0.5) * TILE, this.grid.oy + (y + 0.5) * TILE]
  }

  private head(explorer: Explorer): [number, number] {
    const [ax, ay] = this.center(explorer.from)
    const [bx, by] = this.center(explorer.to)
    const t = Math.min(1, explorer.t)
    return [ax + (bx - ax) * t, ay + (by - ay) * t]
  }

  private sceneAlpha(): number {
    if (this.phase === 'reveal') return Math.min(1, this.elapsed / REVEAL)
    if (this.phase === 'fade') return Math.max(0, 1 - this.elapsed / FADE)
    return 1
  }

  draw() {
    const { ctx, dpr } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    const alpha = this.sceneAlpha()
    if (alpha <= 0) return
    ctx.globalAlpha = alpha * DIM
    ctx.drawImage(this.walls, 0, 0)
    ctx.globalAlpha = alpha

    const heads = this.explorers.map((explorer) => this.head(explorer))
    const [ex, ey] = this.center(this.grid.exit)
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 3)

    // Cahaya: dinding di sekitar penjelajah dan portal tampil terang.
    const light = this.lightCtx
    light.setTransform(1, 0, 0, 1, 0, 0)
    light.globalCompositeOperation = 'source-over'
    light.clearRect(0, 0, this.light.width, this.light.height)
    light.setTransform(dpr, 0, 0, dpr, 0, 0)
    const glow = (x: number, y: number, radius: number) => {
      const gradient = light.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
      gradient.addColorStop(0.55, 'rgba(255,255,255,0.45)')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      light.fillStyle = gradient
      light.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    }
    for (const [x, y] of heads) glow(x, y, LIGHT * TILE)
    glow(ex, ey, PORTAL_LIGHT * TILE * (this.phase === 'found' ? 1.6 : 1))
    light.setTransform(1, 0, 0, 1, 0, 0)
    light.globalCompositeOperation = 'source-in'
    light.drawImage(this.walls, 0, 0)
    ctx.drawImage(this.light, 0, 0)

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const found = this.phase === 'found' || (this.phase === 'fade' && this.winner)

    // Jejak jalan buntu: titik redup.
    for (const explorer of this.explorers) {
      ctx.fillStyle = explorer.color
      ctx.globalAlpha = alpha * (found ? 0.12 : 0.22)
      for (const tile of explorer.dead) {
        const [x, y] = this.center(tile)
        ctx.fillRect(x - 2, y - 2, 4, 4)
      }
    }

    // Rute yang sedang ditempuh tiap penjelajah.
    for (let i = 0; i < this.explorers.length; i++) {
      const explorer = this.explorers[i]
      const winner = explorer === this.winner
      const faded = found && !winner
      ctx.globalAlpha = alpha * (faded ? 0.25 : winner ? 0.95 : 0.7)
      ctx.strokeStyle = explorer.color
      ctx.lineWidth = winner && found ? TILE * 0.3 : TILE * 0.18
      ctx.shadowColor = explorer.color
      ctx.shadowBlur = winner && found ? 14 + pulse * 10 : 8
      ctx.beginPath()
      const path = explorer.path
      const tail = explorer.to === path[path.length - 1] ? path.length - 1 : path.length
      for (let k = 0; k < tail; k++) {
        const [x, y] = this.center(path[k])
        if (k === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.lineTo(heads[i][0], heads[i][1])
      ctx.stroke()
    }

    // Portal
    ctx.shadowColor = PORTAL
    ctx.shadowBlur = 18 + pulse * 12
    ctx.globalAlpha = alpha
    ctx.strokeStyle = PORTAL
    ctx.lineWidth = 3
    const spin = this.clock * 1.6
    ctx.beginPath()
    ctx.arc(ex, ey, TILE * 0.42, spin, spin + Math.PI * 1.4)
    ctx.stroke()
    ctx.fillStyle = PORTAL
    ctx.globalAlpha = alpha * (0.55 + pulse * 0.35)
    ctx.beginPath()
    ctx.arc(ex, ey, TILE * 0.22, 0, Math.PI * 2)
    ctx.fill()
    if (this.phase === 'found') {
      // Gelombang cahaya saat portal ditemukan.
      const wave = (this.elapsed % 1.2) / 1.2
      ctx.globalAlpha = alpha * (1 - wave) * 0.8
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(ex, ey, TILE * (0.5 + wave * 3), 0, Math.PI * 2)
      ctx.stroke()
    }

    // Kepala penjelajah
    for (let i = 0; i < this.explorers.length; i++) {
      const explorer = this.explorers[i]
      const [x, y] = heads[i]
      ctx.globalAlpha = alpha * (found && explorer !== this.winner ? 0.45 : 1)
      ctx.shadowColor = explorer.color
      ctx.shadowBlur = 16
      ctx.fillStyle = explorer.color
      ctx.beginPath()
      ctx.arc(x, y, TILE * 0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.arc(x - TILE * 0.08, y - TILE * 0.08, TILE * 0.1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
}

/** Kanvas latar beranda. `avoidRef`: elemen (kartu menu) yang tidak boleh menutupi portal. */
export function HomeMaze({ avoidRef }: { avoidRef: RefObject<HTMLElement | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const avoid = (): Box[] => {
      if (!avoidRef.current) return []
      const own = canvas.getBoundingClientRect()
      const others = canvas.parentElement ? [...canvas.parentElement.querySelectorAll<HTMLElement>(':scope > :is(.game-nav, .home__tools, .home__credit)')] : []
      return [avoidRef.current, ...others].flatMap((element) => {
        const box = element?.getBoundingClientRect()
        return box ? [{ left: box.left - own.left, top: box.top - own.top, right: box.right - own.left, bottom: box.bottom - own.top }] : []
      })
    }
    const scene = new Scene(canvas, avoid)
    if (import.meta.env.DEV) Object.assign(window, { __labirinHome: scene })
    let frame = 0
    let last = 0
    let size = ''
    let resizeTimer: ReturnType<typeof setTimeout> | undefined

    const fit = () => {
      const { width, height } = canvas.getBoundingClientRect()
      const key = `${Math.round(width)}x${Math.round(height)}`
      if (key === size || width < 1 || height < 1) return
      size = key
      scene.resize(width, height)
      if (reduced) {
        scene.settle()
        scene.draw()
      }
    }
    fit()
    // Ukuran berubah: labirin baru (ditunda sebentar supaya tidak dibuat ulang tiap piksel saat menyeret jendela).
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(fit, 150)
    })
    observer.observe(canvas)

    if (!reduced) {
      const loop = (now: number) => {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
        last = now
        scene.update(dt)
        scene.draw()
        frame = requestAnimationFrame(loop)
      }
      frame = requestAnimationFrame(loop)
    }
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(resizeTimer)
      observer.disconnect()
    }
  }, [avoidRef])

  return <canvas ref={canvasRef} className="lb-home__maze" aria-hidden="true" />
}
