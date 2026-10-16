import gsap from 'gsap'
import { useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { MAX_TURN_SECONDS, MIN_TURN_SECONDS } from '../game/timer'
import { CODE_LENGTH, normalizeCode } from '../net/online'
import type { Card } from './cards'
import { DEFAULT_UNO_TURN_SECONDS, MAX_PLAYERS } from './net'
import { CardBack, UnoCard } from './UnoCard'

/** Kode room dari link undangan UNO (?game=uno&room=KODE). */
export function unoInvitedRoom(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('game') === 'uno' ? normalizeCode(params.get('room') ?? '') : ''
}

/** Isi kolom waktu per giliran: kosong atau tidak sah jadi nilai bawaan, sisanya dijepit ke batas. */
function parseSeconds(input: string): number {
  const value = Number.parseInt(input, 10)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_UNO_TURN_SECONDS
  return Math.min(MAX_TURN_SECONDS, Math.max(MIN_TURN_SECONDS, value))
}

/** Tumpukan kartu hiasan di kolom kanan. */
const SIDE_CARDS: (Card | null)[] = [
  { id: -1, color: 'red', value: 5 },
  null,
  { id: -2, color: 'blue', value: 'skip' },
  { id: -3, color: null, value: 'wild' },
  null,
  { id: -4, color: 'yellow', value: 'draw2' },
  { id: -5, color: 'green', value: 3 },
]

interface UnoSetupProps {
  onHost: (name: string, turnSeconds: number) => void
  onJoin: (name: string, code: string) => void
  onBack: () => void
}

export function UnoSetup({ onHost, onJoin, onBack }: UnoSetupProps) {
  const formRef = useRef<HTMLDivElement>(null)
  const [myName, setMyName] = useState('')
  const [code, setCode] = useState(unoInvitedRoom)
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
    <main className="split uno-split">
      <section className="split__main">
        <div className="split__form" ref={formRef}>
          <button type="button" className="btn btn--small setup__back" onClick={onBack}>
            ← Kembali
          </button>
          <div>
            <h1 className="home__title">Online</h1>
            <p className="home__tagline">UNO untuk 2–{MAX_PLAYERS} pemain, tiap pemain di perangkatnya sendiri.</p>
          </div>

          <label className="setup__field setup__names">
            <span className="setup__label">Nama kamu</span>
            <input
              type="text"
              maxLength={16}
              placeholder="Nama"
              value={myName}
              onChange={(event) => setMyName(event.target.value)}
            />
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
                placeholder={String(DEFAULT_UNO_TURN_SECONDS)}
                value={turnTime}
                onChange={(event) => setTurnTime(event.target.value.replace(/\D/g, ''))}
                onBlur={() => turnTime && setTurnTime(String(parseSeconds(turnTime)))}
              />
              <span className="setup__note">
                {MIN_TURN_SECONDS}–{MAX_TURN_SECONDS}, kosong = {DEFAULT_UNO_TURN_SECONDS}. Waktu habis: otomatis
                mengambil 1 kartu.
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

      <div className="uno-split__side" aria-hidden="true">
        {SIDE_CARDS.map((card, i) =>
          card ? (
            <UnoCard key={i} card={card} size="deco" style={{ '--i': i } as CSSProperties} />
          ) : (
            <CardBack key={i} size="deco" style={{ '--i': i } as CSSProperties} />
          ),
        )}
      </div>
    </main>
  )
}
