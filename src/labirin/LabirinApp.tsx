import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import labirinFavicon from '../assets/labirin-favicon.svg'
import { CreatorCredit } from '../components/HomeScreen'
import { MusicSlot } from '../components/MusicPlayer'
import { CODE_LENGTH, normalizeCode } from '../net/online'
import { generateMaze, randomSeed, SIZES, sizeFor, type MazeSize } from './maze'
import { MAX_PLAYERS, MIN_PLAYERS, useLabirinGuestRoom, useLabirinHostRoom, type LabirinError, type LabirinRoom } from './net'
import { formatTime, RaceView, type RosterEntry } from './RaceView'
import { colorOf } from './render'
import { sfx } from './sfx'
import { atExit, spawnBody, step, STEP, type Body } from './sim'

const SIZE_LABEL: Record<MazeSize, string> = { kecil: 'Kecil', sedang: 'Sedang', besar: 'Besar' }
const SIZE_ORDER: MazeSize[] = ['kecil', 'sedang', 'besar']
const BEST_KEY = 'labirin-best'

// ---------- Tema ----------

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Rubik+Mono+One&family=Rubik:wght@400;500;600;700&display=swap'

/** Tema LABIRIN (labirin.css, `:root[data-game='labirin']`), font, judul tab, dan ikon tab selama layar ini terbuka. */
function useLabirinTheme() {
  useEffect(() => {
    const root = document.documentElement
    const title = document.title
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const previousIcon = icon?.getAttribute('href') ?? null
    root.dataset.game = 'labirin'
    document.title = 'LABIRIN - Balapan Keluar Labirin'
    icon?.setAttribute('href', labirinFavicon)
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const font = document.createElement('link')
      font.rel = 'stylesheet'
      font.href = FONT_HREF
      document.head.appendChild(font)
    }
    return () => {
      delete root.dataset.game
      document.title = title
      if (icon && previousIcon !== null) icon.setAttribute('href', previousIcon)
    }
  }, [])
}

/** Kode room dari link undangan (?game=labirin&room=KODE). */
function invitedRoom(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('game') === 'labirin' ? normalizeCode(params.get('room') ?? '') : ''
}

function errorMessage(error: LabirinError | null): string {
  switch (error?.code) {
    case 'id-taken':
      return 'Kode room sudah dipakai. Coba buat room lagi.'
    case 'host-failed':
      return `Gagal membuat room (${error.detail}). Periksa koneksi internet.`
    case 'started':
      return 'Balapan di room ini sedang berlangsung. Tunggu sampai selesai, lalu coba lagi.'
    case 'full':
      return `Room sudah penuh (maksimal ${MAX_PLAYERS} pemain).`
    case 'host-lost':
      return 'Koneksi ke host terputus. Balapan tidak bisa dilanjutkan tanpa host; minta host membuat room baru.'
    case 'not-found':
      return 'Room tidak ditemukan. Periksa kodenya dan pastikan host masih membuka room.'
    case 'unreachable':
      return 'Tidak bisa tersambung ke host. Biasanya karena jaringan (data seluler, WiFi kantor/kampus) menghalangi koneksi langsung antarperangkat. Coba jaringan lain, mis. WiFi yang sama dengan host.'
    case 'connect-failed':
      return `Gagal terhubung (${error.detail}). Periksa koneksi internet.`
    case 'version':
      return 'Versi game kamu berbeda dengan host. Muat ulang halaman (Ctrl+F5) di kedua perangkat.'
    case 'desync':
      return 'Labirin di perangkatmu tidak sama dengan milik host. Muat ulang halaman di kedua perangkat.'
    default:
      return ''
  }
}

// ---------- Beranda ----------

function loadBest(): Partial<Record<MazeSize, number>> {
  try {
    const value = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}')
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

function saveBest(size: MazeSize, ms: number): Partial<Record<MazeSize, number>> {
  const best = loadBest()
  if (best[size] === undefined || ms < best[size]!) best[size] = ms
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best))
  } catch {
    // localStorage bisa diblokir; rekornya berlaku selama halaman terbuka.
  }
  return best
}

