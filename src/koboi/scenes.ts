import { ARENA, BOSSES, WORLD, type SceneId } from './config'
import { ARENA_BOTTOM, ARENA_RIGHT, type GameState } from './state'

/**
 * Tema visual tiap babak pertarungan bos: latar (statis disimpan sekali + lapisan animasi), lantai arena,
 * pagar dan tiang sudut, serta warna HUD. Lantai sengaja tetap gelap supaya peluru terang mudah dibaca;
 * semua hiasan bergerak digambar sebelum arena sehingga tidak pernah menutupi area main.
 */

const W = WORLD.width
const H = WORLD.height
const TAU = Math.PI * 2
const SIGN_FONT = 'Georgia, serif'

type Ctx = CanvasRenderingContext2D

export interface HudTheme {
  panel: string
  stroke: string
  bar: [string, string]
  accent: string
}

const HUD: Record<'west' | 'saloon' | 'dusk' | 'mine' | 'ghost', HudTheme> = {
  west: { panel: 'rgba(35, 20, 14, 0.82)', stroke: 'rgba(227, 180, 80, 0.45)', bar: ['#c0322b', '#e3b450'], accent: '#e3b450' },
  saloon: { panel: 'rgba(46, 12, 20, 0.86)', stroke: 'rgba(240, 200, 110, 0.6)', bar: ['#8a2433', '#f0c86e'], accent: '#f0c86e' },
  dusk: { panel: 'rgba(30, 18, 34, 0.85)', stroke: 'rgba(240, 150, 110, 0.5)', bar: ['#b0344a', '#f4a85a'], accent: '#f4b46a' },
  mine: { panel: 'rgba(24, 15, 10, 0.88)', stroke: 'rgba(255, 140, 60, 0.55)', bar: ['#ff3d1c', '#ffc23a'], accent: '#ffb347' },
  ghost: { panel: 'rgba(8, 22, 30, 0.86)', stroke: 'rgba(130, 230, 200, 0.5)', bar: ['#1f7a86', '#b8ffd8'], accent: '#9cf2d2' },
}

const SCENE_HUD: Record<SceneId, HudTheme> = {
  desert: HUD.west,
  street: HUD.west,
  saloon: HUD.saloon,
  trainroof: HUD.dusk,
  mine: HUD.mine,
  powder: HUD.mine,
  inferno: HUD.mine,
  station: HUD.ghost,
  bridge: HUD.ghost,
  ghosttrain: HUD.ghost,
}

export function sceneOf(s: GameState): SceneId {
  return s.boss ? BOSSES[s.boss.id].acts[s.boss.act].scene : 'desert'
}

export function hudTheme(s: GameState): HudTheme {
  return SCENE_HUD[sceneOf(s)]
}

// ---------- Alat bantu ----------

function hash(n: number): number {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return v - Math.floor(v)
}

function vgrad(ctx: Ctx, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  for (const [at, color] of stops) g.addColorStop(at, color)
  return g
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color.replace('A', String(alpha)))
  g.addColorStop(1, color.replace('A', '0'))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

const cache = new Map<string, HTMLCanvasElement>()

/** Lapisan statis digambar sekali (resolusi mengikuti layar, maks 2×) lalu disalin tiap frame. */
function layer(key: string, draw: (ctx: Ctx) => void, width = W): HTMLCanvasElement {
  const hit = cache.get(key)
  if (hit) return hit
  const res = Math.min(2, Math.max(1, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * res)
  canvas.height = Math.round(H * res)
  const ctx = canvas.getContext('2d')!
  ctx.scale(res, res)
  draw(ctx)
  cache.set(key, canvas)
  if (cache.size > 9) cache.delete(cache.keys().next().value!)
  return canvas
}

/** Garis mesa bertingkat (puncak datar) seperti latar gurun. */
function mesa(ctx: Ctx, base: number, color: string, seed: number, amp = 1) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, H)
  let x = 0
  while (x <= W) {
    const r = Math.abs(Math.sin(x * 0.013 + seed) * Math.cos(x * 0.007 + seed * 2))
    const flat = r > 0.55
    const h = flat ? base - (40 + r * 30) * amp : base - r * 18 * amp
    ctx.lineTo(x, h)
    x += flat ? 50 : 18
    ctx.lineTo(x, h)
  }
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()
}

/** Bukit halus yang berulang tiap `W` piksel (untuk latar bergulir). */
function hills(ctx: Ctx, base: number, color: string, amp: number, seed: number) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, H)
  for (let x = 0; x <= W; x += 8) {
    const t = (x / W) * TAU
    const y = base - amp * (0.5 + 0.5 * Math.sin(t * 2 + seed)) * (0.6 + 0.4 * Math.sin(t * 5 + seed * 3))
    ctx.lineTo(x, y)
  }
  ctx.lineTo(W, H)
  ctx.closePath()
  ctx.fill()
}

function stars(ctx: Ctx, count: number, maxY: number, seed: number) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(235, 245, 255, ${0.2 + hash(seed + i * 3) * 0.6})`
    const size = hash(seed + i * 7) < 0.1 ? 2 : 1
    ctx.fillRect(hash(seed + i) * W, hash(seed + i * 5 + 1) * maxY, size, size)
  }
}

function moon(ctx: Ctx, x: number, y: number, r: number, tint: string) {
  glow(ctx, x, y, r * 4, tint, 0.22)
  ctx.fillStyle = '#e6efe6'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(150, 170, 165, 0.35)'
  for (const [dx, dy, rr] of [
    [-8, -6, 6],
    [9, 4, 5],
    [-2, 11, 4],
    [6, -12, 3],
  ]) {
    ctx.beginPath()
    ctx.arc(x + dx * (r / 30), y + dy * (r / 30), rr * (r / 30), 0, TAU)
    ctx.fill()
  }
}

function rails(ctx: Ctx, y: number, rail: string, sleeper: string) {
  ctx.fillStyle = sleeper
  for (let x = -6; x < W; x += 22) ctx.fillRect(x, y - 4, 10, 26)
  ctx.fillStyle = rail
  ctx.fillRect(0, y, W, 3)
  ctx.fillRect(0, y + 15, W, 3)
}

function barrel(ctx: Ctx, x: number, y: number, w: number, h: number, label?: string) {
  const body = ctx.createLinearGradient(x, 0, x + w, 0)
  body.addColorStop(0, '#3e2414')
  body.addColorStop(0.45, '#7a4a28')
  body.addColorStop(1, '#3a2012')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, w * 0.25)
  ctx.fill()
  ctx.fillStyle = '#2a2420'
  ctx.fillRect(x, y + h * 0.18, w, 3)
  ctx.fillRect(x, y + h * 0.78, w, 3)
  if (label) {
    ctx.fillStyle = 'rgba(230, 210, 170, 0.75)'
    ctx.font = `700 7px ${SIGN_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + w / 2, y + h / 2)
  }
}

