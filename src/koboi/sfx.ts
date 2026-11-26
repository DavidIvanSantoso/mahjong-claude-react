import { getSettings } from './settings'

/**
 * Efek suara KOBOI, dibuat langsung lewat Web Audio (tanpa file suara): letusan revolver, denting
 * pantulan, desis sumbu, ledakan, lecutan laso, dan nada pendek bergaya gitar Barat. Volume mengikuti
 * pengaturan; permainan tetap bisa dimainkan tanpa suara.
 */

let context: AudioContext | null = null

function audio(): AudioContext | null {
  if (getSettings().volume <= 0) return null
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

const level = () => getSettings().volume

function tone(freq: number, duration: number, { type = 'triangle', volume = 0.06, slide = 0, delay = 0 }: { type?: OscillatorType; volume?: number; slide?: number; delay?: number } = {}) {
  const ctx = audio()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const now = ctx.currentTime + delay
  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(volume * level(), now + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.02)
}

function noise(duration: number, { from = 2000, to = 150, volume = 0.25, delay = 0, filter = 'lowpass' as BiquadFilterType } = {}) {
  const ctx = audio()
  if (!ctx) return
  const length = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2
  const source = ctx.createBufferSource()
  const biquad = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  const now = ctx.currentTime + delay
  biquad.type = filter
  biquad.frequency.setValueAtTime(from, now)
  biquad.frequency.exponentialRampToValueAtTime(Math.max(40, to), now + duration)
  gain.gain.setValueAtTime(volume * level(), now)
  source.buffer = buffer
  source.connect(biquad).connect(gain).connect(ctx.destination)
  source.start(now)
}

/** Petikan gitar pendek (nada naik/turun untuk gelombang, menang, kalah). */
function pluck(notes: number[], gap = 0.09, volume = 0.05) {
  notes.forEach((freq, i) => {
    tone(freq, 0.35, { type: 'triangle', volume, delay: i * gap })
    tone(freq * 2, 0.18, { type: 'sine', volume: volume * 0.3, delay: i * gap })
  })
}

const SOUNDS: Record<string, () => void> = {
  shot: () => noise(0.18, { from: 3200, to: 300, volume: 0.22 }),
  ricochet: () => {
    noise(0.12, { from: 3000, to: 400, volume: 0.15 })
    tone(1800, 0.25, { type: 'sine', volume: 0.03, slide: -900, delay: 0.03 })
  },
  ping: () => tone(2200, 0.12, { type: 'sine', volume: 0.025, slide: -600 }),
  fuse: () => noise(0.3, { from: 6000, to: 3000, volume: 0.05, filter: 'highpass' }),
  boom: () => {
    noise(0.6, { from: 900, to: 50, volume: 0.4 })
    tone(70, 0.4, { type: 'sine', volume: 0.12, slide: -30 })
  },
  tumble: () => noise(0.25, { from: 800, to: 300, volume: 0.05, filter: 'bandpass' }),
  thorn: () => tone(520, 0.12, { type: 'square', volume: 0.025, slide: 300 }),
  'whip-warn': () => tone(330, 0.15, { type: 'triangle', volume: 0.04 }),
  whip: () => noise(0.18, { from: 5000, to: 900, volume: 0.18, filter: 'bandpass' }),
  mark: () => tone(880, 0.08, { type: 'square', volume: 0.02 }),
  bang: () => noise(0.22, { from: 2600, to: 200, volume: 0.28 }),
  dust: () => noise(0.5, { from: 600, to: 200, volume: 0.06, filter: 'bandpass' }),
  dash: () => noise(0.12, { from: 1500, to: 4000, volume: 0.07, filter: 'bandpass' }),
  hit: () => {
    tone(180, 0.2, { type: 'square', volume: 0.06, slide: -90 })
    noise(0.15, { from: 1200, to: 200, volume: 0.12 })
  },
  wave: () => pluck([196, 247, 294]),
  perfect: () => pluck([196, 247, 294, 392], 0.08),
  heal: () => pluck([294, 370, 440, 587], 0.1, 0.045),
  phase: () => pluck([147, 139, 131], 0.16, 0.06),
  'duel-ready': () => tone(220, 0.5, { type: 'triangle', volume: 0.04 }),
  draw: () => tone(1320, 0.12, { type: 'square', volume: 0.05 }),
  'duel-win': () => {
    noise(0.2, { from: 3200, to: 300, volume: 0.25 })
    pluck([392, 494, 587], 0.07, 0.04)
  },
  'duel-fail': () => tone(110, 0.4, { type: 'sawtooth', volume: 0.05, slide: -40 }),
  'boss-hurt': () => tone(260, 0.15, { type: 'square', volume: 0.04, slide: -100 }),
  horn: () => {
    tone(392, 0.5, { type: 'sawtooth', volume: 0.035 })
    tone(330, 0.5, { type: 'sawtooth', volume: 0.03 })
  },
  train: () => noise(0.9, { from: 400, to: 120, volume: 0.2, filter: 'lowpass' }),
  snort: () => noise(0.25, { from: 700, to: 200, volume: 0.1, filter: 'bandpass' }),
  charge: () => noise(0.4, { from: 300, to: 80, volume: 0.18 }),
  spin: () => tone(660, 0.3, { type: 'square', volume: 0.02, slide: 400 }),
  'shot-soft': () => noise(0.08, { from: 3000, to: 600, volume: 0.07 }),
  pshot: () => {
    noise(0.14, { from: 4200, to: 500, volume: 0.2 })
    tone(140, 0.12, { type: 'sine', volume: 0.06, slide: -60 })
  },
  click: () => tone(1400, 0.04, { type: 'square', volume: 0.03 }),
  roll: () => noise(0.25, { from: 900, to: 300, volume: 0.08, filter: 'bandpass' }),
  pickup: () => {
    tone(880, 0.08, { type: 'triangle', volume: 0.04 })
    tone(1320, 0.12, { type: 'triangle', volume: 0.035, delay: 0.05 })
  },
  graze: () => tone(2400, 0.05, { type: 'sine', volume: 0.015 }),
  'deadeye-ready': () => pluck([523, 659, 784], 0.06, 0.04),
  deadeye: () => {
    tone(220, 0.8, { type: 'sine', volume: 0.08, slide: -120 })
    noise(0.6, { from: 300, to: 80, volume: 0.1 })
  },
  kick: () => {
    noise(0.12, { from: 600, to: 200, volume: 0.2 })
    tone(300, 0.15, { type: 'square', volume: 0.04, slide: 400 })
  },
  'lever-up': () => tone(500, 0.2, { type: 'triangle', volume: 0.03, slide: 200 }),
  lever: () => {
    noise(0.3, { from: 2500, to: 400, volume: 0.15, filter: 'bandpass' })
    tone(196, 0.5, { type: 'sawtooth', volume: 0.04, delay: 0.1 })
  },
  reload: () => {
    tone(1800, 0.04, { type: 'square', volume: 0.025 })
    tone(1500, 0.04, { type: 'square', volume: 0.025, delay: 0.12 })
  },
  thud: () => noise(0.1, { from: 500, to: 150, volume: 0.1 }),
  crash: () => noise(0.4, { from: 1200, to: 120, volume: 0.2 }),
  creak: () => tone(180, 0.35, { type: 'sawtooth', volume: 0.02, slide: 60 }),
  glass: () => {
    noise(0.35, { from: 7000, to: 2500, volume: 0.15, filter: 'highpass' })
    tone(2600, 0.3, { type: 'sine', volume: 0.02, slide: -800 })
  },
  decoy: () => tone(330, 0.1, { type: 'square', volume: 0.03 }),
  win: () => pluck([196, 247, 294, 392, 494, 587], 0.11, 0.05),
  over: () => pluck([294, 262, 220, 147], 0.2, 0.05),
}

export function playEvents(events: string[]) {
  // Peluru bisa banyak dalam satu frame; tiap jenis suara cukup sekali per frame.
  for (const event of new Set(events)) SOUNDS[event]?.()
}

/** Diputar sekali saat tombol ditekan di menu (memastikan AudioContext aktif setelah interaksi). */
export function unlockAudio() {
  audio()
}
