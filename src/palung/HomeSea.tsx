import { useEffect, useRef } from 'react'
import { fishSilhouette, glowDot, hash, whaleShape } from './ambience'
import type { EnemyKind } from './config'
import { drawFishArt } from './render'

/**
 * Latar animasi beranda PALUNG: sinar matahari dan kaustik di permukaan, ikan dari game (teri berkawanan,
 * piranha, hiu, hiu martil) berenang di kedalaman yang sesuai, kawanan siluet dan paus di kejauhan,
 * ubur-ubur dan plankton bercahaya di dasar, rumput laut yang bergoyang. Ikan menghindar dari kursor/jari.
 * Murni hiasan: tidak memakai engine game. Gradasi warna laut tetap dari CSS (.pl-home).
 */

/** Jenis ikan per pita kedalaman layar (0 = atas, 1 = bawah). */
const BANDS: { from: number; to: number; kinds: EnemyKind[] }[] = [
  { from: 0.12, to: 0.4, kinds: ['teri', 'teri', 'piranha'] },
  { from: 0.3, to: 0.66, kinds: ['piranha', 'hiu', 'hiu', 'martil'] },
  { from: 0.58, to: 0.86, kinds: ['martil', 'bayangan', 'bayangan'] },
]
/** Kecepatan dasar (piksel/detik) per jenis. */
const SPEED: Partial<Record<EnemyKind, number>> = { teri: 95, piranha: 70, hiu: 48, martil: 34, bayangan: 28 }
/** Jumlah ikan (atau kawanan) yang berenang sekaligus, per 1000 piksel lebar layar. */
const DENSITY = 4.5
const FLEE_RADIUS = 150
const MAX_DPR = 1.5

interface Fish {
  kind: EnemyKind
  x: number
  y: number
  /** Simpangan vertikal karena menghindar (kembali pelan ke 0). */
  dodge: number
  dir: 1 | -1
  speed: number
  scale: number
  age: number
  phase: number
  /** Dorongan kecepatan sesaat setelah dikejutkan kursor. */
  scare: number
  ghost: boolean
}

