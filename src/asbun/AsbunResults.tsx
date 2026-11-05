import { Confetti } from '../components/Confetti'
import { Icon } from './Icons'
import { suspectNo } from './AsbunLobby'
import type { AsbunRoom } from './net'
import { ROLE_NAMES } from './roles'
import type { Winner } from './state'
import { DIFFICULTY_NAMES } from './words'

const PAPER_CONFETTI = ['#b69a62', '#e9e1d1', '#8d4141', '#778675', '#bdb4a4']

const VERDICT: Record<Winner['reason'], string> = {
  guess: 'Si Asbun menebak kata Warga dengan tepat.',
  parity: 'Jumlah Penyusup menyamai pemain lain. Kota jatuh ke tangan mereka.',
  cleared: 'Semua Penyusup dan Si Asbun berhasil diungkap.',
  survived: 'Penyusup sudah habis, tapi Si Asbun berhasil bertahan sampai tinggal berdua.',
}

const SIDE_TITLE: Record<Winner['side'], string> = {
  warga: 'Warga menang',
  penyusup: 'Penyusup menang',
  asbun: 'Si Asbun menang',
}

/** Kasus ditutup: pemenang, semua peran, kedua kata, dan riwayat lengkap. */
export function AsbunResults({ room, onExit }: { room: AsbunRoom; onExit: () => void }) {
  const view = room.view!
  const me = room.seat
  const winner = view.winner
  const won = winner?.seats.includes(me) ?? false
  const category = room.lobby.categories.find((c) => c.id === view.words?.category)?.name ?? view.words?.category
  const rounds = Array.from({ length: view.round }, (_, i) => i + 1)

  return (
    <div className="as-results">
      {won && <Confetti colors={PAPER_CONFETTI} />}
      <section className="as-card as-results__verdict" aria-live="polite">
        <span className="as-stamp as-results__stamp" aria-hidden="true">
          Ditutup
        </span>
        <p className="as-eyebrow">Putusan akhir · Kasus No. {room.code}</p>
        <h1 className="as-title">{winner ? SIDE_TITLE[winner.side] : 'Kasus ditutup'}</h1>
        {winner && <p>{VERDICT[winner.reason]}</p>}
        <p className="as-results__you">{won ? 'Kamu ada di pihak pemenang.' : 'Kamu tidak ada di pihak pemenang kali ini.'}</p>
        {view.words && (
          <dl className="as-results__words">
            <div>
              <dt>Kata Warga</dt>
              <dd>{view.words.warga}</dd>
            </div>
            <div>
              <dt>Kata Penyusup</dt>
              <dd>{view.words.penyusup}</dd>
            </div>
            <div>
              <dt>Kategori</dt>
              <dd className="as-results__small">
                {category} · {DIFFICULTY_NAMES[view.words.difficulty]}
              </dd>
            </div>
          </dl>
        )}
        <div className="as-results__actions">
          {room.isHost ? (
            <>
              <button type="button" className="as-btn as-btn--primary" onClick={room.start}>
                Main lagi
              </button>
              <button type="button" className="as-btn" onClick={room.toLobby}>
                Kembali ke lobi
              </button>
            </>
          ) : (
            <p className="as-hint">Menunggu host memulai kasus baru atau kembali ke lobi…</p>
          )}
          <button type="button" className="as-btn as-btn--ghost" onClick={onExit}>
            <Icon name="door" /> Keluar room
          </button>
        </div>
      </section>

      <section className="as-card" aria-labelledby="as-roles-title">
        <h2 id="as-roles-title" className="as-section-title">
          Identitas para tersangka
        </h2>
        <ul className="as-reveal-list">
          {view.players.map((player, i) => (
            <li key={i} className={winner?.seats.includes(i) ? 'as-reveal-list__win' : ''}>
              <span>
                <span className="as-suspect__no">{suspectNo(i)}</span> {player.name}
                {i === me && ' (kamu)'}
              </span>
              <span className={`as-tag ${player.role === 'warga' ? 'as-tag--sage' : player.role === 'penyusup' ? 'as-tag--blood' : 'as-tag--gold'}`}>
                {player.role ? ROLE_NAMES[player.role] : '?'}
              </span>
              <span className="as-muted">
                {player.alive ? 'Bertahan' : `Keluar di ronde ${player.out}`}
                {winner?.seats.includes(i) && ' · menang'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="as-card" aria-labelledby="as-history-title">
        <h2 id="as-history-title" className="as-section-title">
          Kronologi
        </h2>
        {rounds.map((round) => {
          const result = view.results.find((r) => r.round === round)
          const guess = view.guesses.find((g) => g.round === round)
          return (
            <div key={round} className="as-evidence__round">
              <h3 className="as-eyebrow">Ronde {round}</h3>
              <ol className="as-evidence__list">
                {view.clues
                  .filter((clue) => clue.round === round)
                  .map((clue) => (
                    <li key={clue.by}>
                      <span className="as-evidence__who">
                        {suspectNo(clue.by)} {view.players[clue.by].name}
                      </span>
                      {clue.text === null ? <em className="as-muted">tidak memberi petunjuk</em> : <q className="as-evidence__text">{clue.text}</q>}
                    </li>
                  ))}
              </ol>
              {result && (
                <p className="as-history__vote">
                  Voting:{' '}
                  {result.eliminated === null
                    ? !result.ballots
                      ? 'tidak ada suara'
                      : result.skips > Math.max(...result.tally)
                        ? `mayoritas skip (${result.skips} dari ${result.ballots} suara), tidak ada yang keluar`
                        : 'seri, tidak ada yang keluar'
                    : `${view.players[result.eliminated].name} keluar (${result.tally[result.eliminated]} dari ${result.ballots} suara)`}
                  .
                </p>
              )}
              {guess && (
                <p className="as-history__vote">
                  Tebakan Si Asbun: {guess.text === null ? 'tidak sempat menebak' : `"${guess.text}"`} — {guess.correct ? 'tepat' : 'salah'}.
                </p>
              )}
            </div>
          )
        })}
      </section>
    </div>
  )
}
