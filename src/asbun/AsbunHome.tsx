import { useRef, type ReactNode } from 'react'
import { CreatorCredit } from '../components/HomeScreen'
import { MusicSlot } from '../components/MusicPlayer'
import { AsbunBoard } from './AsbunBoard'
import { MAX_PLAYERS, MIN_PLAYERS } from './roles'

/** Kredit inspirasi permainan: di tepi kiri layar lebar (AsbunApp) dan di kartu beranda pada layar sempit. */
export const INSPIRED_BY = 'Inspired by Under Cover · Yanstar Studio OU'

export function AsbunHome({ nav, onCreate, onJoin, onGuide }: { nav: ReactNode; onCreate: () => void; onJoin: () => void; onGuide: () => void }) {
  const fileRef = useRef<HTMLElement>(null)
  return (
    <main className="as-home">
      <AsbunBoard cardRef={fileRef} />
      {nav}
      <div className="home__tools">
        <MusicSlot />
      </div>

      <section ref={fileRef} className="as-home__file" aria-labelledby="as-home-title">
        <div className="as-home__tab" aria-hidden="true">
          Berkas No. 07 · Rahasia
        </div>
        <span className="as-stamp as-home__stamp" aria-hidden="true">
          Rahasia
        </span>
        <h1 id="as-home-title" className="as-logo">
          ASBUN
        </h1>
        <p className="as-tagline">A Game of Deception</p>
        <p className="as-home__lead">
          Semua orang mendapat kata rahasia, kecuali Penyusup yang katanya sedikit berbeda dan Si Asbun yang tidak punya kata
          sama sekali. Beri petunjuk, curigai, lalu tuduh.
        </p>
        <div className="as-home__actions">
          <button type="button" className="as-btn as-btn--primary" onClick={onCreate}>
            Buat Room
          </button>
          <button type="button" className="as-btn" onClick={onJoin}>
            Gabung Room
          </button>
        </div>
        <button type="button" className="as-link" onClick={onGuide}>
          Cara bermain
        </button>
        <p className="as-home__meta">
          {MIN_PLAYERS}–{MAX_PLAYERS} pemain · Warga, Penyusup, dan Si Asbun
        </p>
        <p className="as-home__inspired">{INSPIRED_BY}</p>
        <p className="as-signature" aria-hidden="true">
          Detektif
        </p>
      </section>

      <CreatorCredit />
    </main>
  )
}
