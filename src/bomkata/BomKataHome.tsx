import gsap from 'gsap'
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { CreatorCredit } from '../components/HomeScreen'
import { MusicSlot } from '../components/MusicPlayer'
import { PixelBomb } from './Pixel'

/** Huruf-huruf yang melayang di sekitar bom di homescreen. */
const LETTERS = ['K', 'A', '-', 'B', 'O', 'O', 'M', '!', '?', 'Z']

export function BomKataHome({ nav, onOnline, onGuide }: { nav: ReactNode; onOnline: () => void; onGuide: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.from(':scope > *', {
        x: -32,
        opacity: 0,
        duration: 0.45,
        ease: 'steps(5)',
        stagger: 0.08,
        delay: 0.15,
        clearProps: 'transform,opacity',
      })
    }, menuRef)
    return () => ctx.revert()
  }, [])

  return (
    <main className="bk-home">
      {nav}
      <div className="home__tools">
        <MusicSlot />
      </div>

      <div className="bk-home__menu" ref={menuRef}>
        <h1 className="bk-logo">
          <span>KA-</span>
          <span>BOOM!</span>
        </h1>
        <p className="bk-home__tagline">Ketik kata sesuai kategori sebelum bomnya meledak di tanganmu!</p>
        <button type="button" className="bk-btn bk-btn--big" onClick={onOnline}>
          ONLINE
        </button>
        <button type="button" className="bk-btn bk-btn--big bk-btn--alt" onClick={onGuide}>
          CARA MAIN
        </button>
        <p className="bk-home__note">2–6 pemain · 2 nyawa · kamus Bahasa Indonesia</p>
      </div>

      <div className="bk-home__stage" aria-hidden="true">
        <PixelBomb heat={1} className="bk-home__bomb" />
        {LETTERS.map((letter, i) => (
          <span key={i} className="bk-home__letter" style={{ '--i': i } as CSSProperties}>
            {letter}
          </span>
        ))}
      </div>

      <CreatorCredit />
    </main>
  )
}
