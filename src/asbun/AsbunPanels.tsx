import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from './Icons'
import { initials, suspectNo } from './AsbunLobby'
import { REACTION_COOLDOWN_MS, type AsbunLobby } from './net'
import { ROLE_NAMES, type Role } from './roles'
import { guessResolved, REACTIONS, SKIP_VOTE, type AsbunView, type PlayerAction } from './state'
import { CLUE_MAX, GUESS_MAX } from './words'

export const ROLE_BRIEF: Record<Role, string> = {
  warga: 'Katamu sama dengan sebagian besar pemain. Beri petunjuk yang cukup jelas untuk sesama Warga, tapi jangan sampai Si Asbun bisa menebak katanya.',
  penyusup: 'Katamu mirip tapi berbeda dari kata Warga, dan kamu tidak tahu kata mereka. Berbaurlah supaya tidak dicurigai.',
  asbun: 'Kamu tidak punya kata, hanya kategorinya. Simak petunjuk, tebak kata Warga, dan berbaurlah. Kalau tereliminasi, kamu mendapat satu kesempatan menebak kata Warga.',
}

/** Sisa detik sampai `deadline` (jam perangkat ini), diperbarui beberapa kali per detik. */
export function useSecondsLeft(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline === null) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [deadline])
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
}

export function Countdown({ deadline }: { deadline: number | null }) {
  const left = useSecondsLeft(deadline)
  if (left === null) return null
  const text = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
  return (
    <span className={`as-countdown ${left <= 10 ? 'as-countdown--low' : ''}`} role="timer" aria-label={`Sisa waktu ${left} detik`}>
      <Icon name="clock" /> {text}
    </span>
  )
}

/** Berkas pribadi: peran dan kata rahasia pemain ini, bisa disembunyikan saat layar dilihat orang lain. */
/** `category`: nama kategori pasangan kata, terbuka untuk semua peran (termasuk Si Asbun). */
export function Dossier({ view, category, compact }: { view: AsbunView; category: string; compact?: boolean }) {
  const [hidden, setHidden] = useState(false)
  const { role, word } = view.me
  return (
    <section className={`as-dossier ${compact ? 'as-dossier--compact' : ''}`} aria-label="Berkas rahasiamu">
      <header className="as-dossier__head">
        <span className="as-eyebrow">Berkas pribadi · jangan diperlihatkan</span>
        <button type="button" className="as-link" aria-pressed={hidden} onClick={() => setHidden(!hidden)}>
          <Icon name={hidden ? 'eye' : 'eyeOff'} /> {hidden ? 'Tampilkan' : 'Sembunyikan'}
        </button>
      </header>
      {hidden ? (
        <p className="as-dossier__veil">Berkas disembunyikan.</p>
      ) : (
        <>
          <p className="as-dossier__role">
            Peran: <strong>{ROLE_NAMES[role]}</strong>
          </p>
          <p className="as-dossier__category">
            Kategori: <strong>{category}</strong>
          </p>
          {word ? (
            <p className="as-dossier__word">
              <span className="as-eyebrow">Kata rahasia</span>
              <strong>{word}</strong>
            </p>
          ) : (
            <p className="as-dossier__word as-dossier__word--none">
              <span className="as-eyebrow">Kata rahasia</span>
              <strong>— tidak ada —</strong>
            </p>
          )}
          {!compact && <p className="as-dossier__brief">{ROLE_BRIEF[role]}</p>}
        </>
      )}
    </section>
  )
}

