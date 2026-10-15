import { useEffect, useRef } from 'react'
import { formatPoints, roundDeltas, scoreWin } from '../game/scoring'
import type { GameState } from '../game/state'
import { t } from '../i18n'
import { Confetti } from './Confetti'
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
 * Hong Kong Points: ditambah rincian faan dan poin yang berpindah antar-pemain.
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
  // Confetti untuk kemenangan: di mode online hanya di perangkat pemenangnya.
  const celebrate = winner !== null && (!online || state.winner === viewer)
  const score = scoreWin(state)
  const deltas = roundDeltas(state)

  return (
    <dialog
      ref={ref}
      className="tutorial-dialog result-dialog"
      aria-labelledby="result-dialog-title"
      onClose={onClose}
      // Klik di luar kartu (area gelap) menutup modal.
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      {/* Di dalam <dialog> supaya tampil di atas modal dan latar gelapnya. */}
      {open && celebrate && <Confetti />}
      <div className="tutorial-dialog__scroll">
        <div className="result-dialog__card">
          <h2 id="result-dialog-title" className="result-dialog__title">
            {!winner
              ? t('Seri', 'Draw')
              : state.winner === viewer
                ? t('Kamu menang!', 'You win!')
                : t(`${winner.name} menang!`, `${winner.name} wins!`)}
          </h2>
          <p className="result-dialog__how">
            {!winner && t('Dinding habis tanpa pemenang.', 'The wall ran out with no winner.')}
            {winner && state.winType === 'self' && t('Menang dari ubin yang diambil sendiri.', 'Won on a self-drawn tile.')}
            {winner &&
              state.winType === 'discard' &&
              lastDiscard &&
              t(`Menang dari buangan ${players[lastDiscard.from].name}.`, `Won on ${players[lastDiscard.from].name}'s discard.`)}
          </p>

          {winner && (
            <div className="result-dialog__hand">
              <figure className="result-dialog__group">
                <figcaption>{t('Tangan', 'Hand')}</figcaption>
                <div className="result-dialog__tiles">
                  {winner.hand.map((tile) => (
                    // Ubin penentu kemenangan diberi tanda.
                    <TileView key={tile.id} tile={tile} marked={tile.id === state.drawnId} />
                  ))}
                </div>
              </figure>

              {winner.melds.length > 0 && (
                <figure className="result-dialog__group">
                  <figcaption>{t('Set terbuka', 'Exposed sets')}</figcaption>
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
                          {meld.concealed && t(' tertutup', ' concealed')}
                        </span>
                      </div>
                    ))}
                  </div>
                </figure>
              )}

              {winner.flowers.length > 0 && (
                <figure className="result-dialog__group">
                  <figcaption>{t('Bunga', 'Flowers')}</figcaption>
                  <div className="result-dialog__tiles">
                    {winner.flowers.map((tile) => (
                      <TileView key={tile.id} tile={tile} />
                    ))}
                  </div>
                </figure>
              )}
            </div>
          )}

          {score && (
            <div className="result-dialog__score">
              <ul className="result-dialog__rows">
                {score.items.map((item) => (
                  <li key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.faan} faan</strong>
                  </li>
                ))}
                {score.items.length === 0 && (
                  <li>
                    <span>{t('Tangan tanpa pola bernilai', 'No scoring pattern')}</span>
                    <strong>0 faan</strong>
                  </li>
                )}
              </ul>
              <p className="result-dialog__total">
                <strong>{score.faan} faan</strong>
                {score.limit && t(' (batas)', ' (limit)')} ={' '}
                <strong>
                  {score.base} {t('poin dasar', 'base points')}
                </strong>
              </p>
              <ul className="result-dialog__rows">
                {players.map((player, i) => (
                  <li key={i}>
                    <span>{player.name}</span>
                    <strong className={deltas[i] < 0 ? 'result-dialog__minus' : ''}>
                      {formatPoints(deltas[i])}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!onRestart && online && (
            <p className="result-dialog__how">
              {t('Menunggu host memulai ronde baru…', 'Waiting for the host to start a new round…')}
            </p>
          )}

          <div className="result-dialog__actions">
            {onRestart && (
              <button ref={primaryRef} type="button" className="btn btn--primary" onClick={onRestart}>
                {t('Main lagi', 'Play again')}
              </button>
            )}
            <button ref={onRestart ? undefined : primaryRef} type="button" className="btn" onClick={onClose}>
              {t('Lihat meja', 'View table')}
            </button>
            <button type="button" className="btn" onClick={onExit}>
              {online ? t('Keluar dari room', 'Leave room') : t('Ganti pemain', 'Change players')}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