function crate(ctx: Ctx, x: number, y: number, w: number, h: number, label?: string) {
  ctx.fillStyle = '#6b4626'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#3a2414'
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)
  ctx.beginPath()
  ctx.moveTo(x + 3, y + 3)
  ctx.lineTo(x + w - 3, y + h - 3)
  ctx.stroke()
  if (label) {
    ctx.fillStyle = 'rgba(170, 30, 20, 0.9)'
    ctx.font = `700 11px ${SIGN_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x + w / 2, y + h / 2)
  }
}

// ---------- Latar statis ----------

function desertStatic(ctx: Ctx) {
  ctx.fillStyle = vgrad(ctx, 0, H, [
    [0, '#2b1630'],
    [0.35, '#8a2f3a'],
    [0.55, '#e0702f'],
    [0.7, '#f2b25c'],
    [1, '#6b4128'],
  ])
  ctx.fillRect(0, 0, W, H)
  const sun = ctx.createRadialGradient(400, 300, 10, 400, 300, 160)
  sun.addColorStop(0, 'rgba(255, 230, 160, 0.95)')
  sun.addColorStop(0.3, 'rgba(255, 190, 110, 0.55)')
  sun.addColorStop(1, 'rgba(255, 150, 80, 0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 100, 800, 400)
  mesa(ctx, 250, 'rgba(110, 45, 50, 0.75)', 1.3)
  mesa(ctx, 300, 'rgba(80, 34, 38, 0.9)', 4.1)
  ctx.fillStyle = '#3a1c22'
  for (const [x, w, h] of [
    [40, 46, 34],
    [92, 30, 48],
    [126, 54, 30],
    [650, 40, 40],
    [694, 58, 28],
    [756, 36, 46],
  ]) {
    ctx.fillRect(x, 330 - h, w, h + 40)
    ctx.fillRect(x - 3, 330 - h - 4, w + 6, 5)
  }
  ctx.fillRect(612, 270, 4, 60)
  ctx.fillRect(632, 270, 4, 60)
  ctx.beginPath()
  ctx.ellipse(624, 266, 18, 14, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = vgrad(ctx, 320, H, [
    [0, '#8a5634'],
    [1, '#4a2c1d'],
  ])
  ctx.fillRect(0, 330, W, H - 330)
  cactus(ctx, 60, 470, 1.2)
  cactus(ctx, 730, 440, 1)
  cactus(ctx, 110, 520, 0.8)
  cactus(ctx, 690, 530, 1.4)
  ctx.fillStyle = 'rgba(255, 220, 170, 0.12)'
  for (let i = 0; i < 260; i++) {
    const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * W
    const y = 340 + (Math.cos(i * 37.3) * 0.5 + 0.5) * 200
    ctx.fillRect(x, y, 2, 1)
  }
}

function cactus(ctx: Ctx, x: number, y: number, s: number) {
  ctx.fillStyle = '#2c3a24'
  ctx.beginPath()
  ctx.roundRect(x - 7 * s, y - 70 * s, 14 * s, 70 * s, 7 * s)
  ctx.roundRect(x - 24 * s, y - 46 * s, 10 * s, 26 * s, 5 * s)
  ctx.roundRect(x - 24 * s, y - 26 * s, 20 * s, 9 * s, 4 * s)
  ctx.roundRect(x + 14 * s, y - 56 * s, 10 * s, 30 * s, 5 * s)
  ctx.roundRect(x + 4 * s, y - 32 * s, 20 * s, 9 * s, 4 * s)
  ctx.fill()
}

/** Si Mata Elang, babak 1: jalan utama kota koboi dengan deretan fasad kayu. */
function streetStatic(ctx: Ctx) {
  ctx.fillStyle = vgrad(ctx, 0, 230, [
    [0, '#2e1a36'],
    [0.45, '#a8463a'],
    [0.8, '#f08c3e'],
    [1, '#f7c46c'],
  ])
  ctx.fillRect(0, 0, W, 230)
  glow(ctx, 620, 150, 120, 'rgba(255, 230, 160, A)', 0.8)
  mesa(ctx, 190, 'rgba(120, 50, 52, 0.7)', 2.2, 0.8)
  ctx.fillStyle = vgrad(ctx, 196, H, [
    [0, '#9a6238'],
    [0.3, '#7a4a2c'],
    [1, '#3e2518'],
  ])
  ctx.fillRect(0, 196, W, H - 196)
  // Deretan bangunan dengan bagian depan palsu (false front)
  const signs = ['HOTEL', 'BANK', 'SALOON', 'SHERIFF', 'TOKO', 'POS', 'BARBER', 'KANDANG']
  const colors = ['#5a2e22', '#6b3a26', '#4e2a20', '#734430', '#5e3424']
  let x = -12
  let i = 0
  while (x < W) {
    const w = 80 + hash(i * 3) * 38
    const top = 104 + hash(i * 5 + 1) * 34
    ctx.fillStyle = colors[i % colors.length]
    ctx.beginPath()
    ctx.moveTo(x, 198)
    ctx.lineTo(x, top + 6)
    ctx.lineTo(x + w * 0.18, top + 6)
    ctx.lineTo(x + w * 0.18, top)
    ctx.lineTo(x + w * 0.82, top)
    ctx.lineTo(x + w * 0.82, top + 6)
    ctx.lineTo(x + w, top + 6)
    ctx.lineTo(x + w, 198)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let yy = top + 12; yy < 196; yy += 6) {
      ctx.moveTo(x, yy)
      ctx.lineTo(x + w, yy)
    }
    ctx.stroke()
    // Papan nama
    ctx.fillStyle = '#e8c48a'
    ctx.beginPath()
    ctx.roundRect(x + w * 0.16, top + 9, w * 0.68, 13, 2)
    ctx.fill()
    ctx.fillStyle = '#4a2416'
    ctx.font = `700 9px ${SIGN_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(signs[i % signs.length], x + w / 2, top + 16)
    // Jendela (sebagian menyala)
    for (const k of [0.22, 0.62]) {
      ctx.fillStyle = hash(i * 11 + k * 10) > 0.45 ? '#ffcf7a' : '#2a1610'
      ctx.fillRect(x + w * k, top + 32, 14, 18)
      ctx.fillStyle = '#3a1c12'
      ctx.fillRect(x + w * k + 6, top + 32, 2, 18)
    }
    // Atap teras dan tiang
    ctx.fillStyle = '#3e2016'
    ctx.fillRect(x, 168, w, 6)
    ctx.fillRect(x + 4, 174, 3, 24)
    ctx.fillRect(x + w - 7, 174, 3, 24)
    ctx.fillStyle = '#24120c'
    ctx.fillRect(x + w * 0.42, 176, 16, 22)
    x += w + 3
    i++
  }
  // Trotoar papan
  ctx.fillStyle = '#5a3820'
  ctx.fillRect(0, 196, W, 8)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
  for (let px = 0; px < W; px += 16) ctx.fillRect(px, 196, 1, 8)
  // Bekas roda gerobak di jalan
  ctx.strokeStyle = 'rgba(50, 28, 16, 0.35)'
  ctx.lineWidth = 3
  for (const y of [232, 246, 500, 516]) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let px = 0; px <= W; px += 40) ctx.lineTo(px, y + Math.sin(px * 0.02 + y) * 3)
    ctx.stroke()
  }
  // Kiri: palung air dan tiang tambat kuda
  ctx.fillStyle = '#4a2c18'
  ctx.fillRect(28, 300, 112, 30)
  ctx.fillStyle = '#4f7a8a'
  ctx.fillRect(33, 303, 102, 7)
  ctx.fillStyle = '#3a2214'
  ctx.fillRect(40, 380, 6, 40)
  ctx.fillRect(140, 380, 6, 40)
  ctx.fillRect(36, 384, 114, 6)
  // Poster buronan di kiri
  ctx.save()
  ctx.translate(70, 230)
  ctx.rotate(-0.05)
  ctx.fillStyle = '#e8d2a2'
  ctx.fillRect(0, 0, 50, 58)
  ctx.fillStyle = '#5a2e1a'
  ctx.font = `700 9px ${SIGN_FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('DICARI', 25, 10)
  ctx.fillStyle = '#7a5a3a'
  ctx.beginPath()
  ctx.arc(25, 30, 11, 0, TAU)
  ctx.fill()
  ctx.fillRect(10, 46, 30, 3)
  ctx.restore()
  // Kanan: tong dan roda gerobak bersandar
  barrel(ctx, 660, 262, 30, 40)
  barrel(ctx, 696, 276, 30, 40)
  ctx.strokeStyle = '#3a2214'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(720, 420, 34, 0, TAU)
  ctx.stroke()
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let k = 0; k < 8; k++) {
    ctx.moveTo(720, 420)
    ctx.lineTo(720 + Math.cos((k * TAU) / 8) * 34, 420 + Math.sin((k * TAU) / 8) * 34)
  }
  ctx.stroke()
  cactus(ctx, 100, 525, 0.7)
}

/** Si Mata Elang, babak 2: interior saloon (rak botol, meja bar, piano, kertas dinding anggur). */
function saloonStatic(ctx: Ctx) {
  ctx.fillStyle = vgrad(ctx, 0, H, [
    [0, '#3c121b'],
    [1, '#240a10'],
  ])
  ctx.fillRect(0, 0, W, H)
  // Kertas dinding bergaris dengan motif belah ketupat
  ctx.fillStyle = 'rgba(240, 200, 110, 0.05)'
  for (let x = 0; x < W; x += 28) ctx.fillRect(x, 0, 10, 360)
  ctx.fillStyle = 'rgba(240, 200, 110, 0.07)'
  for (let x = 14; x < W; x += 28) {
    for (let y = 14; y < 350; y += 28) {
      ctx.beginPath()
      ctx.moveTo(x + 5, y)
      ctx.lineTo(x + 10, y + 5)
      ctx.lineTo(x + 5, y + 10)
      ctx.lineTo(x, y + 5)
      ctx.fill()
    }
  }
  // Panel kayu bawah (wainscot) dan lantai
  ctx.fillStyle = vgrad(ctx, 356, 470, [
    [0, '#4a2a18'],
    [1, '#2a170e'],
  ])
  ctx.fillRect(0, 356, W, 114)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.lineWidth = 2
  for (let x = 8; x < W; x += 62) ctx.strokeRect(x, 370, 50, 86)
  ctx.fillStyle = '#7a5226'
  ctx.fillRect(0, 352, W, 6)
  ctx.fillStyle = vgrad(ctx, 470, H, [
    [0, '#3a2214'],
    [1, '#1e110a'],
  ])
  ctx.fillRect(0, 470, W, H - 470)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  for (let y = 482; y < H; y += 14) ctx.fillRect(0, y, W, 1)
  // Cermin besar di tengah, rak botol di kiri-kanannya
  ctx.fillStyle = '#5a3a1a'
  ctx.fillRect(318, 86, 164, 70)
  const glass = ctx.createLinearGradient(322, 90, 478, 152)
  glass.addColorStop(0, '#2a3036')
  glass.addColorStop(0.45, '#4a5560')
  glass.addColorStop(0.5, '#6a7884')
  glass.addColorStop(0.55, '#3a444c')
  glass.addColorStop(1, '#22282c')
  ctx.fillStyle = glass
  ctx.fillRect(324, 92, 152, 58)
  ctx.strokeStyle = '#c99a4b'
  ctx.lineWidth = 2
  ctx.strokeRect(321, 89, 158, 64)
  const bottleColors = ['#2f5a32', '#8a5a1a', '#5a2a14', '#3a4a5a', '#7a2a2a']
  for (const [x0, x1] of [
    [110, 312],
    [488, 690],
  ]) {
    for (const shelfY of [118, 150]) {
      ctx.fillStyle = '#5a3418'
      ctx.fillRect(x0, shelfY, x1 - x0, 5)
      for (let x = x0 + 6; x < x1 - 8; x += 13) {
        const n = Math.floor(hash(x * 3 + shelfY) * 100)
        if (n % 5 === 0) continue
        const h = 16 + (n % 9)
        ctx.fillStyle = bottleColors[n % bottleColors.length]
        ctx.fillRect(x, shelfY - h + 6, 8, h - 6)
        ctx.fillRect(x + 2.5, shelfY - h, 3, 7)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
        ctx.fillRect(x + 1, shelfY - h + 8, 1.5, h - 10)
      }
    }
  }
  // Meja bar panjang
  ctx.fillStyle = vgrad(ctx, 160, 200, [
    [0, '#8a5630'],
    [0.2, '#5a3418'],
    [1, '#341c0e'],
  ])
  ctx.fillRect(96, 162, 608, 40)
  ctx.fillStyle = '#a06a3a'
  ctx.fillRect(92, 158, 616, 6)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.lineWidth = 1.5
  for (let x = 110; x < 700; x += 44) ctx.strokeRect(x, 170, 36, 26)
  ctx.fillStyle = '#c99a4b'
  ctx.fillRect(96, 196, 608, 2)
  // Kiri: piano tegak
  ctx.fillStyle = '#2a140c'
  ctx.fillRect(18, 250, 132, 92)
  ctx.fillStyle = '#3e2012'
  ctx.fillRect(24, 256, 120, 40)
  ctx.fillStyle = '#efe6d2'
  ctx.fillRect(18, 300, 132, 10)
  ctx.fillStyle = '#1a0c06'
  for (let x = 22; x < 148; x += 7) if ((x / 7) % 7 !== 2 && (x / 7) % 7 !== 6) ctx.fillRect(x + 4, 300, 3, 6)
  ctx.fillStyle = '#c99a4b'
  ctx.fillRect(40, 236, 4, 14)
  ctx.fillRect(124, 236, 4, 14)
  // Kanan: meja poker bundar dan poster
  ctx.fillStyle = '#e8d2a2'
  ctx.fillRect(668, 214, 56, 64)
  ctx.fillStyle = '#5a2e1a'
  ctx.font = `700 9px ${SIGN_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('DICARI', 696, 226)
  ctx.font = `700 7px ${SIGN_FONT}`
  ctx.fillText('HIDUP/MATI', 696, 268)
  ctx.fillStyle = '#7a5a3a'
  ctx.beginPath()
  ctx.arc(696, 246, 11, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#3a2012'
  ctx.beginPath()
  ctx.ellipse(712, 420, 64, 22, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#1f4a2a'
  ctx.beginPath()
  ctx.ellipse(712, 416, 56, 17, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#efe6d2'
  for (const [dx, a] of [
    [-20, -0.3],
    [-6, 0.2],
    [14, -0.1],
  ]) {
    ctx.save()
    ctx.translate(712 + dx, 414)
    ctx.rotate(a)
    ctx.fillRect(-5, -7, 10, 14)
    ctx.restore()
  }
  ctx.fillStyle = '#c0322b'
  ctx.beginPath()
  ctx.arc(738, 418, 4, 0, TAU)
  ctx.arc(746, 412, 4, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#2a140a'
  ctx.fillRect(700, 438, 5, 30)
  ctx.fillRect(718, 438, 5, 30)
  // Lampu dinding (cahaya dianimasikan)
  for (const x of [80, 720]) {
    ctx.fillStyle = '#c99a4b'
    ctx.fillRect(x - 2, 196, 4, 18)
    ctx.fillRect(x - 8, 210, 16, 4)
  }
}

/** Si Mata Elang, babak 3: langit senja di atas kereta (bukit dan tiang telegraf bergulir dianimasikan). */
function trainSkyStatic(ctx: Ctx) {
  ctx.fillStyle = vgrad(ctx, 0, 300, [
    [0, '#1c1030'],
    [0.4, '#5a2448'],
    [0.75, '#d8643a'],
    [1, '#f4a85a'],
  ])
  ctx.fillRect(0, 0, W, 300)
  stars(ctx, 50, 120, 9)
  glow(ctx, 560, 250, 150, 'rgba(255, 200, 120, A)', 0.85)
  ctx.fillStyle = '#ffd890'
  ctx.beginPath()
  ctx.arc(560, 250, 26, 0, TAU)
  ctx.fill()
  ctx.fillStyle = vgrad(ctx, 280, H, [
    [0, '#5a3424'],
    [1, '#2a1610'],
  ])
  ctx.fillRect(0, 280, W, H - 280)
}

function farHillsTile(ctx: Ctx) {
  hills(ctx, 250, 'rgba(90, 36, 64, 0.85)', 70, 1.1)
}

function nearHillsTile(ctx: Ctx) {
  hills(ctx, 288, '#3a1c2a', 40, 2.7)
}

/** Bocah Dinamit, babak 1: tambang tua (dinding batu, rangka kayu, lori di rel). */
function mineStatic(ctx: Ctx) {
  ctx.fillStyle = vgrad(ctx, 0, H, [
    [0, '#120c0a'],
    [0.5, '#2a1c14'],
    [1, '#1a110c'],
  ])
  ctx.fillRect(0, 0, W, H)
  rockWall(ctx, 'rgba(70, 48, 34, A)', 21)
  // Lapisan batuan
  ctx.strokeStyle = 'rgba(110, 76, 50, 0.22)'
  ctx.lineWidth = 3
  for (const y of [140, 236, 330, 420]) {
    ctx.beginPath()
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.015 + y) * 10)
    ctx.stroke()
  }
  // Urat bijih emas
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(227, 180, 80, ${0.25 + hash(i * 13) * 0.5})`
    ctx.fillRect(hash(i * 2 + 5) * W, 90 + hash(i * 7 + 1) * 440, 2, 2)
  }
  // Mulut terowongan kiri & kanan
  tunnel(ctx, 22, 214, 112, 140)
  tunnel(ctx, 664, 226, 112, 140)
  // Rangka kayu penyangga
  timberFrame(ctx)
  // Rel lori di bawah
  rails(ctx, 506, '#7a706a', '#3a2618')
  // Lori berisi bijih di kiri bawah
  ctx.fillStyle = '#4a4440'
  ctx.beginPath()
  ctx.moveTo(18, 456)
  ctx.lineTo(132, 456)
  ctx.lineTo(122, 500)
  ctx.lineTo(28, 500)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#2a2420'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#6a5030'
  for (const [x, r] of [
    [44, 12],
    [66, 15],
    [92, 13],
    [112, 10],
  ]) {
    ctx.beginPath()
    ctx.arc(x, 456, r, Math.PI, 0)
    ctx.fill()
  }
  ctx.fillStyle = '#e3b450'
  ctx.fillRect(62, 446, 3, 3)
  ctx.fillRect(90, 449, 3, 3)
  ctx.fillStyle = '#1a1614'
  for (const x of [44, 106]) {
    ctx.beginPath()
    ctx.arc(x, 504, 8, 0, TAU)
    ctx.fill()
  }
  crate(ctx, 690, 424, 54, 44, 'TNT')
  crate(ctx, 706, 384, 40, 40)
  // Beliung bersandar
  ctx.strokeStyle = '#5a3a20'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(660, 470)
  ctx.lineTo(642, 404)
  ctx.stroke()
  ctx.strokeStyle = '#8a8480'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(642, 420, 20, -2.4, -0.9)
  ctx.stroke()
}

function rockWall(ctx: Ctx, color: string, seed: number) {
  for (let i = 0; i < 150; i++) {
    const cx = hash(seed + i) * W
    const cy = hash(seed + i * 3 + 2) * H
    const r = 14 + hash(seed + i * 5) * 28
    const points = 5 + Math.floor(hash(seed + i * 9) * 3)
    ctx.fillStyle = color.replace('A', String(0.2 + hash(seed + i * 11) * 0.35))
    ctx.beginPath()
    for (let k = 0; k < points; k++) {
      const a = (k / points) * TAU
      const rr = r * (0.7 + hash(seed + i * 17 + k) * 0.4)
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.75)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
}

function tunnel(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#050303'
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y + w / 2)
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0)
  ctx.lineTo(x + w, y + h)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#5a3820'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(x + 4, y + h)
  ctx.lineTo(x + 4, y + 26)
  ctx.lineTo(x + w - 4, y + 26)
  ctx.lineTo(x + w - 4, y + h)
  ctx.stroke()
}

function timberFrame(ctx: Ctx) {
  const wood = (x: number, y: number, w: number, h: number) => {
    const g = w > h ? ctx.createLinearGradient(0, y, 0, y + h) : ctx.createLinearGradient(x, 0, x + w, 0)
    g.addColorStop(0, '#4a2e18')
    g.addColorStop(0.5, '#7a5230')
    g.addColorStop(1, '#3a2212')
    ctx.fillStyle = g
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    if (w > h) for (let k = x + 30; k < x + w; k += 90) ctx.fillRect(k, y + 3, 30, 1)
    else for (let k = y + 30; k < y + h; k += 90) ctx.fillRect(x + 3, k, 1, 30)
  }
  wood(0, 86, W, 16)
  wood(146, 86, 18, H - 86)
  wood(636, 86, 18, H - 86)
  // Penopang miring dari tiang ke balok atas
  for (const [x, dir] of [
    [164, 1],
    [636, -1],
  ]) {
    ctx.save()
    ctx.translate(x, 150)
    ctx.rotate(-dir * 0.8)
    wood(dir > 0 ? 0 : -66, -5, 66, 10)
    ctx.restore()
  }
  ctx.fillStyle = '#2a2420'
  for (const x of [150, 160, 640, 650]) {
    ctx.beginPath()
    ctx.arc(x, 94, 2, 0, TAU)
    ctx.fill()
  }
}

/** Bocah Dinamit, babak 2: gudang mesiu (dinding papan, tumpukan peti TNT dan tong mesiu). */
function powderStatic(ctx: Ctx) {
  ctx.fillStyle = vgrad(ctx, 0, H, [
    [0, '#2a190f'],
    [0.6, '#3a2416'],
    [1, '#1f130b'],
  ])
  ctx.fillRect(0, 0, W, H)
  for (let x = 0; x < W; x += 26) {
    ctx.fillStyle = `rgba(${hash(x) > 0.5 ? '90, 58, 34' : '60, 38, 22'}, 0.5)`
    ctx.fillRect(x, 0, 24, 470)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.fillRect(x + 24, 0, 2, 470)
    if (hash(x * 7) > 0.6) {
      ctx.fillStyle = 'rgba(30, 18, 10, 0.6)'
      ctx.beginPath()
      ctx.ellipse(x + 12, 120 + hash(x * 3) * 300, 3, 5, 0, 0, TAU)
      ctx.fill()
    }
  }
  // Balok melintang
  ctx.fillStyle = '#4a2c18'
  ctx.fillRect(0, 86, W, 12)
  ctx.fillRect(0, 352, W, 10)
  // Jendela tinggi berjeruji dengan cahaya bulan
  ctx.fillStyle = '#0e1622'
  ctx.fillRect(34, 112, 84, 60)
  ctx.fillStyle = 'rgba(200, 220, 255, 0.25)'
  ctx.fillRect(38, 116, 76, 52)
  ctx.fillStyle = '#2a190f'
  for (let x = 46; x < 118; x += 14) ctx.fillRect(x, 112, 3, 60)
  ctx.fillStyle = 'rgba(190, 210, 255, 0.05)'
  ctx.beginPath()
  ctx.moveTo(34, 172)
  ctx.lineTo(118, 172)
  ctx.lineTo(220, 470)
  ctx.lineTo(90, 470)
  ctx.closePath()
  ctx.fill()
  // Papan peringatan
  ctx.fillStyle = '#8a1e16'
  ctx.fillRect(640, 112, 140, 34)
  ctx.strokeStyle = '#e8d2a2'
  ctx.lineWidth = 2
  ctx.strokeRect(644, 116, 132, 26)
  ctx.fillStyle = '#f4e4c0'
  ctx.font = `700 10px ${SIGN_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('DILARANG MEROKOK!', 710, 129)
  // Lantai
  ctx.fillStyle = vgrad(ctx, 470, H, [
    [0, '#3a2414'],
    [1, '#1a0f08'],
  ])
  ctx.fillRect(0, 470, W, H - 470)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  for (let y = 484; y < H; y += 13) ctx.fillRect(0, y, W, 1)
  // Kiri: tumpukan peti TNT
  crate(ctx, 10, 410, 50, 46, 'TNT')
  crate(ctx, 62, 410, 50, 46, 'TNT')
  crate(ctx, 114, 420, 44, 36)
  crate(ctx, 34, 364, 50, 46, 'TNT')
  crate(ctx, 86, 370, 44, 40)
  crate(ctx, 56, 322, 46, 42, 'TNT')
  // Kanan: piramida tong mesiu
  for (const [x, y, label] of [
    [648, 418, 'MESIU'],
    [694, 418, ''],
    [740, 418, 'MESIU'],
    [671, 372, ''],
    [717, 372, 'MESIU'],
    [694, 326, ''],
  ] as [number, number, string][])
    barrel(ctx, x, y, 42, 46, label || undefined)
  // Gulungan sumbu di dinding kiri
  ctx.strokeStyle = '#c0a070'
  ctx.lineWidth = 2
  for (let k = 0; k < 4; k++) {
    ctx.beginPath()
    ctx.ellipse(100, 238, 14 - k * 3, 9 - k * 2, 0, 0, TAU)
    ctx.stroke()
  }
  ctx.fillStyle = '#5a3418'
  ctx.fillRect(97, 220, 6, 8)
}

/** Bocah Dinamit, babak 3: tambang runtuh terbakar (balok patah, retakan bara; api dianimasikan). */
function infernoStatic(ctx: Ctx) {
  ctx.fillStyle = vgrad(ctx, 0, H, [
    [0, '#0c0403'],
    [0.5, '#2a0c06'],
    [1, '#4a1608'],
  ])
  ctx.fillRect(0, 0, W, H)
  rockWall(ctx, 'rgba(50, 20, 14, A)', 57)
  // Retakan bara di dinding
  ctx.lineCap = 'round'
  for (let i = 0; i < 16; i++) {
    let x = hash(i * 31) * W
    let y = 100 + hash(i * 17) * 420
    ctx.strokeStyle = `rgba(255, ${90 + Math.floor(hash(i) * 60)}, 30, 0.45)`
    ctx.lineWidth = 1.5 + hash(i * 5) * 1.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let k = 0; k < 5; k++) {
      x += (hash(i * 7 + k) - 0.5) * 50
      y += 8 + hash(i * 3 + k) * 18
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  // Balok penyangga patah (siluet dengan tepi membara)
  for (const [x1, y1, x2, y2, w] of [
    [-20, 128, 250, 92, 16],
    [560, 84, 820, 150, 18],
    [40, 520, 170, 250, 14],
    [770, 540, 650, 270, 14],
  ]) {
    ctx.strokeStyle = '#140806'
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255, 110, 40, 0.45)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x1, y1 - w / 2)
    ctx.lineTo(x2, y2 - w / 2)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
  // Puing di bawah
  ctx.fillStyle = '#120605'
  for (let i = 0; i < 26; i++) {
    const x = hash(i * 41) * W
    const r = 10 + hash(i * 3) * 22
    ctx.beginPath()
    ctx.ellipse(x, 528, r, r * 0.6, 0, Math.PI, 0)
    ctx.fill()
  }
}

/** Hantu Masinis, babak 1: stasiun mati di malam purnama. */
function stationStatic(ctx: Ctx) {
  ctx.fillStyle = vgrad(ctx, 0, 300, [
    [0, '#05080f'],
    [0.6, '#0e1a2c'],
    [1, '#1c3040'],
  ])
  ctx.fillRect(0, 0, W, 300)
  stars(ctx, 110, 260, 3)
  moon(ctx, 712, 132, 28, 'rgba(190, 230, 220, A)')
  mesa(ctx, 250, '#0c1620', 3.3, 0.6)
  ctx.fillStyle = vgrad(ctx, 200, H, [
    [0, '#16202a'],
    [1, '#0a1016'],
  ])
  ctx.fillRect(0, 200, W, H - 200)
  // Kanopi peron dengan hiasan renda kayu
  ctx.fillStyle = '#1a2430'
  ctx.beginPath()
  ctx.moveTo(84, 120)
  ctx.lineTo(110, 98)
  ctx.lineTo(690, 98)
  ctx.lineTo(716, 120)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#121a24'
  for (let x = 90; x < 712; x += 14) {
    ctx.beginPath()
    ctx.moveTo(x, 120)
    ctx.lineTo(x + 7, 128)
    ctx.lineTo(x + 14, 120)
    ctx.fill()
  }
  ctx.fillStyle = '#22303e'
  for (const x of [128, 262, 538, 672]) ctx.fillRect(x - 3, 120, 6, 82)
  // Papan nama stasiun yang miring
  ctx.save()
  ctx.translate(196, 140)
  ctx.rotate(0.08)
  ctx.fillStyle = '#d8dcc8'
  ctx.fillRect(-46, -10, 92, 20)
  ctx.strokeStyle = '#2a3440'
  ctx.lineWidth = 2
  ctx.strokeRect(-46, -10, 92, 20)
  ctx.fillStyle = '#1a2430'
  ctx.font = `700 10px ${SIGN_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('STASIUN SUNYI', 0, 1)
  ctx.restore()
  // Bangunan kiri dengan jam besar (jarum dianimasikan)
  ctx.fillStyle = '#141c26'
  ctx.fillRect(0, 150, 132, 200)
  ctx.beginPath()
  ctx.moveTo(-6, 152)
  ctx.lineTo(66, 120)
  ctx.lineTo(138, 152)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#0a0e14'
  for (const [x, y] of [
    [16, 230],
    [76, 230],
    [16, 290],
    [76, 290],
  ])
    ctx.fillRect(x, y, 30, 36)
  ctx.fillStyle = '#d8e0c8'
  ctx.beginPath()
  ctx.arc(66, 186, 22, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#2a3440'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#2a3440'
  for (let k = 0; k < 12; k++) ctx.fillRect(66 + Math.cos((k * TAU) / 12) * 17 - 1, 186 + Math.sin((k * TAU) / 12) * 17 - 1, 2, 2)
  // Pohon mati di kanan
  ctx.strokeStyle = '#0a1016'
  ctx.lineCap = 'round'
  const branch = (x: number, y: number, a: number, len: number, w: number) => {
    if (len < 8) return
    const x2 = x + Math.cos(a) * len
    const y2 = y + Math.sin(a) * len
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    branch(x2, y2, a - 0.45, len * 0.68, w * 0.65)
    branch(x2, y2, a + 0.38, len * 0.62, w * 0.65)
  }
  branch(728, 360, -Math.PI / 2, 70, 9)
  ctx.lineCap = 'butt'
  // Bangku dan koper tertinggal
  ctx.fillStyle = '#2a2420'
  ctx.fillRect(650, 412, 110, 6)
  ctx.fillRect(656, 418, 5, 18)
  ctx.fillRect(748, 418, 5, 18)
  ctx.fillRect(650, 394, 110, 4)
  ctx.fillStyle = '#4a2a1a'
  ctx.fillRect(30, 420, 44, 30)
  ctx.fillStyle = '#c99a4b'
  ctx.fillRect(46, 414, 12, 6)
  rails(ctx, 506, '#5a6a78', '#1e1814')
}

/** Hantu Masinis, babak 2: jembatan kayu di atas jurang berkabut. */
function bridgeStatic(ctx: Ctx) {
  ctx.fillStyle = vgrad(ctx, 0, H, [
    [0, '#04070c'],
    [0.4, '#0b1622'],
    [1, '#0e1a22'],
  ])
  ctx.fillRect(0, 0, W, H)
  stars(ctx, 90, 220, 17)
  moon(ctx, 110, 130, 24, 'rgba(180, 220, 230, A)')
  // Tebing jurang kiri & kanan
  const cliff = (points: [number, number][]) => {
    ctx.fillStyle = '#0c1216'
    ctx.beginPath()
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(80, 110, 120, 0.35)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  cliff([
    [0, 170],
    [60, 184],
    [96, 230],
    [120, 300],
    [112, 380],
    [140, 460],
    [124, H],
    [0, H],
  ])
  cliff([
    [W, 160],
    [736, 178],
    [700, 226],
    [690, 310],
    [668, 390],
    [684, 470],
    [670, H],
    [W, H],
  ])
  // Rangka jembatan (trestle) menurun ke dalam jurang
  ctx.strokeStyle = '#2a241e'
  ctx.lineWidth = 5
  for (let x = 160; x <= 660; x += 70) {
    ctx.beginPath()
    ctx.moveTo(x, 470)
    ctx.lineTo(x - 10, H)
    ctx.stroke()
  }
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let x = 160; x < 660; x += 70) {
    ctx.moveTo(x, 480)
    ctx.lineTo(x + 70, H)
    ctx.moveTo(x + 70, 480)
    ctx.lineTo(x, H)
  }
  ctx.stroke()
  // Dek jembatan yang menyambung ke tebing
  for (const [x, w] of [
    [90, 96],
    [614, 96],
  ]) {
    ctx.fillStyle = '#231e19'
    ctx.fillRect(x, 248, w, 220)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    for (let px = x; px < x + w; px += 16) ctx.fillRect(px, 248, 2, 220)
    ctx.fillStyle = '#3a3026'
    ctx.fillRect(x, 240, w, 6)
    ctx.fillRect(x, 468, w, 6)
    for (let px = x + 6; px < x + w; px += 30) {
      ctx.fillRect(px, 226, 5, 20)
      ctx.fillRect(px, 468, 5, 20)
    }
  }
}

/** Hantu Masinis, babak 3: kereta hantu terakhir di bawah cahaya aurora (kereta dianimasikan). */
function ghostTrainStatic(ctx: Ctx) {
  ctx.fillStyle = vgrad(ctx, 0, H, [
    [0, '#020806'],
    [0.35, '#06201a'],
    [0.6, '#0b2a26'],
    [1, '#060e0c'],
  ])
  ctx.fillRect(0, 0, W, H)
  stars(ctx, 100, 240, 29)
  // Tirai aurora
  for (let k = 0; k < 4; k++) {
    const g = ctx.createLinearGradient(0, 80, 0, 210)
    g.addColorStop(0, `rgba(${k % 2 ? '120, 255, 200' : '90, 200, 255'}, 0)`)
    g.addColorStop(0.5, `rgba(${k % 2 ? '120, 255, 200' : '90, 200, 255'}, 0.12)`)
    g.addColorStop(1, 'rgba(120, 255, 200, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, 210)
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 90 + k * 10 + Math.sin(x * 0.012 + k * 1.7) * 26)
    for (let x = W; x >= 0; x -= 20) ctx.lineTo(x, 200 + Math.sin(x * 0.01 + k) * 12)
    ctx.closePath()
    ctx.fill()
  }
  mesa(ctx, 232, '#04100c', 5.2, 0.7)
  ctx.fillStyle = vgrad(ctx, 210, H, [
    [0, '#0a1614'],
    [1, '#040908'],
  ])
  ctx.fillRect(0, 210, W, H - 210)
  // Rel kereta hantu di belakang (kereta lewat di atasnya)
  ctx.fillStyle = '#1a2a26'
  ctx.fillRect(0, 198, W, 3)
  // Kiri: tiang sinyal tua; kanan: menara air runtuh
  ctx.fillStyle = '#0e1816'
  ctx.fillRect(66, 236, 6, 200)
  ctx.fillRect(52, 236, 34, 46)
  ctx.fillStyle = '#16302a'
  ctx.beginPath()
  ctx.arc(69, 250, 7, 0, TAU)
  ctx.arc(69, 270, 7, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#0e1816'
  ctx.fillRect(680, 330, 6, 130)
  ctx.fillRect(740, 330, 6, 130)
  ctx.save()
  ctx.translate(712, 300)
  ctx.rotate(0.12)
  ctx.fillRect(-46, -40, 92, 60)
  ctx.restore()
  ctx.strokeStyle = '#0e1816'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(683, 360)
  ctx.lineTo(743, 440)
  ctx.moveTo(743, 360)
  ctx.lineTo(683, 440)
  ctx.stroke()
  rails(ctx, 506, '#2a4a42', '#0e1412')
}

const STATIC: Record<SceneId, (ctx: Ctx) => void> = {
  desert: desertStatic,
  street: streetStatic,
  saloon: saloonStatic,
  trainroof: trainSkyStatic,
  mine: mineStatic,
  powder: powderStatic,
  inferno: infernoStatic,
  station: stationStatic,
  bridge: bridgeStatic,
  ghosttrain: ghostTrainStatic,
}

// ---------- Lapisan animasi (di belakang arena) ----------

function animate(ctx: Ctx, scene: SceneId, clock: number) {
  switch (scene) {
    case 'desert':
      return
    case 'street': {
      // Elang berputar di langit
      const x = ((clock * 46) % (W + 240)) - 120
      const y = 98 + Math.sin(clock * 0.9) * 8
      const flap = Math.sin(clock * 7) * 5
      ctx.strokeStyle = 'rgba(40, 18, 20, 0.85)'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x - 14, y - flap)
      ctx.quadraticCurveTo(x - 6, y - 4, x, y)
      ctx.quadraticCurveTo(x + 6, y - 4, x + 14, y - flap)
      ctx.stroke()
      ctx.lineCap = 'butt'
      sideDust(ctx, clock, 'rgba(232, 196, 138, A)')
      return
    }
    case 'saloon': {
      const flicker = 0.75 + 0.15 * Math.sin(clock * 13) * Math.sin(clock * 7.3) + 0.1 * Math.sin(clock * 3)
      for (const x of [80, 720]) {
        glow(ctx, x, 204, 90, 'rgba(255, 190, 100, A)', 0.35 * flicker)
        ctx.fillStyle = `rgba(255, 220, 150, ${0.8 * flicker})`
        ctx.beginPath()
        ctx.ellipse(x, 202, 5, 8, 0, 0, TAU)
        ctx.fill()
      }
      // Kabut asap cerutu
      for (let i = 0; i < 4; i++) {
        const x = ((clock * (8 + i * 3) + i * 230) % (W + 300)) - 150
        ctx.fillStyle = 'rgba(220, 200, 190, 0.05)'
        ctx.beginPath()
        ctx.ellipse(x, 120 + i * 30, 120, 18, 0, 0, TAU)
        ctx.fill()
      }
      return
    }
    case 'trainroof':
      trainScenery(ctx, clock)
      return
    case 'mine': {
      lantern(ctx, 155, 214, clock, 'rgba(255, 180, 90, A)', '#ffcf7a')
      lantern(ctx, 645, 214, clock + 1.3, 'rgba(255, 180, 90, A)', '#ffcf7a')
      fallingDust(ctx, clock, 'rgba(200, 170, 130, A)')
      return
    }
    case 'powder': {
      for (const [px, phase] of [
        [210, 0],
        [590, 1.7],
      ]) {
        const a = Math.sin(clock * 1.3 + phase) * 0.16
        const lx = px + Math.sin(a) * 70
        const ly = 98 + Math.cos(a) * 70
        ctx.strokeStyle = '#1a100a'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(px, 98)
        ctx.lineTo(lx, ly)
        ctx.stroke()
        lantern(ctx, lx, ly + 8, clock + phase, 'rgba(255, 180, 90, A)', '#ffcf7a')
      }
      // Percikan api merambat di jejak mesiu (lantai bawah)
      ctx.fillStyle = 'rgba(20, 12, 8, 0.7)'
      for (let x = 0; x < W; x += 6) ctx.fillRect(x, 512 + Math.sin(x * 0.03) * 6, 4, 2)
      const sx = (clock * 70) % (W + 60)
      const sy = 512 + Math.sin(sx * 0.03) * 6
      glow(ctx, sx, sy, 20, 'rgba(255, 170, 60, A)', 0.8)
      ctx.fillStyle = '#fff1b0'
      ctx.beginPath()
      ctx.arc(sx, sy, 2.5, 0, TAU)
      ctx.fill()
      fallingDust(ctx, clock, 'rgba(230, 200, 160, A)')
      return
    }
    case 'inferno': {
      const pulse = 0.5 + 0.5 * Math.sin(clock * 2.2)
      glow(ctx, 400, 600, 420, 'rgba(255, 80, 20, A)', 0.25 + pulse * 0.12)
      flames(ctx, clock)
      embers(ctx, clock)
      return
    }
    case 'station': {
      // Jarum jam berputar mundur
      const hand = (len: number, a: number, w: number) => {
        ctx.strokeStyle = '#1a2430'
        ctx.lineWidth = w
        ctx.beginPath()
        ctx.moveTo(66, 186)
        ctx.lineTo(66 + Math.cos(a) * len, 186 + Math.sin(a) * len)
        ctx.stroke()
      }
      hand(15, -clock * 1.2, 1.5)
      hand(10, -clock * 0.1, 2.5)
      for (const [x, phase] of [
        [158, 0],
        [642, 2.1],
      ]) {
        ctx.fillStyle = '#1e2a34'
        ctx.fillRect(x - 2, 230, 4, 110)
        lantern(ctx, x, 222, clock + phase, 'rgba(120, 255, 200, A)', '#c8ffe8')
      }
      wisps(ctx, clock)
      clouds(ctx, clock)
      return
    }
    case 'bridge': {
      for (const [x, phase] of [
        [96, 0],
        [704, 1.1],
      ]) lantern(ctx, x, 218, clock + phase, 'rgba(120, 255, 200, A)', '#c8ffe8')
      fog(ctx, clock)
      return
    }
    case 'ghosttrain':
      phantomTrain(ctx, clock)
      railGlow(ctx, clock)
      wisps(ctx, clock)
      return
  }
}

function sideDust(ctx: Ctx, clock: number, color: string) {
  for (let i = 0; i < 6; i++) {
    const x = ((clock * (18 + i * 4) + i * 170) % (W + 200)) - 100
    const y = 220 + i * 52
    ctx.fillStyle = color.replace('A', '0.07')
    ctx.beginPath()
    ctx.ellipse(x, y, 60, 9, 0, 0, TAU)
    ctx.fill()
  }
}

function fallingDust(ctx: Ctx, clock: number, color: string) {
  for (let i = 0; i < 40; i++) {
    const x = hash(i * 3.1) * W + Math.sin(clock + i) * 4
    const y = (clock * (12 + hash(i) * 20) + hash(i * 7) * H) % H
    ctx.fillStyle = color.replace('A', String(0.15 + hash(i * 5) * 0.3))
    ctx.fillRect(x, y, 1.5, 1.5)
  }
}

function lantern(ctx: Ctx, x: number, y: number, clock: number, glowColor: string, flame: string) {
  const flicker = 0.75 + 0.15 * Math.sin(clock * 11) * Math.sin(clock * 6.7) + 0.1 * Math.sin(clock * 2.3)
  glow(ctx, x, y, 70, glowColor, 0.4 * flicker)
  ctx.fillStyle = '#1a1410'
  ctx.fillRect(x - 7, y - 12, 14, 3)
  ctx.fillRect(x - 6, y + 9, 12, 3)
  ctx.strokeStyle = '#1a1410'
  ctx.lineWidth = 1.5
  ctx.strokeRect(x - 6, y - 9, 12, 18)
  ctx.fillStyle = flame
  ctx.globalAlpha = 0.6 + 0.4 * flicker
  ctx.beginPath()
  ctx.ellipse(x, y + 1, 3.5, 6, 0, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1
}

function trainScenery(ctx: Ctx, clock: number) {
  const far = layer('tile-far', farHillsTile)
  const near = layer('tile-near', nearHillsTile)
  const scroll = (img: HTMLCanvasElement, speed: number) => {
    const off = (clock * speed) % W
    ctx.drawImage(img, -off, 0, W, H)
    ctx.drawImage(img, W - off, 0, W, H)
  }
  scroll(far, 14)
  scroll(near, 40)
  // Garis cepat tanah di bawah
  ctx.strokeStyle = 'rgba(255, 210, 160, 0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < 18; i++) {
    const y = 300 + hash(i * 3) * 240
    const x = W - ((clock * (380 + hash(i) * 200) + hash(i * 9) * W) % (W + 120))
    ctx.moveTo(x, y)
    ctx.lineTo(x + 50 + hash(i * 2) * 40, y)
  }
  ctx.stroke()
  // Tiang telegraf dengan kabel
  const gap = 300
  const off = (clock * 260) % gap
  ctx.strokeStyle = '#1e1014'
  ctx.fillStyle = '#1e1014'
  for (let x = -off; x < W + gap; x += gap) {
    ctx.fillRect(x - 3, 140, 6, 200)
    ctx.fillRect(x - 18, 150, 36, 4)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x - 16, 152)
    ctx.quadraticCurveTo(x + gap / 2, 172, x + gap - 16, 152)
    ctx.moveTo(x + 16, 152)
    ctx.quadraticCurveTo(x + gap / 2, 176, x + gap + 16, 152)
    ctx.stroke()
  }
  // Asap lokomotif melayang ke belakang
  for (let i = 0; i < 9; i++) {
    const age = ((clock * 0.35 + i / 9) % 1)
    const x = W + 40 - age * (W + 160)
    const y = 118 - age * 30 + Math.sin(i * 2.1 + clock) * 6
    ctx.fillStyle = `rgba(60, 44, 58, ${0.35 * (1 - age)})`
    ctx.beginPath()
    ctx.arc(x, y, 14 + age * 34, 0, TAU)
    ctx.fill()
  }
  // Sisi gerbong di bawah atap (arena)
  const top = ARENA_BOTTOM + 6
  ctx.fillStyle = '#5a1f1a'
  ctx.fillRect(ARENA.x - 14, top, ARENA.w + 28, 30)
  ctx.fillStyle = '#3a120e'
  ctx.fillRect(ARENA.x - 14, top + 24, ARENA.w + 28, 6)
  ctx.fillStyle = '#ffcf7a'
  for (let x = ARENA.x + 6; x < ARENA_RIGHT - 20; x += 46) ctx.fillRect(x, top + 6, 24, 12)
  ctx.fillStyle = '#c99a4b'
  ctx.fillRect(ARENA.x - 14, top, ARENA.w + 28, 2)
  // Roda berputar
  for (const wx of [ARENA.x + 30, ARENA.x + 70, ARENA_RIGHT - 70, ARENA_RIGHT - 30]) {
    ctx.fillStyle = '#16100e'
    ctx.beginPath()
    ctx.arc(wx, top + 40, 14, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = '#5a5250'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let k = 0; k < 3; k++) {
      const a = -clock * 14 + (k * Math.PI) / 3
      ctx.moveTo(wx + Math.cos(a) * 12, top + 40 + Math.sin(a) * 12)
      ctx.lineTo(wx - Math.cos(a) * 12, top + 40 - Math.sin(a) * 12)
    }
    ctx.stroke()
  }
}

function flames(ctx: Ctx, clock: number) {
  const tongue = (x: number, base: number, h: number, w: number) => {
    const g = ctx.createLinearGradient(0, base - h, 0, base)
    g.addColorStop(0, 'rgba(255, 210, 90, 0)')
    g.addColorStop(0.4, 'rgba(255, 120, 30, 0.45)')
    g.addColorStop(1, 'rgba(160, 30, 10, 0.6)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x - w, base)
    ctx.quadraticCurveTo(x - w * 0.6, base - h * 0.5, x + Math.sin(clock * 4 + x) * w * 0.4, base - h)
    ctx.quadraticCurveTo(x + w * 0.6, base - h * 0.5, x + w, base)
    ctx.closePath()
    ctx.fill()
  }
  for (let i = 0; i < 26; i++) {
    const x = i * 32 + 8
    tongue(x, H + 4, 26 + 16 * Math.abs(Math.sin(clock * 3.4 + i * 1.7)), 16)
  }
  for (let i = 0; i < 6; i++) {
    const h = 30 + 18 * Math.abs(Math.sin(clock * 3 + i * 2.3))
    tongue(30 + i * 22, 470 - i * 12, h, 12)
    tongue(W - 30 - i * 22, 470 - i * 12, h, 12)
  }
}

function embers(ctx: Ctx, clock: number) {
  for (let i = 0; i < 46; i++) {
    const speed = 25 + hash(i * 3) * 45
    const y = H - ((clock * speed + hash(i * 11) * H) % H)
    const x = hash(i * 7) * W + Math.sin(clock * 1.5 + i) * 12
    const life = y / H
    ctx.fillStyle = `rgba(255, ${140 + Math.floor(hash(i) * 80)}, 60, ${0.25 + life * 0.55})`
    ctx.fillRect(x, y, 2, 2)
  }
}

function wisps(ctx: Ctx, clock: number) {
  for (let i = 0; i < 10; i++) {
    const t = (clock * 0.12 + hash(i * 5)) % 1
    const side = i % 2 ? W - 20 - hash(i) * 150 : 20 + hash(i) * 150
    const x = side + Math.sin(clock * 0.9 + i * 2) * 14
    const y = H - t * (H - 90)
    const alpha = Math.sin(t * Math.PI) * 0.18
    glow(ctx, x, y, 18, 'rgba(150, 255, 215, A)', alpha)
  }
}

function clouds(ctx: Ctx, clock: number) {
  for (let i = 0; i < 3; i++) {
    const x = ((clock * (6 + i * 3) + i * 300) % (W + 300)) - 150
    ctx.fillStyle = 'rgba(30, 44, 58, 0.55)'
    ctx.beginPath()
    ctx.ellipse(x, 140 + i * 22, 90, 10, 0, 0, TAU)
    ctx.ellipse(x + 40, 134 + i * 22, 50, 9, 0, 0, TAU)
    ctx.fill()
  }
}

function fog(ctx: Ctx, clock: number) {
  for (let i = 0; i < 12; i++) {
    const speed = 10 + (i % 4) * 7
    const x = ((clock * speed * (i % 2 ? 1 : -1) + i * 160) % (W + 400) + W + 400) % (W + 400) - 200
    const y = 180 + (i * 37) % 360
    // Gumpalan kabut lembut: lingkaran bergradasi yang dipipihkan
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1, 0.18)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 150)
    g.addColorStop(0, `rgba(170, 200, 210, ${0.12 + (i % 3) * 0.05})`)
    g.addColorStop(1, 'rgba(170, 200, 210, 0)')
    ctx.fillStyle = g
    ctx.fillRect(-150, -150, 300, 300)
    ctx.restore()
  }
}

function phantomTrain(ctx: Ctx, clock: number) {
  const length = 640
  const x0 = W + 60 - ((clock * 80) % (W + length + 200))
  const base = 198
  ctx.save()
  ctx.globalAlpha = 0.6
  const body = '#1d4a42'
  // Lokomotif
  ctx.fillStyle = body
  ctx.fillRect(x0, base - 44, 110, 36)
  ctx.fillRect(x0 + 70, base - 66, 40, 22)
  ctx.fillRect(x0 + 16, base - 62, 14, 18)
  ctx.beginPath()
  ctx.moveTo(x0, base - 8)
  ctx.lineTo(x0 - 18, base)
  ctx.lineTo(x0, base)
  ctx.fill()
  ctx.fillStyle = 'rgba(180, 255, 220, 0.9)'
  ctx.fillRect(x0 + 80, base - 60, 20, 10)
  glow(ctx, x0 - 4, base - 30, 40, 'rgba(180, 255, 220, A)', 0.6)
  // Gerbong
  for (let k = 0; k < 3; k++) {
    const cx = x0 + 124 + k * 172
    ctx.fillStyle = body
    ctx.fillRect(cx, base - 50, 160, 42)
    ctx.fillRect(cx - 4, base - 54, 168, 5)
    ctx.fillStyle = `rgba(160, 255, 210, ${0.5 + 0.3 * Math.sin(clock * 3 + k)})`
    for (let w = 0; w < 5; w++) ctx.fillRect(cx + 12 + w * 30, base - 42, 16, 14)
  }
  ctx.fillStyle = '#0c201c'
  for (let k = 0; k < 14; k++) {
    ctx.beginPath()
    ctx.arc(x0 + 16 + k * 46, base - 4, 7, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
  // Uap hantu dari cerobong
  for (let i = 0; i < 7; i++) {
    const age = (clock * 0.6 + i / 7) % 1
    glow(ctx, x0 + 23 + age * 120, base - 70 - age * 36, 12 + age * 22, 'rgba(160, 255, 215, A)', 0.3 * (1 - age))
  }
}

function railGlow(ctx: Ctx, clock: number) {
  for (let i = 0; i < 4; i++) {
    const x = (clock * 160 + i * 220) % (W + 80) - 40
    const g = ctx.createLinearGradient(x - 60, 0, x + 10, 0)
    g.addColorStop(0, 'rgba(120, 255, 200, 0)')
    g.addColorStop(1, 'rgba(120, 255, 200, 0.7)')
    ctx.fillStyle = g
    ctx.fillRect(x - 60, 506, 70, 3)
    ctx.fillRect(x - 60, 521, 70, 3)
  }
}

// ---------- Transisi antarbabak ----------

let shown: SceneId | null = null
let previous: SceneId | null = null
let changedAt = 0
const FADE = 0.9

function track(s: GameState, clock: number): { scene: SceneId; from: SceneId | null; k: number } {
  const scene = sceneOf(s)
  if (scene !== shown) {
    previous = shown
    shown = scene
    changedAt = clock
  }
  const k = Math.min(1, (clock - changedAt) / FADE)
  return { scene, from: k < 1 ? previous : null, k }
}

function paintBackdrop(ctx: Ctx, scene: SceneId, clock: number) {
  ctx.drawImage(layer(`bg-${scene}`, STATIC[scene]), 0, 0, W, H)
  animate(ctx, scene, clock)
}

/** Latar penuh layar untuk babak sekarang, memudar dari latar babak sebelumnya. */
export function drawBackdrop(ctx: Ctx, s: GameState, clock: number) {
  const { scene, from, k } = track(s, clock)
  if (from) {
    paintBackdrop(ctx, from, clock)
    ctx.globalAlpha = k
  }
  paintBackdrop(ctx, scene, clock)
  ctx.globalAlpha = 1
}

// ---------- Lantai arena ----------

function floorBase(ctx: Ctx, top: string, bottom: string) {
  const { x, y, w, h } = ARENA
  ctx.fillStyle = vgrad(ctx, y, y + h, [
    [0, top],
    [1, bottom],
  ])
  ctx.fillRect(x, y, w, h)
}

function planks(ctx: Ctx, color: string, size = 24) {
  const { x, y, w, h } = ARENA
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let py = y + size; py < y + h; py += size) {
    ctx.moveTo(x, py)
    ctx.lineTo(x + w, py)
  }
  for (let row = 0; row < h / size; row++) {
    const offset = (row * 97) % 140
    for (let px = x + offset; px < x + w; px += 140) {
      ctx.moveTo(px, y + row * size)
      ctx.lineTo(px, y + row * size + size)
    }
  }
  ctx.stroke()
}

function paintFloor(ctx: Ctx, scene: SceneId, s: GameState, clock: number) {
  const { x, y, w, h } = ARENA
  switch (scene) {
    case 'desert':
      floorBase(ctx, '#2c201b', '#1d1512')
      planks(ctx, 'rgba(255, 220, 170, 0.05)')
      ctx.fillStyle = 'rgba(232, 196, 138, 0.05)'
      for (let i = 0; i < 5; i++) {
        const dx = ((clock * 12 + i * 160) % (w + 120)) - 60
        ctx.beginPath()
        ctx.ellipse(x + dx, y + 40 + i * 52, 70, 10, 0, 0, TAU)
        ctx.fill()
      }
      return
    case 'street': {
      floorBase(ctx, '#33231a', '#20160f')
      ctx.strokeStyle = 'rgba(10, 5, 2, 0.3)'
      ctx.lineWidth = 4
      for (const ry of [0.3, 0.38, 0.66, 0.74]) {
        ctx.beginPath()
        for (let px = x; px <= x + w; px += 20) ctx.lineTo(px, y + h * ry + Math.sin(px * 0.03 + ry * 10) * 3)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(255, 220, 170, 0.06)'
      for (let i = 0; i < 90; i++) ctx.fillRect(x + hash(i * 3) * w, y + hash(i * 5 + 2) * h, 2, 2)
      ctx.fillStyle = 'rgba(232, 196, 138, 0.05)'
      for (let i = 0; i < 4; i++) {
        const dx = ((clock * 22 + i * 190) % (w + 160)) - 80
        ctx.beginPath()
        ctx.ellipse(x + dx, y + 50 + i * 64, 80, 9, 0, 0, TAU)
        ctx.fill()
      }
      return
    }
    case 'saloon':
      floorBase(ctx, '#2a1712', '#1b0e0b')
      planks(ctx, 'rgba(255, 210, 160, 0.05)', 18)
      ctx.fillStyle = 'rgba(122, 36, 51, 0.3)'
      ctx.fillRect(x + 40, y + 30, w - 80, h - 60)
      ctx.strokeStyle = 'rgba(240, 200, 110, 0.22)'
      ctx.lineWidth = 2
      ctx.strokeRect(x + 46, y + 36, w - 92, h - 72)
      ctx.lineWidth = 1
      ctx.strokeRect(x + 52, y + 42, w - 104, h - 84)
      ctx.fillStyle = 'rgba(240, 200, 110, 0.06)'
      for (let px = x + 80; px < x + w - 60; px += 40) {
        for (let py = y + 70; py < y + h - 50; py += 40) {
          ctx.beginPath()
          ctx.moveTo(px, py - 8)
          ctx.lineTo(px + 8, py)
          ctx.lineTo(px, py + 8)
          ctx.lineTo(px - 8, py)
          ctx.fill()
        }
      }
      return
    case 'trainroof': {
      floorBase(ctx, '#262a33', '#1a1d24')
      const scroll = s.scroll ?? 0
      ctx.strokeStyle = 'rgba(200, 210, 225, 0.12)'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let px = x - (scroll % 30); px < x + w; px += 30) {
        ctx.moveTo(px, y)
        ctx.lineTo(px, y + h)
      }
      ctx.stroke()
      ctx.fillStyle = 'rgba(200, 210, 225, 0.18)'
      for (let px = x - (scroll % 30) + 15; px < x + w; px += 30) {
        ctx.fillRect(px - 1, y + 10, 2, 2)
        ctx.fillRect(px - 1, y + h - 12, 2, 2)
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
      ctx.fillRect(x, y + h / 2 - 3, w, 6)
      return
    }
    case 'mine': {
      floorBase(ctx, '#251b15', '#17100c')
      for (let i = 0; i < 46; i++) {
        const cx = x + hash(i * 3 + 1) * w
        const cy = y + hash(i * 7 + 2) * h
        ctx.fillStyle = `rgba(120, 90, 66, ${0.06 + hash(i) * 0.06})`
        ctx.beginPath()
        ctx.ellipse(cx, cy, 14 + hash(i * 5) * 16, 9 + hash(i * 9) * 8, hash(i * 2) * 3, 0, TAU)
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(200, 170, 130, 0.08)'
      for (let i = 0; i < 120; i++) ctx.fillRect(x + hash(i * 13) * w, y + hash(i * 17) * h, 1.5, 1.5)
      // Rel lori tua yang samar melintasi lantai
      ctx.fillStyle = 'rgba(60, 40, 26, 0.5)'
      for (let px = x; px < x + w; px += 20) ctx.fillRect(px, y + h * 0.72 - 6, 8, 24)
      ctx.fillStyle = 'rgba(140, 130, 120, 0.14)'
      ctx.fillRect(x, y + h * 0.72 - 2, w, 2)
      ctx.fillRect(x, y + h * 0.72 + 12, w, 2)
      return
    }
    case 'powder': {
      floorBase(ctx, '#2b1d13', '#1c120c')
      planks(ctx, 'rgba(255, 210, 160, 0.05)', 20)
      ctx.fillStyle = 'rgba(255, 210, 160, 0.07)'
      for (let py = y + 10; py < y + h; py += 20) for (let px = x + 30 + ((py * 7) % 60); px < x + w; px += 140) ctx.fillRect(px, py, 2, 2)
      // Tumpahan mesiu hitam
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.setLineDash([2, 5])
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        for (let px = x; px <= x + w; px += 14) ctx.lineTo(px, y + 60 + i * 90 + Math.sin(px * 0.02 + i * 2) * 18)
        ctx.stroke()
      }
      ctx.setLineDash([])
      ctx.lineCap = 'butt'
      return
    }
    case 'inferno': {
      floorBase(ctx, '#1e0e0a', '#110705')
      ctx.lineCap = 'round'
      for (let i = 0; i < 9; i++) {
        let px = x + hash(i * 19) * w
        let py = y + hash(i * 23) * h
        ctx.strokeStyle = `rgba(255, 110, 40, ${0.08 + 0.06 * Math.sin(clock * 2 + i)})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(px, py)
        for (let k = 0; k < 4; k++) {
          px += (hash(i * 5 + k) - 0.5) * 60
          py += (hash(i * 3 + k) - 0.5) * 40
          ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      ctx.lineCap = 'butt'
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      for (let i = 0; i < 8; i++) {
        ctx.beginPath()
        ctx.ellipse(x + hash(i * 29) * w, y + hash(i * 31) * h, 30, 14, 0, 0, TAU)
        ctx.fill()
      }
      return
    }
    case 'station': {
      floorBase(ctx, '#1b2430', '#111820')
      ctx.strokeStyle = 'rgba(180, 210, 230, 0.06)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let py = y + 36; py < y + h; py += 36) {
        ctx.moveTo(x, py)
        ctx.lineTo(x + w, py)
      }
      for (let row = 0; row * 36 < h; row++) {
        for (let px = x + (row % 2 ? 22 : 0); px < x + w; px += 44) {
          ctx.moveTo(px, y + row * 36)
          ctx.lineTo(px, y + row * 36 + 36)
        }
      }
      ctx.stroke()
      ctx.fillStyle = 'rgba(190, 230, 220, 0.05)'
      for (const [px, py, r] of [
        [0.25, 0.4, 40],
        [0.7, 0.7, 50],
      ]) {
        ctx.beginPath()
        ctx.ellipse(x + w * px, y + h * py, r, r * 0.3, 0, 0, TAU)
        ctx.fill()
      }
      // Garis aman kuning di tepi peron
      ctx.strokeStyle = 'rgba(230, 200, 90, 0.18)'
      ctx.lineWidth = 4
      ctx.setLineDash([12, 8])
      ctx.beginPath()
      ctx.moveTo(x, y + h - 10)
      ctx.lineTo(x + w, y + h - 10)
      ctx.stroke()
      ctx.setLineDash([])
      return
    }
    case 'bridge': {
      floorBase(ctx, '#0a1016', '#070b10')
      // Kabut bergerak terlihat di sela papan
      for (let i = 0; i < 4; i++) {
        const fx = ((clock * (14 + i * 6) + i * 140) % (w + 200)) - 100
        ctx.fillStyle = 'rgba(160, 200, 210, 0.12)'
        ctx.beginPath()
        ctx.ellipse(x + fx, y + 40 + i * 70, 110, 26, 0, 0, TAU)
        ctx.fill()
      }
      for (let px = x; px < x + w; px += 24) {
        const shade = 27 + Math.floor(hash(px) * 8)
        ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 10})`
        ctx.fillRect(px, y, 21, h)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
        ctx.fillRect(px + 15, y, 1, h)
      }
      ctx.fillStyle = 'rgba(200, 220, 230, 0.12)'
      for (let px = x + 10; px < x + w; px += 24) {
        ctx.fillRect(px, y + 14, 2, 2)
        ctx.fillRect(px, y + h - 16, 2, 2)
      }
      return
    }
    case 'ghosttrain': {
      floorBase(ctx, '#142024', '#0c1517')
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let px = x + 55; px < x + w; px += 55) {
        ctx.moveTo(px, y)
        ctx.lineTo(px, y + h)
      }
      for (let py = y + 48; py < y + h; py += 48) {
        ctx.moveTo(x, py)
        ctx.lineTo(x + w, py)
      }
      ctx.stroke()
      ctx.fillStyle = 'rgba(160, 200, 200, 0.15)'
      for (let px = x + 55; px < x + w; px += 55) for (let py = y + 48; py < y + h; py += 48) ctx.fillRect(px - 5, py - 5, 2, 2)
      // Denyut cahaya hantu menjalar di sambungan pelat
      const k = (clock * 0.5) % 1
      ctx.strokeStyle = `rgba(120, 255, 200, ${0.18 * (1 - k)})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, y + h * k)
      ctx.lineTo(x + w, y + h * k)
      ctx.stroke()
      return
    }
  }
}