function Home({ nav, onCreate, onJoin, onPractice, onGuide }: { nav: ReactNode; onCreate: () => void; onJoin: () => void; onPractice: (size: MazeSize) => void; onGuide: () => void }) {
  const [size, setSize] = useState<MazeSize>('sedang')
  const best = useMemo(loadBest, [])
  return (
    <main className="lb-home">
      {nav}
      <div className="home__tools">
        <MusicSlot />
      </div>
      <section className="lb-card lb-home__card" aria-labelledby="lb-title">
        <p className="lb-eyebrow">Balapan labirin · online 2–{MAX_PLAYERS} pemain</p>
        <h1 id="lb-title" className="lb-logo">
          LABIRIN
        </h1>
        <p className="lb-tagline">Siapa paling cepat keluar?</p>
        <p className="lb-home__lead">
          Semua pemain masuk labirin yang sama, dari sisi yang berbeda tapi sama jauhnya. Jelajahi lorong yang gelap, temukan portal di
          tengah, dan jadilah yang pertama keluar.
        </p>
        <div className="lb-actions">
          <button type="button" className="lb-btn lb-btn--primary lb-btn--big" onClick={onCreate}>
            Buat Room
          </button>
          <button type="button" className="lb-btn lb-btn--big" onClick={onJoin}>
            Gabung Room
          </button>
        </div>
        <div className="lb-practice">
          <span className="lb-muted">Latihan sendiri:</span>
          <div className="lb-segment" role="radiogroup" aria-label="Ukuran labirin latihan">
            {SIZE_ORDER.map((option) => (
              <button key={option} type="button" role="radio" aria-checked={size === option} className={size === option ? 'is-active' : ''} onClick={() => setSize(option)}>
                {SIZE_LABEL[option]}
                {best[option] !== undefined && <small>{formatTime(best[option]!)}</small>}
              </button>
            ))}
          </div>
          <button type="button" className="lb-btn" onClick={() => onPractice(size)}>
            Latihan
          </button>
        </div>
        <button type="button" className="lb-link" onClick={onGuide}>
          Cara main
        </button>
        <p className="lb-muted lb-home__hint">Butuh keyboard: WASD atau tombol panah.</p>
      </section>
      <CreatorCredit />
    </main>
  )
}

function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog ref={ref} className="lb-dialog" onClose={onClose} onClick={(event) => event.target === ref.current && onClose()}>
      <div className="lb-card">
        <h2 className="lb-title">Cara Main</h2>
        <ol className="lb-guide">
          <li>Host membuat room lalu membagikan kodenya. 2–{MAX_PLAYERS} pemain, tiap pemain di perangkatnya sendiri.</li>
          <li>Semua tamu menekan <strong>Siap</strong>, lalu host menekan <strong>Mulai</strong>. Host memilih ukuran labirin; untuk 5–6 pemain labirin minimal Sedang, untuk 7–8 pemain selalu Besar.</li>
          <li>Semua pemain mendapat labirin yang sama. Titik awal tersebar di tepi, dengan jarak ke pintu keluar yang hampir sama.</li>
          <li>
            Gerak dengan <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> atau tombol panah. Labirin gelap: hanya sekitar kamu yang terang, lorong yang sudah dilewati
            tetap terlihat redup. Minimap di kanan bawah menunjukkan semua pemain dan pintu keluar.
          </li>
          <li>Pintu keluar adalah <strong>portal hijau di tengah labirin</strong>; cahayanya menembus kegelapan, dan panah di tepi layar menunjuk ke arahnya.</li>
          <li>Yang pertama masuk portal menang. Pemain tidak saling menghalangi. Setelah itu host bisa membuat labirin baru (Main lagi) atau kembali ke lobi.</li>
        </ol>
        <button type="button" className="lb-btn lb-btn--primary" onClick={onClose}>
          Mengerti
        </button>
      </div>
    </dialog>
  )
}

