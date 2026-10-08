import { useState, type FormEvent } from 'react'
import { CODE_LENGTH, normalizeCode } from '../net/online'

const PLAYER_COUNTS = [2, 3, 4]

interface SetupScreenProps {
  onStartLocal: (names: string[]) => void
  onHost: (name: string, capacity: number) => void
  onJoin: (name: string, code: string) => void
}

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
function invitedRoom(): string {
  return normalizeCode(new URLSearchParams(window.location.search).get('room') ?? '')
}

export function SetupScreen({ onStartLocal, onHost, onJoin }: SetupScreenProps) {
  const [mode, setMode] = useState<'local' | 'online'>(() => (invitedRoom() ? 'online' : 'local'))

  const [count, setCount] = useState<number | null>(null)
  const [names, setNames] = useState<string[]>(['', '', '', ''])

  const [myName, setMyName] = useState('')
  const [capacity, setCapacity] = useState<number | null>(null)
  const [code, setCode] = useState(invitedRoom)

  function startLocal(event: FormEvent) {
    event.preventDefault()
    if (count === null) return
    onStartLocal(names.slice(0, count).map((name, i) => name.trim() || `Pemain ${i + 1}`))
  }

  function host(event: FormEvent) {
    event.preventDefault()
    if (capacity !== null) onHost(myName.trim() || 'Host', capacity)
  }

  function join(event: FormEvent) {
    event.preventDefault()
    if (code.length === CODE_LENGTH) onJoin(myName.trim(), code)
  }

  return (
    <main className="setup">
      <div className="card setup__card">
        <h1 className="setup__title">Mahjong</h1>
        <p className="setup__lead">Kumpulkan 4 set + 1 pair (14 ubin) untuk menang.</p>

        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'local'}
            className={`tab ${mode === 'local' ? 'tab--active' : ''}`}
            onClick={() => setMode('local')}
          >
            Satu perangkat
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'online'}
            className={`tab ${mode === 'online' ? 'tab--active' : ''}`}
            onClick={() => setMode('online')}
          >
            Online
          </button>
        </div>

        {mode === 'local' && (
          <form className="setup__form" onSubmit={startLocal}>
            <fieldset className="setup__field">
              <legend>Main berapa orang?</legend>
              <CountPicker name="local-count" value={count} onChange={setCount} />
            </fieldset>

            {count !== null && (
              <fieldset className="setup__field">
                <legend>Nama pemain (opsional)</legend>
                <div className="setup__names">
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

            <button type="submit" className="btn btn--primary btn--wide" disabled={count === null}>
              {count === null ? 'Pilih jumlah pemain dulu' : 'Mulai permainan'}
            </button>
          </form>
        )}

        {mode === 'online' && (
          <>
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
                  <button type="submit" className="btn btn--primary" disabled={code.length !== CODE_LENGTH}>
                    Gabung
                  </button>
                </div>
              </fieldset>
            </form>

            <form className="setup__form" onSubmit={host}>
              <fieldset className="setup__field">
                <legend>Atau buat room baru — main berapa orang?</legend>
                <CountPicker name="room-capacity" value={capacity} onChange={setCapacity} />
              </fieldset>
              <button type="submit" className="btn btn--wide" disabled={capacity === null}>
                {capacity === null ? 'Pilih jumlah pemain dulu' : 'Buat room'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
