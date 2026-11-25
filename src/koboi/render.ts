import { ARENA, BOSS, DASH, PATTERN_NAMES, PLAYER, WORLD } from './config'
import { ARENA_BOTTOM, ARENA_RIGHT, edgePoint, type Edge, type GameState, type Hazard, type Shot } from './state'

/**
 * Menggambar KOBOI ke kanvas (dunia 800 × 540). Gaya ilustrasi datar bergradasi dengan palet gurun:
 * pasir, jingga terbakar, cokelat debu, emas pudar, merah anggur, dan arang. Semua bentuk dibuat dari
 * kanvas, tanpa file gambar. Pemain dan bahaya dibedakan lewat bentuk, bukan hanya warna.
 */

export interface RenderOptions {
  shake: boolean
  reduceFlash: boolean
  debug: boolean
}

export const FONT = '"Rye", Georgia, serif'
export const UI_FONT = '"Space Grotesk", system-ui, sans-serif'

const COLOR = {
  sand: '#e8c48a',
  ember: '#e0702f',
  dust: '#9c6b43',
  gold: '#e3b450',
  wine: '#7a2433',
  coal: '#231a17',
  cream: '#fff1d6',
  danger: '#ff5a3c',
  safe: '#9be07a',
}

// ---------- Latar ----------

let backdrop: HTMLCanvasElement | null = null

/** Langit senja, mesa, kota di kejauhan, dan kaktus; digambar sekali lalu disalin tiap frame. */
function background(): HTMLCanvasElement {
  if (backdrop) return backdrop
  const canvas = document.createElement('canvas')
  canvas.width = WORLD.width
  canvas.height = WORLD.height
  const ctx = canvas.getContext('2d')!
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.height)
  sky.addColorStop(0, '#2b1630')
  sky.addColorStop(0.35, '#8a2f3a')
  sky.addColorStop(0.55, '#e0702f')
  sky.addColorStop(0.7, '#f2b25c')
  sky.addColorStop(1, '#6b4128')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, WORLD.width, WORLD.height)
  // Matahari terbenam
  const sun = ctx.createRadialGradient(400, 300, 10, 400, 300, 160)
  sun.addColorStop(0, 'rgba(255, 230, 160, 0.95)')
  sun.addColorStop(0.3, 'rgba(255, 190, 110, 0.55)')
  sun.addColorStop(1, 'rgba(255, 150, 80, 0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 100, 800, 400)
  // Mesa berlapis
  const mesa = (y: number, color: string, seed: number) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, WORLD.height)
    let x = 0
    let h = y
    while (x <= WORLD.width) {
      const r = Math.abs(Math.sin(x * 0.013 + seed) * Math.cos(x * 0.007 + seed * 2))
      const flat = r > 0.55
      h = flat ? y - 40 - r * 30 : y - r * 18
      ctx.lineTo(x, h)
      x += flat ? 50 : 18
      ctx.lineTo(x, h)
    }
    ctx.lineTo(WORLD.width, WORLD.height)
    ctx.closePath()
    ctx.fill()
  }
  mesa(250, 'rgba(110, 45, 50, 0.75)', 1.3)
  mesa(300, 'rgba(80, 34, 38, 0.9)', 4.1)
  // Kota kecil di kejauhan (siluet), dengan menara air
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
  ctx.ellipse(624, 266, 18, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  // Tanah
  const ground = ctx.createLinearGradient(0, 320, 0, WORLD.height)
  ground.addColorStop(0, '#8a5634')
  ground.addColorStop(1, '#4a2c1d')
  ctx.fillStyle = ground
  ctx.fillRect(0, 330, WORLD.width, WORLD.height - 330)
  // Kaktus saguaro
  const cactus = (x: number, y: number, s: number) => {
    ctx.fillStyle = '#2c3a24'
    ctx.beginPath()
    ctx.roundRect(x - 7 * s, y - 70 * s, 14 * s, 70 * s, 7 * s)
    ctx.roundRect(x - 24 * s, y - 46 * s, 10 * s, 26 * s, 5 * s)
    ctx.roundRect(x - 24 * s, y - 26 * s, 20 * s, 9 * s, 4 * s)
    ctx.roundRect(x + 14 * s, y - 56 * s, 10 * s, 30 * s, 5 * s)
    ctx.roundRect(x + 4 * s, y - 32 * s, 20 * s, 9 * s, 4 * s)
    ctx.fill()
  }
  cactus(60, 470, 1.2)
  cactus(730, 440, 1)
  cactus(110, 520, 0.8)
  cactus(690, 530, 1.4)
  // Butir pasir
  ctx.fillStyle = 'rgba(255, 220, 170, 0.12)'
  for (let i = 0; i < 260; i++) {
    const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * WORLD.width
    const y = 340 + (Math.cos(i * 37.3) * 0.5 + 0.5) * 200
    ctx.fillRect(x, y, 2, 1)
  }
  backdrop = canvas
  return canvas
}

// ---------- Arena ----------

