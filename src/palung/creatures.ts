import { bubble, drawEye, drawFish, gill, tentacle, tint, type FishSpec } from './art'

/**
 * Gambar makhluk PALUNG yang lebih hidup: penyelam, ikan biasa, Kraken, misil, dan item. Semua menghadap
 * kiri (kecuali penyelam yang menghadap kanan) dengan titik tengah di (0, 0); ukurannya sama dengan gambar
 * lama, jadi label kata dan tabrakan di engine tidak berubah. `k` = skala jenis (ENEMIES[kind].size).
 */

// ---------- Ikan biasa ----------

export function drawTeri(ctx: CanvasRenderingContext2D, k: number, age: number) {
  const spec: FishSpec = {
    length: 60 * k,
    height: 18 * k,
    head: 0.55,
    taper: 0.9,
    neck: 0.22,
    belly: 1.05,
    back: '#3d7f9e',
    side: '#b6d2dd',
    under: '#eef6f9',
    fin: '#9cc4d6',
    tail: 'fork',
    tailSize: 0.95,
    dorsal: { at: 0.5, size: 0.5, kind: 'soft' },
    pectoral: { at: 0.28, size: 0.55 },
  }
  const frame = drawFish(ctx, spec, { phase: age * 18, swing: 0.4 })
  // Garis perak berkilau di sisi badan
  ctx.strokeStyle = 'rgba(235, 252, 255, 0.85)'
  ctx.lineWidth = Math.max(1, spec.height * 0.12)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i <= 8; i++) {
    const [x, y] = frame.mid(0.22 + i * 0.09, -0.05)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  const [ex, ey] = frame.mid(0.11, -0.25)
  drawEye(ctx, ex, ey, Math.max(1.8, spec.height * 0.2), 'fish', '#264a5c')
}

export function drawPiranha(ctx: CanvasRenderingContext2D, k: number, age: number) {
  const spec: FishSpec = {
    length: 56 * k,
    height: 40 * k,
    head: 0.42,
    taper: 0.72,
    neck: 0.26,
    belly: 1.1,
    back: '#44564b',
    side: '#7f9083',
    under: '#d9483a',
    fin: '#55675b',
    tail: 'fork',
    tailSize: 0.48,
    dorsal: { at: 0.55, size: 0.28, kind: 'soft' },
    pectoral: { at: 0.34, size: 0.3 },
    anal: { at: 0.74, size: 0.2 },
    scales: true,
  }
  const frame = drawFish(ctx, spec, { phase: age * 8, swing: 0.2 })
  // Kilau sisik keperakan
  ctx.fillStyle = 'rgba(230, 245, 235, 0.55)'
  for (let i = 0; i < 7; i++) {
    const [x, y] = frame.mid(0.3 + ((i * 37) % 60) / 100, -0.55 + ((i * 53) % 50) / 100)
    ctx.beginPath()
    ctx.arc(x, y, 0.9 * k + 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
  gill(ctx, frame, 0.27)
  // Rahang bawah menonjol (underbite) menyatu dengan dagu, gigi tajam mencuat ke atas
  const [bx, by] = frame.bottom(0.15)
  const [nx, ny] = frame.mid(0.03, 0.2)
  const tip: [number, number] = [nx - 4 * k, ny + 1 * k]
  const back: [number, number] = [nx + 8 * k, ny]
  const jaw = ctx.createLinearGradient(0, ny - 4 * k, 0, by)
  jaw.addColorStop(0, '#e2574a')
  jaw.addColorStop(1, '#8e2219')
  ctx.fillStyle = jaw
  ctx.beginPath()
  ctx.moveTo(back[0], back[1])
  ctx.lineTo(tip[0], tip[1])
  ctx.quadraticCurveTo(tip[0] + 1 * k, by - 2 * k, bx, by)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(50, 12, 10, 0.7)'
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.fillStyle = '#f7f4ec'
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.3) / 4.2
    const tx = tip[0] + (back[0] - tip[0]) * t
    const ty = tip[1] + (back[1] - tip[1]) * t
    ctx.beginPath()
    ctx.moveTo(tx - 1.4 * k, ty + 0.5)
    ctx.lineTo(tx, ty - 5 * k)
    ctx.lineTo(tx + 1.4 * k, ty + 0.5)
    ctx.closePath()
    ctx.fill()
  }
  // Garis bibir atas
  ctx.strokeStyle = 'rgba(20, 30, 24, 0.7)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(tip[0] + 1 * k, tip[1] - 1.5 * k)
  ctx.lineTo(back[0] + 3 * k, back[1] - 2 * k)
  ctx.stroke()
  // Mata merah dengan alis marah
  const [ex, ey] = frame.mid(0.16, -0.4)
  drawEye(ctx, ex, ey, 4 * k, 'fish', '#d8392b')
  ctx.strokeStyle = '#1d2721'
  ctx.lineWidth = 2.2 * k
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(ex - 5 * k, ey - 6.5 * k)
  ctx.lineTo(ex + 5 * k, ey - 3.5 * k)
  ctx.stroke()
}

