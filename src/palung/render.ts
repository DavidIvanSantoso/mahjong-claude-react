import { ENEMIES, multiplierFor, PLAYER, WORLD, ZONES } from './config'
import { drawAmbience, drawBioluminescence, seaAt } from './ambience'
import { accuracy, diverY, lockedEnemy, wpm, type Enemy, type GameState } from './engine'

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
  const cx = WORLD.diverX + 150
  const cy = diverY(s)
  const gradient = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(s.width, 600) * 0.75)
  gradient.addColorStop(0, 'rgba(0, 4, 12, 0)')
  gradient.addColorStop(0.35, `rgba(0, 4, 12, ${darkness * 0.45})`)
  gradient.addColorStop(1, `rgba(0, 4, 12, ${darkness})`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, s.width, s.height)
}

// ---------- Penyelam ----------

function drawDiver(ctx: CanvasRenderingContext2D, s: GameState, clock: number) {
  const x = WORLD.diverX
  const y = diverY(s) + Math.sin(clock * 1.8) * 4
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
  if (darkness < 0.3 || !enemy.revealed || enemy.kind === 'oksigen' || enemy.kind === 'mutiara') return
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
  for (let i = 0; i < word.length; i++) {
    ctx.fillStyle = i < enemy.progress ? COLORS.typed : COLORS.text
    ctx.fillText(word[i], x + 8 + i * charW, y + h / 2 + 1)
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
  ctx.font = `600 12px ${FONT}`
  ctx.fillStyle = 'rgba(200, 235, 255, 0.85)'
  ctx.fillText(ZONES[s.zone].name.toUpperCase(), w / 2, 52)

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
  for (const enemy of s.enemies) drawEnemy(ctx, enemy, enemy === locked)
  drawDiver(ctx, s, clock)
  drawDarkness(ctx, s)
  drawBioluminescence(ctx, s, clock)
  const { darkness } = seaAt(s.depth)
  for (const enemy of s.enemies) drawGlow(ctx, enemy, darkness)
  drawEffects(ctx, s)
  // Label digambar terakhir (di atas kegelapan) supaya selalu terbaca; yang terkunci paling atas.
  for (const enemy of s.enemies) if (enemy !== locked) drawLabel(ctx, s, enemy, false)
  if (locked) drawLabel(ctx, s, locked, true)
  ctx.restore()
  drawHurt(ctx, s)
  drawHud(ctx, s)
  drawBanner(ctx, s)
}
