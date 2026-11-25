import { useSyncExternalStore } from 'react'

/** Pengaturan KOBOI, disimpan di perangkat ini (localStorage `koboi-settings`). */
export interface Settings {
  /** Volume efek suara 0–1 (0 = senyap). Musik latar memakai pemutar musik situs. */
  volume: number
  shake: boolean
  reduceFlash: boolean
  dash: boolean
  /** Tampilkan kotak tabrakan dan info seed (untuk menguji keadilan pola). */
  debug: boolean
}

const KEY = 'koboi-settings'
const DEFAULTS: Settings = { volume: 0.7, shake: true, reduceFlash: false, dash: true, debug: false }

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const base = { ...DEFAULTS, shake: !reduced, reduceFlash: reduced }
    return {
      volume: typeof raw.volume === 'number' ? Math.max(0, Math.min(1, raw.volume)) : base.volume,
      shake: typeof raw.shake === 'boolean' ? raw.shake : base.shake,
      reduceFlash: typeof raw.reduceFlash === 'boolean' ? raw.reduceFlash : base.reduceFlash,
      dash: typeof raw.dash === 'boolean' ? raw.dash : base.dash,
      debug: typeof raw.debug === 'boolean' ? raw.debug : base.debug,
    }
  } catch {
    return DEFAULTS
  }
}

let current = load()
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return current
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // localStorage bisa diblokir; pengaturan berlaku selama halaman terbuka.
  }
  listeners.forEach((listener) => listener())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}
