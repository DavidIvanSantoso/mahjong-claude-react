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
  // Megalodon Robot
  alarm: () => [0, 0.35, 0.7].forEach((delay) => tone(620, 0.25, { type: 'square', volume: 0.03, slide: -220, delay })),
  missile: () => {
    noise(0.35, { filter: 'bandpass', from: 900, to: 2600, volume: 0.1 })
    tone(240, 0.3, { type: 'sawtooth', volume: 0.025, slide: 180 })
  },
  deflect: () => tone(500, 0.22, { type: 'triangle', volume: 0.05, slide: 900 }),
  'boss-hit': () => {
    noise(0.3, { volume: 0.3, from: 2400, to: 200 })
    tone(160, 0.25, { type: 'square', volume: 0.05, slide: -80 })
    tone(1200, 0.12, { type: 'square', volume: 0.02, slide: -600, delay: 0.04 })
  },
  'boss-miss': () => tone(330, 0.3, { type: 'triangle', volume: 0.035, slide: -180 }),
  qte: () => [0, 0.14].forEach((delay) => tone(880, 0.12, { type: 'square', volume: 0.04, delay })),
  'qte-key': () => tone(1320, 0.07, { type: 'square', volume: 0.035, slide: 300 }),
  'qte-win': () => [659, 880, 1175].forEach((freq, i) => tone(freq, 0.12, { type: 'square', volume: 0.035, delay: i * 0.06 })),
  'qte-fail': () => {
    tone(90, 0.5, { type: 'sawtooth', volume: 0.06, slide: -40 })
    noise(0.4, { volume: 0.25, to: 80 })
  },
  'boss-down': () => {
    noise(1.2, { volume: 0.35, from: 1200, to: 40 })
    ;[392, 494, 587, 784].forEach((freq, i) => tone(freq, 0.25, { type: 'triangle', volume: 0.05, delay: 0.4 + i * 0.1 }))
  },
  // Siren
  scream: () => {
    tone(880, 0.5, { type: 'sine', volume: 0.04, slide: 440 })
    tone(1320, 0.5, { type: 'triangle', volume: 0.025, slide: -300, delay: 0.05 })
  },
  trident: () => {
    noise(0.4, { filter: 'bandpass', from: 600, to: 3000, volume: 0.15 })
    ;[523, 784, 1047].forEach((freq, i) => tone(freq, 0.14, { type: 'square', volume: 0.035, delay: i * 0.05 }))
  },
  // Belut Listrik
  memory: () => tone(880 + Math.random() * 240, 0.18, { type: 'square', volume: 0.035, slide: 120 }),
  'release-orbs': () => {
    noise(0.5, { filter: 'highpass', from: 1800, to: 5000, volume: 0.1 })
    tone(200, 0.4, { type: 'sawtooth', volume: 0.03, slide: 400 })
  },
  zap: () => {
    noise(0.12, { filter: 'highpass', from: 3000, to: 6000, volume: 0.08 })
    tone(1400, 0.06, { type: 'square', volume: 0.025, slide: -500 })
  },
  shock: () => {
    noise(0.7, { filter: 'bandpass', from: 4000, to: 300, volume: 0.3 })
    tone(70, 0.6, { type: 'sawtooth', volume: 0.06, slide: 30 })
  },
  // Arus Gua
  cave: () => {
    noise(1.2, { from: 400, to: 60, volume: 0.25 })
    tone(55, 1.2, { type: 'sawtooth', volume: 0.04, slide: 10 })
  },
  'cave-start': () => noise(0.9, { filter: 'bandpass', from: 300, to: 2400, volume: 0.18 }),
  eel: () => noise(0.25, { filter: 'highpass', from: 2500, to: 5000, volume: 0.05 }),
  pickup: () => [1047, 1568].forEach((freq, i) => tone(freq, 0.1, { type: 'triangle', volume: 0.04, delay: i * 0.05 })),
  'cave-clear': () => [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.16, { type: 'triangle', volume: 0.05, delay: i * 0.08 })),
  zone: () => [392, 523, 659].forEach((freq, i) => tone(freq, 0.4, { volume: 0.04, delay: i * 0.15 })),
  over: () => [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.35, { type: 'triangle', volume: 0.06, delay: 0.3 + i * 0.22 })),
}

/** Memutar suara untuk kejadian-kejadian sejak frame lalu (paling banyak satu per jenis). */
export function playEvents(events: GameEvent[]) {
  if (!enabled) return
  for (const event of new Set(events)) SOUNDS[event]()
}
