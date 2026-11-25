/**
 * Semua angka keseimbangan KOBOI di satu tempat: dunia, arena, pemain, dash, skor, gelombang, dan bos.
 * Satuan jarak = satuan dunia (kanvas digambar 800 × 540 lalu diperbesar/diperkecil agar pas di layar).
 */

export const WORLD = { width: 800, height: 540 }

/** Kotak arena (tempat jiwa bergerak). Bos/penembak berada di luar kotak ini. */
export const ARENA = { x: 180, y: 200, w: 440, h: 290 }

export const PLAYER = {
  hp: 5,
  /** Kecepatan gerak (satuan/detik). Diagonal dinormalisasi. */
  speed: 205,
  /**
   * Jari-jari tabrakan. Gambarnya koboi berkuda (±34 × 30), tapi yang bisa terkena hanya inti kecil di
   * pelana, ditandai bintang bercahaya, supaya menghindar tetap presisi seperti mengendalikan satu titik.
   */
  radius: 6,
  /** Kebal setelah terkena (detik), ditandai dengan berkedip. */
  invuln: 0.9,
}

export const DASH = {
  /** Kecepatan selama dash, kelipatan kecepatan biasa. */
  boost: 3.4,
  duration: 0.13,
  cooldown: 1.15,
  /**
   * Keputusan: dash memberi kebal SANGAT singkat (hanya selama dash berlangsung, 0,13 detik), cukup untuk
   * menembus satu peluru tipis tapi tidak untuk melewati ledakan dinamit atau dinding debu.
   */
  invulnerable: true,
}

export const SCORE = {
  /** Poin per detik bertahan. */
  perSecond: 10,
  /** Bonus lolos gelombang = perWave × nomor gelombang. */
  perWave: 60,
  /** Bonus gelombang tanpa terkena = perfect × nomor gelombang. */
  perfect: 90,
  /** Bonus mengalahkan bos. */
  boss: 5000,
  /** Bonus per detik di bawah 3 menit saat mengalahkan bos. */
  bossTime: 20,
}

/** Jeda antar serangan di satu gelombang, dan antar gelombang (detik). */
export const TIMING = {
  betweenPatterns: 0.7,
  betweenWaves: 2.2,
  countdown: 2.4,
}

/** Gelombang istirahat: tiap sekian gelombang, tanpa serangan sebentar dan +1 HP. */
export const RECOVERY = { every: 5, duration: 3.5, heal: 1 }

export type PatternId = 'fan' | 'ricochet' | 'dynamite' | 'tumbleweed' | 'cactus' | 'lasso' | 'mark' | 'dust' | 'train' | 'bull' | 'spiral' | 'barrel'

export const PATTERN_NAMES: Record<PatternId, string> = {
  fan: 'Kipas Revolver',
  ricochet: 'Peluru Pantul',
  dynamite: 'Dinamit',
  tumbleweed: 'Semak Gulung',
  cactus: 'Duri Kaktus',
  lasso: 'Sabetan Laso',
  mark: 'Tanda Buronan',
  dust: 'Badai Debu',
  train: 'Kereta Hantu',
  bull: 'Banteng Seruduk',
  spiral: 'Putaran Peluru',
  barrel: 'Tong Mesiu',
}

/** Urutan pola diperkenalkan di mode Bertahan: satu pola baru per gelombang di awal. */
export const INTRO_ORDER: PatternId[] = ['fan', 'tumbleweed', 'dynamite', 'mark', 'ricochet', 'bull', 'cactus', 'barrel', 'dust', 'train', 'lasso', 'spiral']

/**
 * Pasangan yang tidak boleh berjalan bersamaan (keduanya menutup sebagian besar arena, atau tandanya
 * saling menutupi sehingga sulit dibaca).
 */
export const INCOMPATIBLE: [PatternId, PatternId][] = [
  ['dust', 'cactus'],
  ['dust', 'lasso'],
  ['cactus', 'lasso'],
  ['dynamite', 'mark'],
  ['dust', 'tumbleweed'],
  ['train', 'dust'],
  ['train', 'cactus'],
  ['train', 'lasso'],
  ['spiral', 'dust'],
  ['spiral', 'cactus'],
  ['barrel', 'dynamite'],
  ['bull', 'mark'],
]

/**
 * Tingkat kesulitan per gelombang (0 = paling mudah). Naik pelan, dan tidak semua variabel ikut naik
 * bersamaan: pola sendiri yang memilih apa yang dipengaruhi (kecepatan, jumlah, jarak antar tembakan,
 * lama tanda peringatan, lebar celah aman).
 */
export function levelFor(wave: number): number {
  return Math.min(1.6, (wave - 1) * 0.075)
}

/** Berapa pola dalam satu gelombang dan berapa yang boleh berjalan bersamaan. */
export function waveShape(wave: number): { patterns: number; together: number } {
  if (wave <= INTRO_ORDER.length) return { patterns: 2, together: 1 }
  if (wave <= 14) return { patterns: 3, together: wave % 2 === 0 ? 2 : 1 }
  return { patterns: 4, together: 2 }
}

// ---------- Bos: Si Mata Elang ----------

export const BOSS = {
  name: 'Si Mata Elang',
  /** Nyali bos; berkurang tiap serangannya berhasil dihindari dan tiap duel cepat dimenangkan. */
  hp: 34,
  /** Nyali berkurang per serangan yang selamat dilewati (tanpa terkena: +1). */
  survive: 1,
  perfectBonus: 1,
  /** Duel cepat tiap sekian serangan. */
  duelEvery: 2,
  /** Duel: jeda acak sebelum aba-aba "TEMBAK!" (detik). */
  duelWait: [1.2, 2.6] as [number, number],
  /** Waktu reaksi maksimum; di bawah `fast` bonus kerusakan. */
  duelWindow: 0.75,
  duelFast: 0.32,
  duelDamage: 2,
  duelFastDamage: 3,
  /** Menekan sebelum aba-aba = terlalu cepat: kehilangan 1 HP. */
  earlyPenalty: 1,
  /** Batas nyali tiap fase (pecahan dari HP awal). */
  phases: [0.66, 0.33],
  /** Pola tiap fase dan tingkat kesulitannya. */
  phasePatterns: [
    { patterns: ['fan', 'mark'] as PatternId[], level: 0.45, together: 1 },
    { patterns: ['ricochet', 'lasso', 'fan', 'mark', 'spiral', 'bull'] as PatternId[], level: 0.8, together: 1 },
    { patterns: ['fan', 'mark', 'ricochet', 'lasso', 'dynamite', 'spiral', 'barrel', 'train'] as PatternId[], level: 1.15, together: 2 },
  ],
}
