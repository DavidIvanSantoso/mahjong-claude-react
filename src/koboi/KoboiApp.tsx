import { useEffect, useRef, useState, type ReactNode } from 'react'
import koboiFavicon from '../assets/koboi-favicon.svg'
import { CreatorCredit } from '../components/HomeScreen'
import { MusicSlot } from '../components/MusicPlayer'
import { BOSS, DASH, PLAYER, RECOVERY } from './config'
import type { Summary } from './engine'
import { KoboiGame } from './KoboiGame'
import { updateSettings, useSettings } from './settings'
import { playEvents, unlockAudio } from './sfx'
import type { Mode } from './state'

const BEST_KEY = 'koboi-best'

interface Best {
  endless?: { score: number; wave: number; time: number }
  boss?: { score: number; time: number; wins: number }
}

function loadBest(): Best {
  try {
    const value = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}')
    return value && typeof value === 'object' ? (value as Best) : {}
  } catch {
    return {}
  }
}

/** Menyimpan rekor; mengembalikan rekor baru dan apakah skor ini rekor. */
function saveBest(result: Summary): { best: Best; record: boolean } {
  const best = loadBest()
  let record = false
  if (result.mode === 'endless') {
    const old = best.endless
    record = !old || result.score > old.score
    best.endless = {
      score: Math.max(old?.score ?? 0, result.score),
      wave: Math.max(old?.wave ?? 0, result.wave),
      time: Math.max(old?.time ?? 0, result.time),
    }
  } else {
    const old = best.boss
    record = result.won && (!old || result.score > old.score)
    best.boss = {
      score: Math.max(old?.score ?? 0, result.won ? result.score : 0),
      time: result.won && (!old?.time || result.time < old.time) ? result.time : (old?.time ?? 0),
      wins: (old?.wins ?? 0) + (result.won ? 1 : 0),
    }
  }
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best))
  } catch {
    // localStorage bisa diblokir; rekornya berlaku selama halaman terbuka.
  }
  return { best, record }
}

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Rye&family=Space+Grotesk:wght@400;500;600;700&display=swap'

