import { useEffect, useRef } from 'react'
import drawUrl from '../assets/sfx/draw tiles.mp3'
import dropUrl from '../assets/sfx/drop tiles.mp3'
import type { GameState } from '../game/state'

const SFX_VOLUME = 0.7
/** Jeda supaya suara ambil tidak menumpuk dengan suara buang yang datang di pembaruan yang sama. */
const DRAW_AFTER_DROP_MS = 280

const SOUNDS = {
  draw: new Audio(drawUrl),
  drop: new Audio(dropUrl),
}

function play(name: keyof typeof SOUNDS) {
  // Salinan baru tiap kali, supaya suara yang sama bisa berbunyi beruntun tanpa saling memotong.
  const audio = SOUNDS[name].cloneNode() as HTMLAudioElement
  audio.volume = SFX_VOLUME
  // Browser menolak suara sebelum ada interaksi dengan halaman; efek suara cukup dilewati.
  audio.play().catch(() => {})
}

/**
 * Efek suara meja, dibunyikan dari perubahan state sehingga berlaku untuk semua pemain
 * (termasuk lawan di mode online): ubin diambil dari dinding, dan ubin dibuang.
 */
export function useGameSfx(state: GameState) {
  const previous = useRef<GameState | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = state
    if (!before || before === state) return

    const dropped = state.lastDiscard !== null && state.lastDiscard.tile.id !== before.lastDiscard?.tile.id
    // Dinding berkurang berarti ada yang mengambil; di ronde baru dinding justru bertambah.
    const drew = state.wall.length < before.wall.length

    if (dropped) play('drop')
    if (!drew) return
    if (!dropped) {
      play('draw')
      return
    }
    // Mode online: buangan pemain dan ambilan pemain berikutnya tiba sekaligus.
    const timer = setTimeout(() => play('draw'), DRAW_AFTER_DROP_MS)
    return () => clearTimeout(timer)
  }, [state])
}
