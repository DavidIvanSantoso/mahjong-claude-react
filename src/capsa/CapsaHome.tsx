import gsap from 'gsap'
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CreatorCredit } from '../components/HomeScreen'
import { MusicSlot } from '../components/MusicPlayer'
import { cardFromId, type Card } from './cards'
import { CapsaCard } from './CapsaCard'

/** Royal straight flush sekop sebagai kipas hiasan: 10♠ J♠ Q♠ K♠ A♠. */
const FAN: Card[] = [31, 35, 39, 43, 47].map(cardFromId)

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Kipas kartu hiasan. Kartu yang diketuk berputar dan berganti jadi kartu acak. */
function CardFan() {
  const fanRef = useRef<HTMLDivElement>(null)
  const [cards, setCards] = useState(FAN)

  useLayoutEffect(() => {
    if (reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.from('.pc', {
        y: 260,
        opacity: 0,
        duration: 0.7,
        ease: 'back.out(1.4)',
        stagger: 0.08,
        delay: 0.2,
        clearProps: 'transform,opacity',
      })
    }, fanRef)
    return () => ctx.revert()
  }, [])

  function flip(index: number, target: HTMLElement) {
    const swap = () => setCards((current) => current.map((card, i) => (i === index ? cardFromId(Math.floor(Math.random() * 52)) : card)))
    if (reducedMotion()) return swap()
    gsap
      .timeline()
      .to(target, { rotateY: 90, duration: 0.18, ease: 'power1.in', onComplete: swap })
      .to(target, { rotateY: 0, duration: 0.22, ease: 'power1.out', clearProps: 'transform' })
  }

  return (
    <div className="capsa-fan" ref={fanRef}>
      {cards.map((card, i) => (
        <div key={i} className="capsa-fan__slot" style={{ '--i': i - (cards.length - 1) / 2 } as CSSProperties}>
          <CapsaCard
            card={card}
            size="deco"
            onClick={() => {
              const el = fanRef.current?.querySelectorAll<HTMLElement>('.pc')[i]
              if (el) flip(i, el)
            }}
          />
        </div>
      ))}
    </div>
  )
}

interface CapsaHomeProps {
  nav: ReactNode
  onOnline: () => void
  onGuide: () => void
}

export function CapsaHome({ nav, onOnline, onGuide }: CapsaHomeProps) {
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
    <main className="capsa-home">
      {nav}
      <div className="home__tools">
        <MusicSlot />
      </div>

      <div className="capsa-home__menu" ref={menuRef}>
        <h1 className="capsa-logo">Capsa</h1>
        <p className="home__tagline">Kalahkan kartu di meja, habiskan 13 kartumu paling dulu.</p>
        <button type="button" className="home__btn" onClick={onOnline}>
          Online
        </button>
        <button type="button" className="home__btn" onClick={onGuide}>
          Cara Main
        </button>
        <p className="capsa-home__note">2–4 pemain · tanpa Joker · tiap pemain di perangkatnya sendiri</p>
      </div>

      <CardFan />
      <CreatorCredit />
    </main>
  )
}
