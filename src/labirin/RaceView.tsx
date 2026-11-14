import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MusicSlot } from '../components/MusicPlayer'
import type { Maze } from './maze'
import { colorOf, MazeRenderer, type RenderPlayer } from './render'
import { DOWN, LEFT, RIGHT, UP, type Body } from './sim'
import { sfx, toggleSfx, useSfxEnabled } from './sfx'
import { TouchPad, useTouchDevice } from './TouchPad'

/**
 * Layar balapan, dipakai mode Latihan dan mode online. Komponen ini hanya membaca keyboard/joystick
 * sentuh dan menggambar; siapa yang menghitung posisi (simulasi lokal, prediksi tamu, atau host) ditentukan
 * pemanggil lewat `sample`.
 */

export interface RosterEntry {
  seat: number
  name: string
  connected: boolean
}

const KEYS: Record<string, number> = {
  ArrowUp: UP,
  ArrowDown: DOWN,
  ArrowLeft: LEFT,
  ArrowRight: RIGHT,
  w: UP,
  s: DOWN,
  a: LEFT,
  d: RIGHT,
}

export function formatTime(ms: number): string {
  const total = Math.max(0, ms) / 1000
  const minutes = Math.floor(total / 60)
  const seconds = total - minutes * 60
  return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`
}

export interface RaceViewProps {
  maze: Maze
  roster: RosterEntry[]
  /** Kursi pemain di perangkat ini (null = menonton). */
  localSeat: number | null
  /** Posisi semua pemain saat `now` (performance.now), dengan tombol arah lokal `dirs`. */
  sample: (now: number, dirs: number) => Map<number, Body>
  /** Kapan GO (performance.now); null = belum ditentukan. */
  goAt: number | null
  /** Waktu balapan berhenti di angka ini (ms) setelah selesai; null = masih berjalan. */
  finalMs: number | null
  /** Tampilkan seluruh labirin tanpa kabut (setelah selesai). */
  reveal: boolean
  /** Kursi yang sudah sampai (urutan finis). */
  finished?: number[]
  /** Status kecil di kanan atas (mis. koneksi). */
  status?: ReactNode
  /** Panel di atas kanvas (mis. hasil). */
  children?: ReactNode
  onExit: () => void
}

export function RaceView({ maze, roster, localSeat, sample, goAt, finalMs, reveal, finished = [], status, children, onExit }: RaceViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timerRef = useRef<HTMLSpanElement>(null)
  const dirsRef = useRef(0)
  /** Arah dari joystick sentuh; digabung dengan keyboard. */
  const touchRef = useRef(0)
  const touch = useTouchDevice()
  const props = useRef({ roster, localSeat, sample, goAt, finalMs, reveal, finished })
  props.current = { roster, localSeat, sample, goAt, finalMs, reveal, finished }
  const [countdown, setCountdown] = useState<string | null>(null)
  const sfxOn = useSfxEnabled()

  // Keyboard: arah ditahan = bergerak; dilepas semua saat jendela kehilangan fokus.
  useEffect(() => {
    const held = new Set<number>()
    const sync = () => (dirsRef.current = [...held].reduce((sum, bit) => sum | bit, 0))
    const down = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select')) return
      const bit = KEYS[event.key] ?? KEYS[event.key.toLowerCase()]
      if (!bit) return
      event.preventDefault()
      held.add(bit)
      sync()
    }
    const up = (event: KeyboardEvent) => {
      const bit = KEYS[event.key] ?? KEYS[event.key.toLowerCase()]
      if (!bit) return
      held.delete(bit)
      sync()
    }
    const clear = () => {
      held.clear()
      sync()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    const renderer = new MazeRenderer(maze)
    let size = { w: 1, h: 1, dpr: 1 }
    const resize = () => {
      const w = Math.max(1, wrap.clientWidth)
      const h = Math.max(1, wrap.clientHeight)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        canvas.style.width = `${w}px`
        canvas.style.height = `${h}px`
      }
      size = { w, h, dpr }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    let frame = 0
    let lastCount = ''
    const loop = (now: number) => {
      const p = props.current
      const before = p.goAt !== null && now < p.goAt
      const positions = p.sample(now, before ? 0 : dirsRef.current | touchRef.current)
      const players: RenderPlayer[] = p.roster.flatMap((entry) => {
        const at = positions.get(entry.seat)
        if (!at) return []
        return [{ seat: entry.seat, name: entry.name, x: at.x, y: at.y, local: entry.seat === p.localSeat, offline: !entry.connected, finished: p.finished.includes(entry.seat) }]
      })
      const focus = p.localSeat === null ? null : (positions.get(p.localSeat) ?? null)
      // Hanya saat pengembangan: dibaca tes browser (autopilot). Tidak ikut di build produksi.
      if (import.meta.env.DEV) (window as unknown as { __labirin?: unknown }).__labirin = { maze, positions: Object.fromEntries(positions), localSeat: p.localSeat, goAt: p.goAt, finalMs: p.finalMs, now }
      renderer.draw(ctx, size.w, size.h, size.dpr, players, focus, now / 1000, p.reveal)

      // Hitung mundur dan pewaktu ditulis langsung ke DOM (tanpa render ulang React tiap frame).
      let count = ''
      if (p.goAt !== null && p.finalMs === null) {
        const left = p.goAt - now
        if (left > 0) count = String(Math.ceil(left / 1000))
        else if (left > -800) count = 'GO!'
      }
      if (count !== lastCount) {
        if (count === 'GO!') sfx.go()
        else if (count) sfx.tick()
        lastCount = count
        setCountdown(count || null)
      }
      if (timerRef.current) {
        const ms = p.finalMs ?? (p.goAt === null ? 0 : Math.max(0, now - p.goAt))
        timerRef.current.textContent = formatTime(ms)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [maze])

  return (
    <div className="lb-race">
      <header className="lb-race__bar">
        <span className="lb-race__title">LABIRIN</span>
        <span className="lb-race__timer" ref={timerRef}>
          0:00.00
        </span>
        <ul className="lb-race__players" aria-label="Pemain">
          {roster.map((entry) => (
            <li key={entry.seat} className={entry.connected ? '' : 'is-offline'} title={entry.connected ? entry.name : `${entry.name} (terputus)`}>
              <span className="lb-dot" style={{ background: colorOf(entry.seat) }} />
              <span className="lb-race__name">{entry.seat === localSeat ? 'Kamu' : entry.name}</span>
              {finished.includes(entry.seat) && <span aria-label="sampai">🏁</span>}
            </li>
          ))}
        </ul>
        <div className="lb-race__tools">
          {status}
          <MusicSlot />
          <button type="button" className="lb-icon-btn" onClick={toggleSfx} aria-pressed={sfxOn} title={sfxOn ? 'Efek suara: nyala' : 'Efek suara: mati'}>
            {sfxOn ? '♪' : '×'}
          </button>
          <button type="button" className="lb-btn lb-btn--small" onClick={onExit}>
            Keluar
          </button>
        </div>
      </header>
      <div className="lb-race__stage" ref={wrapRef}>
        <canvas ref={canvasRef} className="lb-race__canvas" aria-label="Labirin: gerak dengan WASD, tombol panah, atau joystick sentuh" />
        {touch && localSeat !== null && finalMs === null && !finished.includes(localSeat) && <TouchPad dirsRef={touchRef} />}
        {countdown && (
          <div key={countdown} className={`lb-countdown ${countdown === 'GO!' ? 'is-go' : ''}`} aria-live="assertive">
            {countdown}
          </div>
        )}
        {children}
      </div>
      <p className="lb-race__keys" aria-hidden="true">
        {touch ? (
          <>Geser joystick di kiri bawah untuk bergerak · cari portal hijau di tengah labirin</>
        ) : (
          <>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> / <kbd>←↑→↓</kbd> bergerak · cari portal hijau di tengah labirin
          </>
        )}
      </p>
    </div>
  )
}
