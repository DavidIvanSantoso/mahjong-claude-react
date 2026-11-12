import { useEffect, useRef, useState, type ReactNode } from 'react'
import palungFavicon from '../assets/palung-favicon.svg'
import { MusicSlot } from '../components/MusicPlayer'
import { CreatorCredit } from '../components/HomeScreen'
import { CAVE, COMBO_STEPS, ENEMIES, PLAYER, ZONES, type EnemyKind } from './config'
import type { Summary } from './engine'
import { PalungGame } from './PalungGame'
import { drawPreview } from './render'

const BEST_KEY = 'palung-best'

interface Best {
  depth: number
  score: number
  wpm: number
}

function loadBest(): Best | null {
  try {
    const value = JSON.parse(localStorage.getItem(BEST_KEY) ?? 'null')
    return value && typeof value.depth === 'number' ? (value as Best) : null
  } catch {
    return null
  }
}

/** Menyimpan rekor terbaik (per angka: kedalaman, skor, WPM masing-masing disimpan yang tertinggi). */
function saveBest(result: Summary, previous: Best | null): Best {
  const best = {
    depth: Math.max(previous?.depth ?? 0, result.depth),
    score: Math.max(previous?.score ?? 0, result.score),
    wpm: Math.max(previous?.wpm ?? 0, Math.round(result.wpm)),
  }
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best))
  } catch {
    // localStorage bisa diblokir; rekornya hanya berlaku selama halaman terbuka.
  }
  return best
}

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Bungee&family=JetBrains+Mono:wght@400;600;700;800&display=swap'

/** Tema PALUNG (palung.css, `:root[data-game='palung']`), font, judul tab, dan ikon tab selama layar ini terbuka. */
function usePalungTheme() {
  useEffect(() => {
    const root = document.documentElement
    const title = document.title
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const previousIcon = icon?.getAttribute('href') ?? null
    root.dataset.game = 'palung'
    document.title = 'PALUNG - Selami, Ketik, Bertahan'
    icon?.setAttribute('href', palungFavicon)
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const font = document.createElement('link')
      font.rel = 'stylesheet'
      font.href = FONT_HREF
      document.head.appendChild(font)
    }
    return () => {
      delete root.dataset.game
      document.title = title
      if (icon && previousIcon !== null) icon.setAttribute('href', previousIcon)
    }
  }, [])
}

function Preview({ kind }: { kind: EnemyKind }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    // Tunggu font/tata letak selesai supaya ukuran kanvas sudah benar.
    const id = requestAnimationFrame(() => ref.current && drawPreview(ref.current, kind))
    return () => cancelAnimationFrame(id)
  }, [kind])
  return <canvas ref={ref} className="pl-preview" aria-hidden="true" />
}

const GUIDE_KINDS: { kind: EnemyKind; text: string }[] = [
  { kind: 'teri', text: 'Datang berkawanan, satu huruf, sangat cepat.' },
  { kind: 'piranha', text: 'Cepat, kata pendek (3–4 huruf).' },
  { kind: 'hiu', text: 'Kecepatan sedang, kata menengah (5–7 huruf).' },
  { kind: 'martil', text: 'Lambat, kata panjang (8–12 huruf).' },
  { kind: 'bayangan', text: 'Samar (tembus pandang) dan baru bisa diketik setelah melewati garis putus-putus dekat penyelam. Muncul mulai 150 m.' },
  { kind: 'kraken', text: 'Penjaga zona: beberapa kata berurutan. Penyelam berhenti turun sampai ia kalah. Kalau sampai menyentuhmu, hilang 2 hati.' },
  {
    kind: 'megalodon',
    text: 'Penjaga zona bergiliran dengan Kraken (pertama di 300 m); ikan lain berhenti muncul. Ia menembakkan misil berkata: ketik untuk memantulkannya ke titik tembak, kena kalau bos masih di sana. Saat ia bersiap menggigit, tekan huruf yang muncul sebelum waktunya habis.',
  },
  { kind: 'oksigen', text: 'Gelembung oksigen (muncul kalau hatimu berkurang): ketik katanya untuk +1 hati.' },
  { kind: 'mutiara', text: 'Kerang mutiara: +1 Sonar dan skor bonus.' },
]

