import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, Ref } from 'react'
import { cellLabel, type Cell, type Dir } from './grid'
import { PixelFlame, PixelSplash, ShipArt } from './Pixel'
import type { Shot } from './state'

export interface BoardShip {
  id: string
  cell: Cell
  dir: Dir
  size: number
  sunk?: boolean
  className?: string
}

interface BoardProps {
  size: number
  label: string
  shots?: (Shot | null)[]
  ships?: BoardShip[]
  /** Kelas tambahan per sel, mis. pratinjau penempatan atau area Sonar. */
  marks?: Map<Cell, string>
  /** Sel yang bisa diklik (mis. sel yang belum ditembak saat giliranmu). */
  canClick?: (cell: Cell) => boolean
  onCell?: (cell: Cell) => void
  onShipPointerDown?: (event: ReactPointerEvent<HTMLDivElement>, ship: BoardShip) => void
  gridRef?: Ref<HTMLDivElement>
  variant?: 'big' | 'medium' | 'mini'
  className?: string
  /** Lapisan di atas papan, mis. teks hasil tembakan. */
  children?: ReactNode
}

/** Posisi kapal di atas grid dalam persen, supaya ikut ukuran papan. */
function shipStyle(ship: BoardShip, size: number): CSSProperties {
  const row = Math.floor(ship.cell / size)
  const col = ship.cell % size
  return {
    left: `${(col / size) * 100}%`,
    top: `${(row / size) * 100}%`,
    width: `${((ship.dir === 'h' ? ship.size : 1) / size) * 100}%`,
    height: `${((ship.dir === 'v' ? ship.size : 1) / size) * 100}%`,
  }
}

/**
 * Papan N×N: sel (bisa diklik), kapal di lapisan atasnya, lalu tanda tembakan paling atas.
 * Label kolom (A, B, …) dan baris (1, 2, …) hanya untuk varian besar.
 */
export function Board({
  size,
  label,
  shots,
  ships = [],
  marks,
  canClick,
  onCell,
  onShipPointerDown,
  gridRef,
  variant = 'big',
  className,
  children,
}: BoardProps) {
  const cells = Array.from({ length: size * size }, (_, i) => i)
  const labels = variant !== 'mini'
  return (
    <div className={`ar-board ar-board--${variant} ${className ?? ''}`} style={{ '--n': size } as CSSProperties} role="group" aria-label={label}>
      {labels && (
        <>
          <span className="ar-board__corner" aria-hidden="true" />
          <div className="ar-board__cols" aria-hidden="true">
            {Array.from({ length: size }, (_, i) => (
              <span key={i}>{String.fromCharCode(65 + i)}</span>
            ))}
          </div>
          <div className="ar-board__rows" aria-hidden="true">
            {Array.from({ length: size }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        </>
      )}
      <div className="ar-board__grid" ref={gridRef}>
        {cells.map((cell) => {
          const shot = shots?.[cell] ?? null
          const classes = ['ar-cell', shot && `ar-cell--${shot}`, marks?.get(cell)].filter(Boolean).join(' ')
          const clickable = Boolean(onCell && canClick?.(cell))
          return clickable ? (
            <button key={cell} type="button" className={`${classes} ar-cell--open`} aria-label={`Tembak ${cellLabel(cell, size)}`} onClick={() => onCell?.(cell)} />
          ) : (
            <div key={cell} className={classes} />
          )
        })}
        <div className="ar-board__ships">
          {ships.map((ship) => (
            <div
              key={ship.id}
              className={`ar-ship ${ship.sunk ? 'ar-ship--sunk' : ''} ${onShipPointerDown ? 'ar-ship--drag' : ''} ${ship.className ?? ''}`}
              style={shipStyle(ship, size)}
              onPointerDown={onShipPointerDown ? (event) => onShipPointerDown(event, ship) : undefined}
            >
              <ShipArt size={ship.size} dir={ship.dir} sunk={ship.sunk} />
            </div>
          ))}
        </div>
        {shots && (
          <div className="ar-board__marks" aria-hidden="true">
            {cells.map((cell) =>
              shots[cell] ? (
                <span
                  key={cell}
                  className={`ar-mark ar-mark--${shots[cell]}`}
                  style={{ left: `${((cell % size) / size) * 100}%`, top: `${(Math.floor(cell / size) / size) * 100}%` }}
                >
                  {shots[cell] === 'hit' ? <PixelFlame className="ar-mark__art" /> : <PixelSplash className="ar-mark__art" />}
                </span>
              ) : null,
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
