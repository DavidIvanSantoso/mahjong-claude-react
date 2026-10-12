import { useEffect, useRef, type ReactNode } from 'react'
import { BASE_POINTS, FAAN, LIMIT_FAAN } from '../game/scoring'
import type { Ruleset } from '../game/state'
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

const TITLES: Record<Ruleset, string> = {
  classic: 'Cara bermain',
  hk: 'Cara bermain: Hong Kong Points',
}

const WINNING_HAND = [
  ...tiles('man', 1, 2, 3),
  ...tiles('pin', 5, 5, 5),
  ...tiles('sou', 6, 7, 8),
  ...tiles('wind', 1, 1, 1),
  ...tiles('dragon', 1, 1),
]

/**
 * Contoh ubin untuk tiap pola faan. Pola yang hanya menyangkut sebagian tangan cukup
 * menampilkan bagian itu; `note` menjelaskan apa yang harus diperhatikan.
 */
const FAAN_EXAMPLES: Record<keyof typeof FAAN, { tiles: Tile[]; note: string }> = {
  selfDraw: {
    tiles: [...tiles('man', 2, 3, 4), ...tiles('pin', 6, 6, 6), ...tiles('sou', 1, 2, 3, 7, 8, 9), ...tiles('wind', 3, 3)],
    note: 'Tangan apa pun, asal ubin penentunya kamu ambil sendiri dari dinding, bukan dari buangan.',
  },
  concealed: {
    tiles: [...tiles('man', 4, 5, 6), ...tiles('pin', 1, 1, 1, 3, 4, 5), ...tiles('sou', 6, 7, 8), ...tiles('dragon', 2, 2)],
    note: 'Semua set dibentuk di tangan, tanpa chi/pong/kong dari buangan. Kong tertutup tetap boleh.',
  },
  allChi: {
    tiles: [...tiles('man', 1, 2, 3, 5, 6, 7), ...tiles('pin', 2, 3, 4), ...tiles('sou', 6, 7, 8, 9, 9)],
    note: 'Keempat setnya urutan (chi), ditambah satu pair.',
  },
  seatWind: {
    tiles: tiles('wind', 1, 1, 1),
    note: 'Pong atau kong dari angin kursimu. Contoh ini berlaku kalau kamu duduk di Timur.',
  },
  roundWind: {
    tiles: tiles('wind', 2, 2, 2),
    note: 'Pong atau kong dari angin ronde. Contoh ini berlaku selama ronde Selatan.',
  },
  dragon: {
    tiles: tiles('dragon', 1, 1, 1),
    note: 'Pong atau kong naga apa pun (Merah, Hijau, atau Putih); tiap set bernilai 1 faan.',
  },
  noFlower: {
    tiles: [],
    note: 'Kamu tidak mendapat satu pun ubin bunga atau musim sepanjang ronde.',
  },
  ownFlower: {
    tiles: tiles('flower', 1, 5),
    note: 'Bunga atau musim yang nomornya sama dengan angin kursimu (kursi Timur: nomor 1); 1 faan per ubin.',
  },
  flowerSet: {
    tiles: tiles('flower', 1, 2, 3, 4),
    note: 'Keempat bunga, atau keempat musim; 2 faan per set lengkap.',
  },
  allPong: {
    tiles: [...tiles('man', 2, 2, 2), ...tiles('pin', 5, 5, 5, 8, 8, 8), ...tiles('sou', 3, 3, 3, 9, 9)],
    note: 'Keempat setnya pong atau kong, ditambah satu pair.',
  },
  halfFlush: {
    tiles: [...tiles('pin', 1, 2, 3, 4, 5, 6, 9, 9, 9), ...tiles('wind', 1, 1, 1), ...tiles('dragon', 2, 2)],
    note: 'Hanya satu suit angka, sisanya angin dan/atau naga.',
  },
  smallDragons: {
    tiles: [...tiles('dragon', 1, 1, 1, 2, 2, 2, 3, 3)],
    note: 'Dua pong naga dan pair dari naga ketiga; dua set lainnya bebas.',
  },
  smallWinds: {
    tiles: [...tiles('wind', 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4)],
    note: 'Tiga pong angin dan pair dari angin keempat; satu set lainnya bebas.',
  },
  fullFlush: {
    tiles: [...tiles('sou', 1, 1, 1, 2, 3, 4, 5, 6, 7, 7, 8, 9, 9, 9)],
    note: 'Seluruh tangan dari satu suit angka, tanpa angin dan naga.',
  },
  bigDragons: {
    tiles: [...tiles('dragon', 1, 1, 1, 2, 2, 2, 3, 3, 3)],
    note: 'Pong dari ketiga naga; satu set dan pair lainnya bebas.',
  },
  bigWinds: {
    tiles: [...tiles('wind', 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4)],
    note: 'Pong dari keempat angin; pair-nya bebas.',
  },
  allHonors: {
    tiles: [...tiles('wind', 1, 1, 1, 3, 3, 3, 4, 4, 4), ...tiles('dragon', 1, 1, 1, 3, 3)],
    note: 'Seluruh tangan hanya angin dan naga, tanpa ubin angka.',
  },
}

const FAAN_KEYS = Object.keys(FAAN) as (keyof typeof FAAN)[]

