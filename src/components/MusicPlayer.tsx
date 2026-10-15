import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n'

/** Semua file musik di src/assets/music ikut dibundel dan jadi daftar putar (lihat README di sana). */
const TRACK_URLS = import.meta.glob<string>('../assets/music/*.{mp3,ogg,wav,m4a,aac,flac,webm}', {
  eager: true,
  query: '?url',
  import: 'default',
})

const TRACKS = Object.entries(TRACK_URLS)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    // "…/01-Artis - Judul_Lagu.mp3" → "Artis - Judul Lagu"
    title: (path.split('/').pop() ?? '')
      .replace(/\.[^.]+$/, '')
      .replace(/^\d+[\s._-]*/, '')
      .replace(/_+/g, ' '),
  }))

const STORAGE_KEY = 'mahjong-music'
const DEFAULT_VOLUME = 0.4

interface Settings {
  playing: boolean
  volume: number
}

/** Pilihan putar/jeda dan volume yang terakhir dipakai di perangkat ini. */
function savedSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return {
      playing: saved.playing !== false,
      volume: typeof saved.volume === 'number' ? Math.min(1, Math.max(0, saved.volume)) : DEFAULT_VOLUME,
    }
  } catch {
    return { playing: true, volume: DEFAULT_VOLUME }
  }
}

const ICONS = {
  note: 'M6 13V3l8-2v10a2.5 2.5 0 1 1-1.5-2.29V4.3l-5 1.25V13a2.5 2.5 0 1 1-1.5-2.29Z',
  play: 'M4 2.5v11l9-5.5-9-5.5Z',
  pause: 'M3.5 2.5h3v11h-3v-11Zm6 0h3v11h-3v-11Z',
  next: 'M3 2.5v11l7-5.5-7-5.5Zm8 0h2v11h-2v-11Z',
}

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  )
}

/**
 * Pemutar musik latar: tombol not yang membuka panel putar/jeda dan volume.
 * Dipasang sekali (lewat MusicProvider), jadi musik tidak terputus saat berpindah layar.
 * Tombolnya melayang di pojok kiri bawah, kecuali layar yang tampil menyediakan tempat
 * sendiri lewat <MusicSlot /> (`slot`); elemen <audio>-nya tidak ikut berpindah.
 */
function MusicPlayer({ slot }: { slot: HTMLElement | null }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [settings, setSettings] = useState(savedSettings)
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const { playing, volume } = settings
  const track = TRACKS[index]

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // localStorage bisa diblokir; pilihannya tetap berlaku selama halaman terbuka.
    }
  }

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!playing) {
      audio.pause()
      return
    }
    // Browser menolak memutar suara sebelum pengguna berinteraksi dengan halaman,
    // jadi kalau ditolak, musik dimulai pada klik atau tombol pertama.
    const start = () => {
      audio.play().catch(() => {})
      removeListeners()
    }
    const removeListeners = () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
    }
    let cancelled = false
    audio.play().catch(() => {
      if (cancelled) return
      window.addEventListener('pointerdown', start)
      window.addEventListener('keydown', start)
    })
    return () => {
      cancelled = true
      removeListeners()
    }
  }, [playing, index])

  // Panel menutup lewat Esc atau ketukan di luarnya.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Folder musik masih kosong.
  if (!track) return null

  const nextTrack = () => setIndex((index + 1) % TRACKS.length)
  const percent = Math.round(volume * 100)

  const controls = (
    <div className={`music-player ${slot ? 'music-player--inline' : ''}`} ref={rootRef}>
      {open && (
        <div className="card music-player__panel" role="group" aria-label={t('Musik latar', 'Background music')}>
          <p className="music-player__title" title={track.title}>
            {track.title}
          </p>
          <div className="music-player__controls">
            <button
              type="button"
              className="music-player__icon-btn"
              aria-label={playing ? t('Jeda musik', 'Pause music') : t('Putar musik', 'Play music')}
              onClick={() => update({ playing: !playing })}
            >
              <Icon name={playing ? 'pause' : 'play'} />
            </button>
            {TRACKS.length > 1 && (
              <button
                type="button"
                className="music-player__icon-btn"
                aria-label={t('Lagu berikutnya', 'Next track')}
                onClick={nextTrack}
              >
                <Icon name="next" />
              </button>
            )}
            <input
              type="range"
              className="music-player__volume"
              min={0}
              max={100}
              value={percent}
              aria-label={t('Volume musik', 'Music volume')}
              onChange={(event) => update({ volume: Number(event.target.value) / 100 })}
            />
            <span className="music-player__percent">{percent}%</span>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`${slot ? 'icon-btn' : 'music-player__toggle'} ${playing ? '' : 'music-player__toggle--paused'}`}
        aria-label={t('Musik latar', 'Background music')}
        title={t('Musik latar', 'Background music')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name="note" />
      </button>
    </div>
  )

  return (
    <>
      {/* Satu lagu diulang terus; beberapa lagu diputar bergantian. */}
      <audio ref={audioRef} src={track.url} loop={TRACKS.length === 1} onEnded={nextTrack} />
      {slot ? createPortal(controls, slot) : controls}
    </>
  )
}

const SlotContext = createContext<(slot: HTMLElement | null) => void>(() => {})

/** Membungkus seluruh aplikasi: memasang pemutar musik dan mencatat tempat tombolnya. */
export function MusicProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  return (
    <SlotContext.Provider value={setSlot}>
      {children}
      <MusicPlayer slot={slot} />
    </SlotContext.Provider>
  )
}

/** Tempat tombol musik di dalam tata letak layar; selama ini terpasang, tombolnya tidak melayang. */
export function MusicSlot() {
  return <div className="music-slot" ref={useContext(SlotContext)} />
}
