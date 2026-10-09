import gsap from 'gsap'
import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { createWall, isFlower, shuffle } from '../game/tiles'
import { TileView } from './TileView'

/** Lama ubin terbuka setelah diketuk di layar sentuh. */
const TOUCH_HOLD_S = 1.2
/** Flip acak tanpa interaksi: jeda antar-flip, lama terbuka, dan batas ubin terbuka sekaligus. */
const AMBIENT_DELAY_S: [number, number] = [1.2, 2.4]
const AMBIENT_HOLD_S = 1.8
const MAX_OPEN = 2
/** Flip acak baru dimulai setelah animasi masuk selesai. */
const AMBIENT_START_S = 1.8

interface TileFieldProps {
  cols: number
  rows: number
  /** Kelas pembungkus; posisi, ukuran, dan putaran tumpukan diatur dari CSS halaman pemakai. */
  className?: string
  /** Kelas tambahan per ubin, misalnya untuk mengosongkan baris tertentu di CSS. */
  tileClassName?: (row: number, col: number) => string
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Ubin yang benar-benar terlihat: tidak disembunyikan CSS dan berada di dalam area `field`. */
function isVisibleIn(tile: HTMLElement, field: HTMLElement): boolean {
  if (getComputedStyle(tile).visibility === 'hidden') return false
  const t = tile.getBoundingClientRect()
  const f = field.getBoundingClientRect()
  const x = t.left + t.width / 2
  const y = t.top + t.height / 2
  const inField = x > f.left && x < f.right && y > f.top && y < f.bottom
  return inField && x > 0 && y > 0 && x < window.innerWidth && y < window.innerHeight
}

/**
 * Tumpukan ubin hiasan bersusun bata (baris selang-seling digeser setengah ubin).
 * Ubin berbalik saat di-hover atau diketuk, ubin acak berbalik sendiri sesekali,
 * dan semuanya jatuh masuk saat pertama tampil. Semua animasi memakai GSAP.
 */
export function TileField({ cols, rows, className = '', tileClassName }: TileFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const ctxRef = useRef<gsap.Context | null>(null)
  /** Ubin yang sedang terbuka, baik karena disentuh pengguna maupun flip acak. */
  const openRef = useRef(new Set<HTMLElement>())
  // Muka ubin acak yang terlihat saat dibalik; bunga dilewati supaya variasinya ubin biasa.
  const [faces] = useState(() =>
    shuffle(createWall().filter((tile) => !isFlower(tile))).slice(0, cols * rows),
  )

  function flip(tile: HTMLElement, showFace: boolean) {
    if (showFace) openRef.current.add(tile)
    else openRef.current.delete(tile)

    const reduced = prefersReducedMotion()
    ctxRef.current?.add(() => {
      gsap.to(tile.querySelector('.htile__inner'), {
        rotateY: showFace ? 180 : 0,
        duration: reduced ? 0 : 0.6,
        ease: showFace ? 'back.out(1.6)' : 'power2.inOut',
        overwrite: true,
      })
      if (!reduced) {
        // Terangkat sedikit ke arah atas ubin (kanan atas di layar kalau tumpukannya diputar).
        gsap.to(tile, { y: showFace ? -14 : 0, duration: 0.35, ease: 'power2.out', overwrite: true })
      }
    })
  }

  /** Membuka satu ubin acak sebentar, kecuali sudah ada MAX_OPEN ubin yang terbuka. */
  function flipRandomTile() {
    const root = rootRef.current
    if (!root || openRef.current.size >= MAX_OPEN) return
    const candidates = [...root.querySelectorAll<HTMLElement>('.htile')].filter(
      (tile) => !openRef.current.has(tile) && isVisibleIn(tile, root),
    )
    if (candidates.length === 0) return
    const tile = candidates[Math.floor(Math.random() * candidates.length)]
    flip(tile, true)
    ctxRef.current?.add(() =>
      gsap.delayedCall(AMBIENT_HOLD_S, () => {
        // Jangan menutup ubin yang sedang ditunjuk kursor.
        if (!tile.matches(':hover')) flip(tile, false)
      }),
    )
  }

  useLayoutEffect(() => {
    const reduced = prefersReducedMotion()
    // gsap.context mengumpulkan semua animasi supaya bisa dibatalkan bersih saat unmount.
    const ctx = gsap.context(() => {
      if (reduced) return
      gsap.from('.htile', {
        y: -80,
        opacity: 0,
        duration: 0.7,
        ease: 'back.out(1.7)',
        stagger: { each: 0.025, from: 'end' },
      })
    }, rootRef)
    ctxRef.current = ctx

    // Flip acak berantai: tiap jadwal membuat jadwal berikutnya dengan jeda acak.
    const scheduleAmbient = (delay: number) => {
      ctx.add(() =>
        gsap.delayedCall(delay, () => {
          flipRandomTile()
          scheduleAmbient(gsap.utils.random(...AMBIENT_DELAY_S))
        }),
      )
    }
    if (!reduced) scheduleAmbient(AMBIENT_START_S)

    const open = openRef.current
    return () => {
      ctx.revert()
      open.clear()
    }
    // flipRandomTile hanya membaca ref, jadi aman dipakai dari efek yang berjalan sekali.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleEnter(event: PointerEvent<HTMLDivElement>) {
    const tile = event.currentTarget
    flip(tile, true)
    // Di layar sentuh tidak ada "hover keluar", jadi ubin ditutup lagi sendiri.
    if (event.pointerType === 'touch') {
      ctxRef.current?.add(() => gsap.delayedCall(TOUCH_HOLD_S, () => flip(tile, false)))
    }
  }

  function handleLeave(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch') flip(event.currentTarget, false)
  }

  return (
    // Hiasan saja; disembunyikan dari pembaca layar.
    <div ref={rootRef} className={`tile-field ${className}`} aria-hidden="true">
      <div className="tile-field__pile">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="tile-field__row">
            {faces.slice(row * cols, (row + 1) * cols).map((tile, col) => (
              <div
                key={tile.id}
                className={`htile ${tileClassName?.(row, col) ?? ''}`}
                onPointerEnter={handleEnter}
                onPointerLeave={handleLeave}
              >
                <div className="htile__inner">
                  <div className="htile__side htile__back" />
                  <div className="htile__side htile__face">
                    <TileView tile={tile} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