/** Bagian tambahan untuk Hong Kong Points: cara kemenangan dinilai dan dibayar. */
function HongKongSections() {
  return (
    <>
      <Section title="Hong Kong Points">
        <p>
          Cara bermainnya sama dengan mode Normal. Bedanya, tiap kemenangan dinilai: pola di tangan
          menang memberi <strong>faan</strong>, jumlah faan menentukan <strong>poin dasar</strong>,
          dan pemain lain membayar poin itu ke pemenang.
        </p>
        <p>Tidak ada faan minimum: tangan tanpa pola tetap boleh menang, nilainya 0 faan.</p>
      </Section>

      <Section title="Bandar dan angin">
        <ul>
          <li>
            Di awal permainan tiap pemain melempar dua dadu; angka tertinggi jadi{' '}
            <strong>bandar</strong> ronde pertama dan duduk di angin Timur. Pemain berikutnya
            Selatan, Barat, lalu Utara. Angin kursi tampil di depan nama pemain.
          </li>
          <li>
            Bandar bertahan kalau ia menang atau rondenya seri. Kalau tidak, bandar pindah ke pemain
            berikutnya. Setelah semua pemain pernah jadi bandar, <strong>angin ronde</strong> berganti
            (Timur, Selatan, Barat, Utara).
          </li>
          <li>
            Bunga dan musim bernomor 1–4 berpasangan dengan Timur, Selatan, Barat, Utara. Bunga yang
            nomornya cocok dengan angin kursimu bernilai faan.
          </li>
        </ul>
      </Section>

      <Section title="Daftar faan">
        <ul className="faan-list">
          {FAAN_KEYS.map((key) => (
            <li key={key}>
              <div className="faan-list__head">
                <strong>{FAAN[key].label}</strong>
                <span className="faan-list__value">{FAAN[key].faan} faan</span>
              </div>
              <TileRow items={FAAN_EXAMPLES[key].tiles} label={FAAN_EXAMPLES[key].note} />
            </li>
          ))}
        </ul>
        <p>
          Semua pola yang terpenuhi dijumlahkan, paling banyak {LIMIT_FAAN} faan. Pong naga dan bunga
          kursi dihitung per set/ubin. Tiga naga dan empat angin (kecil/besar) sudah mencakup nilai
          pong-pongnya.
        </p>
      </Section>

      <Section title="Poin dan pembayaran">
        <table className="tutorial__table">
          <thead>
            <tr>
              <th>Faan</th>
              <th>Poin dasar</th>
            </tr>
          </thead>
          <tbody>
            {BASE_POINTS.map((points, faan) => (
              <tr key={faan}>
                <td>{faan === LIMIT_FAAN ? `${faan} atau lebih` : faan}</td>
                <td>{points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul>
          <li>
            <strong>Menang dari ambilan sendiri</strong>: semua pemain lain membayar 2× poin dasar.
          </li>
          <li>
            <strong>Menang dari buangan</strong>: pembuangnya membayar 2× poin dasar, pemain lain 1×.
          </li>
          <li>
            <strong>Seri</strong>: tidak ada poin yang berpindah.
          </li>
        </ul>
        <p>Total poin tiap pemain tampil di papan skor selama permainan berlanjut.</p>
      </Section>
    </>
  )
}

/** Isi tutorial; dipakai halaman Tutorial dan modal tutorial di meja permainan. */
function TutorialContent({ ruleset }: { ruleset: Ruleset }) {
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
        <p>
          Di awal permainan tiap pemain melempar dua dadu, dan pemilik angka tertinggi jalan pertama
          (kalau seri, dadunya dilempar ulang).
          {ruleset === 'classic' && ' Di ronde berikutnya, giliran pertama pindah ke pemain selanjutnya.'}
        </p>
        <ol>
          <li>Ambil 1 ubin dari dinding.</li>
          <li>Kalau 14 ubinmu sudah memenuhi syarat, tekan <strong>Mahjong!</strong> untuk menang.</li>
          <li>Kalau belum, pilih 1 ubin lalu tekan <strong>Buang</strong>. Mengetuk ubin yang sama dua kali juga langsung membuangnya.</li>
        </ol>
        <p>
          Tiap aksi dibatasi waktu yang ditentukan pembuat ruangan (bawaannya 15 detik). Kalau waktu
          habis, ubin yang terakhir kamu dapat dibuang otomatis, dan tawaran klaim dianggap dilewati.
        </p>
        <p>
          Di mode <strong>Time attack</strong> (pilihan saat membuat ruangan), batas waktu semua pemain
          dipercepat jadi setengahnya selama ada pemain yang tinggal butuh 1 ubin untuk menang.
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

      {ruleset === 'hk' && <HongKongSections />}

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

export function TutorialScreen({ ruleset, onBack }: { ruleset: Ruleset; onBack: () => void }) {
  return (
    <main className="setup">
      <article className="card setup__card tutorial">
        <button type="button" className="btn btn--small setup__back" onClick={onBack}>
          ← Kembali
        </button>
        <h1 className="setup__title">{TITLES[ruleset]}</h1>
        <TutorialContent ruleset={ruleset} />
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
export function TutorialDialog({
  ruleset,
  open,
  onClose,
}: {
  ruleset: Ruleset
  open: boolean
  onClose: () => void
}) {
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
              {TITLES[ruleset]}
            </h2>
            <button ref={closeRef} type="button" className="btn btn--small" onClick={onClose}>
              Tutup
            </button>
          </header>
          <TutorialContent ruleset={ruleset} />
        </div>
      </div>
    </dialog>
  )
}
