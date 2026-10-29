import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Board, type BoardShip } from './Board'
import { PRESETS, randomFleet, shipCells, type Cell, type Dir, type Placement } from './grid'
import { PLACEMENT_SECONDS, type ArmadaRoom } from './net'
import { PixelFlag, ShipArt } from './Pixel'
import { sfx } from './sfx'
import { TimerBar } from './Timer'

type Placed = Record<string, { cell: Cell; dir: Dir }>

/** Kapal yang sedang diseret: dari dok atau dari papan, beserta segmen yang dipegang. */
interface Drag {
  id: string
  size: number
  dir: Dir
  /** Segmen kapal yang dipegang (0 = ujung kiri/atas), supaya kapal tidak melompat saat diseret. */
  grab: number
  from: 'dock' | 'board'
  x: number
  y: number
  startX: number
  startY: number
  moved: boolean
  cellPx: number
  /** Sel kiri/atas kapal kalau dilepas sekarang; null kalau di luar papan. */
  anchor: Cell | null
}

/** Jarak geser minimal (px) sebelum sentuhan dianggap seret, bukan ketuk. */
const DRAG_THRESHOLD = 6

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function fromFleet(fleet: Placement[] | null): Placed {
  return Object.fromEntries((fleet ?? []).map((ship) => [ship.id, { cell: ship.cell, dir: ship.dir }]))
}

/**
 * Menyusun armada dengan seret-dan-lepas (Pointer Events, jadi jalan dengan mouse maupun sentuhan):
 * seret kapal dari dok ke papan, seret kapal di papan untuk memindahkan, seret keluar papan untuk
 * melepasnya, ketuk kapal di papan untuk memutarnya. Tombol R atau spasi memutar kapal yang sedang diseret.
 */
