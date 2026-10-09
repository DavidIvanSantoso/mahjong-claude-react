import { useEffect, useRef } from 'react'
import type { GameState } from '../game/state'
import { TileView } from './TileView'

const MELD_LABELS = { pong: 'Pong', chi: 'Chi', kong: 'Kong' }

interface ResultDialogProps {
  state: GameState
  open: boolean
  /** Menutup modal untuk melihat meja; permainannya sendiri tetap berakhir. */
  onClose: () => void
  onExit: () => void
  /** Kosong kalau perangkat ini tidak berhak memulai ronde baru (tamu di mode online). */
  onRestart?: () => void
  /** Mode online: kursi perangkat ini, supaya judulnya bisa "Kamu menang!". */
  viewer?: number
}

/**
 * Modal hasil akhir: siapa yang menang, dari mana ubin penentunya, dan susunan tangan menangnya.
 * Untuk permainan seri (dinding habis) hanya pesannya yang ditampilkan.
 */
export function ResultDialog({ state, open, onClose, onExit, onRestart, viewer }: ResultDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      primaryRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const { players, lastDiscard } = state
  const winner = state.winner === null ? null : players[state.winner]
  const online = viewer !== undefined

  return (
    <dialog
      ref={ref}
      className="tutorial-dialog result-dialog"
      aria-labelledby="result-dialog-title"
      onClose={onClose}
      // Klik di luar kartu (area gelap) menutup modal.
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="tutorial-dialog__scroll">
        <div className="result-dialog__card">
          <h2 id="result-dialog-title" className="result-dialog__title">
            {!winner ? 'Seri' : state.winner === viewer ? 'Kamu menang!' : `${winner.name} menang!`}
          </h2>
          <p className="result-dialog__how">
            {!winner && 'Dinding habis tanpa pemenang.'}
            {winner && state.winType === 'self' && 'Menang dari ubin yang diambil sendiri.'}
            {winner &&
              state.winType === 'discard' &&
              lastDiscard &&
              `Menang dari buangan ${players[lastDiscard.from].name}.`}
          </p>

          {winner && (
            <div className="result-dialog__hand">
              <figure className="result-dialog__group">
                <figcaption>Tangan</figcaption>
                <div className="result-dialog__tiles">
                  {winner.hand.map((tile) => (
                    // Ubin penentu kemenangan diberi tanda.
                    <TileView key={tile.id} tile={tile} marked={tile.id === state.drawnId} />
                  ))}
                </div>
              </figure>

              {winner.melds.length > 0 && (
                <figure className="result-dialog__group">
                  <figcaption>Set terbuka</figcaption>
                  <div className="result-dialog__melds">
                    {winner.melds.map((meld, i) => (
                      <div key={i} className="result-dialog__meld">
                        <div className="result-dialog__tiles">
                          {meld.tiles.map((tile) => (
                            <TileView key={tile.id} tile={tile} />
                          ))}
                        </div>
                        <span>
                          {MELD_LABELS[meld.type]}
                          {meld.concealed && ' tertutup'}
                        </span>
                      </div>
                    ))}
                  </div>
                </figure>
              )}

              {winner.flowers.length > 0 && (
                <figure className="result-dialog__group">
                  <figcaption>Bunga</figcaption>
                  <div className="result-dialog__tiles">
                    {winner.flowers.map((tile) => (
                      <TileView key={tile.id} tile={tile} />
                    ))}
                  </div>
                </figure>
              )}
            </div>
          )}

          {!onRestart && online && (
            <p className="result-dialog__how">Menunggu host memulai ronde baru…</p>
          )}

          <div className="result-dialog__actions">
            {onRestart && (
              <button ref={primaryRef} type="button" className="btn btn--primary" onClick={onRestart}>
                Main lagi
              </button>
            )}
            <button ref={onRestart ? undefined : primaryRef} type="button" className="btn" onClick={onClose}>
              Lihat meja
            </button>
            <button type="button" className="btn" onClick={onExit}>
              {online ? 'Keluar dari room' : 'Ganti pemain'}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
