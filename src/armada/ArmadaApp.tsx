import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import armadaFavicon from '../assets/armada-favicon.svg'
import { CODE_LENGTH, normalizeCode, type RoomError } from '../net/online'
import { ArmadaHome } from './ArmadaHome'
import { GuideDialog } from './ArmadaDialogs'
import { ArmadaTable } from './ArmadaTable'
import { DEFAULT_PRESET, PRESETS, type PresetId } from './grid'
import { MAX_PLAYERS, MIN_PLAYERS, useArmadaGuestRoom, useArmadaHostRoom, type ArmadaRoom } from './net'
import { ShipArt } from './Pixel'

type Screen = { kind: 'home' } | { kind: 'setup' } | { kind: 'host'; name: string; preset: PresetId } | { kind: 'guest'; name: string; code: string }

/** Kode room dari link undangan (?game=armada&room=KODE). */
function invitedRoom(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('game') === 'armada' ? normalizeCode(params.get('room') ?? '') : ''
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

function Setup({
  onHost,
  onJoin,
  onBack,
}: {
  onHost: (name: string, preset: PresetId) => void
  onJoin: (name: string, code: string) => void
  onBack: () => void
}) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(invitedRoom)
  const [preset, setPreset] = useState<PresetId>(DEFAULT_PRESET)

  function join(event: FormEvent) {
    event.preventDefault()
    if (code.length === CODE_LENGTH) onJoin(name.trim(), code)
  }

  return (
    <main className="ar-page ar-setup">
      <div className="ar-panel ar-setup__card">
        <button type="button" className="btn btn--small setup__back" onClick={onBack}>
          ← Kembali
        </button>
        <h1 className="ar-setup__title">ONLINE</h1>
        <p className="ar-setup__lead">
          Armada Royale untuk {MIN_PLAYERS}–{MAX_PLAYERS} pemain, tiap pemain di perangkatnya sendiri.
        </p>

        <label className="ar-field">
          <span>Nama kamu</span>
          <input type="text" maxLength={16} placeholder="Nama" value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <form className="ar-field" onSubmit={join}>
          <span>Gabung ke room</span>
          <div className="ar-field__row">
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
            <button type="submit" className="ar-btn" disabled={code.length !== CODE_LENGTH}>
              GABUNG
            </button>
          </div>
        </form>

        <div className="split__divider" role="separator">
          <span>atau</span>
        </div>

        <fieldset className="ar-field ar-presets">
          <legend>Ukuran papan (room baru)</legend>
          {Object.values(PRESETS).map((option) => (
            <label key={option.id} className={`ar-preset ${preset === option.id ? 'ar-preset--on' : ''}`}>
              <input type="radio" name="preset" value={option.id} checked={preset === option.id} onChange={() => setPreset(option.id)} />
              <strong>{option.name}</strong>
              <span>{option.ships.map((ship) => ship.size).join('+')} sel kapal</span>
            </label>
          ))}
        </fieldset>

        <button type="button" className="ar-btn ar-btn--big" onClick={() => onHost(name.trim() || 'Host', preset)}>
          BUAT ROOM BARU
        </button>
        <p className="ar-setup__note">Permainan bisa dimulai begitu ada minimal {MIN_PLAYERS} pemain.</p>
      </div>
      <div className="ar-setup__deco" aria-hidden="true">
        <ShipArt size={4} dir="v" />
      </div>
    </main>
  )
}

