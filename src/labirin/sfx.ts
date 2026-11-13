import { useSyncExternalStore } from 'react'

/** Efek suara LABIRIN lewat Web Audio (tanpa file suara); bisa dimatikan, pilihannya disimpan. */
const STORAGE_KEY = 'labirin-sfx'

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
    // localStorage bisa diblokir; pilihannya berlaku selama halaman terbuka.
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

function tone(freq: number, duration: number, { type = 'square' as OscillatorType, volume = 0.04, slide = 0, delay = 0 } = {}) {
  if (!enabled) return
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    const ctx = context
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime + delay
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  } catch {
    // Audio tidak tersedia: diam saja.
  }
}

export const sfx = {
  tick: () => tone(660, 0.12, { volume: 0.035 }),
  go: () => [880, 1320].forEach((freq, i) => tone(freq, 0.18, { volume: 0.04, delay: i * 0.08 })),
  join: () => tone(520, 0.12, { type: 'triangle', volume: 0.04, slide: 300 }),
  win: () => [523, 659, 784, 1047, 1319].forEach((freq, i) => tone(freq, 0.22, { type: 'triangle', volume: 0.05, delay: i * 0.09 })),
  lose: () => [392, 330, 262].forEach((freq, i) => tone(freq, 0.28, { type: 'triangle', volume: 0.05, delay: i * 0.14 })),
}
