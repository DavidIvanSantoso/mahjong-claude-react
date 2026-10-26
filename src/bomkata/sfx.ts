import { useSyncExternalStore } from 'react'

/**
 * Efek suara chiptune dibuat langsung lewat Web Audio (gelombang kotak dan derau), jadi tidak ada
 * file suara yang perlu dibundel. Bisa dimatikan; pilihannya disimpan di perangkat ini.
 */
const STORAGE_KEY = 'bomkata-sfx'

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

export const sfx = {
  /** Detak bom; dipanggil makin sering saat bom makin panas. */
  tick: (heat: number) => tone(heat >= 3 ? 1320 : heat === 2 ? 1100 : 880, 0.05, { volume: 0.035 }),
  /** Jawaban benar: dua nada naik. */
  ok: () => {
    tone(660, 0.08)
    setTimeout(() => tone(990, 0.12), 80)
  },
  /** Jawaban salah: dengung rendah. */
  wrong: () => tone(140, 0.22, { type: 'sawtooth', volume: 0.05, slide: -60 }),
  /** Kategori diundi. */
  roll: () => tone(520 + Math.random() * 300, 0.04, { volume: 0.03 }),
  /** Ledakan: derau yang meredup sambil makin rendah. */
  boom: () => {
    const ctx = audio()
    if (!ctx) return
    const length = Math.floor(ctx.sampleRate * 0.9)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2
    const source = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    const now = ctx.currentTime
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2400, now)
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.9)
    gain.gain.setValueAtTime(0.35, now)
    source.buffer = buffer
    source.connect(filter).connect(gain).connect(ctx.destination)
    source.start(now)
    tone(90, 0.5, { type: 'square', volume: 0.08, slide: -50 })
  },
  /** Menang: arpeggio pendek. */
  win: () => [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => tone(freq, 0.14), i * 110)),
}
