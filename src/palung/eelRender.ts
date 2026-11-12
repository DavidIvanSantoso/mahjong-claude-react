import { EEL, WORLD } from './config'
import { diverY, type EelBoss, type GameState } from './engine'

/**
 * Menggambar Belut Listrik (bos memori): badan belut, bola listrik berhuruf, sambaran petir, dan panel
 * urutan huruf di bawah HUD. Semua bentuk dibuat dari kanvas.
 */

const FONT = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'
const CYAN = '127, 247, 255'

/** Petir bergerigi dari (x1,y1) ke (x2,y2); bentuknya acak tiap frame supaya berkedip. */
function lightning(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, jag = 14) {
  const length = Math.hypot(x2 - x1, y2 - y1)
  const steps = Math.max(4, Math.round(length / 22))
  const nx = -(y2 - y1) / (length || 1)
  const ny = (x2 - x1) / (length || 1)
  const path = new Path2D()
  path.moveTo(x1, y1)
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const offset = (Math.random() - 0.5) * 2 * jag
    path.lineTo(x1 + (x2 - x1) * t + nx * offset, y1 + (y2 - y1) * t + ny * offset)
  }
  path.lineTo(x2, y2)
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = `rgba(${CYAN}, 0.35)`
  ctx.lineWidth = width * 3
  ctx.stroke(path)
  ctx.strokeStyle = '#eaffff'
  ctx.lineWidth = width
  ctx.stroke(path)
  ctx.restore()
}

/**
 * Badan belut menghadap kiri, kepala di (0,0), badan memanjang ke kanan sambil meliuk. `charge` 0–1 =
 * seberapa terang organ listriknya, `flash` = kilatan putih saat tersambar.
 */
