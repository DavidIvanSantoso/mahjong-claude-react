import { useEffect, useRef, useState, type ReactNode } from 'react'
import koboiFavicon from '../assets/koboi-favicon.svg'
import { CreatorCredit } from '../components/HomeScreen'
import { MusicSlot } from '../components/MusicPlayer'
import { BOSSES, DASH, DIFFICULTY, ENDLESS_BOSS, FIGHT, PLAYER } from './config'
import type { Summary } from './engine'
import { KoboiGame } from './KoboiGame'
import { updateSettings, useSettings } from './settings'
import { playEvents, unlockAudio } from './sfx'
import type { BossId, Difficulty, Mode } from './state'

const BEST_KEY = 'koboi-best'
const BOSS_IDS: BossId[] = ['elang', 'dinamit', 'masinis']
const DIFFICULTY_IDS: Difficulty[] = ['koboi', 'sheriff', 'legenda']

interface BossRecord {
  wins: number
  /** Waktu tercepat menang (detik), 0 = belum pernah menang. */
  time: number
  score: number
  /** Tingkat kesulitan tertinggi yang pernah dimenangkan. */
  hardest: Difficulty | null
}

interface Best {
  endless?: { score: number; wave: number; time: number; bosses: number }
  bosses?: Partial<Record<BossId, BossRecord>>
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
      bosses: Math.max(old?.bosses ?? 0, result.bossesDefeated),
    }
  } else if (result.bossId) {
    const bosses = (best.bosses ??= {})
    const old = bosses[result.bossId]
    record = result.won && (!old || result.score > old.score)
    const hardest = result.won && (!old?.hardest || DIFFICULTY_IDS.indexOf(result.difficulty) > DIFFICULTY_IDS.indexOf(old.hardest)) ? result.difficulty : (old?.hardest ?? null)
    bosses[result.bossId] = {
      wins: (old?.wins ?? 0) + (result.won ? 1 : 0),
      time: result.won && (!old?.time || result.time < old.time) ? result.time : (old?.time ?? 0),
      score: Math.max(old?.score ?? 0, result.won ? result.score : 0),
      hardest,
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
            <kbd>S</kbd> <kbd>D</kbd> atau tombol panah. Yang bisa terkena hanya <strong>bintang emas di pelana</strong>.
          </li>
          <li>
            Nyawa tergantung tingkat: <strong>Koboi</strong> {DIFFICULTY.koboi.hp}, <strong>Sheriff</strong> {DIFFICULTY.sheriff.hp},{' '}
            <strong>Legenda</strong> {DIFFICULTY.legenda.hp} (tanpa dash). Tiap kena −1 nyawa, lalu kebal {PLAYER.invuln} detik.
          </li>
          <li>
            <kbd>Spasi</kbd>/<kbd>Shift</kbd> = <strong>dash</strong>: melesat pendek, kebal {DASH.duration} detik, jeda {DASH.cooldown} detik.
          </li>
          <li>
            Semua serangan punya <strong>tanda</strong> lebih dulu: garis merah bergaris = jalur bahaya, garis hijau putus-putus = celah aman, lingkaran
            merah = ledakan, bidikan yang memerah = tembakan ke titik itu, garis biru = lintasan peluru pantul.
          </li>
          <li>
            <strong>Melawan bos</strong>: ambil <strong>peluru emas</strong> (+2 peluru, maks. {FIGHT.ammoMax}) yang muncul di arena, sering di dekat
            bahaya. Tekan <kbd>F</kbd>/<kbd>J</kbd> atau klik untuk menembak bos. Bos bisa <strong>berguling menghindar</strong>, kecuali saat
            ia <strong>mengisi ulang</strong> setelah tiap serangan: itu waktu terbaik menembak.
          </li>
          <li>
            Peluru yang lewat sangat dekat tanpa mengenai (<em>serempetan</em>) mengisi meter <strong>Mata Elang</strong>. Kalau penuh, tekan{' '}
            <kbd>E</kbd>: dunia melambat {FIGHT.deadeyeTime} detik dan tembakanmu pasti kena.
          </li>
          <li>
            Tiap {FIGHT.duelEvery} serangan ada <strong>duel cepat</strong>: tekan <kbd>Spasi</kbd>/<kbd>F</kbd>/klik saat muncul <em>TEMBAK!</em>. Awas{' '}
            <strong>kata pengecoh</strong> (TEMBOK, TAMBAK…): menekan saat itu = tertipu, −1 nyawa.
          </li>
          <li>
            Bos punya <strong>3 babak</strong>. Saat nyalinya habis ia melepas <strong>tembakan terakhir</strong> (ikuti lorong hijau), lalu{' '}
            <strong>duel penentuan</strong>: menang duel itu = bos tertangkap.
          </li>
          <li>
            <strong>Bertahan</strong>: gelombang tanpa akhir; tiap {ENDLESS_BOSS.every} gelombang muncul <strong>bos mini</strong> bergiliran (tanpa duel
            penentuan). Kalahkan untuk bonus besar dan +{ENDLESS_BOSS.heal} nyawa.
          </li>
          <li>
            <kbd>Esc</kbd> menjeda. Pindah tab juga otomatis menjeda.
          </li>
        </ol>
        <h3 className="kb-guide__heading">Para buronan</h3>
        <ul className="kb-guide__bosses">
          {BOSS_IDS.map((id) => (
            <li key={id}>
              <strong>{BOSSES[id].name}</strong>
              <span>{BOSSES[id].hint}</span>
              <small>Babak: {BOSSES[id].acts.map((act) => act.name).join(' → ')}</small>
            </li>
          ))}
        </ul>
        <h3 className="kb-guide__heading">Serangan</h3>
        <ul className="kb-guide__patterns">
          <li>
            <strong>Kipas Revolver</strong> tembakan menyebar; cari celahnya.
          </li>
          <li>
            <strong>Peluru Pantul</strong> memantul di dinding; lintasannya terlihat dulu.
          </li>
          <li>
            <strong>Dinamit</strong> menjauh dari lingkaran sebelum cincinnya habis.
          </li>
          <li>
            <strong>Semak Gulung</strong> bergulir dan melompat dari kiri/kanan.
          </li>
          <li>
            <strong>Duri Kaktus</strong> melesat dari satu sisi; berdiri di jalur hijau.
          </li>
          <li>
            <strong>Sabetan Laso</strong> jauhi poros sapuan, atau lewati simpul tali.
          </li>
          <li>
            <strong>Tanda Buronan</strong> bidikan mengikuti (atau mendahului) gerakmu, lalu terkunci.
          </li>
          <li>
            <strong>Badai Debu</strong> dinding debu bergerak dengan satu celah.
          </li>
          <li>
            <strong>Kereta Hantu</strong> rel berkedip merah lalu kereta melintas.
          </li>
          <li>
            <strong>Banteng Seruduk</strong> membidik posisimu, lalu lari lurus.
          </li>
          <li>
            <strong>Putaran Peluru</strong> silinder menembakkan spiral; ikuti putarannya.
          </li>
          <li>
            <strong>Tong Mesiu</strong> pecah jadi cincin duri dengan dua celah.
          </li>
          <li>
            <strong>Lampu Gantung</strong> (saloon) bayangannya membesar sebelum jatuh.
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
        <Toggle label="Dash" hint="Berlaku mulai permainan berikutnya (Legenda selalu tanpa dash)." checked={settings.dash} onChange={(dash) => updateSettings({ dash })} />
        <Toggle label="Mode debug" hint="Tampilkan kotak tabrakan, jumlah peluru, dan seed." checked={settings.debug} onChange={(debug) => updateSettings({ debug })} />
        <p className="kb-muted kb-settings__keys">
          Kontrol: <kbd>WASD</kbd>/<kbd>←↑→↓</kbd> gerak · <kbd>Spasi</kbd>/<kbd>Shift</kbd> dash · <kbd>F</kbd>/klik tembak · <kbd>E</kbd> Mata Elang ·{' '}
          <kbd>Esc</kbd> jeda
        </p>
        <button type="button" className="kb-btn kb-btn--primary" onClick={onClose}>
          Simpan
        </button>
      </div>
    </dialog>
  )
}