export function ArmadaPlacement({ room }: { room: ArmadaRoom }) {
  const view = room.view!
  const me = room.seat
  const preset = PRESETS[view.preset]
  const { size } = preset
  const player = view.players[me]
  const ready = player.ready
  const [placed, setPlaced] = useState<Placed>(() => fromFleet(player.fleet))
  const [dockDir, setDockDir] = useState<Dir>('h')
  const [drag, setDrag] = useState<Drag | null>(null)
  const [shake, setShake] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(drag)
  const placedRef = useRef(placed)
  dragRef.current = drag
  placedRef.current = placed

  const specOf = (id: string) => preset.ships.find((ship) => ship.id === id)!
  const allPlaced = preset.ships.every((ship) => placed[ship.id])

  /** Sel kapal `id` di posisi itu kalau muat (di dalam papan, tidak menabrak kapal lain). */
  function fits(current: Placed, id: string, cell: Cell, dir: Dir): Cell[] | null {
    const cells = shipCells(cell, specOf(id).size, dir, size)
    if (!cells) return null
    const taken = new Set(
      Object.entries(current)
        .filter(([other]) => other !== id)
        .flatMap(([other, pos]) => shipCells(pos.cell, specOf(other).size, pos.dir, size) ?? []),
    )
    return cells.some((c) => taken.has(c)) ? null : cells
  }

  function anchorAt(d: Drag, x: number, y: number): Cell | null {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const cell = rect.width / size
    const margin = cell * 0.5
    if (x < rect.left - margin || x > rect.right + margin || y < rect.top - margin || y > rect.bottom + margin) return null
    let col = clamp(Math.floor((x - rect.left) / cell), 0, size - 1)
    let row = clamp(Math.floor((y - rect.top) / cell), 0, size - 1)
    // Kapal digeser masuk ke papan kalau ujungnya keluar tepi.
    if (d.dir === 'h') col = clamp(col - d.grab, 0, size - d.size)
    else row = clamp(row - d.grab, 0, size - d.size)
    return row * size + col
  }

  function nudge(id: string) {
    sfx.invalid()
    setShake(id)
    setTimeout(() => setShake(null), 300)
  }

  function rotate(id: string) {
    const pos = placedRef.current[id]
    if (!pos) return
    const dir: Dir = pos.dir === 'h' ? 'v' : 'h'
    const length = specOf(id).size
    let row = Math.floor(pos.cell / size)
    let col = pos.cell % size
    if (dir === 'h') col = Math.min(col, size - length)
    else row = Math.min(row, size - length)
    const cell = row * size + col
    if (!fits(placedRef.current, id, cell, dir)) return nudge(id)
    sfx.rotate()
    setPlaced({ ...placedRef.current, [id]: { cell, dir } })
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>, id: string, from: Drag['from'], dir: Dir) {
    if (ready || event.button > 0 || !gridRef.current) return
    event.preventDefault()
    const length = specOf(id).size
    const rect = event.currentTarget.getBoundingClientRect()
    const along = dir === 'h' ? event.clientX - rect.left : event.clientY - rect.top
    const segment = (dir === 'h' ? rect.width : rect.height) / length
    setDrag({
      id,
      size: length,
      dir,
      grab: clamp(Math.floor(along / segment), 0, length - 1),
      from,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      cellPx: gridRef.current.getBoundingClientRect().width / size,
      anchor: from === 'board' ? (placedRef.current[id]?.cell ?? null) : null,
    })
  }

  // Selama menyeret, gerakan dan lepasan dipantau di seluruh jendela (pointer bisa keluar dari kapal).
  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    function move(event: PointerEvent) {
      const d = dragRef.current
      if (!d) return
      const moved = d.moved || Math.hypot(event.clientX - d.startX, event.clientY - d.startY) > DRAG_THRESHOLD
      setDrag({ ...d, x: event.clientX, y: event.clientY, moved, anchor: moved ? anchorAt(d, event.clientX, event.clientY) : d.anchor })
    }
    function drop() {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      const current = placedRef.current
      if (!d.moved) {
        if (d.from === 'board') rotate(d.id)
        return
      }
      if (d.anchor === null) {
        // Diseret keluar papan: kapal kembali ke dok.
        if (d.from === 'board') {
          const { [d.id]: _removed, ...rest } = current
          setPlaced(rest)
        }
        return
      }
      if (!fits(current, d.id, d.anchor, d.dir)) return nudge(d.id)
      sfx.place()
      setPlaced({ ...current, [d.id]: { cell: d.anchor, dir: d.dir } })
    }
    function key(event: KeyboardEvent) {
      const d = dragRef.current
      if (!d || (event.key !== 'r' && event.key !== 'R' && event.key !== ' ')) return
      event.preventDefault()
      const turned: Drag = { ...d, dir: d.dir === 'h' ? 'v' : 'h', grab: 0 }
      sfx.rotate()
      setDrag({ ...turned, moved: true, anchor: anchorAt(turned, d.x, d.y) })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', drop)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', drop)
      window.removeEventListener('keydown', key)
    }
  }, [dragging])

  const shown: Placed = ready ? fromFleet(player.fleet) : placed
  const ships: BoardShip[] = preset.ships
    .filter((spec) => shown[spec.id])
    .map((spec) => ({
      id: spec.id,
      size: spec.size,
      ...shown[spec.id],
      className: [drag?.moved && drag.id === spec.id && 'ar-ship--lifted', shake === spec.id && 'ar-ship--shake'].filter(Boolean).join(' '),
    }))

  const marks = new Map<Cell, string>()
  if (drag?.moved && drag.anchor !== null) {
    const ok = fits(placed, drag.id, drag.anchor, drag.dir) !== null
    shipCells(drag.anchor, drag.size, drag.dir, size)?.forEach((cell) => marks.set(cell, ok ? 'ar-cell--ok' : 'ar-cell--bad'))
  }

  function confirm() {
    const fleet: Placement[] = preset.ships.map((spec) => ({ id: spec.id, ...placed[spec.id] }))
    room.send({ type: 'ready', fleet })
  }

  const dock = preset.ships.filter((spec) => !placed[spec.id])
  const readyCount = view.players.filter((p) => p.ready).length

  return (
    <div className="ar-placement">
      <section className="ar-panel ar-placement__main">
        <header className="ar-placement__head">
          <h2 className="ar-panel__title">Susun armadamu</h2>
          <TimerBar deadline={room.deadline} total={PLACEMENT_SECONDS} />
        </header>
        <p className="ar-hint">
          {ready
            ? 'Armadamu sudah terkunci. Menunggu pemain lain…'
            : 'Seret kapal ke papan. Ketuk kapal di papan untuk memutar, seret keluar papan untuk melepas. Saat menyeret, tekan R untuk memutar.'}
        </p>
        <Board
          size={size}
          label="Papanmu"
          ships={ships}
          marks={marks}
          gridRef={gridRef}
          onShipPointerDown={ready ? undefined : (event, ship) => startDrag(event, ship.id, 'board', ship.dir)}
          className={ready ? 'ar-board--locked' : ''}
        />
      </section>

      <aside className="ar-placement__side">
        {!ready && (
          <section className="ar-panel">
            <div className="ar-dock__head">
              <h2 className="ar-panel__title">Dok ({dock.length})</h2>
              <button
                type="button"
                className="ar-btn ar-btn--small"
                onClick={() => {
                  sfx.rotate()
                  setDockDir(dockDir === 'h' ? 'v' : 'h')
                }}
              >
                PUTAR
              </button>
            </div>
            {dock.length ? (
              <ul className={`ar-dock ar-dock--${dockDir}`}>
                {dock.map((spec) => (
                  <li key={spec.id} className="ar-dock__item">
                    <div
                      className={`ar-dock__ship ${drag?.moved && drag.id === spec.id ? 'ar-ship--lifted' : ''}`}
                      style={{ '--len': spec.size } as CSSProperties}
                      onPointerDown={(event) => startDrag(event, spec.id, 'dock', dockDir)}
                    >
                      <ShipArt size={spec.size} dir={dockDir} />
                    </div>
                    <span className="ar-dock__name">
                      {spec.name} · {spec.size}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ar-panel__empty">Semua kapal sudah di papan.</p>
            )}
            <div className="ar-placement__actions">
              <button
                type="button"
                className="ar-btn ar-btn--alt"
                onClick={() => {
                  sfx.place()
                  setPlaced(fromFleet(randomFleet(preset)))
                }}
              >
                ACAK
              </button>
              <button type="button" className="ar-btn ar-btn--alt" disabled={!Object.keys(placed).length} onClick={() => setPlaced({})}>
                KOSONGKAN
              </button>
            </div>
          </section>
        )}

        {ready ? (
          <button type="button" className="ar-btn ar-btn--wide" onClick={() => room.send({ type: 'ready', fleet: null })}>
            BATAL SIAP
          </button>
        ) : (
          <button type="button" className="ar-btn ar-btn--big ar-btn--wide" disabled={!allPlaced} onClick={confirm}>
            {allPlaced ? 'SIAP!' : `PASANG ${dock.length} KAPAL LAGI`}
          </button>
        )}

        <section className="ar-panel">
          <h2 className="ar-panel__title">
            Siap ({readyCount}/{view.players.length})
          </h2>
          <ul className="ar-ready-list">
            {view.players.map((p, seat) => (
              <li key={seat} className={p.ready ? 'ar-ready-list__ok' : ''}>
                <PixelFlag seat={seat} />
                <span>
                  {p.name}
                  {seat === me && ' (kamu)'}
                  {room.lobby.players[seat]?.connected === false && ' · terputus'}
                </span>
                <strong>{p.ready ? 'SIAP' : '…'}</strong>
              </li>
            ))}
          </ul>
          <p className="ar-panel__empty">Saat waktu habis, armada yang belum siap disusun acak.</p>
        </section>
      </aside>

      {drag?.moved && (
        <div
          className={`ar-ghost ${drag.anchor === null ? 'ar-ghost--away' : ''}`}
          style={{
            left: drag.x - (drag.dir === 'h' ? drag.grab + 0.5 : 0.5) * drag.cellPx,
            top: drag.y - (drag.dir === 'v' ? drag.grab + 0.5 : 0.5) * drag.cellPx,
            width: (drag.dir === 'h' ? drag.size : 1) * drag.cellPx,
            height: (drag.dir === 'v' ? drag.size : 1) * drag.cellPx,
          }}
          aria-hidden="true"
        >
          <ShipArt size={drag.size} dir={drag.dir} />
        </div>
      )}
    </div>
  )
}