function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog ref={ref} className="pl-dialog" onClose={onClose} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="pl-panel pl-guide">
        <h2 className="pl-panel__title">Cara Main</h2>
        <ol className="pl-guide__steps">
          <li>
            Kamu penyelam yang terus turun dari <strong>0 m</strong>. Bertahanlah sedalam mungkin; kamu punya <strong>{PLAYER.hearts} hati</strong>.
          </li>
          <li>
            Ketik huruf pertama sebuah kata untuk <strong>mengunci</strong> ikan terdekat yang cocok, lalu selesaikan katanya. Huruf yang sudah
            benar berwarna kuning.
          </li>
          <li>Ikan yang mencapaimu mengambil 1 hati. Salah ketik tidak mengurangi hati, tapi memutus kombo dan menurunkan akurasi.</li>
          <li>
            <kbd>Backspace</kbd> melepas target (kemajuan kata itu diulang). <kbd>Enter</kbd> menembakkan <strong>Sonar</strong> yang
            menghancurkan semua ikan dan misil di layar (kecuali bos). Kamu mulai dengan {PLAYER.sonar} Sonar, maksimal {PLAYER.maxSonar}.
          </li>
          <li>
            Kombo (kata beruntun tanpa salah) menggandakan skor:{' '}
            {COMBO_STEPS.filter((step) => step.multiplier > 1)
              .map((step) => `×${step.multiplier} mulai ${step.at}`)
              .join(', ')}
            .
          </li>
          <li>Makin dalam, laut makin gelap, ikan makin banyak dan makin cepat.</li>
          <li>
            <strong>Arus Gua</strong> (mulai {CAVE.firstAt} m, lalu tiap {CAVE.every} m): penyelam berenang mendatar melewati gua. Gerak dengan{' '}
            <kbd>←</kbd> <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> atau <kbd>WASD</kbd> (di HP: tahan dan geser jari). Hindari dinding, Belut Moray
            yang menerjang dari lubang bermata kuning, bulu babi, dan ubur-ubur api. Ambil mutiara emas untuk skor. Lolos tanpa tergores: bonus ×2
            dan +1 Sonar.
          </li>
        </ol>
        <ul className="pl-guide__kinds">
          {GUIDE_KINDS.map(({ kind, text }) => (
            <li key={kind}>
              <Preview kind={kind} />
              <div>
                <strong>{ENEMIES[kind].name}</strong>
                <span>{text}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="pl-muted">Zona: {ZONES.map((zone) => `${zone.name} (${zone.from} m)`).join(' → ')}</p>
        <button type="button" className="pl-btn pl-btn--primary" onClick={onClose}>
          Mengerti
        </button>
      </div>
    </dialog>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function ResultCard({ result, previous, onRetry, onMenu }: { result: Summary; previous: Best | null; onRetry: () => void; onMenu: () => void }) {
  const record = !previous || result.depth > previous.depth
  const kinds = (Object.keys(ENEMIES) as EnemyKind[]).filter((kind) => result.byKind[kind])
  const retryRef = useRef<HTMLButtonElement>(null)
  useEffect(() => retryRef.current?.focus(), [])
  return (
    <div className="pl-overlay pl-overlay--result">
      <div className="pl-panel pl-result" role="dialog" aria-labelledby="pl-result-title">
        <p className="pl-eyebrow">{record ? 'Rekor baru!' : 'Oksigen habis'}</p>
        <h2 id="pl-result-title" className="pl-result__depth">
          {result.depth} m
        </h2>
        <p className="pl-muted">
          Bertahan {formatTime(result.time)}
          {previous && !record && ` · rekor ${previous.depth} m`}
        </p>
        <dl className="pl-stats">
          <div>
            <dt>Skor</dt>
            <dd>{result.score.toLocaleString('id-ID')}</dd>
          </div>
          <div>
            <dt>WPM</dt>
            <dd>{Math.round(result.wpm)}</dd>
          </div>
          <div>
            <dt>Akurasi</dt>
            <dd>{Math.round(result.accuracy * 100)}%</dd>
          </div>
          <div>
            <dt>Kombo terbaik</dt>
            <dd>{result.bestCombo}</dd>
          </div>
        </dl>
        {kinds.length > 0 && (
          <p className="pl-muted pl-result__kills">
            {result.kills} dikalahkan: {kinds.map((kind) => `${ENEMIES[kind].name} ${result.byKind[kind]}`).join(' · ')}
          </p>
        )}
        <div className="pl-actions">
          <button ref={retryRef} type="button" className="pl-btn pl-btn--primary" onClick={onRetry}>
            Selam lagi
          </button>
          <button type="button" className="pl-btn" onClick={onMenu}>
            Menu
          </button>
        </div>
      </div>
    </div>
  )
}

function Home({ nav, best, onStart, onGuide }: { nav: ReactNode; best: Best | null; onStart: () => void; onGuide: () => void }) {
  return (
    <main className="pl-home">
      {nav}
      <div className="home__tools">
        <MusicSlot />
      </div>
      <div className="pl-home__bubbles" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 1.3) % 7}s`, animationDuration: `${6 + (i % 5)}s` }} />
        ))}
      </div>
      <section className="pl-home__card" aria-labelledby="pl-title">
        <p className="pl-eyebrow">Game mengetik · 1 pemain</p>
        <h1 id="pl-title" className="pl-logo">
          PALUNG
        </h1>
        <p className="pl-tagline">Selami, ketik, bertahan.</p>
        <p className="pl-home__lead">
          Menyelamlah sedalam mungkin. Ikan berdatangan membawa kata; ketik katanya sebelum mereka mencapaimu. Makin dalam, makin gelap
          dan makin ramai.
        </p>
        <div className="pl-home__fish">
          {(['teri', 'piranha', 'hiu', 'martil'] as EnemyKind[]).map((kind) => (
            <Preview key={kind} kind={kind} />
          ))}
        </div>
        {best && (
          <dl className="pl-stats pl-stats--best" aria-label="Rekor terbaik">
            <div>
              <dt>Terdalam</dt>
              <dd>{best.depth} m</dd>
            </div>
            <div>
              <dt>Skor</dt>
              <dd>{best.score.toLocaleString('id-ID')}</dd>
            </div>
            <div>
              <dt>WPM</dt>
              <dd>{best.wpm}</dd>
            </div>
          </dl>
        )}
        <div className="pl-actions">
          <button type="button" className="pl-btn pl-btn--primary pl-btn--big" onClick={onStart}>
            Mulai menyelam
          </button>
          <button type="button" className="pl-btn" onClick={onGuide}>
            Cara main
          </button>
        </div>
        <p className="pl-muted pl-home__hint">Butuh keyboard. Di HP, ketuk layar permainan untuk membuka keyboard.</p>
      </section>
      <CreatorCredit />
    </main>
  )
}

type Screen = { kind: 'home' } | { kind: 'play'; run: number; result: Summary | null; previous: Best | null }

export function PalungApp({ nav }: { nav: ReactNode }) {
  usePalungTheme()
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const [best, setBest] = useState(loadBest)
  const [guideOpen, setGuideOpen] = useState(false)
  const start = (run = 0) => setScreen({ kind: 'play', run, result: null, previous: best })

  if (screen.kind === 'play') {
    return (
      <>
        <PalungGame
          key={screen.run}
          frozen={screen.result !== null}
          onExit={() => setScreen({ kind: 'home' })}
          onOver={(result) => {
            setBest(saveBest(result, screen.previous))
            setScreen({ ...screen, result })
          }}
        />
        {screen.result && (
          <ResultCard result={screen.result} previous={screen.previous} onRetry={() => start(screen.run + 1)} onMenu={() => setScreen({ kind: 'home' })} />
        )}
      </>
    )
  }
  return (
    <>
      <Home nav={nav} best={best} onStart={() => start()} onGuide={() => setGuideOpen(true)} />
      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  )
}
