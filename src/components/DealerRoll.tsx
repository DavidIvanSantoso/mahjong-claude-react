import { useEffect, useState } from 'react'
import type { GameState } from '../game/state'
import { t } from '../i18n'

/** Lama dadu "berputar" sebelum hasilnya ditampilkan; harus lebih pendek dari ROLL_SECONDS. */
const SPIN_MS = 1400
const SPIN_STEP_MS = 90

/** Sel (0-8, kiri atas ke kanan bawah) yang berisi titik untuk tiap muka dadu. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

function Die({ value }: { value: number }) {
  return (
    <span className="die" role="img" aria-label={t(`Dadu ${value}`, `Die showing ${value}`)}>
      {Array.from({ length: 9 }, (_, cell) => (
        <span key={cell} className={PIPS[value].includes(cell) ? 'die__pip' : ''} />
      ))}
    </span>
  )
}

interface DealerRollProps {
  state: GameState
  /** Mode online: kursi perangkat ini, supaya pemenangnya bisa disebut "Kamu". */
  viewer?: number
}

/**
 * Lemparan dadu penentu bandar di awal permainan, menutupi meja selama fase `roll`.
 * Hasilnya sudah ada di `state.rolls`; di sini dadunya hanya dianimasikan sebentar lalu
 * menampilkan angka itu, jadi semua perangkat melihat hasil yang sama.
 */
export function DealerRoll({ state, viewer }: DealerRollProps) {
  const rolls = state.rolls ?? []
  // Hitungan langkah selama dadu berputar; null setelah berhenti.
  const [spin, setSpin] = useState<number | null>(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSpin(null)
      return
    }
    const tick = setInterval(() => setSpin((n) => (n === null ? null : n + 1)), SPIN_STEP_MS)
    const stop = setTimeout(() => setSpin(null), SPIN_MS)
    return () => {
      clearInterval(tick)
      clearTimeout(stop)
    }
  }, [])

  const hk = state.ruleset === 'hk'
  const winner = state.players[state.dealer]

  return (
    <div className="roll-overlay" role="status">
      <div className="card roll-overlay__card">
        <h2 className="roll-overlay__title">
          {hk ? t('Menentukan bandar', 'Choosing the dealer') : t('Menentukan pemain pertama', 'Choosing who goes first')}
        </h2>
        <ul className="roll-overlay__list">
          {state.players.map((player, i) => {
            const [a, b] = rolls[i] ?? [1, 1]
            const won = spin === null && i === state.dealer
            return (
              <li key={i} className={won ? 'roll-overlay__row roll-overlay__row--won' : 'roll-overlay__row'}>
                <span className="roll-overlay__name">{player.name}</span>
                {/* Selama berputar, mukanya berganti-ganti; angkanya sengaja bukan hasil akhir. */}
                <Die value={spin === null ? a : ((spin * 5 + i * 3) % 6) + 1} />
                <Die value={spin === null ? b : ((spin * 7 + i * 2 + 3) % 6) + 1} />
                <strong className="roll-overlay__total">{spin === null ? a + b : '?'}</strong>
              </li>
            )
          })}
        </ul>
        <p className="roll-overlay__result">
          {spin !== null && t('Melempar dadu…', 'Rolling the dice…')}
          {spin === null &&
            (state.dealer === viewer
              ? t(
                  `Kamu mendapat angka tertinggi dan ${hk ? 'jadi bandar (Timur).' : 'jalan pertama.'}`,
                  `You rolled the highest and ${hk ? 'are the dealer (East).' : 'go first.'}`,
                )
              : t(
                  `${winner.name} mendapat angka tertinggi dan ${hk ? 'jadi bandar (Timur).' : 'jalan pertama.'}`,
                  `${winner.name} rolled the highest and ${hk ? 'is the dealer (East).' : 'goes first.'}`,
                ))}
        </p>
      </div>
    </div>
  )
}
