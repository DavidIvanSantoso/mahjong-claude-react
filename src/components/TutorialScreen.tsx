import { useEffect, useRef, type ReactNode } from 'react'
import type { Suit, Tile } from '../game/tiles'
import { TileView } from './TileView'

let nextId = 0
/** Ubin contoh untuk ilustrasi; id hanya perlu unik di halaman ini. */
function tiles(suit: Suit, ...ranks: number[]): Tile[] {
  return ranks.map((rank) => ({ id: nextId++, suit, rank }))
}

function TileRow({ items, label }: { items: Tile[]; label?: string }) {
  return (
    <figure className="tutorial__example">
      <div className="tutorial__tiles">
        {items.map((tile) => (
          <TileView key={tile.id} tile={tile} />
        ))}
      </div>
      {label && <figcaption>{label}</figcaption>}
    </figure>
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

const WINNING_HAND = [
  ...tiles('man', 1, 2, 3),
  ...tiles('pin', 5, 5, 5),
  ...tiles('sou', 6, 7, 8),
  ...tiles('wind', 1, 1, 1),
  ...tiles('dragon', 1, 1),
]

/** Isi tutorial; dipakai halaman Tutorial dan modal tutorial di meja permainan. */
function TutorialContent() {
  return (
    <>
      <Section title="Tujuan">
        <p>
          Jadilah yang pertama mengumpulkan <strong>4 set + 1 pair</strong>, total 14 ubin.
        </p>
        <TileRow items={WINNING_HAND} label="Contoh tangan menang: chi, pong, chi, pong, dan pair" />
      </Section>

      <Section title="Jenis ubin">
        <TileRow items={tiles('man', 1, 2, 3, 4, 5, 6, 7, 8, 9)} label="Karakter 1–9" />
        <TileRow items={tiles('pin', 1, 2, 3, 4, 5, 6, 7, 8, 9)} label="Bulat 1–9" />
        <TileRow items={tiles('sou', 1, 2, 3, 4, 5, 6, 7, 8, 9)} label="Bambu 1–9" />
        <TileRow items={tiles('wind', 1, 2, 3, 4)} label="Angin: Timur, Selatan, Barat, Utara" />
        <TileRow items={tiles('dragon', 1, 2, 3)} label="Naga: Merah, Hijau, Putih" />
        <p>Masing-masing ada 4 salinan. Ditambah 8 ubin bunga (lihat di bawah), totalnya 144 ubin.</p>
      </Section>

      <Section title="Set dan pair">
        <TileRow items={tiles('pin', 7, 7, 7)} label="Pong — 3 ubin kembar" />
        <TileRow items={tiles('sou', 3, 4, 5)} label="Chi — 3 angka berurutan dalam suit yang sama" />
        <TileRow items={tiles('dragon', 2, 2, 2, 2)} label="Kong — 4 ubin kembar, dihitung satu set" />
        <TileRow items={tiles('man', 9, 9)} label="Pair — 2 ubin kembar" />
        <p>Angin dan naga tidak bisa dijadikan chi. Urutan tidak boleh melompati batas (8-9-1 tidak sah).</p>
      </Section>

      <Section title="Jalannya giliran">
        <ol>
          <li>Ambil 1 ubin dari dinding.</li>
          <li>Kalau 14 ubinmu sudah memenuhi syarat, tekan <strong>Mahjong!</strong> untuk menang.</li>
          <li>Kalau belum, pilih 1 ubin lalu tekan <strong>Buang</strong>. Mengetuk ubin yang sama dua kali juga langsung membuangnya.</li>
        </ol>
        <p>
          Tiap aksi dibatasi waktu yang ditentukan pembuat ruangan (bawaannya 15 detik). Kalau waktu
          habis, ubin yang terakhir kamu dapat dibuang otomatis, dan tawaran klaim dianggap dilewati.
        </p>
      </Section>

      <Section title="Mengklaim buangan">
        <p>Ubin yang baru dibuang bisa diambil pemain lain, dengan urutan prioritas:</p>
        <ol>
          <li><strong>Menang</strong> — kalau ubin itu melengkapi tanganmu.</li>
          <li><strong>Pong / Kong</strong> — kalau kamu punya 2 atau 3 ubin kembarnya.</li>
          <li><strong>Chi</strong> — hanya untuk pemain tepat setelah pembuang.</li>
        </ol>
        <p>
          Setelah pong atau chi, kamu langsung membuang tanpa mengambil dari dinding, dan giliran
          berlanjut dari kamu. Set yang diklaim ditaruh terbuka di depanmu.
        </p>
      </Section>

      <Section title="Kong">
        <ul>
          <li><strong>Tertutup</strong>: 4 ubin kembar di tanganmu, dinyatakan pada giliranmu.</li>
          <li><strong>Tambahan</strong>: menambah ubin ke-4 ke pong yang sudah terbuka.</li>
          <li><strong>Dari buangan</strong>: punya 3 kembar, lalu pemain lain membuang yang ke-4.</li>
        </ul>
        <p>Setelah kong kamu otomatis mengambil 1 ubin pengganti dari dinding.</p>
      </Section>

      <Section title="Bunga">
        <TileRow items={tiles('flower', 1, 2, 3, 4, 5, 6, 7, 8)} label="4 bunga dan 4 musim" />
        <p>Bunga tidak masuk tangan. Begitu didapat, bunga disisihkan dan otomatis diganti ubin baru.</p>
      </Section>

      <Section title="Seri">
        <p>Kalau dinding habis dan belum ada yang menang, permainan berakhir seri.</p>
      </Section>

      <Section title="Mode permainan">
        <ul>
          <li>
            <strong>Local</strong>: 2–4 pemain bergantian di satu perangkat. Tangan disembunyikan saat
            ganti giliran, dan meja berputar ke pemain berikutnya.
          </li>
          <li>
            <strong>Online</strong>: satu pemain membuat room, yang lain masuk dengan kode atau link.
            Pemain yang terputus lebih dari 15 detik dilewati gilirannya sampai tersambung kembali.
          </li>
        </ul>
      </Section>
    </>
  )
}

export function TutorialScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="setup">
      <article className="card setup__card tutorial">
        <button type="button" className="btn btn--small setup__back" onClick={onBack}>
          ← Kembali
        </button>
        <h1 className="setup__title">Cara bermain</h1>
        <TutorialContent />
        <button type="button" className="btn btn--primary btn--wide" onClick={onBack}>
          Kembali ke menu
        </button>
      </article>
    </main>
  )
}

/**
 * Tutorial dalam modal, dibuka dari meja permainan tanpa meninggalkan permainan.
 * Memakai `<dialog>` bawaan browser: Esc menutup, dan fokus tertahan di dalam modal.
 */
export function TutorialDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Tanpa ini browser memfokuskan area scroll (elemen pertama yang bisa difokus),
      // yang tampil sebagai garis gelap di tepi modal.
      closeRef.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="tutorial-dialog"
      aria-labelledby="tutorial-dialog-title"
      onClose={onClose}
      // Klik di luar kartu (area gelap) menutup modal.
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      {/* Area scroll terpisah dari kotak dialog, supaya scrollbar tidak memotong sudut membulat. */}
      <div className="tutorial-dialog__scroll">
        <div className="tutorial-dialog__card tutorial">
          <header className="tutorial-dialog__header">
            <h2 id="tutorial-dialog-title" className="setup__title">
              Cara bermain
            </h2>
            <button ref={closeRef} type="button" className="btn btn--small" onClick={onClose}>
              Tutup
            </button>
          </header>
          <TutorialContent />
        </div>
      </div>
    </dialog>
  )
}
