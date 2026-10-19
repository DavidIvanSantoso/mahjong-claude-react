import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { Card } from './cards'
import { CapsaCard } from './CapsaCard'

/** Jarak geser (px) sebelum tekanan dianggap seret, bukan klik. */
const DRAG_THRESHOLD = 6

interface DragState {
  id: number
  dx: number
  dy: number
  /** Posisi sisipan di antara kartu lain (tanpa kartu yang diseret). */
  insert: number
}

interface CapsaHandProps {
  cards: Card[]
  selected: Set<number>
  /** Kartu wajib (kartu terkecil di giliran pertama), diberi tanda. */
  mustInclude: number | null
  onToggle: (id: number) => void
  /** Pindahkan kartu `id` ke posisi `index` di antara kartu-kartu lainnya. */
  onMove: (id: number, index: number) => void
}

/**
 * Tangan sendiri. Klik kartu untuk memilih/batal memilih; tekan lalu seret untuk memindahkan
 * kartu ke posisi lain (penanda emas menunjukkan tempat jatuhnya). Memakai pointer events,
 * jadi berlaku untuk mouse maupun layar sentuh.
 */
export function CapsaHand({ cards, selected, mustInclude, onToggle, onMove }: CapsaHandProps) {
  const slots = useRef(new Map<number, HTMLElement>())
  const [drag, setDrag] = useState<DragState | null>(null)
  /** Klik yang menyusul akhir seretan diabaikan, supaya kartu tidak ikut terpilih. */
  const suppressClick = useRef(false)
  const cleanup = useRef<() => void>(() => {})

  useEffect(() => () => cleanup.current(), [])

  /**
   * Posisi sisipan dari titik pointer: cari baris kartu terdekat (tangan bisa terlipat jadi
   * beberapa baris), lalu kartu pertama yang bagian terlihatnya ada di kanan pointer.
   */
  function insertionIndex(x: number, y: number, draggedId: number): number {
    const others = cards
      .filter((card) => card.id !== draggedId)
      .map((card) => ({ id: card.id, rect: slots.current.get(card.id)?.getBoundingClientRect() }))
      .filter((entry): entry is { id: number; rect: DOMRect } => !!entry.rect)
    if (others.length === 0) return 0
    const centerY = (r: DOMRect) => r.top + r.height / 2
    const rowY = others.reduce((best, entry) =>
      Math.abs(centerY(entry.rect) - y) < Math.abs(centerY(best.rect) - y) ? entry : best,
    ).rect
    const inRow = (r: DOMRect) => Math.abs(centerY(r) - centerY(rowY)) < r.height / 2
    for (let i = 0; i < others.length; i++) {
      const { rect } = others[i]
      if (!inRow(rect)) continue
      // Kartu saling menumpuk; yang terlihat hanya sampai tepi kiri kartu sesudahnya.
      const next = others[i + 1]?.rect
      const visible = next && inRow(next) ? Math.max(8, next.left - rect.left) : rect.width
      if (x < rect.left + visible / 2) return i
    }
    // Di kanan kartu terakhir baris itu: sisipkan sesudahnya.
    const lastInRow = others.map((entry, i) => ({ ...entry, i })).filter((entry) => inRow(entry.rect))
    return (lastInRow[lastInRow.length - 1]?.i ?? others.length - 1) + 1
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, id: number) {
    if (event.button !== 0) return
    const startX = event.clientX
    const startY = event.clientY
    let active = false

    const move = (e: globalThis.PointerEvent) => {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (!active && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      active = true
      e.preventDefault()
      setDrag({ id, dx, dy, insert: insertionIndex(e.clientX, e.clientY, id) })
    }
    const end = (e: globalThis.PointerEvent) => {
      cleanup.current()
      if (active) {
        suppressClick.current = true
        // Kalau klik tidak menyusul (pointer dilepas di luar kartu), tandanya dilepas lagi.
        setTimeout(() => (suppressClick.current = false), 0)
        if (e.type === 'pointerup') onMove(id, insertionIndex(e.clientX, e.clientY, id))
      }
      setDrag(null)
    }
    cleanup.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      cleanup.current = () => {}
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const others = drag ? cards.filter((card) => card.id !== drag.id) : cards
  const from = drag ? cards.findIndex((card) => card.id === drag.id) : -1
  // Penanda tidak ditampilkan kalau kartunya akan kembali ke tempat yang sama.
  const caret = drag && drag.insert !== from ? drag.insert : null

  return (
    <div className={`capsa-hand ${drag ? 'capsa-hand--dragging' : ''}`} style={{ '--n': cards.length } as CSSProperties}>
      {cards.map((card) => {
        const index = others.indexOf(card)
        const isDragged = drag?.id === card.id
        const caretBefore = caret !== null && !isDragged && index === caret
        const caretAfter = caret !== null && !isDragged && caret === others.length && index === others.length - 1
        return (
          <span
            key={card.id}
            ref={(el) => {
              if (el) slots.current.set(card.id, el)
              else slots.current.delete(card.id)
            }}
            className={[
              'capsa-hand__slot',
              caretBefore && 'capsa-hand__slot--caret-before',
              caretAfter && 'capsa-hand__slot--caret-after',
              isDragged && 'capsa-hand__slot--dragged',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <CapsaCard
              card={card}
              selected={selected.has(card.id)}
              dragging={isDragged}
              className={card.id === mustInclude ? 'pc--must' : undefined}
              style={isDragged ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
              onPointerDown={(event) => startDrag(event, card.id)}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false
                  return
                }
                onToggle(card.id)
              }}
            />
          </span>
        )
      })}
    </div>
  )
}
