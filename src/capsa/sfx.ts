import { useEffect, useRef } from 'react'
import drawUrl from '../assets/sfx/draw tiles.mp3'
import dropUrl from '../assets/sfx/drop tiles.mp3'
import type { CapsaView } from './net'

const SFX_VOLUME = 0.6

const SOUNDS = {
  deal: new Audio(drawUrl),
  play: new Audio(dropUrl),
}

function play(name: keyof typeof SOUNDS) {
  const audio = SOUNDS[name].cloneNode() as HTMLAudioElement
  audio.volume = SFX_VOLUME
  audio.play().catch(() => {})
}

/** Efek suara meja (suara yang sama dengan mahjong dan UNO): kartu dikeluarkan, dan kartu dibagikan. */
export function useCapsaSfx(view: CapsaView) {
  const previous = useRef<CapsaView | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = view
    if (!before || before === view) return
    const total = (v: CapsaView) => v.players.reduce((sum, player) => sum + player.count, 0)
    // Kartu di tangan bertambah berarti ronde baru dibagikan; berkurang berarti ada yang mengeluarkan kartu.
    if (total(view) > total(before)) play('deal')
    else if (total(view) < total(before)) play('play')
  }, [view])
}
