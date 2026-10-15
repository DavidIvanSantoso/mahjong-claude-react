import { useEffect, useId, useRef, useState } from 'react'
import { LANGUAGES, setLang, t, useLang, type Lang } from '../i18n'

/**
 * Bendera sebagai SVG, bukan emoji: Windows tidak menampilkan emoji bendera.
 * Bahasa Indonesia: bendera Indonesia. English: bendera Inggris Raya (Union Jack).
 */
function Flag({ lang }: { lang: Lang }) {
  // id unik untuk clipPath, karena bendera yang sama bisa tampil dua kali di halaman.
  const id = useId()
  if (lang === 'id') {
    return (
      <svg className="flag" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="30" height="10" fill="#ce1126" />
        <rect y="10" width="30" height="10" fill="#fff" />
      </svg>
    )
  }
  return (
    <svg className="flag" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <clipPath id={`${id}-flag`}>
        <rect width="60" height="30" />
      </clipPath>
      <clipPath id={`${id}-diag`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath={`url(#${id}-flag)`}>
        <rect width="60" height="30" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${id}-diag)`} stroke="#c8102e" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
      </g>
    </svg>
  )
}

/** Tombol bahasa: menampilkan bendera bahasa yang sedang aktif dan membuka daftar bahasa. */
export function LanguagePicker() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const lang = useLang()

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
        className="icon-btn icon-btn--flag"
        aria-label={t('Bahasa: Bahasa Indonesia', 'Language: English')}
        title={t('Bahasa', 'Language')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Flag lang={lang} />
      </button>
      {open && (
        <div className="card theme-picker__panel" role="radiogroup" aria-label={t('Bahasa', 'Language')}>
          {LANGUAGES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === lang}
              className={`theme-picker__option ${option.id === lang ? 'theme-picker__option--active' : ''}`}
              onClick={() => {
                setLang(option.id)
                setOpen(false)
              }}
            >
              <span className="language-picker__flag">
                <Flag lang={option.id} />
              </span>
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