function sharkSpec(k: number, hammer: boolean): FishSpec {
  return {
    length: 92 * k,
    height: 30 * k,
    head: hammer ? 0.6 : 0.72,
    taper: 1.05,
    neck: 0.2,
    belly: 1.12,
    back: hammer ? '#66766f' : '#52708b',
    side: hammer ? '#83928b' : '#6d889e',
    under: hammer ? '#e9eeea' : '#eef3f6',
    fin: hammer ? '#5b6b65' : '#4b6680',
    sharpShade: true,
    tail: 'shark',
    tailSize: 1,
    dorsal: { at: 0.44, size: 0.72, kind: 'shark' },
    pectoral: { at: 0.32, size: 0.68 },
    anal: { at: 0.8, size: 0.22 },
  }
}

/** Hiu dan hiu martil (bentuk badan sama, kepala martil berbeda). */
export function drawShark(ctx: CanvasRenderingContext2D, k: number, age: number, hammer: boolean) {
  const spec = sharkSpec(k, hammer)
  const frame = drawFish(ctx, spec, { phase: age * 8, swing: 0.16 })
  // Celah insang
  ctx.strokeStyle = 'rgba(25, 35, 45, 0.45)'
  ctx.lineWidth = Math.max(1, 1.3 * k)
  ctx.lineCap = 'round'
  for (let i = 0; i < 4; i++) {
    const [x, yt] = frame.mid(0.22 + i * 0.028, -0.45)
    const [, yb] = frame.mid(0.22 + i * 0.028, 0.25)
    ctx.beginPath()
    ctx.moveTo(x, yt)
    ctx.quadraticCurveTo(x + 2 * k, (yt + yb) / 2, x - 1, yb)
    ctx.stroke()
  }
  // Bekas luka
  ctx.strokeStyle = 'rgba(235, 240, 245, 0.35)'
  ctx.lineWidth = 1
  for (const [t, d] of [
    [0.48, -0.5],
    [0.52, -0.42],
  ]) {
    const [x, y] = frame.mid(t, d)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 7 * k, y + 3 * k)
    ctx.stroke()
  }
  if (hammer) {
    // Kepala martil: palang membulat di moncong dengan mata di kedua ujung
    const [hx, hy] = frame.mid(0.03)
    const half = spec.height * 0.85
    const w = 12 * k
    const bar = ctx.createLinearGradient(hx - w, 0, hx + w, 0)
    bar.addColorStop(0, tint(spec.back, -0.2))
    bar.addColorStop(0.5, spec.side)
    bar.addColorStop(1, tint(spec.back, -0.1))
    ctx.fillStyle = bar
    ctx.beginPath()
    ctx.moveTo(hx - w * 0.6, hy - half)
    ctx.quadraticCurveTo(hx + w * 0.9, hy - half * 1.05, hx + w * 0.7, hy - half * 0.35)
    ctx.quadraticCurveTo(hx + w * 1.1, hy, hx + w * 0.7, hy + half * 0.35)
    ctx.quadraticCurveTo(hx + w * 0.9, hy + half * 1.05, hx - w * 0.6, hy + half)
    ctx.quadraticCurveTo(hx - w * 1.1, hy, hx - w * 0.6, hy - half)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = tint(spec.back, -0.55, 0.6)
    ctx.lineWidth = 1.2
    ctx.stroke()
    drawEye(ctx, hx - w * 0.25, hy - half * 0.82, 3.2 * k, 'fish', '#8a6a2a')
    drawEye(ctx, hx - w * 0.25, hy + half * 0.82, 3.2 * k, 'fish', '#8a6a2a')
    return
  }
  // Mulut di bawah moncong dengan deretan gigi
  const [mx, my] = frame.mid(0.07, 0.42)
  ctx.strokeStyle = '#1f2a35'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(mx - 6 * k, my - 1 * k)
  ctx.quadraticCurveTo(mx + 4 * k, my + 4 * k, mx + 12 * k, my + 1 * k)
  ctx.stroke()
  ctx.fillStyle = '#f4f7f9'
  for (let i = 0; i < 4; i++) {
    const tx = mx - 3 * k + i * 3.6 * k
    ctx.beginPath()
    ctx.moveTo(tx, my + 0.5 * k)
    ctx.lineTo(tx + 1.3 * k, my + 4 * k)
    ctx.lineTo(tx + 2.6 * k, my + 1.5 * k)
    ctx.fill()
  }
  const [ex, ey] = frame.mid(0.12, -0.3)
  drawEye(ctx, ex, ey, 3.2 * k, 'shark')
}

