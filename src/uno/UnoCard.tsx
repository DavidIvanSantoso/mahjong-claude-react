import type { CSSProperties, ReactNode } from 'react'
import { cardName, type Card } from './cards'

export type CardSize = 'hand' | 'pile' | 'small' | 'mini' | 'deco'

/** Lingkaran dicoret: Skip. Garis gelap di bawah warna supaya terbaca di kartu kuning. */
function SkipIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" aria-hidden="true">
      <g stroke="#1b1b1b" strokeWidth="5.5">
        <circle cx="12" cy="12" r="7.5" />
        <path d="M6.8 17.2 17.2 6.8" />
      </g>
      <g stroke="currentColor" strokeWidth="3.2">
        <circle cx="12" cy="12" r="7.5" />
        <path d="M6.8 17.2 17.2 6.8" />
      </g>
    </svg>
  )
}

/** Dua panah berlawanan arah: Reverse. */
function ReverseIcon() {
  const arrows = 'M5 13.5 12.5 6M8 6h4.5v4.5M19 10.5 11.5 18M16 18h-4.5v-4.5'
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={arrows} stroke="#1b1b1b" strokeWidth="5.5" />
      <path d={arrows} stroke="currentColor" strokeWidth="3.2" />
    </svg>
  )
}

function symbol(card: Card): ReactNode {
  switch (card.value) {
    case 'skip':
      return <SkipIcon />
    case 'reverse':
      return <ReverseIcon />
    case 'draw2':
      return '+2'
    case 'wild4':
      return '+4'
    case 'wild':
      return null
    default:
      return String(card.value)
  }
}

interface UnoCardProps {
  card: Card
  size?: CardSize
  /** Tanpa ini kartu hanya gambar, bukan tombol. */
  onClick?: () => void
  /** Giliran sendiri: kartu yang bisa dimainkan diangkat, sisanya diredupkan. */
  playable?: boolean
  dimmed?: boolean
  /** Kartu yang baru diambil. */
  fresh?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * Kartu UNO bergambar CSS: muka berwarna dengan bingkai putih, oval putih miring di tengah,
 * dan simbol kecil di dua pojok. Wild berwarna hitam dengan oval empat warna.
 */
export function UnoCard({ card, size = 'hand', onClick, playable, dimmed, fresh, className, style }: UnoCardProps) {
  const wild = card.color === null
  const classes = [
    'uno-card',
    `uno-card--${size}`,
    wild ? 'uno-card--wild' : `uno-card--${card.color}`,
    `uno-card--is-${typeof card.value === 'number' ? 'number' : card.value}`,
    playable && 'uno-card--playable',
    dimmed && 'uno-card--dimmed',
    fresh && 'uno-card--fresh',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  const sym = symbol(card)
  const corner = wild && card.value === 'wild' ? <span className="uno-card__quad" /> : sym

  const content = (
    <>
      <span className="uno-card__oval" />
      {sym !== null && <span className="uno-card__symbol">{sym}</span>}
      <span className="uno-card__corner uno-card__corner--top">{corner}</span>
      <span className="uno-card__corner uno-card__corner--bottom">{corner}</span>
    </>
  )

  if (!onClick) {
    return (
      <span className={classes} style={style} role="img" aria-label={cardName(card)}>
        {content}
      </span>
    )
  }
  return (
    <button type="button" className={classes} style={style} onClick={onClick} aria-label={cardName(card)}>
      {content}
    </button>
  )
}

/** Punggung kartu: hitam dengan oval merah dan tulisan UNO. */
export function CardBack({ size = 'hand', className, style }: { size?: CardSize; className?: string; style?: CSSProperties }) {
  return (
    <span className={`uno-card uno-card--${size} uno-card--back ${className ?? ''}`} style={style} aria-hidden="true">
      <span className="uno-card__oval" />
      <span className="uno-card__logo">UNO</span>
    </span>
  )
}
