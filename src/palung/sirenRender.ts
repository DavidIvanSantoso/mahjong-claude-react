import { SIREN } from './config'
import type { GameState, SirenBoss } from './engine'

/**
 * Menggambar Siren: badannya (rambut rumput laut, ekor ikan, mahkota kerang), Nada, serangan saat fase
 * menghindar (dinding gelombang dan not), trisula, dan tanda kontrol terbalik. Semua bentuk dibuat dari kanvas.
 */

const FONT = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'
const PINK = '255, 120, 200'

/**
 * Siren menghadap kiri; kepala di sekitar (0,-40), ekor melengkung ke kanan bawah. `sing` 0–1 = mulut
 * terbuka/aura, `flash` = kilatan saat terkena.
 */
export function drawSirenBody(ctx: CanvasRenderingContext2D, age: number, sing: number, flash: number) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const sway = Math.sin(age * 1.6)

  // Rambut panjang seperti rumput laut, melambai ke belakang (kanan)
  const hair = ['#5b2e8c', '#7140a8', '#8a55c4', '#6a3a9e']
  hair.forEach((color, i) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 9 - i
    ctx.beginPath()
    ctx.moveTo(4, -52 + i * 5)
    for (let t = 1; t <= 6; t++) {
      ctx.lineTo(4 + t * 15, -50 + i * 6 + t * 9 + Math.sin(age * 2.2 + t * 0.8 + i) * (3 + t * 1.6))
    }
    ctx.stroke()
  })

  // Ekor ikan: melengkung ke kanan bawah, bersisik
  const tail = [
    { x: 6, y: 18 },
    { x: 26, y: 46 + sway * 3 },
    { x: 56, y: 64 + sway * 6 },
    { x: 90, y: 66 + sway * 10 },
  ]
  ctx.strokeStyle = '#2c8f8c'
  for (let i = 0; i < tail.length - 1; i++) {
    ctx.lineWidth = 30 - i * 7
    ctx.beginPath()
    ctx.moveTo(tail[i].x, tail[i].y)
    ctx.lineTo(tail[i + 1].x, tail[i + 1].y)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(160, 255, 230, 0.35)'
  for (let i = 0; i < 9; i++) {
    const t = i / 9
    const x = 10 + t * 70
    const y = 26 + Math.sin(t * 2.4) * 36 + sway * t * 6
    ctx.beginPath()
    ctx.arc(x, y, 3.5 - t * 1.5, Math.PI * 0.1, Math.PI * 0.9)
    ctx.fill()
  }
  // Sirip ekor
  ctx.save()
  ctx.translate(tail[3].x, tail[3].y)
  ctx.rotate(0.2 + sway * 0.25)
  ctx.fillStyle = '#3fb7ae'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(26, -26, 40, -22)
  ctx.quadraticCurveTo(26, -4, 22, 2)
  ctx.quadraticCurveTo(30, 14, 38, 26)
  ctx.quadraticCurveTo(18, 22, 0, 0)
  ctx.fill()
  ctx.restore()

  // Badan atas dengan pelindung sisik
  ctx.fillStyle = '#9cc8d8'
  ctx.beginPath()
  ctx.ellipse(4, -6, 17, 28, 0.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#2c8f8c'
  ctx.beginPath()
  ctx.ellipse(5, 2, 17, 18, 0.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(160, 255, 230, 0.35)'
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.arc(-4 + (i % 2) * 9, -2 + Math.floor(i / 2) * 9, 3, Math.PI * 0.1, Math.PI * 0.9)
    ctx.fill()
  }
  // Lengan terulur ke depan (bernyanyi)
  ctx.strokeStyle = '#9cc8d8'
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(-6, -18)
  ctx.quadraticCurveTo(-22, -12 + sway * 4, -34, -22 + sway * 6)
  ctx.stroke()

  // Kepala, sirip telinga, mahkota kerang
  ctx.fillStyle = '#3fb7ae'
  ctx.beginPath()
  ctx.moveTo(6, -46)
  ctx.lineTo(18, -58)
  ctx.lineTo(14, -40)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#a9d3e2'
  ctx.beginPath()
  ctx.arc(-2, -44, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f2b8d0'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(-10 + i * 7, -57)
    ctx.lineTo(-7 + i * 7, -68 - (i === 1 ? 4 : 0))
    ctx.lineTo(-4 + i * 7, -57)
    ctx.closePath()
    ctx.fill()
  }
  // Mata bercahaya dan mulut bernyanyi
  ctx.fillStyle = sing > 0.5 ? '#ffe1f4' : '#c7f6ff'
  ctx.beginPath()
  ctx.ellipse(-10, -46, 3.4, 2.4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3a0f2c'
  ctx.beginPath()
  ctx.ellipse(-13, -37, 2.5, 1.5 + sing * 3, 0, 0, Math.PI * 2)
  ctx.fill()

  if (flash > 0) {
    ctx.globalAlpha = Math.min(0.7, flash * 2)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(-2, -44, 15, 0, Math.PI * 2)
    ctx.ellipse(4, -6, 17, 28, 0.1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

const SIREN_SCALE = 1.5

function singLevel(sn: SirenBoss): number {
  if (sn.phase === 'charge' || sn.phase === 'dodge') return 1
  if (sn.phase === 'sing') return 0.35 + Math.max(0, Math.sin(sn.age * 5)) * 0.4
  return 0.1
}

function sirenTransform(ctx: CanvasRenderingContext2D, sn: SirenBoss) {
  ctx.translate(sn.x, sn.y)
  ctx.scale(SIREN_SCALE, SIREN_SCALE)
  if (sn.phase === 'charge') ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3)
  if (sn.phase === 'dying') ctx.rotate(Math.min(0.8, (1 - sn.timer / 2.4) * 0.8))
}

/** Badan Siren (sebelum kegelapan laut). */
export function drawSiren(ctx: CanvasRenderingContext2D, sn: SirenBoss) {
  if (sn.phase === 'warning') return
  ctx.save()
  if (sn.phase === 'dying') ctx.globalAlpha = Math.max(0, Math.min(1, sn.timer / 0.9))
  sirenTransform(ctx, sn)
  drawSirenBody(ctx, sn.age, singLevel(sn), sn.hitFlash)
  ctx.restore()
}

/** Aura nyanyian dan mata bercahaya (di atas kegelapan). */
export function drawSirenGlow(ctx: CanvasRenderingContext2D, sn: SirenBoss, clock: number) {
  if (sn.phase === 'warning' || sn.phase === 'dying') return
  const level = singLevel(sn)
  ctx.save()
  sirenTransform(ctx, sn)
  ctx.globalCompositeOperation = 'lighter'
  const eye = ctx.createRadialGradient(-10, -46, 0, -10, -46, 14)
  eye.addColorStop(0, `rgba(${PINK}, 0.8)`)
  eye.addColorStop(1, `rgba(${PINK}, 0)`)
  ctx.fillStyle = eye
  ctx.beginPath()
  ctx.arc(-10, -46, 14, 0, Math.PI * 2)
  ctx.fill()
  // Lingkaran suara dari mulut
  for (let i = 0; i < 3; i++) {
    const t = (clock * 0.8 + i / 3) % 1
    ctx.strokeStyle = `rgba(${PINK}, ${(1 - t) * 0.45 * level})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(-14, -37, 8 + t * 46, Math.PI * 0.6, Math.PI * 1.4)
    ctx.stroke()
  }
  ctx.restore()
}

/** Not musik (Nada Siren, dan not serangan). */
export function drawNote(ctx: CanvasRenderingContext2D, r: number, age: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2)
  halo.addColorStop(0, `rgba(${PINK}, 0.5)`)
  halo.addColorStop(1, `rgba(${PINK}, 0)`)
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(0, 0, r * 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.rotate(Math.sin(age * 4) * 0.2)
  ctx.fillStyle = '#ffd6ef'
  ctx.strokeStyle = '#ffd6ef'
  ctx.lineWidth = r * 0.22
  ctx.beginPath()
  ctx.ellipse(-r * 0.25, r * 0.4, r * 0.42, r * 0.3, -0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(r * 0.12, r * 0.35)
  ctx.lineTo(r * 0.12, -r * 0.75)
  ctx.quadraticCurveTo(r * 0.5, -r * 0.5, r * 0.62, -r * 0.15)
  ctx.stroke()
  ctx.restore()
}

/** Dinding gelombang suara dengan satu celah. */
function drawWave(ctx: CanvasRenderingContext2D, s: GameState, x: number, gapY: number, gap: number, clock: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const top = gapY - gap / 2
  const bottom = gapY + gap / 2
  for (const [from, to] of [
    [0, top],
    [bottom, s.height],
  ]) {
    if (to - from < 4) continue
    const band = ctx.createLinearGradient(x - 14, 0, x + 14, 0)
    band.addColorStop(0, `rgba(${PINK}, 0)`)
    band.addColorStop(0.5, `rgba(${PINK}, 0.55)`)
    band.addColorStop(1, `rgba(${PINK}, 0)`)
    ctx.fillStyle = band
    ctx.fillRect(x - 14, from, 28, to - from)
    ctx.strokeStyle = 'rgba(255, 220, 240, 0.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let y = from; y <= to; y += 6) {
      const wx = x + Math.sin(y * 0.09 + clock * 14) * 5
      if (y === from) ctx.moveTo(wx, y)
      else ctx.lineTo(wx, y)
    }
    ctx.stroke()
  }
  ctx.restore()
  // Tepi celah
  ctx.fillStyle = 'rgba(255, 220, 240, 0.9)'
  ctx.fillRect(x - 10, top - 2, 20, 3)
  ctx.fillRect(x - 10, bottom - 1, 20, 3)
}

/** Trisula emas (menghadap kanan). */
function drawTrident(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(scale, scale)
  ctx.strokeStyle = '#ffd447'
  ctx.lineCap = 'round'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(-26, 0)
  ctx.lineTo(14, 0)
  ctx.moveTo(10, -10)
  ctx.quadraticCurveTo(14, 0, 10, 10)
  ctx.moveTo(10, -10)
  ctx.lineTo(24, -10)
  ctx.moveTo(10, 10)
  ctx.lineTo(24, 10)
  ctx.moveTo(14, 0)
  ctx.lineTo(28, 0)
  ctx.stroke()
  ctx.fillStyle = '#fff3b0'
  for (const ty of [-10, 0, 10]) {
    ctx.beginPath()
    ctx.moveTo(ty === 0 ? 28 : 24, ty - 3)
    ctx.lineTo(ty === 0 ? 34 : 30, ty)
    ctx.lineTo(ty === 0 ? 28 : 24, ty + 3)
    ctx.fill()
  }
  ctx.restore()
}

/** Lapisan atas: serangan, trisula, dan tanda kontrol terbalik + waktu. */
export function drawSirenTop(ctx: CanvasRenderingContext2D, s: GameState, sn: SirenBoss, clock: number) {
  for (const shot of sn.shots) {
    if (shot.kind === 'wave') drawWave(ctx, s, shot.x, shot.y, shot.gap, clock)
    else {
      ctx.save()
      ctx.translate(shot.x, shot.y)
      drawNote(ctx, 13, clock + shot.x * 0.01)
      ctx.restore()
    }
  }
  if (sn.phase === 'dodge' || sn.phase === 'powerup' || sn.phase === 'charge') {
    // Ungu tipis di tepi layar: tanda kontrol terbalik.
    const pulse = 0.5 + Math.sin(clock * 6) * 0.5
    const edge = ctx.createRadialGradient(s.width / 2, s.height / 2, s.height * 0.4, s.width / 2, s.height / 2, s.width * 0.75)
    edge.addColorStop(0, 'rgba(150, 60, 200, 0)')
    edge.addColorStop(1, `rgba(150, 60, 200, ${0.16 + pulse * 0.1})`)
    ctx.fillStyle = edge
    ctx.fillRect(0, 0, s.width, s.height)
  }
  if (sn.power) {
    const { x, y } = sn.power
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 46)
    glow.addColorStop(0, 'rgba(255, 220, 90, 0.6)')
    glow.addColorStop(1, 'rgba(255, 220, 90, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, 46, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    drawTrident(ctx, x, y + Math.sin(clock * 3) * 3, -Math.PI / 4, 1.1)
    // Cincin waktu
    ctx.strokeStyle = 'rgba(255, 212, 71, 0.85)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, sn.timer / SIREN.powerTime))
    ctx.stroke()
  }
  if (sn.phase === 'strike' && sn.from) {
    const t = 1 - Math.max(0, sn.timer) / 0.8
    const tx = sn.x - 20
    const ty = sn.y - 30
    const x = sn.from.x + (tx - sn.from.x) * t
    const y = sn.from.y + (ty - sn.from.y) * t - Math.sin(t * Math.PI) * 60
    ctx.strokeStyle = 'rgba(255, 220, 110, 0.4)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(sn.from.x, sn.from.y)
    ctx.lineTo(x, y)
    ctx.stroke()
    drawTrident(ctx, x, y, Math.atan2(ty - sn.from.y, tx - sn.from.x), 1.4)
  }
  if (sn.phase === 'dodge' || sn.phase === 'powerup') {
    // Tanda di bawah HUD: kontrol terbalik dan sisa waktu.
    const w = 260
    const x = s.width / 2 - w / 2
    const y = 82
    ctx.fillStyle = 'rgba(30, 6, 40, 0.85)'
    ctx.beginPath()
    ctx.roundRect(x, y, w, 34, 8)
    ctx.fill()
    ctx.font = `800 13px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ff9be0'
    ctx.fillText(sn.phase === 'dodge' ? 'KONTROL TERBALIK · HINDARI!' : 'AMBIL TRISULANYA!', s.width / 2, y + 13)
    const total = sn.phase === 'dodge' ? sn.dodgeTime : SIREN.powerTime
    ctx.fillStyle = sn.phase === 'dodge' ? `rgb(${PINK})` : '#ffd447'
    ctx.fillRect(x + 10, y + 26, (w - 20) * Math.max(0, sn.timer / total), 3)
    if (sn.struck && sn.phase === 'dodge') {
      ctx.font = `700 11px ${FONT}`
      ctx.fillStyle = '#ff8a8a'
      ctx.fillText('terkena · trisula batal', s.width / 2, y + 46)
    }
  }
}

/** Dipakai label Nada: tanda kecil bahwa kata diketik dari belakang. */
export const REVERSED_HINT = '◂ ketik dari belakang'
