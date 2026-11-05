import { useState } from 'react'
import { MusicSlot } from '../components/MusicPlayer'
import { GuideDialog, LeaveDialog } from './AsbunDialogs'
import { suspectNo } from './AsbunLobby'
import { ClueForm, ClueHistory, Countdown, Dossier, GuessPanel, ReactionPanel, RevealPanel, Roster, VotePanel, VoteResultPanel } from './AsbunPanels'
import { AsbunResults } from './AsbunResults'
import { Icon } from './Icons'
import type { AsbunRoom } from './net'
import type { Phase } from './state'

export const PHASE_NAMES: Record<Phase, string> = {
  reveal: 'Pembukaan berkas',
  clue: 'Putaran petunjuk',
  discussion: 'Diskusi',
  voting: 'Voting rahasia',
  elimination: 'Hasil voting',
  guess: 'Tebakan Si Asbun',
  over: 'Kasus ditutup',
}

export function AsbunTable({ room, onExit }: { room: AsbunRoom; onExit: () => void }) {
  const view = room.view!
  const { lobby, seat: me } = room
  const [guideOpen, setGuideOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const { phase } = view
  const category = lobby.categories.find((c) => c.id === view.category)?.name ?? view.category
  const alive = view.players[me]?.alive
  const speaker = phase === 'clue' ? view.order[view.turn] : null

  function leave() {
    if (phase === 'over') onExit()
    else setLeaving(true)
  }

  function phaseBody() {
    switch (phase) {
      case 'reveal':
        if (view.players[me].acknowledged) {
          const done = view.players.filter((p) => p.acknowledged).length
          return (
            <p className="as-muted" aria-live="polite">
              Berkas sudah kamu baca. Menunggu pemain lain ({done}/{view.players.length})…
            </p>
          )
        }
        return <RevealPanel view={view} category={category} send={room.send} />
      case 'clue':
        if (speaker === me) return <ClueForm view={view} send={room.send} />
        return (
          <p className="as-muted" aria-live="polite">
            Menunggu petunjuk dari <strong>{view.players[speaker ?? 0]?.name}</strong>
            {alive ? '. Simak baik-baik.' : '.'}
          </p>
        )
      case 'discussion':
        return (
          <div className="as-discussion">
            <p>Siapa yang petunjuknya terdengar ragu, terlalu umum, atau sedikit melenceng? Tunjukkan kecurigaanmu lewat reaksi.</p>
            <ReactionPanel view={view} me={me} send={room.send} />
            {room.isHost && (
              <button type="button" className="as-btn" onClick={room.skipDiscussion}>
                <Icon name="ballot" /> Mulai voting sekarang
              </button>
            )}
          </div>
        )
      case 'voting':
        return <VotePanel key={view.round} view={view} me={me} send={room.send} />
      case 'elimination':
        return <VoteResultPanel view={view} />
      case 'guess':
        return <GuessPanel key={view.round} view={view} me={me} send={room.send} />
      default:
        return null
    }
  }

  return (
    <div className="as-game">
      <header className="as-topbar">
        <div className="as-topbar__brand">
          <span className="as-topbar__logo">ASBUN</span>
          <span className="as-eyebrow">Kasus No. {room.code}</span>
        </div>
        <div className="as-topbar__tools">
          <MusicSlot />
          <button type="button" className="icon-btn as-icon-btn" aria-label="Cara bermain" title="Cara bermain" onClick={() => setGuideOpen(true)}>
            ?
          </button>
          <button type="button" className="as-btn as-btn--ghost as-btn--small" onClick={leave}>
            <Icon name="door" /> Keluar
          </button>
        </div>
      </header>

      {phase === 'over' ? (
        <AsbunResults room={room} onExit={onExit} />
      ) : (
        <div className="as-layout">
          <div className="as-main">
            <section className="as-card as-phase" aria-live="polite">
              <header className="as-phase__head">
                <div>
                  <p className="as-eyebrow">{view.round > 0 ? `Ronde ${view.round}` : 'Persiapan'}</p>
                  <h1 className="as-phase__title">{PHASE_NAMES[phase]}</h1>
                  <p className="as-phase__category">
                    Kategori: <strong>{category}</strong>
                  </p>
                </div>
                <Countdown deadline={room.deadline} />
              </header>
              {phase === 'clue' && (
                <ol className="as-order" aria-label="Urutan petunjuk">
                  {view.order.map((seat, i) => (
                    <li key={seat} className={i < view.turn ? 'as-order__done' : i === view.turn ? 'as-order__now' : ''}>
                      {suspectNo(seat)} {view.players[seat].name}
                      {seat === me && ' (kamu)'}
                    </li>
                  ))}
                </ol>
              )}
              {!alive && phase !== 'guess' && (
                <p className="as-banner">Kamu sudah tereliminasi. Kamu tetap bisa mengikuti jalannya kasus, tapi tidak ikut memberi petunjuk atau memilih.</p>
              )}
              {phaseBody()}
            </section>
            <ClueHistory view={view} me={me} />
          </div>

          <aside className="as-side">
            {phase !== 'reveal' && <Dossier view={view} category={category} compact />}
            <Roster view={view} lobby={lobby} me={me} />
            <section className="as-card" aria-labelledby="as-log-title">
              <h2 id="as-log-title" className="as-section-title">
                Catatan penyelidik
              </h2>
              <ol className="as-log">
                {view.log.map((entry, i) => (
                  <li key={`${view.log.length}-${i}-${entry}`}>{entry}</li>
                ))}
              </ol>
            </section>
          </aside>
        </div>
      )}

      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
      <LeaveDialog open={leaving} isHost={room.isHost} onCancel={() => setLeaving(false)} onLeave={onExit} />
    </div>
  )
}
