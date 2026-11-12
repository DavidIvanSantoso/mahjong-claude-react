import { CAVE } from './config'
import { hash, mix, seaAt } from './ambience'
import { frameAt, morayExtent, wallsAt, type Cave, type CaveHazard } from './cave'
import type { GameState } from './engine'

/**
 * Menggambar Arus Gua (lihat cave.ts): latar gua, dinding batu, rintangan, dan cahaya di sekitar penyelam.
 * Digambar di atas lapisan kegelapan laut, karena gua punya pencahayaannya sendiri.
 */

const FONT = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'

/** Seberapa tertutup gua di tengah layar (0 = mulut gua, 1 = di dalam). */
function closedness(s: GameState, cave: Cave): number {
  return 1 - frameAt(cave, cave.dist + s.width * 0.5).open
}

function wallPath(s: GameState, cave: Cave, ceiling: boolean): Path2D {
  const path = new Path2D()
  const edge = ceiling ? -20 : s.height + 20
  path.moveTo(-20, edge)
  for (let x = -20; x <= s.width + 28; x += 8) {
    const walls = wallsAt(cave, cave.dist + x)
    path.lineTo(x, ceiling ? walls.top : walls.bottom)
  }
  path.lineTo(s.width + 28, edge)
  path.closePath()
  return path
}

