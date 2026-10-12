import gsap from 'gsap'
import { useLayoutEffect, useRef } from 'react'
import type { Ruleset } from '../game/state'
import { SOCIAL_ICON_PATHS, type SocialIcon } from './socialIcons'
import { TileField } from './TileField'

/**
 * Tumpukan ubin hiasan per sistem permainan (posisi dan putarannya diatur di index.css).
 * Normal: sedikit kolom, banyak baris, lalu diputar 45° jadi pita diagonal.
 * Hong Kong Points: ubin besar tegak, kolomnya naik-turun selang-seling.
 */
const TILE_LAYOUTS: Record<Ruleset, { cols: number; rows: number }> = {
  classic: { cols: 4, rows: 11 },
  hk: { cols: 4, rows: 7 },
}

const RULESET_OPTIONS: { ruleset: Ruleset; label: string }[] = [
  { ruleset: 'classic', label: 'Normal' },
  { ruleset: 'hk', label: 'HK Points' },
]

const TAGLINES: Record<Ruleset, string> = {
  classic: 'Kumpulkan 4 set + 1 pair untuk menang.',
  hk: 'Kumpulkan 4 set + 1 pair, lalu hitung faan-nya.',
}

/**
 * Tautan sosial pembuat, ditampilkan di pojok kanan bawah. Entri dengan `url` kosong
 * tidak ditampilkan. URL harus lengkap dengan `https://`; tanpa itu browser menganggapnya
 * alamat di dalam situs ini.
 */
const CREATOR = 'David Ivan'
const SOCIALS: { name: string; icon: SocialIcon; url: string }[] = [
  { name: 'LinkedIn', icon: 'linkedin', url: 'https://www.linkedin.com/in/davidivan6900' },
  { name: 'GitHub', icon: 'github', url: 'https://github.com/DavidIvanSantoso' },
  { name: 'Instagram', icon: 'instagram', url: 'https://www.instagram.com/_davidivan' },
]

interface HomeScreenProps {
  ruleset: Ruleset
  onRuleset: (ruleset: Ruleset) => void
  onLocal: () => void
  onOnline: () => void
  onTutorial: () => void
}

export function HomeScreen({ ruleset, onRuleset, onLocal, onOnline, onTutorial }: HomeScreenProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const layout = TILE_LAYOUTS[ruleset]

  /** Mobile: tiga baris tengah, tepat di belakang kartu menu, dikosongkan (lihat index.css). */
  const centerRowClass = (row: number) =>
    Math.abs(row - Math.floor(layout.rows / 2)) <= 1 ? 'htile--center' : ''

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.from(':scope > *', {
        x: -32,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.out',
        stagger: 0.08,
        delay: 0.15,
        clearProps: 'transform,opacity',
      })
    }, menuRef)
    return () => ctx.revert()
  }, [])

  return (
    <main className={`home home--${ruleset}`}>
      <div className="home__menu" ref={menuRef}>
        <div className="ruleset-toggle" role="radiogroup" aria-label="Sistem permainan">
          {RULESET_OPTIONS.map((option) => (
            <label
              key={option.ruleset}
              className={`ruleset-toggle__option ${ruleset === option.ruleset ? 'ruleset-toggle__option--active' : ''}`}
            >
              <input
                type="radio"
                name="ruleset"
                checked={ruleset === option.ruleset}
                onChange={() => onRuleset(option.ruleset)}
              />
              {option.label}
            </label>
          ))}
        </div>
        <h1 className="home__title">
          Mahjong
          {ruleset === 'hk' && <span className="home__title-sub">HK Points</span>}
        </h1>
        <p className="home__tagline">{TAGLINES[ruleset]}</p>
        <button type="button" className="home__btn" onClick={onLocal}>
          Local
        </button>
        <button type="button" className="home__btn" onClick={onOnline}>
          Online
        </button>
        <button type="button" className="home__btn" onClick={onTutorial}>
          Tutorial
        </button>
        {/*
          Mode Normal tidak punya baris "HK Points". Tempat setinggi baris itu disisakan di bawah
          menu, supaya tinggi menu (dan posisi toggle di atasnya) sama di kedua sistem.
        */}
        {ruleset === 'classic' && (
          <div className="home__title home__title-spacer" aria-hidden="true">
            <span className="home__title-sub">HK Points</span>
          </div>
        )}
      </div>

      {/* `key`: susunan ubinnya berbeda per sistem, jadi tumpukannya dibuat ulang saat berganti. */}
      <TileField
        key={ruleset}
        className="home__tiles"
        cols={layout.cols}
        rows={layout.rows}
        tileClassName={centerRowClass}
      />

      <footer className="home__credit">
        <span>
          Created by <strong>{CREATOR}</strong>
        </span>
        <ul className="home__socials">
          {SOCIALS.filter((social) => social.url).map((social) => (
            <li key={social.name}>
              <a
                className="social-link"
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                title={social.name}
                aria-label={`${social.name} ${CREATOR} (tab baru)`}
              >
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d={SOCIAL_ICON_PATHS[social.icon]} />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </main>
  )
}
