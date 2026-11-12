import { CAVE, WORLD } from './config'

/**
 * Arus Gua: kerangka terowongan dan rintangannya (data murni, tanpa DOM). Mesin (engine.ts) menggerakkan
 * state-nya; render (caveRender.ts) menggambarnya. Posisi "dunia gua" `wx` = piksel dari awal gua;
 * posisi di layar = `wx - cave.dist`.
 */

export type HazardKind = 'moray' | 'urchin' | 'jelly' | 'pearl' | 'oxygen'

export interface CaveHazard {
  kind: HazardKind
  wx: number
  /** -1 menempel di langit-langit, 1 di dasar, 0 melayang di dalam celah. */
  side: -1 | 0 | 1
  /** Untuk yang melayang: posisi relatif terhadap pusat celah (pecahan lebar celah). */
  offset: number
  phase: number
  /** Belut: detik sejak mulai keluar (−1 = masih bersembunyi). */
  t: number
  /** Mutiara sudah diambil / rintangan sudah melukai (tidak melukai dua kali). */
  done: boolean
}

export interface CavePoint {
  /** Pusat celah (y). */
  c: number
  /** Lebar celah. */
  g: number
  /** 1 = terbuka (mulut gua), 0 = tertutup penuh. */
  open: number
}

export type CavePhase = 'warning' | 'run' | 'exit'

export interface Cave {
  phase: CavePhase
  timer: number
  /** Jarak yang sudah digulir. */
  dist: number
  /** Gua selesai saat `dist` mencapai ini. */
  end: number
  speed: number
  points: CavePoint[]
  hazards: CaveHazard[]
  /** Posisi dan kecepatan penyelam di layar. */
  x: number
  y: number
  vx: number
  vy: number
  hits: number
  pearls: number
  round: number
  age: number
}

/** Batas atas daerah bermain (di bawah HUD). */
export const CAVE_TOP = 84

const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function createCave(width: number, height: number, depth: number, round: number, rand: () => number): Cave {
  const seg = CAVE.segment
  // Titik pertama yang menyempit ada di luar layar kanan, jadi dinding gua terlihat "datang".
  const start = Math.ceil(width / seg) + 1
  const tunnel = Math.ceil((CAVE.length + CAVE.lengthPerRound * round) / seg)
  const ramp = 4
  const total = start + ramp + tunnel + ramp + Math.ceil(width / seg) + 4
  const shrink = depth * CAVE.gapShrinkPerMeter
  const gapA = Math.max(CAVE.minGap, CAVE.gapStart - shrink)
  const gapB = Math.max(CAVE.minGap, CAVE.gapEnd - shrink)
  const top = CAVE_TOP
  const bottom = height - 8

  const points: CavePoint[] = []
  let c = height / 2
  for (let i = 0; i < total; i++) {
    const inside = clamp01((i - start) / ramp)
    const outside = clamp01((start + ramp + tunnel + ramp - i) / ramp)
    const closed = smooth(Math.min(inside, outside))
    const progress = clamp01((i - start) / (tunnel + ramp))
    const g = Math.max(CAVE.minGap, lerp(gapA, gapB, progress) * (0.92 + rand() * 0.16))
    const step = CAVE.maxStep * closed
    c = Math.max(top + g / 2 + 6, Math.min(bottom - g / 2 - 6, c + (rand() - 0.5) * 2 * step))
    points.push({ c: lerp(height / 2, c, closed), g: lerp(height * 2, g, closed), open: 1 - closed })
  }

  // Rintangan dan mutiara hanya di bagian yang sudah sempit.
  const hazards: CaveHazard[] = []
  const weights = Object.entries(CAVE.weights) as [HazardKind, number][]
  const sum = weights.reduce((total, [, w]) => total + w, 0)
  let last = -99
  const chance = round === 0 ? CAVE.firstChance : CAVE.chance
  // Gelembung oksigen: satu, di paruh kedua, di titik tanpa rintangan.
  const oxygenAt = start + ramp + Math.floor(tunnel * (0.55 + rand() * 0.3))
  for (let i = start + ramp + 1; i < start + ramp + tunnel - 1; i++) {
    const wx = i * seg + (rand() - 0.5) * seg * 0.4
    if (i === oxygenAt) {
      hazards.push({ kind: 'oxygen', wx, side: 0, offset: (rand() - 0.5) * 0.3, phase: rand() * Math.PI * 2, t: -1, done: false })
      last = i - 1
    } else if (i - last >= Math.max(2, CAVE.spacing - (round >= CAVE.denserFromRound ? 1 : 0)) && rand() < chance) {
      let roll = rand() * sum
      let kind: HazardKind = 'moray'
      for (const [k, w] of weights) {
        roll -= w
        if (roll <= 0) {
          kind = k
          break
        }
      }
      const wall = (rand() < 0.5 ? -1 : 1) as -1 | 1
      const side = kind === 'jelly' ? 0 : kind === 'urchin' && rand() < 0.35 ? 0 : wall
      hazards.push({ kind, wx, side, offset: (rand() - 0.5) * 0.36, phase: rand() * Math.PI * 2, t: -1, done: false })
      last = i
    } else if (rand() < CAVE.pearlChance) {
      hazards.push({ kind: 'pearl', wx, side: 0, offset: (rand() - 0.5) * 0.5, phase: rand() * Math.PI * 2, t: -1, done: false })
    }
  }

  return {
    phase: 'warning',
    timer: CAVE.warning,
    dist: 0,
    end: (start + ramp + tunnel + ramp) * seg - width * 0.2,
    speed: Math.min(CAVE.maxSpeed, CAVE.speed + depth * CAVE.speedPerMeter),
    points,
    hazards,
    x: WORLD.diverX,
    y: height / 2,
    vx: 0,
    vy: 0,
    hits: 0,
    pearls: 0,
    round,
    age: 0,
  }
}

