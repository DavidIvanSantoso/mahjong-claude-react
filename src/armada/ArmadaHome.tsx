import gsap from 'gsap'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { CreatorCredit } from '../components/HomeScreen'
import { MusicSlot } from '../components/MusicPlayer'
import { MAX_PLAYERS, MIN_PLAYERS } from './net'
import { PixelFlame, PixelSplash, PixelWaves, ShipArt } from './Pixel'

export function ArmadaHome({ nav, onOnline, onGuide }: { nav: ReactNode; onOnline: () => void; onGuide: () => void }) {
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
    <main className="ar-home">
      {nav}
      <div className="home__tools">
        <MusicSlot />
      </div>

      <div className="ar-home__menu" ref={menuRef}>
        <h1 className="ar-logo">
          <span>ARMADA</span>
          <span>ROYALE</span>
        </h1>
        <p className="ar-home__tagline">Sembunyikan armadamu, tembak papan lawan, jadilah kapal terakhir yang mengapung!</p>
        <button type="button" className="ar-btn ar-btn--big" onClick={onOnline}>
          ONLINE
        </button>
        <button type="button" className="ar-btn ar-btn--big ar-btn--alt" onClick={onGuide}>
          CARA MAIN
        </button>
        <p className="ar-home__note">
          {MIN_PLAYERS}–{MAX_PLAYERS} pemain · target diundi · skill Perisai, Sonar, Tembakan Ganda
        </p>
      </div>

      <div className="ar-home__stage" aria-hidden="true">
        <div className="ar-home__sea">
          <ShipArt size={5} dir="h" className="ar-home__ship" />
          <PixelSplash className="ar-home__splash" />
          <PixelFlame className="ar-home__flame" />
          <PixelWaves className="ar-home__waves" />
        </div>
      </div>

      <CreatorCredit />
    </main>
  )
}
