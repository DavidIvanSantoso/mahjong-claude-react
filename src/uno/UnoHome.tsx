import gsap from 'gsap'
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CreatorCredit } from '../components/HomeScreen'
import { MusicSlot } from '../components/MusicPlayer'
import { buildDeck, type Card } from './cards'
import { UnoCard } from './UnoCard'

const FAN: Card[] = [
  { id: -1, color: 'blue', value: 7 },
  { id: -2, color: 'green', value: 'reverse' },
  { id: -3, color: 'yellow', value: 9 },
  { id: -4, color: 'red', value: 'skip' },
  { id: -5, color: null, value: 'wild' },
  { id: -6, color: 'green', value: 'draw2' },
  { id: -7, color: null, value: 'wild4' },
]

const DECK = buildDeck()

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Kipas kartu hiasan. Kartu yang diketuk berputar dan berganti jadi kartu acak dari dek. */
function CardFan() {
  const fanRef = useRef<HTMLDivElement>(null)
  const [cards, setCards] = useState(FAN)

  useLayoutEffect(() => {
    if (reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.from('.uno-card', {
        y: 260,
        opacity: 0,
        duration: 0.7,
        ease: 'back.out(1.4)',
        stagger: 0.07,
        delay: 0.2,
        clearProps: 'transform,opacity',
      })
    }, fanRef)
    return () => ctx.revert()
  }, [])

  function flip(index: number, target: HTMLElement) {
    const swap = () =>
      setCards((current) =>
        current.map((card, i) => (i === index ? { ...DECK[Math.floor(Math.random() * DECK.length)], id: card.id } : card)),
      )
    if (reducedMotion()) return swap()
    gsap
      .timeline()
      .to(target, { rotateY: 90, duration: 0.18, ease: 'power1.in', onComplete: swap })
      .to(target, { rotateY: 0, duration: 0.22, ease: 'power1.out', clearProps: 'transform' })
  }

  return (
    <div className="uno-fan" ref={fanRef}>
      {cards.map((card, i) => (
        <div key={card.id} className="uno-fan__slot" style={{ '--i': i - (cards.length - 1) / 2 } as CSSProperties}>
          <UnoCard
            card={card}
            size="deco"
            onClick={() => {
              const el = fanRef.current?.querySelectorAll<HTMLElement>('.uno-card')[i]
              if (el) flip(i, el)
            }}
          />
        </div>
      ))}
    </div>
  )
}

interface UnoHomeProps {
  nav: ReactNode
  onOnline: () => void
  onRules: () => void
}

export function UnoHome({ nav, onOnline, onRules }: UnoHomeProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (reducedMotion()) return
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
    <main className="uno-home">
      {nav}
      <div className="home__tools">
        <MusicSlot />
      </div>

      <div className="uno-home__menu" ref={menuRef}>
        <h1 className="uno-logo">
          <span>UNO</span>
        </h1>
        <p className="home__tagline">Habiskan kartumu duluan, dan jangan lupa bilang UNO!</p>
        <button type="button" className="home__btn" onClick={onOnline}>
          Online
        </button>
        <button type="button" className="home__btn" onClick={onRules}>
          Cara Main
        </button>
        <p className="uno-home__note">2–6 pemain · tiap pemain di perangkatnya sendiri</p>
      </div>

      <CardFan />
      <CreatorCredit />
    </main>
  )
}