/** Ikan bayangan: badan tembus pandang dengan tulang bercahaya. */
export function drawGhost(ctx: CanvasRenderingContext2D, k: number, age: number) {
  const spec: FishSpec = {
    length: 74 * k,
    height: 30 * k,
    head: 0.5,
    taper: 0.9,
    neck: 0.2,
    belly: 1.05,
    back: '#7fb6cf',
    side: '#b4dceb',
    under: '#e6f7ff',
    fin: '#9fe6f6',
    tail: 'fan',
    tailSize: 0.8,
    dorsal: { at: 0.52, size: 0.5, kind: 'soft' },
    pectoral: { at: 0.3, size: 0.55 },
    anal: { at: 0.72, size: 0.35 },
  }
  ctx.save()
  ctx.globalAlpha *= 0.82
  const frame = drawFish(ctx, spec, { phase: age * 7, swing: 0.24 })
  ctx.restore()
  // Cahaya dari dalam
  const [cx, cy] = frame.mid(0.4)
  const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, spec.length * 0.42)
  inner.addColorStop(0, 'rgba(160, 250, 255, 0.4)')
  inner.addColorStop(1, 'rgba(160, 250, 255, 0)')
  ctx.fillStyle = inner
  ctx.fill(frame.path())
  // Tulang punggung, rusuk, dan tengkorak
  ctx.strokeStyle = 'rgba(40, 110, 140, 0.75)'
  ctx.lineWidth = 1.6 * k
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let i = 0; i <= 12; i++) {
    const [x, y] = frame.mid(0.2 + i * 0.065, -0.05)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  for (let i = 0; i < 7; i++) {
    const t = 0.3 + i * 0.075
    const [x, y] = frame.mid(t, -0.05)
    const [, yt] = frame.mid(t, -0.75)
    const [, yb] = frame.mid(t, 0.7)
    ctx.moveTo(x + 2 * k, yt)
    ctx.quadraticCurveTo(x - 1, (y + yt) / 2, x, y)
    ctx.quadraticCurveTo(x - 1, (y + yb) / 2, x + 2 * k, yb)
  }
  ctx.stroke()
  const [sx, sy] = frame.mid(0.12, -0.1)
  ctx.beginPath()
  ctx.ellipse(sx, sy, 8 * k, 7 * k, 0, 0, Math.PI * 2)
  ctx.stroke()
  const [ex, ey] = frame.mid(0.1, -0.3)
  drawEye(ctx, ex, ey, 3.8 * k, 'glow', '#5ff4ff')
}

// ---------- Kraken ----------

