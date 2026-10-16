import { useState, type CSSProperties } from 'react'

const PIECES = 90
/** Bawaan: warna dari palet tema yang sedang dipakai. */
const THEME_COLORS = ['var(--pink)', 'var(--pink-deep)', 'var(--green)', 'var(--tile-red)', 'var(--tile-blue)', 'var(--cream)']

function random(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

/**
 * Hujan confetti satu kali di seluruh layar (animasinya di index.css). Hiasan saja:
 * tidak menangkap klik, dan tidak ditampilkan kalau pengguna meminta animasi dikurangi.
 */
export function Confetti({ colors = THEME_COLORS }: { colors?: string[] }) {
  // Posisi, warna, dan waktu tiap keping diacak sekali saat confetti muncul.
  const [pieces] = useState(() =>
    Array.from({ length: PIECES }, (_, i) => ({
      left: `${random(0, 100)}%`,
      width: `${random(6, 11)}px`,
      height: `${random(10, 18)}px`,
      background: colors[i % colors.length],
      animationDelay: `${random(0, 1.2)}s`,
      animationDuration: `${random(2.6, 4.6)}s`,
      '--drift': `${random(-18, 18)}vw`,
      '--spin': `${random(-900, 900)}deg`,
    })),
  )

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((style, i) => (
        <span key={i} style={style as CSSProperties} />
      ))}
    </div>
  )
}
