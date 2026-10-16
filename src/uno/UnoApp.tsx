import { useEffect, useState, type ReactNode } from 'react'
import type { RoomError } from '../net/online'
import { MAX_PLAYERS, MIN_PLAYERS, TARGET_SCORE, useUnoGuestRoom, useUnoHostRoom, type UnoRoom } from './net'
import { MODE_NAMES, type UnoMode } from './state'
import { RulesDialog } from './UnoDialogs'
import { UnoHome } from './UnoHome'
import { MODE_SUMMARIES, unoInvitedRoom, UnoSetup } from './UnoSetup'
import { UnoTable } from './UnoTable'

type Screen =
  | { kind: 'home' }
  | { kind: 'setup' }
  | { kind: 'host'; name: string; turnSeconds: number; mode: UnoMode }
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
    case 'connect-failed':
      return `Gagal terhubung (${error.detail}). Periksa koneksi internet.`
    default:
      return ''
  }
}

function inviteLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}?game=uno&room=${code}`
}

function RoomView({ room, onExit }: { room: UnoRoom; onExit: () => void }) {
  const [copied, setCopied] = useState(false)

  if (room.status === 'error') {
    return (
      <main className="setup uno-page">
        <div className="card setup__card">
          <h1 className="setup__title">Tidak terhubung</h1>
          <p className="setup__lead">{errorMessage(room.error)}</p>
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

  if (room.view) return <UnoTable room={room} onExit={onExit} />

  const { players, turnSeconds, mode } = room.lobby
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
    <main className="setup uno-page">
      <div className="card setup__card">
        {room.status === 'connecting' ? (
          <>
            <h1 className="setup__title">Menghubungkan…</h1>
            <p className="setup__lead">{room.isHost ? 'Membuat room.' : `Mencari room ${room.code}.`}</p>
          </>
        ) : (
          <>
            <div>
              <p className="setup__lead">Kode room UNO</p>
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
              Mode <strong>{MODE_NAMES[mode]}</strong>: {MODE_SUMMARIES[mode]}
            </p>
            <p className="setup__lead">
              7 kartu per pemain, target <strong>{TARGET_SCORE} poin</strong>. Waktu per giliran:{' '}
              <strong>{turnSeconds} detik</strong>; kalau habis, otomatis mengambil 1 kartu.
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

interface HostGameProps {
  name: string
  turnSeconds: number
  mode: UnoMode
  onExit: () => void
}

function HostGame({ name, turnSeconds, mode, onExit }: HostGameProps) {
  return <RoomView room={useUnoHostRoom(name, turnSeconds, mode)} onExit={onExit} />
}

function GuestGame({ name, code, onExit }: { name: string; code: string; onExit: () => void }) {
  return <RoomView room={useUnoGuestRoom(code, name)} onExit={onExit} />
}

/**
 * Memasang palet UNO (lihat uno.css, `:root[data-game='uno']`) selama layar UNO terbuka.
 * Palet ini menimpa tema mahjong dan pilihan palet pemain, jadi UNO tidak memakai tombol tema.
 */
function useUnoTheme() {
  useEffect(() => {
    const root = document.documentElement
    const title = document.title
    root.dataset.game = 'uno'
    document.title = 'UNO - By David Ivan'
    return () => {
      delete root.dataset.game
      document.title = title
    }
  }, [])
}

/** Semua layar UNO. `nav` adalah navbar pemilih game, ditampilkan di homescreen. */
export function UnoApp({ nav }: { nav: ReactNode }) {
  const [screen, setScreen] = useState<Screen>(() => (unoInvitedRoom() ? { kind: 'setup' } : { kind: 'home' }))
  const [rulesOpen, setRulesOpen] = useState(false)
  useUnoTheme()
  const goHome = () => setScreen({ kind: 'home' })

  switch (screen.kind) {
    case 'home':
      return (
        <>
          <UnoHome nav={nav} onOnline={() => setScreen({ kind: 'setup' })} onRules={() => setRulesOpen(true)} />
          <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
        </>
      )
    case 'setup':
      return (
        <UnoSetup
          onHost={(name, turnSeconds, mode) => setScreen({ kind: 'host', name, turnSeconds, mode })}
          onJoin={(name, code) => setScreen({ kind: 'guest', name, code })}
          onBack={goHome}
        />
      )
    case 'host':
      return <HostGame name={screen.name} turnSeconds={screen.turnSeconds} mode={screen.mode} onExit={goHome} />
    case 'guest':
      return <GuestGame name={screen.name} code={screen.code} onExit={goHome} />
  }
}