/** Fase `reveal`: berkas tertutup dulu, dibuka sendiri, lalu "Mengerti". */
export function RevealPanel({ view, category, send }: { view: AsbunView; category: string; send: (action: PlayerAction) => void }) {
  const [open, setOpen] = useState(false)
  const acknowledged = view.players.filter((p) => p.acknowledged).length
  return (
    <section className="as-card as-reveal">
      {!open ? (
        <div className="as-reveal__closed">
          <p className="as-eyebrow">Berkas rahasia untukmu</p>
          <span className="as-stamp" aria-hidden="true">
            Rahasia
          </span>
          <p>Pastikan tidak ada yang melihat layarmu, lalu buka berkasnya.</p>
          <button type="button" className="as-btn as-btn--primary" onClick={() => setOpen(true)}>
            Buka berkas
          </button>
        </div>
      ) : (
        <div className="as-reveal__open">
          <Dossier view={view} category={category} />
          <AckButton view={view} send={send} />
        </div>
      )}
      <p className="as-hint" aria-live="polite">
        {acknowledged}/{view.players.length} pemain sudah siap.
      </p>
    </section>
  )
}

function AckButton({ view, send }: { view: AsbunView; send: (action: PlayerAction) => void }) {
  const [sent, setSent] = useState(false)
  return (
    <button
      type="button"
      className="as-btn as-btn--primary"
      disabled={sent}
      onClick={() => {
        setSent(true)
        send({ type: 'ack', round: view.round, phase: view.phase })
      }}
    >
      {sent ? 'Menunggu pemain lain…' : 'Saya mengerti'}
    </button>
  )
}

interface RosterProps {
  view: AsbunView
  lobby: AsbunLobby
  me: number
}