export function drawEelBody(ctx: CanvasRenderingContext2D, age: number, charge: number, flash: number) {
  const count = 11
  const seg = 24
  const points = Array.from({ length: count + 1 }, (_, k) => ({
    x: 14 + k * seg,
    y: Math.sin(age * 2.4 - k * 0.55) * (4 + k * 2.4),
    w: Math.max(10, 34 - k * 2),
  }))
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Sirip bawah yang panjang, bergelombang
  ctx.fillStyle = 'rgba(70, 96, 120, 0.85)'
  ctx.beginPath()
  ctx.moveTo(points[1].x, points[1].y + points[1].w * 0.4)
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y + p.w * 0.4)
  for (let k = count; k >= 1; k--) {
    const p = points[k]
    ctx.lineTo(p.x, p.y + p.w * 0.4 + 9 + Math.sin(age * 8 + k) * 3)
  }
  ctx.closePath()
  ctx.fill()
  // Badan
  ctx.strokeStyle = '#25374a'
  for (let k = count - 1; k >= 0; k--) {
    ctx.lineWidth = points[k].w
    ctx.beginPath()
    ctx.moveTo(points[k].x, points[k].y)
    ctx.lineTo(points[k + 1].x, points[k + 1].y)
    ctx.stroke()
  }
  // Garis perut jingga
  ctx.strokeStyle = 'rgba(224, 140, 60, 0.85)'
  ctx.lineWidth = 4
  ctx.beginPath()
  points.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y + p.w * 0.28) : ctx.moveTo(p.x, p.y + p.w * 0.28)))
  ctx.stroke()
  // Organ listrik: bintik-bintik di punggung
  for (let k = 1; k < count; k++) {
    const p = points[k]
    const flicker = 0.6 + Math.sin(age * 20 + k * 1.7) * 0.4
    ctx.fillStyle = `rgba(${CYAN}, ${0.25 + 0.7 * charge * flicker})`
    ctx.beginPath()
    ctx.arc(p.x, p.y - p.w * 0.18, Math.max(2, p.w * 0.12), 0, Math.PI * 2)
    ctx.fill()
  }
  // Kepala
  ctx.fillStyle = '#2d4258'
  ctx.beginPath()
  ctx.ellipse(-2, 0, 30, 19, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.beginPath()
  ctx.ellipse(-6, -8, 18, 6, -0.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#111b26'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-30, 4)
  ctx.quadraticCurveTo(-20, 10, -8, 8)
  ctx.stroke()
  ctx.fillStyle = charge > 0.6 ? '#eaffff' : '#d8e4ee'
  ctx.beginPath()
  ctx.arc(-15, -6, 4.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#05080c'
  ctx.beginPath()
  ctx.arc(-16, -6, 2.2, 0, Math.PI * 2)
  ctx.fill()
  if (flash > 0) {
    ctx.globalAlpha = Math.min(0.8, flash * 2)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(-2, 0, 30, 19, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    for (let k = 0; k < count; k++) {
      ctx.lineWidth = points[k].w
      ctx.beginPath()
      ctx.moveTo(points[k].x, points[k].y)
      ctx.lineTo(points[k + 1].x, points[k + 1].y)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function charge(e: EelBoss): number {
  if (e.phase === 'show' || e.phase === 'memorize' || e.phase === 'shock' || e.phase === 'release') return 1
  if (e.phase === 'zap') return 0.2
  return 0.45
}

/** Ukuran bos di arena (gambar dasar dipakai juga untuk pratinjau panduan). */
const EEL_SCALE = 1.45

function eelTransform(ctx: CanvasRenderingContext2D, e: EelBoss) {
  ctx.translate(e.x, e.y)
  ctx.scale(EEL_SCALE, EEL_SCALE)
  if (e.phase === 'dying') ctx.rotate(Math.min(0.6, (1 - e.timer / 2.2) * 0.6))
  if (e.phase === 'zap' && e.timer > 0.7) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6)
}

/** Badan bos (digambar sebelum kegelapan laut). */
export function drawEel(ctx: CanvasRenderingContext2D, e: EelBoss) {
  if (e.phase === 'warning') return
  ctx.save()
  if (e.phase === 'dying') ctx.globalAlpha = Math.max(0, Math.min(1, e.timer / 0.9))
  eelTransform(ctx, e)
  drawEelBody(ctx, e.age, charge(e), e.hitFlash)
  ctx.restore()
}

/** Cahaya organ listrik dan percikan petir di sekitar kepala (di atas kegelapan). */
export function drawEelGlow(ctx: CanvasRenderingContext2D, e: EelBoss, clock: number) {
  if (e.phase === 'warning' || e.phase === 'dying') return
  const level = charge(e)
  ctx.save()
  eelTransform(ctx, e)
  ctx.globalCompositeOperation = 'lighter'
  const glow = ctx.createRadialGradient(60, 0, 10, 60, 0, 170)
  glow.addColorStop(0, `rgba(${CYAN}, ${0.12 + level * 0.18})`)
  glow.addColorStop(1, `rgba(${CYAN}, 0)`)
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(60, 0, 170, 0, Math.PI * 2)
  ctx.fill()
  // Percikan kecil di sekitar kepala saat bermuatan penuh
  if (level >= 1 && Math.sin(clock * 30) > -0.2) {
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2
      lightning(ctx, -10, 0, -10 + Math.cos(a) * 48, Math.sin(a) * 40, 1.2, 6)
    }
  }
  ctx.restore()
}

/** Bola listrik berhuruf. */
function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, letter: string, flash: number, clock: number) {
  const r = 21
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const halo = ctx.createRadialGradient(x, y, 4, x, y, r * 2.1)
  halo.addColorStop(0, flash > 0 ? 'rgba(255, 90, 90, 0.5)' : `rgba(${CYAN}, 0.45)`)
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(x, y, r * 2.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  const core = ctx.createRadialGradient(x - 5, y - 6, 2, x, y, r)
  core.addColorStop(0, '#ffffff')
  core.addColorStop(0.55, flash > 0 ? '#ffb0b0' : '#b8fbff')
  core.addColorStop(1, flash > 0 ? '#ff5d5d' : '#38c6ff')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  // Percikan di permukaan bola
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 3; i++) {
    const a = clock * 3 + i * 2.1 + Math.random() * 0.6
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9)
    ctx.lineTo(x + Math.cos(a + 0.15) * (r + 7), y + Math.sin(a + 0.15) * (r + 7))
    ctx.lineTo(x + Math.cos(a + 0.3) * (r + 3), y + Math.sin(a + 0.3) * (r + 3))
    ctx.stroke()
  }
  ctx.restore()
  ctx.fillStyle = '#04202c'
  ctx.font = `800 22px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letter, x, y + 1)
}

const holdTime = (e: EelBoss) => Math.max(EEL.minHold, EEL.hold + EEL.holdPerWin * e.wins)

/** Panel urutan huruf di bawah HUD. */
function drawPanel(ctx: CanvasRenderingContext2D, s: GameState, e: EelBoss) {
  const n = e.sequence.length
  if (!n || e.phase === 'enter' || e.phase === 'dying') return
  const cell = 38
  const gap = 7
  const w = n * cell + (n - 1) * gap + 28
  const h = 70
  const x = s.width / 2 - w / 2 + (e.wrong > 0 ? Math.sin(e.wrong * 90) * 5 : 0)
  const y = 80
  ctx.save()
  ctx.fillStyle = 'rgba(3, 14, 28, 0.86)'
  ctx.strokeStyle = e.wrong > 0 ? '#ff5d5d' : `rgba(${CYAN}, 0.55)`
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, 10)
  ctx.fill()
  ctx.stroke()

  const typing = e.phase === 'release' || e.phase === 'orbs'
  const label =
    e.phase === 'show' || e.phase === 'memorize'
      ? 'INGAT URUTANNYA!'
      : e.phase === 'zap'
        ? 'URUTAN BENAR!'
        : e.phase === 'shock'
          ? 'TERLAMBAT! INI URUTANNYA'
          : e.peek > 0
            ? 'SONAR: URUTAN TAMPIL SEBENTAR'
            : 'KETIK URUTANNYA DARI INGATAN'
  ctx.font = `700 11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = e.phase === 'shock' ? '#ff8a8a' : e.phase === 'zap' ? '#ffd447' : `rgb(${CYAN})`
  ctx.fillText(label, s.width / 2, y + 13)

  ctx.font = `800 22px ${FONT}`
  for (let i = 0; i < n; i++) {
    const cx = x + 14 + i * (cell + gap)
    const cy = y + 26
    let letter = ''
    let color = 'rgba(255, 255, 255, 0.35)'
    let fill = 'rgba(255, 255, 255, 0.06)'
    if (e.phase === 'show') {
      if (i < e.shown) {
        letter = e.sequence[i]
        color = '#ffffff'
        fill = i === e.shown - 1 ? `rgba(${CYAN}, 0.45)` : `rgba(${CYAN}, 0.16)`
      }
    } else if (e.phase === 'memorize') {
      letter = e.sequence[i]
      color = '#ffffff'
      fill = `rgba(${CYAN}, 0.16)`
    } else if (typing) {
      if (i < e.index) {
        letter = e.sequence[i]
        color = '#1a1300'
        fill = '#ffd447'
      } else if (e.peek > 0) {
        letter = e.sequence[i]
        color = `rgba(${CYAN}, 0.9)`
      } else {
        letter = '?'
        if (i === e.index) fill = 'rgba(255, 212, 71, 0.16)'
      }
    } else if (e.phase === 'zap') {
      letter = e.sequence[i]
      color = '#1a1300'
      fill = '#ffd447'
    } else if (e.phase === 'shock') {
      letter = e.sequence[i]
      color = i < e.index ? '#1a1300' : '#ffffff'
      fill = i < e.index ? '#ffd447' : 'rgba(255, 93, 93, 0.45)'
    }
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.roundRect(cx, cy, cell, cell, 7)
    ctx.fill()
    if (typing && i === e.index) {
      ctx.strokeStyle = '#ffd447'
      ctx.lineWidth = 2
      ctx.stroke()
    }
    ctx.fillStyle = color
    ctx.fillText(letter, cx + cell / 2, cy + cell / 2 + 1)
  }
  // Hitung mundur hafalan
  if (e.phase === 'memorize') {
    ctx.fillStyle = `rgba(${CYAN}, 0.8)`
    ctx.fillRect(x + 10, y + h - 5, (w - 20) * Math.max(0, e.timer / holdTime(e)), 3)
  }
  ctx.restore()
}

/** Lapisan atas: bola listrik, sambaran petir, dan panel urutan. */
export function drawEelTop(ctx: CanvasRenderingContext2D, s: GameState, e: EelBoss, clock: number) {
  if (e.phase === 'release' || e.phase === 'orbs') {
    for (const orb of e.orbs) if (!orb.done) drawOrb(ctx, orb.x, orb.y, orb.letter, orb.flash, clock)
  }
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  if (e.phase === 'zap' && e.timer > 0.55) lightning(ctx, WORLD.diverX + 50, diverY(s), e.x - 35, e.y, 3, 22)
  if (e.phase === 'shock' && e.timer > 0.7) {
    lightning(ctx, e.x - 45, e.y, WORLD.diverX + 20, diverY(s), 3, 26)
    for (let i = 0; i < 3; i++) lightning(ctx, WORLD.diverX + 20, diverY(s), WORLD.diverX + 20 + (Math.random() - 0.5) * 120, diverY(s) + (Math.random() - 0.5) * 120, 1.5, 8)
  }
  ctx.restore()
  drawPanel(ctx, s, e)
}
