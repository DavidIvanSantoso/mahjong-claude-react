import { useEffect, useRef, type ReactNode } from 'react'
import { Confetti } from '../components/Confetti'
import type { BomKataLobby, BomKataView } from './net'
import { LIVES } from './state'

const PIXEL_CONFETTI = ['#F5C451', '#F47735', '#EF4B55', '#62C96B', '#294A7A', '#F4F7FF']

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tutorial__section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export function GuideContent() {
  return (
    <>
      <Section title="Tujuan">
        <p>Jangan sampai bom meledak di tanganmu. Pemain terakhir yang masih punya nyawa menang.</p>
      </Section>
      <Section title="Cara main">
        <ul>
          <li>2–6 pemain duduk melingkar. Tiap pemain punya {LIVES} nyawa.</li>
          <li>Setiap ronde, sebuah <strong>kategori</strong> diundi, misalnya Hewan atau Buah.</li>
          <li>
            Kadang kategorinya diberi <strong>tantangan</strong>: berawalan huruf tertentu, berakhiran huruf tertentu,
            atau minimal sekian huruf. Contoh: &quot;Buah berakhiran A&quot; (nangka, semangka) atau &quot;Hewan
            berawalan K&quot; (kucing, kuda).
          </li>
          <li>
            Panah di bom menunjuk pemain yang sedang memegang bom. Ia harus mengetik satu kata dari kategori itu lalu
            menekan Enter.
          </li>
          <li>Kata benar: bom pindah ke pemain berikutnya searah jarum jam.</li>
          <li>Kata salah atau sudah dipakai di ronde itu: coba lagi, bomnya tetap di tanganmu.</li>
          <li>
            Waktu bom diacak dan <strong>tidak diperlihatkan</strong>. Makin dekat meledak, kedipan dan detaknya makin
            cepat.
          </li>
          <li>Saat bom meledak, pemegangnya kehilangan 1 nyawa, lalu kategori baru diundi.</li>
        </ul>
      </Section>
      <Section title="Aturan kata">
        <ul>
          <li>Huruf besar/kecil, tanda hubung, dan spasi berlebih tidak berpengaruh: "Kuda Nil" sama dengan "kuda nil".</li>
          <li>Kata ulang boleh ditulis dengan atau tanpa tanda hubung: "lumba-lumba" atau "lumba lumba".</li>
          <li>Satu kata hanya boleh dipakai sekali per ronde.</li>
          <li>Kata dicocokkan dengan kamus permainan; kalau kata yang benar ditolak, berarti belum ada di kamus.</li>
        </ul>
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
      aria-labelledby="bk-guide-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="tutorial-dialog__scroll">
        <div className="tutorial-dialog__card">
          <header className="tutorial-dialog__header">
            <h2 id="bk-guide-title" className="setup__title">
              Cara main
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
  view: BomKataView
  lobby: BomKataLobby
  seat: number
  open: boolean
  onClose: () => void
  onExit: () => void
  onRestart?: () => void
}

export function BomKataResultDialog({ view, lobby, seat, open, onClose, onExit, onRestart }: ResultDialogProps) {
  const { ref, primaryRef } = useModal(open)
  const winner = view.winner
  const ranking = lobby.players.map((player, i) => ({ ...player, seat: i })).sort((a, b) => b.wins - a.wins)
  return (
    <dialog
      ref={ref}
      className="tutorial-dialog result-dialog"
      aria-labelledby="bk-result-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      {open && winner === seat && <Confetti colors={PIXEL_CONFETTI} />}
      <div className="tutorial-dialog__scroll">
        <div className="result-dialog__card">
          <h2 id="bk-result-title" className="result-dialog__title">
            {winner === seat ? 'KAMU MENANG!' : winner !== null ? `${view.players[winner].name} MENANG!` : 'SELESAI'}
          </h2>
          <p className="result-dialog__how">Bertahan sampai akhir setelah {view.round} ronde.</p>
          <div className="result-dialog__score">
            <p className="result-dialog__total">
              <strong>Jumlah menang</strong>
            </p>
            <ul className="result-dialog__rows">
              {ranking.map((entry) => (
                <li key={entry.seat}>
                  <span>
                    {entry.name}
                    {entry.seat === seat && ' (kamu)'}
                  </span>
                  <strong>★ {entry.wins}</strong>
                </li>
              ))}
            </ul>
          </div>
          {!onRestart && <p className="result-dialog__how">Menunggu host memulai permainan baru…</p>}
          <div className="result-dialog__actions">
            {onRestart && (
              <button ref={primaryRef} type="button" className="btn btn--primary" onClick={onRestart}>
                Main lagi
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
