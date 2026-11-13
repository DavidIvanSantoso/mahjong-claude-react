import { ENEMIES, MEGALODON, multiplierFor, PLAYER, SIREN, WORLD, ZONES } from './config'
import { drawAmbience, drawBioluminescence, seaAt } from './ambience'
import { drawCave, drawCaveBar } from './caveRender'
import { drawEel, drawEelBody, drawEelGlow, drawEelTop } from './eelRender'
import { drawNote, drawSiren, drawSirenBody, drawSirenGlow, drawSirenTop, REVERSED_HINT } from './sirenRender'
import { accuracy, diverAt, diverY, lockedEnemy, steering, wpm, type Enemy, type GameState, type Megalodon } from './engine'

/**
 * Menggambar PALUNG ke kanvas. Semua gambar (penyelam, ikan, gelembung) dibuat dari bentuk kanvas,
 * tanpa file gambar. Koordinat memakai satuan dunia (lihat WORLD); `scale` mengubahnya ke piksel layar.
 */

export const FONT = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'
export const TITLE_FONT = '"Bungee", "JetBrains Mono", sans-serif'

/** Tinggi area HUD di atas kanvas. */
const HUD_HEIGHT = 74

const COLORS = {
  typed: '#ffd447',
  text: '#f4fbff',
  pill: 'rgba(3, 14, 28, 0.82)',
  pillLine: 'rgba(160, 220, 255, 0.25)',
  error: '#ff5d5d',
  heart: '#ff4f6d',
  sonar: '#58e1ff',
  heal: '#7dffa8',
}

// ---------- Utilitas ----------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

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

