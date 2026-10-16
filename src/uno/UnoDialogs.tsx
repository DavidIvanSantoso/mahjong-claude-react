import { useEffect, useRef, type ReactNode } from 'react'
import { Confetti } from '../components/Confetti'
import { cardPoints, COLOR_NAMES, COLORS, sortHand, type Color } from './cards'
import { TARGET_SCORE, type UnoLobby, type UnoView } from './net'
import { UnoCard } from './UnoCard'

/** Warna kartu asli UNO, untuk confetti kemenangan. */
const UNO_CONFETTI = ['var(--uno-red)', 'var(--uno-yellow)', 'var(--uno-green)', 'var(--uno-blue)', '#fff']

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

interface ColorPickerProps {
  open: boolean
  onPick: (color: Color) => void
  /** Kosong kalau warna wajib dipilih (kartu pembuka Wild). */
  onCancel?: () => void
}

export function ColorPicker({ open, onPick, onCancel }: ColorPickerProps) {
  const { ref } = useModal(open)
  return (
    <dialog
      ref={ref}
      className="tutorial-dialog uno-color-dialog"
      aria-labelledby="uno-color-title"
      // Esc hanya menutup kalau memilih warna boleh dibatalkan.
      onCancel={(event) => {
        event.preventDefault()
        onCancel?.()
      }}
      onClick={(event) => event.target === event.currentTarget && onCancel?.()}
    >
      <div className="uno-color-dialog__card">
        <h2 id="uno-color-title" className="uno-color-dialog__title">
          Pilih warna
        </h2>
        <div className="uno-color-dialog__grid">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`uno-color-option uno-color-option--${color}`}
              onClick={() => onPick(color)}
            >
              {COLOR_NAMES[color]}
            </button>
          ))}
        </div>
        {onCancel && (
          <button type="button" className="btn btn--wide" onClick={onCancel}>
            Batal
          </button>
        )}
      </div>
    </dialog>
  )
}

interface ResultDialogProps {
  view: UnoView
  lobby: UnoLobby
  seat: number
  open: boolean
  onClose: () => void
  onExit: () => void
  /** Hanya host yang memulai ronde berikutnya. */
  onRestart?: () => void
}

