import { useEffect, useRef, type ReactNode } from 'react'
import { Confetti } from '../components/Confetti'
import { cardFromId, rankLabel, RANKS, sortByRank, SUIT_NAMES, SUITS, type Card } from './cards'
import { CapsaCard, SuitIcon } from './CapsaCard'
import type { CapsaLobby, CapsaView } from './net'

const GOLD_CONFETTI = ['#D4AF37', '#F5D76E', '#F4F4F5', '#B91C1C', '#A1A1AA']

/** Membuka/menutup <dialog> sebagai modal mengikuti `open`, dan memfokuskan tombol utamanya. */
function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      primaryRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])
  return { ref, primaryRef }
}

/** Kartu dari tulisan singkat, mis. "Ks 10h 3d" (angka + d/c/h/s). */
function cards(text: string): Card[] {
  return text.split(' ').map((label) => {
    const rank = ({ J: 11, Q: 12, K: 13, A: 14, '2': 15 } as Record<string, number>)[label.slice(0, -1)] ?? Number(label.slice(0, -1))
    const suit = SUITS[['d', 'c', 'h', 's'].indexOf(label.slice(-1))]
    return cardFromId((rank - 3) * 4 + SUITS.indexOf(suit))
  })
}

function Example({ text }: { text: string }) {
  return (
    <span className="capsa-guide__cards">
      {cards(text).map((card) => (
        <CapsaCard key={card.id} card={card} size="small" />
      ))}
    </span>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tutorial__section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

const COMBOS: { name: string; example: string; text: string }[] = [
  { name: 'Single', example: 'Ks', text: '1 kartu. Dibandingkan angkanya, lalu bunganya.' },
  { name: 'Pair', example: '9h 9s', text: '2 kartu angka sama. Angka lebih tinggi menang; kalau sama, pair dengan bunga tertinggi menang.' },
  { name: 'Tris', example: '7d 7c 7h', text: '3 kartu angka sama. Dibandingkan angkanya.' },
  { name: 'Straight', example: '5d 6c 7h 8s 9d', text: '5 angka berurutan, bunga bebas. A boleh di bawah (A-2-3-4-5) atau di atas (10-J-Q-K-A), tapi tidak J-Q-K-A-2. Dibandingkan kartu tertingginya.' },
  { name: 'Flush', example: '3h 6h 9h Jh Kh', text: '5 kartu satu bunga. Dibandingkan kartu tertingginya.' },
  { name: 'Full House', example: 'Qd Qc Qs 4h 4s', text: 'Tris + pair. Dibandingkan angka trisnya.' },
  { name: 'Four of a Kind', example: '8d 8c 8h 8s 3d', text: '4 kartu angka sama + 1 kartu bebas. Dibandingkan angka keempat kartunya.' },
  { name: 'Straight Flush', example: '9s 10s Js Qs Ks', text: 'Straight dengan satu bunga. Kombinasi 5 kartu tertinggi.' },
]

/** Panduan Capsa: cara main, jenis kombinasi, urutan angka dan bunga. */
export function GuideContent() {
  return (
    <>
      <Section title="Tujuan">
        <p>
          Jadilah yang pertama menghabiskan kartu. Saat ada yang habis, ronde selesai: tiap pemain lain kehilangan poin
          sebanyak sisa kartunya, dan pemenang mendapat semua poin itu.
        </p>
      </Section>
      <Section title="Cara main">
        <ul>
          <li>Dek 52 kartu tanpa Joker; tiap pemain mendapat 13 kartu (2–4 pemain).</li>
          <li>
            Setiap ronde dimulai pemegang <strong>3♦</strong>, dan 3♦ wajib ikut dikeluarkan di giliran pertama. Kalau
            pemainnya kurang dari 4 dan 3♦ tidak terbagi, pemegang kartu terkecil yang memulai.
          </li>
          <li>
            Yang memimpin bebas mengeluarkan kombinasi apa saja. Pemain berikutnya harus mengeluarkan kombinasi dengan
            <strong> jumlah kartu yang sama</strong> dan <strong>lebih tinggi</strong>, atau <strong>lewat</strong>.
          </li>
          <li>
            Yang sudah lewat tidak bisa ikut lagi sampai meja dibersihkan. Kalau semua lawan lewat, pemain terakhir yang
            mengeluarkan kartu bebas memulai kombinasi baru.
          </li>
          <li>
            Tidak ada batas waktu giliran. Pemain yang terputus lebih dari 15 detik otomatis lewat (atau kalau sedang
            memimpin, kartu terkecilnya dikeluarkan) sampai tersambung kembali.
          </li>
        </ul>
      </Section>
      <Section title="Memilih dan menyusun kartu">
        <ul>
          <li>Klik kartu untuk memilih (bisa beberapa), lalu tekan <strong>Keluarkan</strong>.</li>
          <li>Tekan lalu <strong>seret</strong> kartu untuk memindahkan posisinya, supaya mudah menyusun strategi.</li>
          <li>Tombol Urut angka / Urut bunga menyusun ulang semua kartu sekaligus.</li>
          <li>Arahkan kursor (atau ketuk) ke kartu di meja untuk melihat kartu apa saja yang dikeluarkan.</li>
        </ul>
      </Section>
      <Section title="Urutan angka">
        <p>Dari yang terendah ke tertinggi; 2 adalah kartu tertinggi.</p>
        <span className="capsa-guide__cards capsa-guide__ranks">
          {RANKS.map((rank) => (
            <CapsaCard key={rank} card={cardFromId((rank - 3) * 4 + 3)} size="small" />
          ))}
        </span>
      </Section>
      <Section title="Urutan bunga">
        <p>Dipakai saat angkanya sama, dari yang terendah:</p>
        <ol className="capsa-guide__suits">
          {SUITS.map((suit) => (
            <li key={suit} className={suit === 'hearts' || suit === 'diamonds' ? 'capsa-guide__suit--red' : ''}>
              <SuitIcon suit={suit} />
              {SUIT_NAMES[suit]}
            </li>
          ))}
        </ol>
        <p>
          Jadi 3♦ adalah kartu terkecil dan 2♠ kartu terbesar. Contoh: {rankLabel(13)}♠ mengalahkan {rankLabel(13)}♥.
        </p>
      </Section>
      <Section title="Walik">
        <p>
          Pemain yang mengeluarkan <strong>four of a kind</strong> boleh memilih <strong>walik</strong> (tombol
          &quot;Keluarkan &amp; Walik&quot;). Walik bersifat opsional.
        </p>
        <ul>
          <li>
            Sesudah walik, urutan angka terbalik: <strong>3 terbesar, 2 terkecil</strong>. Urutan bunga juga terbalik:
            <strong> ♦ Wajik terbesar, ♠ Sekop terkecil</strong>.
          </li>
          <li>Walik berlaku sampai ada pemain yang menang di ronde itu. Ronde berikutnya kembali normal.</li>
          <li>Four of a kind lain yang memilih walik lagi akan mengembalikan urutan ke normal.</li>
          <li>Urutan jenis kombo 5 kartu (straight sampai straight flush) tidak ikut terbalik.</li>
        </ul>
      </Section>
      <Section title="Jenis kombinasi">
        <ul className="capsa-guide__combos">
          {COMBOS.map((combo) => (
            <li key={combo.name}>
              <div>
                <strong>{combo.name}</strong>
                <p>{combo.text}</p>
              </div>
              <Example text={combo.example} />
            </li>
          ))}
        </ul>
        <p>
          Begitu ada kombo 5 kartu yang keluar, <strong>tris tidak boleh dikeluarkan lagi</strong> sampai ronde
          selesai, walaupun meja sudah bersih. Single, pair, dan kombo 5 kartu tetap boleh.
        </p>
        <p>
          Kombinasi 5 kartu dari yang terendah: <strong>Straight &lt; Flush &lt; Full House &lt; Four of a Kind &lt;
          Straight Flush</strong>. Jenis yang lebih tinggi selalu menang, apa pun angkanya.
        </p>
      </Section>
    </>
  )
}

export function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ref, primaryRef } = useModal(open)
  return (
    <dialog
      ref={ref}
      className="tutorial-dialog"
      aria-labelledby="capsa-guide-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="tutorial-dialog__scroll">
        <div className="tutorial-dialog__card">
          <header className="tutorial-dialog__header">
            <h2 id="capsa-guide-title" className="setup__title">
              Cara main Capsa
            </h2>
            <button ref={primaryRef} type="button" className="btn btn--small" onClick={onClose}>
              Tutup
            </button>
          </header>
          <GuideContent />
        </div>
      </div>
    </dialog>
  )
}

