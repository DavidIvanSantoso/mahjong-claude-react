/**
 * Skill Point (SP) dan daftar skill. Efek tiap skill dijalankan di reducer (state.ts);
 * file ini hanya berisi angka dan teks, supaya skill baru cukup ditambahkan di sini dan di reducer.
 */
export const SKILL_CONFIG = {
  /** SP awal tiap pemain. */
  start: 0,
  /** Didapat pemain yang papannya ditembak (juga kalau tembakannya kena Ranjau). */
  target: 1,
  /** Tambahan kalau tembakan itu kena kapal. */
  hit: 1,
  /** Tambahan kalau kapal itu tenggelam. */
  sunk: 2,
  max: 6,
}

/** Aturan Ranjau. */
export const MINE_CONFIG = {
  /** Ranjau aktif maksimal per pemain. */
  limit: 2,
  /** Serangan acak yang menghantam papan penyerang saat ranjau meledak. */
  blasts: 3,
}

export type SkillId = 'mine' | 'sonar' | 'double'

export interface Skill {
  id: SkillId
  name: string
  cost: number
  /** Kapan bisa dipakai, untuk teks tombol dan panduan. */
  when: string
  description: string
}

export const SKILLS: Record<SkillId, Skill> = {
  mine: {
    id: 'mine',
    name: 'Ranjau',
    cost: 2,
    when: 'Kapan saja',
    description:
      'Pasang ranjau di sel kosong papanmu (bukan sel kapal), maksimal 2 ranjau aktif. Hanya kamu yang tahu letaknya. Lawan yang menembak ranjau itu terkena 3 serangan acak di papannya sendiri dan gilirannya berakhir.',
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

export const SKILL_ORDER: SkillId[] = ['mine', 'sonar', 'double']

export function isSkillId(value: unknown): value is SkillId {
  return typeof value === 'string' && value in SKILLS
}
