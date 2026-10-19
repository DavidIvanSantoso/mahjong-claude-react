import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import { cardName, isRed, rankLabel, type Card, type Suit } from './cards'

/**
 * Bentuk bunga sebagai SVG, bukan karakter ♠♥♦♣: sebagian perangkat menggambar karakter itu
 * sebagai emoji berwarna.
 */
const SUIT_PATHS: Record<Suit, string> = {
  spades: 'M16 2C12.5 7.5 4 11.5 4 18.5a6 6 0 0 0 10.2 4.3L12.5 30h7l-1.7-7.2A6 6 0 0 0 28 18.5C28 11.5 19.5 7.5 16 2Z',
  hearts: 'M16 29C6.5 21.5 2 16.5 2 10.8A6.8 6.8 0 0 1 16 7.4a6.8 6.8 0 0 1 14 3.4C30 16.5 25.5 21.5 16 29Z',
  diamonds: 'M16 1.5 27.5 16 16 30.5 4.5 16Z',
  clubs:
    'M16 2.5a6.2 6.2 0 0 0-5.6 8.9A6.2 6.2 0 1 0 14.3 22L12.5 30h7l-1.8-8a6.2 6.2 0 1 0 3.9-10.6A6.2 6.2 0 0 0 16 2.5Z',
}

export function SuitIcon({ suit, className }: { suit: Suit; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d={SUIT_PATHS[suit]} fill="currentColor" />
    </svg>
  )
}

export type CapsaCardSize = 'hand' | 'table' | 'peek' | 'small' | 'mini' | 'deco'

interface CapsaCardProps {
  card: Card
  size?: CapsaCardSize
  selected?: boolean
  dragging?: boolean
  className?: string
  style?: CSSProperties
  /** Tanpa ini kartu hanya gambar, bukan tombol. */
  onClick?: () => void
  onPointerDown?: (event: PointerEvent<HTMLButtonElement>) => void
  children?: ReactNode
}

/**
 * Kartu remi bergambar CSS: angka dan bunga di dua pojok, lalu bunga besar di tengah.
 * J, Q, dan K diberi huruf besar dalam bingkai emas di tengah supaya mudah dikenali.
 */
export function CapsaCard({
  card,
  size = 'hand',
  selected,
  dragging,
  className,
  style,
  onClick,
  onPointerDown,
  children,
}: CapsaCardProps) {
  const rank = rankLabel(card.rank)
  const court = card.rank >= 11 && card.rank <= 13
  const classes = [
    'pc',
    `pc--${size}`,
    isRed(card) ? 'pc--red' : 'pc--black',
    court && 'pc--court',
    selected && 'pc--selected',
    dragging && 'pc--dragging',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      <span className="pc__corner pc__corner--top">
        <span className="pc__rank">{rank}</span>
        <SuitIcon suit={card.suit} className="pc__pip" />
      </span>
      <span className="pc__center">
        {court ? <span className="pc__court">{rank}</span> : <SuitIcon suit={card.suit} className="pc__big" />}
      </span>
      <span className="pc__corner pc__corner--bottom">
        <span className="pc__rank">{rank}</span>
        <SuitIcon suit={card.suit} className="pc__pip" />
      </span>
      {children}
    </>
  )

  if (!onClick && !onPointerDown) {
    return (
      <span className={classes} style={style} role="img" aria-label={cardName(card)}>
        {content}
      </span>
    )
  }
  return (
    <button
      type="button"
      className={classes}
      style={style}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-label={cardName(card)}
      aria-pressed={selected}
    >
      {content}
    </button>
  )
}

/** Punggung kartu: hitam dengan kisi emas dan bingkai emas. */
export function CardBack({ size = 'hand', style }: { size?: CapsaCardSize; style?: CSSProperties }) {
  return (
    <span className={`pc pc--${size} pc--back`} style={style} aria-hidden="true">
      <span className="pc__back-mark">
        <SuitIcon suit="spades" />
      </span>
    </span>
  )
}