function drawArena(ctx: CanvasRenderingContext2D, s: GameState, clock: number) {
  const { x, y, w, h } = ARENA
  // Bayangan arena dan lantai papan kayu gelap (supaya peluru terang terlihat jelas)
  ctx.fillStyle = 'rgba(20, 10, 8, 0.45)'
  ctx.fillRect(x - 6, y + 8, w + 12, h + 6)
  const floor = ctx.createLinearGradient(0, y, 0, y + h)
  floor.addColorStop(0, '#2c201b')
  floor.addColorStop(1, '#1d1512')
  ctx.fillStyle = floor
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = 'rgba(255, 220, 170, 0.05)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let py = y + 24; py < y + h; py += 24) {
    ctx.moveTo(x, py)
    ctx.lineTo(x + w, py)
  }
  for (let row = 0; row < h / 24; row++) {
    const offset = (row * 97) % 140
    for (let px = x + offset; px < x + w; px += 140) {
      ctx.moveTo(px, y + row * 24)
      ctx.lineTo(px, y + row * 24 + 24)
    }
  }
  ctx.stroke()
  // Debu tipis yang melayang di lantai (atmosfer, tidak menutupi peluru)
  ctx.fillStyle = 'rgba(232, 196, 138, 0.05)'
  for (let i = 0; i < 5; i++) {
    const dx = ((clock * 12 + i * 160) % (w + 120)) - 60
    ctx.beginPath()
    ctx.ellipse(x + dx, y + 40 + i * 52, 70, 10, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Tali pembatas dengan pilin dan tiang kayu di sudut
  ctx.save()
  ctx.lineWidth = 5
  ctx.strokeStyle = '#c99a5b'
  ctx.strokeRect(x - 2, y - 2, w + 4, h + 4)
  ctx.strokeStyle = 'rgba(90, 55, 25, 0.8)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([3, 5])
  ctx.strokeRect(x - 2, y - 2, w + 4, h + 4)
  ctx.restore()
  for (const [cx, cy] of [
    [x - 2, y - 2],
    [x + w + 2, y - 2],
    [x - 2, y + h + 2],
    [x + w + 2, y + h + 2],
  ]) {
    const post = ctx.createLinearGradient(cx - 7, 0, cx + 7, 0)
    post.addColorStop(0, '#5a3820')
    post.addColorStop(0.5, '#8d5f36')
    post.addColorStop(1, '#4a2e1a')
    ctx.fillStyle = post
    ctx.fillRect(cx - 7, cy - 12, 14, 24)
    star(ctx, cx, cy - 14, 7, COLOR.gold)
  }
  if (s.flash > 0) {
    ctx.fillStyle = `rgba(255, 80, 60, ${s.flash * 0.12})`
    ctx.fillRect(x, y, w, h)
  }
}

/** Bintang sheriff lima sudut dengan bulatan di ujungnya. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.16, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ---------- Pemain ----------

function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 16
  ctx.beginPath()
  ctx.moveTo(x, y + 5 * s)
  ctx.bezierCurveTo(x, y + 2 * s, x - 3 * s, y - 2 * s, x - 6 * s, y - 2 * s)
  ctx.bezierCurveTo(x - 10 * s, y - 2 * s, x - 10 * s, y + 3 * s, x - 10 * s, y + 3 * s)
  ctx.bezierCurveTo(x - 10 * s, y + 7 * s, x - 5 * s, y + 11 * s, x, y + 14 * s)
  ctx.bezierCurveTo(x + 5 * s, y + 11 * s, x + 10 * s, y + 7 * s, x + 10 * s, y + 3 * s)
  ctx.bezierCurveTo(x + 10 * s, y + 3 * s, x + 10 * s, y - 2 * s, x + 6 * s, y - 2 * s)
  ctx.bezierCurveTo(x + 3 * s, y - 2 * s, x, y + 2 * s, x, y + 5 * s)
  ctx.closePath()
}

/** Pemain: koboi berkuda (lihat drawRider) dengan inti hitbox bercahaya; berkedip saat kebal. */
function drawPlayer(ctx: CanvasRenderingContext2D, s: GameState, clock: number, options: RenderOptions) {
  const p = s.player
  // Jejak dash: debu dan siluet samar
  for (const point of p.trail) {
    const k = 1 - point.age / 0.25
    ctx.globalAlpha = k * 0.45
    ctx.fillStyle = '#d8a868'
    ctx.beginPath()
    ctx.ellipse(point.x, point.y + 6, 12 * k + 3, 6 * k + 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  if (p.invuln > 0 && Math.floor(clock * (options.reduceFlash ? 6 : 14)) % 2 === 0) ctx.globalAlpha = options.reduceFlash ? 0.55 : 0.25
  drawRider(ctx, p.x, p.y, p.view, p.flip, p.moving || p.dash > 0, clock)
  // Inti yang bisa terkena: bintang emas bercahaya di pelana
  const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 11)
  glow.addColorStop(0, 'rgba(255, 220, 120, 0.85)')
  glow.addColorStop(1, 'rgba(255, 200, 90, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(p.x, p.y, 11, 0, Math.PI * 2)
  ctx.fill()
  star(ctx, p.x, p.y, PLAYER.radius + 1, '#ffe08a')
  ctx.strokeStyle = 'rgba(122, 42, 18, 0.9)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1
}

// ---------- Hazard baru: kereta, banteng, silinder, tong ----------

function drawTrain(ctx: CanvasRenderingContext2D, h: Extract<Hazard, { kind: 'train' }>, clock: number) {
  const horizontal = h.axis === 'x'
  const laneStart = (horizontal ? ARENA.y : ARENA.x) + h.lane - h.band / 2
  ctx.save()
  ctx.beginPath()
  ctx.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h)
  ctx.clip()
  // Rel: dua batang dan bantalan kayu. Saat peringatan, jalurnya berkedip merah dengan lampu sinyal.
  const warn = h.t < h.warn
  const blink = 0.5 + 0.5 * Math.sin(clock * 16)
  ctx.save()
  // Koordinat lokal: u = sepanjang rel, v = melintang (0…band). Jalur tegak = sumbu ditukar.
  if (horizontal) ctx.translate(0, laneStart)
  else ctx.transform(0, 1, 1, 0, laneStart, 0)
  const from = horizontal ? ARENA.x : ARENA.y
  const len = horizontal ? ARENA.w : ARENA.h
  if (warn) {
    ctx.fillStyle = `rgba(255, 70, 50, ${0.12 + blink * 0.16})`
    ctx.fillRect(from, 0, len, h.band)
  }
  ctx.fillStyle = 'rgba(90, 60, 35, 0.8)'
  for (let x = from + 6; x < from + len; x += 18) ctx.fillRect(x, 8, 7, h.band - 16)
  ctx.fillStyle = warn ? `rgba(255, 140, 90, ${0.6 + blink * 0.4})` : '#9aa0a8'
  ctx.fillRect(from, 14, len, 3)
  ctx.fillRect(from, h.band - 17, len, 3)
  if (warn) {
    // Panah arah datangnya kereta
    ctx.fillStyle = COLOR.cream
    const ax = h.dir === 1 ? from + 24 : from + len - 24
    ctx.beginPath()
    ctx.moveTo(ax + h.dir * 12, h.band / 2)
    ctx.lineTo(ax - h.dir * 6, h.band / 2 - 10)
    ctx.lineTo(ax - h.dir * 6, h.band / 2 + 10)
    ctx.closePath()
    ctx.fill()
  } else {
    // Lokomotif hantu (gerbong + lokomotif), menghadap arah gerak
    const pos = h.pos
    const front = h.dir === 1 ? pos + h.length : pos
    const body = ctx.createLinearGradient(0, 4, 0, h.band - 4)
    body.addColorStop(0, '#5b6470')
    body.addColorStop(1, '#262a31')
    ctx.fillStyle = body
    ctx.fillRect(pos, 6, h.length, h.band - 12)
    ctx.fillStyle = '#7a2433'
    ctx.fillRect(pos, h.band / 2 - 3, h.length, 6)
    ctx.fillStyle = 'rgba(160, 230, 255, 0.55)'
    for (let x = pos + 14; x < pos + h.length - 70; x += 34) ctx.fillRect(x, 12, 18, 10)
    ctx.fillStyle = '#1a1c20'
    ctx.beginPath()
    ctx.moveTo(front, 8)
    ctx.lineTo(front + h.dir * 18, h.band / 2)
    ctx.lineTo(front, h.band - 8)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#fff4c0'
    ctx.beginPath()
    ctx.arc(front - h.dir * 6, h.band / 2, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#e3b450'
    for (let x = pos + 20; x < pos + h.length; x += 40) {
      ctx.beginPath()
      ctx.arc(x, h.band - 6, 5, 0, Math.PI * 2)
      ctx.arc(x + 14, h.band - 6, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
  ctx.restore()
}

function drawBull(ctx: CanvasRenderingContext2D, h: Extract<Hazard, { kind: 'bull' }>, clock: number) {
  const warn = h.t < h.warn
  if (warn) {
    // Jalur serudukan: pita bergaris dari banteng melewati arena
    const k = h.t / h.warn
    ctx.save()
    ctx.translate(h.x, h.y)
    ctx.rotate(Math.atan2(h.dy, h.dx))
    ctx.fillStyle = `rgba(255, 80, 50, ${0.1 + k * 0.18})`
    ctx.fillRect(0, -h.r, 900, h.r * 2)
    ctx.strokeStyle = `rgba(255, 150, 90, ${0.5 + k * 0.4})`
    ctx.lineWidth = 2
    ctx.setLineDash([10, 8])
    ctx.lineDashOffset = -clock * 60
    ctx.beginPath()
    ctx.moveTo(0, -h.r)
    ctx.lineTo(900, -h.r)
    ctx.moveTo(0, h.r)
    ctx.lineTo(900, h.r)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }
  // Banteng dari samping, menghadap arah lari (dibalik kalau ke kiri)
  ctx.save()
  ctx.translate(h.x, h.y)
  const left = h.dx < 0
  ctx.scale(left ? -1 : 1, 1)
  const run = warn ? Math.sin(clock * 20) * 0.5 : Math.sin(clock * 24)
  ctx.strokeStyle = '#3a2016'
  ctx.lineWidth = 3.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const [lx, phase] of [
    [-9, run],
    [-4, -run],
    [7, -run],
    [11, run],
  ]) {
    ctx.moveTo(lx, 4)
    ctx.lineTo(lx + phase * 4, 14)
  }
  ctx.stroke()
  const hide = ctx.createLinearGradient(0, -12, 0, 8)
  hide.addColorStop(0, '#7a4a2e')
  hide.addColorStop(1, '#4a2a18')
  ctx.fillStyle = hide
  ctx.beginPath()
  ctx.ellipse(0, 0, 17, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(16, -3, 8, 7, 0.3, 0, Math.PI * 2)
  ctx.fill()
  // Tanduk, mata merah, dan uap dari hidung
  ctx.strokeStyle = '#f1e2c4'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(15, -8)
  ctx.quadraticCurveTo(20, -16, 26, -14)
  ctx.moveTo(13, -8)
  ctx.quadraticCurveTo(10, -16, 6, -16)
  ctx.stroke()
  ctx.fillStyle = '#ff4a2a'
  ctx.beginPath()
  ctx.arc(19, -4, 1.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e3b450'
  ctx.beginPath()
  ctx.arc(23, 1, 1.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSpinner(ctx: CanvasRenderingContext2D, h: Extract<Hazard, { kind: 'spinner' }>, clock: number) {
  const warn = h.t < h.warn
  ctx.save()
  ctx.translate(h.x, h.y)
  if (warn) {
    // Lingkaran peringatan yang menyusut ke silinder
    const k = h.t / h.warn
    ctx.strokeStyle = `rgba(255, 140, 80, ${0.4 + 0.5 * k})`
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.arc(0, 0, 60 - k * 40, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 0.4 + k * 0.6
  }
  // Arah lengan spiral berikutnya (tipis), lalu silinder revolver yang berputar
  ctx.strokeStyle = 'rgba(255, 230, 160, 0.25)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i < h.arms; i++) {
    const a = h.angle + (i * Math.PI * 2) / h.arms
    ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14)
    ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30)
  }
  ctx.stroke()
  ctx.rotate(h.angle)
  const metal = ctx.createRadialGradient(-3, -3, 2, 0, 0, 14)
  metal.addColorStop(0, '#d9dde2')
  metal.addColorStop(1, '#555b63')
  ctx.fillStyle = metal
  ctx.beginPath()
  ctx.arc(0, 0, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1d1f23'
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3
    ctx.beginPath()
    ctx.arc(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 2.6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#e3b450'
  ctx.beginPath()
  ctx.arc(0, 0, 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  void clock
}

function drawBarrel(ctx: CanvasRenderingContext2D, h: Extract<Hazard, { kind: 'barrel' }>, clock: number) {
  const rolling = h.t < h.roll
  const lit = !rolling
  const k = lit ? (h.t - h.roll) / h.fuse : 0
  if (lit) {
    // Cincin bahaya tempat serpihan akan melesat
    ctx.strokeStyle = `rgba(255, 100, 60, ${0.3 + k * 0.5})`
    ctx.lineWidth = 2
    ctx.setLineDash([4, 6])
    ctx.beginPath()
    ctx.arc(h.x, h.y, 26 + k * 10, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.save()
  ctx.translate(h.x, h.y)
  if (rolling) ctx.rotate(h.t * 9)
  else ctx.translate(Math.sin(clock * 60) * k * 1.5, 0)
  const wood = ctx.createLinearGradient(-12, 0, 12, 0)
  wood.addColorStop(0, '#5a3820')
  wood.addColorStop(0.5, '#a06a3a')
  wood.addColorStop(1, '#5a3820')
  ctx.fillStyle = wood
  ctx.beginPath()
  ctx.ellipse(0, 0, 11, 13, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#2c2a28'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-10, -6)
  ctx.lineTo(10, -6)
  ctx.moveTo(-10, 6)
  ctx.lineTo(10, 6)
  ctx.stroke()
  ctx.fillStyle = lit && Math.floor(clock * (6 + k * 14)) % 2 ? '#ff5a3c' : '#f1dcb4'
  ctx.font = `700 9px ${UI_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('XXX', 0, 0.5)
  if (lit) {
    ctx.strokeStyle = '#2a1a10'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, -13)
    ctx.quadraticCurveTo(4, -20, 2, -24 + k * 8)
    ctx.stroke()
    ctx.fillStyle = '#ffe08a'
    ctx.beginPath()
    ctx.arc(2, -24 + k * 8, 2 + Math.random() * 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ---------- Koboi berkuda (pemain) ----------

/**
 * Koboi menunggangi kuda. Hadapnya mengikuti kontrol: samping (kiri/kanan), membelakangi (atas), atau
 * menghadap layar (bawah). Kaki kuda berlari saat bergerak. Bintang emas bercahaya di pelana = titik
 * yang bisa terkena (hitbox).
 */
function drawRider(ctx: CanvasRenderingContext2D, x: number, y: number, view: 'side' | 'up' | 'down', flip: boolean, moving: boolean, clock: number) {
  const gallop = moving ? clock * 16 : 0
  const bob = moving ? Math.abs(Math.sin(gallop)) * -2 : Math.sin(clock * 2) * 0.6
  const horse = '#8a5a34'
  const horseDark = '#5e3a20'
  const mane = '#2e1c12'
  ctx.save()
  ctx.translate(x, y + bob)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Bayangan di tanah
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
  ctx.beginPath()
  ctx.ellipse(0, 15 - bob, view === 'side' ? 17 : 10, 3.5, 0, 0, Math.PI * 2)
  ctx.fill()

  if (view === 'side') {
    if (flip) ctx.scale(-1, 1)
    // Kaki (4), berayun saat berlari
    ctx.strokeStyle = horseDark
    ctx.lineWidth = 3
    const legs: [number, number][] = [
      [-10, Math.sin(gallop)],
      [-6, Math.sin(gallop + Math.PI)],
      [7, Math.sin(gallop + 1.4)],
      [11, Math.sin(gallop + 1.4 + Math.PI)],
    ]
    for (const [lx, swing] of legs) {
      ctx.beginPath()
      ctx.moveTo(lx, 3)
      ctx.lineTo(lx + swing * 4, 9)
      ctx.lineTo(lx + swing * 2.5, 14)
      ctx.stroke()
    }
    // Ekor
    ctx.strokeStyle = mane
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-15, -2)
    ctx.quadraticCurveTo(-22, 2 + Math.sin(gallop) * 2, -21, 9)
    ctx.stroke()
    // Badan dan leher/kepala kuda (menghadap kanan)
    const body = ctx.createLinearGradient(0, -8, 0, 7)
    body.addColorStop(0, '#a8744a')
    body.addColorStop(1, horseDark)
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.ellipse(0, 0, 15, 7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = horse
    ctx.beginPath()
    ctx.moveTo(10, -4)
    ctx.lineTo(17, -14)
    ctx.lineTo(24, -11)
    ctx.lineTo(25, -7)
    ctx.lineTo(19, -7)
    ctx.lineTo(15, 2)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = mane
    ctx.beginPath()
    ctx.moveTo(10, -5)
    ctx.lineTo(16, -15)
    ctx.lineTo(18, -13)
    ctx.lineTo(13, -3)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#1a0f08'
    ctx.beginPath()
    ctx.arc(20, -11, 1, 0, Math.PI * 2)
    ctx.fill()
    // Koboi: kaki di sanggurdi, badan, rompi, topi
    ctx.strokeStyle = '#3b4a66'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-1, -6)
    ctx.lineTo(2, 2)
    ctx.stroke()
    ctx.fillStyle = '#c0322b'
    ctx.beginPath()
    ctx.roundRect(-5, -17, 9, 11, 3)
    ctx.fill()
    ctx.fillStyle = '#5a3820'
    ctx.fillRect(-5, -16, 3, 9)
    ctx.strokeStyle = '#e2a98a'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(2, -13)
    ctx.lineTo(9, -9)
    ctx.stroke()
    ctx.fillStyle = '#e2a98a'
    ctx.beginPath()
    ctx.arc(0, -21, 3.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#4a3024'
    ctx.beginPath()
    ctx.ellipse(0, -23.5, 8, 2, -0.08, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(-3.5, -29, 7, 5.5, 2)
    ctx.fill()
  } else {
    const front = view === 'down'
    // Kuda dari depan/belakang: badan bulat, kaki berganti saat berlari
    ctx.strokeStyle = horseDark
    ctx.lineWidth = 3
    const swing = Math.sin(gallop)
    for (const [lx, s] of [
      [-5, swing],
      [5, -swing],
    ]) {
      ctx.beginPath()
      ctx.moveTo(lx, 4)
      ctx.lineTo(lx, 13 - Math.max(0, s) * 4)
      ctx.stroke()
    }
    const body = ctx.createRadialGradient(-2, -2, 2, 0, 0, 12)
    body.addColorStop(0, '#a8744a')
    body.addColorStop(1, horseDark)
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.ellipse(0, 1, 9, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    if (front) {
      // Kepala kuda di depan (bawah), dengan surai dan dua mata
      ctx.fillStyle = horse
      ctx.beginPath()
      ctx.ellipse(0, 8, 4.5, 7, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#f1dcb4'
      ctx.fillRect(-1, 4, 2, 6)
      ctx.fillStyle = '#1a0f08'
      ctx.beginPath()
      ctx.arc(-3, 5, 0.9, 0, Math.PI * 2)
      ctx.arc(3, 5, 0.9, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = mane
      ctx.beginPath()
      ctx.moveTo(-2.5, 1)
      ctx.lineTo(0, -3)
      ctx.lineTo(2.5, 1)
      ctx.fill()
    } else {
      // Ekor terlihat di bawah (kuda membelakangi layar)
      ctx.strokeStyle = mane
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(0, 8)
      ctx.quadraticCurveTo(Math.sin(gallop) * 3, 13, 0, 16)
      ctx.stroke()
    }
    // Koboi duduk tegak
    ctx.fillStyle = '#c0322b'
    ctx.beginPath()
    ctx.roundRect(-5, -16, 10, 11, 3)
    ctx.fill()
    ctx.fillStyle = '#5a3820'
    if (front) {
      ctx.fillRect(-5, -15, 3, 9)
      ctx.fillRect(2, -15, 3, 9)
    } else {
      ctx.fillRect(-5, -15, 10, 3)
    }
    ctx.strokeStyle = '#e2a98a'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(-5, -12)
    ctx.lineTo(-8, -6)
    ctx.moveTo(5, -12)
    ctx.lineTo(8, -6)
    ctx.stroke()
    ctx.fillStyle = front ? '#e2a98a' : '#5a3a28'
    ctx.beginPath()
    ctx.arc(0, -20, 3.8, 0, Math.PI * 2)
    ctx.fill()
    if (front) {
      ctx.fillStyle = '#1a0f08'
      ctx.fillRect(-1.8, -20.5, 1.1, 1.1)
      ctx.fillRect(0.8, -20.5, 1.1, 1.1)
    }
    ctx.fillStyle = '#4a3024'
    ctx.beginPath()
    ctx.ellipse(0, -22.5, 8.5, 2.4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(-3.5, -28, 7, 5.5, 2)
    ctx.fill()
  }
  ctx.restore()
}

// ---------- Proyektil ----------

function drawShot(ctx: CanvasRenderingContext2D, shot: Shot) {
  switch (shot.kind) {
    case 'bullet': {
      // Peluru kuningan memanjang searah gerak, dengan jejak asap tipis
      const angle = Math.atan2(shot.vy, shot.vx)
      ctx.save()
      ctx.translate(shot.x, shot.y)
      ctx.rotate(angle)
      const trail = ctx.createLinearGradient(-22, 0, 0, 0)
      trail.addColorStop(0, 'rgba(255, 240, 210, 0)')
      trail.addColorStop(1, shot.pattern === 'ricochet' ? 'rgba(160, 230, 255, 0.55)' : 'rgba(255, 240, 210, 0.5)')
      ctx.fillStyle = trail
      ctx.fillRect(-22, -1.5, 22, 3)
      const brass = ctx.createLinearGradient(0, -4, 0, 4)
      brass.addColorStop(0, '#fff6dc')
      brass.addColorStop(0.5, shot.pattern === 'ricochet' ? '#9fe3ff' : '#ffd27a')
      brass.addColorStop(1, shot.pattern === 'ricochet' ? '#3a8fb8' : '#b8791f')
      ctx.fillStyle = brass
      ctx.beginPath()
      ctx.moveTo(-5, -3.6)
      ctx.lineTo(3, -3.6)
      ctx.quadraticCurveTo(8, 0, 3, 3.6)
      ctx.lineTo(-5, 3.6)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(40, 20, 10, 0.7)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
      return
    }
    case 'thorn': {
      // Duri hijau tajam
      const angle = Math.atan2(shot.vy, shot.vx)
      ctx.save()
      ctx.translate(shot.x, shot.y)
      ctx.rotate(angle)
      ctx.fillStyle = '#9fd36a'
      ctx.strokeStyle = '#2f4a1c'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(9, 0)
      ctx.lineTo(-6, -4)
      ctx.lineTo(-3, 0)
      ctx.lineTo(-6, 4)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
      return
    }
    case 'tumbleweed': {
      // Semak kering: lingkaran ranting kusut yang berputar
      ctx.save()
      ctx.translate(shot.x, shot.y)
      ctx.rotate(shot.age * (shot.vx > 0 ? 6 : -6))
      ctx.fillStyle = 'rgba(150, 100, 50, 0.35)'
      ctx.beginPath()
      ctx.arc(0, 0, shot.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#d4a45e'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let i = 0; i < 9; i++) {
        const a = (i * Math.PI * 2) / 9
        ctx.moveTo(Math.cos(a) * shot.r, Math.sin(a) * shot.r)
        ctx.quadraticCurveTo(Math.cos(a + 1.6) * 3, Math.sin(a + 1.6) * 3, Math.cos(a + 2.6) * shot.r, Math.sin(a + 2.6) * shot.r)
      }
      ctx.stroke()
      ctx.strokeStyle = '#8a5a2b'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, shot.r - 1, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      return
    }
    case 'dust': {
      // Gumpalan debu berpusar (bentuk awan, beda dengan peluru)
      const swirl = shot.age * 4
      ctx.fillStyle = 'rgba(214, 164, 100, 0.95)'
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const a = swirl + (i * Math.PI * 2) / 3
        ctx.moveTo(shot.x + Math.cos(a) * 3 + 4, shot.y + Math.sin(a) * 3)
        ctx.arc(shot.x + Math.cos(a) * 3, shot.y + Math.sin(a) * 3, 4, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.strokeStyle = 'rgba(90, 55, 25, 0.9)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(shot.x, shot.y, 2.4, swirl, swirl + 4)
      ctx.stroke()
      return
    }
  }
}

// ---------- Hazard dan tanda peringatan ----------

function laneRect(edge: Edge, from: number, to: number, depth: number): [number, number, number, number] {
  const [ax, ay] = edgePoint(edge, from)
  const [bx, by] = edgePoint(edge, to)
  switch (edge) {
    case 'top':
      return [ax, ay, bx - ax, depth]
    case 'bottom':
      return [ax, by - depth, bx - ax, depth]
    case 'left':
      return [ax, ay, depth, by - ay]
    case 'right':
      return [ax - depth, ay, depth, by - ay]
  }
}

function drawGunman(ctx: CanvasRenderingContext2D, h: Extract<Hazard, { kind: 'gunman' }>) {
  const fade = Math.min(1, h.t / 0.15, (h.life - h.t) / 0.2)
  ctx.save()
  ctx.globalAlpha = Math.max(0, fade)
  ctx.translate(h.x, h.y)
  // Topi koboi dan revolver menghadap arah tembak
  ctx.fillStyle = COLOR.coal
  ctx.beginPath()
  ctx.ellipse(0, -2, 15, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-8, -3)
  ctx.quadraticCurveTo(-7, -15, 0, -14)
  ctx.quadraticCurveTo(7, -15, 8, -3)
  ctx.fill()
  ctx.fillStyle = COLOR.wine
  ctx.fillRect(-8, -6, 16, 3)
  ctx.rotate(h.aim)
  ctx.fillStyle = '#3b3b40'
  ctx.fillRect(4, -2, 16, 4)
  ctx.fillStyle = '#6b4a2b'
  ctx.fillRect(0, -3, 7, 8)
  if (h.t < h.glint) {
    // Kilau bidikan sebelum menembak
    const k = h.t / h.glint
    ctx.strokeStyle = `rgba(255, 240, 180, ${0.25 + k * 0.6})`
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 6])
    ctx.beginPath()
    ctx.moveTo(22, 0)
    ctx.lineTo(60 + k * 30, 0)
    ctx.stroke()
    ctx.setLineDash([])
  }
  if (h.flash > 0) {
    ctx.fillStyle = `rgba(255, 220, 120, ${h.flash * 8})`
    ctx.beginPath()
    ctx.moveTo(20, 0)
    ctx.lineTo(34, -8)
    ctx.lineTo(30, 0)
    ctx.lineTo(34, 8)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawHazard(ctx: CanvasRenderingContext2D, h: Hazard, clock: number) {
  switch (h.kind) {
    case 'gunman':
      drawGunman(ctx, h)
      return
    case 'blast': {
      if (h.boom < 0) {
        const k = 1 - h.fuse / h.total
        // Lingkaran bahaya bergaris + cincin hitung mundur yang menutup
        ctx.save()
        ctx.beginPath()
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 90, 60, ${0.08 + k * 0.14})`
        ctx.fill()
        ctx.clip()
        ctx.strokeStyle = `rgba(255, 110, 70, ${0.18 + k * 0.2})`
        ctx.lineWidth = 3
        ctx.beginPath()
        for (let d = -h.r * 2; d < h.r * 2; d += 12) {
          ctx.moveTo(h.x + d, h.y - h.r)
          ctx.lineTo(h.x + d + h.r, h.y + h.r)
        }
        ctx.stroke()
        ctx.restore()
        ctx.strokeStyle = COLOR.danger
        ctx.lineWidth = 2
        ctx.setLineDash([6, 5])
        ctx.beginPath()
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(h.x, h.y, h.r * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k))
        ctx.stroke()
        // Batang dinamit: terbang ke titik sasaran lalu tergeletak dengan sumbu memercik
        const fly = Math.min(1, k / 0.25)
        const sx = h.fromX + (h.x - h.fromX) * fly
        const sy = ARENA.y - 40 + (h.y - (ARENA.y - 40)) * fly - Math.sin(fly * Math.PI) * 60
        ctx.save()
        ctx.translate(sx, sy)
        ctx.rotate(fly < 1 ? clock * 12 : 0.4)
        ctx.fillStyle = '#c0322b'
        ctx.fillRect(-9, -4, 18, 8)
        ctx.fillStyle = '#f3d9a6'
        ctx.fillRect(-3, -4, 3, 8)
        ctx.strokeStyle = '#2a1a10'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(9, 0)
        ctx.quadraticCurveTo(14, -6, 16, -2)
        ctx.stroke()
        const spark = 2 + Math.random() * 2
        ctx.fillStyle = '#ffe08a'
        ctx.beginPath()
        ctx.arc(16, -2, spark, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        return
      }
      // Ledakan
      const k = h.boom / 0.45
      const blast = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.r * (0.8 + k * 0.4))
      blast.addColorStop(0, `rgba(255, 245, 200, ${1 - k})`)
      blast.addColorStop(0.4, `rgba(255, 150, 60, ${0.85 - k * 0.8})`)
      blast.addColorStop(1, 'rgba(160, 40, 20, 0)')
      ctx.fillStyle = blast
      ctx.beginPath()
      ctx.arc(h.x, h.y, h.r * (0.8 + k * 0.4), 0, Math.PI * 2)
      ctx.fill()
      return
    }
    case 'mark': {
      const locked = h.t >= h.follow
      const fired = h.fired >= 0
      if (fired) {
        ctx.strokeStyle = `rgba(255, 240, 190, ${1 - h.fired / 0.35})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(h.gx, h.gy)
        ctx.lineTo(h.x, h.y)
        ctx.stroke()
        ctx.fillStyle = `rgba(255, 200, 120, ${0.5 * (1 - h.fired / 0.35)})`
        ctx.beginPath()
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2)
        ctx.fill()
        return
      }
      // Bidikan: lingkaran + garis silang; mengecil dan memerah saat terkunci
      const k = locked ? (h.t - h.follow) / h.lock : 0
      const r = h.r * (locked ? 1.6 - k * 0.6 : 1.6 + Math.sin(clock * 10) * 0.1)
      ctx.strokeStyle = locked ? COLOR.danger : COLOR.cream
      ctx.lineWidth = locked ? 2.5 : 1.6
      ctx.beginPath()
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2)
      ctx.moveTo(h.x - r - 6, h.y)
      ctx.lineTo(h.x - r * 0.4, h.y)
      ctx.moveTo(h.x + r * 0.4, h.y)
      ctx.lineTo(h.x + r + 6, h.y)
      ctx.moveTo(h.x, h.y - r - 6)
      ctx.lineTo(h.x, h.y - r * 0.4)
      ctx.moveTo(h.x, h.y + r * 0.4)
      ctx.lineTo(h.x, h.y + r + 6)
      ctx.stroke()
      if (locked) {
        ctx.fillStyle = `rgba(255, 90, 60, ${0.12 + k * 0.2})`
        ctx.beginPath()
        ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2)
        ctx.fill()
      }
      return
    }
    case 'arc': {
      const warn = h.t < h.warn
      const k = warn ? 0 : Math.min(1, (h.t - h.warn) / h.sweep)
      ctx.save()
      ctx.beginPath()
      ctx.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h)
      ctx.clip()
      if (warn) {
        // Area sapuan diarsir, dengan panah arah
        const blink = 0.2 + 0.1 * Math.sin(clock * 14)
        ctx.beginPath()
        ctx.moveTo(h.px, h.py)
        ctx.arc(h.px, h.py, h.length, Math.min(h.from, h.to), Math.max(h.from, h.to))
        ctx.closePath()
        ctx.fillStyle = `rgba(255, 110, 60, ${blink})`
        ctx.fill()
        ctx.save()
        ctx.clip()
        ctx.strokeStyle = 'rgba(255, 120, 70, 0.22)'
        ctx.lineWidth = 3
        ctx.beginPath()
        for (let d = -600; d < 600; d += 14) {
          ctx.moveTo(h.px + d, h.py - 400)
          ctx.lineTo(h.px + d + 400, h.py + 400)
        }
        ctx.stroke()
        ctx.restore()
        ctx.beginPath()
        ctx.moveTo(h.px, h.py)
        ctx.arc(h.px, h.py, h.length, Math.min(h.from, h.to), Math.max(h.from, h.to))
        ctx.closePath()
        ctx.strokeStyle = 'rgba(255, 140, 80, 0.9)'
        ctx.setLineDash([6, 6])
        ctx.lineWidth = 2.5
        ctx.stroke()
        ctx.setLineDash([])
        const mid = (h.from + h.to) / 2
        const dir = Math.sign(h.to - h.from)
        ctx.strokeStyle = COLOR.cream
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(h.px, h.py, h.length * 0.75, mid - 0.25 * dir, mid + 0.25 * dir, dir < 0)
        ctx.stroke()
        const tip = mid + 0.25 * dir
        const tx = h.px + Math.cos(tip) * h.length * 0.75
        const ty = h.py + Math.sin(tip) * h.length * 0.75
        ctx.beginPath()
        ctx.arc(tx, ty, 4, 0, Math.PI * 2)
        ctx.fillStyle = COLOR.cream
        ctx.fill()
      } else if (k < 1) {
        const angle = h.from + (h.to - h.from) * k
        rope(ctx, h.px, h.py, h.px + Math.cos(angle) * h.length, h.py + Math.sin(angle) * h.length, clock)
        // Simpul laso di ujung tali
        ctx.strokeStyle = '#e8c48a'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.ellipse(h.px + Math.cos(angle) * h.length, h.py + Math.sin(angle) * h.length, 9, 6, angle, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
      return
    }
    case 'rope': {
      const warn = h.t < h.warn
      const span = h.axis === 'y' ? ARENA.w : ARENA.h
      if (warn) {
        // Tanda simpul (celah aman) di tepi tempat tali akan masuk
        const k = 0.5 + 0.5 * Math.sin(clock * 12)
        // Digambar sedikit di dalam tepi (bukan di atas tali pagar) supaya terlihat.
        const start = h.pos + h.dir * 12
        ctx.fillStyle = `rgba(255, 90, 60, ${0.12 + k * 0.1})`
        if (h.axis === 'y') ctx.fillRect(ARENA.x, h.dir === 1 ? ARENA.y : ARENA_BOTTOM - 24, ARENA.w, 24)
        else ctx.fillRect(h.dir === 1 ? ARENA.x : ARENA_RIGHT - 24, ARENA.y, 24, ARENA.h)
        ctx.strokeStyle = `rgba(255, 140, 70, ${0.55 + k * 0.4})`
        ctx.lineWidth = 4
        ctx.setLineDash([8, 6])
        ctx.beginPath()
        if (h.axis === 'y') {
          ctx.moveTo(ARENA.x, start)
          ctx.lineTo(ARENA.x + h.gap - h.gapSize / 2, start)
          ctx.moveTo(ARENA.x + h.gap + h.gapSize / 2, start)
          ctx.lineTo(ARENA_RIGHT, start)
        } else {
          ctx.moveTo(start, ARENA.y)
          ctx.lineTo(start, ARENA.y + h.gap - h.gapSize / 2)
          ctx.moveTo(start, ARENA.y + h.gap + h.gapSize / 2)
          ctx.lineTo(start, ARENA_BOTTOM)
        }
        ctx.stroke()
        ctx.setLineDash([])
        ctx.strokeStyle = COLOR.safe
        ctx.lineWidth = 2.5
        ctx.beginPath()
        if (h.axis === 'y') ctx.ellipse(ARENA.x + h.gap, start, h.gapSize / 2, 8, 0, 0, Math.PI * 2)
        else ctx.ellipse(start, ARENA.y + h.gap, 8, h.gapSize / 2, 0, 0, Math.PI * 2)
        ctx.stroke()
        return
      }
      ctx.save()
      ctx.beginPath()
      ctx.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h)
      ctx.clip()
      const g0 = h.gap - h.gapSize / 2
      const g1 = h.gap + h.gapSize / 2
      if (h.axis === 'y') {
        rope(ctx, ARENA.x, h.pos, ARENA.x + g0, h.pos, clock)
        rope(ctx, ARENA.x + g1, h.pos, ARENA.x + span, h.pos, clock)
      } else {
        rope(ctx, h.pos, ARENA.y, h.pos, ARENA.y + g0, clock)
        rope(ctx, h.pos, ARENA.y + g1, h.pos, ARENA.y + span, clock)
      }
      // Simpul laso membentuk celah
      ctx.strokeStyle = '#e8c48a'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      if (h.axis === 'y') ctx.ellipse(ARENA.x + h.gap, h.pos, h.gapSize / 2, 7, 0, Math.PI, Math.PI * 2)
      else ctx.ellipse(h.pos, ARENA.y + h.gap, 7, h.gapSize / 2, 0, Math.PI / 2, Math.PI * 1.5)
      ctx.stroke()
      ctx.restore()
      return
    }
    case 'lane': {
      const k = Math.min(1, h.t / h.warn)
      const depth = h.pattern === 'cactus' ? 16 : 12
      const [x, y, w, hh] = laneRect(h.edge, Math.max(0, h.from), Math.min(1, h.to), depth)
      if (h.safe) {
        // Celah aman: garis hijau putus-putus + tanda "aman"
        ctx.strokeStyle = COLOR.safe
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.strokeRect(x + 1, y + 1, w - 2, hh - 2)
        ctx.setLineDash([])
        return
      }
      // Jalur bahaya: berkedip makin cepat, berpola garis miring (tidak hanya warna)
      const blink = 0.35 + 0.35 * Math.sin(clock * (10 + k * 18))
      ctx.fillStyle = `rgba(255, 90, 60, ${blink})`
      ctx.fillRect(x, y, w, hh)
      ctx.save()
      ctx.beginPath()
      ctx.rect(x, y, w, hh)
      ctx.clip()
      ctx.strokeStyle = 'rgba(40, 10, 5, 0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let d = -40; d < Math.max(w, hh) + 40; d += 8) {
        ctx.moveTo(x + d, y)
        ctx.lineTo(x + d - 16, y + 16)
        ctx.moveTo(x, y + d)
        ctx.lineTo(x + 16, y + d - 16)
      }
      ctx.stroke()
      ctx.restore()
      return
    }
    case 'train':
      drawTrain(ctx, h, clock)
      return
    case 'bull':
      drawBull(ctx, h, clock)
      return
    case 'spinner':
      drawSpinner(ctx, h, clock)
      return
    case 'barrel':
      drawBarrel(ctx, h, clock)
      return
    case 'path': {
      const k = Math.min(1, h.t / h.warn)
      ctx.save()
      ctx.beginPath()
      ctx.rect(ARENA.x - 2, ARENA.y - 2, ARENA.w + 4, ARENA.h + 4)
      ctx.clip()
      ctx.strokeStyle = `rgba(160, 230, 255, ${0.25 + k * 0.45})`
      ctx.lineWidth = 2
      ctx.setLineDash([3, 7])
      ctx.lineDashOffset = -clock * 40
      ctx.beginPath()
      h.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(160, 230, 255, 0.8)'
      for (const [x, y] of h.points.slice(1, -1)) {
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      return
    }
  }
}

/** Tali berpilin dari (ax,ay) ke (bx,by). */
function rope(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, clock: number) {
  ctx.strokeStyle = '#c99a5b'
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(bx, by)
  ctx.stroke()
  ctx.strokeStyle = '#6b4320'
  ctx.lineWidth = 1.6
  ctx.setLineDash([3, 4])
  ctx.lineDashOffset = clock * 20
  ctx.stroke()
  ctx.setLineDash([])
}

// ---------- Bos ----------

/** Si Mata Elang: koboi bertopi lebar dengan ponco merah anggur, berdiri di atas arena. */
function drawBoss(ctx: CanvasRenderingContext2D, s: GameState, clock: number) {
  const boss = s.boss!
  const x = 400
  const y = 150 + Math.sin(clock * 1.4) * 2
  const rage = boss.phase
  ctx.save()
  ctx.translate(x, y)
  if (boss.hurt > 0) ctx.translate(Math.sin(boss.hurt * 60) * 4, 0)
  // Bayangan
  ctx.fillStyle = 'rgba(20, 8, 6, 0.4)'
  ctx.beginPath()
  ctx.ellipse(0, 40, 46, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  // Ponco bergerak tertiup angin
  const sway = Math.sin(clock * 2) * 3
  const poncho = ctx.createLinearGradient(0, -20, 0, 40)
  poncho.addColorStop(0, rage === 2 ? '#a3243a' : '#8a2a36')
  poncho.addColorStop(1, '#4a1420')
  ctx.fillStyle = poncho
  ctx.beginPath()
  ctx.moveTo(-14, -18)
  ctx.lineTo(14, -18)
  ctx.lineTo(40 + sway, 34)
  ctx.lineTo(-40 + sway, 34)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = COLOR.gold
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    ctx.moveTo(-34 + i * 13 + sway, 26)
    ctx.lineTo(-28 + i * 13 + sway, 30)
    ctx.lineTo(-22 + i * 13 + sway, 26)
  }
  ctx.stroke()
  // Lengan dengan revolver (terangkat saat menembak)
  const draw = boss.draw > 0 ? 1 : 0
  ctx.save()
  ctx.translate(26, -6)
  ctx.rotate(draw ? 0.9 : 0.25)
  ctx.fillStyle = '#5a1c26'
  ctx.fillRect(0, -4, 22, 8)
  ctx.fillStyle = '#3b3b40'
  ctx.fillRect(20, -3, 18, 6)
  ctx.fillStyle = '#6b4a2b'
  ctx.fillRect(16, -4, 7, 10)
  if (draw) {
    ctx.fillStyle = 'rgba(255, 220, 120, 0.9)'
    ctx.beginPath()
    ctx.moveTo(38, 0)
    ctx.lineTo(50, -7)
    ctx.lineTo(46, 0)
    ctx.lineTo(50, 7)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  // Kepala dan wajah dalam bayangan topi
  ctx.fillStyle = '#c98a5e'
  ctx.beginPath()
  ctx.arc(0, -28, 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(30, 12, 8, 0.55)'
  ctx.fillRect(-12, -34, 24, 8)
  // Mata elang: satu mata menyala
  ctx.fillStyle = rage === 2 ? '#ff4a2a' : '#ffcf5a'
  ctx.beginPath()
  ctx.ellipse(4, -30, 3, 1.6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#2a1a10'
  ctx.fillRect(-7, -31, 5, 2)
  // Kumis
  ctx.fillStyle = '#3a2416'
  ctx.beginPath()
  ctx.moveTo(-8, -22)
  ctx.quadraticCurveTo(0, -26, 8, -22)
  ctx.quadraticCurveTo(0, -20, -8, -22)
  ctx.fill()
  // Topi lebar
  const hat = ctx.createLinearGradient(0, -60, 0, -36)
  hat.addColorStop(0, '#4a3024')
  hat.addColorStop(1, '#22150f')
  ctx.fillStyle = hat
  ctx.beginPath()
  ctx.ellipse(0, -38, 34, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-16, -38)
  ctx.quadraticCurveTo(-16, -60, -6, -58)
  ctx.quadraticCurveTo(0, -52, 6, -58)
  ctx.quadraticCurveTo(16, -60, 16, -38)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = COLOR.wine
  ctx.fillRect(-16, -44, 32, 4)
  star(ctx, 0, -42, 4, COLOR.gold)
  if (boss.hurt > 0) {
    ctx.globalAlpha = Math.min(0.6, boss.hurt)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(0, -28, 13, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ---------- HUD ----------

function drawHud(ctx: CanvasRenderingContext2D, s: GameState) {
  const p = s.player
  // Papan kayu di atas
  ctx.fillStyle = 'rgba(35, 20, 14, 0.82)'
  ctx.beginPath()
  ctx.roundRect(14, 12, 772, 52, 10)
  ctx.fill()
  ctx.strokeStyle = 'rgba(227, 180, 80, 0.45)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  // Nyawa
  for (let i = 0; i < p.maxHp; i++) {
    const full = i < p.hp
    ctx.globalAlpha = full ? 1 : 0.3
    ctx.fillStyle = full ? '#ff8a2a' : '#6b4a3a'
    heartPath(ctx, 40 + i * 26, 26, 18)
    ctx.fill()
    if (!full) {
      ctx.strokeStyle = '#a88060'
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = COLOR.cream
  ctx.font = `20px ${FONT}`
  const label = s.boss ? BOSS.name.toUpperCase() : `GELOMBANG ${s.wave}`
  ctx.fillText(label, 400, 30)
  ctx.font = `600 13px ${UI_FONT}`
  ctx.fillStyle = COLOR.sand
  const minutes = Math.floor(s.time / 60)
  const seconds = Math.floor(s.time % 60)
  ctx.fillText(`${minutes}:${String(seconds).padStart(2, '0')}`, 400, 50)
  ctx.textAlign = 'right'
  ctx.font = `20px ${FONT}`
  ctx.fillStyle = COLOR.gold
  ctx.fillText(Math.round(s.score).toLocaleString('id-ID'), 770, 30)
  ctx.font = `600 12px ${UI_FONT}`
  ctx.fillStyle = COLOR.sand
  ctx.fillText(`kena ${s.hits} · lolos ${s.dodged}`, 770, 50)

  // Bar nyali bos
  if (s.boss) {
    const boss = s.boss
    const w = 300
    const x = 250
    const y = 74
    ctx.fillStyle = 'rgba(35, 20, 14, 0.85)'
    ctx.beginPath()
    ctx.roundRect(x - 4, y - 4, w + 8, 16, 6)
    ctx.fill()
    const fill = ctx.createLinearGradient(x, 0, x + w, 0)
    fill.addColorStop(0, '#c0322b')
    fill.addColorStop(1, '#e3b450')
    ctx.fillStyle = fill
    ctx.fillRect(x, y, (w * boss.hp) / boss.maxHp, 8)
    ctx.fillStyle = 'rgba(255, 240, 210, 0.85)'
    for (const limit of BOSS.phases) ctx.fillRect(x + w * limit - 1, y - 2, 2, 12)
    ctx.textAlign = 'right'
    ctx.font = `600 11px ${UI_FONT}`
    ctx.fillStyle = COLOR.cream
    ctx.fillText(`NYALI · FASE ${boss.phase + 1}`, x - 12, y + 4)
  }

  // Dash: cincin cooldown di bawah arena
  if (s.dashEnabled) {
    const x = ARENA.x + 18
    const y = ARENA_BOTTOM + 24
    const ready = p.dashCooldown <= 0
    ctx.strokeStyle = 'rgba(255, 240, 210, 0.25)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(x, y, 11, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = ready ? COLOR.gold : COLOR.sand
    ctx.beginPath()
    ctx.arc(x, y, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p.dashCooldown / DASH.cooldown))
    ctx.stroke()
    ctx.textAlign = 'left'
    ctx.font = `600 12px ${UI_FONT}`
    ctx.fillStyle = ready ? COLOR.cream : 'rgba(255, 240, 210, 0.55)'
    ctx.fillText(ready ? 'DASH siap · Spasi' : 'DASH…', x + 18, y)
  }
  // Nama serangan yang sedang berjalan
  if (s.runs.length) {
    ctx.textAlign = 'right'
    ctx.font = `600 12px ${UI_FONT}`
    ctx.fillStyle = 'rgba(255, 240, 210, 0.75)'
    ctx.fillText(s.runs.map((run) => PATTERN_NAMES[run.id]).join(' + '), ARENA_RIGHT, ARENA_BOTTOM + 24)
  }
}

function drawBanner(ctx: CanvasRenderingContext2D, s: GameState) {
  const banner = s.banner
  if (!banner) return
  const t = banner.time
  const alpha = Math.min(1, t / 0.2, (banner.total - t) / 0.35)
  if (alpha <= 0) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(35, 20, 14, 0.82)'
  ctx.beginPath()
  ctx.roundRect(220, 300, 360, 82, 12)
  ctx.fill()
  ctx.strokeStyle = COLOR.gold
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = COLOR.cream
  ctx.font = `30px ${FONT}`
  ctx.fillText(banner.title, 400, 330)
  ctx.font = `600 14px ${UI_FONT}`
  ctx.fillStyle = COLOR.sand
  ctx.fillText(banner.subtitle, 400, 360)
  ctx.restore()
}

function drawCountdown(ctx: CanvasRenderingContext2D, s: GameState) {
  if (s.phase !== 'countdown') return
  const left = Math.ceil(2.4 - s.phaseTime)
  if (left <= 0 || s.phaseTime < 0.6) return
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = COLOR.gold
  ctx.font = `46px ${FONT}`
  ctx.fillText(String(Math.min(2, left)), 400, 440)
}

function drawDuel(ctx: CanvasRenderingContext2D, s: GameState, clock: number) {
  const duel = s.duel
  if (!duel || s.phase !== 'duel') return
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (!duel.result) {
    if (duel.t < duel.signal) {
      ctx.fillStyle = 'rgba(35, 20, 14, 0.6)'
      ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h)
      ctx.fillStyle = COLOR.sand
      ctx.font = `26px ${FONT}`
      ctx.fillText('TAHAN…', 400, ARENA.y + ARENA.h / 2 - 10)
      ctx.font = `600 13px ${UI_FONT}`
      ctx.fillText('Jangan menekan sebelum aba-aba', 400, ARENA.y + ARENA.h / 2 + 22)
      // Jam berdetak
      ctx.strokeStyle = COLOR.sand
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(400, ARENA.y + 50, 16, 0, Math.PI * 2)
      ctx.moveTo(400, ARENA.y + 50)
      ctx.lineTo(400 + Math.cos(clock * 6) * 12, ARENA.y + 50 + Math.sin(clock * 6) * 12)
      ctx.stroke()
    } else {
      const k = Math.min(1, (duel.t - duel.signal) / 0.12)
      ctx.fillStyle = `rgba(192, 50, 43, ${0.55 * k})`
      ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h)
      ctx.fillStyle = COLOR.cream
      ctx.font = `${40 + k * 12}px ${FONT}`
      ctx.fillText('TEMBAK!', 400, ARENA.y + ARENA.h / 2)
    }
    return
  }
  const text = { early: 'Terlalu cepat! −1 nyawa', slow: 'Terlalu lambat! −1 nyawa', hit: 'Kena!', fast: 'Secepat kilat!' }[duel.result]
  ctx.fillStyle = 'rgba(35, 20, 14, 0.6)'
  ctx.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h)
  ctx.fillStyle = duel.result === 'early' || duel.result === 'slow' ? '#ff8a6a' : COLOR.gold
  ctx.font = `28px ${FONT}`
  ctx.fillText(text, 400, ARENA.y + ARENA.h / 2 - 8)
  if (duel.result === 'hit' || duel.result === 'fast') {
    ctx.font = `600 14px ${UI_FONT}`
    ctx.fillStyle = COLOR.sand
    ctx.fillText(`Reaksi ${Math.round(duel.reaction * 1000)} ms`, 400, ARENA.y + ARENA.h / 2 + 24)
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, s: GameState, reduceFlash: boolean) {
  for (const particle of s.particles) {
    const k = 1 - particle.age / particle.life
    ctx.globalAlpha = Math.max(0, k) * (reduceFlash && particle.kind === 'spark' ? 0.5 : 1)
    ctx.fillStyle = particle.color
    ctx.beginPath()
    ctx.arc(particle.x, particle.y, particle.size * (particle.kind === 'smoke' ? 1 + (1 - k) : k + 0.3), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawDebug(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.strokeStyle = '#00ff9c'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(s.player.x, s.player.y, PLAYER.radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = '#ff00d4'
  for (const shot of s.shots) {
    if (!shot.alive) continue
    ctx.beginPath()
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (const h of s.hazards) {
    if (h.kind === 'bull') {
      ctx.beginPath()
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (h.kind === 'blast' || h.kind === 'mark') {
      ctx.beginPath()
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.fillStyle = '#00ff9c'
  ctx.font = `11px monospace`
  ctx.textAlign = 'left'
  ctx.fillText(`seed ${s.seed} · peluru ${s.shots.filter((shot) => shot.alive).length} · hazard ${s.hazards.length} · fase ${s.phase}`, 20, WORLD.height - 12)
}

/** Satu frame penuh. `scale` = piksel kanvas per satuan dunia (termasuk devicePixelRatio). */
export function render(ctx: CanvasRenderingContext2D, s: GameState, scale: number, clock: number, options: RenderOptions) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.drawImage(background(), 0, 0)
  ctx.save()
  if (options.shake && s.shake > 0) ctx.translate((Math.random() - 0.5) * 8 * s.shake, (Math.random() - 0.5) * 8 * s.shake)
  if (s.boss) drawBoss(ctx, s, clock)
  drawArena(ctx, s, clock)
  for (const h of s.hazards) if (h.kind === 'lane' || h.kind === 'path' || h.kind === 'arc' || h.kind === 'rope' || h.kind === 'blast' || h.kind === 'train' || h.kind === 'spinner') drawHazard(ctx, h, clock)
  drawPlayer(ctx, s, clock, options)
  for (const shot of s.shots) if (shot.alive) drawShot(ctx, shot)
  for (const h of s.hazards) if (h.kind === 'gunman' || h.kind === 'mark' || h.kind === 'bull' || h.kind === 'barrel') drawHazard(ctx, h, clock)
  drawParticles(ctx, s, options.reduceFlash)
  drawDuel(ctx, s, clock)
  ctx.restore()
  if (s.flash > 0 && !options.reduceFlash) {
    ctx.fillStyle = `rgba(255, 60, 40, ${s.flash * 0.18})`
    ctx.fillRect(0, 0, WORLD.width, WORLD.height)
  }
  drawHud(ctx, s)
  drawCountdown(ctx, s)
  drawBanner(ctx, s)
  if (options.debug) drawDebug(ctx, s)
}
