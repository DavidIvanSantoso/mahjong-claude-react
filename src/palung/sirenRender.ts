import { drawEye, tentacle } from './art'
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

  // Rambut panjang seperti rumput laut, melambai ke belakang (kanan), dengan kilau dan mutiara kecil
  const hair = ['#4a2378', '#6236a0', '#7d4cbd', '#5a2f92', '#8f5fd0']
  const strands = hair.map((color, i) => {
    const pts: [number, number][] = [[2 - i, -54 + i * 4.5]]
    for (let t = 1; t <= 7; t++) pts.push([2 + t * 14, -52 + i * 5.5 + t * 8.5 + Math.sin(age * 2.2 + t * 0.8 + i) * (3 + t * 1.7)])
    return { color, pts, width: 13 - i * 1.4 }
  })
  for (const strand of strands) tentacle(ctx, strand.pts, strand.width, strand.color, null, 'rgba(30, 8, 50, 0.4)', 0.8)
  ctx.strokeStyle = 'rgba(230, 200, 255, 0.35)'
  ctx.lineWidth = 1.2
  for (const strand of strands.slice(1, 4)) {
    ctx.beginPath()
    strand.pts.slice(0, 5).forEach(([x, y], k) => (k ? ctx.lineTo(x, y - 2) : ctx.moveTo(x, y - 2)))
    ctx.stroke()
  }
  for (const [i, t] of [
    [1, 3],
    [3, 5],
  ]) {
    const [x, y] = strands[i].pts[t]
    ctx.fillStyle = '#fdf6ff'
    ctx.beginPath()
    ctx.arc(x, y, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  // Ekor ikan: satu bentuk meruncing bergradasi, bersisik
  const tail: [number, number][] = [
    [5, 6],
    [10, 26],
    [26, 46 + sway * 3],
    [44, 58 + sway * 5],
    [64, 64 + sway * 7],
    [90, 66 + sway * 10],
  ]
  const tailSkin = ctx.createLinearGradient(0, 0, 90, 70)
  tailSkin.addColorStop(0, '#2a9c96')
  tailSkin.addColorStop(0.6, '#1f7a7c')
  tailSkin.addColorStop(1, '#3fc4b4')
  tentacle(ctx, tail, 34, tailSkin, null, 'rgba(8, 40, 44, 0.6)', 0.55)
  ctx.lineWidth = 1.1
  for (let i = 0; i < 14; i++) {
    const t = i / 14
    const seg = Math.min(tail.length - 2, Math.floor(t * (tail.length - 1)))
    const f = t * (tail.length - 1) - seg
    const x = tail[seg][0] + (tail[seg + 1][0] - tail[seg][0]) * f
    const y = tail[seg][1] + (tail[seg + 1][1] - tail[seg][1]) * f
    const r = 4.2 - t * 2.4
    ctx.strokeStyle = `rgba(170, 255, 235, ${0.45 - t * 0.2})`
    for (const off of [-0.45, 0.1]) {
      ctx.beginPath()
      ctx.arc(x + off * 6, y + off * 8, r, Math.PI * 0.1, Math.PI * 0.9)
      ctx.stroke()
    }
  }
  // Sirip ekor tembus pandang dengan jari-jari
  ctx.save()
  ctx.translate(tail[5][0], tail[5][1])
  ctx.rotate(0.2 + sway * 0.25)
  const fin = ctx.createLinearGradient(0, 0, 42, 0)
  fin.addColorStop(0, 'rgba(63, 196, 180, 0.95)')
  fin.addColorStop(1, 'rgba(160, 255, 235, 0.55)')
  ctx.fillStyle = fin
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(26, -28, 44, -24)
  ctx.quadraticCurveTo(30, -6, 26, 2)
  ctx.quadraticCurveTo(34, 14, 42, 30)
  ctx.quadraticCurveTo(18, 24, 0, 0)
  ctx.fill()
  ctx.strokeStyle = 'rgba(220, 255, 245, 0.5)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const [ex, ey] of [
    [40, -22],
    [30, -12],
    [28, 2],
    [32, 14],
    [38, 26],
  ]) {
    ctx.moveTo(2, 0)
    ctx.lineTo(ex, ey)
  }
  ctx.stroke()
  ctx.restore()

  // Badan atas: kulit bergradasi dan pelindung sisik
  const skin = ctx.createRadialGradient(-2, -18, 2, 4, -6, 30)
  skin.addColorStop(0, '#d6f0f8')
  skin.addColorStop(1, '#7fb0c4')
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(4, -6, 17, 28, 0.1, 0, Math.PI * 2)
  ctx.fill()
  const armor = ctx.createLinearGradient(0, -14, 0, 20)
  armor.addColorStop(0, '#3fc4b4')
  armor.addColorStop(1, '#1d6f72')
  ctx.fillStyle = armor
  ctx.beginPath()
  ctx.ellipse(5, 2, 17, 18, 0.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(190, 255, 240, 0.55)'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 6; i++) {
    ctx.beginPath()
    ctx.arc(-6 + (i % 3) * 8 + (Math.floor(i / 3) % 2) * 4, -4 + Math.floor(i / 3) * 8, 3.5, Math.PI * 0.1, Math.PI * 0.9)
    ctx.stroke()
  }
  // Kalung mutiara
  ctx.fillStyle = '#fff7fd'
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.arc(-8 + i * 4.5, -22 - Math.abs(i - 2) * 1.2, 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
  // Lengan terulur ke depan (bernyanyi), dengan tangan
  const arm = ctx.createLinearGradient(-34, -22, -6, -18)
  arm.addColorStop(0, '#c6e6f2')
  arm.addColorStop(1, '#8fbfd2')
  ctx.strokeStyle = arm
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(-6, -18)
  ctx.quadraticCurveTo(-22, -12 + sway * 4, -34, -22 + sway * 6)
  ctx.stroke()
  ctx.fillStyle = '#c6e6f2'
  ctx.beginPath()
  ctx.ellipse(-37, -24 + sway * 6, 4.5, 3.4, -0.5, 0, Math.PI * 2)
  ctx.fill()

  // Sirip telinga tembus pandang
  ctx.fillStyle = 'rgba(63, 196, 180, 0.85)'
  ctx.beginPath()
  ctx.moveTo(6, -46)
  ctx.quadraticCurveTo(16, -62, 22, -60)
  ctx.quadraticCurveTo(16, -50, 14, -40)
  ctx.closePath()
  ctx.fill()
  // Kepala
  const face = ctx.createRadialGradient(-6, -50, 2, -2, -44, 16)
  face.addColorStop(0, '#e6f6fb')
  face.addColorStop(1, '#8dbfd2')
  ctx.fillStyle = face
  ctx.beginPath()
  ctx.arc(-2, -44, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(30, 60, 80, 0.35)'
  ctx.lineWidth = 1
  ctx.stroke()
  // Poni rambut di dahi
  ctx.fillStyle = '#5a2f92'
  ctx.beginPath()
  ctx.moveTo(-16, -50)
  ctx.quadraticCurveTo(-8, -64, 10, -56)
  ctx.quadraticCurveTo(4, -54, -2, -52)
  ctx.quadraticCurveTo(-10, -52, -16, -50)
  ctx.fill()
  // Mahkota kerang mengilap
  const shell = ctx.createLinearGradient(0, -75, 0, -56)
  shell.addColorStop(0, '#fff0f8')
  shell.addColorStop(1, '#e48fb8')
  ctx.fillStyle = shell
  for (let i = 0; i < 3; i++) {
    const tall = i === 1 ? 5 : 0
    ctx.beginPath()
    ctx.moveTo(-11 + i * 7, -57)
    ctx.quadraticCurveTo(-9 + i * 7, -66 - tall, -7 + i * 7, -70 - tall)
    ctx.quadraticCurveTo(-5 + i * 7, -66 - tall, -3 + i * 7, -57)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(-3, -58, 2, 0, Math.PI * 2)
  ctx.fill()
  // Pipi merona, mata, alis, dan mulut bernyanyi
  ctx.fillStyle = 'rgba(255, 150, 190, 0.35)'
  ctx.beginPath()
  ctx.ellipse(-9, -40, 3.5, 2, 0, 0, Math.PI * 2)
  ctx.fill()
  if (sing > 0.5) {
    drawEye(ctx, -10, -46, 2.8, 'glow', '#ff9be0')
  } else {
    ctx.fillStyle = '#c7f6ff'
    ctx.beginPath()
    ctx.ellipse(-10, -46, 3.4, 2.4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#3b1d5c'
    ctx.beginPath()
    ctx.arc(-11, -46, 1.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#2a1640'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(-14, -50)
  ctx.quadraticCurveTo(-10, -52, -6, -50)
  ctx.stroke()
  ctx.fillStyle = '#7a1f4f'
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
    tentacle(ctx, tail, 34, '#ffffff', null, '#ffffff', 0.55)
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