/** Tema KOBOI (koboi.css, `:root[data-game='koboi']`), font, judul tab, dan ikon tab selama layar ini terbuka. */
function useKoboiTheme() {
  useEffect(() => {
    const root = document.documentElement
    const title = document.title
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const previousIcon = icon?.getAttribute('href') ?? null
    root.dataset.game = 'koboi'
    document.title = 'KOBOI - Duel di Gurun'
    icon?.setAttribute('href', koboiFavicon)
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

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ---------- Dialog ----------

function useDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return ref
}

function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useDialog(open)
  return (
    <dialog ref={ref} className="kb-dialog" onClose={onClose} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="kb-panel kb-guide">
        <h2 className="kb-panel__title">Cara Main</h2>
        <ol className="kb-guide__steps">
          <li>
            Kamu <strong>koboi berkuda</strong> di dalam arena berpagar tali; kudanya menghadap ke arah gerakmu. Gerak dengan <kbd>W</kbd> <kbd>A</kbd>{' '}
            <kbd>S</kbd> <kbd>D</kbd> atau tombol panah. Yang bisa terkena hanya <strong>bintang emas di pelana</strong>, jadi peluru yang hanya
            menyerempet kuda atau topi tidak dihitung. Kamu tidak menembak: tugasmu <strong>menghindar</strong>.
          </li>
          <li>
            Kamu punya <strong>{PLAYER.hp} nyawa</strong>. Tiap kena serangan −1 nyawa, lalu kebal sebentar ({PLAYER.invuln} detik, jiwamu berkedip).
          </li>
          <li>
            <kbd>Spasi</kbd> atau <kbd>Shift</kbd> = <strong>dash</strong>: melesat pendek ke arah gerak, kebal selama {DASH.duration} detik, lalu
            jeda {DASH.cooldown} detik (cincin di kiri bawah arena). Bisa dimatikan di Pengaturan.
          </li>
          <li>
            Semua serangan punya <strong>tanda</strong> lebih dulu: garis merah bergaris di tepi = jalur bahaya, garis hijau putus-putus = celah aman,
            lingkaran merah = ledakan, bidikan putih yang memerah = tembakan ke titik itu, garis biru = lintasan peluru pantul.
          </li>
          <li>
            <strong>Bertahan</strong>: gelombang tanpa akhir. Skor dari lama bertahan, bonus tiap gelombang, dan bonus <em>sempurna</em> kalau tidak
            terkena sama sekali. Tiap {RECOVERY.every} gelombang ada istirahat (+{RECOVERY.heal} nyawa).
          </li>
          <li>
            <strong>Duel Bos</strong>: hadapi <strong>{BOSS.name}</strong> dalam 3 fase. Nyalinya berkurang tiap serangannya kamu lewati (lebih banyak kalau
            tanpa terkena). Sesekali ada <strong>duel cepat</strong>: tunggu aba-aba <em>TEMBAK!</em>, lalu tekan <kbd>Spasi</kbd>/<kbd>Enter</kbd>/klik
            secepatnya. Terlalu cepat atau terlalu lambat = −1 nyawa.
          </li>
          <li>
            <kbd>Esc</kbd> menjeda. Pindah tab juga otomatis menjeda.
          </li>
        </ol>
        <ul className="kb-guide__patterns">
          <li>
            <strong>Kipas Revolver</strong> tembakan menyebar dari penembak di tepi; cari celahnya.
          </li>
          <li>
            <strong>Peluru Pantul</strong> memantul di dinding; lintasannya terlihat sebentar sebelum ditembak.
          </li>
          <li>
            <strong>Dinamit</strong> menjauh dari lingkaran sebelum cincin hitungannya habis.
          </li>
          <li>
            <strong>Semak Gulung</strong> bergulir dan melompat dari kiri/kanan.
          </li>
          <li>
            <strong>Duri Kaktus</strong> melesat dari satu sisi; berdiri di jalur hijau.
          </li>
          <li>
            <strong>Sabetan Laso</strong> menyapu dari sudut (jauhi porosnya) atau melintang (lewati simpulnya).
          </li>
          <li>
            <strong>Tanda Buronan</strong> bidikan mengikutimu lalu terkunci; geser sebelum ditembak.
          </li>
          <li>
            <strong>Badai Debu</strong> dinding debu bergerak dengan satu celah.
          </li>
          <li>
            <strong>Kereta Hantu</strong> rel berkedip merah lalu kereta melintas; keluar dari jalur rel.
          </li>
          <li>
            <strong>Banteng Seruduk</strong> membidik posisimu, lalu lari lurus di jalur bergaris.
          </li>
          <li>
            <strong>Putaran Peluru</strong> silinder revolver menembakkan spiral; ikuti putarannya.
          </li>
          <li>
            <strong>Tong Mesiu</strong> menggelinding lalu pecah jadi cincin duri dengan dua celah.
          </li>
        </ul>
        <button type="button" className="kb-btn kb-btn--primary" onClick={onClose}>
          Siap, Sheriff!
        </button>
      </div>
    </dialog>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="kb-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="kb-toggle__box" aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
    </label>
  )
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useDialog(open)
  const settings = useSettings()
  return (
    <dialog ref={ref} className="kb-dialog" onClose={onClose} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="kb-panel kb-settings">
        <h2 className="kb-panel__title">Pengaturan</h2>
        <label className="kb-range">
          <span>
            <strong>Volume efek suara</strong>
            <small>{Math.round(settings.volume * 100)}% · musik latar diatur lewat tombol musik situs</small>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(event) => updateSettings({ volume: Number(event.target.value) })}
            onPointerUp={() => playEvents(['shot'])}
            onKeyUp={() => playEvents(['shot'])}
          />
        </label>
        <Toggle label="Getaran layar" hint="Layar bergetar sedikit saat terkena dan saat ledakan." checked={settings.shake} onChange={(shake) => updateSettings({ shake })} />
        <Toggle
          label="Kurangi kilatan"
          hint="Tanpa kilatan merah layar penuh; kedipan kebal lebih lambat."
          checked={settings.reduceFlash}
          onChange={(reduceFlash) => updateSettings({ reduceFlash })}
        />
        <Toggle label="Dash" hint="Berlaku mulai permainan berikutnya." checked={settings.dash} onChange={(dash) => updateSettings({ dash })} />
        <Toggle label="Mode debug" hint="Tampilkan kotak tabrakan, jumlah peluru, dan seed." checked={settings.debug} onChange={(debug) => updateSettings({ debug })} />
        <p className="kb-muted kb-settings__keys">
          Kontrol: <kbd>WASD</kbd>/<kbd>←↑→↓</kbd> gerak · <kbd>Spasi</kbd>/<kbd>Shift</kbd> dash · <kbd>Esc</kbd> jeda
        </p>
        <button type="button" className="kb-btn kb-btn--primary" onClick={onClose}>
          Simpan
        </button>
      </div>
    </dialog>
  )
}

// ---------- Beranda ----------

