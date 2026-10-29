import { useEffect, useState } from 'react'
import { Board } from './Board'
import { PRESETS } from './grid'
import { PixelFlag, SkillIcon } from './Pixel'
import { sfx } from './sfx'
import { SKILL_CONFIG, SKILL_ORDER, SKILLS, type SkillId } from './skills'
import { aliveSeats, type ArmadaView, type PlayerAction, type PlayerView } from './state'

/** Lama animasi undian target (sedikit lebih pendek dari TARGET_MS di host). */
const ROLL_MS = 1400

export function SpPips({ sp }: { sp: number }) {
  return (
    <span className="ar-sp" aria-label={`${sp} SP`}>
      {Array.from({ length: SKILL_CONFIG.max }, (_, i) => (
        <span key={i} className={i < sp ? 'ar-sp__pip ar-sp__pip--on' : 'ar-sp__pip'} />
      ))}
    </span>
  )
}

/** Kapal di papan pemain yang boleh ditampilkan: armada sendiri (atau semua saat selesai), selain itu hanya yang tenggelam. */
export function visibleShips(player: PlayerView) {
  return (player.fleet ?? player.sunk).map((ship) => ({ ...ship }))
}

/** "Penyerang ➜ Target"; nama target berputar seperti undian sebelum berhenti di yang terpilih. */
export function TargetRoller({ view, me }: { view: ArmadaView; me: number }) {
  const { attacker, target, phase } = view
  const [shown, setShown] = useState<number | null>(target)
  const [spinning, setSpinning] = useState(false)
  const key = `${view.round}-${view.turn}`

  useEffect(() => {
    const options = aliveSeats(view).filter((seat) => seat !== attacker)
    if (phase !== 'target' || options.length < 2) {
      setShown(target)
      return
    }
    setSpinning(true)
    const started = Date.now()
    let i = 0
    const id = setInterval(() => {
      if (Date.now() - started >= ROLL_MS) {
        clearInterval(id)
        setShown(target)
        setSpinning(false)
        return
      }
      setShown(options[i++ % options.length])
      sfx.roll()
    }, 90)
    return () => clearInterval(id)
    // Hanya diulang saat giliran baru dimulai.
  }, [key])

  if (attacker === null || target === null) return null
  const name = (seat: number | null) => (seat === null ? '…' : seat === me ? 'KAMU' : view.players[seat].name)
  return (
    <div className={`ar-versus ${spinning ? 'ar-versus--rolling' : ''}`}>
      <span className="ar-versus__side">
        <PixelFlag seat={attacker} />
        {name(attacker)}
      </span>
      <span className="ar-versus__arrow" aria-label="menyerang">
        ➜
      </span>
      <span className={`ar-versus__side ar-versus__target ${!spinning && target === me ? 'ar-versus__target--me' : ''}`}>
        {shown !== null && <PixelFlag seat={shown} />}
        {name(spinning ? shown : target)}
      </span>
    </div>
  )
}

interface PlayerCardProps {
  view: ArmadaView
  seat: number
  me: number
  offline: boolean
  wins: number
  focused: boolean
  onSelect: () => void
}

export function PlayerCard({ view, seat, me, offline, wins, focused, onSelect }: PlayerCardProps) {
  const player = view.players[seat]
  const { size, ships } = PRESETS[view.preset]
  const role = view.phase !== 'over' && (view.attacker === seat ? 'attacker' : view.target === seat ? 'target' : null)
  return (
    <li>
      <button
        type="button"
        className={['ar-card', role && `ar-card--${role}`, !player.alive && 'ar-card--out', focused && 'ar-card--focus', seat === me && 'ar-card--me']
          .filter(Boolean)
          .join(' ')}
        onClick={onSelect}
        aria-pressed={focused}
        title={`Lihat papan ${player.name}`}
      >
        <span className="ar-card__head">
          <PixelFlag seat={seat} out={!player.alive} />
          <span className="ar-card__name">
            {player.name}
            {seat === me && ' (kamu)'}
          </span>
          {wins > 0 && <span className="ar-card__wins">★{wins}</span>}
        </span>
        <Board variant="mini" size={size} label={`Papan ${player.name}`} shots={player.shots} ships={visibleShips(player)} />
        <span className="ar-card__stats">
          {player.alive ? (
            <span>
              ⚓ {player.afloat}/{ships.length}
            </span>
          ) : (
            <span className="ar-card__dead">☠ GUGUR</span>
          )}
          {player.shield && <SkillIcon skill="shield" className="ar-card__shield" />}
        </span>
        {player.alive && <SpPips sp={player.sp} />}
        {role && <span className={`ar-card__role ar-card__role--${role}`}>{role === 'attacker' ? 'MENYERANG' : 'TARGET'}</span>}
        {offline && <span className="ar-card__offline">terputus</span>}
      </button>
    </li>
  )
}

interface SkillPanelProps {
  view: ArmadaView
  me: number
  sonarMode: boolean
  onSonarMode: (on: boolean) => void
  send: (action: PlayerAction) => void
}

export function SkillPanel({ view, me, sonarMode, onSonarMode, send }: SkillPanelProps) {
  const player = view.players[me]
  const myAim = view.phase === 'aim' && view.attacker === me
  const active = ['start', 'target', 'aim', 'result'].includes(view.phase)

  function usable(skill: SkillId): boolean {
    if (!player.alive || player.sp < SKILLS[skill].cost) return false
    if (skill === 'shield') return active && !player.shield
    if (skill === 'sonar') return myAim && !view.sonarUsed
    return myAim && view.fired === 0 && !view.doubleUsed
  }

  function use(skill: SkillId) {
    if (skill === 'sonar') {
      onSonarMode(!sonarMode)
      return
    }
    sfx.skill()
    send({ type: 'skill', skill })
  }

  return (
    <section className="ar-panel ar-skills">
      <div className="ar-skills__head">
        <h2 className="ar-panel__title">Skill</h2>
        <SpPips sp={player.sp} />
        <span className="ar-skills__sp">{player.sp} SP</span>
      </div>
      <div className="ar-skills__list">
        {SKILL_ORDER.map((id) => {
          const skill = SKILLS[id]
          const on = (id === 'sonar' && sonarMode) || (id === 'shield' && player.shield) || (id === 'double' && view.doubleUsed && myAim)
          return (
            <button
              key={id}
              type="button"
              className={`ar-skill ${on ? 'ar-skill--on' : ''}`}
              disabled={!usable(id) && !(id === 'sonar' && sonarMode)}
              onClick={() => use(id)}
              title={`${skill.description} (${skill.when})`}
            >
              <SkillIcon skill={id} />
              <span className="ar-skill__name">{skill.name}</span>
              <span className="ar-skill__cost">{skill.cost} SP</span>
              <span className="ar-skill__when">{id === 'sonar' && sonarMode ? 'Pilih pusat area' : skill.when}</span>
            </button>
          )
        })}
      </div>
      <p className="ar-panel__empty">
        Dapat SP saat papanmu ditembak: +{SKILL_CONFIG.target}, kena +{SKILL_CONFIG.hit}, kapal tenggelam +{SKILL_CONFIG.sunk} (maks. {SKILL_CONFIG.max}).
      </p>
    </section>
  )
}
