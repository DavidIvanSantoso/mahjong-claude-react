import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { MusicSlot } from '../components/MusicPlayer'
import type { BomKataRoom, BomKataView } from './net'
import { PixelArrow, PixelBlast, PixelBomb, PixelFace, PixelHeart } from './Pixel'
import { BomKataResultDialog, GuideDialog } from './BomKataDialogs'
import { sfx, toggleSfx, useSfxEnabled } from './sfx'
import { categoryLabel, LIVES, WORD_MAX } from './state'

/** Jeda detak bom per tingkat panas (ms). */
const TICK_MS = [1400, 800, 400, 160]
/** Lama animasi undian kategori sebelum kategori terpilih ditampilkan. */
const ROLL_MS = 1600

/** Sudut kursi di meja bundar: kursi sendiri di bawah, lalu searah jarum jam (sama dengan urutan giliran). */
function seatAngle(seat: number, me: number, n: number): number {
  return 90 + (((seat - me + n) % n) * 360) / n
}

/** Sudut panah yang terus bertambah, supaya panah selalu berputar searah jarum jam ke pemain berikutnya. */
function useArrowAngle(target: number): number {
  const [angle, setAngle] = useState(target)
  let delta = (((target - angle) % 360) + 360) % 360
  // Mundur sedikit (mis. kursi sebelumnya) tetap lewat jalur terpendek.
  if (delta > 270) delta -= 360
  if (delta !== 0) setAngle(angle + delta)
  return angle + delta
}

/** Undian kategori ala mesin slot: nama-nama kategori bergulir cepat, lalu berhenti di yang terpilih. */
function CategoryRoller({
  names,
  final,
  twist,
  round,
  rolling,
}: {
  names: string[]
  final: string
  twist?: string
  round: number
  rolling: boolean
}) {
  const [shown, setShown] = useState(final)
  const [spinning, setSpinning] = useState(false)

  useEffect(() => {
    if (!rolling || names.length < 2) {
      setShown(final)
      return
    }
    setSpinning(true)
    const started = Date.now()
    const id = setInterval(() => {
      if (Date.now() - started >= ROLL_MS) {
        clearInterval(id)
        setShown(final)
        setSpinning(false)
        return
      }
      setShown(names[Math.floor(Math.random() * names.length)])
      sfx.roll()
    }, 80)
    return () => clearInterval(id)
    // Hanya diulang saat ronde baru dimulai.
  }, [round])

  return (
    <div className={`bk-category ${spinning ? 'bk-category--rolling' : ''}`} aria-live="polite">
      <span className="bk-category__label">Kategori</span>
      <strong className="bk-category__name">{spinning ? shown : final}</strong>
      {/* Tantangan muncul setelah undian berhenti, seperti kejutan */}
      {twist && !spinning && <span className="bk-category__twist">{twist}</span>}
    </div>
  )
}

function Seat({ view, seat, me, offline, wins }: { view: BomKataView; seat: number; me: number; offline: boolean; wins: number }) {
  const player = view.players[seat]
  const angle = (seatAngle(seat, me, view.players.length) * Math.PI) / 180
  const out = player.lives === 0
  const holding = view.current === seat && (view.phase === 'play' || view.phase === 'ready')
  const hit = view.exploded === seat && (view.phase === 'boom' || view.phase === 'over')
  return (
    <li
      className={['bk-seat', holding && 'bk-seat--turn', out && 'bk-seat--out', hit && 'bk-seat--hit', seat === me && 'bk-seat--me']
        .filter(Boolean)
        .join(' ')}
      style={{ '--x': `${50 + 41 * Math.cos(angle)}%`, '--y': `${50 + 41 * Math.sin(angle)}%` } as CSSProperties}
      title={offline ? `${player.name} terputus` : undefined}
    >
      <PixelFace seat={seat} out={out} />
      <span className="bk-seat__name">
        {player.name}
        {seat === me && ' (kamu)'}
      </span>
      <span className="bk-seat__lives" aria-label={`${player.lives} nyawa`}>
        {Array.from({ length: LIVES }, (_, i) => (
          <PixelHeart key={i} full={i < player.lives} />
        ))}
      </span>
      {wins > 0 && <span className="bk-seat__wins">★{wins}</span>}
      {offline && <span className="bk-seat__offline">terputus</span>}
    </li>
  )
}

