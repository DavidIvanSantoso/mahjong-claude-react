import gsap from 'gsap'
import { useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { MAX_TURN_SECONDS, MIN_TURN_SECONDS } from '../game/timer'
import { CODE_LENGTH, normalizeCode } from '../net/online'
import { cardFromId } from './cards'
import { CapsaCard, CardBack } from './CapsaCard'
import { DEFAULT_CAPSA_TURN_SECONDS, MAX_PLAYERS } from './net'

/** Kode room dari link undangan Capsa (?game=capsa&room=KODE). */
export function capsaInvitedRoom(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('game') === 'capsa' ? normalizeCode(params.get('room') ?? '') : ''
}

function parseSeconds(input: string): number {
  const value = Number.parseInt(input, 10)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_CAPSA_TURN_SECONDS
  return Math.min(MAX_TURN_SECONDS, Math.max(MIN_TURN_SECONDS, value))
}

/** Kartu hiasan di kolom kanan: 2♠, punggung, A♥, K♣, punggung, Q♦, 3♦ (null = punggung kartu). */
const SIDE_CARDS: (number | null)[] = [51, null, 46, 40, null, 36, 0]

interface CapsaSetupProps {
  onHost: (name: string, turnSeconds: number) => void
  onJoin: (name: string, code: string) => void
  onBack: () => void
}

export function CapsaSetup({ onHost, onJoin, onBack }: CapsaSetupProps) {
  const formRef = useRef<HTMLDivElement>(null)
  const [myName, setMyName] = useState('')
  const [code, setCode] = useState(capsaInvitedRoom)
  const [turnTime, setTurnTime] = useState('')

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap.from(':scope > *', {
        x: -32,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.out',
        stagger: 0.06,
        delay: 0.1,
        clearProps: 'transform,opacity',
      })
    }, formRef)
    return () => ctx.revert()
  }, [])

  function host(event: FormEvent) {
    event.preventDefault()
    onHost(myName.trim() || 'Host', parseSeconds(turnTime))
  }

  function join(event: FormEvent) {
    event.preventDefault()
    if (code.length === CODE_LENGTH) onJoin(myName.trim(), code)
  }

  return (
    <main className="split capsa-split">
      <section className="split__main">
        <div className="split__form" ref={formRef}>
          <button type="button" className="btn btn--small setup__back" onClick={onBack}>
            ← Kembali
          </button>
          <div>
            <h1 className="home__title">Online</h1>
            <p className="home__tagline">Capsa untuk 2–{MAX_PLAYERS} pemain, tiap pemain di perangkatnya sendiri.</p>
          </div>

          <label className="setup__field setup__names">
            <span className="setup__label">Nama kamu</span>
            <input type="text" maxLength={16} placeholder="Nama" value={myName} onChange={(event) => setMyName(event.target.value)} />
          </label>

          <form className="setup__form" onSubmit={join}>
            <fieldset className="setup__field">
              <legend>Gabung ke room</legend>
              <div className="setup__row">
                <input
                  type="text"
                  className="code-input"
                  placeholder="KODE"
                  aria-label="Kode room"
                  autoCapitalize="characters"
                  autoComplete="off"
                  value={code}
                  onChange={(event) => setCode(normalizeCode(event.target.value))}
                />
                <button type="submit" className="home__btn" disabled={code.length !== CODE_LENGTH}>
                  Gabung
                </button>
              </div>
            </fieldset>
          </form>

          <div className="split__divider" role="separator">
            <span>atau</span>
          </div>

          <form className="setup__form" onSubmit={host}>
            <label className="setup__field setup__time">
              <span className="setup__label">Waktu per giliran (detik)</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={3}
                placeholder={String(DEFAULT_CAPSA_TURN_SECONDS)}
                value={turnTime}
                onChange={(event) => setTurnTime(event.target.value.replace(/\D/g, ''))}
                onBlur={() => turnTime && setTurnTime(String(parseSeconds(turnTime)))}
              />
              <span className="setup__note">
                {MIN_TURN_SECONDS}–{MAX_TURN_SECONDS}, kosong = {DEFAULT_CAPSA_TURN_SECONDS}. Waktu habis: otomatis lewat.
              </span>
            </label>
            <button type="submit" className="home__btn">
              Buat room baru
            </button>
            <p className="setup__note">
              Room menampung sampai {MAX_PLAYERS} pemain. Permainan bisa dimulai begitu ada minimal 2 pemain.
            </p>
          </form>
        </div>
      </section>

      <div className="capsa-split__side" aria-hidden="true">
        {SIDE_CARDS.map((id, i) =>
          id === null ? (
            <CardBack key={i} size="deco" style={{ '--i': i } as CSSProperties} />
          ) : (
            <CapsaCard key={i} card={cardFromId(id)} size="deco" style={{ '--i': i } as CSSProperties} />
          ),
        )}
      </div>
    </main>
  )
}
