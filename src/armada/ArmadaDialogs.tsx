import { useEffect, useRef, type ReactNode } from 'react'
import { Confetti } from '../components/Confetti'
import { PRESETS } from './grid'
import { MAX_PLAYERS, MIN_PLAYERS, PLACEMENT_SECONDS, TURN_SECONDS, type ArmadaLobby } from './net'
import { SKILL_CONFIG, SKILL_ORDER, SKILLS } from './skills'
import type { ArmadaView } from './state'

const PIXEL_CONFETTI = ['#c6b98a', '#a63d32', '#8a8b73', '#3f6470', '#e9e2c8', '#55584b']

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
        <p>Tenggelamkan armada lawan dan jaga armadamu. Pemain terakhir yang masih punya kapal menang.</p>
      </Section>
      <Section title="Persiapan">
        <ul>
          <li>
            {MIN_PLAYERS}–{MAX_PLAYERS} pemain, masing-masing punya papan sendiri. Ukuran papan dipilih host:
          </li>
          {Object.values(PRESETS).map((preset) => (
            <li key={preset.id}>
              <strong>{preset.name}</strong>: {preset.ships.map((ship) => `${ship.name} (${ship.size})`).join(', ')}.
            </li>
          ))}
          <li>
            Seret kapal ke papanmu. Ketuk kapal untuk memutar, seret keluar papan untuk melepas. Kapal boleh bersentuhan,
            tapi tidak boleh tumpang tindih.
          </li>
          <li>Tekan SIAP. Dalam {PLACEMENT_SECONDS} detik, armada yang belum siap disusun acak.</li>
        </ul>
      </Section>
      <Section title="Giliran">
        <ul>
          <li>Tiap ronde, urutan pemain yang masih hidup diacak. Tiap pemain mendapat satu giliran.</li>
          <li>
            Targetmu <strong>diundi otomatis</strong> dari lawan yang masih hidup. Lawan yang baru saja kamu tembak
            peluangnya lebih kecil.
          </li>
          <li>Pilih satu sel di papan target dalam {TURN_SECONDS} detik. Kalau waktunya habis, sel acak ditembak untukmu.</li>
          <li>
            Hasilnya (meleset, kena, tenggelam) tercatat di papan target dan terlihat semua pemain. Jadi kamu bisa
            memanfaatkan tembakan pemain lain.
          </li>
          <li>Posisi kapal lawan hanya terlihat setelah kapalnya tenggelam.</li>
          <li>Pemain yang semua kapalnya tenggelam gugur, tapi tetap bisa menonton.</li>
        </ul>
      </Section>
      <Section title="Skill Point (SP)">
        <ul>
          <li>
            Kamu mendapat SP saat papanmu ditembak: +{SKILL_CONFIG.target} tiap ditembak, +{SKILL_CONFIG.hit} lagi kalau
            kena, +{SKILL_CONFIG.sunk} lagi kalau kapalmu tenggelam. Maksimal {SKILL_CONFIG.max} SP.
          </li>
          {SKILL_ORDER.map((id) => (
            <li key={id}>
              <strong>
                {SKILLS[id].name} ({SKILLS[id].cost} SP, {SKILLS[id].when.toLowerCase()})
              </strong>
              : {SKILLS[id].description}
            </li>
          ))}
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
      aria-labelledby="ar-guide-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="tutorial-dialog__scroll">
        <div className="tutorial-dialog__card">
          <header className="tutorial-dialog__header">
            <h2 id="ar-guide-title" className="setup__title">
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
  view: ArmadaView
  lobby: ArmadaLobby
  seat: number
  open: boolean
  onClose: () => void
  onExit: () => void
  onRestart?: () => void
}

export function ArmadaResultDialog({ view, lobby, seat, open, onClose, onExit, onRestart }: ResultDialogProps) {
  const { ref, primaryRef } = useModal(open)
  const winner = view.winner
  // Pemenang dulu, lalu yang paling lama bertahan.
  const ranking = view.players
    .map((player, i) => ({ ...player, seat: i }))
    .sort((a, b) => (b.out ?? Infinity) - (a.out ?? Infinity))
  return (
    <dialog
      ref={ref}
      className="tutorial-dialog result-dialog"
      aria-labelledby="ar-result-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      {open && winner === seat && <Confetti colors={PIXEL_CONFETTI} />}
      <div className="tutorial-dialog__scroll">
        <div className="result-dialog__card">
          <h2 id="ar-result-title" className="result-dialog__title">
            {winner === seat ? 'KAMU MENANG!' : winner !== null ? `${view.players[winner].name} MENANG!` : 'SELESAI'}
          </h2>
          <p className="result-dialog__how">Armada terakhir yang bertahan setelah {view.round} ronde.</p>
          <div className="ar-stats-wrap">
            <table className="ar-stats">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pemain</th>
                  <th title="Tembakan">Tembak</th>
                  <th>Kena</th>
                  <th title="Meleset">Luput</th>
                  <th title="Kapal lawan yang ditenggelamkan">Tenggelamkan</th>
                  <th title="Sel kapal sendiri yang kena">Rusak</th>
                  <th>Skill</th>
                  <th title="Menang selama room dibuka">★</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((player, rank) => (
                  <tr key={player.seat} className={player.seat === seat ? 'ar-stats__me' : ''}>
                    <td>{rank + 1}</td>
                    <td>
                      {player.name}
                      {player.seat === seat && ' (kamu)'}
                    </td>
                    <td>{player.stats.shots}</td>
                    <td>{player.stats.hits}</td>
                    <td>{player.stats.misses}</td>
                    <td>{player.stats.sunk}</td>
                    <td>{player.stats.damage}</td>
                    <td>{player.stats.skills}</td>
                    <td>{lobby.players[player.seat]?.wins ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="result-dialog__how">Tutup jendela ini untuk melihat posisi semua armada di meja.</p>
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
