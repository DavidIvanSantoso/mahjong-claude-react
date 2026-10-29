import { useSyncExternalStore } from 'react'

/**
 * Efek suara chiptune dibuat langsung lewat Web Audio (gelombang kotak dan derau), jadi tidak ada
 * file suara yang perlu dibundel. Bisa dimatikan; pilihannya disimpan di perangkat ini.
 */
const STORAGE_KEY = 'armada-sfx'

let enabled = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
})()
const listeners = new Set<() => void>()

export function toggleSfx() {
  enabled = !enabled
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // localStorage bisa diblokir; pilihannya tetap berlaku selama halaman terbuka.
  }
  listeners.forEach((listener) => listener())
}

export function useSfxEnabled(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => enabled,
  )
}

let context: AudioContext | null = null

function audio(): AudioContext | null {
  if (!enabled) return null
  try {
    context ??= new AudioContext()
    // Browser menahan suara sampai ada interaksi; resume() berhasil setelah klik/ketik pertama.
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

function tone(freq: number, duration: number, { type = 'square', volume = 0.06, slide = 0 }: { type?: OscillatorType; volume?: number; slide?: number } = {}) {
  const ctx = audio()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const now = ctx.currentTime
  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + duration)
  gain.gain.setValueAtTime(volume, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.02)
}

/** Derau yang disaring: ledakan (lowpass) atau cipratan air (highpass). */
function noise(duration: number, { filter = 'lowpass', from = 2400, to = 120, volume = 0.3 }: { filter?: BiquadFilterType; from?: number; to?: number; volume?: number } = {}) {
  const ctx = audio()
  if (!ctx) return
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2
  const source = ctx.createBufferSource()
  const biquad = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  const now = ctx.currentTime
  biquad.type = filter
  biquad.frequency.setValueAtTime(from, now)
  biquad.frequency.exponentialRampToValueAtTime(to, now + duration)
  gain.gain.setValueAtTime(volume, now)
  source.buffer = buffer
  source.connect(biquad).connect(gain).connect(ctx.destination)
  source.start(now)
}

export const sfx = {
  /** Kapal diletakkan di papan. */
  place: () => tone(440, 0.06, { volume: 0.04 }),
  /** Kapal diputar. */
  rotate: () => tone(660, 0.05, { volume: 0.04, slide: 200 }),
  /** Aksi ditolak (posisi tidak muat, dsb.). */
  invalid: () => tone(150, 0.16, { type: 'sawtooth', volume: 0.04, slide: -50 }),
  /** Undian target berputar. */
  roll: () => tone(500 + Math.random() * 300, 0.04, { volume: 0.03 }),
  /** Giliranmu dimulai. */
  turn: () => {
    tone(523, 0.08)
    setTimeout(() => tone(784, 0.12), 90)
  },
  miss: () => {
    noise(0.45, { filter: 'highpass', from: 800, to: 3000, volume: 0.18 })
    tone(300, 0.15, { type: 'triangle', volume: 0.05, slide: -120 })
  },
  hit: () => {
    noise(0.5, { volume: 0.3 })
    tone(120, 0.3, { volume: 0.07, slide: -60 })
  },
  sunk: () => {
    noise(1, { volume: 0.4, to: 80 })
    ;[392, 330, 262, 196].forEach((freq, i) => setTimeout(() => tone(freq, 0.16, { volume: 0.05 }), 250 + i * 130))
  },
  /** Tembakan ditahan Perisai: dentang logam. */
  blocked: () => {
    tone(1200, 0.12, { type: 'triangle', volume: 0.07 })
    tone(1800, 0.2, { type: 'triangle', volume: 0.04 })
  },
  skill: () => [440, 554, 659, 880].forEach((freq, i) => setTimeout(() => tone(freq, 0.07, { volume: 0.04 }), i * 50)),
  /** Seorang pemain gugur. */
  out: () => [330, 262, 196, 131].forEach((freq, i) => setTimeout(() => tone(freq, 0.2, { type: 'triangle', volume: 0.06 }), 900 + i * 160)),
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((freq, i) => setTimeout(() => tone(freq, 0.14), i * 110)),
}