interface ResultDialogProps {
  view: CapsaView
  lobby: CapsaLobby
  seat: number
  open: boolean
  onClose: () => void
  onExit: () => void
  /** Hanya host yang memulai ronde berikutnya. */
  onRestart?: () => void
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

/** Hasil ronde: pemenang, sisa kartu tiap lawan, perubahan skor, dan total skor. */
export function CapsaResultDialog({ view, lobby, seat, open, onClose, onExit, onRestart }: ResultDialogProps) {
  const { ref, primaryRef } = useModal(open)
  const winner = view.winner ?? 0
  const ranking = lobby.players.map((player, i) => ({ ...player, seat: i })).sort((a, b) => b.score - a.score)

  return (
    <dialog
      ref={ref}
      className="tutorial-dialog result-dialog"
      aria-labelledby="capsa-result-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      {open && view.winner === seat && <Confetti colors={GOLD_CONFETTI} />}
      <div className="tutorial-dialog__scroll">
        <div className="result-dialog__card">
          <h2 id="capsa-result-title" className="result-dialog__title">
            {view.winner === seat ? 'Kamu menang!' : `${view.players[winner]?.name} menang!`}
          </h2>
          <p className="result-dialog__how">{view.players[winner]?.name} menghabiskan kartunya lebih dulu.</p>

          {view.hands && (
            <div className="result-dialog__hand capsa-result__hands">
              {view.hands.map((hand, i) =>
                i === winner ? null : (
                  <figure key={i} className="result-dialog__group">
                    <figcaption>
                      {view.players[i].name} · sisa {hand.length} kartu
                    </figcaption>
                    <div className="capsa-guide__cards">
                      {sortByRank(hand).map((card) => (
                        <CapsaCard key={card.id} card={card} size="small" />
                      ))}
                    </div>
                  </figure>
                ),
              )}
            </div>
          )}

          <div className="result-dialog__score">
            <p className="result-dialog__total">
              <strong>Skor</strong>
            </p>
            <ul className="result-dialog__rows">
              {ranking.map((entry) => (
                <li key={entry.seat}>
                  <span>
                    {entry.name}
                    {entry.seat === seat && ' (kamu)'}
                    {view.deltas && (
                      <span className={`capsa-delta ${view.deltas[entry.seat] < 0 ? 'capsa-delta--minus' : ''}`}>
                        {' '}
                        ({signed(view.deltas[entry.seat])})
                      </span>
                    )}
                  </span>
                  <strong className={entry.score < 0 ? 'result-dialog__minus' : ''}>{signed(entry.score)}</strong>
                </li>
              ))}
            </ul>
          </div>

          {!onRestart && <p className="result-dialog__how">Menunggu host memulai ronde berikutnya…</p>}

          <div className="result-dialog__actions">
            {onRestart && (
              <button ref={primaryRef} type="button" className="btn btn--primary" onClick={onRestart}>
                Ronde berikutnya
              </button>
            )}
            <button ref={onRestart ? undefined : primaryRef} type="button" className="btn" onClick={onClose}>
              Lihat meja
            </button>
            <button type="button" className="btn" onClick={onExit}>
              Keluar dari room
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