/** Lantai arena sesuai babak; memudar bersama latar saat babak berganti. */
export function drawFloor(ctx: Ctx, s: GameState, clock: number) {
  const scene = sceneOf(s)
  const k = shown === scene ? Math.min(1, (clock - changedAt) / FADE) : 1
  ctx.save()
  ctx.beginPath()
  ctx.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h)
  ctx.clip()
  if (k < 1 && previous) {
    paintFloor(ctx, previous, s, clock)
    ctx.globalAlpha = k
  }
  paintFloor(ctx, scene, s, clock)
  ctx.restore()
}

// ---------- Pagar dan tiang sudut ----------

export function drawBorder(ctx: Ctx, s: GameState, clock: number, star: (x: number, y: number) => void) {
  const scene = sceneOf(s)
  const { x, y, w, h } = ARENA
  const bx = x - 2
  const by = y - 2
  const bw = w + 4
  const bh = h + 4
  const corners: [number, number][] = [
    [bx, by],
    [bx + bw, by],
    [bx, by + bh],
    [bx + bw, by + bh],
  ]
  ctx.save()
  switch (scene) {
    case 'desert':
    case 'street':
      ctx.lineWidth = 5
      ctx.strokeStyle = '#c99a5b'
      ctx.strokeRect(bx, by, bw, bh)
      ctx.strokeStyle = 'rgba(90, 55, 25, 0.8)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([3, 5])
      ctx.strokeRect(bx, by, bw, bh)
      break
    case 'saloon':
      ctx.lineWidth = 6
      ctx.strokeStyle = '#a87a32'
      ctx.strokeRect(bx, by, bw, bh)
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#f4d48a'
      ctx.strokeRect(bx - 1.5, by - 1.5, bw + 3, bh + 3)
      break
    case 'trainroof':
    case 'ghosttrain': {
      ctx.lineWidth = 6
      ctx.strokeStyle = scene === 'trainroof' ? '#5d6470' : '#2a3a3e'
      ctx.strokeRect(bx, by, bw, bh)
      ctx.fillStyle = scene === 'trainroof' ? '#a8b0ba' : '#5a7a78'
      for (let px = bx + 12; px < bx + bw; px += 24) {
        ctx.fillRect(px - 1, by - 1, 2, 2)
        ctx.fillRect(px - 1, by + bh - 1, 2, 2)
      }
      for (let py = by + 12; py < by + bh; py += 24) {
        ctx.fillRect(bx - 1, py - 1, 2, 2)
        ctx.fillRect(bx + bw - 1, py - 1, 2, 2)
      }
      if (scene === 'ghosttrain') {
        ctx.lineWidth = 1.5
        ctx.strokeStyle = `rgba(120, 255, 200, ${0.35 + 0.2 * Math.sin(clock * 2.5)})`
        ctx.strokeRect(bx + 4, by + 4, bw - 8, bh - 8)
      }
      break
    }
    case 'mine':
    case 'powder':
      ctx.lineWidth = 8
      ctx.strokeStyle = scene === 'mine' ? '#5a3820' : '#6b4626'
      ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2)
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
      ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2)
      ctx.fillStyle = '#2a2420'
      for (let px = bx + 30; px < bx + bw; px += 60) {
        ctx.beginPath()
        ctx.arc(px, by - 1, 1.8, 0, TAU)
        ctx.arc(px, by + bh + 1, 1.8, 0, TAU)
        ctx.fill()
      }
      break
    case 'inferno':
      ctx.lineWidth = 7
      ctx.strokeStyle = '#2a1510'
      ctx.strokeRect(bx, by, bw, bh)
      ctx.lineWidth = 2
      ctx.strokeStyle = `rgba(255, 110, 40, ${0.45 + 0.25 * Math.sin(clock * 3)})`
      ctx.setLineDash([18, 10, 6, 10])
      ctx.lineDashOffset = -clock * 6
      ctx.strokeRect(bx, by, bw, bh)
      break
    case 'station':
      ctx.lineWidth = 4
      ctx.strokeStyle = '#3c4a58'
      ctx.strokeRect(bx, by, bw, bh)
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#6a7a88'
      ctx.strokeRect(bx - 4, by - 4, bw + 8, bh + 8)
      ctx.fillStyle = '#3c4a58'
      for (let px = bx + 16; px < bx + bw; px += 32) {
        ctx.fillRect(px - 1, by - 8, 2, 6)
        ctx.fillRect(px - 1, by + bh + 2, 2, 6)
      }
      break
    case 'bridge':
      ctx.lineWidth = 6
      ctx.strokeStyle = '#3a3026'
      ctx.strokeRect(bx, by, bw, bh)
      ctx.strokeStyle = 'rgba(160, 140, 110, 0.6)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + 6)
      break
  }
  ctx.restore()
  for (const [cx, cy] of corners) post(ctx, scene, cx, cy, clock, star)
}

