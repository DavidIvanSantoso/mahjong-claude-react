import { useEffect, useState, type CSSProperties } from 'react'
import { formatPoints, scoreWin } from '../game/scoring'
import {
  canDeclareWin,
  kongOptions,
  seatWind,
  type Action,
  type Claim,
  type GameState,
} from '../game/state'
import { sortTiles, tileDescription, tileName, windName } from '../game/tiles'
import { t } from '../i18n'
import { DealerRoll } from './DealerRoll'
import { LanguagePicker } from './LanguagePicker'
import { MusicSlot } from './MusicPlayer'
import { ResultDialog } from './ResultDialog'
import { Seat } from './Seat'
import { useGameSfx } from './sfx'
import { ThemePicker } from './ThemePicker'
import { TileView, WIND_GLYPHS } from './TileView'
import { TutorialDialog } from './TutorialScreen'

interface GameTableProps {
  state: GameState
  dispatch: (action: Action) => void
  onExit: () => void
  /** Mulai ronde baru dengan pemain yang sama; kosong kalau perangkat ini tidak berhak. */
  onRestart?: () => void
  /**
   * Mode online: kursi milik perangkat ini. Meja tidak berputar dan hanya tangan sendiri
   * yang terlihat. Tanpa ini, meja dipakai bergantian di satu perangkat.
   */
  viewer?: number
  roomCode?: string
  /** Mode online: status koneksi tiap pemain. */
  connected?: boolean[]
  /**
   * Skor tiap pemain sejak permainan dimulai; papan skor hanya tampil kalau ini diisi.
   * Normal: jumlah ronde yang dimenangkan. Hong Kong Points: total poin.
   */
  scores?: number[]
  /** Batas waktu aksi yang sedang berjalan (detik); sudah dipercepat kalau `rush`. */
  turnSeconds: number
  /** Time attack sedang berlangsung: ada pemain yang hampir menang. */
  rush?: boolean
  /** Kapan waktu aksi yang sedang ditunggu habis (ms); null selama tidak ada yang dihitung. */
  deadline: number | null
}

/** Kursi (0 bawah, 1 kanan, 2 atas, 3 kiri) untuk tiap pemain, tergantung jumlah pemain. */
const SEAT_POSITIONS: Record<number, number[]> = {
  2: [0, 2],
  3: [0, 1, 2],
  4: [0, 1, 2, 3],
}

/**
 * Lebar kolam buangan (kolom) dan pembagi ukuran ubinnya terhadap sisi meja.
 * Makin sedikit pemain, makin banyak buangan per orang, jadi kolamnya makin lebar.
 */
const POND_LAYOUT: Record<number, { cols: number; divisor: number }> = {
  2: { cols: 15, divisor: 25 },
  3: { cols: 8, divisor: 36 },
  4: { cols: 6, divisor: 28 },
}

function claimLabel(claim: Claim): string {
  if (claim.type === 'win') return t('menang (Mahjong)', 'win (Mahjong)')
  if (claim.type === 'chi') return 'Chi'
  return claim.canKong ? 'Pong / Kong' : 'Pong'
}

/**
 * Sudut putar meja yang terus bertambah (tidak di-reset ke 0), supaya meja selalu
 * berputar lewat jalur terpendek dan tidak berbalik arah saat kembali ke pemain pertama.
 */
function useTableRotation(target: number): number {
  const [rotation, setRotation] = useState(target)
  let delta = (((target - rotation) % 360) + 360) % 360
  if (delta > 180) delta -= 360
  if (delta !== 0) setRotation(rotation + delta)
  return rotation + delta
}

/** Hitung mundur waktu aksi. Dipasang ulang (lewat `key`) tiap kali batas waktunya berganti. */
function TurnTimer({ deadline, total, rush }: { deadline: number; total: number; rush: boolean }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const left = Math.max(0, deadline - now)
  const seconds = Math.ceil(left / 1000)
  return (
    <div className={`turn-timer ${seconds <= 5 ? 'turn-timer--low' : ''}`} role="timer">
      {rush && <span className="turn-timer__rush">Time attack</span>}
      <span className="turn-timer__bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (left / (total * 1000)) * 100)}%` }} />
      </span>
      <span className="turn-timer__text">
        {seconds} {t('dtk', 's')}
      </span>
    </div>
  )
}

