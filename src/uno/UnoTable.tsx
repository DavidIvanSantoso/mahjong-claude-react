import { useEffect, useState, type CSSProperties } from 'react'
import { MusicSlot } from '../components/MusicPlayer'
import { canPlay, cardName, COLOR_NAMES, sortHand, valueName, type Card, type Color } from './cards'
import { TARGET_SCORE, type UnoRoom, type UnoView } from './net'
import { useUnoSfx } from './sfx'
import { canStack, MODE_NAMES, playOrder } from './state'
import { CardBack, UnoCard } from './UnoCard'
import { ColorPicker, PlayerPicker, RulesDialog, UnoResultDialog } from './UnoDialogs'

/**
 * Semua kartu lawan digambar sebagai kipas punggung kartu, supaya jumlahnya terlihat sekilas.
 * Lebih dari ini (jarang sekali), sisanya ditulis sebagai "+N".
 */
const FAN_MAX = 40

function TurnTimer({ deadline, total }: { deadline: number; total: number }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const left = Math.max(0, deadline - now)
  const seconds = Math.ceil(left / 1000)
  return (
    <div className={`turn-timer ${seconds <= 5 ? 'turn-timer--low' : ''}`} role="timer">
      <span className="turn-timer__bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (left / (total * 1000)) * 100)}%` }} />
      </span>
      <span className="turn-timer__text">{seconds} dtk</span>
    </div>
  )
}

/** Kartu di tangan makin bertumpuk kalau jumlahnya banyak, supaya tetap muat. */
function handOverlap(count: number): number {
  if (count <= 7) return 0.1
  if (count <= 11) return 0.3
  if (count <= 16) return 0.45
  return 0.55
}

function Opponent({
  view,
  seat,
  offline,
  score,
}: {
  view: UnoView
  seat: number
  offline: boolean
  score: number
}) {
  const player = view.players[seat]
  const active = view.phase !== 'over' && view.current === seat
  const shown = Math.min(player.count, FAN_MAX)
  return (
    <li
      className={['uno-seat', active && 'uno-seat--active', offline && 'uno-seat--offline'].filter(Boolean).join(' ')}
      title={offline ? `${player.name} terputus` : undefined}
    >
      {/* Lebar, jarak, dan sudut kipas dihitung di uno.css dari jumlah kartu (--n). */}
      <div className="uno-seat__fan" style={{ '--n': Math.max(shown, 1) } as CSSProperties} aria-hidden="true">
        {Array.from({ length: shown }, (_, i) => (
          <CardBack key={i} size="mini" style={{ '--i': i } as CSSProperties} />
        ))}
        {player.count > FAN_MAX && <span className="uno-seat__more">+{player.count - FAN_MAX}</span>}
      </div>
      <div className="uno-seat__info">
        <span className="uno-seat__name">
          {player.name}
          {view.dealer === seat && (
            <span className="uno-seat__dealer" title="Pembagi kartu">
              D
            </span>
          )}
        </span>
        <span className="uno-seat__count">
          {player.count} kartu · {score} poin
        </span>
      </div>
      {player.count === 1 && view.phase !== 'over' && (
        <span className={`uno-badge ${view.vulnerable === seat ? 'uno-badge--warn' : ''}`}>
          {view.vulnerable === seat ? 'Lupa UNO!' : 'UNO'}
        </span>
      )}
      {offline && <span className="uno-seat__offline">terputus</span>}
    </li>
  )
}

/** Kartu yang menunggu pilihan warna (Wild) atau lawan (angka 7 di Crazy Rules) sebelum dikirim. */
interface PendingPlay {
  cardId: number
  under: number[]
  need: 'color' | 'target'
}