function feedbackText(view: BomKataView): string {
  const fb = view.feedback
  if (!fb) return ''
  const who = view.players[fb.by]?.name ?? ''
  if (fb.ok) return `✓ ${fb.word.toUpperCase()}`
  if (fb.reason === 'used') return `✗ "${fb.word}" sudah dipakai`
  if (fb.reason === 'empty') return `✗ ${who} belum mengetik apa-apa`
  return `✗ "${fb.word}" bukan ${categoryLabel(view.category) || 'kategori ini'}`
}

export function BomKataTable({ room, onExit }: { room: BomKataRoom; onExit: () => void }) {
  const view = room.view!
  const { lobby, seat: me } = room
  const [text, setText] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)
  const [resultClosed, setResultClosed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sfxOn = useSfxEnabled()
  const { players, phase, current, heat } = view
  const n = players.length
  const myTurn = phase === 'play' && current === me
  const alive = players[me]?.lives > 0
  const arrow = useArrowAngle(seatAngle(current, me, n))
  const holder = players[current]?.name ?? ''
  if (phase !== 'over' && resultClosed) setResultClosed(false)

  // Giliran sendiri: kotak ketik langsung siap dipakai.
  useEffect(() => {
    if (myTurn) inputRef.current?.focus()
    else setText('')
  }, [myTurn])

  // Detak bom, makin cepat saat makin panas.
  useEffect(() => {
    if (phase !== 'play') return
    const id = setInterval(() => sfx.tick(heat), TICK_MS[heat])
    return () => clearInterval(id)
  }, [phase, heat])

  // Bunyi jawaban benar/salah.
  const fbKey = view.feedback ? `${view.round}-${view.feedback.seq}` : ''
  useEffect(() => {
    if (!view.feedback) return
    if (view.feedback.ok) sfx.ok()
    else sfx.wrong()
  }, [fbKey])

  // Bunyi ledakan, dan fanfare untuk pemenang.
  const boomKey = view.exploded !== null && (phase === 'boom' || phase === 'over') ? `${view.round}` : ''
  useEffect(() => {
    if (!boomKey) return
    sfx.boom()
    if (phase === 'over' && view.winner === me) setTimeout(() => sfx.win(), 700)
  }, [boomKey])

  function type(value: string) {
    const next = value.slice(0, WORD_MAX)
    setText(next)
    room.send({ type: 'type', text: next })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!myTurn) return
    room.send({ type: 'submit', word: text })
    setText('')
  }

  const showBlast = view.exploded !== null && (phase === 'boom' || phase === 'over')
  const hitName = view.exploded !== null ? players[view.exploded]?.name : ''
  const fb = feedbackText(view)

  return (
    <div className="bk-game">
      <header className="bk-topbar">
        <h1 className="bk-topbar__title">KA-BOOM!</h1>
        <span className="bk-topbar__room">ROOM {room.code}</span>
        <div className="bk-topbar__tools">
          <MusicSlot />
          <button
            type="button"
            className="icon-btn bk-icon-btn"
            aria-pressed={sfxOn}
            aria-label={sfxOn ? 'Matikan efek suara' : 'Nyalakan efek suara'}
            title={sfxOn ? 'Efek suara: nyala' : 'Efek suara: mati'}
            onClick={toggleSfx}
          >
            {sfxOn ? '♪' : '×'}
          </button>
          <button type="button" className="icon-btn bk-icon-btn" aria-label="Cara main" title="Cara main" onClick={() => setGuideOpen(true)}>
            ?
          </button>
          <button type="button" className="btn btn--small" onClick={onExit}>
            Keluar
          </button>
        </div>
      </header>

      <div className="bk-game__layout">
        <div className="bk-main">
          <CategoryRoller
            names={lobby.categoryNames}
            final={view.category?.name ?? '…'}
            twist={view.category?.twist}
            round={view.round}
            rolling={phase === 'ready'}
          />

          <section className="bk-arena" aria-label="Meja bundar">
            <div className="bk-arena__table" aria-hidden="true" />
            <ul className="bk-arena__seats">
              {players.map((_, seat) => (
                <Seat
                  key={seat}
                  view={view}
                  seat={seat}
                  me={me}
                  offline={lobby.players[seat]?.connected === false}
                  wins={lobby.players[seat]?.wins ?? 0}
                />
              ))}
            </ul>

            <div className="bk-arena__center">
              {phase !== 'over' && (
                <div className="bk-arrow" style={{ transform: `rotate(${arrow}deg)` }} aria-hidden="true">
                  <PixelArrow className="bk-arrow__art" />
                </div>
              )}
              <PixelBomb heat={heat} lit={phase === 'play'} className={showBlast ? 'bk-bomb--gone' : ''} />
              {showBlast && (
                <div key={view.round} className="bk-blast">
                  <PixelBlast className="bk-blast__art" />
                  <strong className="bk-blast__text">DUAR!</strong>
                </div>
              )}
            </div>

          </section>

          <section className="bk-console" aria-live="polite">
            {phase === 'ready' && <p className="bk-status">Siap-siap… {holder} memegang bom</p>}
            {phase === 'play' && (
              <>
                <p className="bk-status">{myTurn ? 'GILIRANMU!' : `${holder} mengetik:`}</p>
                <p className="bk-typing">
                  {(myTurn ? text : view.typing) || ' '}
                  <span className="bk-typing__cursor">_</span>
                </p>
              </>
            )}
            {phase === 'boom' && (
              <p className="bk-status bk-status--danger">
                {hitName} {players[view.exploded ?? 0]?.lives ? 'kehilangan 1 nyawa!' : 'gugur!'}
              </p>
            )}
            {phase === 'over' && (
              <p className="bk-status bk-status--win">{view.winner !== null ? `${players[view.winner].name} MENANG!` : 'Selesai'}</p>
            )}
            {fb && phase === 'play' && (
              <p key={fbKey} className={`bk-feedback ${view.feedback?.ok ? 'bk-feedback--ok' : 'bk-feedback--bad'}`}>
                {fb}
              </p>
            )}
          </section>

          <form className="bk-input" onSubmit={submit}>
            <input
              ref={inputRef}
              type="text"
              value={myTurn ? text : ''}
              onChange={(event) => type(event.target.value)}
              disabled={!myTurn}
              maxLength={WORD_MAX}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Ketik kata"
              placeholder={
                !alive
                  ? 'Kamu sudah gugur, tonton saja'
                  : myTurn
                    ? `Ketik ${categoryLabel(view.category).toLowerCase() || 'kata'}, lalu Enter`
                    : phase === 'play'
                      ? `Tunggu giliranmu (${holder})`
                      : 'Tunggu ronde dimulai'
              }
            />
            <button type="submit" className="bk-btn" disabled={!myTurn || !text.trim()}>
              KIRIM
            </button>
          </form>
        </div>

        <aside className="bk-side">
          <section className="bk-panel">
            <h2 className="bk-panel__title">Kata terpakai ({view.used.length})</h2>
            {view.used.length ? (
              <ul className="bk-used">
                {view.used.map((word) => (
                  <li key={word}>{word}</li>
                ))}
              </ul>
            ) : (
              <p className="bk-panel__empty">Belum ada.</p>
            )}
          </section>
          <section className="bk-panel">
            <h2 className="bk-panel__title">Riwayat</h2>
            <ol className="bk-log">
              {view.log.map((entry, i) => (
                <li key={`${view.log.length}-${i}-${entry}`}>{entry}</li>
              ))}
            </ol>
          </section>
          {room.isHost && phase === 'over' && (
            <button type="button" className="bk-btn bk-btn--wide" onClick={room.start}>
              MAIN LAGI
            </button>
          )}
        </aside>
      </div>

      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
      <BomKataResultDialog
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