function Setup({ mode, onHost, onJoin, onBack }: { mode: 'create' | 'join'; onHost: (name: string) => void; onJoin: (name: string, code: string) => void; onBack: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(invitedRoom)
  const joining = mode === 'join'
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    if (joining) {
      if (code.length === CODE_LENGTH) onJoin(name.trim(), code)
    } else onHost(name.trim())
  }
  return (
    <main className="lb-page">
      <form className="lb-card lb-setup" onSubmit={submit}>
        <button type="button" className="lb-link lb-setup__back" onClick={onBack}>
          ← Kembali
        </button>
        <h1 className="lb-title">{joining ? 'Gabung Room' : 'Buat Room'}</h1>
        <p className="lb-muted">
          {MIN_PLAYERS}–{MAX_PLAYERS} pemain, tiap pemain di perangkatnya sendiri.
        </p>
        <label className="lb-field">
          <span>Nama kamu</span>
          <input type="text" maxLength={16} placeholder="Nama" value={name} autoFocus onChange={(event) => setName(event.target.value)} />
        </label>
        {joining && (
          <label className="lb-field">
            <span>Kode room</span>
            <input
              type="text"
              className="lb-code-input"
              placeholder="KODE"
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(normalizeCode(event.target.value))}
            />
          </label>
        )}
        <button type="submit" className="lb-btn lb-btn--primary" disabled={!name.trim() || (joining && code.length !== CODE_LENGTH)}>
          {joining ? 'Gabung' : 'Buat Room'}
        </button>
      </form>
    </main>
  )
}

// ---------- Latihan (tanpa jaringan) ----------

function Practice({ size, onExit }: { size: MazeSize; onExit: () => void }) {
  const [run, setRun] = useState(0)
  const [finalMs, setFinalMs] = useState<number | null>(null)
  const [best, setBest] = useState(loadBest)
  const game = useMemo(() => {
    const maze = generateMaze(randomSeed(), size, 1)
    return { maze, body: spawnBody(maze, 0), next: 0, goAt: performance.now() + 3000, done: false }
  }, [size, run])

  const sample = (now: number, dirs: number) => {
    if (!game.done && now >= game.goAt) {
      const due = Math.floor((now - game.goAt) / (STEP * 1000))
      while (game.next < due && !game.done) {
        step(game.maze, game.body, dirs)
        game.next++
        if (atExit(game.maze, game.body)) {
          game.done = true
          const ms = Math.round(game.next * STEP * 1000)
          setFinalMs(ms)
          setBest(saveBest(size, ms))
          sfx.win()
        }
      }
    }
    return new Map<number, Body>([[0, game.body]])
  }

  const record = finalMs !== null && best[size] === finalMs
  return (
    <RaceView maze={game.maze} roster={[{ seat: 0, name: 'Kamu', connected: true }]} localSeat={0} sample={sample} goAt={game.goAt} finalMs={finalMs} reveal={finalMs !== null} onExit={onExit}>
      {finalMs !== null && (
        <div className="lb-result lb-card" role="dialog" aria-label="Hasil latihan">
          <p className="lb-eyebrow">Latihan · labirin {SIZE_LABEL[size].toLowerCase()}</p>
          <h2 className="lb-title">{record ? 'Rekor baru!' : 'Keluar!'}</h2>
          <p className="lb-result__time">{formatTime(finalMs)}</p>
          {best[size] !== undefined && <p className="lb-muted">Rekor terbaik: {formatTime(best[size]!)}</p>}
          <div className="lb-actions">
            <button
              type="button"
              className="lb-btn lb-btn--primary"
              autoFocus
              onClick={() => {
                setFinalMs(null)
                setRun((n) => n + 1)
              }}
            >
              Labirin baru
            </button>
            <button type="button" className="lb-btn" onClick={onExit}>
              Menu
            </button>
          </div>
        </div>
      )}
    </RaceView>
  )
}

