import { useEffect, useState, type ReactNode } from 'react'
import { MusicSlot } from '../components/MusicPlayer'
import { ArmadaResultDialog, GuideDialog } from './ArmadaDialogs'
import { canArm, PlayerCard, SkillPanel, SpPips, TargetRoller, visibleShips, type PickMode } from './ArmadaHud'
import { ArmadaPlacement } from './ArmadaPlacement'
import { Board } from './Board'
import { areaCells, cellLabel, PRESETS, type Cell } from './grid'
import { TURN_SECONDS, type ArmadaRoom } from './net'
import { sfx, toggleSfx, useSfxEnabled } from './sfx'
import { TimerBar } from './Timer'
import { SkillIcon } from './Pixel'
import { MINE_CONFIG } from './skills'
import type { ArmadaView, LastShot } from './state'

const RESULT_TEXT: Record<LastShot['result'], string> = {
  miss: 'MELESET!',
  hit: 'KENA!',
  sunk: 'TENGGELAM!',
  mine: 'RANJAU!',
}

function resultDetail(view: ArmadaView, last: LastShot, me: number): string {
  const size = PRESETS[view.preset].size
  const owner = last.target === me ? 'milikmu' : `milik ${view.players[last.target].name}`
  const where = cellLabel(last.cell, size)
  if (last.result === 'mine') {
    const shooter = last.by === me ? 'papanmu' : `papan ${view.players[last.by].name}`
    const hits = last.blasts?.filter((blast) => blast.result !== 'miss').length ?? 0
    const sunk = last.blasts?.filter((blast) => blast.ship).map((blast) => blast.ship) ?? []
    return `Ranjau di ${where} meledak: ${last.blasts?.length ?? 0} serangan balik ke ${shooter}, ${hits} kena${sunk.length ? ` · ${sunk.join(', ')} tenggelam` : ''}${last.selfOut ? ` — ${last.by === me ? 'kamu' : view.players[last.by].name} gugur!` : ''}`
  }
  if (last.result === 'sunk') return `${last.ship} ${owner} tenggelam${last.out ? ` — ${last.target === me ? 'kamu' : view.players[last.target].name} gugur!` : ''}`
  return `${view.players[last.by].name} menembak ${where}`
}

/** Teks status di atas papan, sesuai fase. */
function statusText(view: ArmadaView, me: number): string {
  const name = (seat: number | null) => (seat === null ? '' : view.players[seat].name)
  switch (view.phase) {
    case 'start':
      return 'Semua armada siap. Pertempuran dimulai!'
    case 'target':
      return 'Mengundi target…'
    case 'aim':
      if (view.attacker === me) return view.shotsLeft > 1 ? `GILIRANMU! Tembakan Ganda: ${view.shotsLeft} tembakan` : `GILIRANMU! Pilih sel di papan ${name(view.target)}`
      if (view.target === me) return `${name(view.attacker)} sedang membidik papanmu!`
      return `${name(view.attacker)} membidik papan ${name(view.target)}`
    case 'over':
      return view.winner === me ? 'KAMU MENANG!' : view.winner !== null ? `${name(view.winner)} MENANG!` : 'Selesai'
    default:
      return ''
  }
}

