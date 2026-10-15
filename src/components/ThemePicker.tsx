import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Ruleset } from '../game/state'
import { t } from '../i18n'

/**
 * Palet warna website (nilainya di index.css, `:root[data-palette='…']`).
 * `swatch`: latar halaman, meja, dan warna sorotan, untuk contoh di daftar pilihan.
 */
const PALETTES = [
  { id: 'classic', name: 'Normal', swatch: ['#b8cfb3', '#84a282', '#f6e2e9'] },
  { id: 'hk', name: 'Hong Kong', swatch: ['#151a19', '#087f5b', '#d4a72c'] },
  { id: 'tokyo', name: 'Tokyo Mahjong', swatch: ['#171717', '#718355', '#e8a0a8'] },
  { id: 'wimbledon', name: 'Wimbledon', swatch: ['#5a315d', '#1f4d3a', '#c8a951'] },
  { id: 'brown', name: 'Brown', swatch: ['#362925', '#a17e61', '#dbc9b8'] },
] as const

type PaletteId = (typeof PALETTES)[number]['id']

const STORAGE_KEY = 'mahjong-palette'

/** Palet yang terakhir dipilih di perangkat ini; null berarti mengikuti sistem permainan. */
function savedPalette(): PaletteId | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return PALETTES.find((palette) => palette.id === saved)?.id ?? null
  } catch {
    return null
  }
}

/*
 * Pilihan palet disimpan di luar React supaya tombol tema di homescreen dan di meja permainan
 * selalu sama. Palet dipasang lewat `data-palette` di <html> dan menimpa tema sistem permainan
 * (`data-theme`); tanpa pilihan, atributnya dilepas dan tema sistem permainan yang tampil.
 */
let choice = savedPalette()
const listeners = new Set<() => void>()

function applyPalette() {
  const root = document.documentElement
  if (choice) root.dataset.palette = choice
  else delete root.dataset.palette
}
applyPalette()

function choosePalette(next: PaletteId | null) {
  choice = next
  applyPalette()
  try {
    if (next) localStorage.setItem(STORAGE_KEY, next)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage bisa diblokir; pilihannya tetap berlaku selama halaman terbuka.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Tombol tema (ikon palet) dengan daftar paletnya. Pilihannya berlaku di seluruh website,
 * hanya di perangkat ini; saat online tiap pemain bisa memakai palet berbeda.
 * `ruleset`: sistem permainan yang sedang tampil, untuk contoh warna pilihan "Bawaan".
 */
export function ThemePicker({ ruleset }: { ruleset: Ruleset }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const active = useSyncExternalStore(subscribe, () => choice)
  const options = [
    // Tanpa pilihan, warna mengikuti sistem permainan: Normal atau Hong Kong Points.
    { id: null, name: t('Bawaan', 'Default'), swatch: PALETTES.find((palette) => palette.id === ruleset)!.swatch },
    ...PALETTES,
  ]

  // Daftar menutup lewat Esc atau ketukan di luarnya.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="theme-picker" ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        aria-label={t('Tema warna', 'Color theme')}
        title={t('Tema warna', 'Color theme')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {/* Palet cat */}
        <svg viewBox="0 0 16 16" fill="currentColor" fillRule="evenodd" aria-hidden="true">
          <path d="M8 1.5a6.5 6.5 0 0 0 0 13c.9 0 1.5-.6 1.5-1.4 0-.4-.2-.7-.4-1-.2-.2-.3-.5-.3-.8 0-.7.6-1.3 1.3-1.3h1.4a3 3 0 0 0 3-3C14.5 4 11.6 1.5 8 1.5ZM4.5 9a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1.8-3.2a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm3.4-.3a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm2.1 2.3a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
        </svg>
      </button>
      {open && (
        <div className="card theme-picker__panel" role="radiogroup" aria-label={t('Tema warna', 'Color theme')}>
          {options.map((palette) => (
            <button
              key={palette.id ?? 'auto'}
              type="button"
              role="radio"
              aria-checked={palette.id === active}
              className={`theme-picker__option ${palette.id === active ? 'theme-picker__option--active' : ''}`}
              onClick={() => choosePalette(palette.id)}
            >
              <span className="theme-picker__swatch" aria-hidden="true">
                {palette.swatch.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </span>
              {palette.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