// ---------- Lobi ----------

function Lobby({ room, onExit }: { room: LabirinRoom; onExit: () => void }) {
  const [copied, setCopied] = useState('')
  const players = room.lobby.players
  const me = players[room.seat]
  const present = players.filter((player) => player.connected).length
  const effective = sizeFor(room.lobby.size, present)
  const invite = `${window.location.origin}${window.location.pathname}?game=labirin&room=${room.code}`
  const copy = (text: string, what: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what)
      setTimeout(() => setCopied(''), 1500)
    })
  }
  const waiting = present < MIN_PLAYERS ? `Menunggu pemain lain (minimal ${MIN_PLAYERS}).` : players.some((player, i) => i > 0 && player.connected && !player.ready) ? 'Menunggu semua pemain siap.' : ''

  return (
    <main className="lb-page">
      <section className="lb-card lb-lobby" aria-labelledby="lb-lobby-title">
        <header className="lb-lobby__head">
          <div>
            <p className="lb-eyebrow">Lobi</p>
            <h1 id="lb-lobby-title" className="lb-title">
              Room <span className="lb-code">{room.code}</span>
            </h1>
          </div>
          <div className="lb-lobby__share">
            <button type="button" className="lb-btn lb-btn--small" onClick={() => copy(room.code, 'kode')}>
              {copied === 'kode' ? 'Tersalin!' : 'Salin kode'}
            </button>
            <button type="button" className="lb-btn lb-btn--small" onClick={() => copy(invite, 'link')}>
              {copied === 'link' ? 'Tersalin!' : 'Salin link'}
            </button>
          </div>
        </header>

        <ul className="lb-slots" aria-label={`Pemain (${players.length}/${MAX_PLAYERS})`}>
          {Array.from({ length: MAX_PLAYERS }, (_, i) => {
            const player = players[i]
            if (!player)
              return (
                <li key={i} className="lb-slot is-empty">
                  <span className="lb-dot" />
                  <span>Slot kosong</span>
                </li>
              )
            const status = !player.connected ? 'Terputus' : i === 0 ? 'Host' : player.ready ? 'Siap' : 'Belum siap'
            return (
              <li key={i} className={`lb-slot ${player.connected ? '' : 'is-offline'} ${i === room.seat ? 'is-me' : ''}`}>
                <span className="lb-dot" style={{ background: colorOf(i) }} />
                <span className="lb-slot__name">
                  {player.name}
                  {i === room.seat && <small> (kamu)</small>}
                </span>
                {player.wins > 0 && <span className="lb-slot__wins" title="Kemenangan di room ini">🏆 {player.wins}</span>}
                <span className={`lb-badge ${i === 0 ? 'is-host' : player.connected && player.ready ? 'is-ready' : ''}`}>{status}</span>
              </li>
            )
          })}
        </ul>

        <div className="lb-lobby__settings">
          <span className="lb-muted">Ukuran labirin</span>
          <div className="lb-segment" role="radiogroup" aria-label="Ukuran labirin">
            {SIZE_ORDER.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={room.lobby.size === option}
                className={room.lobby.size === option ? 'is-active' : ''}
                disabled={!room.isHost}
                onClick={() => room.configure(option)}
              >
                {SIZE_LABEL[option]}
                <small>
                  {SIZES[option]}×{SIZES[option]}
                </small>
              </button>
            ))}
          </div>
          {effective !== room.lobby.size && <p className="lb-hint">Dengan {present} pemain, labirin otomatis {SIZE_LABEL[effective]} supaya rute tiap pemain sama panjang.</p>}
        </div>

        <footer className="lb-lobby__foot">
          {room.isHost ? (
            <button type="button" className="lb-btn lb-btn--primary lb-btn--big" disabled={!room.canStart} onClick={room.start}>
              Mulai balapan
            </button>
          ) : (
            <button type="button" className={`lb-btn lb-btn--big ${me?.ready ? '' : 'lb-btn--primary'}`} onClick={() => room.setReady(!me?.ready)}>
              {me?.ready ? 'Batal siap' : 'Siap!'}
            </button>
          )}
          <p className="lb-muted" aria-live="polite">
            {room.isHost ? waiting || 'Semua siap. Mulai kapan saja!' : me?.ready ? 'Menunggu host memulai…' : 'Tekan Siap kalau sudah siap.'}
          </p>
          <button type="button" className="lb-link" onClick={onExit}>
            Keluar dari room
          </button>
        </footer>
      </section>
    </main>
  )
}

