import { useEffect, useState, type ReactNode } from 'react'
import { MusicSlot } from '../components/MusicPlayer'
import { ArmadaResultDialog, GuideDialog } from './ArmadaDialogs'
import { PlayerCard, SkillPanel, SpPips, TargetRoller, visibleShips } from './ArmadaHud'
import { ArmadaPlacement } from './ArmadaPlacement'
import { Board } from './Board'
import { areaCells, cellLabel, PRESETS, type Cell } from './grid'
import { TURN_SECONDS, type ArmadaRoom } from './net'
import { SkillIcon } from './Pixel'
import { sfx, toggleSfx, useSfxEnabled } from './sfx'
import { TimerBar } from './Timer'
import type { ArmadaView, LastShot } from './state'

const RESULT_TEXT: Record<LastShot['result'], string> = {
  miss: 'MELESET!',
  hit: 'KENA!',
  sunk: 'TENGGELAM!',
  blocked: 'DITAHAN!',
}

function resultDetail(view: ArmadaView, last: LastShot, me: number): string {
  const size = PRESETS[view.preset].size
  const owner = last.target === me ? 'milikmu' : `milik ${view.players[last.target].name}`
  const where = cellLabel(last.cell, size)
  if (last.result === 'blocked') return `Perisai ${last.target === me ? 'kamu' : view.players[last.target].name} menahan tembakan di ${where}`
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
  const [sonarMode, setSonarMode] = useState(false)
  const { phase, attacker, target, last } = view
  const myAim = phase === 'aim' && attacker === me
  const turnKey = `${view.round}-${view.turn}`
  if (phase !== 'over' && resultClosed) setResultClosed(false)
  if (sonarMode && (!myAim || view.sonarUsed)) setSonarMode(false)

  // Giliran baru: papan besar kembali mengikuti target.
  useEffect(() => setInspect(null), [turnKey])

  useEffect(() => {
    if (myAim) sfx.turn()
  }, [myAim])

  useEffect(() => {
    if (!last) return
    sfx[last.result]()
    if (last.out) sfx.out()
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

  const focus = myAim ? target! : (inspect ?? target ?? me)
  const focused = view.players[focus]
  const shooting = myAim && focus === target
  const marks = new Map<Cell, string>()
  if (view.sonar && view.sonar.target === focus) areaCells(view.sonar.center, size).forEach((cell) => marks.set(cell, 'ar-cell--sonar'))
  if (last && last.target === focus && phase !== 'target') marks.set(last.cell, `${marks.get(last.cell) ?? ''} ar-cell--last`)
  const showResult = last && last.target === focus && (phase === 'aim' || phase === 'result' || phase === 'over') && last.by === attacker

  function shoot(cell: Cell) {
    if (sonarMode) {
      sfx.skill()
      room.send({ type: 'skill', skill: 'sonar', center: cell })
    } else room.send({ type: 'fire', cell })
  }

  const mine = view.players[me]
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

          <section className={`ar-panel ar-focus ${shooting ? 'ar-focus--shoot' : ''} ${sonarMode ? 'ar-focus--sonar' : ''}`}>
            <header className="ar-focus__head">
              <h2 className="ar-panel__title">
                {focus === me ? 'Papanmu' : `Papan ${focused.name}`}
                {focus === target && phase !== 'over' && ' · TARGET'}
              </h2>
              {focused.shield && <SkillIcon skill="shield" className="ar-focus__shield" />}
              {inspect !== null && !myAim && (
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
              marks={marks}
              canClick={(cell) => shooting && focused.shots[cell] === null}
              onCell={shooting ? shoot : undefined}
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
          </section>

          {mine.alive && phase !== 'over' && (
            <SkillPanel view={view} me={me} sonarMode={sonarMode} onSonarMode={setSonarMode} send={room.send} />
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
                {mine.shield && <SkillIcon skill="shield" className="ar-card__shield" />}
                {mine.alive ? <SpPips sp={mine.sp} /> : <span className="ar-card__dead">☠ GUGUR</span>}
              </div>
              <Board variant="medium" size={size} label="Papanmu" shots={mine.shots} ships={visibleShips(mine)} />
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
