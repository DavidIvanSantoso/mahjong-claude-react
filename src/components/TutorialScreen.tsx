import { useEffect, useRef, type ReactNode } from 'react'
import { BASE_POINTS, FAAN, faanItem, LIMIT_FAAN, type FaanKey } from '../game/scoring'
import type { Ruleset } from '../game/state'
import type { Suit, Tile } from '../game/tiles'
import { t } from '../i18n'
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

function title(ruleset: Ruleset): string {
  return ruleset === 'hk'
    ? t('Cara bermain: Hong Kong Points', 'How to play: Hong Kong Points')
    : t('Cara bermain', 'How to play')
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
 * menampilkan bagian itu; `note` ([Indonesia, Inggris]) menjelaskan apa yang harus diperhatikan.
 */
const FAAN_EXAMPLES: Record<FaanKey, { tiles: Tile[]; note: [string, string] }> = {
  selfDraw: {
    tiles: [...tiles('man', 2, 3, 4), ...tiles('pin', 6, 6, 6), ...tiles('sou', 1, 2, 3, 7, 8, 9), ...tiles('wind', 3, 3)],
    note: [
      'Tangan apa pun, asal ubin penentunya kamu ambil sendiri dari dinding, bukan dari buangan.',
      'Any hand, as long as you draw the winning tile yourself from the wall, not from a discard.',
    ],
  },
  concealed: {
    tiles: [...tiles('man', 4, 5, 6), ...tiles('pin', 1, 1, 1, 3, 4, 5), ...tiles('sou', 6, 7, 8), ...tiles('dragon', 2, 2)],
    note: [
      'Semua set dibentuk di tangan, tanpa chi/pong/kong dari buangan. Kong tertutup tetap boleh.',
      'Every set is formed in your hand, with no chi/pong/kong claimed from discards. Concealed kongs are allowed.',
    ],
  },
  allChi: {
    tiles: [...tiles('man', 1, 2, 3, 5, 6, 7), ...tiles('pin', 2, 3, 4), ...tiles('sou', 6, 7, 8, 9, 9)],
    note: ['Keempat setnya urutan (chi), ditambah satu pair.', 'All four sets are sequences (chi), plus one pair.'],
  },
  seatWind: {
    tiles: tiles('wind', 1, 1, 1),
    note: [
      'Pong atau kong dari angin kursimu. Contoh ini berlaku kalau kamu duduk di Timur.',
      'A pong or kong of your seat wind. This example counts if you sit at East.',
    ],
  },
  roundWind: {
    tiles: tiles('wind', 2, 2, 2),
    note: [
      'Pong atau kong dari angin ronde. Contoh ini berlaku selama ronde Selatan.',
      'A pong or kong of the round wind. This example counts during the South round.',
    ],
  },
  dragon: {
    tiles: tiles('dragon', 1, 1, 1),
    note: [
      'Pong atau kong naga apa pun (Merah, Hijau, atau Putih); tiap set bernilai 1 faan.',
      'A pong or kong of any dragon (Red, Green, or White); each set is worth 1 faan.',
    ],
  },
  noFlower: {
    tiles: [],
    note: [
      'Kamu tidak mendapat satu pun ubin bunga atau musim sepanjang ronde.',
      'You get no flower or season tiles at all during the round.',
    ],
  },
  ownFlower: {
    tiles: tiles('flower', 1, 5),
    note: [
      'Bunga atau musim yang nomornya sama dengan angin kursimu (kursi Timur: nomor 1); 1 faan per ubin.',
      'A flower or season whose number matches your seat wind (East seat: number 1); 1 faan per tile.',
    ],
  },
  flowerSet: {
    tiles: tiles('flower', 1, 2, 3, 4),
    note: [
      'Keempat bunga, atau keempat musim; 2 faan per set lengkap.',
      'All four flowers, or all four seasons; 2 faan per complete set.',
    ],
  },
  allPong: {
    tiles: [...tiles('man', 2, 2, 2), ...tiles('pin', 5, 5, 5, 8, 8, 8), ...tiles('sou', 3, 3, 3, 9, 9)],
    note: ['Keempat setnya pong atau kong, ditambah satu pair.', 'All four sets are pongs or kongs, plus one pair.'],
  },
  halfFlush: {
    tiles: [...tiles('pin', 1, 2, 3, 4, 5, 6, 9, 9, 9), ...tiles('wind', 1, 1, 1), ...tiles('dragon', 2, 2)],
    note: [
      'Hanya satu suit angka, sisanya angin dan/atau naga.',
      'Only one numbered suit; the rest are winds and/or dragons.',
    ],
  },
  smallDragons: {
    tiles: [...tiles('dragon', 1, 1, 1, 2, 2, 2, 3, 3)],
    note: [
      'Dua pong naga dan pair dari naga ketiga; dua set lainnya bebas.',
      'Two dragon pongs and a pair of the third dragon; the other two sets are free.',
    ],
  },
  smallWinds: {
    tiles: [...tiles('wind', 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4)],
    note: [
      'Tiga pong angin dan pair dari angin keempat; satu set lainnya bebas.',
      'Three wind pongs and a pair of the fourth wind; the remaining set is free.',
    ],
  },
  fullFlush: {
    tiles: [...tiles('sou', 1, 1, 1, 2, 3, 4, 5, 6, 7, 7, 8, 9, 9, 9)],
    note: [
      'Seluruh tangan dari satu suit angka, tanpa angin dan naga.',
      'The whole hand is one numbered suit, with no winds or dragons.',
    ],
  },
  bigDragons: {
    tiles: [...tiles('dragon', 1, 1, 1, 2, 2, 2, 3, 3, 3)],
    note: [
      'Pong dari ketiga naga; satu set dan pair lainnya bebas.',
      'Pongs of all three dragons; the remaining set and pair are free.',
    ],
  },
  bigWinds: {
    tiles: [...tiles('wind', 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4)],
    note: ['Pong dari keempat angin; pair-nya bebas.', 'Pongs of all four winds; the pair is free.'],
  },
  allHonors: {
    tiles: [...tiles('wind', 1, 1, 1, 3, 3, 3, 4, 4, 4), ...tiles('dragon', 1, 1, 1, 3, 3)],
    note: [
      'Seluruh tangan hanya angin dan naga, tanpa ubin angka.',
      'The whole hand is winds and dragons only, with no numbered tiles.',
    ],
  },
}

const FAAN_KEYS = Object.keys(FAAN) as FaanKey[]

/** Bagian tambahan untuk Hong Kong Points: cara kemenangan dinilai dan dibayar. */
function HongKongSections() {
  return (
    <>
      <Section title="Hong Kong Points">
        {t(
          <>
            <p>
              Cara bermainnya sama dengan mode Normal. Bedanya, tiap kemenangan dinilai: pola di tangan
              menang memberi <strong>faan</strong>, jumlah faan menentukan <strong>poin dasar</strong>,
              dan pemain lain membayar poin itu ke pemenang.
            </p>
            <p>Tidak ada faan minimum: tangan tanpa pola tetap boleh menang, nilainya 0 faan.</p>
          </>,
          <>
            <p>
              It plays the same as Normal mode. The difference is that every win is scored: patterns in
              the winning hand give <strong>faan</strong>, the total faan sets the <strong>base points</strong>,
              and the other players pay those points to the winner.
            </p>
            <p>There is no minimum faan: a hand with no pattern can still win, worth 0 faan.</p>
          </>,
        )}
      </Section>

      <Section title={t('Bandar dan angin', 'Dealer and winds')}>
        {t(
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
          </ul>,
          <ul>
            <li>
              At the start of the game every player rolls two dice; the highest total becomes the{' '}
              <strong>dealer</strong> of the first round and sits at East. The next players sit at South,
              West, then North. Each player&apos;s seat wind is shown before their name.
            </li>
            <li>
              The dealer stays if they win or the round is a draw. Otherwise the dealer passes to the next
              player. Once every player has been dealer, the <strong>round wind</strong> changes (East,
              South, West, North).
            </li>
            <li>
              Flowers and seasons numbered 1–4 pair with East, South, West, North. A flower whose number
              matches your seat wind is worth faan.
            </li>
          </ul>,
        )}
      </Section>

      <Section title={t('Daftar faan', 'Faan list')}>
        <ul className="faan-list">
          {FAAN_KEYS.map((key) => {
            const item = faanItem(key)
            const [noteId, noteEn] = FAAN_EXAMPLES[key].note
            return (
              <li key={key}>
                <div className="faan-list__head">
                  <strong>{item.label}</strong>
                  <span className="faan-list__value">{item.faan} faan</span>
                </div>
                <TileRow items={FAAN_EXAMPLES[key].tiles} label={t(noteId, noteEn)} />
              </li>
            )
          })}
        </ul>
        <p>
          {t(
            `Semua pola yang terpenuhi dijumlahkan, paling banyak ${LIMIT_FAAN} faan. Pong naga dan bunga kursi dihitung per set/ubin. Tiga naga dan empat angin (kecil/besar) sudah mencakup nilai pong-pongnya.`,
            `All matching patterns are added up, to at most ${LIMIT_FAAN} faan. Dragon pongs and seat flowers count per set/tile. Three dragons and four winds (small/big) already include the value of their pongs.`,
          )}
        </p>
      </Section>

      <Section title={t('Poin dan pembayaran', 'Points and payment')}>
        <table className="tutorial__table">
          <thead>
            <tr>
              <th>Faan</th>
              <th>{t('Poin dasar', 'Base points')}</th>
            </tr>
          </thead>
          <tbody>
            {BASE_POINTS.map((points, faan) => (
              <tr key={faan}>
                <td>{faan === LIMIT_FAAN ? t(`${faan} atau lebih`, `${faan} or more`) : faan}</td>
                <td>{points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {t(
          <>
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
          </>,
          <>
            <ul>
              <li>
                <strong>Self-drawn win</strong>: every other player pays 2× the base points.
              </li>
              <li>
                <strong>Win on a discard</strong>: the discarder pays 2× the base points, the others 1×.
              </li>
              <li>
                <strong>Draw</strong>: no points change hands.
              </li>
            </ul>
            <p>Each player&apos;s total points are shown on the scoreboard while the game continues.</p>
          </>,
        )}
      </Section>
    </>
  )
}

/** Isi tutorial; dipakai halaman Tutorial dan modal tutorial di meja permainan. */
function TutorialContent({ ruleset }: { ruleset: Ruleset }) {
  return (
    <>
      <Section title={t('Tujuan', 'Goal')}>
        <p>
          {t(
            <>
              Jadilah yang pertama mengumpulkan <strong>4 set + 1 pair</strong>, total 14 ubin.
            </>,
            <>
              Be the first to collect <strong>4 sets + 1 pair</strong>, 14 tiles in total.
            </>,
          )}
        </p>
        <TileRow
          items={WINNING_HAND}
          label={t('Contoh tangan menang: chi, pong, chi, pong, dan pair', 'Example winning hand: chi, pong, chi, pong, and a pair')}
        />
      </Section>

      <Section title={t('Jenis ubin', 'Tile types')}>
        <TileRow items={tiles('man', 1, 2, 3, 4, 5, 6, 7, 8, 9)} label={t('Karakter 1–9', 'Characters 1–9')} />
        <TileRow items={tiles('pin', 1, 2, 3, 4, 5, 6, 7, 8, 9)} label={t('Bulat 1–9', 'Dots 1–9')} />
        <TileRow items={tiles('sou', 1, 2, 3, 4, 5, 6, 7, 8, 9)} label={t('Bambu 1–9', 'Bamboo 1–9')} />
        <TileRow
          items={tiles('wind', 1, 2, 3, 4)}
          label={t('Angin: Timur, Selatan, Barat, Utara', 'Winds: East, South, West, North')}
        />
        <TileRow items={tiles('dragon', 1, 2, 3)} label={t('Naga: Merah, Hijau, Putih', 'Dragons: Red, Green, White')} />
        <p>
          {t(
            'Masing-masing ada 4 salinan. Ditambah 8 ubin bunga (lihat di bawah), totalnya 144 ubin.',
            'There are 4 copies of each. Add 8 flower tiles (see below) for 144 tiles in total.',
          )}
        </p>
      </Section>

      <Section title={t('Set dan pair', 'Sets and pairs')}>
        <TileRow items={tiles('pin', 7, 7, 7)} label={t('Pong — 3 ubin kembar', 'Pong — 3 identical tiles')} />
        <TileRow
          items={tiles('sou', 3, 4, 5)}
          label={t('Chi — 3 angka berurutan dalam suit yang sama', 'Chi — 3 consecutive numbers in the same suit')}
        />
        <TileRow
          items={tiles('dragon', 2, 2, 2, 2)}
          label={t('Kong — 4 ubin kembar, dihitung satu set', 'Kong — 4 identical tiles, counted as one set')}
        />
        <TileRow items={tiles('man', 9, 9)} label={t('Pair — 2 ubin kembar', 'Pair — 2 identical tiles')} />
        <p>
          {t(
            'Angin dan naga tidak bisa dijadikan chi. Urutan tidak boleh melompati batas (8-9-1 tidak sah).',
            'Winds and dragons cannot form a chi. Sequences cannot wrap around (8-9-1 is not valid).',
          )}
        </p>
      </Section>

      <Section title={t('Jalannya giliran', 'Taking a turn')}>
        {t(
          <>
            <p>
              Di awal permainan tiap pemain melempar dua dadu, dan pemilik angka tertinggi jalan pertama
              (kalau seri, dadunya dilempar ulang).
              {ruleset === 'classic' && ' Di ronde berikutnya, giliran pertama pindah ke pemain selanjutnya.'}
            </p>
            <ol>
              <li>Ambil 1 ubin dari dinding.</li>
              <li>
                Kalau 14 ubinmu sudah memenuhi syarat, tekan <strong>Mahjong!</strong> untuk menang.
              </li>
              <li>
                Kalau belum, pilih 1 ubin lalu tekan <strong>Buang</strong>. Mengetuk ubin yang sama dua kali
                juga langsung membuangnya.
              </li>
            </ol>
            <p>
              Tiap aksi dibatasi waktu yang ditentukan pembuat ruangan (bawaannya 15 detik). Kalau waktu
              habis, ubin yang terakhir kamu dapat dibuang otomatis, dan tawaran klaim dianggap dilewati.
            </p>
            <p>
              Di mode <strong>Time attack</strong> (pilihan saat membuat ruangan), batas waktu semua pemain
              dipercepat jadi setengahnya selama ada pemain yang tinggal butuh 1 ubin untuk menang.
            </p>
          </>,
          <>
            <p>
              At the start of the game every player rolls two dice, and the highest total goes first (on a
              tie, the dice are rolled again).
              {ruleset === 'classic' && ' In later rounds, the first turn passes to the next player.'}
            </p>
            <ol>
              <li>Draw 1 tile from the wall.</li>
              <li>
                If your 14 tiles form a winning hand, press <strong>Mahjong!</strong> to win.
              </li>
              <li>
                Otherwise, pick 1 tile and press <strong>Discard</strong>. Tapping the same tile twice also
                discards it right away.
              </li>
            </ol>
            <p>
              Every action has a time limit set by whoever creates the game (15 seconds by default). When
              time runs out, the tile you got last is discarded automatically, and a claim offer is passed.
            </p>
            <p>
              In <strong>Time attack</strong> mode (chosen when creating the game), everyone&apos;s time limit
              is halved while any player needs only 1 more tile to win.
            </p>
          </>,
        )}
      </Section>

      <Section title={t('Mengklaim buangan', 'Claiming discards')}>
        {t(
          <>
            <p>Ubin yang baru dibuang bisa diambil pemain lain, dengan urutan prioritas:</p>
            <ol>
              <li>
                <strong>Menang</strong> — kalau ubin itu melengkapi tanganmu.
              </li>
              <li>
                <strong>Pong / Kong</strong> — kalau kamu punya 2 atau 3 ubin kembarnya.
              </li>
              <li>
                <strong>Chi</strong> — hanya untuk pemain tepat setelah pembuang.
              </li>
            </ol>
            <p>
              Setelah pong atau chi, kamu langsung membuang tanpa mengambil dari dinding, dan giliran
              berlanjut dari kamu. Set yang diklaim ditaruh terbuka di depanmu.
            </p>
          </>,
          <>
            <p>A freshly discarded tile can be taken by another player, in this order of priority:</p>
            <ol>
              <li>
                <strong>Win</strong> — if the tile completes your hand.
              </li>
              <li>
                <strong>Pong / Kong</strong> — if you hold 2 or 3 matching tiles.
              </li>
              <li>
                <strong>Chi</strong> — only for the player right after the discarder.
              </li>
            </ol>
            <p>
              After a pong or chi you discard right away without drawing from the wall, and play continues
              from you. The claimed set is placed face up in front of you.
            </p>
          </>,
        )}
      </Section>

      <Section title="Kong">
        {t(
          <>
            <ul>
              <li>
                <strong>Tertutup</strong>: 4 ubin kembar di tanganmu, dinyatakan pada giliranmu.
              </li>
              <li>
                <strong>Tambahan</strong>: menambah ubin ke-4 ke pong yang sudah terbuka.
              </li>
              <li>
                <strong>Dari buangan</strong>: punya 3 kembar, lalu pemain lain membuang yang ke-4.
              </li>
            </ul>
            <p>Setelah kong kamu otomatis mengambil 1 ubin pengganti dari dinding.</p>
          </>,
          <>
            <ul>
              <li>
                <strong>Concealed</strong>: 4 identical tiles in your hand, declared on your turn.
              </li>
              <li>
                <strong>Added</strong>: adding the 4th tile to a pong that is already exposed.
              </li>
              <li>
                <strong>From a discard</strong>: you hold 3 identical tiles and another player discards the 4th.
              </li>
            </ul>
            <p>After a kong you automatically draw 1 replacement tile from the wall.</p>
          </>,
        )}
      </Section>

      <Section title={t('Bunga', 'Flowers')}>
        <TileRow items={tiles('flower', 1, 2, 3, 4, 5, 6, 7, 8)} label={t('4 bunga dan 4 musim', '4 flowers and 4 seasons')} />
        <p>
          {t(
            'Bunga tidak masuk tangan. Begitu didapat, bunga disisihkan dan otomatis diganti ubin baru.',
            'Flowers do not go into your hand. As soon as you get one, it is set aside and replaced with a new tile automatically.',
          )}
        </p>
      </Section>

      <Section title={t('Seri', 'Draw')}>
        <p>
          {t(
            'Kalau dinding habis dan belum ada yang menang, permainan berakhir seri.',
            'If the wall runs out before anyone wins, the game ends in a draw.',
          )}
        </p>
      </Section>

      {ruleset === 'hk' && <HongKongSections />}

      <Section title={t('Mode permainan', 'Game modes')}>
        {t(
          <ul>
            <li>
              <strong>Local</strong>: 2–4 pemain bergantian di satu perangkat. Tangan disembunyikan saat
              ganti giliran, dan meja berputar ke pemain berikutnya.
            </li>
            <li>
              <strong>Online</strong>: satu pemain membuat room, yang lain masuk dengan kode atau link.
              Pemain yang terputus lebih dari 15 detik dilewati gilirannya sampai tersambung kembali.
            </li>
          </ul>,
          <ul>
            <li>
              <strong>Local</strong>: 2–4 players take turns on one device. Hands are hidden between turns,
              and the table rotates to the next player.
            </li>
            <li>
              <strong>Online</strong>: one player creates a room and the others join with the code or link.
              A player who is disconnected for more than 15 seconds has their turns skipped until they
              reconnect.
            </li>
          </ul>,
        )}
      </Section>
    </>
  )
}

export function TutorialScreen({ ruleset, onBack }: { ruleset: Ruleset; onBack: () => void }) {
  return (
    <main className="setup">
      <article className="card setup__card tutorial">
        <button type="button" className="btn btn--small setup__back" onClick={onBack}>
          ← {t('Kembali', 'Back')}
        </button>
        <h1 className="setup__title">{title(ruleset)}</h1>
        <TutorialContent ruleset={ruleset} />
        <button type="button" className="btn btn--primary btn--wide" onClick={onBack}>
          {t('Kembali ke menu', 'Back to menu')}
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
              {title(ruleset)}
            </h2>
            <button ref={closeRef} type="button" className="btn btn--small" onClick={onClose}>
              {t('Tutup', 'Close')}
            </button>
          </header>
          <TutorialContent ruleset={ruleset} />
        </div>
      </div>
    </dialog>
  )
}
