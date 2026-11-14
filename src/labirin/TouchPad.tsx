import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { DOWN, LEFT, RIGHT, UP } from './sim'

/**
 * Joystick sentuh untuk layar HP/tablet. Arah ditulis ke `dirsRef` (bit UP/DOWN/LEFT/RIGHT yang sama
 * dengan keyboard), jadi simulasi dan jaringan tidak tahu bedanya keyboard atau sentuhan.
 *
 * 8 arah: lurus kalau jari dekat sumbu, diagonal di antaranya. Diagonal berguna di labirin: "terus ke
 * kanan, belok ke atas di persimpangan berikut" (bantuan sudut di sim.ts yang mengurus beloknya).
 */

/** Jari di dalam lingkaran ini (pecahan radius) = diam. */
const DEAD_ZONE = 0.22
/** Di bawah rasio ini komponen sumbu kedua diabaikan (≈ 27°): arah lurus lebih mudah dipegang. */
const AXIS_RATIO = 0.5

export function dirsFrom(dx: number, dy: number, radius: number): number {
  if (Math.hypot(dx, dy) < radius * DEAD_ZONE) return 0
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  let dirs = 0
  if (ax >= ay * AXIS_RATIO) dirs |= dx > 0 ? RIGHT : LEFT
  if (ay >= ax * AXIS_RATIO) dirs |= dy > 0 ? DOWN : UP
  return dirs
}

/** True kalau perangkat punya layar sentuh, atau begitu pengguna menyentuh layar. */
export function useTouchDevice(): boolean {
  const [touch, setTouch] = useState(() => typeof window !== 'undefined' && window.matchMedia('(any-pointer: coarse)').matches)
  useEffect(() => {
    if (touch) return
    const seen = (event: PointerEvent) => event.pointerType === 'touch' && setTouch(true)
    window.addEventListener('pointerdown', seen)
    return () => window.removeEventListener('pointerdown', seen)
  }, [touch])
  return touch
}

export function TouchPad({ dirsRef }: { dirsRef: MutableRefObject<number> }) {
  const padRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const pad = padRef.current!
    let pointer: number | null = null
    // Posisi kenop dan arah aktif ditulis langsung ke DOM (tanpa render ulang React tiap gerakan jari).
    const show = (x: number, y: number, dirs: number) => {
      pad.style.setProperty('--knob-x', `${x}px`)
      pad.style.setProperty('--knob-y', `${y}px`)
      pad.dataset.up = String(Boolean(dirs & UP))
      pad.dataset.down = String(Boolean(dirs & DOWN))
      pad.dataset.left = String(Boolean(dirs & LEFT))
      pad.dataset.right = String(Boolean(dirs & RIGHT))
    }
    const aim = (event: PointerEvent) => {
      const box = pad.getBoundingClientRect()
      const radius = box.width / 2
      const dx = event.clientX - (box.left + radius)
      const dy = event.clientY - (box.top + radius)
      const dirs = dirsFrom(dx, dy, radius)
      dirsRef.current = dirs
      // Kenop mengikuti jari, dibatasi di dalam lingkaran.
      const reach = radius * 0.55
      const length = Math.hypot(dx, dy)
      const k = length > reach ? reach / length : 1
      show(dx * k, dy * k, dirs)
    }
    const release = () => {
      pointer = null
      dirsRef.current = 0
      pad.classList.remove('is-active')
      show(0, 0, 0)
    }
    const down = (event: PointerEvent) => {
      if (pointer !== null) return
      event.preventDefault()
      pointer = event.pointerId
      pad.setPointerCapture(event.pointerId)
      pad.classList.add('is-active')
      aim(event)
    }
    const move = (event: PointerEvent) => {
      if (event.pointerId === pointer) aim(event)
    }
    const up = (event: PointerEvent) => {
      if (event.pointerId === pointer) release()
    }
    pad.addEventListener('pointerdown', down)
    pad.addEventListener('pointermove', move)
    pad.addEventListener('pointerup', up)
    pad.addEventListener('pointercancel', up)
    pad.addEventListener('lostpointercapture', up)
    window.addEventListener('blur', release)
    return () => {
      pad.removeEventListener('pointerdown', down)
      pad.removeEventListener('pointermove', move)
      pad.removeEventListener('pointerup', up)
      pad.removeEventListener('pointercancel', up)
      pad.removeEventListener('lostpointercapture', up)
      window.removeEventListener('blur', release)
      dirsRef.current = 0
    }
  }, [dirsRef])

  return (
    <div ref={padRef} className="lb-pad" role="presentation" aria-hidden="true" onContextMenu={(event) => event.preventDefault()}>
      <span className="lb-pad__arrow lb-pad__arrow--up" />
      <span className="lb-pad__arrow lb-pad__arrow--right" />
      <span className="lb-pad__arrow lb-pad__arrow--down" />
      <span className="lb-pad__arrow lb-pad__arrow--left" />
      <span className="lb-pad__knob" />
    </div>
  )
}
