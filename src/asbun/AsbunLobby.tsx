import { useState } from 'react'
import { Icon } from './Icons'
import { DEFAULT_SETTINGS, TIMER_OPTIONS, type AsbunRoom, type LobbySettings } from './net'
import { MAX_PLAYERS, MIN_PLAYERS, ROLE_PRESETS, roleSplit, type PresetId } from './roles'
import { ANY, DIFFICULTY_NAMES } from './words'

/** Nomor tersangka dua digit, mis. "#03". */
export function suspectNo(seat: number): string {
  return `#${String(seat + 1).padStart(2, '0')}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Alasan host belum bisa memulai, atau null kalau sudah bisa. */
function blocker(room: AsbunRoom): string | null {
  const { players, settings, library } = room.lobby
  const present = players.filter((p) => p.connected)
  if (library === 'loading') return 'Memuat kamus pasangan kata…'
  if (library === 'error') return 'Kamus pasangan kata gagal dimuat. Periksa koneksi lalu buat room lagi.'
  if (present.length < MIN_PLAYERS) return `Butuh minimal ${MIN_PLAYERS} pemain (sekarang ${present.length}).`
  if (!roleSplit(settings.preset, present.length)) return 'Pembagian peran tidak tersedia untuk jumlah pemain ini.'
  const waiting = present.filter((p) => !p.ready).map((p) => p.name)
  if (waiting.length) return `Menunggu siap: ${waiting.join(', ')}.`
  return null
}

function Select<T extends string | number>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  disabled: boolean
  onChange: (value: T) => void
}) {
  return (
    <label className="as-field as-field--compact">
      <span>{label}</span>
      <select
        value={String(value)}
        disabled={disabled}
        onChange={(event) => {
          const picked = options.find((option) => String(option.value) === event.target.value)
          if (picked) onChange(picked.value)
        }}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function SettingsPanel({ room }: { room: AsbunRoom }) {
  const { settings, categories, players } = room.lobby
  const locked = !room.isHost
  const set = (patch: Partial<LobbySettings>) => room.configure(patch)
  const seconds = (values: number[]) => values.map((value) => ({ value, label: `${value} detik` }))
  const split = roleSplit(settings.preset, Math.max(MIN_PLAYERS, players.filter((p) => p.connected).length))
  return (
    <section className="as-card as-settings" aria-labelledby="as-settings-title">
      <h2 id="as-settings-title" className="as-section-title">
        Pengaturan kasus
      </h2>
      {locked && <p className="as-hint">Hanya host yang bisa mengubah pengaturan.</p>}
      <div className="as-settings__grid">
        <Select
          label="Maks. pemain"
          value={settings.capacity}
          disabled={locked}
          options={Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i)
            .filter((n) => n >= players.length)
            .map((n) => ({ value: n, label: `${n} pemain` }))}
          onChange={(capacity) => set({ capacity })}
        />
        <Select
          label="Pembagian peran"
          value={settings.preset}
          disabled={locked}
          options={Object.values(ROLE_PRESETS).map((preset) => ({ value: preset.id as PresetId, label: preset.name }))}
          onChange={(preset) => set({ preset })}
        />
        <Select
          label="Kategori kata"
          value={settings.category}
          disabled={locked}
          options={[{ value: ANY, label: 'Semua kategori' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          onChange={(category) => set({ category })}
        />
        <Select
          label="Tingkat kesulitan"
          value={settings.difficulty}
          disabled={locked}
          options={[{ value: ANY, label: 'Campur' }, ...Object.entries(DIFFICULTY_NAMES).map(([value, label]) => ({ value, label }))]}
          onChange={(difficulty) => set({ difficulty })}
        />
        <Select
          label="Waktu petunjuk"
          value={settings.clueSeconds}
          disabled={locked}
          options={seconds(TIMER_OPTIONS.clueSeconds)}
          onChange={(clueSeconds) => set({ clueSeconds })}
        />
        <Select
          label="Waktu diskusi"
          value={settings.discussionSeconds}
          disabled={locked}
          options={seconds(TIMER_OPTIONS.discussionSeconds)}
          onChange={(discussionSeconds) => set({ discussionSeconds })}
        />
        <Select
          label="Waktu voting"
          value={settings.votingSeconds}
          disabled={locked}
          options={seconds(TIMER_OPTIONS.votingSeconds)}
          onChange={(votingSeconds) => set({ votingSeconds })}
        />
      </div>
      <p className="as-hint">
        {split
          ? `Dengan ${split[0] + split[1] + split[2]} pemain: ${split[0]} Warga, ${split[1]} Penyusup, ${split[2]} Si Asbun.`
          : 'Pembagian peran mengikuti jumlah pemain.'}{' '}
        {ROLE_PRESETS[settings.preset]?.description ?? ROLE_PRESETS[DEFAULT_SETTINGS.preset].description}.
      </p>
    </section>
  )
}

export function AsbunLobby({ room, onExit }: { room: AsbunRoom; onExit: () => void }) {
  const [copied, setCopied] = useState(false)
  const { players, settings } = room.lobby
  const me = players[room.seat]
  const link = `${window.location.origin}${window.location.pathname}?game=asbun&room=${room.code}`
  const reason = blocker(room)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Clipboard bisa ditolak browser; link tetap bisa disalin manual dari kolomnya.
    }
  }

  return (
    <main className="as-page as-page--top">
      <div className="as-lobby">
        <header className="as-card as-lobby__head">
          <div>
            <p className="as-eyebrow">Kasus No. {room.code}</p>
            <h1 className="as-title">Ruang tunggu</h1>
          </div>
          <div className="as-field">
            <span>Bagikan link undangan</span>
            <div className="as-field__row">
              <input type="text" readOnly value={link} aria-label="Link undangan" onFocus={(e) => e.target.select()} />
              <button type="button" className="as-btn as-btn--small" onClick={copy}>
                <Icon name={copied ? 'check' : 'copy'} /> {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
          </div>
        </header>

        <section className="as-card" aria-labelledby="as-suspects-title">
          <h2 id="as-suspects-title" className="as-section-title">
            Daftar tersangka ({players.length}/{settings.capacity})
          </h2>
          <ul className="as-suspects">
            {players.map((player, i) => (
              <li key={i} className={`as-suspect ${i === room.seat ? 'as-suspect--me' : ''} ${player.connected ? '' : 'as-suspect--offline'}`}>
                <span className="as-avatar" aria-hidden="true">
                  {initials(player.name)}
                </span>
                <span className="as-suspect__body">
                  <span className="as-suspect__no">Tersangka {suspectNo(i)}</span>
                  <strong className="as-suspect__name">
                    {player.name}
                    {i === room.seat && ' (kamu)'}
                  </strong>
                  <span className="as-suspect__tags">
                    {i === 0 && (
                      <span className="as-tag as-tag--gold">
                        <Icon name="host" /> Host
                      </span>
                    )}
                    {!player.connected ? (
                      <span className="as-tag as-tag--blood">
                        <Icon name="offline" /> Terputus
                      </span>
                    ) : player.ready ? (
                      <span className="as-tag as-tag--sage">
                        <Icon name="check" /> Siap
                      </span>
                    ) : (
                      <span className="as-tag">Belum siap</span>
                    )}
                    {player.wins > 0 && <span className="as-tag">Menang {player.wins}×</span>}
                  </span>
                </span>
              </li>
            ))}
            {Array.from({ length: Math.max(0, settings.capacity - players.length) }, (_, i) => (
              <li key={`empty-${i}`} className="as-suspect as-suspect--empty">
                <span className="as-avatar" aria-hidden="true">
                  ?
                </span>
                <span className="as-suspect__body">
                  <span className="as-suspect__no">Tersangka {suspectNo(players.length + i)}</span>
                  <span className="as-muted">Menunggu pemain…</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Tamu: tombol siap langsung di bawah daftar tersangka, sebelum pengaturan (yang hanya bisa dilihat). */}
        {!room.isHost && (
          <section className={`as-card as-lobby__actions as-ready ${me?.ready ? 'as-ready--on' : ''}`} aria-label="Status siap">
            <button
              type="button"
              className={`as-btn ${me?.ready ? '' : 'as-btn--primary'}`}
              aria-pressed={me?.ready ?? false}
              onClick={() => room.setReady(!me?.ready)}
            >
              {me?.ready ? (
                <>
                  <Icon name="check" /> Batal siap
                </>
              ) : (
                'Saya siap'
              )}
            </button>
            <p className="as-hint" aria-live="polite">
              {me?.ready ? 'Kamu sudah siap. Menunggu host memulai…' : 'Tekan "Saya siap" supaya host bisa memulai.'}
            </p>
          </section>
        )}

        <SettingsPanel room={room} />

        <footer className="as-card as-lobby__actions">
          {room.isHost && (
            <>
              <button type="button" className="as-btn as-btn--primary" disabled={reason !== null} onClick={room.start}>
                Mulai penyelidikan
              </button>
              <p className="as-hint" aria-live="polite">
                {reason ?? 'Semua siap. Mulai kapan saja.'}
              </p>
            </>
          )}
          <button type="button" className="as-btn as-btn--ghost" onClick={onExit}>
            <Icon name="door" /> Keluar room
          </button>
        </footer>
      </div>
    </main>
  )
}