/** Kegelapan laut dalam: semuanya gelap kecuali di sekitar lampu penyelam. */
function drawDarkness(ctx: CanvasRenderingContext2D, s: GameState) {
  const { darkness } = seaAt(s.depth)
  if (darkness <= 0.01) return
  const diver = diverAt(s)
  const cx = diver.x + 150
  const cy = diver.y
  const gradient = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(s.width, 600) * 0.75)
  gradient.addColorStop(0, 'rgba(0, 4, 12, 0)')
  gradient.addColorStop(0.35, `rgba(0, 4, 12, ${darkness * 0.45})`)
  gradient.addColorStop(1, `rgba(0, 4, 12, ${darkness})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, s.width, s.height)
}

// ---------- Penyelam ----------

function drawDiver(ctx: CanvasRenderingContext2D, s: GameState, clock: number) {
  const diver = diverAt(s)
  const x = diver.x
  const y = diver.y + (steering(s) ? 0 : Math.sin(clock * 1.8) * 4)
  if (s.grace > 0 && Math.floor(clock * 14) % 2 === 0) return
  const kick = Math.sin(clock * 5) * 0.35

  ctx.save()
  ctx.translate(x, y)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Sirip kaki
  for (const [dy, phase] of [[4, kick], [10, -kick]] as const) {
    ctx.save()
    ctx.translate(-34, dy)
    ctx.rotate(phase)
    ctx.fillStyle = '#ffb02e'
    ctx.beginPath()
    ctx.moveTo(0, -3)
    ctx.lineTo(-24, -9)
    ctx.lineTo(-26, 6)
    ctx.lineTo(0, 3)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  // Kaki
  ctx.strokeStyle = '#1b2a3a'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(-14, 2)
  ctx.lineTo(-34, 4 + kick * 6)
  ctx.moveTo(-14, 6)
  ctx.lineTo(-34, 10 - kick * 6)
  ctx.stroke()
  // Tabung oksigen
  ctx.fillStyle = '#e8c547'
  roundRect(ctx, -24, -20, 30, 11, 5)
  ctx.fill()
  ctx.fillStyle = '#9aa7b3'
  ctx.fillRect(4, -18, 5, 7)
  // Badan (baju selam)
  ctx.fillStyle = '#23384f'
  roundRect(ctx, -20, -10, 36, 18, 9)
  ctx.fill()
  ctx.fillStyle = '#3cc6d8'
  ctx.fillRect(-12, -10, 4, 18)
  // Lengan dan senapan tombak
  ctx.strokeStyle = '#23384f'
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(8, -2)
  ctx.lineTo(24, 4)
  ctx.stroke()
  ctx.fillStyle = '#566676'
  roundRect(ctx, 18, 0, 26, 6, 2)
  ctx.fill()
  ctx.fillStyle = '#c9d4de'
  ctx.fillRect(44, 2, 10, 2)
  // Kepala dan masker
  ctx.fillStyle = '#23384f'
  ctx.beginPath()
  ctx.arc(22, -10, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#9ff1ff'
  roundRect(ctx, 22, -16, 10, 8, 3)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillRect(24, -15, 3, 2)
  // Selang regulator
  ctx.strokeStyle = '#111c28'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(6, -16)
  ctx.quadraticCurveTo(14, -24, 20, -6)
  ctx.stroke()
  ctx.restore()

  // Sorot lampu kepala (terasa di zona gelap)
  const { darkness } = seaAt(s.depth)
  if (darkness > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const beam = ctx.createLinearGradient(x + 30, y, x + 330, y)
    beam.addColorStop(0, `rgba(255, 244, 200, ${0.16 * darkness + 0.04})`)
    beam.addColorStop(1, 'rgba(255, 244, 200, 0)')
    ctx.fillStyle = beam
    ctx.beginPath()
    ctx.moveTo(x + 32, y - 14)
    ctx.lineTo(x + 340, y - 120)
    ctx.lineTo(x + 340, y + 110)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
}

// ---------- Musuh ----------

function fishBody(ctx: CanvasRenderingContext2D, length: number, height: number, back: string, belly: string, tail: number) {
  // Ekor (di kanan, karena ikan berenang ke kiri)
  ctx.save()
  ctx.translate(length * 0.45, 0)
  ctx.rotate(tail)
  ctx.fillStyle = back
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(length * 0.35, -height * 0.55)
  ctx.lineTo(length * 0.28, 0)
  ctx.lineTo(length * 0.35, height * 0.55)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  // Badan: punggung dan perut
  ctx.fillStyle = back
  ctx.beginPath()
  ctx.ellipse(0, 0, length / 2, height / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.beginPath()
  ctx.ellipse(0, height * 0.16, length * 0.44, height * 0.3, 0, 0, Math.PI)
  ctx.fill()
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, glow: boolean) {
  ctx.fillStyle = glow ? '#fff7a8' : '#ffffff'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0b0f14'
  ctx.beginPath()
  ctx.arc(x - r * 0.25, y, r * 0.55, 0, Math.PI * 2)
  ctx.fill()
}

/** Ikan tak kasatmata yang belum dekat: 50% (sedikit berdenyut); sisanya penuh. */
function ghostAlpha(enemy: Enemy): number {
  return enemy.revealed ? 1 : 0.5 + Math.sin(enemy.age * 4) * 0.06
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, locked: boolean) {
  const type = ENEMIES[enemy.kind]
  const k = type.size
  const tail = Math.sin(enemy.age * (enemy.kind === 'teri' ? 18 : 8)) * 0.3
  ctx.save()
  ctx.globalAlpha = ghostAlpha(enemy)
  ctx.translate(enemy.x, enemy.y)
  if (enemy.flash > 0) ctx.translate(Math.sin(enemy.flash * 80) * 3, 0)

  switch (enemy.kind) {
    case 'misil': {
      // Menghadap arah luncurnya (dari titik tembak ke penyelam).
      if (enemy.origin) ctx.rotate(Math.atan2(WORLD.height / 2 - enemy.origin.y, WORLD.diverX - enemy.origin.x) - Math.PI)
      missileShape(ctx, k, enemy.age, false)
      break
    }
    case 'megalodon':
      drawMegalodonBody(ctx, enemy.age, 0.25, 0, 0.6)
      break
    case 'listrik':
      drawEelBody(ctx, enemy.age, 0.8, 0)
      break
    case 'siren':
      drawSirenBody(ctx, enemy.age, 0.5, 0)
      break
    case 'nada':
      drawNote(ctx, 22 * k, enemy.age)
      break
    case 'bayangan': {
      // Ikan pucat tembus pandang dengan tulang samar dan mata bercahaya
      fishBody(ctx, 74 * k, 30 * k, '#a9cfe3', '#e8f7ff', tail)
      ctx.strokeStyle = 'rgba(40, 80, 110, 0.45)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(-24 * k, 0)
      ctx.lineTo(26 * k, 0)
      for (let i = 0; i < 5; i++) {
        const rx = -14 * k + i * 9 * k
        ctx.moveTo(rx, -9 * k)
        ctx.lineTo(rx + 3 * k, 0)
        ctx.lineTo(rx, 9 * k)
      }
      ctx.stroke()
      ctx.fillStyle = '#7ff7ff'
      ctx.beginPath()
      ctx.arc(-26 * k, -4 * k, 3.6 * k, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#05303a'
      ctx.beginPath()
      ctx.arc(-27 * k, -4 * k, 1.6 * k, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'teri':
      fishBody(ctx, 30 * k * 2, 9 * k * 2, '#a9c3cf', '#e7f3f8', tail)
      ctx.fillStyle = '#4f7d93'
      ctx.fillRect(-16 * k, -1, 30 * k, 2)
      eye(ctx, -10 * k * 2 + 4, -1, 2.2, false)
      break
    case 'piranha': {
      fishBody(ctx, 56 * k, 40 * k, '#5d6f63', '#d2453b', tail)
      // Rahang bawah dengan gigi
      ctx.fillStyle = '#f2f2f2'
      for (let i = 0; i < 4; i++) {
        ctx.beginPath()
        ctx.moveTo(-26 * k + i * 5, 5 * k)
        ctx.lineTo(-24 * k + i * 5, 0)
        ctx.lineTo(-22 * k + i * 5, 5 * k)
        ctx.fill()
      }
      ctx.fillStyle = '#4b5a50'
      ctx.beginPath()
      ctx.moveTo(-4 * k, -18 * k)
      ctx.lineTo(10 * k, -27 * k)
      ctx.lineTo(12 * k, -15 * k)
      ctx.fill()
      eye(ctx, -14 * k, -7 * k, 4.2 * k, false)
      break
    }
    case 'hiu':
    case 'martil': {
      const length = 92 * k
      const height = 30 * k
      // Sirip punggung dan dada
      ctx.fillStyle = '#5f7486'
      ctx.beginPath()
      ctx.moveTo(-6 * k, -height * 0.4)
      ctx.lineTo(8 * k, -height * 1.15)
      ctx.lineTo(18 * k, -height * 0.4)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(-12 * k, height * 0.3)
      ctx.lineTo(4 * k, height * 0.95)
      ctx.lineTo(8 * k, height * 0.3)
      ctx.fill()
      fishBody(ctx, length, height, '#6c8296', '#e6edf2', tail)
      // Insang
      ctx.strokeStyle = 'rgba(30, 40, 52, 0.5)'
      ctx.lineWidth = 1.5
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.moveTo(-22 * k + i * 4, -6 * k)
        ctx.lineTo(-24 * k + i * 4, 6 * k)
        ctx.stroke()
      }
      if (enemy.kind === 'martil') {
        // Kepala martil: palang di depan dengan mata di kedua ujung
        ctx.fillStyle = '#6c8296'
        roundRect(ctx, -length * 0.56, -height * 0.85, 12 * k, height * 1.7, 5 * k)
        ctx.fill()
        eye(ctx, -length * 0.52, -height * 0.72, 3.2 * k, false)
        eye(ctx, -length * 0.52, height * 0.72, 3.2 * k, false)
      } else {
        eye(ctx, -length * 0.34, -height * 0.12, 3.4 * k, false)
        ctx.strokeStyle = '#2a3440'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(-length * 0.46, height * 0.16)
        ctx.lineTo(-length * 0.32, height * 0.2)
        ctx.stroke()
      }
      break
    }
    case 'kraken': {
      // Tentakel meliuk ke arah penyelam
      ctx.strokeStyle = '#8a3f86'
      ctx.lineCap = 'round'
      for (let i = 0; i < 6; i++) {
        const spread = (i - 2.5) * 16
        ctx.lineWidth = 11 - Math.abs(i - 2.5) * 1.5
        ctx.beginPath()
        ctx.moveTo(-10, 20 + spread * 0.3)
        for (let t = 1; t <= 6; t++) {
          const wave = Math.sin(enemy.age * 3 + i + t * 0.9) * 12
          ctx.lineTo(-10 - t * 18, 22 + spread * (0.3 + t * 0.12) + wave)
        }
        ctx.stroke()
      }
      ctx.fillStyle = '#a04d9b'
      ctx.beginPath()
      ctx.ellipse(18, -8, 56, 50, -0.25, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.beginPath()
      ctx.ellipse(30, -30, 22, 12, -0.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffd447'
      for (const ey of [-6, 22]) {
        ctx.beginPath()
        ctx.ellipse(-14, ey, 9, 7, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#1a0610'
        ctx.fillRect(-16, ey - 6, 3, 12)
        ctx.fillStyle = '#ffd447'
      }
      break
    }
    case 'oksigen': {
      const r = 24
      ctx.fillStyle = 'rgba(160, 235, 255, 0.18)'
      ctx.strokeStyle = 'rgba(200, 245, 255, 0.85)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.beginPath()
      ctx.ellipse(-8, -10, 6, 3, -0.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = COLORS.heart
      heartPath(ctx, 0, -7, 20)
      ctx.fill()
      break
    }
    case 'mutiara': {
      ctx.fillStyle = '#d98fb0'
      ctx.beginPath()
      ctx.ellipse(0, 6, 26, 12, 0, 0, Math.PI)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(0, 2, 26, 16, 0, Math.PI, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(120, 50, 80, 0.5)'
      ctx.lineWidth = 1.5
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath()
        ctx.moveTo(0, 2)
        ctx.lineTo(i * 10, -12)
        ctx.stroke()
      }
      const glow = ctx.createRadialGradient(0, 4, 1, 0, 4, 12)
      glow.addColorStop(0, '#ffffff')
      glow.addColorStop(1, 'rgba(210, 240, 255, 0.4)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(0, 4, 8, 0, Math.PI * 2)
      ctx.fill()
      break
    }
  }
  ctx.restore()

  if (locked) {
    const r = Math.max(22, 30 * k)
    ctx.save()
    ctx.strokeStyle = COLORS.typed
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.lineDashOffset = -enemy.age * 30
    ctx.beginPath()
    ctx.arc(enemy.x, enemy.y, r + 8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

/** Umpan bercahaya ikan di zona gelap (digambar di atas kegelapan). */
function drawGlow(ctx: CanvasRenderingContext2D, enemy: Enemy, darkness: number) {
  if (darkness < 0.3 || !enemy.revealed || enemy.kind === 'oksigen' || enemy.kind === 'mutiara' || enemy.kind === 'misil' || enemy.kind === 'nada') return
  const k = ENEMIES[enemy.kind].size
  const x = enemy.x - 26 * k
  const y = enemy.y - 8 * k
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 14 * k)
  glow.addColorStop(0, `rgba(140, 255, 230, ${0.7 * darkness})`)
  glow.addColorStop(1, 'rgba(140, 255, 230, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, 14 * k, 0, Math.PI * 2)
  ctx.fill()
}

// ---------- Megalodon Robot ----------

/** Misil menghadap kiri di titik (0,0). `friendly` = sudah dipantulkan (kuning). */
function missileShape(ctx: CanvasRenderingContext2D, k: number, age: number, friendly: boolean) {
  ctx.save()
  ctx.scale(k, k)
  // Api pendorong (di belakang = kanan)
  const flicker = 0.75 + Math.sin(age * 40) * 0.25
  const flame = ctx.createLinearGradient(20, 0, 20 + 26 * flicker, 0)
  flame.addColorStop(0, friendly ? 'rgba(255, 240, 150, 0.95)' : 'rgba(255, 200, 90, 0.95)')
  flame.addColorStop(1, 'rgba(255, 90, 40, 0)')
  ctx.fillStyle = flame
  ctx.beginPath()
  ctx.moveTo(20, -5)
  ctx.lineTo(20 + 28 * flicker, 0)
  ctx.lineTo(20, 5)
  ctx.closePath()
  ctx.fill()
  // Sirip
  ctx.fillStyle = friendly ? '#b38a1c' : '#7a1f24'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(8, 5 * side)
    ctx.lineTo(22, 14 * side)
    ctx.lineTo(22, 4 * side)
    ctx.closePath()
    ctx.fill()
  }
  // Badan
  ctx.fillStyle = friendly ? '#ffe27a' : '#c9d2da'
  roundRect(ctx, -18, -7, 40, 14, 6)
  ctx.fill()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
  ctx.fillRect(-18, 1, 40, 6)
  // Hulu ledak
  ctx.fillStyle = friendly ? '#ff9f1c' : '#e0343c'
  ctx.beginPath()
  ctx.moveTo(-18, -7)
  ctx.quadraticCurveTo(-34, 0, -18, 7)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#20262c'
  ctx.fillRect(-6, -7, 3, 14)
  ctx.restore()
}

/**
 * Badan Megalodon Robot menghadap kiri, titik tengah di (0,0), panjang ±280. `jaw` 0 (tertutup) – 1
 * (menganga), `flash` kilatan putih saat terkena, `eye` terang mata (0–1).
 */
function drawMegalodonBody(ctx: CanvasRenderingContext2D, age: number, jaw: number, flash: number, eye: number) {
  const steel = '#4d5b69'
  ctx.lineJoin = 'round'
  // Ekor (bergerak pelan, ada sambungan logam)
  ctx.save()
  ctx.translate(106, -2)
  ctx.rotate(Math.sin(age * 4.5) * 0.16)
  ctx.fillStyle = steel
  ctx.beginPath()
  ctx.moveTo(0, -8)
  ctx.lineTo(50, -60)
  ctx.lineTo(38, -4)
  ctx.lineTo(44, 46)
  ctx.lineTo(0, 8)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(15, 22, 30, 0.55)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(14, -18)
  ctx.lineTo(38, -4)
  ctx.lineTo(16, 18)
  ctx.stroke()
  ctx.restore()
  // Sirip punggung dan dada
  ctx.fillStyle = steel
  ctx.beginPath()
  ctx.moveTo(-14, -38)
  ctx.lineTo(26, -90)
  ctx.lineTo(46, -32)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(-34, 22)
  ctx.lineTo(6, 70)
  ctx.lineTo(18, 24)
  ctx.closePath()
  ctx.fill()
  // Peluncur misil di punggung
  ctx.fillStyle = '#323d48'
  roundRect(ctx, -66, -54, 50, 18, 4)
  ctx.fill()
  ctx.fillStyle = '#e0343c'
  for (const ty of [-49, -41]) {
    ctx.beginPath()
    ctx.arc(-66, ty, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  // Rongga mulut (terlihat saat menganga)
  if (jaw > 0.05) {
    const mouth = ctx.createRadialGradient(-96, 20, 2, -96, 20, 40)
    mouth.addColorStop(0, `rgba(255, 70, 40, ${0.9 * jaw})`)
    mouth.addColorStop(1, 'rgba(40, 0, 0, 0.95)')
    ctx.fillStyle = mouth
    ctx.beginPath()
    ctx.ellipse(-94, 18 + jaw * 10, 32, 6 + jaw * 16, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // Rahang bawah (berputar saat menganga)
  ctx.save()
  ctx.translate(-66, 16)
  ctx.rotate(-jaw * 0.5)
  ctx.fillStyle = '#7d8a97'
  ctx.beginPath()
  ctx.moveTo(4, -2)
  ctx.lineTo(-54, 0)
  ctx.quadraticCurveTo(-44, 22, 6, 20)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#eef3f7'
  for (let i = 0; i < 6; i++) {
    const tx = -50 + i * 8
    ctx.beginPath()
    ctx.moveTo(tx, 0)
    ctx.lineTo(tx + 3, -8)
    ctx.lineTo(tx + 6, 0)
    ctx.fill()
  }
  ctx.restore()
  // Badan utama
  const body = new Path2D()
  body.moveTo(-126, 8)
  body.quadraticCurveTo(-114, -30, -60, -42)
  body.quadraticCurveTo(20, -52, 82, -22)
  body.quadraticCurveTo(110, -10, 116, -2)
  body.quadraticCurveTo(100, 14, 70, 22)
  body.quadraticCurveTo(0, 38, -66, 18)
  body.lineTo(-120, 16)
  body.closePath()
  const metal = ctx.createLinearGradient(0, -48, 0, 34)
  metal.addColorStop(0, '#7a8a9a')
  metal.addColorStop(0.45, '#56646f')
  metal.addColorStop(0.75, '#a8b4bf')
  metal.addColorStop(1, '#c9d3dc')
  ctx.fillStyle = metal
  ctx.fill(body)
  // Garis pelat dan paku keling
  ctx.save()
  ctx.clip(body)
  ctx.strokeStyle = 'rgba(18, 26, 34, 0.5)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  for (const sx of [-44, 6, 56]) {
    ctx.moveTo(sx, -60)
    ctx.quadraticCurveTo(sx + 8, 0, sx, 60)
  }
  ctx.moveTo(-130, 2)
  ctx.quadraticCurveTo(0, -12, 120, -4)
  ctx.stroke()
  ctx.fillStyle = 'rgba(220, 230, 240, 0.55)'
  for (const sx of [-44, 6, 56]) {
    for (const ry of [-26, -12, 10]) {
      ctx.beginPath()
      ctx.arc(sx + 4 + (ry > 0 ? 2 : 0), ry, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // Kilau logam di punggung
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.beginPath()
  ctx.ellipse(-10, -34, 70, 7, -0.05, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // Gigi rahang atas
  ctx.fillStyle = '#eef3f7'
  for (let i = 0; i < 6; i++) {
    const tx = -116 + i * 8
    ctx.beginPath()
    ctx.moveTo(tx, 15)
    ctx.lineTo(tx + 3, 24)
    ctx.lineTo(tx + 6, 15)
    ctx.fill()
  }
  // Ventilasi insang (menyala)
  ctx.strokeStyle = '#ff8a3d'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(-50 + i * 9, -16)
    ctx.lineTo(-56 + i * 9, 6)
    ctx.stroke()
  }
  // Mata: lensa merah dalam soket
  ctx.fillStyle = '#1a2129'
  ctx.beginPath()
  ctx.arc(-88, -14, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgb(255, ${Math.round(90 - eye * 50)}, ${Math.round(70 - eye * 40)})`
  ctx.beginPath()
  ctx.arc(-89, -14, 5.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.fillRect(-92, -17, 2, 2)
  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.75, flash * 2.5)})`
    ctx.fill(body)
  }
}

/** Posisi, kemiringan, dan getaran bos sesuai fasenya. */
function megaTransform(ctx: CanvasRenderingContext2D, m: Megalodon) {
  const bob = m.phase === 'fight' || m.phase === 'enter' ? Math.sin(m.age * 1.6) * 4 : 0
  ctx.translate(m.x, m.y + bob)
  if (m.phase === 'qte') ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3)
  if (m.phase === 'stunned') ctx.rotate(0.14 + Math.sin(m.age * 18) * 0.06)
  if (m.phase === 'dying') ctx.rotate(Math.min(0.7, (1 - m.timer / 2.2) * 0.7))
}

function megaJaw(m: Megalodon): number {
  if (m.phase === 'qte') return 0.65 + Math.sin(m.age * 14) * 0.15
  if (m.phase === 'chomp') return m.struck ? 0.1 : 1
  if (m.phase === 'stunned' || m.phase === 'dying') return 0.35
  return Math.max(0.08, m.fired / 0.4)
}

function drawMegalodon(ctx: CanvasRenderingContext2D, m: Megalodon) {
  if (m.phase === 'warning') return
  ctx.save()
  if (m.phase === 'dying') ctx.globalAlpha = Math.max(0, Math.min(1, m.timer / 0.9))
  megaTransform(ctx, m)
  drawMegalodonBody(ctx, m.age, megaJaw(m), m.hitFlash, m.phase === 'qte' || m.phase === 'chomp' ? 1 : 0.4)
  ctx.restore()
}

/** Mata dan ventilasi menyala, digambar di atas kegelapan laut dalam. */
function drawMegaGlow(ctx: CanvasRenderingContext2D, m: Megalodon, clock: number) {
  if (m.phase === 'warning' || m.phase === 'dying') return
  const angry = m.phase === 'qte' || m.phase === 'chomp'
  ctx.save()
  megaTransform(ctx, m)
  ctx.globalCompositeOperation = 'lighter'
  const r = angry ? 34 : 20 + Math.sin(clock * 4) * 3
  const eye = ctx.createRadialGradient(-89, -14, 0, -89, -14, r)
  eye.addColorStop(0, `rgba(255, 60, 50, ${angry ? 0.9 : 0.55})`)
  eye.addColorStop(1, 'rgba(255, 60, 50, 0)')
  ctx.fillStyle = eye
  ctx.beginPath()
  ctx.arc(-89, -14, r, 0, Math.PI * 2)
  ctx.fill()
  const vent = ctx.createRadialGradient(-44, -5, 0, -44, -5, 26)
  vent.addColorStop(0, 'rgba(255, 140, 60, 0.35)')
  vent.addColorStop(1, 'rgba(255, 140, 60, 0)')
  ctx.fillStyle = vent
  ctx.beginPath()
  ctx.arc(-44, -5, 26, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Misil yang dipantulkan: kuning, menghadap arah terbangnya, dengan jejak cahaya. */
function drawRebounds(ctx: CanvasRenderingContext2D, m: Megalodon, clock: number) {
  for (const r of m.rebounds) {
    const angle = Math.atan2(r.vy, r.vx)
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 220, 110, 0.45)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(r.x, r.y)
    ctx.lineTo(r.x - Math.cos(angle) * 60, r.y - Math.sin(angle) * 60)
    ctx.stroke()
    ctx.translate(r.x, r.y)
    ctx.rotate(angle - Math.PI)
    missileShape(ctx, 0.85, clock, true)
    ctx.restore()
  }
}

/** Misil terkunci: jalur pantulnya ke titik tembak, supaya terlihat apakah bos masih di sana. */
function drawReturnPath(ctx: CanvasRenderingContext2D, missile: Enemy, clock: number) {
  const { x, y } = missile.origin!
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 212, 71, 0.35)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([2, 7])
  ctx.lineDashOffset = clock * 20
  ctx.beginPath()
  ctx.moveTo(missile.x, missile.y)
  ctx.lineTo(x, y)
  ctx.stroke()
  ctx.setLineDash([])
  const r = 9 + Math.sin(clock * 6) * 1.5
  ctx.strokeStyle = 'rgba(255, 212, 71, 0.8)'
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.moveTo(x - r - 5, y)
  ctx.lineTo(x - r + 3, y)
  ctx.moveTo(x + r - 3, y)
  ctx.lineTo(x + r + 5, y)
  ctx.moveTo(x, y - r - 5)
  ctx.lineTo(x, y - r + 3)
  ctx.moveTo(x, y + r - 3)
  ctx.lineTo(x, y + r + 5)
  ctx.stroke()
  ctx.restore()
}

/** Peringatan sebelum Megalodon masuk: denyut merah di tepi kanan. */
function drawMegaWarning(ctx: CanvasRenderingContext2D, s: GameState, m: Megalodon, clock: number) {
  if (m.phase !== 'warning') return
  const pulse = 0.5 + Math.sin(clock * 7) * 0.5
  const edge = ctx.createLinearGradient(s.width, 0, s.width - 160, 0)
  edge.addColorStop(0, `rgba(255, 40, 50, ${0.18 + pulse * 0.22})`)
  edge.addColorStop(1, 'rgba(255, 40, 50, 0)')
  ctx.fillStyle = edge
  ctx.fillRect(s.width - 160, 0, 160, s.height)
}

/** Bar HP bos menggantikan nama zona di HUD; `marks` = pecahan HP yang diberi tanda (misalnya batas QTE). */
function drawBossBar(ctx: CanvasRenderingContext2D, s: GameState, name: string, hp: number, maxHp: number, marks: number[]) {
  const w = Math.min(240, s.width * 0.34)
  const x = s.width / 2 - w / 2
  const y = 58
  ctx.textAlign = 'center'
  ctx.font = `700 11px ${FONT}`
  ctx.fillStyle = '#ff8a7a'
  ctx.fillText(name.toUpperCase(), s.width / 2, 48)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
  roundRect(ctx, x, y, w, 8, 4)
  ctx.fill()
  const ratio = hp / maxHp
  if (ratio > 0) {
    const fill = ctx.createLinearGradient(x, 0, x + w, 0)
    fill.addColorStop(0, '#ff3b4e')
    fill.addColorStop(1, '#ff9f45')
    ctx.fillStyle = fill
    roundRect(ctx, x, y, Math.max(8, w * ratio), 8, 4)
    ctx.fill()
  }
  // Tanda batas QTE
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  for (const fraction of marks) ctx.fillRect(x + w * fraction - 1, y - 2, 2, 12)
}

/** Layar QTE: huruf besar yang harus ditekan, cincin waktu, dan urutan huruf. */
function drawQte(ctx: CanvasRenderingContext2D, s: GameState, clock: number) {
  const qte = s.mega?.qte
  if (!qte) return
  ctx.save()
  ctx.fillStyle = 'rgba(0, 4, 12, 0.32)'
  ctx.fillRect(0, 0, s.width, s.height)
  const pulse = 0.5 + Math.sin(clock * 10) * 0.5
  const vignette = ctx.createRadialGradient(s.width / 2, s.height / 2, s.height * 0.35, s.width / 2, s.height / 2, s.width * 0.75)
  vignette.addColorStop(0, 'rgba(255, 30, 50, 0)')
  vignette.addColorStop(1, `rgba(255, 30, 50, ${0.18 + pulse * 0.14})`)
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, s.width, s.height)

  const cx = Math.min(s.width * 0.42, s.width - 260)
  const cy = s.height * 0.5
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `400 ${s.width < 700 ? 22 : 28}px ${TITLE_FONT}`
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillText('AWAS GIGITAN!', cx + 2, cy - 104)
  ctx.fillStyle = '#ffffff'
  ctx.fillText('AWAS GIGITAN!', cx, cy - 106)
  ctx.font = `600 13px ${FONT}`
  ctx.fillStyle = 'rgba(220, 240, 255, 0.9)'
  ctx.fillText('Tekan huruf ini, cepat!', cx, cy - 78)

  // Cincin waktu
  const total = qte.index === 0 ? qte.per + MEGALODON.qte.lead : qte.per
  const left = Math.max(0, qte.timer / total)
  ctx.lineWidth = 6
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.beginPath()
  ctx.arc(cx, cy, 58, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = left < 0.35 ? COLORS.error : COLORS.typed
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, 58, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left)
  ctx.stroke()
  // Tombol
  const size = 80 + pulse * 4
  ctx.fillStyle = '#0b1a2b'
  roundRect(ctx, cx - size / 2, cy - size / 2, size, size, 14)
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = COLORS.typed
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 48px ${FONT}`
  ctx.fillText(qte.keys[qte.index].toUpperCase(), cx, cy + 2)

  // Urutan huruf
  const cap = 30
  const gap = 8
  const rowW = qte.keys.length * cap + (qte.keys.length - 1) * gap
  ctx.font = `800 15px ${FONT}`
  qte.keys.forEach((key, i) => {
    const x = cx - rowW / 2 + i * (cap + gap)
    const y = cy + 84
    const done = i < qte.index
    const current = i === qte.index
    ctx.fillStyle = done ? COLORS.typed : 'rgba(3, 14, 28, 0.85)'
    roundRect(ctx, x, y, cap, cap, 7)
    ctx.fill()
    ctx.lineWidth = current ? 2.5 : 1
    ctx.strokeStyle = current ? COLORS.typed : 'rgba(160, 220, 255, 0.3)'
    ctx.stroke()
    ctx.fillStyle = done ? '#1a1300' : current ? '#ffffff' : 'rgba(255, 255, 255, 0.45)'
    ctx.fillText(key.toUpperCase(), x + cap / 2, y + cap / 2 + 1)
  })
  ctx.restore()
}

