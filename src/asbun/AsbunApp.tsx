import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import asbunFavicon from '../assets/asbun-favicon.svg'
import { CODE_LENGTH, normalizeCode, type RoomError } from '../net/online'
import { GuideDialog } from './AsbunDialogs'
import { AsbunHome, INSPIRED_BY } from './AsbunHome'
import { AsbunLobby } from './AsbunLobby'
import { AsbunTable } from './AsbunTable'
import { useAsbunGuestRoom, useAsbunHostRoom, type AsbunRoom } from './net'
import { MAX_PLAYERS, MIN_PLAYERS } from './roles'

type Screen =
  | { kind: 'home' }
  | { kind: 'create' }
  | { kind: 'join' }
  | { kind: 'host'; name: string }
  | { kind: 'guest'; name: string; code: string }

/** Kode room dari link undangan (?game=asbun&room=KODE). */
function invitedRoom(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('game') === 'asbun' ? normalizeCode(params.get('room') ?? '') : ''
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
      return 'Room sudah penuh.'
    case 'host-lost':
      return 'Koneksi ke host terputus. Permainan tidak bisa dilanjutkan tanpa host; minta host membuat room baru.'
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
  mode,
  onHost,
  onJoin,
  onBack,
}: {
  mode: 'create' | 'join'
  onHost: (name: string) => void
  onJoin: (name: string, code: string) => void
  onBack: () => void
}) {
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
    <main className="as-page">
      <form className="as-card as-setup" onSubmit={submit}>
        <button type="button" className="as-link as-setup__back" onClick={onBack}>
          ← Kembali
        </button>
        <p className="as-eyebrow">{joining ? 'Gabung ke penyelidikan' : 'Buka berkas kasus baru'}</p>
        <h1 className="as-title">{joining ? 'Gabung Room' : 'Buat Room'}</h1>
        <p className="as-muted">
          {MIN_PLAYERS}–{MAX_PLAYERS} pemain, tiap pemain di perangkatnya sendiri.
        </p>

        <label className="as-field">
          <span>Nama kamu</span>
          <input type="text" maxLength={16} placeholder="Nama" value={name} autoFocus onChange={(event) => setName(event.target.value)} />
        </label>

        {joining && (
          <label className="as-field">
            <span>Kode room</span>
            <input
              type="text"
              className="as-code-input"
              placeholder="KODE"
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              onChange={(event) => setCode(normalizeCode(event.target.value))}
            />
          </label>
        )}

        <button type="submit" className="as-btn as-btn--primary" disabled={!name.trim() || (joining && code.length !== CODE_LENGTH)}>
          {joining ? 'Gabung' : 'Buat Room'}
        </button>
        {!name.trim() && <p className="as-hint">Isi nama dulu supaya pemain lain mengenalimu.</p>}
      </form>
    </main>
  )
}

function RoomView({ room, onExit }: { room: AsbunRoom; onExit: () => void }) {
  if (room.status === 'error') {
    return (
      <main className="as-page">
        <div className="as-card as-setup" role="alert">
          <p className="as-eyebrow">Sambungan terputus</p>
          <h1 className="as-title">Tidak terhubung</h1>
          <p>{errorMessage(room.error)}</p>
          {room.error?.code === 'unreachable' && room.error.detail && <p className="as-hint">Detail teknis: {room.error.detail}</p>}
          {!room.isHost && (
            <button type="button" className="as-btn as-btn--primary" onClick={room.retry}>
              Coba lagi
            </button>
          )}
          <button type="button" className="as-btn" onClick={onExit}>
            Kembali ke menu
          </button>
        </div>
      </main>
    )
  }
  if (room.status === 'connecting') {
    return (
      <main className="as-page">
        <div className="as-card as-setup" aria-live="polite">
          <p className="as-eyebrow">Menghubungkan</p>
          <h1 className="as-title">{room.isHost ? 'Membuka room…' : `Mencari room ${room.code}…`}</h1>
          <button type="button" className="as-btn" onClick={onExit}>
            Batal
          </button>
        </div>
      </main>
    )
  }
  if (room.view) return <AsbunTable room={room} onExit={onExit} />
  return <AsbunLobby room={room} onExit={onExit} />
}

function HostGame({ name, onExit }: { name: string; onExit: () => void }) {
  return <RoomView room={useAsbunHostRoom(name)} onExit={onExit} />
}

function GuestGame({ name, code, onExit }: { name: string; code: string; onExit: () => void }) {
  return <RoomView room={useAsbunGuestRoom(code, name)} onExit={onExit} />
}

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Allura&family=Cormorant+Garamond:ital,wght@0,500;0,700;1,500&family=DM+Sans:wght@400;500;700&display=swap'

/**
 * Memasang tema ASBUN (lihat asbun.css, `:root[data-game='asbun']`), font, judul tab, dan ikon tab
 * selama layar ASBUN terbuka; semuanya dikembalikan saat pindah game.
 */
function useAsbunTheme() {
  useEffect(() => {
    const root = document.documentElement
    const title = document.title
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const previousIcon = icon?.getAttribute('href') ?? null
    root.dataset.game = 'asbun'
    document.title = 'ASBUN - A Game of Deception'
    icon?.setAttribute('href', asbunFavicon)
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

export function AsbunApp({ nav }: { nav: ReactNode }) {
  const [screen, setScreen] = useState<Screen>(() => (invitedRoom() ? { kind: 'join' } : { kind: 'home' }))
  const [guideOpen, setGuideOpen] = useState(false)
  useAsbunTheme()
  const goHome = () => setScreen({ kind: 'home' })

  return (
    <>
      {screenContent()}
      {/* Tepi kiri layar desktop; disembunyikan di layar sempit (lihat .as-credit di asbun.css). */}
      <p className="as-credit">{INSPIRED_BY}</p>
    </>
  )

  function screenContent() {
    switch (screen.kind) {
      case 'home':
        return (
          <>
            <AsbunHome
              nav={nav}
              onCreate={() => setScreen({ kind: 'create' })}
              onJoin={() => setScreen({ kind: 'join' })}
              onGuide={() => setGuideOpen(true)}
            />
            <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
          </>
        )
      case 'create':
      case 'join':
        return (
          <Setup
            mode={screen.kind}
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
}
