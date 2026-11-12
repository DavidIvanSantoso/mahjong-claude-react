import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { WORLD } from './config'
import { createGame, release, summary, typeKey, update, fireSonar, type GameState, type Summary } from './engine'
import { render } from './render'
import { playEvents, toggleSfx, useSfxEnabled } from './sfx'

/** Jeda setelah hati habis sebelum ringkasan muncul, supaya ledakan terakhir sempat terlihat. */
const OVER_DELAY_MS = 1300

/** Mencegah tombol mencuri fokus dari input tersembunyi (kalau fokus hilang, game dijeda). */
const keepFocus = (event: PointerEvent) => event.preventDefault()

/**
 * Kanvas permainan. Loop `requestAnimationFrame` memperbarui mesin (engine.ts) lalu menggambar
 * (render.ts). Ketikan ditangkap oleh input tersembunyi, supaya keyboard virtual di HP juga muncul.
 */
export function PalungGame({ onOver, onExit, frozen }: { onOver: (result: Summary) => void; onExit: () => void; frozen: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const gameRef = useRef<GameState | null>(null)
  const pausedRef = useRef(false)
  const onOverRef = useRef(onOver)
  const [paused, setPaused] = useState(false)
  const sfxOn = useSfxEnabled()

  useEffect(() => {
    onOverRef.current = onOver
  }, [onOver])

  function pause(on: boolean) {
    if (gameRef.current?.over) return
    pausedRef.current = on
    setPaused(on)
    if (!on) inputRef.current?.focus()
  }

  useEffect(() => {
    const wrap = wrapRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const game = createGame(WORLD.maxWidth)
    gameRef.current = game
    // Hanya saat pengembangan: state bisa dibaca dari konsol / tes browser. Tidak ikut di build produksi.
    if (import.meta.env.DEV) (window as unknown as { __palung?: GameState }).__palung = game
    let scale = 1

    // Lebar dunia mengikuti rasio layar (tinggi tetap), lalu kanvas diperbesar agar pas di wadahnya.
    function resize() {
      const rect = wrap.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const width = Math.max(WORLD.minWidth, Math.min(WORLD.maxWidth, (rect.width / rect.height) * WORLD.height))
      const css = Math.min(rect.width / width, rect.height / WORLD.height)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.style.width = `${Math.floor(width * css)}px`
      canvas.style.height = `${Math.floor(WORLD.height * css)}px`
      canvas.width = Math.floor(width * css * dpr)
      canvas.height = Math.floor(WORLD.height * css * dpr)
      scale = css * dpr
      game.width = width
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    let last = performance.now()
    let reported = false
    let frame = 0
    const loop = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      if (!pausedRef.current) update(game, dt)
      playEvents(game.events)
      game.events = []
      render(ctx, game, scale, now / 1000)
      if (game.over && !reported) {
        reported = true
        setTimeout(() => onOverRef.current(summary(game)), OVER_DELAY_MS)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    // Pindah tab: otomatis dijeda.
    const onHidden = () => {
      if (document.hidden && !game.over) {
        pausedRef.current = true
        setPaused(true)
      }
    }
    document.addEventListener('visibilitychange', onHidden)
    inputRef.current?.focus()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [])

  /** Menjalankan aksi lalu langsung memutar suaranya (tidak menunggu frame berikutnya). */
  function act(run: (game: GameState) => void) {
    const game = gameRef.current
    if (!game || pausedRef.current) return
    run(game)
    playEvents(game.events)
    game.events = []
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'Escape') {
      event.preventDefault()
      pause(!pausedRef.current)
      return
    }
    if (event.key === 'Backspace') {
      event.preventDefault()
      act(release)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      act(fireSonar)
    } else if (event.key === ' ') {
      event.preventDefault()
    } else if (event.key.length === 1) {
      // Keyboard fisik: huruf diproses di sini. Keyboard virtual HP sering mengirim "Unidentified"
      // dan ditangani lewat onInput.
      event.preventDefault()
      act((game) => typeKey(game, event.key))
    }
  }

  function onInput(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const text = input.value
    input.value = ''
    act((game) => [...text].forEach((char) => typeKey(game, char)))
  }

  function onBlur() {
    // Klik di luar area permainan: dijeda supaya ketikan tidak hilang tanpa disadari.
    if (!frozen && !gameRef.current?.over) pause(true)
  }

  return (
    <div className="pl-game">
      <header className="pl-topbar">
        <span className="pl-topbar__title">PALUNG</span>
        <div className="pl-topbar__tools">
          <button type="button" className="pl-icon-btn" onPointerDown={keepFocus} onClick={() => pause(!paused)} disabled={frozen} aria-label="Jeda" title="Jeda (Esc)">
            ❚❚
          </button>
          <button
            type="button"
            className="pl-icon-btn"
            onPointerDown={keepFocus}
            onClick={toggleSfx}
            aria-pressed={sfxOn}
            aria-label={sfxOn ? 'Matikan efek suara' : 'Nyalakan efek suara'}
            title={sfxOn ? 'Efek suara: nyala' : 'Efek suara: mati'}
          >
            {sfxOn ? '♪' : '×'}
          </button>
          <button type="button" className="pl-btn pl-btn--small" onClick={onExit}>
            Keluar
          </button>
        </div>
      </header>

      <div
        ref={wrapRef}
        className="pl-stage"
        onPointerDown={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <canvas ref={canvasRef} className="pl-canvas" aria-label="Arena PALUNG: ketik kata di atas ikan untuk mengalahkannya" />
        <input
          ref={inputRef}
          className="pl-input"
          type="text"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          aria-label="Ketik di sini"
          onKeyDown={onKeyDown}
          onInput={onInput}
          onBlur={onBlur}
        />
        {paused && !frozen && (
          <div className="pl-overlay" onPointerDown={(event) => event.stopPropagation()}>
            <div className="pl-panel pl-pause">
              <h2 className="pl-panel__title">Jeda</h2>
              <p className="pl-muted">Tekan Esc atau tombol di bawah untuk lanjut menyelam.</p>
              <button type="button" className="pl-btn pl-btn--primary" onClick={() => pause(false)}>
                Lanjut
              </button>
              <button type="button" className="pl-btn" onClick={onExit}>
                Keluar ke menu
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="pl-keys" aria-hidden="true">
        <kbd>a–z</kbd> ketik · <kbd>Backspace</kbd> lepas target · <kbd>Enter</kbd> Sonar · <kbd>Esc</kbd> jeda
      </p>
    </div>
  )
}
