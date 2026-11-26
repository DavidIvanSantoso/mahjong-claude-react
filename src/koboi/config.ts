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
  /** Bonus mengalahkan bos (mode Duel Bos). */
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


export type PatternId = 'fan' | 'ricochet' | 'dynamite' | 'tumbleweed' | 'cactus' | 'lasso' | 'mark' | 'dust' | 'train' | 'bull' | 'spiral' | 'barrel' | 'lamp' | 'curtain'

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
  lamp: 'Lampu Gantung',
  curtain: 'Tembakan Terakhir',
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

// ---------- Tingkat kesulitan ----------

export type DifficultyId = 'koboi' | 'sheriff' | 'legenda'

export const DIFFICULTY: Record<DifficultyId, { label: string; hint: string; hp: number; dash: boolean; level: number; bossHp: number; rollChance: number; reload: number; actHeal: number }> = {
  koboi: { label: 'Koboi', hint: '5 nyawa, dash', hp: 5, dash: true, level: -0.1, bossHp: 1, rollChance: 1, reload: 1.9, actHeal: 1 },
  sheriff: { label: 'Sheriff', hint: '3 nyawa, bos lebih cepat', hp: 3, dash: true, level: 0.25, bossHp: 1.15, rollChance: 1.25, reload: 1.5, actHeal: 1 },
  legenda: { label: 'Legenda', hint: '1 nyawa, tanpa dash', hp: 1, dash: false, level: 0.4, bossHp: 1.25, rollChance: 1.4, reload: 1.25, actHeal: 0 },
}

// ---------- Aturan bersama semua bos ----------

export const FIGHT = {
  /** Revolver pemain: 6 peluru, diisi dengan mengambil peluru emas di arena. */
  ammoMax: 6,
  fireCooldown: 0.16,
  shotSpeed: 640,
  shotDamage: 1,
  /** Peluru emas muncul tiap sekian detik selama bos menyerang, sering di dekat bahaya. */
  pickupEvery: 1.5,
  pickupLife: 6,
  pickupRadius: 15,
  /** Peluang peluru emas diletakkan di dekat bahaya (sisanya acak). */
  pickupDanger: 0.65,
  /** Jari-jari tubuh bos untuk tembakan pemain. */
  bossRadius: 24,
  /** Bos berguling menghindar (kebal) sebentar, lalu jeda sebelum bisa berguling lagi. */
  rollTime: 0.34,
  rollCooldown: 1.5,
  /** Duel cepat tiap sekian serangan. */
  duelEvery: 3,
  duelWait: [1.4, 2.8] as [number, number],
  duelWindow: 0.75,
  duelFast: 0.32,
  duelDamage: 3,
  duelFastDamage: 4,
  /** Kata pengecoh di duel (babak 3, Sheriff/Legenda, dan duel penentuan). */
  decoys: ['TEMBOK', 'TAMBAK', 'TEMPAT', 'TEMBAGA', 'TEMPE', 'TAMBAH'],
  /** Meter Mata Elang: diisi peluru yang lewat sangat dekat (serempetan). */
  grazeRange: 13,
  grazeFill: 0.07,
  deadeyeTime: 3,
  /** Kecepatan dunia selama Mata Elang (pemain tetap normal). */
  deadeyeScale: 0.35,
  /** Tembakan terakhir sebelum duel penentuan. */
  lastStand: 8,
  /** Batas nyali tiap babak (pecahan dari HP awal). */
  acts: [0.66, 0.33],
  /** Kerusakan mekanik khusus: dinamit yang ditendang balik, kereta yang dibelokkan. */
  kickDamage: 2,
  leverDamage: 3,
  leverTime: 1,
  leverEvery: 6.5,
  /** Atap kereta (Si Mata Elang babak 3): angin dan celah antar gerbong. */
  wind: -28,
  pitEvery: 2.4,
  pitSpeed: 85,
  pitWidth: 34,
  plank: 48,
}

export type ArenaStyle = 'street' | 'saloon' | 'train'

/** Tema visual (latar, lantai, pagar, warna HUD) — lihat scenes.ts. Mekanik arena tetap dari `arena`. */
export type SceneId = 'desert' | 'street' | 'saloon' | 'trainroof' | 'mine' | 'powder' | 'inferno' | 'station' | 'bridge' | 'ghosttrain'

