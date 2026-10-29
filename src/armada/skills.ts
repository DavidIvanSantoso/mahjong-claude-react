/**
 * Skill Point (SP) dan daftar skill. Efek tiap skill dijalankan di reducer (state.ts);
 * file ini hanya berisi angka dan teks, supaya skill baru cukup ditambahkan di sini dan di reducer.
 */
export const SKILL_CONFIG = {
  /** SP awal tiap pemain. */
  start: 0,
  /** Didapat pemain yang papannya ditembak (juga kalau ditahan Shield). */
  target: 1,
  /** Tambahan kalau tembakan itu kena kapal. */
  hit: 1,
  /** Tambahan kalau kapal itu tenggelam. */
  sunk: 2,
  max: 6,
}

export type SkillId = 'shield' | 'sonar' | 'double'

export interface Skill {
  id: SkillId
  name: string
  cost: number
  /** Kapan bisa dipakai, untuk teks tombol dan panduan. */
  when: string
  description: string
}

export const SKILLS: Record<SkillId, Skill> = {
  shield: {
    id: 'shield',
    name: 'Perisai',
    cost: 2,
    when: 'Kapan saja',
    description: 'Menahan satu tembakan berikutnya ke papanmu. Sel itu tidak tercatat. Semua pemain melihat perisaimu.',
  },
  sonar: {
    id: 'sonar',
    name: 'Sonar',
    cost: 2,
    when: 'Giliranmu, 1× per giliran',
    description: 'Pindai area 3×3 di papan target: kamu (hanya kamu) tahu berapa sel kapal yang belum kena di area itu.',
  },
  double: {
    id: 'double',
    name: 'Tembakan Ganda',
    cost: 3,
    when: 'Giliranmu, sebelum menembak',
    description: 'Tembak dua sel berbeda di target yang sama dalam satu giliran.',
  },
}

export const SKILL_ORDER: SkillId[] = ['shield', 'sonar', 'double']

export function isSkillId(value: unknown): value is SkillId {
  return typeof value === 'string' && value in SKILLS
}
