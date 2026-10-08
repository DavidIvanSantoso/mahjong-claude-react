import { useState, type CSSProperties } from 'react'
import { canDeclareWin, kongOptions, type Action, type Claim, type GameState } from '../game/state'
import { sortTiles, tileDescription, tileName } from '../game/tiles'
import { Seat } from './Seat'
import { TileView } from './TileView'

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
  if (claim.type === 'win') return 'menang (Mahjong)'
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

export function GameTable({
  state,
  dispatch,
  onExit,
  onRestart,
  viewer,
  roomCode,
  connected,
}: GameTableProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { players, phase, current, lastDiscard } = state
  const claim = state.claims[0]
  const positions = SEAT_POSITIONS[players.length]
  const pond = POND_LAYOUT[players.length]
  const online = viewer !== undefined
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
    // Mode online hanya berhenti di fase ini selama menunggu pemain yang terputus.
    if (phase === 'handoff' && online) {
      return <p className="dock__hint">Menunggu {players[current].name} tersambung kembali…</p>
    }

    if (phase === 'handoff') {
      const name = players[current].name
      return (
        <>
          <h2 className="dock__title">Giliran {name}</h2>
          <p>Berikan perangkat ke {name}. Tangan pemain lain disembunyikan.</p>
          <button type="button" className="btn btn--primary" autoFocus onClick={() => dispatch({ type: 'reveal' })}>
            Ambil ubin & lihat tangan
          </button>
        </>
      )
    }

    if (phase === 'turn' && !myTurn) {
      return <p className="dock__hint">Menunggu {players[current].name} membuang ubin…</p>
    }

    if (phase === 'turn') {
      const player = players[current]
      const drawn = player.hand.find((tile) => tile.id === state.drawnId)
      const selected = player.hand.find((tile) => tile.id === selectedId)
      return (
        <>
          <p className="dock__hint">
            <strong>{online ? 'Giliranmu' : player.name}</strong> —{' '}
            {drawn ? `kamu mengambil ${tileName(drawn)}` : 'klaim berhasil'}
            {state.flowersDrawn > 0 && ` (+${state.flowersDrawn} bunga, sudah diganti ubin baru)`}. Pilih
            satu ubin untuk dibuang; ketuk dua kali untuk langsung membuang.
          </p>
          <div className="dock__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!selected}
              onClick={() => selected && discard(selected.id)}
            >
              {selected ? `Buang ${tileName(selected)}` : 'Buang'}
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
                Mahjong! Nyatakan menang
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
            {lastDiscard.from === viewer ? 'Kamu' : discarder.name} membuang{' '}
            <TileView tile={lastDiscard.tile} size="md" marked /> Menunggu pemain lain…
          </p>
        )
      }

      if (!state.claimRevealed) {
        return (
          <>
            <h2 className="dock__title">
              {claimant.name} bisa {claimLabel(claim)}
            </h2>
            <p className="dock__offer">
              {discarder.name} membuang <TileView tile={lastDiscard.tile} size="md" marked />
              Berikan perangkat ke {claimant.name}.
            </p>
            <button type="button" className="btn btn--primary" autoFocus onClick={() => dispatch({ type: 'reveal' })}>
              Lihat tangan
            </button>
          </>
        )
      }

      return (
        <>
          <p className="dock__hint dock__offer">
            <strong>{online ? 'Kamu bisa klaim' : claimant.name}</strong> — {discarder.name} membuang{' '}
            <TileView tile={lastDiscard.tile} size="md" marked /> Mau {claimLabel(claim)}?
          </p>
          <div className="dock__actions">
            {claim.type === 'win' && (
              <button type="button" className="btn btn--accent" onClick={() => dispatch({ type: 'claim' })}>
                Mahjong! Nyatakan menang
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
              Lewati
            </button>
          </div>
        </>
      )
    }

    // phase === 'over'
    const winner = state.winner === null ? null : players[state.winner]
    return (
      <>
        <h2 className="dock__title">{winner ? `${winner.name} menang!` : 'Seri'}</h2>
        <p>
          {!winner && 'Dinding habis tanpa pemenang.'}
          {winner && state.winType === 'self' && 'Menang dari ubin yang diambil sendiri.'}
          {winner &&
            state.winType === 'discard' &&
            lastDiscard &&
            `Menang dari buangan ${players[lastDiscard.from].name}.`}
          {!onRestart && ' Menunggu host memulai ronde baru…'}
        </p>
        <div className="dock__actions">
          {onRestart && (
            <button type="button" className="btn btn--primary" onClick={onRestart}>
              Main lagi
            </button>
          )}
          <button type="button" className="btn" onClick={onExit}>
            {online ? 'Keluar dari room' : 'Ganti pemain'}
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
        {roomCode && <span className="topbar__room">Room {roomCode}</span>}
        <button
          type="button"
          className="btn btn--small"
          onClick={() => {
            const question = online
              ? 'Keluar dari room ini?'
              : 'Akhiri permainan ini dan kembali ke menu awal?'
            if (phase === 'over' || window.confirm(question)) onExit()
          }}
        >
          {online ? 'Keluar' : 'Permainan baru'}
        </button>
      </header>

      <div className="felt">
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
                    title={offline ? `${player.name} terputus` : undefined}
                  >
                    {player.name}
                  </span>
                </div>
              )
            })}
            {/* Diputar balik supaya angka sisa dinding selalu tegak. */}
            <div className="center__wall" style={{ transform: `rotate(${-rotation}deg)` }}>
              <strong>{state.wall.length}</strong>
              <span>sisa ubin</span>
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
      <aside className="card last-discard" aria-label="Buangan terakhir">
        <h2 className="last-discard__title">Buangan terakhir</h2>
        {lastDiscard ? (
          <>
            <TileView tile={lastDiscard.tile} size="zoom" />
            <p className="last-discard__name">{tileName(lastDiscard.tile)}</p>
            <p>Dibuang oleh {players[lastDiscard.from].name}</p>
            <p className="last-discard__desc">{tileDescription(lastDiscard.tile)}</p>
          </>
        ) : (
          <p className="last-discard__desc">Tidak ada ubin buangan yang baru.</p>
        )}
      </aside>

      <section className="card dock" aria-live="polite">
        {absent.length > 0 && phase !== 'over' && (
          <p className="dock__notice" role="status">
            <strong>{absent.join(', ')}</strong> keluar dari permainan.{' '}
            {players.length - absent.length >= 2
              ? 'Gilirannya dilewati sampai tersambung kembali.'
              : 'Permainan menunggu sampai ada yang tersambung kembali.'}
          </p>
        )}
        {renderDock()}
      </section>
    </div>
  )
}