/** Label kata di atas musuh: huruf yang sudah diketik kuning, sisanya putih. */
function drawLabel(ctx: CanvasRenderingContext2D, s: GameState, enemy: Enemy, locked: boolean) {
  const word = enemy.words[enemy.segment]
  const k = ENEMIES[enemy.kind].size
  const size = enemy.kind === 'teri' ? 20 : enemy.kind === 'kraken' ? 22 : 18
  ctx.font = `700 ${size}px ${FONT}`
  const charW = ctx.measureText('m').width
  const w = charW * word.length + 16
  const h = size + 10
  const offset = enemy.kind === 'kraken' ? 78 : enemy.kind === 'teri' ? 20 : 26 * k + 12
  let x = enemy.x - w / 2
  // Jangan menabrak HUD di atas (label turun mendekati ikannya kalau perlu).
  const y = Math.max(HUD_HEIGHT, enemy.y - offset - h)
  x = Math.max(4, Math.min(s.width - w - 4, x))

  ctx.save()
  ctx.globalAlpha = ghostAlpha(enemy)
  if (locked) ctx.shadowColor = 'rgba(255, 212, 71, 0.6)'
  if (locked) ctx.shadowBlur = 12
  ctx.fillStyle = COLORS.pill
  roundRect(ctx, x, y, w, h, 7)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.lineWidth = locked ? 2.5 : 1
  ctx.strokeStyle = enemy.flash > 0 ? COLORS.error : locked ? COLORS.typed : COLORS.pillLine
  ctx.stroke()
  ctx.textBaseline = 'middle'
  if (ENEMIES[enemy.kind].reversed) {
    // Kata disimpan terbalik (urutan ketik); ditampilkan biasa, huruf yang sudah diketik menyala dari kanan.
    for (let i = 0; i < word.length; i++) {
      const stored = word.length - 1 - i
      ctx.fillStyle = stored < enemy.progress ? COLORS.typed : COLORS.text
      ctx.fillText(word[stored], x + 8 + i * charW, y + h / 2 + 1)
    }
    ctx.font = `600 10px ${FONT}`
    ctx.fillStyle = 'rgba(255, 170, 225, 0.9)'
    ctx.textAlign = 'center'
    ctx.fillText(REVERSED_HINT, x + w / 2, y - 7)
  } else {
    for (let i = 0; i < word.length; i++) {
      ctx.fillStyle = i < enemy.progress ? COLORS.typed : COLORS.text
      ctx.fillText(word[i], x + 8 + i * charW, y + h / 2 + 1)
    }
  }
  if (enemy.words.length > 1) {
    ctx.font = `600 11px ${FONT}`
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.textAlign = 'center'
    ctx.fillText(`kata ${enemy.segment + 1}/${enemy.words.length}`, x + w / 2, y - 8)
  }
  ctx.restore()
}

