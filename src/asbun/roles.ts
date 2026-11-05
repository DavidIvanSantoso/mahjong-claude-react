/**
 * Peran ASBUN dan pembagiannya per jumlah pemain. Murni (tanpa React/jaringan).
 *
 * - Warga: tahu kata Warga.
 * - Penyusup: tahu kata yang mirip tapi berbeda.
 * - Si Asbun: tidak tahu kata apa pun dan harus "asal bunyi" dengan meyakinkan.
 */
export type Role = 'warga' | 'penyusup' | 'asbun'

export const ROLE_NAMES: Record<Role, string> = {
  warga: 'Warga',
  penyusup: 'Penyusup',
  asbun: 'Si Asbun',
}

export const MIN_PLAYERS = 4
export const MAX_PLAYERS = 10

/** [Warga, Penyusup, Si Asbun] untuk tiap jumlah pemain. */
type Split = [number, number, number]

export type PresetId = 'standar' | 'ramai'

export interface RolePreset {
  id: PresetId
  name: string
  description: string
  splits: Record<number, Split>
}

export const ROLE_PRESETS: Record<PresetId, RolePreset> = {
  standar: {
    id: 'standar',
    name: 'Standar',
    description: '1–2 Penyusup, 1–2 Si Asbun',
    splits: {
      4: [2, 1, 1],
      5: [3, 1, 1],
      6: [4, 1, 1],
      7: [4, 2, 1],
      8: [5, 2, 1],
      9: [6, 2, 1],
      10: [6, 2, 2],
    },
  },
  ramai: {
    id: 'ramai',
    name: 'Banyak Penyusup',
    description: 'Penyusup lebih banyak, Warga harus lebih jeli',
    splits: {
      4: [2, 1, 1],
      5: [2, 2, 1],
      6: [3, 2, 1],
      7: [3, 3, 1],
      8: [4, 3, 1],
      9: [5, 3, 1],
      10: [5, 3, 2],
    },
  },
}

export function isPresetId(value: unknown): value is PresetId {
  return typeof value === 'string' && value in ROLE_PRESETS
}

/**
 * Pembagian peran untuk `players` pemain, atau null kalau tidak sah: tiap peran minimal satu,
 * jumlahnya sama dengan jumlah pemain, dan Penyusup tidak langsung menang (harus kalah jumlah).
 */
export function roleSplit(preset: PresetId, players: number): Split | null {
  const split = ROLE_PRESETS[preset]?.splits[players]
  if (!split) return null
  const [warga, penyusup, asbun] = split
  if (warga < 1 || penyusup < 1 || asbun < 1) return null
  if (warga + penyusup + asbun !== players) return null
  if (penyusup >= warga + asbun) return null
  return split
}

/** Peran acak per kursi; tidak bergantung pada nama pemain. */
export function assignRoles(preset: PresetId, players: number, rand: () => number = Math.random): Role[] | null {
  const split = roleSplit(preset, players)
  if (!split) return null
  const roles: Role[] = [
    ...Array<Role>(split[0]).fill('warga'),
    ...Array<Role>(split[1]).fill('penyusup'),
    ...Array<Role>(split[2]).fill('asbun'),
  ]
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[roles[i], roles[j]] = [roles[j], roles[i]]
  }
  return roles
}
