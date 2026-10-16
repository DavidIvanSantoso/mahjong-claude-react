import { useEffect, useRef } from 'react'
import drawUrl from '../assets/sfx/draw tiles.mp3'
import dropUrl from '../assets/sfx/drop tiles.mp3'
import type { UnoView } from './net'

const SFX_VOLUME = 0.6
/** Jeda supaya suara ambil tidak menumpuk dengan suara kartu keluar di pembaruan yang sama. */
const DRAW_AFTER_PLAY_MS = 260

const SOUNDS = {
  draw: new Audio(drawUrl),
  play: new Audio(dropUrl),
}

function play(name: keyof typeof SOUNDS) {
  const audio = SOUNDS[name].cloneNode() as HTMLAudioElement
  audio.volume = SFX_VOLUME
  audio.play().catch(() => {})
}

/** Efek suara meja (memakai suara yang sama dengan mahjong): kartu dikeluarkan dan kartu diambil. */
export function useUnoSfx(view: UnoView) {
  const previous = useRef<UnoView | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = view
    if (!before || before === view) return

    const played = view.top.id !== before.top.id
    const total = (v: UnoView) => v.players.reduce((sum, player) => sum + player.count, 0)
    // Kartu di tangan semua pemain bertambah berarti ada yang mengambil (tumpukan bisa dikocok ulang).
    const drew = total(view) > total(before) - (played ? 1 : 0)

    if (played) play('play')
    if (!drew) return
    if (!played) {
      play('draw')
      return
    }
    const timer = setTimeout(() => play('draw'), DRAW_AFTER_PLAY_MS)
    return () => clearTimeout(timer)
  }, [view])
}