export function GameTable({
  state,
  dispatch,
  onExit,
  onRestart,
  viewer,
  roomCode,
  connected,
  scores,
  turnSeconds,
  rush = false,
  deadline,
}: GameTableProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  // Modal hasil muncul otomatis saat permainan berakhir; pemain boleh menutupnya untuk melihat meja.
  const [resultClosed, setResultClosed] = useState(false)
  const { players, phase, current, lastDiscard } = state
  useGameSfx(state)
  // Ronde baru dimulai: modal hasil ronde berikutnya harus muncul lagi.
  if (phase !== 'over' && resultClosed) setResultClosed(false)
  const claim = state.claims[0]
  const positions = SEAT_POSITIONS[players.length]
  const pond = POND_LAYOUT[players.length]
  const online = viewer !== undefined
  const hk = state.ruleset === 'hk'
  // Urut dari skor tertinggi; yang seri tetap urut kursi.
  const ranking = scores
    ? players
        .map((player, i) => ({ name: player.name, seat: i, score: scores[i] ?? 0 }))
        .sort((a, b) => b.score - a.score)
    : null
  const absent = players.filter((_, i) => connected?.[i] === false).map((player) => player.name)

  // Pemain yang duduk di sisi bawah layar: di mode online selalu diri sendiri,
  // di satu perangkat pemain yang sedang/akan memegang perangkat.
  const facing =
    viewer ??
    (phase === 'claim' && claim ? claim.player : phase === 'over' ? (state.winner ?? current) : current)
  const rotation = useTableRotation(positions[facing] * 90)

  const handVisible = online || phase === 'turn' || (phase === 'claim' && state.claimRevealed)
  const myTurn = phase === 'turn' && current === facing
  const myClaim = phase === 'claim' && claim?.player === facing && state.claimRevealed

  function discard(tileId: number) {
    setSelectedId(null)
    dispatch({ type: 'discard', tileId })
  }

  function renderDock() {
    if (phase === 'roll') {
      return (
        <p className="dock__hint">
          {t('Melempar dadu untuk menentukan siapa yang jalan pertama…', 'Rolling dice to decide who goes first…')}
        </p>
      )
    }

    // Mode online hanya berhenti di fase ini selama menunggu pemain yang terputus.
    if (phase === 'handoff' && online) {
      const name = players[current].name
      return <p className="dock__hint">{t(`Menunggu ${name} tersambung kembali…`, `Waiting for ${name} to reconnect…`)}</p>
    }

    if (phase === 'handoff') {
      const name = players[current].name
      return (
        <>
          <h2 className="dock__title">{t(`Giliran ${name}`, `${name}'s turn`)}</h2>
          <p>
            {t(
              `Berikan perangkat ke ${name}. Tangan pemain lain disembunyikan.`,
              `Pass the device to ${name}. Other players' hands are hidden.`,
            )}
          </p>
          <button type="button" className="btn btn--primary" autoFocus onClick={() => dispatch({ type: 'reveal' })}>
            {t('Ambil ubin & lihat tangan', 'Draw a tile & view hand')}
          </button>
        </>
      )
    }

    if (phase === 'turn' && !myTurn) {
      const name = players[current].name
      return <p className="dock__hint">{t(`Menunggu ${name} membuang ubin…`, `Waiting for ${name} to discard…`)}</p>
    }

    if (phase === 'turn') {
      const player = players[current]
      const drawn = player.hand.find((tile) => tile.id === state.drawnId)
      const selected = player.hand.find((tile) => tile.id === selectedId)
      return (
        <>
          <p className="dock__hint">
            <strong>{online ? t('Giliranmu', 'Your turn') : player.name}</strong> —{' '}
            {t(
              <>
                {drawn ? `kamu mengambil ${tileName(drawn)}` : 'klaim berhasil'}
                {state.flowersDrawn > 0 && ` (+${state.flowersDrawn} bunga, sudah diganti ubin baru)`}. Pilih
                satu ubin untuk dibuang; ketuk dua kali untuk langsung membuang. Kalau waktu habis,{' '}
                {drawn ? 'ubin ambilan ini' : 'ubin paling kanan'} dibuang otomatis.
              </>,
              <>
                {drawn ? `you drew ${tileName(drawn)}` : 'claim successful'}
                {state.flowersDrawn > 0 && ` (+${state.flowersDrawn} flower, already replaced with a new tile)`}.
                Pick a tile to discard; tap it twice to discard right away. If time runs out,{' '}
                {drawn ? 'the drawn tile' : 'the rightmost tile'} is discarded automatically.
              </>,
            )}
          </p>
          <div className="dock__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!selected}
              onClick={() => selected && discard(selected.id)}
            >
              {selected ? t(`Buang ${tileName(selected)}`, `Discard ${tileName(selected)}`) : t('Buang', 'Discard')}
            </button>
            {kongOptions(state).map((option) => (
              <button
                key={option.tile.id}
                type="button"
                className="btn"
                onClick={() => {
                  setSelectedId(null)
                  dispatch({ type: 'kong', tileId: option.tile.id })
                }}
              >
                Kong {tileName(option.tile)}
              </button>
            ))}
            {canDeclareWin(state) && (
              <button type="button" className="btn btn--accent" onClick={() => dispatch({ type: 'declareWin' })}>
                {t('Mahjong! Nyatakan menang', 'Mahjong! Declare win')}
              </button>
            )}
          </div>
        </>
      )
    }

    if (phase === 'claim' && claim && lastDiscard) {
      const claimant = players[claim.player]
      const discarder = players[lastDiscard.from]

      if (online && !myClaim) {
        return (
          <p className="dock__hint dock__offer">
            {lastDiscard.from === viewer ? t('Kamu', 'You') : discarder.name} {t('membuang', 'discarded')}{' '}
            <TileView tile={lastDiscard.tile} size="md" marked /> {t('Menunggu pemain lain…', 'Waiting for other players…')}
          </p>
        )
      }

      if (!state.claimRevealed) {
        return (
          <>
            <h2 className="dock__title">
              {claimant.name} {t('bisa', 'can')} {claimLabel(claim)}
            </h2>
            <p className="dock__offer">
              {discarder.name} {t('membuang', 'discarded')} <TileView tile={lastDiscard.tile} size="md" marked />
              {t(`Berikan perangkat ke ${claimant.name}.`, `Pass the device to ${claimant.name}.`)}
            </p>
            <button type="button" className="btn btn--primary" autoFocus onClick={() => dispatch({ type: 'reveal' })}>
              {t('Lihat tangan', 'View hand')}
            </button>
          </>
        )
      }

      return (
        <>
          <p className="dock__hint dock__offer">
            <strong>{online ? t('Kamu bisa klaim', 'You can claim') : claimant.name}</strong> — {discarder.name}{' '}
            {t('membuang', 'discarded')} <TileView tile={lastDiscard.tile} size="md" marked />{' '}
            {t(`Mau ${claimLabel(claim)}?`, `Want to ${claimLabel(claim)}?`)}
          </p>
          <div className="dock__actions">
            {claim.type === 'win' && (
              <button type="button" className="btn btn--accent" onClick={() => dispatch({ type: 'claim' })}>
                {t('Mahjong! Nyatakan menang', 'Mahjong! Declare win')}
              </button>
            )}
            {claim.type === 'pong' && (
              <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: 'claim' })}>
                Pong
              </button>
            )}
            {claim.type === 'pong' && claim.canKong && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => dispatch({ type: 'claim', kong: true })}
              >
                Kong
              </button>
            )}
            {claim.type === 'chi' &&
              claim.options.map((pair, i) => (
                <button
                  key={i}
                  type="button"
                  className="btn btn--primary btn--tiles"
                  onClick={() => dispatch({ type: 'claim', chiIndex: i })}
                >
                  Chi
                  {sortTiles([...pair, lastDiscard.tile]).map((tile) => (
                    <TileView key={tile.id} tile={tile} size="sm" />
                  ))}
                </button>
              ))}
            <button type="button" className="btn" onClick={() => dispatch({ type: 'pass' })}>
              {t('Lewati', 'Pass')}
            </button>
          </div>
        </>
      )
    }

    // phase === 'over'
    const winner = state.winner === null ? null : players[state.winner]
    const score = scoreWin(state)
    return (
      <>
        <h2 className="dock__title">
          {winner ? t(`${winner.name} menang!`, `${winner.name} wins!`) : t('Seri', 'Draw')}
        </h2>
        <p>
          {!winner && t('Dinding habis tanpa pemenang.', 'The wall ran out with no winner.')}
          {winner && state.winType === 'self' && t('Menang dari ubin yang diambil sendiri.', 'Won on a self-drawn tile.')}
          {winner &&
            state.winType === 'discard' &&
            lastDiscard &&
            t(`Menang dari buangan ${players[lastDiscard.from].name}.`, `Won on ${players[lastDiscard.from].name}'s discard.`)}
          {score && t(` ${score.faan} faan = ${score.base} poin dasar.`, ` ${score.faan} faan = ${score.base} base points.`)}
          {!onRestart && t(' Menunggu host memulai ronde baru…', ' Waiting for the host to start a new round…')}
        </p>
        <div className="dock__actions">
          {onRestart && (
            <button type="button" className="btn btn--primary" onClick={onRestart}>
              {t('Main lagi', 'Play again')}
            </button>
          )}
          <button type="button" className="btn" onClick={() => setResultClosed(false)}>
            {t('Lihat hasil', 'View result')}
          </button>
          <button type="button" className="btn" onClick={onExit}>
            {online ? t('Keluar dari room', 'Leave room') : t('Ganti pemain', 'Change players')}
          </button>
        </div>
      </>
    )
  }

  const layoutVars = {
    '--pond-cols': pond.cols,
    '--pond-divisor': pond.divisor,
  } as CSSProperties

  return (
    <div className={`game ${players.length === 2 ? 'game--duo' : ''}`} style={layoutVars}>
      <header className="topbar">
        <h1 className="topbar__title">Mahjong</h1>
        {(roomCode || hk) && (
          <span className="topbar__room">
            {[roomCode && `Room ${roomCode}`, hk && t(`Ronde ${windName(state.roundWind)}`, `${windName(state.roundWind)} round`)]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
        <div className="topbar__tools">
          <MusicSlot />
          <ThemePicker ruleset={state.ruleset} />
          <LanguagePicker />
        </div>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            const question = online
              ? t('Keluar dari room ini?', 'Leave this room?')
              : t('Akhiri permainan ini dan kembali ke menu awal?', 'End this game and return to the main menu?')
            if (phase === 'over' || window.confirm(question)) onExit()
          }}
        >
          {online ? t('Keluar', 'Leave') : t('Permainan baru', 'New game')}
        </button>
      </header>

      <div className="felt">
        {phase === 'roll' && <DealerRoll state={state} viewer={viewer} />}
        <div className="board" style={{ transform: `rotate(${rotation}deg)` }}>
          <div className="center">
            {players.map((player, i) => {
              const offline = connected?.[i] === false
              const active = phase !== 'over' && i === current
              return (
                <div key={i} className="center__seat" style={{ transform: `rotate(${-positions[i] * 90}deg)` }}>
                  <span
                    className={[
                      'center__name',
                      active && 'center__name--active',
                      offline && 'center__name--offline',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={offline ? t(`${player.name} terputus`, `${player.name} disconnected`) : undefined}
                  >
                    {/* Hong Kong Points: angin kursi di depan nama; Timur adalah bandar. */}
                    {hk && `${WIND_GLYPHS[seatWind(state, i)]} `}
                    {player.name}
                  </span>
                </div>
              )
            })}
            {/* Diputar balik supaya angka sisa dinding selalu tegak. */}
            <div className="center__wall" style={{ transform: `rotate(${-rotation}deg)` }}>
              <strong>{state.wall.length}</strong>
              <span>{t('sisa ubin', 'tiles left')}</span>
            </div>
          </div>

          {players.map((player, i) => {
            const isViewer = handVisible && i === facing
            const interactive = isViewer && myTurn
            return (
              <Seat
                key={i}
                player={player}
                position={positions[i]}
                faceUp={isViewer || phase === 'over'}
                large={isViewer || (phase === 'over' && i === facing)}
                drawnId={state.drawnId}
                lastDiscardId={lastDiscard?.tile.id ?? null}
                selectedId={interactive ? selectedId : null}
                // Mode online: meja tidak berputar, jadi buangan semua pemain dibuat tegak menghadap
                // pemain ini. Putaran bersih kursi di layar = rotation - posisi*90; dibalik di sini.
                pondFaceTurn={online ? (((positions[i] * 90 - rotation) % 360) + 360) % 360 : 0}
                onTileClick={
                  interactive
                    ? (tileId) => (tileId === selectedId ? discard(tileId) : setSelectedId(tileId))
                    : undefined
                }
              />
            )
          })}
        </div>
      </div>

      {/* Hanya tampil di layar lebar (lihat index.css). */}
      <aside className="card last-discard" aria-label={t('Buangan terakhir', 'Last discard')}>
        <h2 className="last-discard__title">{t('Buangan terakhir', 'Last discard')}</h2>
        {lastDiscard ? (
          <>
            <TileView tile={lastDiscard.tile} size="zoom" />
            <p className="last-discard__name">{tileName(lastDiscard.tile)}</p>
            <p>
              {t('Dibuang oleh', 'Discarded by')} {players[lastDiscard.from].name}
            </p>
            <p className="last-discard__desc">{tileDescription(lastDiscard.tile)}</p>
          </>
        ) : (
          <p className="last-discard__desc">{t('Tidak ada ubin buangan yang baru.', 'No recent discard.')}</p>
        )}
      </aside>

      {/* Desktop lebar: tombol di pojok kiri bawah. Layar lain: tombol bulat melayang "?". */}
      <button
        type="button"
        className="help-button"
        aria-label={t('Buka tutorial', 'Open tutorial')}
        onClick={() => setTutorialOpen(true)}
      >
        <span className="help-button__icon" aria-hidden="true">
          ?
        </span>
        <span className="help-button__label">Tutorial</span>
      </button>
      <TutorialDialog ruleset={state.ruleset} open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
      <ResultDialog
        state={state}
        open={phase === 'over' && !resultClosed}
        onClose={() => setResultClosed(true)}
        onExit={onExit}
        onRestart={onRestart}
        viewer={viewer}
      />

      <section className="card dock" aria-live="polite">
        {absent.length > 0 && phase !== 'over' && (
          <p className="dock__notice" role="status">
            <strong>{absent.join(', ')}</strong> {t('keluar dari permainan.', 'left the game.')}{' '}
            {players.length - absent.length >= 2
              ? t('Gilirannya dilewati sampai tersambung kembali.', 'Their turns are skipped until they reconnect.')
              : t('Permainan menunggu sampai ada yang tersambung kembali.', 'The game is paused until someone reconnects.')}
          </p>
        )}
        {deadline !== null && phase !== 'over' && phase !== 'roll' && (
          <TurnTimer key={deadline} deadline={deadline} total={turnSeconds} rush={rush} />
        )}
        {renderDock()}
      </section>

      {ranking && (
        <section className="card scoreboard" aria-label={t('Papan skor', 'Scoreboard')}>
          <h2 className="scoreboard__title">Player Scoreboard:</h2>
          <ol className="scoreboard__list">
            {ranking.map((entry) => (
              <li key={entry.seat}>
                {entry.name}
                {(hk || entry.score > 0) && (
                  <span className={`scoreboard__wins ${entry.score < 0 ? 'scoreboard__wins--minus' : ''}`}>
                    {formatPoints(entry.score)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