export function ArmadaTable({ room, onExit }: { room: ArmadaRoom; onExit: () => void }) {
  const view = room.view!
  const { lobby, seat: me } = room
  const { size } = PRESETS[view.preset]
  const sfxOn = useSfxEnabled()
  const [guideOpen, setGuideOpen] = useState(false)
  const [resultClosed, setResultClosed] = useState(false)
  const [inspect, setInspect] = useState<number | null>(null)
  const [pick, setPick] = useState<PickMode>(null)
  const { phase, attacker, target, last } = view
  const myAim = phase === 'aim' && attacker === me
  const turnKey = `${view.round}-${view.turn}`
  if (phase !== 'over' && resultClosed) setResultClosed(false)
  const mine = view.players[me]
  const armable = mine.alive && ['start', 'target', 'aim', 'result'].includes(phase) && (mine.mines?.length ?? 0) < MINE_CONFIG.limit
  if ((pick === 'sonar' && (!myAim || view.sonarUsed)) || (pick === 'mine' && !armable)) setPick(null)
  const sonarMode = pick === 'sonar'
  const mineMode = pick === 'mine'

  // Giliran baru: papan besar kembali mengikuti target.
  useEffect(() => setInspect(null), [turnKey])

  useEffect(() => {
    if (myAim) sfx.turn()
  }, [myAim])

  useEffect(() => {
    if (!last) return
    sfx[last.result]()
    if (last.out || last.selfOut) sfx.out()
  }, [last?.seq])

  useEffect(() => {
    if (phase === 'over' && view.winner === me) setTimeout(() => sfx.win(), 900)
  }, [phase])

  if (phase === 'placement') {
    return (
      <Shell room={room} onExit={onExit} sfxOn={sfxOn} onGuide={() => setGuideOpen(true)} guideOpen={guideOpen} onGuideClose={() => setGuideOpen(false)}>
        <ArmadaPlacement room={room} />
      </Shell>
    )
  }

  // Ranjau meledak: semua pemain melihat papan penyerang yang terkena serangan balik.
  const mineBlast = last?.result === 'mine' && (phase === 'result' || phase === 'over') ? last : null
  const focus = mineMode ? me : myAim ? target! : (inspect ?? mineBlast?.by ?? target ?? me)
  const focused = view.players[focus]
  const shooting = myAim && focus === target && !mineMode
  const marks = new Map<Cell, string>()
  const mark = (cell: Cell, cls: string) => marks.set(cell, `${marks.get(cell) ?? ''} ${cls}`)
  if (view.sonar && view.sonar.target === focus) areaCells(view.sonar.center, size).forEach((cell) => mark(cell, 'ar-cell--sonar'))
  if (last && last.target === focus && phase !== 'target' && !mineMode) mark(last.cell, 'ar-cell--last')
  if (mineBlast && mineBlast.by === focus && !mineMode) mineBlast.blasts?.forEach((blast) => mark(blast.cell, 'ar-cell--last ar-cell--blast'))
  const showResult =
    last &&
    !mineMode &&
    (phase === 'aim' || phase === 'result' || phase === 'over') &&
    last.by === attacker &&
    (last.target === focus || mineBlast?.by === focus)

  function onCell(cell: Cell) {
    if (mineMode) {
      sfx.arm()
      room.send({ type: 'skill', skill: 'mine', center: cell })
      setPick(null)
    } else if (sonarMode) {
      sfx.skill()
      room.send({ type: 'skill', skill: 'sonar', center: cell })
    } else room.send({ type: 'fire', cell })
  }

  return (
    <Shell room={room} onExit={onExit} sfxOn={sfxOn} onGuide={() => setGuideOpen(true)} guideOpen={guideOpen} onGuideClose={() => setGuideOpen(false)}>
      <div className="ar-layout">
        <div className="ar-main">
          <section className="ar-banner" aria-live="polite">
            <span className="ar-banner__round">RONDE {Math.max(1, view.round)}</span>
            {phase !== 'start' && phase !== 'over' && <TargetRoller view={view} me={me} />}
            <p className={`ar-status ${myAim ? 'ar-status--me' : ''}`}>{statusText(view, me)}</p>
            <TimerBar deadline={phase === 'aim' ? room.deadline : null} total={TURN_SECONDS} />
          </section>

          <section className={`ar-panel ar-focus ${shooting || mineMode ? 'ar-focus--shoot' : ''} ${sonarMode ? 'ar-focus--sonar' : ''} ${mineMode ? 'ar-focus--mine' : ''}`}>
            <header className="ar-focus__head">
              <h2 className="ar-panel__title">
                {focus === me ? 'Papanmu' : `Papan ${focused.name}`}
                {focus === target && phase !== 'over' && ' · TARGET'}
              </h2>
              {mineMode && (
                <button type="button" className="ar-btn ar-btn--small" onClick={() => setPick(null)}>
                  BATAL
                </button>
              )}
              {inspect !== null && !myAim && !mineMode && (
                <button type="button" className="ar-btn ar-btn--small" onClick={() => setInspect(null)}>
                  IKUTI GILIRAN
                </button>
              )}
            </header>
            <Board
              size={size}
              label={focus === me ? 'Papanmu' : `Papan ${focused.name}`}
              shots={focused.shots}
              ships={visibleShips(focused)}
              mines={focused.mines ?? []}
              marks={marks}
              cellAction={mineMode ? 'Pasang ranjau di' : sonarMode ? 'Pindai' : 'Tembak'}
              canClick={(cell) => (mineMode ? canArm(focused, cell) : shooting && focused.shots[cell] === null)}
              onCell={shooting || mineMode ? onCell : undefined}
            >
              {showResult && (
                <div key={last.seq} className={`ar-flash ar-flash--${last.result}`}>
                  <strong>{RESULT_TEXT[last.result]}</strong>
                  <span>{resultDetail(view, last, me)}</span>
                </div>
              )}
              {view.sonar && view.sonar.target === focus && (
                <div className="ar-sonar">
                  <SkillIcon skill="sonar" />
                  {view.sonar.count} sel kapal di area {cellLabel(view.sonar.center, size)}
                </div>
              )}
            </Board>
            {sonarMode && <p className="ar-hint">Pilih pusat area 3×3 untuk dipindai Sonar.</p>}
            {mineMode && <p className="ar-hint">Pilih sel kosong di papanmu (bukan kapal) untuk dipasangi ranjau.</p>}
          </section>

          {mine.alive && phase !== 'over' && (
            <SkillPanel view={view} me={me} pick={pick} onPick={setPick} send={room.send} />
          )}

          <section className="ar-players" aria-label="Pemain">
            <ul className="ar-players__list">
              {view.players.map((_, seat) => (
                <PlayerCard
                  key={seat}
                  view={view}
                  seat={seat}
                  me={me}
                  offline={lobby.players[seat]?.connected === false}
                  wins={lobby.players[seat]?.wins ?? 0}
                  focused={seat === focus}
                  onSelect={() => setInspect(seat)}
                />
              ))}
            </ul>
          </section>
        </div>

        <aside className="ar-side">
          {focus !== me && (
            <section className="ar-panel">
              <div className="ar-skills__head">
                <h2 className="ar-panel__title">Armadaku</h2>
                {mine.alive ? <SpPips sp={mine.sp} /> : <span className="ar-card__dead">☠ GUGUR</span>}
              </div>
              <Board variant="medium" size={size} label="Papanmu" shots={mine.shots} ships={visibleShips(mine)} mines={mine.mines ?? []} />
            </section>
          )}
          <section className="ar-panel">
            <h2 className="ar-panel__title">Riwayat</h2>
            <ol className="ar-log">
              {view.log.map((entry, i) => (
                <li key={`${view.log.length}-${i}-${entry}`}>{entry}</li>
              ))}
            </ol>
          </section>
          {room.isHost && phase === 'over' && (
            <button type="button" className="ar-btn ar-btn--wide" onClick={room.start}>
              MAIN LAGI
            </button>
          )}
        </aside>
      </div>

      <ArmadaResultDialog
        view={view}
        lobby={lobby}
        seat={me}
        open={phase === 'over' && !resultClosed}
        onClose={() => setResultClosed(true)}
        onExit={onExit}
        onRestart={room.isHost ? room.start : undefined}
      />
    </Shell>
  )
}

