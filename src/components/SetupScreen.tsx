import gsap from 'gsap'
import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { CODE_LENGTH, normalizeCode } from '../net/online'
import { TileField } from './TileField'

const PLAYER_COUNTS = [2, 3, 4]

/** Kolom ubin hiasan di sisi kanan menu Local dan Online. */
const SIDE_COLS = 3
const SIDE_ROWS = 9

function CountPicker({
  name,
  value,
  onChange,
}: {
  name: string
  value: number | null
  onChange: (count: number) => void
}) {
  return (
    <div className="setup__counts">
      {PLAYER_COUNTS.map((n) => (
        <label key={n} className={`count-option ${value === n ? 'count-option--active' : ''}`}>
          <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} />
          {n}
        </label>
      ))}
    </div>
  )
}

/** Kode room dari link undangan (?room=KODE). */
export function invitedRoom(): string {
  return normalizeCode(new URLSearchParams(window.location.search).get('room') ?? '')
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="btn btn--small setup__back" onClick={onBack}>
      ← Kembali
    </button>
  )
}

interface SplitScreenProps {
  title: string
  tagline: string
  onBack: () => void
  children: ReactNode
}

/**
 * Tata letak menu Local dan Online: form di kiri (3/4 layar) dan kolom ubin animasi di kanan (1/4).
 * Isi form bergeser masuk dari kiri saat dibuka, sama seperti menu di homescreen.
 */
function SplitScreen({ title, tagline, onBack, children }: SplitScreenProps) {
  const formRef = useRef<HTMLDivElement>(null)

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

  return (
    <main className="split">
      <section className="split__main">
        <div className="split__form" ref={formRef}>
          <BackButton onBack={onBack} />
          <div>
            <h1 className="home__title">{title}</h1>
            <p className="home__tagline">{tagline}</p>
          </div>
          {children}
        </div>
      </section>

      <TileField className="split__tiles" cols={SIDE_COLS} rows={SIDE_ROWS} />
    </main>
  )
}

export function LocalSetup({ onStart, onBack }: { onStart: (names: string[]) => void; onBack: () => void }) {
  const [count, setCount] = useState<number | null>(null)
  const [names, setNames] = useState<string[]>(['', '', '', ''])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (count === null) return
    onStart(names.slice(0, count).map((name, i) => name.trim() || `Pemain ${i + 1}`))
  }

  return (
    <SplitScreen title="Local" tagline="Bergantian di satu perangkat." onBack={onBack}>
      <form className="setup__form" onSubmit={handleSubmit}>
        <fieldset className="setup__field">
          <legend>Main berapa orang?</legend>
          <CountPicker name="local-count" value={count} onChange={setCount} />
        </fieldset>

        {count !== null && (
          <fieldset className="setup__field">
            <legend>Nama pemain (opsional)</legend>
            <div className="setup__names setup__names--grid">
              {Array.from({ length: count }, (_, i) => (
                <input
                  key={i}
                  type="text"
                  maxLength={16}
                  placeholder={`Pemain ${i + 1}`}
                  aria-label={`Nama pemain ${i + 1}`}
                  value={names[i]}
                  onChange={(event) =>
                    setNames(names.map((name, j) => (j === i ? event.target.value : name)))
                  }
                />
              ))}
            </div>
          </fieldset>
        )}

        <button type="submit" className="home__btn" disabled={count === null}>
          {count === null ? 'Pilih jumlah pemain dulu' : 'Mulai permainan'}
        </button>
      </form>
    </SplitScreen>
  )
}

interface OnlineSetupProps {
  onHost: (name: string, capacity: number) => void
  onJoin: (name: string, code: string) => void
  onBack: () => void
}

export function OnlineSetup({ onHost, onJoin, onBack }: OnlineSetupProps) {
  const [myName, setMyName] = useState('')
  const [capacity, setCapacity] = useState<number | null>(null)
  const [code, setCode] = useState(invitedRoom)

  function host(event: FormEvent) {
    event.preventDefault()
    if (capacity !== null) onHost(myName.trim() || 'Host', capacity)
  }

  function join(event: FormEvent) {
    event.preventDefault()
    if (code.length === CODE_LENGTH) onJoin(myName.trim(), code)
  }

  return (
    <SplitScreen title="Online" tagline="Tiap pemain bermain dari perangkatnya sendiri." onBack={onBack}>
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
        <fieldset className="setup__field">
          <legend>Buat room baru — main berapa orang?</legend>
          <CountPicker name="room-capacity" value={capacity} onChange={setCapacity} />
        </fieldset>
        <button type="submit" className="home__btn" disabled={capacity === null}>
          {capacity === null ? 'Pilih jumlah pemain dulu' : 'Buat room'}
        </button>
      </form>
    </SplitScreen>
  )
}