class Sea {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private width = 0
  private height = 0
  private dpr = 1
  private fish: Fish[] = []
  private clock = 0
  private spawnIn = 0
  pointer: { x: number; y: number } | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    this.canvas.width = Math.round(width * this.dpr)
    this.canvas.height = Math.round(height * this.dpr)
    // Layar baru: isi langsung dengan ikan di posisi acak supaya tidak kosong di awal.
    this.fish = []
    const target = this.target()
    for (let i = 0; i < target; i++) this.spawn(true)
  }

  private target() {
    return Math.max(3, Math.round((this.width / 1000) * DENSITY + 1))
  }

  /** Satu ikan, atau satu kawanan teri, masuk dari tepi kiri/kanan (atau di mana saja saat `anywhere`). */
  private spawn(anywhere = false) {
    const band = BANDS[Math.floor(Math.random() * BANDS.length)]
    const kind = band.kinds[Math.floor(Math.random() * band.kinds.length)]
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
    const y = (band.from + Math.random() * (band.to - band.from)) * this.height
    const startX = anywhere ? Math.random() * this.width : dir === 1 ? -160 : this.width + 160
    const scale = (kind === 'martil' || kind === 'hiu' ? 0.7 : 0.85) + Math.random() * 0.3
    const speed = (SPEED[kind] ?? 50) * (0.85 + Math.random() * 0.3)
    const base = { kind, dir, speed, dodge: 0, scare: 0, ghost: kind === 'bayangan' }
    if (kind === 'teri') {
      const count = 7 + Math.floor(Math.random() * 7)
      for (let i = 0; i < count; i++) {
        this.fish.push({
          ...base,
          x: startX - dir * (Math.random() * 110),
          y: y + (Math.random() - 0.5) * 60,
          scale: 0.85 + Math.random() * 0.25,
          age: Math.random() * 10,
          phase: Math.random() * 6,
        })
      }
      return
    }
    this.fish.push({ ...base, x: startX, y, scale, age: Math.random() * 10, phase: Math.random() * 6 })
  }

  /** Banyaknya "rombongan" (ikan tunggal atau kawanan) yang sedang terlihat. */
  private groups() {
    let solo = 0
    let teri = 0
    for (const fish of this.fish) {
      if (fish.kind === 'teri') teri++
      else solo++
    }
    return solo + Math.round(teri / 10)
  }

  update(dt: number) {
    this.clock += dt
    const pointer = this.pointer
    for (const fish of this.fish) {
      fish.age += dt
      fish.scare = Math.max(0, fish.scare - dt * 0.8)
      fish.dodge *= Math.pow(0.6, dt)
      if (pointer) {
        const dx = fish.x - pointer.x
        const dy = fish.y + fish.dodge - pointer.y
        const distance = Math.hypot(dx, dy)
        if (distance < FLEE_RADIUS) {
          const push = 1 - distance / FLEE_RADIUS
          fish.dodge += Math.sign(dy || 1) * push * 220 * dt
          fish.scare = Math.min(1.6, fish.scare + push * 3 * dt)
        }
      }
      fish.x += fish.dir * fish.speed * (1 + fish.scare) * dt
    }
    this.fish = this.fish.filter((fish) => (fish.dir === 1 ? fish.x < this.width + 200 : fish.x > -200))
    this.spawnIn -= dt
    if (this.spawnIn <= 0 && this.groups() < this.target()) {
      this.spawn()
      this.spawnIn = 0.8 + Math.random() * 1.6
    }
  }

  draw() {
    const { ctx, width: w, height: h } = this
    const t = this.clock
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // Sinar matahari dari permukaan
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const rays = Math.max(5, Math.round(w / 220))
    for (let i = 0; i < rays; i++) {
      const x = ((i + 0.3) / rays) * w + Math.sin(t * 0.25 + i * 1.7) * 50
      const alpha = 0.05 + 0.035 * Math.sin(t * 0.6 + i * 2.1)
      const ray = ctx.createLinearGradient(0, 0, 0, h * 0.75)
      ray.addColorStop(0, `rgba(210, 248, 255, ${alpha})`)
      ray.addColorStop(1, 'rgba(210, 248, 255, 0)')
      ctx.fillStyle = ray
      ctx.beginPath()
      ctx.moveTo(x - 26 - (i % 3) * 10, 0)
      ctx.lineTo(x + 26 + (i % 2) * 12, 0)
      ctx.lineTo(x + 190, h * 0.75)
      ctx.lineTo(x + 10, h * 0.75)
      ctx.closePath()
      ctx.fill()
    }
    // Kaustik: jaring cahaya bergoyang di bagian atas
    ctx.lineWidth = 2
    for (let j = 0; j < 6; j++) {
      ctx.strokeStyle = `rgba(210, 250, 255, ${0.06 * (1 - j / 7)})`
      ctx.beginPath()
      for (let x = 0; x <= w + 14; x += 14) {
        const y = 14 + j * 30 + Math.sin(x * 0.022 + t * 1.3 + j * 1.9) * 9 + Math.sin(x * 0.051 - t * 0.9 + j) * 5
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.restore()

    // Kejauhan: paus yang lewat pelan dan kawanan siluet
    const whalePeriod = 48
    const wt = (t % whalePeriod) / whalePeriod
    const whaleScale = Math.max(0.7, Math.min(1.3, w / 1100))
    ctx.save()
    ctx.globalAlpha = 0.16
    ctx.fillStyle = '#020a14'
    ctx.translate(w + 320 * whaleScale - wt * (w + 640 * whaleScale), h * 0.5 + Math.sin(t * 0.4) * 14)
    ctx.scale(whaleScale, whaleScale)
    whaleShape(ctx, t)
    ctx.restore()
    for (const [period, seed] of [
      [17, 1],
      [23, 2],
    ]) {
      const n = Math.floor(t / period)
      const k = (t % period) / period
      const dir = hash(n * 5 + seed) < 0.5 ? 1 : -1
      const cx = dir === 1 ? -200 + k * (w + 400) : w + 200 - k * (w + 400)
      const cy = h * (0.25 + hash(n * 3 + seed) * 0.4)
      ctx.fillStyle = 'rgba(3, 20, 38, 0.35)'
      for (let i = 0; i < 14; i++) {
        const ox = (hash(i * 3 + n) - 0.5) * 150 + Math.sin(t * 2 + i) * 4
        const oy = (hash(i * 5 + n + 1) - 0.5) * 60 + Math.sin(t * 1.5 + i * 0.7) * 6
        fishSilhouette(ctx, cx + ox, cy + oy, 4 + hash(i + n) * 2, dir)
      }
    }

    // Ikan dari game (yang kecil di belakang, yang besar di depan)
    const sorted = [...this.fish].sort((a, b) => a.scale - b.scale)
    for (const fish of sorted) {
      const y = fish.y + fish.dodge + Math.sin(fish.age * 1.6 + fish.phase) * 6
      drawFishArt(ctx, fish.kind, fish.x, y, fish.scale, fish.dir, fish.age * (1 + fish.scare), fish.ghost)
      if (fish.ghost) glowDot(ctx, fish.x - fish.dir * 26 * fish.scale, y - 4 * fish.scale, 10, '127, 247, 255', 0.25)
    }

    // Dasar: ubur-ubur dan plankton bercahaya
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const colors = ['127, 247, 255', '255, 130, 220', '170, 140, 255', '140, 255, 190']
    const jellies = Math.max(3, Math.round(w / 320))
    for (let i = 0; i < jellies; i++) {
      const color = colors[i % colors.length]
      const x = ((i + 0.5) / jellies) * w + Math.sin(t * 0.3 + i * 2) * 30
      const rise = (t * 8 + hash(i * 7) * h * 0.4) % (h * 0.4)
      const y = h * 0.98 - rise
      const fade = Math.min(1, rise / 60, (h * 0.4 - rise) / 60)
      const pulse = Math.sin(t * 2 + i * 1.3)
      const size = 10 + hash(i * 6 + 3) * 10
      const alpha = 0.4 * fade
      glowDot(ctx, x, y, size * 2.6, color, alpha * 0.45)
      ctx.fillStyle = `rgba(${color}, ${alpha * 0.9})`
      ctx.beginPath()
      ctx.ellipse(x, y, size * (1 + pulse * 0.08), size * 0.7, 0, Math.PI, 0)
      ctx.fill()
      ctx.strokeStyle = `rgba(${color}, ${alpha * 0.7})`
      ctx.lineWidth = 1.2
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath()
        ctx.moveTo(x + k * size * 0.35, y)
        for (let s = 1; s <= 4; s++) ctx.lineTo(x + k * size * 0.35 + Math.sin(t * 2.5 + s + k + i) * 3, y + s * size * 0.55)
        ctx.stroke()
      }
    }
    const plankton = Math.round(w / 30)
    for (let i = 0; i < plankton; i++) {
      const x = hash(i * 3 + 500) * w + Math.sin(t * 0.4 + i) * 8
      const y = h * (0.6 + hash(i * 7 + 900) * 0.4) + Math.sin(t * 0.3 + i * 2) * 10
      const twinkle = 0.5 + 0.5 * Math.sin(t * (1.2 + hash(i) * 2.5) + i * 4)
      glowDot(ctx, x, y, 3 + hash(i + 3) * 3, colors[i % 2 === 0 ? 0 : 3], 0.45 * twinkle)
    }
    ctx.restore()

    // Rumput laut di dasar, dengan ujung bercahaya
    const strands = Math.round(w / 34)
    ctx.lineCap = 'round'
    for (let i = 0; i < strands; i++) {
      if (hash(i * 11 + 4) < 0.35) continue
      const x = (i + hash(i)) * (w / strands)
      const length = 50 + hash(i * 13) * 110
      const sway = Math.sin(t * 1.1 + i * 0.9) * 14
      ctx.strokeStyle = hash(i * 5) < 0.5 ? 'rgba(18, 58, 62, 0.85)' : 'rgba(26, 72, 58, 0.85)'
      ctx.lineWidth = 4 + hash(i * 17) * 3
      ctx.beginPath()
      ctx.moveTo(x, h + 4)
      ctx.quadraticCurveTo(x + sway * 0.4 + 10, h - length * 0.5, x + sway, h - length)
      ctx.stroke()
      if (hash(i * 23) < 0.4) glowDot(ctx, x + sway, h - length, 7, '140, 255, 190', 0.35 + 0.2 * Math.sin(t * 2 + i))
    }

    // Salju laut: partikel halus yang turun pelan
    for (let i = 0; i < 70; i++) {
      const layer = 0.4 + hash(i + 7) * 0.9
      const x = (((hash(i) * w + Math.sin(t * 0.5 + i) * 6) % w) + w) % w
      const y = (hash(i + 99) * h + t * 6 * layer) % h
      ctx.fillStyle = `rgba(220, 240, 255, ${0.08 + layer * 0.14})`
      ctx.fillRect(x, y, 1.2 * layer + 0.6, 1.2 * layer + 0.6)
    }
  }
}

