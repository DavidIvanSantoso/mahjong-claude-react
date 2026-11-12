import { ZONES } from './config'
import type { GameState } from './engine'

/**
 * Suasana latar PALUNG: dinding palung berlapis (parallax), permukaan laut, kaustik dan sinar matahari,
 * rumput laut dan karang, kawanan ikan dan paus di kejauhan, bangkai kapal, ubur-ubur dan plankton
 * bercahaya di zona gelap. Semuanya hiasan (tidak memengaruhi permainan) dan ditentukan dari
 * kedalaman + waktu, jadi tidak butuh state tambahan.
 *
 * Benda di dinding/latar punya "posisi dunia" (piksel × meter); posisi layarnya = posisi dunia −
 * kedalaman × kecepatan lapisan, sehingga semuanya bergulir ke atas saat penyelam turun.
 */

/** Kecepatan gulir tiap lapisan (piksel per meter kedalaman). */
const FAR = 5
const MID = 13
const WRECK = 8

// ---------- Utilitas ----------

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const k = Math.max(0, Math.min(1, t))
  return `rgb(${Math.round(r1 + (r2 - r1) * k)}, ${Math.round(g1 + (g2 - g1) * k)}, ${Math.round(b1 + (b2 - b1) * k)})`
}

/** Angka acak tetap per indeks (posisi hiasan stabil antar frame). */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Derau halus 1D (0–1). */
function noise(x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return hash(i) + (hash(i + 1) - hash(i)) * u
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/** Warna laut dan kegelapan pada kedalaman ini, berbaur halus di 60 m menjelang zona berikutnya. */
export function seaAt(depth: number) {
  let i = 0
  while (i < ZONES.length - 1 && depth >= ZONES[i + 1].from) i++
  const zone = ZONES[i]
  const next = ZONES[i + 1]
  const t = next ? Math.max(0, (depth - (next.from - 60)) / 60) : 0
  const to = next ?? zone
  return {
    top: mix(zone.top, to.top, t),
    bottom: mix(zone.bottom, to.bottom, t),
    topHex: t > 0.5 ? to.top : zone.top,
    bottomHex: t > 0.5 ? to.bottom : zone.bottom,
    darkness: zone.darkness + (to.darkness - zone.darkness) * Math.min(1, t),
  }
}

/** Seberapa "dangkal" (karang, sinar) dan seberapa "dalam" (cahaya hayati) suasana sekarang, 0–1. */
function moods(depth: number) {
  return {
    shallow: clamp01(1 - depth / 230),
    deep: clamp01((depth - 180) / 320),
  }
}

/** Indeks slot berjarak `size` yang terlihat di layar untuk lapisan berkecepatan `speed`. */
function slots(depth: number, speed: number, size: number, height: number, margin = 160): number[] {
  const top = depth * speed - margin
  const first = Math.floor(top / size)
  const last = Math.ceil((top + height + margin * 2) / size)
  const list: number[] = []
  for (let i = first; i <= last; i++) list.push(i)
  return list
}

// ---------- Dinding palung ----------

/** Lebar dinding (dari tepi layar) pada posisi dunia `worldY`. */
function wallWidth(side: number, layer: number, worldY: number, base: number, amp: number): number {
  const seed = side * 1000 + layer * 100
  return base + noise(worldY / 140 + seed) * amp + noise(worldY / 37 + seed + 50) * amp * 0.25
}

function drawWall(ctx: CanvasRenderingContext2D, s: GameState, side: 0 | 1, layer: number, speed: number, base: number, amp: number, color: string) {
  const { width: w, height: h } = s
  const offset = s.depth * speed
  ctx.fillStyle = color
  ctx.beginPath()
  const edge = side === 0 ? 0 : w
  ctx.moveTo(edge, -20)
  for (let y = -20; y <= h + 20; y += 16) {
    const width = wallWidth(side, layer, y + offset, base, amp)
    ctx.lineTo(side === 0 ? width : w - width, y)
  }
  ctx.lineTo(edge, h + 20)
  ctx.closePath()
  ctx.fill()
}

/** Titik di tepi dinding tengah, untuk menempelkan rumput laut, karang, dan kristal. */
function wallEdge(s: GameState, side: 0 | 1, worldY: number) {
  const wall = side === 0 ? LEFT_WALL : RIGHT_WALL
  const width = wallWidth(side, 1, worldY, wall.base, wall.amp)
  return { x: side === 0 ? width : s.width - width, y: worldY - s.depth * MID }
}

const LEFT_WALL = { base: 14, amp: 34 }
const RIGHT_WALL = { base: 22, amp: 54 }

// ---------- Hiasan dangkal ----------

function drawSurface(ctx: CanvasRenderingContext2D, s: GameState, clock: number) {
  // Permukaan laut terlihat di detik-detik awal, lalu bergulir keluar layar.
  const y = s.height / 2 - 80 - s.depth * 26
  if (y < -30) return
  const sky = ctx.createLinearGradient(0, y - 200, 0, y)
  sky.addColorStop(0, '#bfe9ff')
  sky.addColorStop(1, '#e9f8ff')
  ctx.fillStyle = sky
  ctx.beginPath()
  ctx.moveTo(0, -10)
  ctx.lineTo(s.width, -10)
  for (let x = s.width; x >= 0; x -= 12) ctx.lineTo(x, y + Math.sin(x * 0.03 + clock * 2) * 4 + Math.sin(x * 0.011 - clock) * 3)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let x = 0; x <= s.width; x += 12) {
    const wy = y + Math.sin(x * 0.03 + clock * 2) * 4 + Math.sin(x * 0.011 - clock) * 3
    if (x === 0) ctx.moveTo(x, wy)
    else ctx.lineTo(x, wy)
  }
  ctx.stroke()
}