// ---------- Balapan online + hasil ----------

function Results({ room, roster, onExit }: { room: LabirinRoom; roster: RosterEntry[]; onExit: () => void }) {
  const result = room.match!.result!
  const winner = roster[result.winner]
  const won = result.winner === room.racer
  return (
    <div className="lb-result lb-card" role="dialog" aria-label="Hasil balapan">
      <p className="lb-eyebrow">Balapan selesai · {formatTime(result.endMs)}</p>
      <div className="lb-winner" style={{ ['--winner' as string]: colorOf(result.winner) }}>
        <span className="lb-winner__orb" aria-hidden="true" />
        <h2 className="lb-title">{won ? 'Kamu menang!' : `${winner?.name ?? 'Pemain'} menang!`}</h2>
      </div>
      <ol className="lb-standings">
        {result.order.map((racer, rank) => (
          <li key={racer} className={racer === room.racer ? 'is-me' : ''}>
            <span className="lb-standings__rank">{rank + 1}</span>
            <span className="lb-dot" style={{ background: colorOf(racer) }} />
            <span className="lb-standings__name">
              {roster[racer]?.name}
              {racer === room.racer && <small> (kamu)</small>}
              {roster[racer] && !roster[racer].connected && <small> · terputus</small>}
            </span>
            <span className="lb-standings__value">{result.times[racer] !== null ? formatTime(result.times[racer]!) : `sisa ${result.left[racer]} ubin`}</span>
          </li>
        ))}
      </ol>
      {room.isHost ? (
        <div className="lb-actions">
          <button type="button" className="lb-btn lb-btn--primary" disabled={!room.canStart} onClick={room.start}>
            Main lagi (labirin baru)
          </button>
          <button type="button" className="lb-btn" onClick={room.toLobby}>
            Kembali ke lobi
          </button>
        </div>
      ) : (
        <p className="lb-muted">Menunggu host memulai lagi atau kembali ke lobi…</p>
      )}
      {room.isHost && !room.canStart && <p className="lb-hint">Butuh minimal {MIN_PLAYERS} pemain yang tersambung untuk main lagi.</p>}
      <button type="button" className="lb-link" onClick={onExit}>
        Keluar dari room
      </button>
    </div>
  )
}

function OnlineRace({ room, onExit }: { room: LabirinRoom; onExit: () => void }) {
  const match = room.match!
  const roster: RosterEntry[] = match.roster.map((entry, racer) => ({ seat: racer, name: entry.name, connected: room.lobby.players[entry.seat]?.connected ?? false }))
  const result = match.result
  const phase = match.phase
  useEffect(() => {
    if (phase !== 'over' || !result) return
    if (result.winner === room.racer) sfx.win()
    else sfx.lose()
  }, [phase, result, room.racer])
  const finalMs = result ? (room.racer !== null ? (result.times[room.racer] ?? result.endMs) : result.endMs) : null
  const online = room.lobby.players.filter((player) => player.connected).length
  return (
    <RaceView
      maze={room.maze!}
      roster={roster}
      localSeat={room.racer}
      sample={room.sample}
      goAt={room.goAt}
      finalMs={finalMs}
      reveal={phase === 'over'}
      finished={result ? result.order.filter((racer) => result.times[racer] !== null) : []}
      status={
        <span className="lb-net" title={room.isHost ? 'Kamu host' : 'Tersambung ke host'}>
          <span className="lb-net__dot" /> {room.isHost ? `Host · ${online}/${roster.length} online` : `Room ${room.code}`}
        </span>
      }
      onExit={onExit}
    >
      {phase === 'over' && result && <Results room={room} roster={roster} onExit={onExit} />}
    </RaceView>
  )
}