// ---------- Beranda ----------

function DifficultyPicker() {
  const { difficulty } = useSettings()
  return (
    <div className="kb-difficulty" role="radiogroup" aria-label="Tingkat kesulitan">
      {DIFFICULTY_IDS.map((id) => (
        <button key={id} type="button" role="radio" aria-checked={difficulty === id} className={difficulty === id ? 'is-active' : ''} onClick={() => updateSettings({ difficulty: id })}>
          <strong>{DIFFICULTY[id].label}</strong>
          <small>{DIFFICULTY[id].hint}</small>
        </button>
      ))}
    </div>
  )
}

function BossPicker({ best, onPick, onBack }: { best: Best; onPick: (id: BossId) => void; onBack: () => void }) {
  return (
    <div className="kb-bosses">
      <p className="kb-poster__wanted">Pilih buronan</p>
      <ul className="kb-bosses__list">
        {BOSS_IDS.map((id, i) => {
          const record = best.bosses?.[id]
          return (
            <li key={id}>
              <button type="button" className={`kb-boss-card kb-boss-card--${id}`} onClick={() => onPick(id)} autoFocus={i === 0}>
                <span className="kb-boss-card__name">{BOSSES[id].name}</span>
                <span className="kb-boss-card__title">{BOSSES[id].title}</span>
                <span className="kb-boss-card__hint">{BOSSES[id].hint}</span>
                <span className="kb-boss-card__acts" aria-label="Babak">
                  {BOSSES[id].acts.map((act) => (
                    <span key={act.name} className={`kb-scene kb-scene--${act.scene}`}>
                      {act.name}
                    </span>
                  ))}
                </span>
                <span className="kb-boss-card__record">
                  {record?.wins ? `Tertangkap ${record.wins}× · tercepat ${formatTime(record.time)}${record.hardest ? ` · ${DIFFICULTY[record.hardest].label}` : ''}` : `Hadiah: ${(BOSSES[id].hp * 100).toLocaleString('id-ID')} keping`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className="kb-link" onClick={onBack}>
        ← Kembali
      </button>
    </div>
  )
}

function Home({ nav, best, onStart, onGuide, onSettings }: { nav: ReactNode; best: Best; onStart: (mode: Mode, bossId?: BossId) => void; onGuide: () => void; onSettings: () => void }) {
  const [picking, setPicking] = useState(false)
  const caught = BOSS_IDS.filter((id) => best.bosses?.[id]?.wins).length
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
        {picking ? (
          <BossPicker best={best} onPick={(id) => onStart('boss', id)} onBack={() => setPicking(false)} />
        ) : (
          <>
            <p className="kb-poster__wanted">Dicari: yang masih hidup</p>
            <h1 id="kb-title" className="kb-logo">
              KOBOI
            </h1>
            <p className="kb-tagline">Hindari peluru. Balas tembak. Tangkap buronannya.</p>
            <p className="kb-home__lead">
              Pacu kudamu di dalam arena tali, hindari revolver, dinamit, laso, dan kereta hantu, lalu kumpulkan peluru emas untuk menembak balik
              para buronan.
            </p>
            <DifficultyPicker />
            <div className="kb-actions">
              <button type="button" className="kb-btn kb-btn--primary kb-btn--big" onClick={() => onStart('endless')}>
                Bertahan
              </button>
              <button type="button" className="kb-btn kb-btn--big" onClick={() => setPicking(true)}>
                Duel Bos
              </button>
            </div>
            <dl className="kb-best" aria-label="Rekor">
              <div>
                <dt>Rekor bertahan</dt>
                <dd>{best.endless ? `${best.endless.score.toLocaleString('id-ID')} · gel. ${best.endless.wave}` : '—'}</dd>
              </div>
              <div>
                <dt>Buronan tertangkap</dt>
                <dd>
                  {caught}/{BOSS_IDS.length}
                </dd>
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
            <p className="kb-muted kb-home__hint">Butuh keyboard: WASD gerak · Spasi dash · F tembak · E Mata Elang.</p>
          </>
        )}
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
  const bossName = result.bossId ? BOSSES[result.bossId].name : ''
  return (
    <div className="kb-overlay kb-overlay--result">
      <div className="kb-wanted" role="dialog" aria-modal="true" aria-labelledby="kb-result-title">
        <p className="kb-wanted__head">{won ? 'Buronan tertangkap' : result.mode === 'boss' ? `Kalah dari ${bossName}` : 'Dicari'}</p>
        <h2 id="kb-result-title" className="kb-wanted__title">
          {won ? 'SHERIFF BARU!' : result.mode === 'boss' ? 'TUMBANG' : 'MASIH HIDUP?'}
        </h2>
        {won && <p className="kb-wanted__sub">{bossName} diringkus</p>}
        {record && <p className="kb-wanted__record">★ Rekor baru ★</p>}
        <p className="kb-wanted__reward">
          <span>Hadiah · {DIFFICULTY[result.difficulty].label}</span>
          {result.score.toLocaleString('id-ID')}
        </p>
        <dl className="kb-wanted__stats">
          <div>
            <dt>Bertahan</dt>
            <dd>{formatTime(result.time)}</dd>
          </div>
          {result.mode === 'endless' ? (
            <>
              <div>
                <dt>Gelombang</dt>
                <dd>{result.wave}</dd>
              </div>
              <div>
                <dt>Bos dikalahkan</dt>
                <dd>{result.bossesDefeated}</dd>
              </div>
            </>
          ) : (
            <div>
              <dt>Nyali bos</dt>
              <dd>{won ? 'habis' : `${result.bossHp}/${result.bossMaxHp}`}</dd>
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

type Screen = { kind: 'home' } | { kind: 'play'; mode: Mode; bossId?: BossId; run: number; result: Summary | null; record: boolean }

export function KoboiApp({ nav }: { nav: ReactNode }) {
  useKoboiTheme()
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const [best, setBest] = useState(loadBest)
  const [guideOpen, setGuideOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  function start(mode: Mode, bossId?: BossId, run = 0) {
    unlockAudio()
    setScreen({ kind: 'play', mode, bossId, run, result: null, record: false })
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
          bossId={screen.bossId}
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
          <ResultPoster
            result={screen.result}
            record={screen.record}
            onRetry={() => start(screen.mode, screen.bossId, screen.run + 1)}
            onMenu={() => setScreen({ kind: 'home' })}
          />
        )}
        {dialogs}
      </>
    )
  }

  return (
    <>
      <Home nav={nav} best={best} onStart={(mode, bossId) => start(mode, bossId)} onGuide={() => setGuideOpen(true)} onSettings={() => setSettingsOpen(true)} />
      {dialogs}
    </>
  )
}
