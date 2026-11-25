import { useEffect, useRef, useState } from 'react'
import { WORLD } from './config'
import { createGame, dash, draw, releaseInput, setInput, summary, update, type Direction, type GameState, type Summary } from './engine'
import { render } from './render'
import { getSettings } from './settings'
import { playEvents } from './sfx'
import type { Mode } from './state'

/** Jeda setelah kalah/menang sebelum poster hasil muncul, supaya akhir permainan sempat terlihat. */
const OVER_DELAY_MS = 1400

const KEYS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
}

/**
 * Layar permainan: kanvas + loop `requestAnimationFrame` (engine.ts lalu render.ts). React hanya
 * menyimpan status jeda; state permainan ada di `gameRef` dan diubah langsung tiap frame.
 */
export function KoboiGame({ mode, onOver, onExit, onSettings, settingsOpen }: { mode: Mode; onOver: (result: Summary) => void; onExit: () => void; onSettings: () => void; settingsOpen: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<GameState | null>(null)
  const pausedRef = useRef(false)
  const onOverRef = useRef(onOver)
  const [paused, setPaused] = useState(false)
  const [run, setRun] = useState(0)

  useEffect(() => {
    onOverRef.current = onOver
  }, [onOver])

  // Dialog pengaturan dibuka dari menu jeda: permainan tetap berhenti selama dialog terbuka.
  useEffect(() => {
    pausedRef.current = paused || settingsOpen
  }, [paused, settingsOpen])

  function pause(on: boolean) {
    const game = gameRef.current
    if (!game || game.over) return
    releaseInput(game)
    pausedRef.current = on
    setPaused(on)
  }

  useEffect(() => {
    const wrap = wrapRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const game = createGame(mode, getSettings().dash)
    gameRef.current = game
    pausedRef.current = false
    // Hanya saat pengembangan: state bisa dibaca dari konsol / tes browser. Tidak ikut di build produksi.
    if (import.meta.env.DEV) (window as unknown as { __koboi?: GameState }).__koboi = game
    let scale = 1

    // Dunia 800 × 540 diperbesar agar pas di wadah (letterbox). Ukuran diambil dari area isi tanpa padding,
    // dan kanvas hanya diubah bila ukurannya benar-benar berubah (lihat catatan di PalungGame.tsx).
    function resize() {
      const style = getComputedStyle(wrap)
      const boxW = wrap.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const boxH = wrap.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      if (boxW <= 0 || boxH <= 0) return
      const css = Math.min(boxW / WORLD.width, boxH / WORLD.height)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cssW = Math.floor(WORLD.width * css)
      const cssH = Math.floor(WORLD.height * css)
      scale = css * dpr
      if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
        canvas.style.width = `${cssW}px`
        canvas.style.height = `${cssH}px`
        canvas.width = Math.floor(cssW * dpr)
        canvas.height = Math.floor(cssH * dpr)
        render(ctx, game, scale, performance.now() / 1000, getSettings())
      }
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
      render(ctx, game, scale, now / 1000, getSettings())
      if (game.over && !reported) {
        reported = true
        setTimeout(() => onOverRef.current(summary(game)), OVER_DELAY_MS)
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    const act = (fn: (g: GameState) => void) => {
      if (pausedRef.current) return
      fn(game)
      playEvents(game.events)
      game.events = []
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      // Setelah selesai, keyboard milik tombol poster hasil (Main lagi / Menu utama).
      if (game.over) return
      if ((event.target as HTMLElement | null)?.closest('input, select, textarea, dialog')) return
      const direction = KEYS[event.key] ?? KEYS[event.key.toLowerCase()]
      if (direction) {
        event.preventDefault()
        if (!pausedRef.current) setInput(game, direction, true)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        pause(!pausedRef.current)
        return
      }
      if (event.key === ' ' || event.key === 'Shift' || event.key === 'Enter') {
        // Tombol menu yang sedang difokus tetap boleh menerima Enter/Spasi saat dijeda.
        if (pausedRef.current) return
        event.preventDefault()
        if (event.repeat) return
        act((g) => (g.phase === 'duel' ? draw(g) : event.key !== 'Enter' && dash(g)))
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const direction = KEYS[event.key] ?? KEYS[event.key.toLowerCase()]
      if (direction) setInput(game, direction, false)
    }
    // Jendela kehilangan fokus / pindah tab: tombol dilepas dan permainan dijeda.
    const onBlur = () => {
      releaseInput(game)
      if (!game.over) pause(true)
    }
    const onHidden = () => document.hidden && onBlur()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onHidden)
    }
    // `run` berubah = mulai ulang dari awal dengan state baru.
  }, [mode, run])

  function restart() {
    setPaused(false)
    setRun((r) => r + 1)
  }

  return (
    <div className="kb-game">
      <header className="kb-topbar">
        <span className="kb-topbar__title">KOBOI</span>
        <span className="kb-topbar__mode">{mode === 'boss' ? 'Duel Bos' : 'Bertahan'}</span>
        <div className="kb-topbar__tools">
          <button type="button" className="kb-icon-btn" onClick={() => pause(!paused)} aria-label="Jeda" title="Jeda (Esc)">
            ❚❚
          </button>
          <button type="button" className="kb-btn kb-btn--small" onClick={onExit}>
            Keluar
          </button>
        </div>
      </header>
      <div
        ref={wrapRef}
        className="kb-stage"
        onPointerDown={() => {
          // Klik/ketuk saat duel cepat = menembak.
          const game = gameRef.current
          if (game && game.phase === 'duel' && !pausedRef.current) {
            draw(game)
            playEvents(game.events)
            game.events = []
          }
        }}
      >
        <canvas ref={canvasRef} className="kb-canvas" aria-label="Arena KOBOI: gerakkan jiwa untuk menghindari peluru dan jebakan" />
        {paused && !settingsOpen && (
          <div className="kb-overlay" role="dialog" aria-modal="true" aria-labelledby="kb-pause-title">
            <div className="kb-panel kb-pause">
              <h2 id="kb-pause-title" className="kb-panel__title">
                Jeda
              </h2>
              <button type="button" className="kb-btn kb-btn--primary" autoFocus onClick={() => pause(false)}>
                Lanjut
              </button>
              <button type="button" className="kb-btn" onClick={restart}>
                Ulangi dari awal
              </button>
              <button type="button" className="kb-btn" onClick={onSettings}>
                Pengaturan
              </button>
              <button type="button" className="kb-btn" onClick={onExit}>
                Menu utama
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="kb-keys" aria-hidden="true">
        <kbd>WASD</kbd>/<kbd>←↑→↓</kbd> gerak · <kbd>Spasi</kbd>/<kbd>Shift</kbd> dash · <kbd>Esc</kbd> jeda{mode === 'boss' && <> · duel: <kbd>Spasi</kbd>/<kbd>Enter</kbd>/klik saat "TEMBAK!"</>}
      </p>
    </div>
  )
}