function RoomView({ room, onExit }: { room: ArmadaRoom; onExit: () => void }) {
  const [copied, setCopied] = useState(false)

  if (room.status === 'error') {
    return (
      <main className="ar-page">
        <div className="ar-panel ar-setup__card">
          <h1 className="ar-setup__title">TIDAK TERHUBUNG</h1>
          <p className="ar-setup__lead">{errorMessage(room.error)}</p>
          {room.error?.code === 'unreachable' && room.error.detail && <p className="ar-setup__note">Detail teknis: {room.error.detail}</p>}
          {!room.isHost && (
            <button type="button" className="ar-btn ar-btn--wide" onClick={room.retry}>
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

  if (room.view) return <ArmadaTable room={room} onExit={onExit} />

  const { players, preset } = room.lobby
  const link = `${window.location.origin}${window.location.pathname}?game=armada&room=${room.code}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Clipboard bisa ditolak browser; link tetap bisa disalin manual dari kolomnya.
    }
  }

  return (
    <main className="ar-page">
      <div className="ar-panel ar-setup__card">
        {room.status === 'connecting' ? (
          <>
            <h1 className="ar-setup__title">MENGHUBUNGKAN…</h1>
            <p className="ar-setup__lead">{room.isHost ? 'Membuat room.' : `Mencari room ${room.code}.`}</p>
          </>
        ) : (
          <>
            <p className="ar-setup__lead">Kode room</p>
            <h1 className="lobby__code">{room.code}</h1>
            <p className="ar-setup__note">
              Papan {PRESETS[preset].name}: {PRESETS[preset].ships.map((ship) => ship.name).join(', ')}.
            </p>

            <div className="ar-field">
              <span>Bagikan link ini ke pemain lain</span>
              <div className="ar-field__row">
                <input type="text" readOnly value={link} aria-label="Link undangan" onFocus={(e) => e.target.select()} />
                <button type="button" className="ar-btn" onClick={copyLink}>
                  {copied ? 'TERSALIN' : 'SALIN'}
                </button>
              </div>
            </div>

            <div className="ar-field">
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

            {room.isHost ? (
              <button type="button" className="ar-btn ar-btn--big" disabled={players.length < MIN_PLAYERS} onClick={room.start}>
                {players.length < MIN_PLAYERS ? 'MENUNGGU PEMAIN' : `MULAI (${players.length} PEMAIN)`}
              </button>
            ) : (
              <p className="ar-setup__lead">Menunggu host memulai permainan…</p>
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

function HostGame({ name, preset, onExit }: { name: string; preset: PresetId; onExit: () => void }) {
  return <RoomView room={useArmadaHostRoom(name, preset)} onExit={onExit} />
}

function GuestGame({ name, code, onExit }: { name: string; code: string; onExit: () => void }) {
  return <RoomView room={useArmadaGuestRoom(code, name)} onExit={onExit} />
}

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap'

/**
 * Memasang tema laut 8-bit (lihat armada.css, `:root[data-game='armada']`), font pixel, judul tab,
 * dan ikon tab selama layar Armada Royale terbuka; semuanya dikembalikan saat pindah game.
 */
function useArmadaTheme() {
  useEffect(() => {
    const root = document.documentElement
    const title = document.title
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const previousIcon = icon?.getAttribute('href') ?? null
    root.dataset.game = 'armada'
    document.title = 'Armada Royale - By David Ivan'
    icon?.setAttribute('href', armadaFavicon)
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

export function ArmadaApp({ nav }: { nav: ReactNode }) {
  const [screen, setScreen] = useState<Screen>(() => (invitedRoom() ? { kind: 'setup' } : { kind: 'home' }))
  const [guideOpen, setGuideOpen] = useState(false)
  useArmadaTheme()
  const goHome = () => setScreen({ kind: 'home' })

  switch (screen.kind) {
    case 'home':
      return (
        <>
          <ArmadaHome nav={nav} onOnline={() => setScreen({ kind: 'setup' })} onGuide={() => setGuideOpen(true)} />
          <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
        </>
      )
    case 'setup':
      return (
        <Setup
          onHost={(name, preset) => setScreen({ kind: 'host', name, preset })}
          onJoin={(name, code) => setScreen({ kind: 'guest', name, code })}
          onBack={goHome}
        />
      )
    case 'host':
      return <HostGame name={screen.name} preset={screen.preset} onExit={goHome} />
    case 'guest':
      return <GuestGame name={screen.name} code={screen.code} onExit={goHome} />
  }
}