/** Punggung batu di kejauhan (bergulir lebih lambat dari dinding). */
function drawBackdrop(ctx: CanvasRenderingContext2D, s: GameState, cave: Cave, closed: number) {
  ctx.fillStyle = `rgba(5, 9, 18, ${0.92 * closed})`
  ctx.fillRect(0, 0, s.width, s.height)
  // Bayangan gelap (bukan dinding) supaya tidak dikira rintangan.
  const far = cave.dist * 0.35
  ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * closed})`
  for (const ceiling of [true, false]) {
    ctx.beginPath()
    ctx.moveTo(-10, ceiling ? -10 : s.height + 10)
    for (let x = -10; x <= s.width + 20; x += 20) {
      const u = (x + far) / 90
      const i = Math.floor(u)
      const t = u - i
      const n = hash(i * 7 + (ceiling ? 1 : 3)) * (1 - t) + hash((i + 1) * 7 + (ceiling ? 1 : 3)) * t
      const y = ceiling ? 40 + n * 60 : s.height - 30 - n * 60
      ctx.lineTo(x, y)
    }
    ctx.lineTo(s.width + 20, ceiling ? -10 : s.height + 10)
    ctx.closePath()
    ctx.fill()
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, s: GameState, cave: Cave, clock: number) {
  // Batu pasir hangat di dangkal, batu biru-kelabu di dalam.
  const deep = Math.min(1, s.depth / 700)
  const rock = mix('#5b4c3e', '#2c3548', deep)
  const lit = mix('#8a7560', '#4a5872', deep)
  const dark = mix('#1a1511', '#0a0d15', deep)

  for (const ceiling of [true, false]) {
    const path = wallPath(s, cave, ceiling)
    const edge = new Path2D()
    for (let x = -20; x <= s.width + 28; x += 8) {
      const walls = wallsAt(cave, cave.dist + x)
      const y = ceiling ? walls.top : walls.bottom
      if (x === -20) edge.moveTo(x, y)
      else edge.lineTo(x, y)
    }
    ctx.fillStyle = dark
    ctx.fill(path)
    // Batu makin terang ke arah permukaan dinding (terkena cahaya), gelap di dalam.
    ctx.save()
    ctx.clip(path)
    ctx.lineJoin = 'round'
    ctx.strokeStyle = rock
    for (const width of [120, 90, 64, 42, 24]) {
      ctx.lineWidth = width
      ctx.globalAlpha = 0.28
      ctx.stroke(edge)
    }
    ctx.strokeStyle = lit
    ctx.lineWidth = 12
    ctx.globalAlpha = 0.7
    ctx.stroke(edge)
    ctx.globalAlpha = 1
    const first = Math.floor(cave.dist / 34)
    for (let i = first; i < first + s.width / 34 + 2; i++) {
      const x = i * 34 - cave.dist + hash(i) * 20
      const walls = wallsAt(cave, cave.dist + x)
      const y = ceiling ? walls.top - 8 - hash(i + 5) * 40 : walls.bottom + 8 + hash(i + 5) * 40
      ctx.fillStyle = `rgba(255, 255, 255, ${0.04 + hash(i + 9) * 0.05})`
      ctx.beginPath()
      ctx.ellipse(x, y, 3 + hash(i + 2) * 7, 2 + hash(i + 3) * 3, hash(i + 4) * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    // Tepi dinding: garis terang tipis supaya bentuk gua terbaca di gelap
    ctx.save()
    ctx.strokeStyle = deep > 0.5 ? 'rgba(120, 200, 255, 0.35)' : 'rgba(255, 220, 170, 0.3)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let x = -20; x <= s.width + 28; x += 8) {
      const walls = wallsAt(cave, cave.dist + x)
      const y = ceiling ? walls.top : walls.bottom
      if (x === -20) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.restore()
  }

  // Hiasan kecil di permukaan dinding: lumut menjuntai di atas, karang dan anemon di bawah.
  const first = Math.floor(cave.dist / 46)
  for (let i = first; i < first + s.width / 46 + 2; i++) {
    const x = i * 46 - cave.dist + hash(i * 3) * 24
    const walls = wallsAt(cave, cave.dist + x)
    if (hash(i * 5 + 1) < 0.55) {
      ctx.strokeStyle = deep > 0.5 ? 'rgba(90, 170, 150, 0.45)' : 'rgba(110, 150, 70, 0.6)'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let k = 0; k < 3; k++) {
        const sx = x + k * 4
        ctx.moveTo(sx, walls.top)
        ctx.quadraticCurveTo(sx + Math.sin(clock * 2 + i + k) * 3, walls.top + 5, sx + 1, walls.top + 6 + hash(i + k) * 6)
      }
      ctx.stroke()
    }
    if (hash(i * 5 + 2) < 0.5) {
      const hue = ['#ff7a8a', '#ffb347', '#c38bff', '#5fe0c0'][Math.floor(hash(i * 5 + 3) * 4)]
      ctx.fillStyle = hue
      ctx.globalAlpha = deep > 0.5 ? 0.55 : 0.85
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath()
        ctx.ellipse(x + k * 4, walls.bottom - 4 - Math.abs(k) * -1, 2.5, 5 + Math.sin(clock * 3 + i + k) * 1, k * 0.4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
  }
}

// ---------- Rintangan ----------

function drawMoray(ctx: CanvasRenderingContext2D, cave: Cave, h: CaveHazard, clock: number) {
  const x = h.wx - cave.dist
  const walls = wallsAt(cave, h.wx)
  const frame = frameAt(cave, h.wx)
  const anchor = h.side < 0 ? walls.top : walls.bottom
  // Lubang di dinding
  ctx.fillStyle = '#04060a'
  ctx.beginPath()
  ctx.ellipse(x, anchor + h.side * 2, 16, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  const extent = morayExtent(h)
  if (extent < 0.02) return

  const length = frame.g * CAVE.moray.reach * extent
  const points: { x: number; y: number }[] = []
  for (let k = 0; k <= 8; k++) {
    const f = k / 8
    const wave = Math.sin(clock * 9 + f * 6) * 3 * f
    points.push({ x: x - Math.sin(f * Math.PI) * 10 - f * extent * 14 + wave, y: anchor - h.side * length * f })
  }
  // Badan: hijau zaitun bertotol
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#5f7326'
  ctx.lineWidth = 19
  ctx.beginPath()
  points.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.stroke()
  ctx.strokeStyle = '#a7b852'
  ctx.lineWidth = 5
  ctx.beginPath()
  points.forEach((p, k) => (k ? ctx.lineTo(p.x + 4, p.y) : ctx.moveTo(p.x + 4, p.y)))
  ctx.stroke()
  ctx.fillStyle = '#3a4816'
  for (let k = 1; k < points.length - 1; k++) {
    ctx.beginPath()
    ctx.arc(points[k].x - 3 + (k % 2) * 5, points[k].y, 2.4, 0, Math.PI * 2)
    ctx.fill()
  }
  // Kepala: menghadap arah terjangan, mulut menganga
  const head = points[points.length - 1]
  const neck = points[points.length - 2]
  const angle = Math.atan2(head.y - neck.y, head.x - neck.x)
  const open = 0.25 + Math.min(1, extent) * 0.35 + Math.sin(clock * 12) * 0.05
  ctx.save()
  ctx.translate(head.x, head.y)
  ctx.rotate(angle)
  ctx.fillStyle = '#6d8230'
  ctx.beginPath()
  ctx.ellipse(-2, 0, 16, 11, 0, 0, Math.PI * 2)
  ctx.fill()
  // Rongga mulut dan gigi
  ctx.fillStyle = '#5a0e14'
  ctx.beginPath()
  ctx.moveTo(-2, 0)
  ctx.lineTo(18, -9 * open * 1.6)
  ctx.lineTo(18, 9 * open * 1.6)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#f4f1e4'
  for (let k = 0; k < 3; k++) {
    const tx = 4 + k * 5
    const spread = (tx / 18) * 9 * open * 1.6
    ctx.beginPath()
    ctx.moveTo(tx, -spread)
    ctx.lineTo(tx + 2, -spread + 4)
    ctx.lineTo(tx + 4, -spread)
    ctx.moveTo(tx, spread)
    ctx.lineTo(tx + 2, spread - 4)
    ctx.lineTo(tx + 4, spread)
    ctx.fill()
  }
  ctx.fillStyle = '#ffe14a'
  ctx.beginPath()
  ctx.arc(-4, -6, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#111'
  ctx.fillRect(-4.6, -8, 1.4, 4)
  ctx.restore()
}

function drawUrchin(ctx: CanvasRenderingContext2D, x: number, y: number, h: CaveHazard, clock: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(clock * 0.3 + h.phase)
  ctx.strokeStyle = '#b07ae0'
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2
    const r = 23 + Math.sin(clock * 4 + k) * 1.5
    ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9)
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.stroke()
  const body = ctx.createRadialGradient(-4, -4, 2, 0, 0, 14)
  body.addColorStop(0, '#8a4fb8')
  body.addColorStop(1, '#2c1540')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(0, 0, 13, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawJelly(ctx: CanvasRenderingContext2D, x: number, y: number, h: CaveHazard, clock: number) {
  const pulse = Math.sin(clock * 4 + h.phase)
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = 'rgba(255, 150, 120, 0.75)'
  ctx.lineWidth = 2
  for (let k = 0; k < 5; k++) {
    const tx = -10 + k * 5
    ctx.beginPath()
    ctx.moveTo(tx, 2)
    for (let t = 1; t <= 4; t++) ctx.lineTo(tx + Math.sin(clock * 5 + k + t) * 3, 2 + t * 8)
    ctx.stroke()
  }
  const bell = ctx.createRadialGradient(0, -4, 2, 0, -2, 18)
  bell.addColorStop(0, 'rgba(255, 220, 160, 0.95)')
  bell.addColorStop(1, 'rgba(255, 90, 60, 0.7)')
  ctx.fillStyle = bell
  ctx.beginPath()
  ctx.ellipse(0, 2, 17 + pulse * 1.5, 15 - pulse * 1.5, 0, Math.PI, Math.PI * 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** Gelembung oksigen berisi hati (+1 hati). */
function drawOxygen(ctx: CanvasRenderingContext2D, x: number, y: number, clock: number) {
  const r = 15 + Math.sin(clock * 4) * 1
  ctx.fillStyle = 'rgba(160, 235, 255, 0.2)'
  ctx.strokeStyle = 'rgba(210, 248, 255, 0.9)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#ff4f6d'
  ctx.beginPath()
  ctx.moveTo(x, y + 6)
  ctx.bezierCurveTo(x - 9, y - 1, x - 6, y - 9, x, y - 4)
  ctx.bezierCurveTo(x + 6, y - 9, x + 9, y - 1, x, y + 6)
  ctx.fill()
}

function drawPearl(ctx: CanvasRenderingContext2D, x: number, y: number, clock: number) {
  const pearl = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 9)
  pearl.addColorStop(0, '#ffffff')
  pearl.addColorStop(1, '#ffcf5a')
  ctx.fillStyle = pearl
  ctx.beginPath()
  ctx.arc(x, y + Math.sin(clock * 3 + x) * 2, 8, 0, Math.PI * 2)
  ctx.fill()
}

/** Posisi gambar rintangan (sama dengan posisi tabrakannya di cave.ts). */
function hazardPos(cave: Cave, h: CaveHazard): { x: number; y: number } {
  const x = h.wx - cave.dist
  const frame = frameAt(cave, h.wx)
  const walls = wallsAt(cave, h.wx)
  if (h.kind === 'jelly') return { x, y: frame.c + Math.sin(cave.age * 1.5 + h.phase) * frame.g * 0.24 }
  if (h.kind === 'urchin' && h.side !== 0) return { x, y: h.side < 0 ? walls.top + 14 : walls.bottom - 14 }
  return { x, y: frame.c + h.offset * frame.g }
}

const visible = (s: GameState, cave: Cave, h: CaveHazard) => {
  const x = h.wx - cave.dist
  return x > -80 && x < s.width + 80
}

/** Gua lengkap: latar, dinding, rintangan, dan gelap di luar lampu penyelam (penyelam digambar sesudahnya). */
export function drawCave(ctx: CanvasRenderingContext2D, s: GameState, cave: Cave, clock: number) {
  const closed = closedness(s, cave)
  drawBackdrop(ctx, s, cave, closed)
  drawWalls(ctx, s, cave, clock)
  for (const h of cave.hazards) {
    if (!visible(s, cave, h) || ((h.kind === 'pearl' || h.kind === 'oxygen') && h.done)) continue
    if (h.kind === 'moray') drawMoray(ctx, cave, h, clock)
    else {
      const { x, y } = hazardPos(cave, h)
      if (h.kind === 'urchin') drawUrchin(ctx, x, y, h, clock)
      else if (h.kind === 'jelly') drawJelly(ctx, x, y, h, clock)
      else if (h.kind === 'oxygen') drawOxygen(ctx, x, y, clock)
      else drawPearl(ctx, x, y, clock)
    }
  }

  // Gelap gua: terang hanya di sekitar penyelam dan ke depan.
  const { darkness } = seaAt(s.depth)
  const shade = (0.3 + darkness * 0.45) * closed
  const cx = cave.x + 110
  const light = ctx.createRadialGradient(cx, cave.y, 110, cx, cave.y, Math.max(s.width, 600) * 0.8)
  light.addColorStop(0, 'rgba(0, 3, 10, 0)')
  light.addColorStop(1, `rgba(0, 3, 10, ${shade})`)
  ctx.fillStyle = light
  ctx.fillRect(0, 0, s.width, s.height)

  // Cahaya yang tetap terlihat di gelap: mata belut di lubang, ubur-ubur api, mutiara.
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const h of cave.hazards) {
    if (!visible(s, cave, h) || h.done) continue
    if (h.kind === 'moray') {
      if (morayExtent(h) > 0.02) continue
      const x = h.wx - cave.dist
      const walls = wallsAt(cave, h.wx)
      const y = (h.side < 0 ? walls.top : walls.bottom) + h.side * 2
      // Mata berkilat di dalam lubang: tanda ada belut.
      if (Math.sin(clock * 2.5 + h.phase) > -0.7) {
        ctx.fillStyle = 'rgba(255, 230, 90, 0.95)'
        ctx.fillRect(x - 6, y - 1.5, 3, 3)
        ctx.fillRect(x + 3, y - 1.5, 3, 3)
      }
      continue
    }
    const { x, y } = hazardPos(cave, h)
    const color = h.kind === 'jelly' ? '255, 120, 80' : h.kind === 'pearl' ? '255, 225, 140' : h.kind === 'oxygen' ? '160, 235, 255' : '190, 120, 255'
    const r = h.kind === 'urchin' ? 32 : 30
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r)
    glow.addColorStop(0, `rgba(${color}, ${h.kind === 'urchin' ? 0.3 : 0.35})`)
    glow.addColorStop(1, `rgba(${color}, 0)`)
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Bar kemajuan gua di HUD (menggantikan nama zona). */
export function drawCaveBar(ctx: CanvasRenderingContext2D, s: GameState, cave: Cave) {
  const w = Math.min(240, s.width * 0.34)
  const x = s.width / 2 - w / 2
  const y = 58
  ctx.textAlign = 'center'
  ctx.font = `700 11px ${FONT}`
  ctx.fillStyle = '#7ff7ff'
  ctx.fillText(`ARUS GUA · ${cave.pearls} mutiara${cave.hits ? ` · ${cave.hits}× tergores` : ''}`, s.width / 2, 48)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.beginPath()
  ctx.roundRect(x, y, w, 8, 4)
  ctx.fill()
  const ratio = Math.min(1, cave.dist / cave.end)
  ctx.fillStyle = '#58e1ff'
  ctx.beginPath()
  ctx.roundRect(x, y, Math.max(8, w * ratio), 8, 4)
  ctx.fill()
}
