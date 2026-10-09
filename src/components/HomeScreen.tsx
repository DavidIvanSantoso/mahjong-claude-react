import gsap from 'gsap'
import { useLayoutEffect, useRef } from 'react'
import { SOCIAL_ICON_PATHS, type SocialIcon } from './socialIcons'
import { TileField } from './TileField'

/** Tumpukan ubin hiasan: sedikit kolom, banyak baris, lalu diputar 45° jadi pita diagonal. */
const COLS = 4
const ROWS = 11

/** Mobile: tiga baris tengah, tepat di belakang kartu menu, dikosongkan (lihat index.css). */
function centerRowClass(row: number): string {
  return Math.abs(row - Math.floor(ROWS / 2)) <= 1 ? 'htile--center' : ''
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
  onLocal: () => void
  onOnline: () => void
  onTutorial: () => void
}

export function HomeScreen({ onLocal, onOnline, onTutorial }: HomeScreenProps) {
  const menuRef = useRef<HTMLDivElement>(null)

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
    <main className="home">
      <div className="home__menu" ref={menuRef}>
        <h1 className="home__title">Mahjong</h1>
        <p className="home__tagline">Kumpulkan 4 set + 1 pair untuk menang.</p>
        <button type="button" className="home__btn" onClick={onLocal}>
          Local
        </button>
        <button type="button" className="home__btn" onClick={onOnline}>
          Online
        </button>
        <button type="button" className="home__btn" onClick={onTutorial}>
          Tutorial
        </button>
      </div>

      <TileField className="home__tiles" cols={COLS} rows={ROWS} tileClassName={centerRowClass} />

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
