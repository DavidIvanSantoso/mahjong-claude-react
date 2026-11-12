import { useSyncExternalStore } from 'react'
import type { GameEvent } from './engine'

/**
 * Efek suara PALUNG, dibuat langsung lewat Web Audio (tanpa file suara). Bisa dimatikan; pilihannya
 * disimpan di perangkat ini.
 */
const STORAGE_KEY = 'palung-sfx'

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
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

function tone(freq: number, duration: number, { type = 'sine', volume = 0.05, slide = 0, delay = 0 }: { type?: OscillatorType; volume?: number; slide?: number; delay?: number } = {}) {
  const ctx = audio()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const now = ctx.currentTime + delay
  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.02)
}

function noise(duration: number, { from = 1800, to = 120, volume = 0.25, filter = 'lowpass' as BiquadFilterType } = {}) {
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

const SOUNDS: Record<GameEvent, () => void> = {
  key: () => tone(1100 + Math.random() * 200, 0.035, { type: 'triangle', volume: 0.025 }),
  lock: () => tone(700, 0.06, { type: 'square', volume: 0.02, slide: 300 }),
  error: () => tone(140, 0.12, { type: 'sawtooth', volume: 0.035, slide: -40 }),
  // Ikan bayangan menampakkan diri: desir naik
  reveal: () => {
    tone(320, 0.25, { type: 'triangle', volume: 0.04, slide: 500 })
    noise(0.25, { filter: 'highpass', from: 1200, to: 3500, volume: 0.06 })
  },
  release: () => tone(500, 0.08, { type: 'triangle', volume: 0.03, slide: -250 }),
  // Gelembung pecah: nada naik cepat
  kill: () => {
    tone(300, 0.12, { volume: 0.07, slide: 900 })
    tone(600, 0.1, { volume: 0.04, slide: 1200, delay: 0.05 })
  },
  segment: () => tone(220, 0.15, { type: 'square', volume: 0.03, slide: 200 }),
  hurt: () => {
    noise(0.4, { volume: 0.35, to: 60 })
    tone(110, 0.35, { type: 'square', volume: 0.05, slide: -60 })
  },
  heal: () => [523, 659, 784].forEach((freq, i) => tone(freq, 0.14, { type: 'triangle', volume: 0.05, delay: i * 0.08 })),
  bonus: () => [784, 988, 1319].forEach((freq, i) => tone(freq, 0.12, { type: 'triangle', volume: 0.045, delay: i * 0.06 })),
  sonar: () => {
    tone(1500, 0.9, { volume: 0.07, slide: -1200 })
    noise(0.6, { filter: 'highpass', from: 600, to: 4000, volume: 0.12 })
  },
  'sonar-empty': () => tone(200, 0.1, { type: 'square', volume: 0.025 }),
  swarm: () => [880, 880, 880].forEach((freq, i) => tone(freq, 0.05, { type: 'square', volume: 0.025, delay: i * 0.1 })),
  boss: () => {
    tone(70, 1.4, { type: 'sawtooth', volume: 0.06, slide: 20 })
    tone(105, 1.4, { type: 'sawtooth', volume: 0.04, slide: 15 })
  },
  zone: () => [392, 523, 659].forEach((freq, i) => tone(freq, 0.4, { volume: 0.04, delay: i * 0.15 })),
  over: () => [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.35, { type: 'triangle', volume: 0.06, delay: 0.3 + i * 0.22 })),
}

/** Memutar suara untuk kejadian-kejadian sejak frame lalu (paling banyak satu per jenis). */
export function playEvents(events: GameEvent[]) {
  if (!enabled) return
  for (const event of new Set(events)) SOUNDS[event]()
}