/** Jaring cahaya kaustik yang bergoyang di bagian atas, hanya di perairan dangkal. */
function drawCaustics(ctx: CanvasRenderingContext2D, s: GameState, clock: number, shallow: number) {
  const strength = clamp01((shallow - 0.55) / 0.45)
  if (strength <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineWidth = 2
  for (let j = 0; j < 7; j++) {
    const baseY = 20 + j * 34
    ctx.strokeStyle = `rgba(210, 250, 255, ${0.07 * strength * (1 - j / 8)})`
    ctx.beginPath()
    for (let x = 0; x <= s.width; x += 14) {
      const y = baseY + Math.sin(x * 0.022 + clock * 1.3 + j * 1.9) * 9 + Math.sin(x * 0.051 - clock * 0.9 + j) * 5
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
}

function drawRays(ctx: CanvasRenderingContext2D, s: GameState, clock: number, shallow: number) {
  if (shallow <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 7; i++) {
    const x = ((i + 0.3) / 7) * s.width + Math.sin(clock * 0.25 + i * 1.7) * 50
    const alpha = (0.05 + 0.035 * Math.sin(clock * 0.6 + i * 2.1)) * shallow
    const ray = ctx.createLinearGradient(0, 0, 0, s.height)
    ray.addColorStop(0, `rgba(210, 248, 255, ${alpha})`)
    ray.addColorStop(1, 'rgba(210, 248, 255, 0)')
    ctx.fillStyle = ray
    ctx.beginPath()
    ctx.moveTo(x - 24 - (i % 3) * 8, 0)
    ctx.lineTo(x + 24 + (i % 2) * 10, 0)
    ctx.lineTo(x + 150, s.height)
    ctx.lineTo(x + 10, s.height)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/** Rumput laut dan karang yang menempel di dinding tengah (zona dangkal). */
function drawReef(ctx: CanvasRenderingContext2D, s: GameState, clock: number, shallow: number) {
  if (shallow <= 0.02) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, shallow * 1.4)
  for (const side of [0, 1] as const) {
    for (const i of slots(s.depth, MID, 46, s.height)) {
      const r = hash(i * 7 + side * 31)
      if (r < 0.35) continue
      const { x, y } = wallEdge(s, side, i * 46)
      const dir = side === 0 ? 1 : -1
      if (r < 0.7) {
        // Rumput laut: helai panjang yang tumbuh ke atas sambil bergoyang
        const length = 50 + hash(i * 13 + side) * 80
        const sway = Math.sin(clock * 1.4 + i) * 12
        ctx.strokeStyle = r < 0.52 ? '#3d7a46' : '#5a8f3c'
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(x - dir * 2, y)
        ctx.quadraticCurveTo(x + dir * 14 + sway * 0.5, y - length * 0.5, x + dir * 6 + sway, y - length)
        ctx.stroke()
        ctx.fillStyle = ctx.strokeStyle
        for (let k = 1; k <= 3; k++) {
          const t = k / 4
          const lx = x + dir * 10 * t + sway * t
          const ly = y - length * t
          ctx.beginPath()
          ctx.ellipse(lx + dir * 5, ly, 6, 2.5, -dir * 0.6, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        // Karang kipas / bulat dengan warna cerah
        const colors = ['#e0786a', '#f2a65a', '#c86fb0', '#ef8fa3', '#7fc7b8']
        ctx.fillStyle = colors[Math.floor(hash(i * 3 + side * 5) * colors.length)]
        const size = 9 + hash(i * 17 + side) * 12
        if (r < 0.85) {
          ctx.beginPath()
          ctx.arc(x + dir * size * 0.6, y, size, Math.PI, 0)
          ctx.fill()
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'
          ctx.lineWidth = 1
          for (let k = -2; k <= 2; k++) {
            ctx.beginPath()
            ctx.moveTo(x + dir * size * 0.6, y)
            ctx.lineTo(x + dir * size * 0.6 + k * size * 0.4, y - size * 0.85)
            ctx.stroke()
          }
        } else {
          for (let k = 0; k < 3; k++) {
            ctx.beginPath()
            ctx.arc(x + dir * (4 + k * 6), y - k * 5, size * (0.55 - k * 0.12), 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }
  }
  ctx.restore()
}

// ---------- Kehidupan di kejauhan ----------

function fishSilhouette(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, dir: number) {
  ctx.beginPath()
  ctx.ellipse(x, y, size, size * 0.42, 0, 0, Math.PI * 2)
  ctx.moveTo(x - dir * size * 0.8, y)
  ctx.lineTo(x - dir * size * 1.6, y - size * 0.5)
  ctx.lineTo(x - dir * size * 1.6, y + size * 0.5)
  ctx.closePath()
  ctx.fill()
}

/** Kawanan ikan kecil yang melintas jauh di belakang (bukan musuh). */
function drawSchools(ctx: CanvasRenderingContext2D, s: GameState, clock: number, sea: ReturnType<typeof seaAt>) {
  const visible = clamp01(1 - s.depth / 450)
  if (visible <= 0) return
  for (const [period, seed] of [
    [13, 1],
    [19, 2],
  ]) {
    const n = Math.floor(clock / period)
    const t = (clock % period) / period
    const r = hash(n * 11 + seed)
    if (r < 0.25) continue
    const dir = hash(n * 5 + seed) < 0.5 ? 1 : -1
    const span = s.width + 400
    const cx = dir === 1 ? -200 + t * span : s.width + 200 - t * span
    const cy = 120 + hash(n * 3 + seed) * (s.height - 240)
    const count = 9 + Math.floor(hash(n * 7 + seed) * 10)
    ctx.fillStyle = mix(sea.topHex, '#000000', 0.45)
    ctx.globalAlpha = 0.45 * visible
    for (let k = 0; k < count; k++) {
      const ox = (hash(k * 3 + n) - 0.5) * 120 + Math.sin(clock * 2 + k) * 4
      const oy = (hash(k * 5 + n + 1) - 0.5) * 50 + Math.sin(clock * 1.5 + k * 0.7) * 6
      fishSilhouette(ctx, cx + ox, cy + oy, 5 + hash(k + n) * 2, dir)
    }
    ctx.globalAlpha = 1
  }
}

/** Paus raksasa yang melintas pelan di kejauhan, sekitar 120–340 m. */
function drawWhale(ctx: CanvasRenderingContext2D, s: GameState, clock: number, sea: ReturnType<typeof seaAt>) {
  const presence = clamp01(Math.min((s.depth - 110) / 30, (340 - s.depth) / 30))
  if (presence <= 0) return
  const period = 42
  const t = (clock % period) / period
  const x = s.width + 320 - t * (s.width + 640)
  const y = s.height * 0.42 + Math.sin(clock * 0.4) * 14
  ctx.save()
  ctx.globalAlpha = 0.28 * presence
  ctx.fillStyle = mix(sea.bottomHex, '#000000', 0.35)
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.ellipse(0, 0, 150, 38, 0.02, 0, Math.PI * 2)
  ctx.fill()
  // Ekor (di kanan, paus berenang ke kiri) dan sirip dada
  const flap = Math.sin(clock * 1.2) * 10
  ctx.beginPath()
  ctx.moveTo(130, -4)
  ctx.quadraticCurveTo(190, -10 + flap, 225, -40 + flap)
  ctx.quadraticCurveTo(205, 0 + flap, 228, 34 + flap)
  ctx.quadraticCurveTo(190, 8 + flap, 130, 8)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-40, 22)
  ctx.quadraticCurveTo(-10, 70, 20, 64)
  ctx.quadraticCurveTo(0, 40, -10, 24)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** Bangkai kapal di kejauhan pada kedalaman tertentu. */
const WRECKS = [190, 760, 1450]

function drawWrecks(ctx: CanvasRenderingContext2D, s: GameState, sea: ReturnType<typeof seaAt>) {
  for (const [i, at] of WRECKS.entries()) {
    const y = s.height * 0.7 + (at - s.depth) * WRECK
    if (y < -160 || y > s.height + 160) continue
    const x = s.width * (i % 2 === 0 ? 0.7 : 0.55)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(i % 2 === 0 ? -0.18 : 0.14)
    ctx.scale(0.85, 0.85)
    ctx.fillStyle = mix(sea.bottomHex, '#000000', 0.15)
    ctx.globalAlpha = 0.5
    // Lambung dengan haluan, patahan di buritan, dan tiang miring
    ctx.beginPath()
    ctx.moveTo(-150, -10)
    ctx.lineTo(130, -10)
    ctx.lineTo(170, -34)
    ctx.lineTo(150, 30)
    ctx.lineTo(-120, 30)
    ctx.lineTo(-135, 12)
    ctx.lineTo(-160, 20)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(-40, -40, 70, 32)
    ctx.fillRect(-90, -24, 30, 16)
    ctx.strokeStyle = ctx.fillStyle
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(60, -10)
    ctx.lineTo(80, -120)
    ctx.moveTo(-10, -40)
    ctx.lineTo(-30, -150)
    ctx.stroke()
    // Jendela kapal yang kosong
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
    for (let k = 0; k < 6; k++) {
      ctx.beginPath()
      ctx.arc(-100 + k * 36, 10, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }
}

// ---------- Lapisan utama ----------

/** Latar di belakang ikan dan penyelam (sebelum lapisan kegelapan). */
export function drawAmbience(ctx: CanvasRenderingContext2D, s: GameState, clock: number) {
  const { width: w, height: h } = s
  const sea = seaAt(s.depth)
  const { shallow } = moods(s.depth)

  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, sea.top)
  gradient.addColorStop(1, sea.bottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  drawRays(ctx, s, clock, shallow)

  // Dinding jauh (lebih terang, berbaur dengan air) lalu benda di kejauhan
  const far = mix(sea.bottomHex, sea.topHex, 0.35)
  ctx.globalAlpha = 0.55
  drawWall(ctx, s, 0, 0, FAR, 60, 90, far)
  drawWall(ctx, s, 1, 0, FAR, 90, 140, far)
  ctx.globalAlpha = 1
  drawWhale(ctx, s, clock, sea)
  drawWrecks(ctx, s, sea)
  drawSchools(ctx, s, clock, sea)

  // Dinding tengah (lebih gelap) dengan karang dan rumput laut
  const mid = mix(sea.bottomHex, '#000000', 0.4)
  drawWall(ctx, s, 0, 1, MID, LEFT_WALL.base, LEFT_WALL.amp, mid)
  drawWall(ctx, s, 1, 1, MID, RIGHT_WALL.base, RIGHT_WALL.amp, mid)
  drawReef(ctx, s, clock, shallow)

  drawCaustics(ctx, s, clock, shallow)
  drawSurface(ctx, s, clock)

  // Salju laut: partikel yang naik pelan karena penyelam terus turun.
  const count = Math.round(40 + Math.min(1, s.depth / 400) * 50)
  for (let i = 0; i < count; i++) {
    const layer = 0.4 + hash(i + 7) * 0.9
    const x = (hash(i) * w + Math.sin(clock * 0.5 + i) * 6) % w
    const y = (((hash(i + 99) * h - s.depth * 9 * layer - clock * 4) % h) + h) % h
    ctx.fillStyle = `rgba(220, 240, 255, ${0.1 + layer * 0.16})`
    ctx.fillRect(x, y, 1.2 * layer + 0.6, 1.2 * layer + 0.6)
  }

  // Vinyet halus supaya pusat layar (tempat ikan dan kata) lebih menonjol
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75)
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.32)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)
}

// ---------- Cahaya hayati (di atas kegelapan) ----------

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(${color}, ${alpha})`)
  g.addColorStop(1, `rgba(${color}, 0)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

const GLOW_COLORS = ['127, 247, 255', '255, 130, 220', '170, 140, 255', '140, 255, 190']

/** Ubur-ubur bercahaya yang melayang di kejauhan. */
function drawJellies(ctx: CanvasRenderingContext2D, s: GameState, clock: number, deep: number) {
  for (const i of slots(s.depth, MID * 0.6, 170, s.height, 120)) {
    if (hash(i * 9 + 4) < 0.45) continue
    const color = GLOW_COLORS[Math.floor(hash(i * 2 + 1) * GLOW_COLORS.length)]
    const x = 140 + hash(i * 4 + 2) * (s.width - 220) + Math.sin(clock * 0.3 + i) * 20
    const pulse = Math.sin(clock * 2 + i * 1.3)
    const y = i * 170 - s.depth * MID * 0.6 - clock * 6 + pulse * 3
    const size = 10 + hash(i * 6 + 3) * 10
    const alpha = 0.35 * deep
    glowDot(ctx, x, y, size * 2.6, color, alpha * 0.45)
    ctx.fillStyle = `rgba(${color}, ${alpha * 0.9})`
    ctx.beginPath()
    ctx.ellipse(x, y, size * (1 + pulse * 0.08), size * 0.7, 0, Math.PI, 0)
    ctx.fill()
    ctx.strokeStyle = `rgba(${color}, ${alpha * 0.7})`
    ctx.lineWidth = 1.2
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath()
      ctx.moveTo(x + k * size * 0.35, y)
      for (let t = 1; t <= 4; t++) ctx.lineTo(x + k * size * 0.35 + Math.sin(clock * 2.5 + t + k + i) * 3, y + t * size * 0.55)
      ctx.stroke()
    }
  }
}

/** Palung Hadal: celah magma di dinding dan semburan gelembung dari ventilasi hidrotermal. */
function drawHadal(ctx: CanvasRenderingContext2D, s: GameState, clock: number) {
  const hadal = clamp01((s.depth - 900) / 200)
  if (hadal <= 0) return
  for (const side of [0, 1] as const) {
    for (const i of slots(s.depth, MID, 52, s.height)) {
      if (hash(i * 19 + side * 3 + 9) < 0.55) continue
      const a = wallEdge(s, side, i * 52)
      const b = wallEdge(s, side, i * 52 + 30)
      const flicker = 0.6 + 0.4 * Math.sin(clock * 3 + i * 1.7)
      ctx.strokeStyle = `rgba(255, 120, 40, ${0.5 * flicker * hadal})`
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo((a.x + b.x) / 2 + (side === 0 ? -6 : 6), (a.y + b.y) / 2)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      glowDot(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, 16, '255, 110, 40', 0.25 * flicker * hadal)
    }
  }
  // Gelembung dari ventilasi di dasar
  for (let v = 0; v < 3; v++) {
    const baseX = s.width * (0.3 + v * 0.22)
    glowDot(ctx, baseX, s.height + 4, 40, '255, 120, 50', 0.22 * hadal)
    for (let k = 0; k < 9; k++) {
      const t = (clock * (0.25 + v * 0.05) + k / 9) % 1
      const x = baseX + Math.sin(t * 9 + k) * 8
      const y = s.height - t * s.height * 0.9
      ctx.strokeStyle = `rgba(200, 230, 255, ${0.35 * (1 - t) * hadal})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(x, y, 1.5 + t * 3, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

/** Plankton berkelip, kristal di dinding, dan kawanan ikan lentera di zona gelap. */
export function drawBioluminescence(ctx: CanvasRenderingContext2D, s: GameState, clock: number) {
  const { deep } = moods(s.depth)
  if (deep <= 0.01) return
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  // Plankton berkelip
  for (let i = 0; i < 46; i++) {
    const x = hash(i * 3 + 500) * s.width
    const y = (((hash(i * 7 + 900) * s.height - s.depth * MID * 0.8) % s.height) + s.height) % s.height
    const twinkle = 0.5 + 0.5 * Math.sin(clock * (1.2 + hash(i) * 2.5) + i * 4)
    glowDot(ctx, x, y, 3 + hash(i + 3) * 3, GLOW_COLORS[i % 2 === 0 ? 0 : 3], 0.5 * twinkle * deep)
  }

  // Kristal/jamur bercahaya di tepi dinding tengah
  for (const side of [0, 1] as const) {
    for (const i of slots(s.depth, MID, 64, s.height)) {
      if (hash(i * 13 + side * 7 + 2) < 0.62) continue
      const { x, y } = wallEdge(s, side, i * 64)
      const color = GLOW_COLORS[Math.floor(hash(i * 5 + side) * GLOW_COLORS.length)]
      const pulse = 0.7 + 0.3 * Math.sin(clock * 1.6 + i)
      for (let k = 0; k < 3; k++) {
        const dx = (side === 0 ? -1 : 1) * (2 + k * 4)
        glowDot(ctx, x + dx, y - k * 7, 6 - k, color, 0.55 * pulse * deep)
      }
    }
  }

  // Kontur tipis dinding palung, supaya bentuknya tetap terasa di kegelapan
  ctx.lineWidth = 2
  for (const side of [0, 1] as const) {
    ctx.strokeStyle = `rgba(120, 200, 255, ${0.1 * deep})`
    ctx.beginPath()
    for (let y = -20; y <= s.height + 20; y += 16) {
      const { x } = wallEdge(s, side, y + s.depth * MID)
      if (y === -20) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  drawJellies(ctx, s, clock, deep)
  drawHadal(ctx, s, clock)

  // Ikan lentera: kawanan titik cahaya yang melintas
  const period = 15
  const n = Math.floor(clock / period)
  if (hash(n * 3 + 77) > 0.3) {
    const t = (clock % period) / period
    const dir = hash(n + 5) < 0.5 ? 1 : -1
    const span = s.width + 300
    const cx = dir === 1 ? -150 + t * span : s.width + 150 - t * span
    const cy = 130 + hash(n * 9) * (s.height - 260)
    for (let k = 0; k < 14; k++) {
      const ox = (hash(k * 3 + n) - 0.5) * 140 + Math.sin(clock * 2 + k) * 5
      const oy = (hash(k * 5 + n + 1) - 0.5) * 60 + Math.sin(clock * 1.6 + k) * 6
      glowDot(ctx, cx + ox, cy + oy, 4, '150, 230, 255', 0.6 * deep)
    }
  }

  // Umpan ikan sungut ganda di kejauhan (Abisal ke bawah)
  const abyss = clamp01((s.depth - 550) / 200)
  if (abyss > 0) {
    for (let i = 0; i < 3; i++) {
      const x = s.width * (0.45 + i * 0.2) + Math.sin(clock * 0.2 + i * 2) * 60
      const y = s.height * (0.3 + hash(i + 40) * 0.5) + Math.sin(clock * 0.5 + i) * 20
      const blink = Math.max(0, Math.sin(clock * 0.8 + i * 2.4))
      glowDot(ctx, x, y, 9, '255, 240, 160', 0.55 * blink * abyss)
    }
  }
  ctx.restore()
}