/** Kerangka terowongan di posisi dunia `wx` (diinterpolasi halus antartitik). */
export function frameAt(cave: Cave, wx: number): CavePoint {
  const seg = CAVE.segment
  const i = Math.max(0, Math.min(cave.points.length - 2, Math.floor(wx / seg)))
  const t = smooth(clamp01(wx / seg - i))
  const a = cave.points[i]
  const b = cave.points[i + 1]
  return { c: lerp(a.c, b.c, t), g: lerp(a.g, b.g, t), open: lerp(a.open, b.open, t) }
}

/** Langit-langit dan dasar gua di posisi dunia `wx`, termasuk tonjolan batu kecil. */
export function wallsAt(cave: Cave, wx: number): { top: number; bottom: number } {
  const { c, g } = frameAt(cave, wx)
  const bumpTop = (Math.sin(wx * 0.043) + 1) * 4 + (Math.sin(wx * 0.13 + 2) + 1) * 2
  const bumpBottom = (Math.sin(wx * 0.037 + 1) + 1) * 4 + (Math.sin(wx * 0.11 + 4) + 1) * 2
  return { top: c - g / 2 + bumpTop, bottom: c + g / 2 - bumpBottom }
}

/** Seberapa jauh belut keluar dari lubangnya (0–1). */
export function morayExtent(h: CaveHazard): number {
  const { peek, out, hold, back } = CAVE.moray
  const t = h.t
  if (t < 0) return 0
  if (t < peek) return 0.14 * (t / peek)
  if (t < peek + out) return 0.14 + 0.86 * smooth((t - peek) / out)
  if (t < peek + out + hold) return 1
  if (t < peek + out + hold + back) return 1 - smooth((t - peek - out - hold) / back)
  return 0
}

/** Bagian-bagian rintangan sebagai lingkaran (untuk tabrakan dan gambar), dalam koordinat layar. */
export function hazardCircles(cave: Cave, h: CaveHazard): { x: number; y: number; r: number }[] {
  const x = h.wx - cave.dist
  const frame = frameAt(cave, h.wx)
  const walls = wallsAt(cave, h.wx)
  switch (h.kind) {
    case 'moray': {
      const extent = morayExtent(h)
      if (extent < 0.2) return []
      const anchor = h.side < 0 ? walls.top : walls.bottom
      const length = frame.g * CAVE.moray.reach * extent
      const circles = []
      for (let k = 1; k <= 4; k++) {
        const f = k / 4
        circles.push({ x: x - Math.sin(f * Math.PI) * 10 - f * extent * 14, y: anchor - h.side * length * f, r: k === 4 ? 13 : 10 })
      }
      return circles
    }
    case 'urchin': {
      const y = h.side === 0 ? frame.c + h.offset * frame.g : h.side < 0 ? walls.top + 14 : walls.bottom - 14
      return [{ x, y, r: 15 }]
    }
    case 'jelly': {
      const y = frame.c + Math.sin(cave.age * 1.5 + h.phase) * frame.g * 0.24
      return [
        { x, y, r: 15 },
        { x, y: y + 20, r: 8 },
      ]
    }
    case 'pearl':
      return [{ x, y: frame.c + h.offset * frame.g, r: 9 }]
    case 'oxygen':
      return [{ x, y: frame.c + h.offset * frame.g, r: 16 }]
  }
}

/** Titik tabrakan penyelam (badan memanjang mendatar), relatif terhadap posisinya. */
export const DIVER_PROBES = [
  { dx: -20, dy: 0, r: 8 },
  { dx: 0, dy: 0, r: 10 },
  { dx: 20, dy: -4, r: 9 },
]
