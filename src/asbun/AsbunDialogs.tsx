import { useEffect, useRef, type ReactNode } from 'react'
import { MAX_PLAYERS, MIN_PLAYERS } from './roles'

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
      <Section title="Peran">
        <ul>
          <li>
            <strong>Warga</strong> mendapat kata rahasia yang sama, mis. "Es Krim".
          </li>
          <li>
            <strong>Penyusup</strong> mendapat kata yang mirip tapi berbeda, mis. "Yogurt". Ia tahu dirinya Penyusup, tapi
            tidak tahu kata Warga.
          </li>
          <li>
            <strong>Si Asbun</strong> tidak mendapat kata apa pun dan harus "asal bunyi" dengan meyakinkan.
          </li>
          <li>
            <strong>Kategori</strong> kata (mis. Hewan) diumumkan ke semua pemain, termasuk Si Asbun, supaya petunjuk lebih
            terarah.
          </li>
          <li>
            {MIN_PLAYERS}–{MAX_PLAYERS} pemain. Jumlah tiap peran mengikuti jumlah pemain.
          </li>
        </ul>
      </Section>
      <Section title="Satu ronde">
        <ol>
          <li>
            <strong>Petunjuk:</strong> bergiliran, tiap pemain aktif memberi satu petunjuk pendek tentang katanya, tanpa
            menyebut katanya sendiri.
          </li>
          <li>
            <strong>Diskusi:</strong> tunjukkan siapa yang mencurigakan lewat reaksi emoji yang terlihat semua pemain (atau
            langsung lewat suara).
          </li>
          <li>
            <strong>Voting:</strong> semua memilih satu tersangka secara rahasia. Suara terbanyak dieliminasi dan perannya
            dibuka (katanya tidak). Belum yakin? Pilih <strong>skip vote</strong>. Kalau skip mendapat suara terbanyak,
            atau suara seri, tidak ada yang dieliminasi.
          </li>
          <li>
            Kalau yang dieliminasi Si Asbun, ia mendapat <strong>satu tebakan</strong> kata Warga.
          </li>
        </ol>
      </Section>
      <Section title="Menang">
        <ul>
          <li>
            <strong>Si Asbun</strong> menang sendiri kalau tebakannya tepat, atau kalau Penyusup sudah habis dan ia bertahan
            sampai tinggal berdua.
          </li>
          <li>
            <strong>Penyusup</strong> menang kalau jumlah Penyusup aktif sama dengan atau lebih dari pemain aktif lain.
          </li>
          <li>
            <strong>Warga</strong> menang kalau semua Penyusup dan Si Asbun sudah keluar.
          </li>
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
      aria-labelledby="as-guide-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="tutorial-dialog__scroll">
        <div className="tutorial-dialog__card">
          <header className="tutorial-dialog__header">
            <h2 id="as-guide-title" className="setup__title">
              Cara bermain
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

/** Konfirmasi sebelum keluar dari permainan yang sedang berjalan. */
export function LeaveDialog({ open, isHost, onCancel, onLeave }: { open: boolean; isHost: boolean; onCancel: () => void; onLeave: () => void }) {
  const { ref, primaryRef } = useModal(open)
  return (
    <dialog ref={ref} className="tutorial-dialog as-confirm" aria-labelledby="as-leave-title" onClose={onCancel}>
      <div className="tutorial-dialog__scroll">
        <div className="tutorial-dialog__card">
          <h2 id="as-leave-title" className="setup__title">
            Keluar dari permainan?
          </h2>
          <p>
            {isHost
              ? 'Kamu host. Kalau keluar, room ditutup dan permainan berakhir untuk semua pemain.'
              : 'Permainan masih berjalan. Kamu bisa kembali ke kursimu dengan bergabung lagi memakai kode room yang sama.'}
          </p>
          <div className="as-confirm__actions">
            <button ref={primaryRef} type="button" className="as-btn" onClick={onCancel}>
              Batal
            </button>
            <button type="button" className="as-btn as-btn--danger" onClick={onLeave}>
              Ya, keluar
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