function Home({ nav, best, onStart, onGuide, onSettings }: { nav: ReactNode; best: Best; onStart: (mode: Mode) => void; onGuide: () => void; onSettings: () => void }) {
  return (
    <main className="kb-home">
      <div className="kb-home__scene" aria-hidden="true">
        <span className="kb-home__sun" />
        <span className="kb-home__mesa kb-home__mesa--far" />
        <span className="kb-home__mesa" />
        <span className="kb-home__tumble" />
        <span className="kb-home__tumble kb-home__tumble--late" />
      </div>
      {nav}
      <div className="home__tools">
        <MusicSlot />
      </div>
      <section className="kb-poster" aria-labelledby="kb-title">
        <p className="kb-poster__wanted">Dicari: yang masih hidup</p>
        <h1 id="kb-title" className="kb-logo">
          KOBOI
        </h1>
        <p className="kb-tagline">Hindari peluru. Bertahan sampai senja.</p>
        <p className="kb-home__lead">
          Pacu kudamu di dalam arena tali, menghindari tembakan revolver, dinamit, laso, kereta hantu, banteng, dan badai debu. Makin lama bertahan, makin ganas
          serangannya.
        </p>
        <div className="kb-actions">
          <button type="button" className="kb-btn kb-btn--primary kb-btn--big" onClick={() => onStart('endless')}>
            Bertahan
          </button>
          <button type="button" className="kb-btn kb-btn--big" onClick={() => onStart('boss')}>
            Duel Bos
          </button>
        </div>
        <dl className="kb-best" aria-label="Rekor">
          <div>
            <dt>Rekor bertahan</dt>
            <dd>{best.endless ? `${best.endless.score.toLocaleString('id-ID')} · gel. ${best.endless.wave}` : '—'}</dd>
          </div>
          <div>
            <dt>{BOSS.name}</dt>
            <dd>{best.boss?.wins ? `menang ${best.boss.wins}× · ${formatTime(best.boss.time)}` : 'belum tertangkap'}</dd>
          </div>
        </dl>
        <div className="kb-links">
          <button type="button" className="kb-link" onClick={onGuide}>
            Cara main
          </button>
          <button type="button" className="kb-link" onClick={onSettings}>
            Pengaturan
          </button>
        </div>
        <p className="kb-muted kb-home__hint">Butuh keyboard: WASD/panah untuk bergerak, Spasi untuk dash.</p>
      </section>
      <CreatorCredit />
    </main>
  )
}

// ---------- Hasil (poster buronan) ----------

function ResultPoster({ result, record, onRetry, onMenu }: { result: Summary; record: boolean; onRetry: () => void; onMenu: () => void }) {
  const retryRef = useRef<HTMLButtonElement>(null)
  useEffect(() => retryRef.current?.focus(), [])
  const won = result.won
  return (
    <div className="kb-overlay kb-overlay--result">
      <div className="kb-wanted" role="dialog" aria-modal="true" aria-labelledby="kb-result-title">
        <p className="kb-wanted__head">{won ? 'Buronan tertangkap' : result.mode === 'boss' ? 'Kalah duel' : 'Dicari'}</p>
        <h2 id="kb-result-title" className="kb-wanted__title">
          {won ? 'SHERIFF BARU!' : result.mode === 'boss' ? 'TUMBANG' : 'MASIH HIDUP?'}
        </h2>
        {record && <p className="kb-wanted__record">★ Rekor baru ★</p>}
        <p className="kb-wanted__reward">
          <span>Hadiah</span>
          {result.score.toLocaleString('id-ID')}
        </p>
        <dl className="kb-wanted__stats">
          <div>
            <dt>Bertahan</dt>
            <dd>{formatTime(result.time)}</dd>
          </div>
          {result.mode === 'endless' ? (
            <div>
              <dt>Gelombang</dt>
              <dd>{result.wave}</dd>
            </div>
          ) : (
            <div>
              <dt>Nyali bos</dt>
              <dd>{won ? 'habis' : `${result.bossHp}/${BOSS.hp}`}</dd>
            </div>
          )}
          <div>
            <dt>Terkena</dt>
            <dd>{result.hits}</dd>
          </div>
          <div>
            <dt>Lolos</dt>
            <dd>{result.dodged}</dd>
          </div>
          <div>
            <dt>{result.mode === 'endless' ? 'Gel. sempurna' : 'Serangan sempurna'}</dt>
            <dd>{result.perfectWaves}</dd>
          </div>
        </dl>
        <div className="kb-actions">
          <button ref={retryRef} type="button" className="kb-btn kb-btn--primary" onClick={onRetry}>
            Main lagi
          </button>
          <button type="button" className="kb-btn" onClick={onMenu}>
            Menu utama
          </button>
        </div>
      </div>
    </div>
  )
}

type Screen = { kind: 'home' } | { kind: 'play'; mode: Mode; run: number; result: Summary | null; record: boolean }

export function KoboiApp({ nav }: { nav: ReactNode }) {
  useKoboiTheme()
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const [best, setBest] = useState(loadBest)
  const [guideOpen, setGuideOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  function start(mode: Mode, run = 0) {
    unlockAudio()
    setScreen({ kind: 'play', mode, run, result: null, record: false })
  }

  const dialogs = (
    <>
      <GuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )

  if (screen.kind === 'play') {
    return (
      <>
        <KoboiGame
          key={screen.run}
          mode={screen.mode}
          settingsOpen={settingsOpen}
          onSettings={() => setSettingsOpen(true)}
          onExit={() => setScreen({ kind: 'home' })}
          onOver={(result) => {
            const saved = saveBest(result)
            setBest(saved.best)
            setScreen((current) => (current.kind === 'play' ? { ...current, result, record: saved.record } : current))
          }}
        />
        {screen.result && (
          <ResultPoster result={screen.result} record={screen.record} onRetry={() => start(screen.mode, screen.run + 1)} onMenu={() => setScreen({ kind: 'home' })} />
        )}
        {dialogs}
      </>
    )
  }

  return (
    <>
      <Home nav={nav} best={best} onStart={start} onGuide={() => setGuideOpen(true)} onSettings={() => setSettingsOpen(true)} />
      {dialogs}
    </>
  )
}