/** Hasil ronde: pemenang, kartu sisa tiap lawan beserta poinnya, dan skor menuju target. */
export function UnoResultDialog({ view, lobby, seat, open, onClose, onExit, onRestart }: ResultDialogProps) {
  const { ref, primaryRef } = useModal(open)
  const winner = view.winner
  const champion = lobby.champion
  const ranking = lobby.players
    .map((player, i) => ({ ...player, seat: i }))
    .sort((a, b) => b.score - a.score)

  return (
    <dialog
      ref={ref}
      className="tutorial-dialog result-dialog"
      aria-labelledby="uno-result-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      {open && winner === seat && <Confetti colors={UNO_CONFETTI} />}
      <div className="tutorial-dialog__scroll">
        <div className="result-dialog__card">
          <h2 id="uno-result-title" className="result-dialog__title">
            {champion !== null
              ? champion === seat
                ? 'Kamu juara!'
                : `${lobby.players[champion]?.name} juara!`
              : winner === seat
                ? 'Kamu menang ronde ini!'
                : `${view.players[winner ?? 0]?.name} menang ronde ini!`}
          </h2>
          <p className="result-dialog__how">
            {champion !== null
              ? `Skornya mencapai ${TARGET_SCORE} poin. `
              : ''}
            {winner !== null && `${view.players[winner].name} mendapat ${view.points} poin dari kartu lawan.`}
          </p>

          {view.hands && (
            <div className="result-dialog__hand uno-result__hands">
              {view.hands.map((hand, i) =>
                i === winner ? null : (
                  <figure key={i} className="result-dialog__group">
                    <figcaption>
                      {view.players[i].name} · {hand.reduce((sum, card) => sum + cardPoints(card), 0)} poin
                    </figcaption>
                    <div className="uno-result__cards">
                      {sortHand(hand).map((card) => (
                        <UnoCard key={card.id} card={card} size="small" />
                      ))}
                    </div>
                  </figure>
                ),
              )}
            </div>
          )}

          <div className="result-dialog__score">
            <p className="result-dialog__total">
              <strong>Skor</strong> (target {TARGET_SCORE})
            </p>
            <ul className="result-dialog__rows">
              {ranking.map((entry) => (
                <li key={entry.seat}>
                  <span>
                    {entry.name}
                    {entry.seat === seat && ' (kamu)'}
                  </span>
                  <strong>{entry.score}</strong>
                </li>
              ))}
            </ul>
          </div>

          {!onRestart && <p className="result-dialog__how">Menunggu host memulai ronde berikutnya…</p>}

          <div className="result-dialog__actions">
            {onRestart && (
              <button ref={primaryRef} type="button" className="btn btn--primary" onClick={onRestart}>
                {champion !== null ? 'Main lagi dari nol' : 'Ronde berikutnya'}
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tutorial__section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

/** Ringkasan aturan dasar UNO internasional. */
export function RulesContent() {
  return (
    <>
      <Section title="Tujuan">
        <p>
          Jadilah yang pertama menghabiskan kartu di tangan. Pemenang ronde mendapat poin dari kartu yang tersisa di
          tangan semua lawan. Pemain pertama yang mencapai <strong>{TARGET_SCORE} poin</strong> menjadi juara.
        </p>
      </Section>
      <Section title="Persiapan">
        <ul>
          <li>Dek berisi 108 kartu; tiap pemain mendapat 7 kartu.</li>
          <li>Satu kartu dibuka sebagai kartu pembuka, sisanya jadi tumpukan ambil.</li>
          <li>Pembagi kartu diacak di ronde pertama, lalu bergeser ke kiri tiap ronde. Pemain di kiri pembagi jalan duluan.</li>
        </ul>
      </Section>
      <Section title="Giliranmu">
        <ul>
          <li>
            Keluarkan satu kartu yang <strong>warnanya</strong> sama dengan warna yang berlaku, atau{' '}
            <strong>angka/simbolnya</strong> sama dengan kartu teratas. Kartu Wild boleh dikeluarkan kapan saja.
          </li>
          <li>
            Tidak bisa (atau tidak mau) mengeluarkan kartu? Ambil 1 kartu. Kalau kartu itu cocok, boleh langsung
            dikeluarkan; kalau tidak, giliran pindah.
          </li>
          <li>Waktu habis: kamu otomatis mengambil 1 kartu dan giliran pindah.</li>
        </ul>
      </Section>
      <Section title="Kartu aksi">
        <div className="uno-rules__cards">
          <figure>
            <UnoCard card={{ id: -1, color: 'red', value: 'skip' }} size="small" />
            <figcaption>
              <strong>Skip</strong> — pemain berikutnya dilewati. <em>20 poin</em>
            </figcaption>
          </figure>
          <figure>
            <UnoCard card={{ id: -2, color: 'yellow', value: 'reverse' }} size="small" />
            <figcaption>
              <strong>Reverse</strong> — arah permainan berbalik. Kalau berdua, sama dengan Skip. <em>20 poin</em>
            </figcaption>
          </figure>
          <figure>
            <UnoCard card={{ id: -3, color: 'green', value: 'draw2' }} size="small" />
            <figcaption>
              <strong>Draw Two</strong> — pemain berikutnya mengambil 2 kartu dan dilewati. <em>20 poin</em>
            </figcaption>
          </figure>
          <figure>
            <UnoCard card={{ id: -4, color: null, value: 'wild' }} size="small" />
            <figcaption>
              <strong>Wild</strong> — pilih warna yang berlaku berikutnya. <em>50 poin</em>
            </figcaption>
          </figure>
          <figure>
            <UnoCard card={{ id: -5, color: null, value: 'wild4' }} size="small" />
            <figcaption>
              <strong>Wild Draw Four</strong> — pilih warna; pemain berikutnya mengambil 4 kartu dan dilewati.{' '}
              <em>50 poin</em>
            </figcaption>
          </figure>
        </div>
        <p>Kartu Draw Two dan Wild Draw Four tidak bisa ditumpuk untuk dioper ke pemain lain.</p>
      </Section>
      <Section title="Menantang Wild Draw Four">
        <p>
          Wild Draw Four seharusnya hanya dikeluarkan kalau kamu tidak punya kartu dengan <strong>warna</strong> yang
          berlaku. Pemain yang dikenai boleh <strong>menantang</strong>:
        </p>
        <ul>
          <li>Kalau benar curang, yang mengeluarkan kartu mengambil 4 kartu, dan penantang tetap mendapat gilirannya.</li>
          <li>Kalau tidak curang, penantang mengambil 6 kartu (4 + 2 hukuman) dan dilewati.</li>
        </ul>
      </Section>
      <Section title='Bilang "UNO!"'>
        <ul>
          <li>
            Saat tinggal 2 kartu, tekan tombol <strong>UNO!</strong> sebelum mengeluarkan kartu kedua terakhirmu.
          </li>
          <li>
            Lupa? Kamu masih bisa menekannya sebelum pemain berikutnya beraksi. Kalau ada lawan yang menekan{' '}
            <strong>Tangkap</strong> lebih dulu, kamu mengambil 2 kartu.
          </li>
        </ul>
      </Section>
      <Section title="Poin">
        <ul>
          <li>Kartu angka: sesuai angkanya (0–9).</li>
          <li>Skip, Reverse, Draw Two: 20 poin.</li>
          <li>Wild, Wild Draw Four: 50 poin.</li>
        </ul>
      </Section>
    </>
  )
}

export function RulesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ref, primaryRef } = useModal(open)
  return (
    <dialog
      ref={ref}
      className="tutorial-dialog"
      aria-labelledby="uno-rules-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="tutorial-dialog__scroll">
        <div className="tutorial-dialog__card">
          <header className="tutorial-dialog__header">
            <h2 id="uno-rules-title" className="setup__title">
              Cara main UNO
            </h2>
            <button ref={primaryRef} type="button" className="btn btn--small" onClick={onClose}>
              Tutup
            </button>
          </header>
          <RulesContent />
        </div>
      </div>
    </dialog>
  )
}
