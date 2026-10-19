import { useEffect, useState, type ReactNode } from 'react'
import capsaFavicon from '../assets/capsa-favicon.svg'
import type { RoomError } from '../net/online'
import { GuideDialog } from './CapsaDialogs'
import { CapsaHome } from './CapsaHome'
import { capsaInvitedRoom, CapsaSetup } from './CapsaSetup'
import { CapsaTable } from './CapsaTable'
import { MAX_PLAYERS, MIN_PLAYERS, useCapsaGuestRoom, useCapsaHostRoom, type CapsaRoom } from './net'

type Screen =
  | { kind: 'home' }
  | { kind: 'setup' }
  | { kind: 'host'; name: string }
  | { kind: 'guest'; name: string; code: string }

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

function inviteLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}?game=capsa&room=${code}`
}

function RoomView({ room, onExit }: { room: CapsaRoom; onExit: () => void }) {
  const [copied, setCopied] = useState(false)

  if (room.status === 'error') {
    return (
      <main className="setup capsa-page">
        <div className="card setup__card">
          <h1 className="setup__title">Tidak terhubung</h1>
          <p className="setup__lead">{errorMessage(room.error)}</p>
          {room.error?.code === 'unreachable' && room.error.detail && (
            <p className="setup__note">Detail teknis: {room.error.detail}</p>
          )}
          {!room.isHost && (
            <button type="button" className="btn btn--primary btn--wide" onClick={room.retry}>
              Coba sambung lagi
            </button>
          )}
          <button type="button" className="btn btn--wide" onClick={onExit}>
            Kembali ke menu
          </button>
        </div>
      </main>
    )
  }

  if (room.view) return <CapsaTable room={room} onExit={onExit} />

  const { players } = room.lobby
  const ready = players.length >= MIN_PLAYERS
  const link = inviteLink(room.code)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Clipboard bisa ditolak browser; link tetap bisa disalin manual dari kolomnya.
    }
  }

  return (
    <main className="setup capsa-page">
      <div className="card setup__card">
        {room.status === 'connecting' ? (
          <>
            <h1 className="setup__title">Menghubungkan…</h1>
            <p className="setup__lead">{room.isHost ? 'Membuat room.' : `Mencari room ${room.code}.`}</p>
          </>
        ) : (
          <>
            <div>
              <p className="setup__lead">Kode room Capsa</p>
              <h1 className="lobby__code">{room.code}</h1>
            </div>

            <div className="setup__field">
              <span className="setup__label">Bagikan link ini ke pemain lain</span>
              <div className="setup__row setup__names">
                <input type="text" readOnly value={link} aria-label="Link undangan" onFocus={(e) => e.target.select()} />
                <button type="button" className="btn" onClick={copyLink}>
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              </div>
            </div>

            <div className="setup__field">
              <span className="setup__label">
                Pemain ({players.length}/{MAX_PLAYERS})
              </span>
              <ol className="lobby__players">
                {Array.from({ length: MAX_PLAYERS }, (_, i) => (
                  <li key={i} className={players[i] ? '' : 'lobby__empty'}>
                    {players[i]
                      ? `${players[i].name}${i === 0 ? ' (host)' : ''}${i === room.seat ? ' — kamu' : ''}`
                      : 'Menunggu pemain…'}
                  </li>
                ))}
              </ol>
            </div>

            <p className="setup__lead">
              52 kartu tanpa Joker, 13 kartu per pemain. Tanpa batas waktu giliran.
            </p>

            {room.isHost ? (
              <button type="button" className="btn btn--primary btn--wide" disabled={!ready} onClick={room.start}>
                {ready ? `Mulai permainan (${players.length} pemain)` : 'Menunggu minimal 2 pemain'}
              </button>
            ) : (
              <p className="setup__lead">Menunggu host memulai permainan…</p>
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
  return <RoomView room={useCapsaHostRoom(name)} onExit={onExit} />
}

function GuestGame({ name, code, onExit }: { name: string; code: string; onExit: () => void }) {
  return <RoomView room={useCapsaGuestRoom(code, name)} onExit={onExit} />
}

/**
 * Memasang palet Capsa (lihat capsa.css, `:root[data-game='capsa']`), judul tab, dan ikon tab
 * selama layar Capsa terbuka; semuanya dikembalikan saat pindah game.
 */
function useCapsaTheme() {
  useEffect(() => {
    const root = document.documentElement
    const title = document.title
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const previousIcon = icon?.getAttribute('href') ?? null
    root.dataset.game = 'capsa'
    document.title = 'Capsa - By David Ivan'
    icon?.setAttribute('href', capsaFavicon)
    return () => {
      delete root.dataset.game
      document.title = title
      if (icon && previousIcon !== null) icon.setAttribute('href', previousIcon)
    }
  }, [])
}

/** Semua layar Capsa. `nav` adalah navbar pemilih game, ditampilkan di homescreen. */
export function CapsaApp({ nav }: { nav: ReactNode }) {
  const [screen, setScreen] = useState<Screen>(() => (capsaInvitedRoom() ? { kind: 'setup' } : { kind: 'home' }))
  const [guideOpen, setGuideOpen] = useState(false)
  useCapsaTheme()
  const goHome = () => setScreen({ kind: 'home' })

  switch (screen.kind) {
    case 'home':
      return (
        <>
          <CapsaHome nav={nav} onOnline={() => setScreen({ kind: 'setup' })} onGuide={() => setGuideOpen(true)} />
          <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
        </>
      )
    case 'setup':
      return (
        <CapsaSetup
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