// ---------- Efek dan HUD ----------

function drawEffects(ctx: CanvasRenderingContext2D, s: GameState) {
  for (const p of s.particles) {
    const alpha = Math.max(0, p.life / p.max)
    if (p.kind === 'bubble') {
      ctx.strokeStyle = `rgba(210, 245, 255, ${alpha * 0.9})`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`
      ctx.fillRect(p.x - p.r * 0.45, p.y - p.r * 0.5, Math.max(1, p.r * 0.35), Math.max(1, p.r * 0.35))
    } else if (p.kind === 'ink') {
      ctx.fillStyle = `rgba(30, 6, 36, ${alpha * 0.55})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * (1.6 - alpha * 0.6), 0, Math.PI * 2)
      ctx.fill()
    } else if (p.kind === 'volt') {
      ctx.fillStyle = `rgba(170, 250, 255, ${alpha})`
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
    } else {
      ctx.fillStyle = `rgba(255, 170, 80, ${alpha})`
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
    }
  }
  for (const bolt of s.bolts) {
    const t = bolt.t
    const hx = bolt.x + (bolt.tx - bolt.x) * t
    const hy = bolt.y + (bolt.ty - bolt.y) * t
    const tailT = Math.max(0, t - 0.25)
    ctx.strokeStyle = 'rgba(255, 240, 180, 0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(bolt.x + (bolt.tx - bolt.x) * tailT, bolt.y + (bolt.ty - bolt.y) * tailT)
    ctx.lineTo(hx, hy)
    ctx.stroke()
  }
  if (s.sonarWave !== null) {
    const r = s.sonarWave * s.width * 1.2
    ctx.strokeStyle = `rgba(88, 225, 255, ${1 - s.sonarWave})`
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(WORLD.diverX, diverY(s), r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.textAlign = 'center'
  for (const p of s.popups) {
    ctx.font = `800 ${p.tone === 'score' ? 15 : 18}px ${FONT}`
    ctx.fillStyle = p.tone === 'heal' ? COLORS.heal : p.tone === 'bonus' ? COLORS.sonar : p.tone === 'hurt' ? COLORS.error : '#ffffff'
    ctx.globalAlpha = Math.min(1, p.life * 1.5)
    ctx.fillText(p.text, p.x, p.y)
    ctx.globalAlpha = 1
  }
  ctx.textAlign = 'left'
}

function drawHud(ctx: CanvasRenderingContext2D, s: GameState) {
  const w = s.width
  const shade = ctx.createLinearGradient(0, 0, 0, 84)
  shade.addColorStop(0, 'rgba(0, 8, 18, 0.7)')
  shade.addColorStop(1, 'rgba(0, 8, 18, 0)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, w, 84)

  // Kiri: hati dan Sonar
  for (let i = 0; i < PLAYER.maxHearts; i++) {
    ctx.fillStyle = i < s.hearts ? COLORS.heart : 'rgba(255, 255, 255, 0.18)'
    heartPath(ctx, 26 + i * 30, 14, 22)
    ctx.fill()
  }
  ctx.font = `700 12px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.fillText('SONAR', 14, 56)
  for (let i = 0; i < PLAYER.maxSonar; i++) {
    ctx.fillStyle = i < s.sonar ? COLORS.sonar : 'rgba(255, 255, 255, 0.18)'
    ctx.beginPath()
    ctx.arc(70 + i * 15, 56, 5, 0, Math.PI * 2)
    ctx.fill()
  }
  if (s.sonar > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = `600 10px ${FONT}`
    ctx.fillText('[Enter]', 116, 56)
  }

  // Tengah: kedalaman dan zona
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = `400 30px ${TITLE_FONT}`
  ctx.fillText(`${Math.floor(s.depth)} m`, w / 2, 26)
  if (s.mega && s.mega.phase !== 'warning') drawBossBar(ctx, s, ENEMIES.megalodon.name, s.mega.hp, s.mega.maxHp, MEGALODON.qteAt)
  else if (s.eel && s.eel.phase !== 'warning') drawBossBar(ctx, s, ENEMIES.listrik.name, s.eel.hp, s.eel.maxHp, [])
  else if (s.siren && s.siren.phase !== 'warning') drawBossBar(ctx, s, ENEMIES.siren.name, s.siren.hp, s.siren.maxHp, SIREN.dodgeAt)
  else if (s.cave && steering(s)) drawCaveBar(ctx, s, s.cave)
  else {
    ctx.font = `600 12px ${FONT}`
    ctx.fillStyle = 'rgba(200, 235, 255, 0.85)'
    ctx.fillText(ZONES[s.zone].name.toUpperCase(), w / 2, 52)
  }

  // Kanan: skor, WPM, akurasi, kombo
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 20px ${FONT}`
  ctx.fillText(s.score.toLocaleString('id-ID'), w - 14, 18)
  ctx.font = `600 12px ${FONT}`
  ctx.fillStyle = 'rgba(220, 240, 255, 0.85)'
  ctx.fillText(`${Math.round(wpm(s))} WPM · ${Math.round(accuracy(s) * 100)}%`, w - 14, 42)
  const multiplier = multiplierFor(s.combo)
  if (s.combo > 0) {
    ctx.fillStyle = multiplier > 1 ? COLORS.typed : 'rgba(220, 240, 255, 0.7)'
    ctx.fillText(`${s.combo} kombo${multiplier > 1 ? ` · ×${multiplier}` : ''}`, w - 14, 62)
  }
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function drawBanner(ctx: CanvasRenderingContext2D, s: GameState) {
  if (!s.banner) return
  const { title, subtitle, time } = s.banner
  const alpha = Math.min(1, time * 2, 1)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const y = s.height * 0.3
  ctx.font = `400 ${s.width < 700 ? 26 : 34}px ${TITLE_FONT}`
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.fillText(title, s.width / 2 + 3, y + 3)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(title, s.width / 2, y)
  ctx.font = `600 14px ${FONT}`
  ctx.fillStyle = 'rgba(210, 240, 255, 0.92)'
  ctx.fillText(subtitle, s.width / 2, y + 34)
  ctx.restore()
}

function drawHurt(ctx: CanvasRenderingContext2D, s: GameState) {
  if (s.hurtFlash <= 0) return
  const gradient = ctx.createRadialGradient(s.width / 2, s.height / 2, s.height * 0.3, s.width / 2, s.height / 2, s.width * 0.7)
  gradient.addColorStop(0, 'rgba(255, 40, 60, 0)')
  gradient.addColorStop(1, `rgba(255, 40, 60, ${0.45 * s.hurtFlash})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, s.width, s.height)
}

/** Garis samar batas jangkauan ikan bayangan, hanya saat ada ikan bayangan yang belum terlihat. */
function drawRevealLine(ctx: CanvasRenderingContext2D, s: GameState, clock: number) {
  const hidden = s.enemies.filter((enemy) => !enemy.revealed)
  if (!hidden.length) return
  const reveal = Math.min(...hidden.map((enemy) => ENEMIES[enemy.kind].reveal ?? Infinity))
  const x = WORLD.diverX + reveal
  ctx.save()
  ctx.strokeStyle = `rgba(127, 247, 255, ${0.24 + Math.sin(clock * 3) * 0.08})`
  ctx.lineWidth = 2
  ctx.setLineDash([3, 10])
  ctx.beginPath()
  ctx.moveTo(x, HUD_HEIGHT + 10)
  ctx.lineTo(x, s.height - 10)
  ctx.stroke()
  ctx.restore()
}

/** Gambar satu musuh di kanvas kecil (panduan dan beranda). */
export function drawPreview(canvas: HTMLCanvasElement, kind: Enemy['kind']) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = canvas.clientWidth || 96
  const h = canvas.clientHeight || 56
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)
  const k = ENEMIES[kind].size
  const enemy: Enemy = { id: 0, kind, words: [''], segment: 0, progress: 0, x: 0, y: 0, base: 0, speed: 0, phase: 0, age: 0.4, flash: 0, revealed: false }
  if (kind === 'siren') {
    const fit = Math.min(w / 220, h / 170)
    ctx.translate(w / 2 - 20 * fit, h / 2 + 8 * fit)
    ctx.scale(fit, fit)
    drawEnemy(ctx, enemy, false)
    return
  }
  if (kind === 'listrik') {
    const fit = Math.min(w / 330, h / 110)
    ctx.translate(w / 2 - 125 * fit, h / 2 - 4 * fit)
    ctx.scale(fit, fit)
    drawEnemy(ctx, enemy, false)
    return
  }
  if (kind === 'megalodon') {
    const fit = Math.min(w / 300, h / 170)
    ctx.translate(w / 2 - 14 * fit, h / 2 + 8 * fit)
    ctx.scale(fit, fit)
    drawEnemy(ctx, enemy, false)
    return
  }
  const fit = kind === 'kraken' ? Math.min(w / 240, h / 120) : Math.min(1, (w * 0.82) / (130 * k), (h * 0.8) / (60 * k))
  ctx.translate(kind === 'kraken' ? w * 0.58 : w / 2 - 6 * fit, h / 2 + (kind === 'kraken' ? 4 : 0))
  ctx.scale(fit, fit)
  drawEnemy(ctx, enemy, false)
}

/** Satu frame penuh. `scale` = piksel kanvas per satuan dunia (sudah termasuk devicePixelRatio). */
export function render(ctx: CanvasRenderingContext2D, s: GameState, scale: number, clock: number) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.save()
  if (s.shake > 0) ctx.translate((Math.random() - 0.5) * 12 * s.shake, (Math.random() - 0.5) * 12 * s.shake)
  drawAmbience(ctx, s, clock)
  if (s.cave && steering(s)) {
    // Arus Gua: gua punya pencahayaan sendiri, digambar di atas kegelapan laut; tidak ada ikan.
    // Tanpa cahaya hayati latar: ubur-ubur hiasan bisa dikira rintangan.
    drawDarkness(ctx, s)
    drawCave(ctx, s, s.cave, clock)
    drawDiver(ctx, s, clock)
    drawEffects(ctx, s)
    ctx.restore()
    drawHurt(ctx, s)
    drawHud(ctx, s)
    drawBanner(ctx, s)
    return
  }
  const locked = lockedEnemy(s)

  // Garis bidik ke target terkunci
  if (locked) {
    ctx.strokeStyle = 'rgba(255, 212, 71, 0.25)'
    ctx.setLineDash([4, 8])
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(WORLD.diverX + 50, diverY(s))
    ctx.lineTo(locked.x, locked.y)
    ctx.stroke()
    ctx.setLineDash([])
  }
  drawRevealLine(ctx, s, clock)
  if (locked?.origin) drawReturnPath(ctx, locked, clock)
  if (s.mega) drawMegalodon(ctx, s.mega)
  if (s.eel) drawEel(ctx, s.eel)
  if (s.siren) drawSiren(ctx, s.siren)
  for (const enemy of s.enemies) drawEnemy(ctx, enemy, enemy === locked)
  if (s.mega) drawRebounds(ctx, s.mega, clock)
  drawDiver(ctx, s, clock)
  drawDarkness(ctx, s)
  // Selama Siren, cahaya hayati latar (ubur-ubur hiasan) disembunyikan supaya tidak dikira serangan.
  if (!s.siren || s.siren.phase === 'warning') drawBioluminescence(ctx, s, clock)
  const { darkness } = seaAt(s.depth)
  for (const enemy of s.enemies) drawGlow(ctx, enemy, darkness)
  if (s.mega) {
    drawMegaGlow(ctx, s.mega, clock)
    drawMegaWarning(ctx, s, s.mega, clock)
  }
  if (s.eel) drawEelGlow(ctx, s.eel, clock)
  if (s.siren) drawSirenGlow(ctx, s.siren, clock)
  // Nada Siren bercahaya sendiri: digambar ulang di atas kegelapan supaya tetap terlihat di laut dalam.
  for (const enemy of s.enemies) if (enemy.kind === 'nada') drawEnemy(ctx, enemy, enemy === locked)
  drawEffects(ctx, s)
  // Label digambar terakhir (di atas kegelapan) supaya selalu terbaca; yang terkunci paling atas.
  for (const enemy of s.enemies) if (enemy !== locked) drawLabel(ctx, s, enemy, false)
  if (locked) drawLabel(ctx, s, locked, true)
  if (s.eel) drawEelTop(ctx, s, s.eel, clock)
  if (s.siren) drawSirenTop(ctx, s, s.siren, clock)
  ctx.restore()
  drawHurt(ctx, s)
  drawHud(ctx, s)
  drawBanner(ctx, s)
  drawQte(ctx, s, clock)
}