export interface BossAct {
  name: string
  arena: ArenaStyle
  scene: SceneId
  patterns: PatternId[]
  level: number
  together: number
}

export interface BossDef {
  name: string
  title: string
  /** Cara khusus melukai bos ini (selain revolver dan duel). */
  special: 'none' | 'kick' | 'lever'
  hint: string
  hp: number
  /** Peluang dasar berguling saat ditembak di luar waktu mengisi ulang. */
  roll: number
  acts: [BossAct, BossAct, BossAct]
  /** Tembakan terakhir memakai proyektil ini. */
  curtain: 'bullet' | 'thorn' | 'dust'
}

export const BOSSES: Record<'elang' | 'dinamit' | 'masinis', BossDef> = {
  elang: {
    name: 'Si Mata Elang',
    title: 'Penembak tercepat di barat',
    special: 'none',
    hint: 'Gesit dan suka berguling. Tembak saat ia mengisi ulang; di saloon berlindung di balik meja, di atap kereta lompati celah gerbong.',
    hp: 30,
    roll: 0.6,
    acts: [
      { name: 'Jalan Utama', arena: 'street', scene: 'street', patterns: ['fan', 'mark', 'ricochet'], level: 0.45, together: 1 },
      { name: 'Saloon', arena: 'saloon', scene: 'saloon', patterns: ['ricochet', 'fan', 'spiral', 'lamp', 'mark'], level: 0.7, together: 1 },
      { name: 'Atap Kereta', arena: 'train', scene: 'trainroof', patterns: ['fan', 'mark', 'bull', 'spiral', 'dynamite'], level: 0.8, together: 2 },
    ],
    curtain: 'bullet',
  },
  dinamit: {
    name: 'Bocah Dinamit',
    title: 'Peledak tambang yang tak bisa diam',
    special: 'kick',
    hint: 'Lambat menghindar, tapi arena penuh ledakan. Dash menabrak dinamit yang masih menyala untuk menendangnya balik.',
    hp: 26,
    roll: 0.35,
    acts: [
      { name: 'Tambang Tua', arena: 'street', scene: 'mine', patterns: ['dynamite', 'tumbleweed', 'barrel'], level: 0.5, together: 1 },
      { name: 'Gudang Mesiu', arena: 'street', scene: 'powder', patterns: ['dynamite', 'barrel', 'bull', 'spiral'], level: 0.8, together: 1 },
      { name: 'Ledakan Berantai', arena: 'street', scene: 'inferno', patterns: ['dynamite', 'barrel', 'fan', 'tumbleweed', 'bull'], level: 1.05, together: 2 },
    ],
    curtain: 'thorn',
  },
  masinis: {
    name: 'Hantu Masinis',
    title: 'Penumpang terakhir kereta malam',
    special: 'lever',
    hint: 'Bisa menembus (menghilang) saat ditembak. Berdiri di tuas rel sampai penuh untuk membelokkan kereta ke arahnya.',
    hp: 32,
    roll: 0.45,
    acts: [
      { name: 'Stasiun Mati', arena: 'street', scene: 'station', patterns: ['train', 'dust', 'ricochet'], level: 0.5, together: 1 },
      { name: 'Jembatan Kabut', arena: 'street', scene: 'bridge', patterns: ['train', 'lasso', 'ricochet', 'dust', 'mark'], level: 0.8, together: 1 },
      { name: 'Kereta Terakhir', arena: 'street', scene: 'ghosttrain', patterns: ['train', 'spiral', 'bull', 'mark', 'fan'], level: 1.05, together: 2 },
    ],
    curtain: 'dust',
  },
}

/** Mode Bertahan: bos mini tiap sekian gelombang, bergiliran. */
export const ENDLESS_BOSS = {
  every: 5,
  order: ['dinamit', 'elang', 'masinis'] as ('elang' | 'dinamit' | 'masinis')[],
  /** HP bos mini = HP bos × (base + per gelombang), dibatasi max. */
  hpBase: 0.4,
  hpPerWave: 0.02,
  hpMax: 0.8,
  score: 1500,
  heal: 2,
}
