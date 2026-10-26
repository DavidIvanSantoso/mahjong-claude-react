import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import bomkataFavicon from '../assets/bomkata-favicon.svg'
import { CODE_LENGTH, normalizeCode, type RoomError } from '../net/online'
import { BomKataHome } from './BomKataHome'
import { GuideDialog } from './BomKataDialogs'
import { BomKataTable } from './BomKataTable'
import { MAX_PLAYERS, MIN_PLAYERS, useBomKataGuestRoom, useBomKataHostRoom, type BomKataRoom } from './net'
import { PixelBomb } from './Pixel'

type Screen = { kind: 'home' } | { kind: 'setup' } | { kind: 'host'; name: string } | { kind: 'guest'; name: string; code: string }

/** Kode room dari link undangan (?game=bomkata&room=KODE). */
function invitedRoom(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('game') === 'bomkata' ? normalizeCode(params.get('room') ?? '') : ''
}

function errorMessage(error: RoomError | null): string {
  switch (error?.code) {
    case 'id-taken':
      return 'Kode room sudah dipakai. Coba buat room lagi.'
    case 'host-failed':
      return `Gagal membuat room (${error.detail}). Periksa koneksi internet.`
    case 'started':
      return 'Permainan di room ini sudah dimulai.'
    case 'full':
      return `Room sudah penuh (maksimal ${MAX_PLAYERS} pemain).`
    case 'host-lost':
      return 'Koneksi ke host terputus.'
    case 'not-found':
      return 'Room tidak ditemukan. Periksa kodenya dan pastikan host masih membuka room.'
    case 'unreachable':
      return 'Tidak bisa tersambung ke host. Biasanya karena jaringan (data seluler, WiFi kantor/kampus) menghalangi koneksi langsung antarperangkat. Coba jaringan lain, mis. WiFi yang sama dengan host.'
    case 'connect-failed':
      return `Gagal terhubung (${error.detail}). Periksa koneksi internet.`
    default:
      return ''
  }
}