function RoomView({ room, onExit }: { room: LabirinRoom; onExit: () => void }) {
  const joined = room.lobby.players.length
  const previous = useRef(joined)
  useEffect(() => {
    if (joined > previous.current) sfx.join()
    previous.current = joined
  }, [joined])

  if (room.status === 'error') {
    return (
      <main className="lb-page">
        <div className="lb-card lb-setup" role="alert">
          <h1 className="lb-title">Tidak terhubung</h1>
          <p>{errorMessage(room.error)}</p>
          {room.error?.code === 'unreachable' && room.error.detail && <p className="lb-hint">Detail teknis: {room.error.detail}</p>}
          {!room.isHost && (
            <button type="button" className="lb-btn lb-btn--primary" onClick={room.retry}>
              Coba lagi
            </button>
          )}
          <button type="button" className="lb-btn" onClick={onExit}>
            Kembali ke menu
          </button>
        </div>
      </main>
    )
  }
  if (room.status === 'connecting') {
    return (
      <main className="lb-page">
        <div className="lb-card lb-setup" aria-live="polite">
          <h1 className="lb-title">{room.isHost ? 'Membuka room…' : `Mencari room ${room.code}…`}</h1>
          <button type="button" className="lb-btn" onClick={onExit}>
            Batal
          </button>
        </div>
      </main>
    )
  }
  if (room.match && room.maze) return <OnlineRace room={room} onExit={onExit} />
  return <Lobby room={room} onExit={onExit} />
}

function HostGame({ name, onExit }: { name: string; onExit: () => void }) {
  return <RoomView room={useLabirinHostRoom(name)} onExit={onExit} />
}

function GuestGame({ name, code, onExit }: { name: string; code: string; onExit: () => void }) {
  return <RoomView room={useLabirinGuestRoom(code, name)} onExit={onExit} />
}

type Screen =
  | { kind: 'home' }
  | { kind: 'create' }
  | { kind: 'join' }
  | { kind: 'practice'; size: MazeSize }
  | { kind: 'host'; name: string }
  | { kind: 'guest'; name: string; code: string }

export function LabirinApp({ nav }: { nav: ReactNode }) {
  useLabirinTheme()
  const [screen, setScreen] = useState<Screen>(() => (invitedRoom() ? { kind: 'join' } : { kind: 'home' }))
  const [guideOpen, setGuideOpen] = useState(false)
  const goHome = () => setScreen({ kind: 'home' })
  switch (screen.kind) {
    case 'home':
      return (
        <>
          <Home
            nav={nav}
            onCreate={() => setScreen({ kind: 'create' })}
            onJoin={() => setScreen({ kind: 'join' })}
            onPractice={(size) => setScreen({ kind: 'practice', size })}
            onGuide={() => setGuideOpen(true)}
          />
          <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
        </>
      )
    case 'create':
    case 'join':
      return <Setup mode={screen.kind} onHost={(name) => setScreen({ kind: 'host', name })} onJoin={(name, code) => setScreen({ kind: 'guest', name, code })} onBack={goHome} />
    case 'practice':
      return <Practice size={screen.size} onExit={goHome} />
    case 'host':
      return <HostGame name={screen.name} onExit={goHome} />
    case 'guest':
      return <GuestGame name={screen.name} code={screen.code} onExit={goHome} />
  }
}
