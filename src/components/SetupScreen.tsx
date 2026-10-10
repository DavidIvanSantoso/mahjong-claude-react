import gsap from 'gsap'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  DEFAULT_TURN_SECONDS,
  MAX_TURN_SECONDS,
  MIN_TURN_SECONDS,
  parseTurnSeconds,
  rushSeconds,
} from '../game/timer'
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

/** Batas waktu per aksi, dalam detik. Dibiarkan kosong berarti memakai nilai bawaan. */
function TurnTimeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="setup__field setup__time">
      <span className="setup__label">Waktu per giliran (detik)</span>
      <input
        type="text"
        inputMode="numeric"
        maxLength={3}
        placeholder={String(DEFAULT_TURN_SECONDS)}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        // Angka di luar batas dirapikan begitu kolom ditinggalkan, supaya terlihat nilai yang dipakai.
        onBlur={() => value && onChange(String(parseTurnSeconds(value)))}
      />
      <span className="setup__note">
        {MIN_TURN_SECONDS}–{MAX_TURN_SECONDS}, kosong = {DEFAULT_TURN_SECONDS}. Waktu habis: ubin terakhir
        otomatis dibuang.
      </span>
    </label>
  )
}

const MODES = [
  { timeAttack: false, label: 'Normal' },
  { timeAttack: true, label: 'Time attack' },
]

interface ModeFieldProps {
  name: string
  timeAttack: boolean
  onChange: (timeAttack: boolean) => void
  /** Batas waktu yang akan dipakai, untuk contoh angka di penjelasan. */
  turnSeconds: number
}

/** Pilihan mode Normal / Time attack, dengan tombol "?" yang membuka penjelasan bedanya. */
function ModeField({ name, timeAttack, onChange, turnSeconds }: ModeFieldProps) {
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)

  // Penjelasan menutup lewat Esc atau ketukan di luar kotaknya.
  useEffect(() => {
    if (!helpOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!helpRef.current?.contains(event.target as Node)) setHelpOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setHelpOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [helpOpen])

  return (
    <fieldset className="setup__field setup__mode">
      <legend>Mode permainan</legend>
      <div className="setup__mode-row">
        <div className="setup__mode-options">
          {MODES.map((mode) => (
            <label
              key={mode.label}
              className={`count-option mode-option ${timeAttack === mode.timeAttack ? 'count-option--active' : ''}`}
            >
              <input
                type="radio"
                name={name}
                checked={timeAttack === mode.timeAttack}
                onChange={() => onChange(mode.timeAttack)}
              />
              {mode.label}
            </label>
          ))}
        </div>
        <div className="mode-help" ref={helpRef}>
          <button
            type="button"
            className="mode-help__button"
            aria-label="Apa bedanya Normal dan Time attack?"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen(!helpOpen)}
          >
            ?
          </button>
          {helpOpen && (
            <div className="card mode-help__panel" role="note">
              <p>
                <strong>Normal</strong> — batas waktu tiap aksi tetap {turnSeconds} detik sepanjang
                permainan.
              </p>
              <p>
                <strong>Time attack</strong> — begitu ada pemain yang tinggal butuh 1 ubin untuk menang,
                batas waktu <em>semua</em> pemain dipercepat jadi {rushSeconds(turnSeconds)} detik
                (setengahnya, paling cepat {MIN_TURN_SECONDS} detik). Waktunya kembali normal kalau tidak
                ada lagi yang hampir menang.
              </p>
            </div>
          )}
        </div>
      </div>
    </fieldset>
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

interface LocalSetupProps {
  onStart: (names: string[], turnSeconds: number, timeAttack: boolean) => void
  onBack: () => void
}

export function LocalSetup({ onStart, onBack }: LocalSetupProps) {
  const [turnTime, setTurnTime] = useState('')
  const [timeAttack, setTimeAttack] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [names, setNames] = useState<string[]>(['', '', '', ''])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (count === null) return
    onStart(
      names.slice(0, count).map((name, i) => name.trim() || `Pemain ${i + 1}`),
      parseTurnSeconds(turnTime),
      timeAttack,
    )
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

        <TurnTimeField value={turnTime} onChange={setTurnTime} />
        <ModeField
          name="local-mode"
          timeAttack={timeAttack}
          onChange={setTimeAttack}
          turnSeconds={parseTurnSeconds(turnTime)}
        />

        <button type="submit" className="home__btn" disabled={count === null}>
          {count === null ? 'Pilih jumlah pemain dulu' : 'Mulai permainan'}
        </button>
      </form>
    </SplitScreen>
  )
}

interface OnlineSetupProps {
  onHost: (name: string, capacity: number, turnSeconds: number, timeAttack: boolean) => void
  onJoin: (name: string, code: string) => void
  onBack: () => void
}

export function OnlineSetup({ onHost, onJoin, onBack }: OnlineSetupProps) {
  const [myName, setMyName] = useState('')
  const [capacity, setCapacity] = useState<number | null>(null)
  const [code, setCode] = useState(invitedRoom)
  const [turnTime, setTurnTime] = useState('')
  const [timeAttack, setTimeAttack] = useState(false)

  function host(event: FormEvent) {
    event.preventDefault()
    if (capacity !== null) onHost(myName.trim() || 'Host', capacity, parseTurnSeconds(turnTime), timeAttack)
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
        <TurnTimeField value={turnTime} onChange={setTurnTime} />
        <ModeField
          name="room-mode"
          timeAttack={timeAttack}
          onChange={setTimeAttack}
          turnSeconds={parseTurnSeconds(turnTime)}
        />
        <button type="submit" className="home__btn" disabled={capacity === null}>
          {capacity === null ? 'Pilih jumlah pemain dulu' : 'Buat room'}
        </button>
      </form>
    </SplitScreen>
  )
}