export function HomeSea() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sea = new Sea(canvas)
    if (import.meta.env.DEV) Object.assign(window, { __palungHome: sea })
    let frame = 0
    let last = 0
    let size = ''
    const fit = () => {
      const { width, height } = canvas.getBoundingClientRect()
      const key = `${Math.round(width)}x${Math.round(height)}`
      if (key === size || width < 1 || height < 1) return
      size = key
      sea.resize(width, height)
      sea.draw()
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)

    // Ikan menghindar dari kursor/jari (kanvas sendiri tidak menerima klik).
    const move = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect()
      sea.pointer = { x: event.clientX - box.left, y: event.clientY - box.top }
    }
    const leave = () => (sea.pointer = null)
    // Jari diangkat = tidak ada lagi yang dihindari (mouse tetap terlacak sampai keluar jendela).
    const up = (event: PointerEvent) => event.pointerType !== 'mouse' && leave()
    if (!reduced) {
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerdown', move)
      window.addEventListener('pointerup', up)
      document.documentElement.addEventListener('mouseleave', leave)
      const loop = (now: number) => {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
        last = now
        sea.update(dt)
        sea.draw()
        frame = requestAnimationFrame(loop)
      }
      frame = requestAnimationFrame(loop)
    }
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', move)
      window.removeEventListener('pointerup', up)
      document.documentElement.removeEventListener('mouseleave', leave)
    }
  }, [])

  return <canvas ref={canvasRef} className="pl-home__sea" aria-hidden="true" />
}