function post(ctx: Ctx, scene: SceneId, cx: number, cy: number, clock: number, star: (x: number, y: number) => void) {
  const wood = (top: string, mid: string, bottom: string, w = 14, h = 24) => {
    const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0)
    g.addColorStop(0, top)
    g.addColorStop(0.5, mid)
    g.addColorStop(1, bottom)
    ctx.fillStyle = g
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h)
  }
  const flicker = 0.75 + 0.25 * Math.sin(clock * 9 + cx * 0.1 + cy)
  switch (scene) {
    case 'desert':
    case 'street':
      wood('#5a3820', '#8d5f36', '#4a2e1a')
      star(cx, cy - 14)
      return
    case 'saloon':
      wood('#6b4320', '#a06a3a', '#4a2e1a', 12, 22)
      ctx.fillStyle = '#e3b450'
      ctx.beginPath()
      ctx.arc(cx, cy - 13, 6, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.beginPath()
      ctx.arc(cx - 2, cy - 15, 2, 0, TAU)
      ctx.fill()
      return
    case 'trainroof':
      ctx.fillStyle = '#3a3e46'
      ctx.fillRect(cx - 6, cy - 10, 12, 20)
      glow(ctx, cx, cy - 12, 16, 'rgba(255, 70, 50, A)', 0.5 * flicker)
      ctx.fillStyle = '#ff5a3c'
      ctx.beginPath()
      ctx.arc(cx, cy - 12, 4, 0, TAU)
      ctx.fill()
      return
    case 'ghosttrain':
      ctx.fillStyle = '#1e2c2e'
      ctx.fillRect(cx - 6, cy - 10, 12, 20)
      glow(ctx, cx, cy - 12, 18, 'rgba(120, 255, 200, A)', 0.55 * flicker)
      ctx.fillStyle = '#b8ffd8'
      ctx.beginPath()
      ctx.arc(cx, cy - 12, 4, 0, TAU)
      ctx.fill()
      return
    case 'mine':
    case 'bridge':
    case 'station': {
      const ghost = scene !== 'mine'
      wood(ghost ? '#2a2e34' : '#4a2e18', ghost ? '#46505a' : '#7a5230', ghost ? '#22262c' : '#3a2212', 12, 22)
      lantern(ctx, cx, cy - 18, clock + cx * 0.01, ghost ? 'rgba(120, 255, 200, A)' : 'rgba(255, 180, 90, A)', ghost ? '#c8ffe8' : '#ffcf7a')
      return
    }
    case 'powder':
      ctx.fillStyle = '#b0281c'
      for (const dx of [-6, 0, 6]) ctx.fillRect(cx + dx - 3, cy - 12, 6, 22)
      ctx.fillStyle = '#2a1a12'
      ctx.fillRect(cx - 10, cy - 4, 20, 3)
      ctx.strokeStyle = '#c0a070'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(cx, cy - 12)
      ctx.quadraticCurveTo(cx + 6, cy - 18, cx + 3, cy - 22)
      ctx.stroke()
      return
    case 'inferno': {
      wood('#1a0c08', '#3a1a10', '#140806', 14, 22)
      const h = 14 + 6 * Math.abs(Math.sin(clock * 6 + cx))
      const g = ctx.createLinearGradient(0, cy - 12 - h, 0, cy - 10)
      g.addColorStop(0, 'rgba(255, 220, 120, 0)')
      g.addColorStop(0.5, 'rgba(255, 140, 40, 0.85)')
      g.addColorStop(1, 'rgba(200, 50, 20, 0.9)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(cx - 7, cy - 10)
      ctx.quadraticCurveTo(cx - 4, cy - 10 - h * 0.6, cx + Math.sin(clock * 5) * 3, cy - 10 - h)
      ctx.quadraticCurveTo(cx + 4, cy - 10 - h * 0.6, cx + 7, cy - 10)
      ctx.closePath()
      ctx.fill()
      return
    }
  }
}