/** Daftar tersangka: status aktif/tereliminasi (dengan peran yang dibuka), giliran, dan suara. */
export function Roster({ view, lobby, me }: RosterProps) {
  const speaker = view.phase === 'clue' ? view.order[view.turn] : null
  // Reaksi terakhir tiap pemain, ditampilkan sebagai gelembung yang memudar.
  const latest = new Map(view.phase === 'discussion' ? view.reactions.map((r) => [r.by, r] as const) : [])
  return (
    <section className="as-card" aria-labelledby="as-roster-title">
      <h2 id="as-roster-title" className="as-section-title">
        Tersangka
      </h2>
      <ul className="as-roster">
        {view.players.map((player, i) => {
          const status = !player.alive
            ? `Tereliminasi${player.role ? ` · ${ROLE_NAMES[player.role]}` : ''}`
            : speaker === i
              ? 'Sedang memberi petunjuk'
              : view.phase === 'voting'
                ? view.voted[i]
                  ? 'Sudah memilih'
                  : 'Belum memilih'
                : 'Aktif'
          return (
            <li
              key={i}
              className={['as-roster__item', !player.alive && 'as-roster__item--out', speaker === i && 'as-roster__item--turn', i === me && 'as-roster__item--me']
                .filter(Boolean)
                .join(' ')}
            >
              <span className="as-avatar" aria-hidden="true">
                {player.alive ? initials(player.name) : <Icon name="skull" />}
              </span>
              <span className="as-roster__body">
                <span className="as-roster__name">
                  <span className="as-suspect__no">{suspectNo(i)}</span> {player.name}
                  {i === me && ' (kamu)'}
                  {i === 0 && <Icon name="host" className="as-roster__host" />}
                  {latest.get(i) && (
                    <span key={latest.get(i)!.seq} className="as-bubble" aria-label={`Reaksi ${latest.get(i)!.emoji}`}>
                      {latest.get(i)!.emoji}
                    </span>
                  )}
                </span>
                <span className="as-roster__status">
                  {status}
                  {view.phase === 'voting' && player.alive && view.voted[i] && <Icon name="check" />}
                  {lobby.players[i]?.connected === false && ' · terputus'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Riwayat petunjuk, dikelompokkan per ronde (terbaru di atas). */
export function ClueHistory({ view, me }: { view: AsbunView; me: number }) {
  const rounds = [...new Set(view.clues.map((clue) => clue.round))].sort((a, b) => b - a)
  return (
    <section className="as-card as-evidence" aria-labelledby="as-evidence-title">
      <h2 id="as-evidence-title" className="as-section-title">
        Catatan petunjuk
      </h2>
      {rounds.length === 0 && <p className="as-muted">Belum ada petunjuk.</p>}
      {rounds.map((round) => (
        <div key={round} className="as-evidence__round">
          <h3 className="as-eyebrow">Ronde {round}</h3>
          <ol className="as-evidence__list">
            {view.clues
              .filter((clue) => clue.round === round)
              .map((clue) => (
                <li key={`${round}-${clue.by}`} className={clue.by === me ? 'as-evidence__mine' : ''}>
                  <span className="as-evidence__who">
                    {suspectNo(clue.by)} {view.players[clue.by].name}
                  </span>
                  {clue.text === null ? <em className="as-muted">tidak memberi petunjuk</em> : <q className="as-evidence__text">{clue.text}</q>}
                </li>
              ))}
          </ol>
        </div>
      ))}
    </section>
  )
}

export function ClueForm({ view, send }: { view: AsbunView; send: (action: PlayerAction) => void }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const turnKey = `${view.round}-${view.turn}`
  // Penolakan dari host (mis. petunjuk berisi kata sendiri) membuka form lagi.
  useEffect(() => setSending(false), [turnKey, view.notice?.seq])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    send({ type: 'clue', round: view.round, phase: view.phase, text: text.trim() })
  }

  return (
    <form className="as-clue-form" onSubmit={submit}>
      <label className="as-field">
        <span>Petunjukmu (satu kata atau frasa pendek)</span>
        <div className="as-field__row">
          <input
            type="text"
            value={text}
            maxLength={CLUE_MAX}
            autoFocus
            autoComplete="off"
            onChange={(event) => setText(event.target.value)}
            placeholder="mis. dingin"
            aria-describedby="as-clue-count"
          />
          <button type="submit" className="as-btn as-btn--primary" disabled={!text.trim() || sending}>
            <Icon name="pen" /> Kirim
          </button>
        </div>
      </label>
      <p id="as-clue-count" className="as-hint">
        {text.length}/{CLUE_MAX} karakter · jangan sebut kata rahasiamu sendiri.
      </p>
      {view.notice && (
        <p key={view.notice.seq} className="as-notice" role="alert">
          {view.notice.text}
        </p>
      )}
    </form>
  )
}

/** Voting rahasia: pilih satu tersangka aktif (bukan diri sendiri), lalu kunci pilihan. */
export function VotePanel({ view, me, send }: { view: AsbunView; me: number; send: (action: PlayerAction) => void }) {
  const [choice, setChoice] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const alive = view.players[me]?.alive
  const candidates = view.players.flatMap((player, i) => (player.alive && i !== me ? [i] : []))
  const votedCount = view.voted.filter(Boolean).length
  const activeCount = view.players.filter((p) => p.alive).length

  if (!alive) return <p className="as-muted">Kamu sudah tereliminasi dan tidak ikut memilih.</p>
  if (view.myVote !== null) {
    return (
      <div className="as-vote-done" aria-live="polite">
        <p>
          <Icon name="check" /> Suaramu terkunci:{' '}
          <strong>{view.myVote === SKIP_VOTE ? 'Skip (tidak menuduh siapa pun)' : view.players[view.myVote].name}</strong>
        </p>
        <p className="as-hint">
          {votedCount}/{activeCount} pemain sudah memilih. Hasil dibuka setelah semua memilih atau waktu habis.
        </p>
      </div>
    )
  }
  return (
    <div className="as-vote">
      <p className="as-hint">
        Pilihanmu rahasia. Kamu bisa mengganti pilihan sampai menekan "Kunci suara". Belum yakin? Pilih skip: kalau skip
        mendapat suara terbanyak, tidak ada yang dieliminasi.
      </p>
      <ul className="as-vote__list" role="radiogroup" aria-label="Pilih tersangka">
        {candidates.map((seat) => (
          <li key={seat}>
            <button
              type="button"
              role="radio"
              aria-checked={choice === seat}
              className={`as-vote__option ${choice === seat ? 'as-vote__option--on' : ''}`}
              onClick={() => setChoice(seat)}
            >
              <span className="as-avatar" aria-hidden="true">
                {initials(view.players[seat].name)}
              </span>
              <span>
                <span className="as-suspect__no">{suspectNo(seat)}</span> {view.players[seat].name}
              </span>
              {choice === seat && <span className="as-stamp as-stamp--small">Tuduh</span>}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            role="radio"
            aria-checked={choice === SKIP_VOTE}
            className={`as-vote__option as-vote__option--skip ${choice === SKIP_VOTE ? 'as-vote__option--on' : ''}`}
            onClick={() => setChoice(SKIP_VOTE)}
          >
            <span className="as-avatar" aria-hidden="true">
              –
            </span>
            <span>
              Skip vote
              <span className="as-suspect__no as-vote__sub">Belum bisa menentukan</span>
            </span>
            {choice === SKIP_VOTE && <span className="as-stamp as-stamp--small as-stamp--sage">Skip</span>}
          </button>
        </li>
      </ul>
      <button
        type="button"
        className="as-btn as-btn--danger"
        disabled={choice === null || sending}
        onClick={() => {
          if (choice === null) return
          setSending(true)
          send({ type: 'vote', round: view.round, phase: view.phase, target: choice })
        }}
      >
        <Icon name="ballot" /> {choice === SKIP_VOTE ? 'Kunci skip' : 'Kunci suara'}
      </button>
      <p className="as-hint">
        {votedCount}/{activeCount} pemain sudah memilih.
      </p>
    </div>
  )
}

/** Hasil voting terakhir: jumlah suara (bukan siapa memilih siapa) dan siapa yang keluar. */
export function VoteResultPanel({ view }: { view: AsbunView }) {
  const result = view.results[view.results.length - 1]
  if (!result) return null
  const out = result.eliminated
  const rows = result.tally.map((count, seat) => ({ seat, count })).filter((row) => row.count > 0).sort((a, b) => b.count - a.count)
  const outRole = out !== null ? view.players[out].role : null
  return (
    <div className="as-verdict" aria-live="polite">
      {out === null ? (
        <>
          <p className="as-verdict__title">
            {!result.ballots ? 'Tidak ada suara' : result.skips > Math.max(...result.tally) ? 'Mayoritas memilih skip' : 'Suara seri'}
          </p>
          <p className="as-muted">Tidak ada yang dieliminasi. Penyelidikan berlanjut ke ronde berikutnya.</p>
        </>
      ) : (
        <>
          <p className="as-verdict__title">{view.players[out].name} dieliminasi</p>
          <p className="as-verdict__role">
            Peran: <span className={`as-stamp ${outRole === 'warga' ? 'as-stamp--sage' : ''}`}>{outRole ? ROLE_NAMES[outRole] : '?'}</span>
          </p>
        </>
      )}
      {(rows.length > 0 || result.skips > 0) && (
        <ul className="as-tally">
          {rows.map((row) => (
            <li key={row.seat}>
              <span>
                {suspectNo(row.seat)} {view.players[row.seat].name}
              </span>
              <span className="as-tally__bar" style={{ width: `${(row.count / Math.max(1, result.ballots)) * 100}%` }} aria-hidden="true" />
              <strong>{row.count} suara</strong>
            </li>
          ))}
          {result.skips > 0 && (
            <li className="as-tally__skip">
              <span>Skip vote</span>
              <span className="as-tally__bar" style={{ width: `${(result.skips / Math.max(1, result.ballots)) * 100}%` }} aria-hidden="true" />
              <strong>{result.skips} suara</strong>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/** Tebakan Si Asbun: satu kesempatan untuk pemain yang baru tereliminasi. */
export function GuessPanel({ view, me, send }: { view: AsbunView; me: number; send: (action: PlayerAction) => void }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const guesser = view.eliminated
  const resolved = guessResolved(view)
  if (guesser === null) return null
  const name = guesser === me ? 'Kamu' : view.players[guesser].name

  if (resolved) {
    return (
      <div className="as-verdict" aria-live="polite">
        <p className="as-verdict__title">{resolved.correct ? 'Tebakan tepat!' : 'Tebakan salah'}</p>
        <p className="as-muted">
          {resolved.text === null
            ? resolved.hidden
              ? `${name} menebak, tapi salah.`
              : `${name} tidak sempat menebak.`
            : `${name} menebak "${resolved.text}".`}
          {!resolved.correct && ' Penyelidikan berlanjut.'}
        </p>
      </div>
    )
  }
  if (guesser !== me) {
    return (
      <div className="as-verdict" aria-live="polite">
        <p className="as-verdict__title">{view.players[guesser].name} adalah Si Asbun!</p>
        <p className="as-muted">Ia sedang menebak kata Warga. Kalau tepat, Si Asbun langsung menang.</p>
      </div>
    )
  }
  return (
    <form
      className="as-guess"
      onSubmit={(event) => {
        event.preventDefault()
        if (!text.trim() || sending) return
        setSending(true)
        send({ type: 'guess', round: view.round, phase: view.phase, text: text.trim() })
      }}
    >
      <p className="as-verdict__title">Kesempatan terakhirmu</p>
      <p>Kamu ketahuan sebagai Si Asbun. Tebak kata Warga — hanya satu kali. Kalau tepat, kamu langsung menang.</p>
      <label className="as-field">
        <span>Kata Warga menurutmu</span>
        <div className="as-field__row">
          <input type="text" value={text} maxLength={GUESS_MAX} autoFocus autoComplete="off" onChange={(event) => setText(event.target.value)} />
          <button type="submit" className="as-btn as-btn--primary" disabled={!text.trim() || sending}>
            Tebak
          </button>
        </div>
      </label>
      <p className="as-hint">Huruf besar/kecil, spasi, dan tanda hubung tidak berpengaruh. Sinonim tidak diterima.</p>
    </form>
  )
}

/** Reaksi emoji saat diskusi: tombol emoji untuk pemain aktif dan umpan reaksi yang terlihat semua pemain. */
export function ReactionPanel({ view, me, send }: { view: AsbunView; me: number; send: (action: PlayerAction) => void }) {
  const [cooling, setCooling] = useState(false)
  const alive = view.players[me]?.alive
  const recent = view.reactions.slice(-8).reverse()

  function react(emoji: string) {
    if (cooling) return
    setCooling(true)
    setTimeout(() => setCooling(false), REACTION_COOLDOWN_MS)
    send({ type: 'react', round: view.round, phase: view.phase, emoji })
  }

  return (
    <div className="as-reactions">
      {alive ? (
        <div className="as-reactions__bar" role="group" aria-label="Kirim reaksi">
          {REACTIONS.map((emoji) => (
            <button key={emoji} type="button" className="as-reactions__btn" disabled={cooling} onClick={() => react(emoji)} aria-label={`Kirim ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
      ) : (
        <p className="as-hint">Pemain yang sudah tereliminasi hanya bisa melihat reaksi.</p>
      )}
      <ol className="as-reactions__feed" aria-live="polite" aria-label="Reaksi terbaru">
        {recent.length === 0 && <li className="as-muted">Belum ada reaksi. Tunjukkan kecurigaanmu!</li>}
        {recent.map((r) => (
          <li key={r.seq} className={r.by === me ? 'as-reactions__mine' : ''}>
            <span className="as-reactions__emoji">{r.emoji}</span>
            <span>
              {suspectNo(r.by)} {view.players[r.by]?.name}
              {r.by === me && ' (kamu)'}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
