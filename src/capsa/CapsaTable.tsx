import { useState, type CSSProperties } from 'react'
import { MusicSlot } from '../components/MusicPlayer'
import { cardLabel, cardName, comboLabel, evaluate, sortByRank, sortBySuit, type Card } from './cards'
import { CapsaCard, CardBack } from './CapsaCard'
import { CapsaResultDialog, GuideDialog } from './CapsaDialogs'
import { CapsaHand } from './CapsaHand'
import type { CapsaRoom, CapsaView } from './net'
import { playProblem } from './state'
import { useCapsaSfx } from './sfx'

/** Jumlah kartu yang dikeluarkan sebelumnya di putaran ini yang masih ditampilkan di meja. */
const TRICK_SHOWN = 3

function Opponent({ view, seat, offline, score }: { view: CapsaView; seat: number; offline: boolean; score: number }) {
  const player = view.players[seat]
  const active = view.phase !== 'over' && view.current === seat
  return (
    <li
      className={['capsa-seat', active && 'capsa-seat--active', offline && 'capsa-seat--offline'].filter(Boolean).join(' ')}
      title={offline ? `${player.name} terputus` : undefined}
    >
      <div className="capsa-seat__fan" style={{ '--n': Math.max(player.count, 1) } as CSSProperties} aria-hidden="true">
        {Array.from({ length: player.count }, (_, i) => (
          <CardBack key={i} size="mini" style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <span className="capsa-seat__name">{player.name}</span>
      <span className="capsa-seat__info">
        {player.count} kartu · {score > 0 ? `+${score}` : score} poin
      </span>
      {player.passed && view.phase !== 'over' && <span className="capsa-badge">Lewat</span>}
      {offline && <span className="capsa-seat__offline">terputus</span>}
    </li>
  )
}

/** Urutan tangan versi pemain ini: kartu yang masih ada tetap di posisinya, kartu baru ditambahkan di akhir. */
function arrange(order: number[], hand: Card[]): Card[] {
  const byId = new Map(hand.map((card) => [card.id, card]))
  const kept = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!)
  const known = new Set(order)
  return [...kept, ...sortByRank(hand.filter((card) => !known.has(card.id)))]
}

export function CapsaTable({ room, onExit }: { room: CapsaRoom; onExit: () => void }) {
  const view = room.view!
  const { lobby, seat: me } = room
  /** Urutan kartu di tangan; hanya di perangkat ini, tidak dikirim ke pemain lain. */
  const [order, setOrder] = useState<number[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [guideOpen, setGuideOpen] = useState(false)
  const [resultClosed, setResultClosed] = useState(false)
  /** Layar sentuh: kartu di meja dibuka lewat ketukan, karena tidak ada hover. */
  const [peek, setPeek] = useState<number | null>(null)
  useCapsaSfx(view)

  const { players, phase, current, trick } = view
  if (phase !== 'over' && resultClosed) setResultClosed(false)
  const hand = arrange(order, view.hand)
  const handIds = new Set(hand.map((card) => card.id))
  const chosen = selected.filter((id) => handIds.has(id))
  const chosenCards = chosen.map((id) => hand.find((card) => card.id === id)!)
  const myTurn = phase === 'play' && current === me
  const reversed = view.reversed
  const combo = chosenCards.length ? evaluate(chosenCards, reversed) : null
  const problem = chosenCards.length ? playProblem(view, chosenCards) : null
  const table = trick.length ? trick[trick.length - 1] : null
  const connected = lobby.players.map((player) => player.connected)
  const absent = players.filter((_, i) => connected[i] === false).map((player) => player.name)
  const others = Array.from({ length: players.length - 1 }, (_, i) => (me + 1 + i) % players.length)
  const name = (seat: number) => players[seat]?.name ?? ''

  function toggle(id: number) {
    setSelected(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id])
  }

  function move(id: number, index: number) {
    const rest = hand.filter((card) => card.id !== id).map((card) => card.id)
    rest.splice(index, 0, id)
    setOrder(rest)
  }

  function playSelected(walik = false) {
    if (!myTurn || problem || !chosen.length) return
    room.send({ type: 'play', cardIds: chosen, walik: walik || undefined })
    setSelected([])
  }

  function renderDock() {
    if (phase === 'over') {
      return (
        <>
          <h2 className="dock__title">Ronde selesai</h2>
          <p className="dock__hint">{view.winner === me ? 'Kamu' : name(view.winner ?? 0)} menghabiskan kartu lebih dulu.</p>
          <div className="dock__actions">
            <button type="button" className="btn btn--primary" onClick={() => setResultClosed(false)}>
              Lihat hasil
            </button>
            {room.isHost && (
              <button type="button" className="btn" onClick={room.start}>
                Ronde berikutnya
              </button>
            )}
          </div>
        </>
      )
    }
    if (!myTurn) {
      return (
        <>
          <h2 className="dock__title">Giliran {name(current)}</h2>
          <p className="dock__hint">
            {table
              ? `${name(current)} harus mengalahkan ${comboLabel(table.combo)} atau lewat.`
              : `${name(current)} bebas mengeluarkan kombinasi apa saja.`}{' '}
            Sambil menunggu, kamu bisa memilih dan menyusun kartu.
          </p>
        </>
      )
    }
    const must = view.mustInclude !== null ? view.hand.find((card) => card.id === view.mustInclude) : null
    return (
      <>
        <h2 className="dock__title">Giliranmu</h2>
        <p className="dock__hint">
          {must
            ? `Giliran pertama: keluarkan kombinasi yang memuat ${cardLabel(must)}.`
            : table
              ? `Kalahkan ${comboLabel(table.combo)} dengan ${table.combo.cards.length} kartu, atau lewat.`
              : 'Meja bersih: kamu bebas mengeluarkan kombinasi apa saja.'}
        </p>
        {chosenCards.length > 0 && (
          <p className={`capsa-preview ${problem ? 'capsa-preview--bad' : ''}`}>
            {combo ? <strong>{comboLabel(combo)}</strong> : <strong>{chosenCards.length} kartu</strong>}
            {problem ? ` — ${problem}` : ' — siap dikeluarkan'}
          </p>
        )}
        <div className="dock__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={!chosen.length || !!problem}
            onClick={() => playSelected()}
          >
            Keluarkan{chosen.length ? ` (${chosen.length})` : ''}
          </button>
          {/* Four of a kind boleh memilih walik: urutan angka dan bunga terbalik sampai ronde selesai. */}
          {combo?.kind === 'fourkind' && !problem && (
            <button
              type="button"
              className="btn capsa-walik-btn"
              title={reversed ? 'Kembalikan urutan kartu ke normal' : '3 jadi terbesar dan 2 terkecil; ♦ terbesar dan ♠ terkecil'}
              onClick={() => playSelected(true)}
            >
              {reversed ? 'Keluarkan & Walik balik' : 'Keluarkan & Walik'}
            </button>
          )}
          {table && (
            <button type="button" className="btn" onClick={() => room.send({ type: 'pass' })}>
              Lewat
            </button>
          )}
        </div>
      </>
    )
  }

  const shown = trick.slice(-TRICK_SHOWN)

  return (
    <div className="capsa-game">
      <header className="capsa-topbar">
        <h1 className="capsa-topbar__title">CAPSA</h1>
        <span className="capsa-topbar__room">Room {room.code}</span>
        <div className="capsa-topbar__tools">
          <MusicSlot />
          <button
            type="button"
            className="icon-btn capsa-topbar__help"
            aria-label="Cara main Capsa"
            title="Cara main Capsa"
            onClick={() => setGuideOpen(true)}
          >
            ?
          </button>
          <button type="button" className="btn btn--small" onClick={onExit}>
            Keluar
          </button>
        </div>
      </header>

      <div className="capsa-game__layout">
        <ul className="capsa-opponents" aria-label="Lawan">
          {others.map((seat) => (
            <Opponent key={seat} view={view} seat={seat} offline={connected[seat] === false} score={lobby.players[seat]?.score ?? 0} />
          ))}
        </ul>

        <section className="capsa-felt" aria-label="Meja">
          {phase !== 'over' && (view.fiveCardPlayed || reversed) && (
            <div className="capsa-felt__badges">
              {reversed && (
                <span
                  className="capsa-felt__badge capsa-felt__badge--walik"
                  title="Walik: 3 terbesar, 2 terkecil; ♦ terbesar, ♠ terkecil sampai ronde selesai"
                >
                  Walik aktif · 3 terbesar · ♦ terbesar
                </span>
              )}
              {view.fiveCardPlayed && (
                <span className="capsa-felt__badge" title="Kombo 5 kartu sudah keluar di ronde ini">
                  Tris terkunci
                </span>
              )}
            </div>
          )}
          {shown.length === 0 ? (
            <p className="capsa-felt__empty">
              {phase === 'over' ? 'Ronde selesai' : `Meja bersih — ${current === me ? 'kamu' : name(current)} bebas memulai`}
            </p>
          ) : (
            <div className="capsa-trick">
              {shown.map((entry, i) => {
                const latest = i === shown.length - 1
                const key = trick.length - shown.length + i
                return (
                  <button
                    key={key}
                    type="button"
                    className={['capsa-play', latest && 'capsa-play--latest', peek === key && 'capsa-play--peek']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setPeek(peek === key ? null : key)}
                    onBlur={() => setPeek(null)}
                    aria-label={`${comboLabel(entry.combo)} oleh ${name(entry.by)}: ${entry.combo.cards.map(cardName).join(', ')}`}
                  >
                    <span className="capsa-play__cards" style={{ '--n': entry.combo.cards.length } as CSSProperties}>
                      {[...entry.combo.cards].reverse().map((card, j) => (
                        <CapsaCard key={card.id} card={card} size="table" style={{ '--j': j } as CSSProperties} />
                      ))}
                    </span>
                    <span className="capsa-play__label">
                      {comboLabel(entry.combo)} · {entry.by === me ? 'kamu' : name(entry.by)}
                    </span>
                    {/* Muncul saat kartu di meja disorot atau diketuk */}
                    <span className="capsa-play__tip" aria-hidden="true">
                      <strong>{comboLabel(entry.combo)}</strong>
                      {entry.combo.cards.length > 1 && <span>{entry.combo.cards.map(cardLabel).join('  ')}</span>}
                      <span>oleh {entry.by === me ? 'kamu' : name(entry.by)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="capsa-hand-area" aria-label="Kartumu">
          <div className="capsa-hand-area__head">
            <h2 className="capsa-hand-area__title">Kartumu ({hand.length})</h2>
            <span className="capsa-hand-area__hint">Klik untuk memilih · seret untuk memindah</span>
            <div className="capsa-hand-area__sort">
              <button type="button" className="btn btn--small" onClick={() => setOrder(sortByRank(hand, reversed).map((c) => c.id))}>
                Urut angka
              </button>
              <button type="button" className="btn btn--small" onClick={() => setOrder(sortBySuit(hand, reversed).map((c) => c.id))}>
                Urut bunga
              </button>
              {chosen.length > 0 && (
                <button type="button" className="btn btn--small" onClick={() => setSelected([])}>
                  Batal pilih
                </button>
              )}
            </div>
          </div>
          <CapsaHand
            cards={hand}
            selected={new Set(chosen)}
            mustInclude={view.mustInclude}
            onToggle={toggle}
            onMove={move}
          />
        </section>

        {/* Panel aksi, riwayat, dan skor: kolom samping di layar lebar (lihat capsa.css). */}
        <div className="capsa-side">
          <section className="card capsa-dock" aria-live="polite">
            {absent.length > 0 && phase !== 'over' && (
              <p className="dock__notice" role="status">
                <strong>{absent.join(', ')}</strong> terputus.{' '}
                {players.length - absent.length >= 2
                  ? 'Gilirannya dijalankan otomatis sampai tersambung kembali.'
                  : 'Permainan menunggu sampai ada yang tersambung kembali.'}
              </p>
            )}
            {renderDock()}
          </section>
          <section className="card capsa-log" aria-label="Riwayat">
            <h2 className="scoreboard__title">Riwayat</h2>
            <ol>
              {view.log.map((entry, i) => (
                <li key={`${view.log.length}-${i}-${entry}`}>{entry}</li>
              ))}
            </ol>
          </section>
          <section className="card capsa-scores" aria-label="Papan skor">
            <h2 className="scoreboard__title">Skor</h2>
            <ol className="scoreboard__list">
              {lobby.players
                .map((player, i) => ({ ...player, seat: i }))
                .sort((a, b) => b.score - a.score)
                .map((entry) => (
                  <li key={entry.seat}>
                    {entry.name}
                    {entry.seat === me && ' (kamu)'}
                    <span className={`scoreboard__wins ${entry.score < 0 ? 'scoreboard__wins--minus' : ''}`}>
                      {entry.score > 0 ? `+${entry.score}` : entry.score}
                    </span>
                  </li>
                ))}
            </ol>
          </section>
        </div>
      </div>

      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
      <CapsaResultDialog
        view={view}
        lobby={lobby}
        seat={me}
        open={phase === 'over' && !resultClosed}
        onClose={() => setResultClosed(true)}
        onExit={onExit}
        onRestart={room.isHost ? room.start : undefined}
      />
    </div>
  )
}