function Setup({ onHost, onJoin, onBack }: { onHost: (name: string) => void; onJoin: (name: string, code: string) => void; onBack: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(invitedRoom)

  function join(event: FormEvent) {
    event.preventDefault()
    if (code.length === CODE_LENGTH) onJoin(name.trim(), code)
  }

  return (
    <main className="bk-page bk-setup">
      <div className="bk-panel bk-setup__card">
        <button type="button" className="btn btn--small setup__back" onClick={onBack}>
          ← Kembali
        </button>
        <h1 className="bk-setup__title">ONLINE</h1>
        <p className="bk-setup__lead">KA-BOOM! untuk 2–{MAX_PLAYERS} pemain, tiap pemain di perangkatnya sendiri.</p>

        <label className="bk-field">
          <span>Nama kamu</span>
          <input type="text" maxLength={16} placeholder="Nama" value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <form className="bk-field" onSubmit={join}>
          <span>Gabung ke room</span>
          <div className="bk-field__row">
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
            <button type="submit" className="bk-btn" disabled={code.length !== CODE_LENGTH}>
              GABUNG
            </button>
          </div>
        </form>

        <div className="split__divider" role="separator">
          <span>atau</span>
        </div>

        <button type="button" className="bk-btn bk-btn--big" onClick={() => onHost(name.trim() || 'Host')}>
          BUAT ROOM BARU
        </button>
        <p className="bk-setup__note">Permainan bisa dimulai begitu ada minimal {MIN_PLAYERS} pemain.</p>
      </div>
      <div className="bk-setup__deco" aria-hidden="true">
        <PixelBomb heat={2} />
      </div>
    </main>
  )
}

function RoomView({ room, onExit }: { room: BomKataRoom; onExit: () => void }) {
  const [copied, setCopied] = useState(false)

  if (room.status === 'error') {
    return (
      <main className="bk-page">
        <div className="bk-panel bk-setup__card">
          <h1 className="bk-setup__title">TIDAK TERHUBUNG</h1>
          <p className="bk-setup__lead">{errorMessage(room.error)}</p>
          {room.error?.code === 'unreachable' && room.error.detail && <p className="bk-setup__note">Detail teknis: {room.error.detail}</p>}
          {!room.isHost && (
            <button type="button" className="bk-btn bk-btn--wide" onClick={room.retry}>
              COBA LAGI
            </button>
          )}
          <button type="button" className="btn btn--wide" onClick={onExit}>
            Kembali ke menu
          </button>
        </div>
      </main>
    )
  }

  if (room.view) return <BomKataTable room={room} onExit={onExit} />

  const { players, library } = room.lobby
  const ready = players.length >= MIN_PLAYERS && library === 'ready'
  const link = `${window.location.origin}${window.location.pathname}?game=bomkata&room=${room.code}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Clipboard bisa ditolak browser; link tetap bisa disalin manual dari kolomnya.
    }
  }

  return (
    <main className="bk-page">
      <div className="bk-panel bk-setup__card">
        {room.status === 'connecting' ? (
          <>
            <h1 className="bk-setup__title">MENGHUBUNGKAN…</h1>
            <p className="bk-setup__lead">{room.isHost ? 'Membuat room.' : `Mencari room ${room.code}.`}</p>
          </>
        ) : (
          <>
            <p className="bk-setup__lead">Kode room</p>
            <h1 className="lobby__code">{room.code}</h1>

            <div className="bk-field">
              <span>Bagikan link ini ke pemain lain</span>
              <div className="bk-field__row">
                <input type="text" readOnly value={link} aria-label="Link undangan" onFocus={(e) => e.target.select()} />
                <button type="button" className="bk-btn" onClick={copyLink}>
                  {copied ? 'TERSALIN' : 'SALIN'}
                </button>
              </div>
            </div>

            <div className="bk-field">
              <span>
                Pemain ({players.length}/{MAX_PLAYERS})
              </span>
              <ol className="lobby__players">
                {Array.from({ length: MAX_PLAYERS }, (_, i) => (
                  <li key={i} className={players[i] ? '' : 'lobby__empty'}>
                    {players[i] ? `${players[i].name}${i === 0 ? ' (host)' : ''}${i === room.seat ? ' — kamu' : ''}` : 'Menunggu pemain…'}
                  </li>
                ))}
              </ol>
            </div>

            {room.isHost && library === 'loading' && <p className="bk-setup__note">Memuat kamus kata…</p>}
            {room.isHost && library === 'error' && (
              <p className="bk-setup__note bk-setup__note--bad">Kamus kata gagal dimuat. Periksa koneksi lalu buat room lagi.</p>
            )}

            {room.isHost ? (
              <button type="button" className="bk-btn bk-btn--big" disabled={!ready} onClick={room.start}>
                {players.length < MIN_PLAYERS ? 'MENUNGGU PEMAIN' : `MULAI (${players.length} PEMAIN)`}
              </button>
            ) : (
              <p className="bk-setup__lead">Menunggu host memulai permainan…</p>
            )}
          </>
        )}
        <button type="button" className="btn btn--wide" onClick={onExit}>
          Keluar
        </button>
      </div>
    </main>
  )
}

function HostGame({ name, onExit }: { name: string; onExit: () => void }) {
  return <RoomView room={useBomKataHostRoom(name)} onExit={onExit} />
}

function GuestGame({ name, code, onExit }: { name: string; code: string; onExit: () => void }) {
  return <RoomView room={useBomKataGuestRoom(code, name)} onExit={onExit} />
}

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap'

/**
 * Memasang tema 8-bit (lihat bomkata.css, `:root[data-game='bomkata']`), font pixel, judul tab,
 * dan ikon tab selama layar KA-BOOM! terbuka; semuanya dikembalikan saat pindah game.
 */
function useBomKataTheme() {
  useEffect(() => {
    const root = document.documentElement
    const title = document.title
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const previousIcon = icon?.getAttribute('href') ?? null
    root.dataset.game = 'bomkata'
    document.title = 'KA-BOOM! - By David Ivan'
    icon?.setAttribute('href', bomkataFavicon)
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

export function BomKataApp({ nav }: { nav: ReactNode }) {
  const [screen, setScreen] = useState<Screen>(() => (invitedRoom() ? { kind: 'setup' } : { kind: 'home' }))
  const [guideOpen, setGuideOpen] = useState(false)
  useBomKataTheme()
  const goHome = () => setScreen({ kind: 'home' })

  switch (screen.kind) {
    case 'home':
      return (
        <>
          <BomKataHome nav={nav} onOnline={() => setScreen({ kind: 'setup' })} onGuide={() => setGuideOpen(true)} />
          <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
        </>
      )
    case 'setup':
      return (
        <Setup
          onHost={(name) => setScreen({ kind: 'host', name })}
          onJoin={(name, code) => setScreen({ kind: 'guest', name, code })}
          onBack={goHome}
        />
      )
    case 'host':
      return <HostGame name={screen.name} onExit={goHome} />
    case 'guest':
      return <GuestGame name={screen.name} code={screen.code} onExit={goHome} />
  }
}