/** Kraken: kepala besar berbintik, mata kuning berpupil celah, tentakel meruncing dengan mangkuk isap. */
export function drawKraken(ctx: CanvasRenderingContext2D, age: number) {
  const arms: { points: [number, number][]; base: number; front: boolean }[] = []
  for (let i = 0; i < 7; i++) {
    const spread = (i - 3) * 13
    const points: [number, number][] = []
    for (let t = 0; t <= 8; t++) {
      const wave = Math.sin(age * 3 + i + t * 0.9) * (4 + t * 1.6)
      // Ujung tentakel melengkung naik
      const curl = t > 5 ? Math.sin(age * 2 + i) * (t - 5) * 5 - (t - 5) * 4 : 0
      points.push([-6 - t * 16, 20 + spread * (0.32 + t * 0.12) + wave + curl])
    }
    arms.push({ points, base: 24 - Math.abs(i - 3) * 2.4, front: i % 2 === 0 })
  }
  const skin = (x0: number, x1: number, dark: number) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0)
    g.addColorStop(0, tint('#9b3f93', dark))
    g.addColorStop(1, tint('#d88acb', dark))
    return g
  }
  for (const arm of arms.filter((a) => !a.front)) tentacle(ctx, arm.points, arm.base, skin(0, -130, -0.25), 'rgba(240, 190, 225, 0.5)', 'rgba(50, 10, 45, 0.5)')

  // Kepala (mantel)
  const mantle = new Path2D()
  mantle.moveTo(-26, 24)
  mantle.bezierCurveTo(-40, -10, -26, -52, 10, -58)
  mantle.bezierCurveTo(52, -66, 86, -40, 78, -6)
  mantle.bezierCurveTo(72, 22, 40, 36, 14, 38)
  mantle.bezierCurveTo(-4, 40, -18, 34, -26, 24)
  mantle.closePath()
  const body = ctx.createRadialGradient(18, -34, 6, 14, -6, 76)
  body.addColorStop(0, '#d987cf')
  body.addColorStop(0.5, '#a24a9a')
  body.addColorStop(1, '#5a1f57')
  ctx.fillStyle = body
  ctx.fill(mantle)
  ctx.save()
  ctx.clip(mantle)
  // Bintik dan bintil kulit
  for (let i = 0; i < 16; i++) {
    const x = -14 + ((i * 47) % 86)
    const y = -48 + ((i * 29) % 78)
    ctx.fillStyle = i % 3 ? 'rgba(70, 15, 65, 0.35)' : 'rgba(255, 210, 245, 0.25)'
    ctx.beginPath()
    ctx.ellipse(x, y, 3 + (i % 4) * 1.6, 2.4 + (i % 3), 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.beginPath()
  ctx.ellipse(30, -40, 26, 11, -0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = 'rgba(45, 8, 42, 0.7)'
  ctx.lineWidth = 2
  ctx.stroke(mantle)

  for (const arm of arms.filter((a) => a.front)) tentacle(ctx, arm.points, arm.base, skin(0, -130, 0), 'rgba(255, 215, 240, 0.75)', 'rgba(50, 10, 45, 0.6)')

  // Mata: soket gelap, bola kuning bercahaya, pupil celah mendatar, kelopak berkedip
  const blink = Math.max(0, Math.sin(age * 0.9) * 12 - 11)
  for (const [ex, ey] of [
    [-12, -8],
    [-6, 18],
  ]) {
    ctx.fillStyle = 'rgba(40, 6, 36, 0.8)'
    ctx.beginPath()
    ctx.ellipse(ex, ey, 13, 11, 0, 0, Math.PI * 2)
    ctx.fill()
    const glow = ctx.createRadialGradient(ex - 2, ey - 2, 1, ex, ey, 10)
    glow.addColorStop(0, '#fff3a8')
    glow.addColorStop(0.6, '#ffc62e')
    glow.addColorStop(1, '#c47a0c')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.ellipse(ex, ey, 10, 8 * (1 - blink * 0.9), 0, 0, Math.PI * 2)
    ctx.fill()
    if (blink < 0.6) {
      ctx.fillStyle = '#16040f'
      ctx.beginPath()
      ctx.ellipse(ex - 1, ey, 6, 1.8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.beginPath()
      ctx.arc(ex - 4, ey - 3, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    // Alis/tonjolan di atas mata
    ctx.strokeStyle = '#4a1446'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(ex - 12, ey - 8)
    ctx.quadraticCurveTo(ex, ey - 15, ex + 11, ey - 9)
    ctx.stroke()
  }
}

// ---------- Item ----------

export function drawOxygen(ctx: CanvasRenderingContext2D, age: number, heart: (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => void) {
  const r = 24
  const wobble = 1 + Math.sin(age * 3) * 0.03
  ctx.save()
  ctx.scale(wobble, 2 - wobble)
  const fill = ctx.createRadialGradient(-6, -8, 2, 0, 0, r)
  fill.addColorStop(0, 'rgba(255, 255, 255, 0.25)')
  fill.addColorStop(0.7, 'rgba(150, 230, 255, 0.12)')
  fill.addColorStop(1, 'rgba(150, 230, 255, 0.35)')
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  // Tepi pelangi (seperti gelembung sabun)
  const rim = ctx.createLinearGradient(-r, -r, r, r)
  const shift = (Math.sin(age * 1.5) + 1) / 2
  rim.addColorStop(0, 'rgba(190, 250, 255, 0.95)')
  rim.addColorStop(0.3 + shift * 0.2, 'rgba(255, 170, 230, 0.85)')
  rim.addColorStop(0.7, 'rgba(255, 240, 160, 0.85)')
  rim.addColorStop(1, 'rgba(160, 230, 255, 0.95)')
  ctx.strokeStyle = rim
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.restore()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, 0, r - 6, Math.PI * 1.1, Math.PI * 1.45)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.beginPath()
  ctx.arc(10, 12, 2, 0, Math.PI * 2)
  ctx.fill()
  // Hati berdenyut dengan cahaya
  const beat = 1 + Math.max(0, Math.sin(age * 6)) * 0.12
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 18)
  halo.addColorStop(0, 'rgba(255, 90, 120, 0.45)')
  halo.addColorStop(1, 'rgba(255, 90, 120, 0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(0, 0, 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.scale(beat, beat)
  const red = ctx.createLinearGradient(0, -8, 0, 8)
  red.addColorStop(0, '#ff8a9e')
  red.addColorStop(1, '#e02a4f')
  ctx.fillStyle = red
  heart(ctx, 0, -7, 20)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
  ctx.beginPath()
  ctx.ellipse(-4, -3, 2.6, 1.6, -0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawPearl(ctx: CanvasRenderingContext2D, age: number) {
  const ridges = (top: boolean) => {
    ctx.strokeStyle = 'rgba(110, 40, 80, 0.4)'
    ctx.lineWidth = 1.3
    ctx.beginPath()
    for (let i = -3; i <= 3; i++) {
      ctx.moveTo(0, top ? -2 : 6)
      ctx.lineTo(i * 8.5, top ? -18 + Math.abs(i) * 2.5 : 16 - Math.abs(i) * 2)
    }
    ctx.stroke()
  }
  // Cangkang bawah
  const lower = ctx.createLinearGradient(0, 4, 0, 20)
  lower.addColorStop(0, '#f0a9c8')
  lower.addColorStop(1, '#a8557f')
  ctx.fillStyle = lower
  ctx.beginPath()
  ctx.moveTo(-27, 5)
  ctx.quadraticCurveTo(-24, 22, 0, 21)
  ctx.quadraticCurveTo(24, 22, 27, 5)
  ctx.closePath()
  ctx.fill()
  ridges(false)
  // Bagian dalam yang mengilap
  const inner = ctx.createLinearGradient(0, -2, 0, 8)
  inner.addColorStop(0, '#5e2448')
  inner.addColorStop(1, '#f7d7e6')
  ctx.fillStyle = inner
  ctx.beginPath()
  ctx.ellipse(0, 5, 24, 4.5, 0, 0, Math.PI * 2)
  ctx.fill()
  // Mutiara
  const pearl = ctx.createRadialGradient(-3, 0, 1, 0, 3, 9)
  pearl.addColorStop(0, '#ffffff')
  pearl.addColorStop(0.6, '#e9f2ff')
  pearl.addColorStop(1, '#a9bfe0')
  ctx.fillStyle = pearl
  ctx.beginPath()
  ctx.arc(0, 2, 8, 0, Math.PI * 2)
  ctx.fill()
  // Cangkang atas, sedikit terbuka (membuka-menutup pelan)
  const open = 0.32 + Math.sin(age * 1.4) * 0.08
  ctx.save()
  ctx.translate(0, 4)
  ctx.rotate(-open * 0.15)
  ctx.translate(0, -4)
  ctx.translate(0, -open * 14)
  const upper = ctx.createLinearGradient(0, -20, 0, 2)
  upper.addColorStop(0, '#f6b8d3')
  upper.addColorStop(1, '#c76b97')
  ctx.fillStyle = upper
  ctx.beginPath()
  ctx.moveTo(-27, 2)
  ctx.quadraticCurveTo(-26, -20, 0, -21)
  ctx.quadraticCurveTo(26, -20, 27, 2)
  ctx.quadraticCurveTo(0, -2, -27, 2)
  ctx.closePath()
  ctx.fill()
  ridges(true)
  ctx.restore()
  // Kilau berkedip
  const twinkle = Math.max(0, Math.sin(age * 2.6))
  if (twinkle > 0.2) {
    ctx.fillStyle = `rgba(255, 255, 255, ${twinkle})`
    const s = 2 + twinkle * 4
    ctx.beginPath()
    ctx.moveTo(4, -6 - s)
    ctx.lineTo(5, -5)
    ctx.lineTo(4 + s, -4)
    ctx.lineTo(5, -3)
    ctx.lineTo(4, -2 + s)
    ctx.lineTo(3, -3)
    ctx.lineTo(4 - s, -4)
    ctx.lineTo(3, -5)
    ctx.closePath()
    ctx.fill()
  }
}

// ---------- Misil ----------

/** Misil menghadap kiri di (0, 0). `friendly` = sudah dipantulkan (kuning). */
export function drawMissile(ctx: CanvasRenderingContext2D, k: number, age: number, friendly: boolean, rounded: (x: number, y: number, w: number, h: number, r: number) => void) {
  ctx.save()
  ctx.scale(k, k)
  // Jejak gelembung di belakang
  for (let i = 0; i < 5; i++) {
    const t = (age * 2.2 + i / 5) % 1
    bubble(ctx, 26 + t * 46, Math.sin(t * 9 + i) * 4, 1.4 + t * 2.4, 1 - t)
  }
  // Api pendorong berlapis
  const flicker = 0.75 + Math.sin(age * 40) * 0.25
  for (const [len, width, color] of [
    [32, 6, friendly ? 'rgba(255, 220, 90, 0.7)' : 'rgba(255, 120, 50, 0.7)'],
    [22, 4, friendly ? 'rgba(255, 245, 190, 0.95)' : 'rgba(255, 210, 120, 0.95)'],
    [11, 2, 'rgba(255, 255, 255, 0.95)'],
  ] as const) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(20, -width)
    ctx.quadraticCurveTo(20 + len * flicker * 0.6, -width * 0.6, 20 + len * flicker, 0)
    ctx.quadraticCurveTo(20 + len * flicker * 0.6, width * 0.6, 20, width)
    ctx.closePath()
    ctx.fill()
  }
  // Sirip
  const finColor = friendly ? '#b38a1c' : '#7a1f24'
  for (const side of [-1, 1]) {
    const fin = ctx.createLinearGradient(8, 0, 22, 0)
    fin.addColorStop(0, tint(finColor, 0.2))
    fin.addColorStop(1, tint(finColor, -0.3))
    ctx.fillStyle = fin
    ctx.beginPath()
    ctx.moveTo(6, 5 * side)
    ctx.lineTo(22, 15 * side)
    ctx.lineTo(23, 4 * side)
    ctx.closePath()
    ctx.fill()
  }
  // Badan logam
  const metal = ctx.createLinearGradient(0, -7, 0, 7)
  if (friendly) {
    metal.addColorStop(0, '#fff3b0')
    metal.addColorStop(0.45, '#ffd84a')
    metal.addColorStop(1, '#b8901c')
  } else {
    metal.addColorStop(0, '#f2f6f9')
    metal.addColorStop(0.45, '#b8c3cc')
    metal.addColorStop(1, '#5d6a75')
  }
  ctx.fillStyle = metal
  rounded(-18, -7, 40, 14, 6)
  ctx.fill()
  // Garis peringatan dan paku keling
  ctx.save()
  rounded(-18, -7, 40, 14, 6)
  ctx.clip()
  ctx.fillStyle = friendly ? 'rgba(120, 80, 0, 0.45)' : 'rgba(30, 30, 30, 0.55)'
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(6 + i * 4, -7)
    ctx.lineTo(9 + i * 4, -7)
    ctx.lineTo(5 + i * 4, 7)
    ctx.lineTo(2 + i * 4, 7)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  for (const rx of [-10, -2]) {
    ctx.beginPath()
    ctx.arc(rx, -4, 0.9, 0, Math.PI * 2)
    ctx.fill()
  }
  // Hulu ledak mengilap dengan lampu berkedip
  const head = ctx.createLinearGradient(-32, -7, -18, 7)
  head.addColorStop(0, friendly ? '#ffc36b' : '#ff6b6b')
  head.addColorStop(1, friendly ? '#d9770a' : '#a0141c')
  ctx.fillStyle = head
  ctx.beginPath()
  ctx.moveTo(-18, -7)
  ctx.quadraticCurveTo(-36, 0, -18, 7)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.beginPath()
  ctx.ellipse(-23, -3, 3, 1.4, -0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#20262c'
  ctx.fillRect(-6, -7, 2.5, 14)
  if (Math.sin(age * 14) > 0) {
    ctx.fillStyle = friendly ? '#fff7c2' : '#ff3b3b'
    ctx.beginPath()
    ctx.arc(-13, -7.5, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ---------- Penyelam ----------

/**
 * Penyelam menghadap kanan di (0, 0): baju selam bergradasi, tabung, rompi apung, masker berkilau,
 * senapan tombak, sirip yang mengayuh (lutut ikut menekuk), dan gelembung napas.
 */
export function drawDiverArt(ctx: CanvasRenderingContext2D, clock: number, rounded: (x: number, y: number, w: number, h: number, r: number) => void) {
  const kick = Math.sin(clock * 5)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // Gelembung napas: keluar berkelompok tiap ±3 detik dari regulator, naik sambil bergoyang
  const breath = clock % 3.2
  for (let i = 0; i < 6; i++) {
    const t = breath - 0.9 - i * 0.12
    if (t < 0 || t > 1.9) continue
    const rise = t * 55
    bubble(ctx, 28 + Math.sin(t * 6 + i) * 4 - t * 6, -8 - rise, 1.6 + i * 0.35 + t * 0.8, Math.min(1, 2 - t))
  }

  const suit = '#1d3049'
  const suitLight = '#33507a'
  // Kaki (paha → lutut → betis) dan sirip
  for (const [hipY, phase, far] of [
    [3, kick, true],
    [8, -kick, false],
  ] as const) {
    const knee: [number, number] = [-28, hipY + 2 + phase * 3]
    const ankle: [number, number] = [-42, hipY + 1 + phase * 7]
    ctx.strokeStyle = far ? tint(suit, -0.3) : suit
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(-14, hipY)
    ctx.lineTo(knee[0], knee[1])
    ctx.lineTo(ankle[0], ankle[1])
    ctx.stroke()
    ctx.save()
    ctx.translate(ankle[0], ankle[1])
    ctx.rotate(phase * 0.45)
    const fin = ctx.createLinearGradient(0, 0, -30, 0)
    fin.addColorStop(0, far ? '#c97a14' : '#ffb02e')
    fin.addColorStop(1, far ? 'rgba(201, 122, 20, 0.75)' : 'rgba(255, 210, 90, 0.85)')
    ctx.fillStyle = fin
    ctx.beginPath()
    ctx.moveTo(2, -4)
    ctx.quadraticCurveTo(-16, -9, -30, -10)
    ctx.quadraticCurveTo(-27, 0, -31, 9)
    ctx.quadraticCurveTo(-16, 7, 2, 4)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(120, 60, 0, 0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-2, -2)
    ctx.lineTo(-27, -6)
    ctx.moveTo(-2, 2)
    ctx.lineTo(-27, 6)
    ctx.stroke()
    ctx.fillStyle = '#10161f'
    rounded(-4, -4.5, 8, 9, 3)
    ctx.fill()
    ctx.restore()
  }

  // Tabung oksigen dengan katup
  const tank = ctx.createLinearGradient(0, -22, 0, -8)
  tank.addColorStop(0, '#fff0a0')
  tank.addColorStop(0.4, '#e8c547')
  tank.addColorStop(1, '#a8861c')
  ctx.fillStyle = tank
  rounded(-26, -22, 32, 13, 6)
  ctx.fill()
  ctx.strokeStyle = 'rgba(80, 60, 0, 0.5)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = '#8e9ba7'
  ctx.fillRect(5, -20, 5, 8)
  ctx.fillStyle = '#c9d4de'
  ctx.fillRect(9, -21, 3, 3)
  ctx.fillStyle = '#20262c'
  ctx.fillRect(-14, -22, 3, 13)

  // Badan: baju selam bergradasi dengan panel biru muda dan rompi apung
  const torso = ctx.createLinearGradient(0, -11, 0, 9)
  torso.addColorStop(0, suitLight)
  torso.addColorStop(0.5, suit)
  torso.addColorStop(1, tint(suit, -0.35))
  ctx.fillStyle = torso
  rounded(-21, -11, 38, 20, 10)
  ctx.fill()
  ctx.fillStyle = '#3cc6d8'
  ctx.beginPath()
  ctx.moveTo(-13, -11)
  ctx.lineTo(-8, -11)
  ctx.lineTo(-11, 9)
  ctx.lineTo(-16, 9)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(10, 16, 24, 0.75)'
  rounded(-4, -10, 14, 18, 4)
  ctx.fill()
  ctx.fillStyle = '#c9d4de'
  ctx.fillRect(1, -2, 5, 3)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.lineWidth = 1.2
  rounded(-21, -11, 38, 20, 10)
  ctx.stroke()

  // Selang regulator dari katup ke mulut
  ctx.strokeStyle = '#111c28'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(9, -18)
  ctx.bezierCurveTo(18, -28, 30, -18, 27, -7)
  ctx.stroke()

  // Lengan dan senapan tombak (sedikit bergoyang membidik)
  const aim = Math.sin(clock * 1.3) * 0.04
  ctx.save()
  ctx.translate(8, -2)
  ctx.rotate(aim)
  ctx.strokeStyle = suit
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(9, 5)
  ctx.lineTo(18, 5)
  ctx.stroke()
  const gun = ctx.createLinearGradient(0, 2, 0, 9)
  gun.addColorStop(0, '#8a6a46')
  gun.addColorStop(1, '#4e3a24')
  ctx.fillStyle = gun
  rounded(12, 2, 30, 6, 2)
  ctx.fill()
  ctx.fillStyle = '#2a3440'
  ctx.fillRect(16, 7, 4, 6)
  ctx.strokeStyle = '#d7e0e8'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(30, 3)
  ctx.lineTo(54, 3)
  ctx.stroke()
  ctx.fillStyle = '#eef4f8'
  ctx.beginPath()
  ctx.moveTo(54, 0)
  ctx.lineTo(60, 3)
  ctx.lineTo(54, 6)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(40, 40, 40, 0.8)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(40, 2)
  ctx.quadraticCurveTo(32, -2, 24, 3)
  ctx.stroke()
  ctx.fillStyle = '#10161f'
  ctx.beginPath()
  ctx.arc(19, 5, 3.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Kepala: tudung, wajah, masker berkaca, regulator
  const hood = ctx.createRadialGradient(18, -16, 2, 22, -10, 12)
  hood.addColorStop(0, suitLight)
  hood.addColorStop(1, tint(suit, -0.25))
  ctx.fillStyle = hood
  ctx.beginPath()
  ctx.arc(22, -10, 10.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#e2a98a'
  ctx.beginPath()
  ctx.ellipse(28, -7, 4.5, 5.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#10161f'
  rounded(20, -17, 14, 10, 4)
  ctx.fill()
  const glass = ctx.createLinearGradient(22, -16, 32, -8)
  glass.addColorStop(0, '#d9fbff')
  glass.addColorStop(0.5, '#6fd8f0')
  glass.addColorStop(1, '#1f7f9e')
  ctx.fillStyle = glass
  rounded(22, -15.5, 10.5, 7, 3)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.beginPath()
  ctx.moveTo(24, -14.5)
  ctx.lineTo(27, -14.5)
  ctx.lineTo(25, -10)
  ctx.lineTo(23, -10)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#1b2530'
  rounded(26, -6, 7, 5, 2)
  ctx.fill()
  ctx.fillStyle = '#3cc6d8'
  ctx.fillRect(31, -5, 2, 3)
  // Lampu kepala
  ctx.fillStyle = '#2a3440'
  rounded(17, -22, 7, 4, 1.5)
  ctx.fill()
  ctx.fillStyle = '#fff6c8'
  ctx.beginPath()
  ctx.arc(24, -20, 1.8, 0, Math.PI * 2)
  ctx.fill()
}