interface ShellProps {
  room: ArmadaRoom
  onExit: () => void
  sfxOn: boolean
  onGuide: () => void
  guideOpen: boolean
  onGuideClose: () => void
  children: ReactNode
}

/** Bingkai halaman permainan: bar atas (judul, kode room, musik, suara, panduan, keluar). */
function Shell({ room, onExit, sfxOn, onGuide, guideOpen, onGuideClose, children }: ShellProps) {
  return (
    <div className="ar-game">
      <header className="ar-topbar">
        <h1 className="ar-topbar__title">ARMADA ROYALE</h1>
        <span className="ar-topbar__room">
          ROOM {room.code} · {PRESETS[room.view?.preset ?? room.lobby.preset].name}
        </span>
        <div className="ar-topbar__tools">
          <MusicSlot />
          <button
            type="button"
            className="icon-btn ar-icon-btn"
            aria-pressed={sfxOn}
            aria-label={sfxOn ? 'Matikan efek suara' : 'Nyalakan efek suara'}
            title={sfxOn ? 'Efek suara: nyala' : 'Efek suara: mati'}
            onClick={toggleSfx}
          >
            {sfxOn ? '♪' : '×'}
          </button>
          <button type="button" className="icon-btn ar-icon-btn" aria-label="Cara main" title="Cara main" onClick={onGuide}>
            ?
          </button>
          <button type="button" className="btn btn--small" onClick={onExit}>
            Keluar
          </button>
        </div>
      </header>
      {children}
      <GuideDialog open={guideOpen} onClose={onGuideClose} />
    </div>
  )
}