export function UnoTable({ room, onExit }: { room: UnoRoom; onExit: () => void }) {
  const view = room.view!
  const { lobby, seat: me } = room
  const [pending, setPending] = useState<PendingPlay | null>(null)
  /** Indonesian Rules: kartu angka sama yang dipilih untuk dikeluarkan sekaligus; terakhir = teratas. */
  const [selected, setSelected] = useState<number[]>([])
  const [turnKey, setTurnKey] = useState('')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [resultClosed, setResultClosed] = useState(false)
  useUnoSfx(view)

  const { players, phase, current, top, color, mode } = view
  if (phase !== 'over' && resultClosed) setResultClosed(false)
  // Pilihan kartu hanya berlaku untuk giliran yang sama; giliran berganti (mis. waktu habis) mengosongkannya.
  const key = `${current}:${phase}:${top.id}:${view.hand.length}`
  if (key !== turnKey) {
    setTurnKey(key)
    setSelected([])
    setPending(null)
  }

  const myTurn = phase !== 'over' && current === me
  const hand = sortHand(view.hand)
  const canAct = myTurn && (phase === 'turn' || phase === 'drawn' || phase === 'stack')
  const playable = new Set(
    canAct
      ? hand
          .filter((card) =>
            phase === 'stack'
              ? canStack(card, top)
              : (phase !== 'drawn' || card.id === view.drawnId) && canPlay(card, top, color),
          )
          .map((card) => card.id)
      : [],
  )
  const indonesian = mode === 'indonesian'
  const multi = indonesian && canAct
  const selection = selected.map((id) => hand.find((card) => card.id === id)).filter((card): card is Card => !!card)
  // Setelah kartu pertama dipilih, yang bisa ditambahkan hanya kartu dengan nilai (angka/simbol) yang sama.
  const selectable = selection.length
    ? new Set(hand.filter((card) => card.value === selection[0].value).map((card) => card.id))
    : playable
  const order = selection.length ? playOrder(selection, top, color, phase, view.drawnId) : null
  // Indonesian Rules: kartu hanya boleh diambil kalau tidak ada yang cocok.
  const canDraw = myTurn && (phase === 'stack' || (phase === 'turn' && !(indonesian && playable.size > 0)))
  const connected = lobby.players.map((player) => player.connected)
  const absent = players.filter((_, i) => connected[i] === false).map((player) => player.name)
  const others = Array.from({ length: players.length - 1 }, (_, i) => (me + 1 + i) % players.length)
  const declared = players[me]?.declared ?? false
  // UNO dibilang sebelum mengeluarkan kartu yang menyisakan satu kartu, termasuk beberapa kartu sekaligus.
  const leavesOne = hand.length === 2 || (selection.length >= 2 && hand.length - selection.length === 1)
  const canCallUno = phase !== 'over' && (view.vulnerable === me || (!declared && leavesOne))
  const catchable = view.vulnerable !== null && view.vulnerable !== me ? view.vulnerable : null
  const name = (seat: number) => players[seat]?.name ?? ''

  /** Mengirim kartu, atau menahannya dulu kalau masih perlu pilihan warna/lawan. */
  function playCards(card: Card, under: number[] = []) {
    const remaining = hand.length - 1 - under.length
    if (card.color === null) setPending({ cardId: card.id, under, need: 'color' })
    else if (mode === 'crazy' && card.value === 7 && remaining > 0) setPending({ cardId: card.id, under, need: 'target' })
    else room.send({ type: 'play', cardId: card.id, under: under.length ? under : undefined })
  }

  function clickCard(card: Card) {
    if (multi) {
      if (selected.includes(card.id)) {
        setSelected(selected.filter((id) => id !== card.id))
        return
      }
      if (selection.length) {
        if (selectable.has(card.id)) setSelected([...selected, card.id])
        return
      }
      const hasTwin = hand.some((c) => c.id !== card.id && c.value === card.value)
      if (playable.has(card.id) && hasTwin) {
        setSelected([card.id])
        return
      }
    }
    if (playable.has(card.id)) playCards(card)
  }

  function playSelection() {
    if (!order) return
    const chosen = selection[selection.length - 1]
    playCards(
      chosen,
      selection.slice(0, -1).map((card) => card.id),
    )
    setSelected([])
  }

  function pickColor(chosen: Color) {
    if (pending?.need === 'color') {
      room.send({
        type: 'play',
        cardId: pending.cardId,
        color: chosen,
        under: pending.under.length ? pending.under : undefined,
      })
    } else room.send({ type: 'chooseColor', color: chosen })
    setPending(null)
  }

  function pickTarget(target: number) {
    if (pending?.need !== 'target') return
    room.send({ type: 'play', cardId: pending.cardId, target, under: pending.under.length ? pending.under : undefined })
    setPending(null)
  }

  const drawnCard = view.drawnId === null ? null : hand.find((card) => card.id === view.drawnId) ?? null
  const answer = top.value === 'draw2' ? '+2 atau +4' : '+4'

  function renderDock() {
    if (phase === 'over') {
      return (
        <>
          <h2 className="dock__title">Ronde selesai</h2>
          <p className="dock__hint">
            {view.winner === me ? 'Kamu' : name(view.winner ?? 0)} menghabiskan kartu dan mendapat{' '}
            <strong>{view.points} poin</strong>.
          </p>
          <div className="dock__actions">
            <button type="button" className="btn btn--primary" onClick={() => setResultClosed(false)}>
              Lihat hasil
            </button>
            {room.isHost && (
              <button type="button" className="btn" onClick={room.start}>
                {lobby.champion !== null ? 'Main lagi dari nol' : 'Ronde berikutnya'}
              </button>
            )}
          </div>
        </>
      )
    }

    if (!myTurn) {
      const hints: Record<string, string> = {
        turn: 'sedang memilih kartu.',
        drawn: 'sedang memutuskan kartu yang baru diambil.',
        color: 'sedang memilih warna pembuka.',
        challenge: `memutuskan menantang Wild Draw Four dari ${name(view.challengeFrom ?? 0)} atau tidak.`,
        stack: `harus membalas dengan ${answer} atau mengambil ${view.pendingDraw} kartu.`,
      }
      return (
        <>
          <h2 className="dock__title">Giliran {name(current)}</h2>
          <p className="dock__hint">
            {name(current)} {hints[phase]}
          </p>
        </>
      )
    }

    if (selection.length) {
      const chosen = selection[selection.length - 1]
      return (
        <>
          <h2 className="dock__title">Keluarkan sekaligus</h2>
          <p className="dock__hint">
            {!order ? (
              phase === 'drawn' ? (
                'Kartu yang baru kamu ambil harus ikut dikeluarkan.'
              ) : (
                'Kartu paling bawah harus cocok dengan buangan. Pilih dulu kartu yang cocok, lalu kartu lainnya.'
              )
            ) : chosen.color === null ? (
              <>
                {selection.length} kartu {valueName(chosen)}. Warnanya cukup dipilih sekali setelah ini.
              </>
            ) : (
              <>
                {selection.length} kartu {valueName(chosen)}. Kartu terakhir yang kamu pilih jadi kartu teratas:{' '}
                <strong>{cardName(chosen)}</strong>.
              </>
            )}
          </p>
          <div className="dock__actions">
            <button type="button" className="btn btn--primary" disabled={!order} onClick={playSelection}>
              Keluarkan {selection.length} kartu
            </button>
            <button type="button" className="btn" onClick={() => setSelected([])}>
              Batal
            </button>
          </div>
        </>
      )
    }

    switch (phase) {
      case 'turn': {
        return (
          <>
            <h2 className="dock__title">Giliranmu</h2>
            <p className="dock__hint">
              {indonesian
                ? playable.size > 0
                  ? 'Klik kartu yang menyala untuk mengeluarkannya. Punya kartu bernilai sama (angka atau simbol)? Pilih beberapa untuk dikeluarkan sekaligus.'
                  : 'Tidak ada kartu yang cocok. Ambil kartu terus sampai dapat yang cocok, lalu keluarkan.'
                : playable.size > 0
                  ? 'Klik kartu yang menyala untuk mengeluarkannya, atau ambil 1 kartu.'
                  : 'Tidak ada kartu yang cocok. Ambil 1 kartu dari tumpukan.'}
            </p>
            {canDraw && (
              <div className="dock__actions">
                <button
                  type="button"
                  className={`btn ${playable.size ? '' : 'btn--primary'}`}
                  onClick={() => room.send({ type: 'draw' })}
                >
                  {indonesian ? 'Ambil sampai dapat' : 'Ambil 1 kartu'}
                </button>
              </div>
            )}
          </>
        )
      }
      case 'stack':
        return (
          <>
            <h2 className="dock__title">Kena +{view.pendingDraw}!</h2>
            <p className="dock__hint">
              {playable.size > 0
                ? `Balas dengan ${answer} supaya hukumannya menumpuk ke pemain berikutnya, atau terima.`
                : `Tidak ada ${answer} untuk membalas.`}
            </p>
            <div className="dock__actions">
              <button
                type="button"
                className={`btn ${playable.size ? '' : 'btn--primary'}`}
                onClick={() => room.send({ type: 'draw' })}
              >
                Ambil {view.pendingDraw} kartu
              </button>
            </div>
          </>
        )
      case 'drawn':
        return (
          <>
            <h2 className="dock__title">{indonesian ? 'Dapat kartu yang cocok!' : 'Kartu barumu cocok!'}</h2>
            <p className="dock__hint">
              {indonesian ? (
                <>
                  Kartu yang baru diambil <strong>wajib dikeluarkan</strong>.
                  {drawnCard &&
                    hand.some((c) => c.id !== drawnCard.id && c.value === drawnCard.value) &&
                    ' Klik kartunya untuk ikut mengeluarkan kartu lain yang bernilai sama.'}
                </>
              ) : (
                <>
                  Keluarkan <strong>{drawnCard ? 'kartu yang baru diambil' : 'kartunya'}</strong> sekarang, atau simpan
                  dan akhiri giliran.
                </>
              )}
            </p>
            <div className="dock__actions">
              {drawnCard && (
                <button type="button" className="btn btn--primary" onClick={() => playCards(drawnCard)}>
                  Keluarkan
                </button>
              )}
              {!indonesian && (
                <button type="button" className="btn" onClick={() => room.send({ type: 'pass' })}>
                  Simpan
                </button>
              )}
            </div>
          </>
        )
      case 'color':
        return (
          <>
            <h2 className="dock__title">Pilih warna pembuka</h2>
            <p className="dock__hint">Kartu pembuka adalah Wild. Pilih warna, lalu keluarkan kartumu.</p>
          </>
        )
      case 'challenge':
        return (
          <>
            <h2 className="dock__title">Kena Wild Draw Four!</h2>
            <p className="dock__hint">
              {name(view.challengeFrom ?? 0)} mengeluarkan Wild Draw Four. Yakin ia sebenarnya masih punya kartu{' '}
              <strong>{COLOR_NAMES[view.challengeColor ?? color]}</strong>? Tantang: kalau benar, ia yang mengambil 4
              kartu; kalau salah, kamu mengambil 6.
            </p>
            <div className="dock__actions">
              <button type="button" className="btn btn--primary" onClick={() => room.send({ type: 'accept' })}>
                Terima (+4)
              </button>
              <button type="button" className="btn btn--accent" onClick={() => room.send({ type: 'challenge' })}>
                Tantang
              </button>
            </div>
          </>
        )
    }
  }

  return (
    <div className="uno-game">
      <header className="uno-topbar">
        <h1 className="uno-topbar__title">UNO</h1>
        <span className="uno-topbar__mode">{MODE_NAMES[mode]}</span>
        <span className="uno-topbar__room">Room {room.code}</span>
        <div className="uno-topbar__tools">
          <MusicSlot />
          <button
            type="button"
            className="icon-btn uno-topbar__help"
            aria-label="Cara main UNO"
            title="Cara main UNO"
            onClick={() => setRulesOpen(true)}
          >
            ?
          </button>
          <button type="button" className="btn btn--small" onClick={onExit}>
            Keluar
          </button>
        </div>
      </header>

      <div className="uno-game__layout">
        <ul className="uno-opponents" aria-label="Lawan">
          {others.map((seat) => (
            <Opponent
              key={seat}
              view={view}
              seat={seat}
              offline={connected[seat] === false}
              score={lobby.players[seat]?.score ?? 0}
            />
          ))}
        </ul>

        <section
          className={`uno-felt uno-felt--${color}`}
          aria-label="Meja"
          style={{ '--active': `var(--uno-${color})` } as CSSProperties}
        >
          <svg
            className={`uno-felt__ring ${view.direction === -1 ? 'uno-felt__ring--reverse' : ''}`}
            viewBox="0 0 200 200"
            aria-hidden="true"
          >
            <circle cx="100" cy="100" r="86" />
            {/* Ujung panah: ke kanan di atas, ke kiri di bawah (searah jarum jam) */}
            <path d="M114 14 l-14 -9 v18 z" />
            <path d="M86 186 l14 9 v-18 z" />
          </svg>

          <button
            type="button"
            className="uno-pile"
            disabled={!canDraw}
            onClick={() => room.send({ type: 'draw' })}
            aria-label={
              myTurn && phase === 'stack'
                ? `Ambil ${view.pendingDraw} kartu hukuman`
                : `Tumpukan ambil, ${view.drawCount} kartu`
            }
          >
            <span className="uno-pile__stack">
              <CardBack size="pile" />
            </span>
            <span className="uno-pile__label">{view.drawCount} kartu</span>
          </button>

          <div className="uno-discard">
            <UnoCard
              key={top.id}
              card={top}
              size="pile"
              className="uno-card--enter"
              // Tiap kartu buangan sedikit miring, supaya tumpukannya terlihat alami.
              style={{ rotate: `${(Math.abs(top.id * 37) % 15) - 7}deg` }}
            />
            {view.pendingDraw > 0 && (
              <span key={view.pendingDraw} className="uno-stack-badge" title="Hukuman yang menumpuk">
                +{view.pendingDraw}
              </span>
            )}
            <span className="uno-pile__label">Buangan</span>
          </div>

          <div className="uno-status">
            <span className="uno-status__color">
              <span className="uno-status__dot" aria-hidden="true" />
              {COLOR_NAMES[color]}
            </span>
            <span className="uno-status__dir">
              {view.direction === 1 ? '↻ Searah jarum jam' : '↺ Berlawanan arah'}
            </span>
          </div>
        </section>

        <section className="uno-hand-area" aria-label="Kartumu">
          <h2 className="uno-hand-area__title">
            Kartumu ({hand.length})
            {declared && <span className="uno-badge">UNO</span>}
            {view.dealer === me && (
              <span className="uno-seat__dealer" title="Pembagi kartu">
                D
              </span>
            )}
          </h2>
          <div
            className={`uno-hand ${myTurn ? 'uno-hand--turn' : ''}`}
            style={{ '--overlap': handOverlap(hand.length) } as CSSProperties}
          >
            {hand.map((card) => {
              const position = selected.indexOf(card.id)
              const clickable = multi ? selectable.has(card.id) || position >= 0 : playable.has(card.id)
              return (
                // Slot tidak ikut terangkat saat kartu di-hover, supaya kartu tidak naik-turun di bawah kursor.
                // Klik di celah bawah kartu yang terangkat mengenai slot, jadi tetap memilih kartunya.
                <span
                  key={card.id}
                  className="uno-hand__slot"
                  onClick={(event) => event.target === event.currentTarget && clickable && clickCard(card)}
                >
                  <UnoCard
                    card={card}
                    onClick={clickable ? () => clickCard(card) : undefined}
                    playable={clickable && position < 0}
                    selected={position >= 0}
                    dimmed={canAct && !clickable}
                    fresh={card.id === view.drawnId}
                  />
                  {position >= 0 && (
                    <span className="uno-hand__order" aria-hidden="true">
                      {position === selected.length - 1 ? 'atas' : position + 1}
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        </section>

        {/* Panel aksi, riwayat, dan skor: kolom samping di layar lebar (lihat uno.css). */}
        <div className="uno-side">
          <section className="card uno-dock" aria-live="polite">
            {absent.length > 0 && phase !== 'over' && (
              <p className="dock__notice" role="status">
                <strong>{absent.join(', ')}</strong> terputus.{' '}
                {players.length - absent.length >= 2
                  ? 'Gilirannya dijalankan otomatis sampai tersambung kembali.'
                  : 'Permainan menunggu sampai ada yang tersambung kembali.'}
              </p>
            )}
            {room.deadline !== null && phase !== 'over' && (
              <TurnTimer key={room.deadline} deadline={room.deadline} total={lobby.turnSeconds} />
            )}
            {renderDock()}
            {(canCallUno || catchable !== null) && (
              <div className="dock__actions">
                {canCallUno && (
                  <button
                    type="button"
                    className={`uno-call ${view.vulnerable === me ? 'uno-call--urgent' : ''}`}
                    onClick={() => room.send({ type: 'uno', seat: me })}
                  >
                    UNO!
                  </button>
                )}
                {catchable !== null && (
                  <button
                    type="button"
                    className="uno-call uno-call--catch"
                    onClick={() => room.send({ type: 'catch', seat: me, target: catchable })}
                  >
                    Tangkap {name(catchable)}!
                  </button>
                )}
              </div>
            )}
          </section>
          <section className="card uno-log" aria-label="Riwayat">
            <h2 className="scoreboard__title">Riwayat</h2>
            <ol>
              {view.log.map((entry, i) => (
                <li key={`${view.log.length}-${i}-${entry}`}>{entry}</li>
              ))}
            </ol>
          </section>
          <section className="card uno-scores" aria-label="Papan skor">
            <h2 className="scoreboard__title">Skor (target {TARGET_SCORE})</h2>
            <ol className="scoreboard__list">
              {lobby.players
                .map((player, i) => ({ ...player, seat: i }))
                .sort((a, b) => b.score - a.score)
                .map((entry) => (
                  <li key={entry.seat}>
                    {entry.name}
                    {entry.seat === me && ' (kamu)'}
                    <span className="scoreboard__wins">{entry.score}</span>
                  </li>
                ))}
            </ol>
          </section>
        </div>
      </div>

      <ColorPicker
        open={pending?.need === 'color' || (myTurn && phase === 'color')}
        onPick={pickColor}
        onCancel={pending?.need === 'color' ? () => setPending(null) : undefined}
      />
      <PlayerPicker
        open={pending?.need === 'target'}
        players={others.map((seat) => ({ seat, name: name(seat), count: players[seat].count }))}
        onPick={pickTarget}
        onCancel={() => setPending(null)}
      />
      <RulesDialog open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <UnoResultDialog
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
