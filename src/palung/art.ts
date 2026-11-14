/**
 * Alat gambar bersama untuk makhluk PALUNG: badan ikan yang melengkung saat berenang (bukan elips kaku),
 * gradasi warna (punggung gelap, perut terang), sirip bergaris, mata berkilau, dan tentakel meruncing.
 * Semua menghadap kiri dengan titik tengah di (0, 0), sama seperti gambar lama, supaya ukuran, posisi
 * label kata, dan tabrakan di engine tidak berubah.
 */

// ---------- Warna ----------

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Warna lebih terang (amount > 0) atau lebih gelap (amount < 0), −1…1. */
export function tint(hex: string, amount: number, alpha = 1): string {
  const [r, g, b] = rgb(hex)
  const to = amount > 0 ? 255 : 0
  const k = Math.min(1, Math.abs(amount))
  const mixc = (c: number) => Math.round(c + (to - c) * k)
  return `rgba(${mixc(r)}, ${mixc(g)}, ${mixc(b)}, ${alpha})`
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = rgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ---------- Ikan ----------

export interface FishSpec {
  length: number
  height: number
  /** Pangkat bentuk kepala (kecil = tumpul/bulat, besar = runcing). */
  head: number
  /** Pangkat bentuk ekor (besar = cepat meramping). */
  taper: number
  /** Tebal batang ekor, pecahan tinggi badan. */
  neck: number
  /** Perut lebih gemuk dari punggung (1 = simetris). */
  belly: number
  back: string
  side: string
  under: string
  fin: string
  /** Batas warna punggung/perut tajam (hiu) atau halus (ikan biasa). */
  sharpShade?: boolean
  tail: 'fork' | 'shark' | 'fan'
  tailSize: number
  dorsal?: { at: number; size: number; kind: 'shark' | 'soft' | 'spiny' }
  pectoral?: { at: number; size: number }
  anal?: { at: number; size: number }
  scales?: boolean
}

export interface FishPose {
  /** Fase gelombang renang (radian). */
  phase: number
  /** Simpangan ekor, pecahan tinggi badan. */
  swing: number
}

/** Kerangka badan: titik atas/bawah sepanjang badan (t = 0 moncong, 1 batang ekor). */
export class FishFrame {
  readonly spec: FishSpec
  readonly pose: FishPose
  private readonly x0: number
  private readonly span: number
  private readonly peak: number

  constructor(spec: FishSpec, pose: FishPose) {
    this.spec = spec
    this.pose = pose
    this.x0 = -spec.length / 2
    this.span = spec.length * 0.8
    const a = spec.head
    const b = spec.taper
    const t = a / (a + b)
    this.peak = Math.pow(t, a) * Math.pow(1 - t, b)
  }

  wave(t: number): number {
    const { height } = this.spec
    return height * this.pose.swing * t * t * Math.sin(this.pose.phase - t * 2.4)
  }

  private profile(t: number): number {
    const { head, taper, neck } = this.spec
    const raw = Math.pow(Math.max(0, t), head) * Math.pow(Math.max(0, 1 - t), taper)
    return neck * t + (1 - neck * t) * (raw / this.peak)
  }

  x(t: number): number {
    return this.x0 + t * this.span
  }

  top(t: number): [number, number] {
    return [this.x(t), this.wave(t) - (this.spec.height / 2) * this.profile(t)]
  }

  bottom(t: number): [number, number] {
    return [this.x(t), this.wave(t) + (this.spec.height / 2) * this.profile(t) * this.spec.belly]
  }

  mid(t: number, k = 0): [number, number] {
    const [x, yt] = this.top(t)
    const [, yb] = this.bottom(t)
    return [x, yt + (yb - yt) * (0.5 + k / 2)]
  }

  /** Arah badan di batang ekor (radian), dipakai untuk memutar sirip ekor. */
  tailAngle(): number {
    const d = (this.wave(1) - this.wave(0.9)) / (0.1 * this.span)
    return Math.atan(d) * 1.6
  }

  path(): Path2D {
    const p = new Path2D()
    const steps = 16
    const nose = this.mid(0)
    p.moveTo(nose[0] - this.spec.height * 0.02, nose[1])
    for (let i = 1; i <= steps; i++) {
      const [x, y] = this.top(i / steps)
      p.lineTo(x, y)
    }
    for (let i = steps; i >= 1; i--) {
      const [x, y] = this.bottom(i / steps)
      p.lineTo(x, y)
    }
    p.closePath()
    return p
  }
}

/** Sirip ekor di batang ekor; bentuk 'fork' (bercabang), 'shark' (lobus atas panjang), 'fan' (kipas). */
function tailFin(ctx: CanvasRenderingContext2D, frame: FishFrame) {
  const { spec } = frame
  const [x, y] = frame.mid(1)
  const neck = (spec.height / 2) * spec.neck
  const size = spec.height * spec.tailSize
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(frame.tailAngle())
  const fin = ctx.createLinearGradient(0, 0, size, 0)
  fin.addColorStop(0, spec.fin)
  fin.addColorStop(1, tint(spec.fin, 0.25, 0.85))
  ctx.fillStyle = fin
  ctx.beginPath()
  ctx.moveTo(-2, -neck)
  if (spec.tail === 'shark') {
    ctx.quadraticCurveTo(size * 0.55, -size * 0.45, size * 1.05, -size * 1.05)
    ctx.quadraticCurveTo(size * 0.6, -size * 0.2, size * 0.5, 0)
    ctx.quadraticCurveTo(size * 0.62, size * 0.25, size * 0.68, size * 0.62)
    ctx.quadraticCurveTo(size * 0.3, size * 0.25, -2, neck)
  } else if (spec.tail === 'fan') {
    ctx.quadraticCurveTo(size * 0.6, -size * 0.9, size, -size * 0.7)
    ctx.quadraticCurveTo(size * 1.15, 0, size, size * 0.7)
    ctx.quadraticCurveTo(size * 0.6, size * 0.9, -2, neck)
  } else {
    ctx.quadraticCurveTo(size * 0.5, -size * 0.5, size, -size * 0.85)
    ctx.quadraticCurveTo(size * 0.62, -size * 0.1, size * 0.58, 0)
    ctx.quadraticCurveTo(size * 0.62, size * 0.1, size, size * 0.85)
    ctx.quadraticCurveTo(size * 0.5, size * 0.5, -2, neck)
  }
  ctx.closePath()
  ctx.fill()
  // Jari-jari sirip
  ctx.strokeStyle = tint(spec.fin, -0.35, 0.35)
  ctx.lineWidth = Math.max(0.6, size * 0.03)
  ctx.beginPath()
  for (let i = -3; i <= 3; i++) {
    ctx.moveTo(0, (i / 3) * neck * 0.8)
    ctx.lineTo(size * 0.62, (i / 3) * size * 0.62)
  }
  ctx.stroke()
  ctx.restore()
}

/** Sirip punggung, menempel di garis atas badan. */
function dorsalFin(ctx: CanvasRenderingContext2D, frame: FishFrame) {
  const { spec } = frame
  const d = spec.dorsal
  if (!d) return
  const [ax, ay] = frame.top(d.at - 0.12)
  const [bx, by] = frame.top(d.at + 0.12)
  const size = spec.height * d.size
  ctx.fillStyle = tint(spec.back, -0.1)
  ctx.beginPath()
  ctx.moveTo(ax, ay + 1)
  if (d.kind === 'shark') {
    ctx.quadraticCurveTo(ax + (bx - ax) * 0.3, ay - size * 0.7, bx + size * 0.12, Math.min(ay, by) - size)
    ctx.quadraticCurveTo(bx - size * 0.05, by - size * 0.4, bx, by + 1)
  } else {
    const spines = d.kind === 'spiny' ? 5 : 0
    if (spines) {
      for (let i = 1; i <= spines; i++) {
        const t = i / (spines + 1)
        const x = ax + (bx - ax) * t
        const y = ay + (by - ay) * t
        ctx.lineTo(x + size * 0.15, y - size * (1 - t * 0.4))
        ctx.lineTo(x + size * 0.12, y - size * 0.45)
      }
    } else {
      ctx.quadraticCurveTo(ax + (bx - ax) * 0.4, ay - size * 1.1, bx + size * 0.2, by - size * 0.35)
    }
    ctx.lineTo(bx, by + 1)
  }
  ctx.closePath()
  ctx.fill()
}

/** Sirip dada (bergerak) atau sirip anal; digambar di atas badan, sedikit tembus pandang. */
function sideFin(ctx: CanvasRenderingContext2D, frame: FishFrame, at: number, size: number, flap: number, under: boolean) {
  const { spec } = frame
  const [x, y] = under ? frame.bottom(at) : frame.mid(at, 0.35)
  const s = spec.height * size
  ctx.save()
  ctx.translate(x, y - (under ? 1 : 0))
  ctx.rotate(under ? 0.5 : 0.55 + flap * 0.35)
  ctx.fillStyle = withAlpha(spec.fin, under ? 0.95 : 0.8)
  ctx.beginPath()
  ctx.moveTo(-s * 0.15, 0)
  ctx.quadraticCurveTo(s * 0.5, -s * 0.18, s, s * 0.35)
  ctx.quadraticCurveTo(s * 0.45, s * 0.38, -s * 0.15, s * 0.12)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = tint(spec.fin, -0.4, 0.3)
  ctx.lineWidth = 0.7
  ctx.beginPath()
  for (let i = 1; i <= 3; i++) {
    ctx.moveTo(0, s * 0.05)
    ctx.lineTo(s * (0.55 + i * 0.12), s * (0.05 + i * 0.09))
  }
  ctx.stroke()
  ctx.restore()
}

/**
 * Ikan lengkap tanpa mata/mulut (itu khusus per jenis). Mengembalikan kerangkanya supaya pemanggil bisa
 * menaruh mata, insang, gigi, dsb. di titik yang ikut bergerak.
 */
export function drawFish(ctx: CanvasRenderingContext2D, spec: FishSpec, pose: FishPose): FishFrame {
  const frame = new FishFrame(spec, pose)
  const flap = Math.sin(pose.phase * 0.5)
  tailFin(ctx, frame)
  dorsalFin(ctx, frame)
  if (spec.anal) sideFin(ctx, frame, spec.anal.at, spec.anal.size, 0, true)

  const body = frame.path()
  const h = spec.height / 2
  const shade = ctx.createLinearGradient(0, -h, 0, h * spec.belly)
  shade.addColorStop(0, tint(spec.back, -0.15))
  shade.addColorStop(0.3, spec.back)
  if (spec.sharpShade) {
    shade.addColorStop(0.5, spec.side)
    shade.addColorStop(0.56, spec.under)
  } else {
    shade.addColorStop(0.55, spec.side)
    shade.addColorStop(0.85, spec.under)
  }
  shade.addColorStop(1, tint(spec.under, -0.12))
  ctx.fillStyle = shade
  ctx.fill(body)

  ctx.save()
  ctx.clip(body)
  // Sisik: deretan busur halus
  if (spec.scales) {
    const r = Math.max(2.2, spec.height * 0.11)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
    ctx.lineWidth = Math.max(0.6, r * 0.18)
    ctx.beginPath()
    for (let gx = frame.x(0.22); gx < frame.x(0.95); gx += r * 1.5) {
      const t = (gx - frame.x(0)) / (frame.x(1) - frame.x(0))
      const w = frame.wave(t)
      for (let gy = -h; gy < h * spec.belly; gy += r * 1.3) {
        const off = Math.round((gy + h) / (r * 1.3)) % 2 ? r * 0.75 : 0
        ctx.moveTo(gx + off + r, gy + w)
        ctx.arc(gx + off, gy + w, r, 0, Math.PI * 0.95)
      }
    }
    ctx.stroke()
  }
  // Cahaya dari atas dan bayangan di perut
  const light = ctx.createLinearGradient(0, -h, 0, h * spec.belly)
  light.addColorStop(0, 'rgba(255, 255, 255, 0.28)')
  light.addColorStop(0.22, 'rgba(255, 255, 255, 0)')
  light.addColorStop(0.8, 'rgba(0, 10, 25, 0)')
  light.addColorStop(1, 'rgba(0, 10, 25, 0.3)')
  ctx.fillStyle = light
  ctx.fill(body)
  // Garis gurat sisi
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.lineWidth = Math.max(0.8, spec.height * 0.03)
  ctx.beginPath()
  for (let i = 0; i <= 10; i++) {
    const t = 0.25 + (i / 10) * 0.72
    const [x, y] = frame.mid(t, -0.12)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // Garis tepi supaya bentuk tegas di latar yang ramai
  ctx.strokeStyle = tint(spec.back, -0.55, 0.65)
  ctx.lineWidth = Math.max(1, spec.height * 0.035)
  ctx.stroke(body)
  if (spec.pectoral) sideFin(ctx, frame, spec.pectoral.at, spec.pectoral.size, flap, false)
  return frame
}

/** Lengkung insang di belakang kepala. */
export function gill(ctx: CanvasRenderingContext2D, frame: FishFrame, at: number, color = 'rgba(10, 20, 30, 0.35)') {
  const [x, yt] = frame.top(at)
  const [, yb] = frame.bottom(at)
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(0.8, frame.spec.height * 0.04)
  ctx.beginPath()
  ctx.moveTo(x - 1, yt + (yb - yt) * 0.2)
  ctx.quadraticCurveTo(x + frame.spec.height * 0.12, yt + (yb - yt) * 0.5, x - 1, yt + (yb - yt) * 0.82)
  ctx.stroke()
}

/**
 * Mata: 'fish' (putih, iris berwarna), 'shark' (hitam pekat dengan kilau), 'glow' (bercahaya).
 */
export function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, style: 'fish' | 'shark' | 'glow', iris = '#c9a227') {
  if (style === 'glow') {
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3)
    halo.addColorStop(0, withAlpha(iris, 0.55))
    halo.addColorStop(1, withAlpha(iris, 0))
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(x, y, r * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  const ball = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
  if (style === 'shark') {
    ball.addColorStop(0, '#2b3440')
    ball.addColorStop(1, '#05080c')
  } else if (style === 'glow') {
    ball.addColorStop(0, '#ffffff')
    ball.addColorStop(0.45, tint(iris, 0.4))
    ball.addColorStop(1, iris)
  } else {
    ball.addColorStop(0, '#ffffff')
    ball.addColorStop(1, '#c9d6de')
  }
  ctx.fillStyle = ball
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  if (style === 'fish') {
    ctx.fillStyle = iris
    ctx.beginPath()
    ctx.arc(x - r * 0.18, y, r * 0.66, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#06090d'
    ctx.beginPath()
    ctx.arc(x - r * 0.24, y, r * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  if (style !== 'glow') {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.lineWidth = Math.max(0.6, r * 0.18)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.beginPath()
  ctx.arc(x - r * 0.38, y - r * 0.38, Math.max(0.6, r * 0.24), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.beginPath()
  ctx.arc(x + r * 0.3, y + r * 0.3, Math.max(0.4, r * 0.11), 0, Math.PI * 2)
  ctx.fill()
}

// ---------- Tentakel ----------

/**
 * Tentakel meruncing di sepanjang titik-titik `points` (dari pangkal ke ujung), lebar `base` di pangkal.
 * `suckers` = warna mangkuk isap di sisi bawah (null = tanpa). `taper` kecil = tetap tebal lebih lama.
 */
export function tentacle(ctx: CanvasRenderingContext2D, points: [number, number][], base: number, fill: string | CanvasGradient, suckers: string | null, outline: string, taper = 0.65) {
  const n = points.length
  const left: [number, number][] = []
  const right: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const [px, py] = points[Math.max(0, i - 1)]
    const [qx, qy] = points[Math.min(n - 1, i + 1)]
    const dx = qx - px
    const dy = qy - py
    const len = Math.hypot(dx, dy) || 1
    const w = (base / 2) * (1 - i / (n - 1)) ** taper + 0.6
    const [x, y] = points[i]
    left.push([x - (dy / len) * w, y + (dx / len) * w])
    right.push([x + (dy / len) * w, y - (dx / len) * w])
  }
  ctx.beginPath()
  ctx.moveTo(left[0][0], left[0][1])
  for (let i = 1; i < n; i++) {
    const [ax, ay] = left[i - 1]
    const [bx, by] = left[i]
    ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2)
  }
  ctx.lineTo(points[n - 1][0], points[n - 1][1])
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1])
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = outline
  ctx.lineWidth = 1.2
  ctx.stroke()
  if (suckers) {
    ctx.fillStyle = suckers
    for (let i = 1; i < n - 1; i++) {
      const [x, y] = left[i]
      const [mx, my] = points[i]
      const r = Math.max(1, (base / 2) * (1 - i / (n - 1)) * 0.38)
      ctx.beginPath()
      ctx.arc(x + (mx - x) * 0.3, y + (my - y) * 0.3, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// ---------- Gelembung ----------

/** Gelembung kecil berkilau (napas penyelam, jejak misil). */
export function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.strokeStyle = `rgba(215, 245, 255, ${0.75 * alpha})`
  ctx.fillStyle = `rgba(190, 235, 255, ${0.12 * alpha})`
  ctx.lineWidth = Math.max(0.8, r * 0.22)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * alpha})`
  ctx.beginPath()
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2)
  ctx.fill()
}
