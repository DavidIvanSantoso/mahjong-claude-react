/**
 * Semua angka keseimbangan PALUNG ada di sini, supaya game bisa disetel tanpa menyentuh mesin
 * (engine.ts) atau gambar (render.ts). Satuan: piksel dunia, detik, meter kedalaman.
 */

/** Ukuran dunia. Tinggi tetap; lebar menyesuaikan rasio layar dalam batas ini. */
export const WORLD = {
  height: 540,
  minWidth: 560,
  maxWidth: 1100,
  /** Posisi x penyelam. Musuh yang mencapai `diverX + reach` menyerang. */
  diverX: 82,
  reach: 26,
  /** Batas atas/bawah jalur renang musuh (HUD di atas, dasar di bawah). */
  laneTop: 96,
  laneBottom: 500,
}

export const PLAYER = {
  hearts: 3,
  maxHearts: 3,
  /** Sonar: tekan Enter untuk menghancurkan semua musuh biasa di layar. */
  sonar: 1,
  maxSonar: 3,
  /** Kebal sebentar setelah terkena, supaya dua ikan yang datang bersamaan tidak langsung menghabisi. */
  hurtGrace: 0.9,
}

/** Kecepatan turun penyelam. Kedalaman = waktu bertahan × laju ini (laju naik pelan seiring kedalaman). */
export const DESCENT = {
  /** m/detik di permukaan. */
  base: 2.4,
  /** Tambahan laju per 100 m. */
  per100m: 0.15,
  max: 4,
}

export type EnemyKind = 'teri' | 'piranha' | 'hiu' | 'martil' | 'bayangan' | 'kraken' | 'megalodon' | 'misil' | 'oksigen' | 'mutiara'

export interface EnemyType {
  kind: EnemyKind
  /** Nama tampilan (panduan, ringkasan). */
  name: string
  /** Panjang kata [min, maks]. */
  length: [number, number]
  /** Kecepatan dasar (px/detik) sebelum dikali skala kedalaman. */
  speed: number
  /** Skor dasar sebelum dikali kombo. */
  points: number
  /** Hati yang hilang kalau menyentuh penyelam (0 = tidak berbahaya). */
  damage: number
  /** 'swim' berenang ke kiri, 'rise' naik dari dasar (bonus). */
  motion: 'swim' | 'rise'
  /** Skala gambar. */
  size: number
  /** Ayunan naik-turun (px). */
  wobble: number
  /** Ikut hancur oleh Sonar. */
  sonarable: boolean
  /**
   * Hanya untuk ikan tak kasatmata: tampil samar (50%) dan baru bisa diketik setelah kepalanya berjarak
   * sekian piksel dari penyelam.
   */
  reveal?: number
}

export const ENEMIES: Record<EnemyKind, EnemyType> = {
  teri: { kind: 'teri', name: 'Teri', length: [1, 1], speed: 165, points: 4, damage: 1, motion: 'swim', size: 0.55, wobble: 10, sonarable: true },
  piranha: { kind: 'piranha', name: 'Piranha', length: [3, 4], speed: 88, points: 10, damage: 1, motion: 'swim', size: 0.8, wobble: 8, sonarable: true },
  hiu: { kind: 'hiu', name: 'Hiu', length: [5, 7], speed: 60, points: 25, damage: 1, motion: 'swim', size: 1.15, wobble: 5, sonarable: true },
  martil: { kind: 'martil', name: 'Hiu Martil', length: [8, 12], speed: 40, points: 50, damage: 1, motion: 'swim', size: 1.35, wobble: 4, sonarable: true },
  /** Ikan bayangan: samar dan tidak bisa diketik sampai dekat penyelam (`reveal`). */
  bayangan: { kind: 'bayangan', name: 'Ikan Bayangan', length: [4, 6], speed: 46, points: 35, damage: 1, motion: 'swim', size: 1, wobble: 7, sonarable: true, reveal: 330 },
  /** Penjaga zona: beberapa kata berurutan (BOSS_PHRASES). */
  kraken: { kind: 'kraken', name: 'Kraken', length: [0, 99], speed: 17, points: 200, damage: 2, motion: 'swim', size: 1.7, wobble: 14, sonarable: false },
  /**
   * Bos robot (lihat MEGALODON). Tidak diketik langsung dan tidak pernah berupa musuh biasa; entri ini
   * dipakai untuk nama, skor, dan gambar panduan.
   */
  megalodon: { kind: 'megalodon', name: 'Megalodon Robot', length: [0, 0], speed: 0, points: 400, damage: 1, motion: 'swim', size: 2.2, wobble: 0, sonarable: false },
  /** Misil dari Megalodon: meluncur ke penyelam; diketik = dipantulkan ke bos. */
  misil: { kind: 'misil', name: 'Misil', length: [4, 7], speed: 95, points: 8, damage: 1, motion: 'swim', size: 0.75, wobble: 0, sonarable: true },
  /** Gelembung oksigen: +1 hati. */
  oksigen: { kind: 'oksigen', name: 'Gelembung Oksigen', length: [4, 8], speed: 34, points: 15, damage: 0, motion: 'rise', size: 1, wobble: 18, sonarable: false },
  /** Kerang mutiara: +1 Sonar dan skor bonus. */
  mutiara: { kind: 'mutiara', name: 'Kerang Mutiara', length: [4, 8], speed: 30, points: 40, damage: 0, motion: 'rise', size: 1, wobble: 12, sonarable: false },
}

/** Zona kedalaman: warna laut, nama, dan kegelapan (0 terang – 1 gelap total di luar lampu penyelam). */
export interface Zone {
  from: number
  name: string
  top: string
  bottom: string
  darkness: number
}

export const ZONES: Zone[] = [
  { from: 0, name: 'Zona Cahaya', top: '#3fa7c9', bottom: '#1b6f96', darkness: 0 },
  { from: 100, name: 'Zona Senja', top: '#1d5d84', bottom: '#123e63', darkness: 0.25 },
  { from: 300, name: 'Zona Tengah Malam', top: '#0d2a46', bottom: '#081a30', darkness: 0.55 },
  { from: 600, name: 'Zona Abisal', top: '#07172a', bottom: '#040c18', darkness: 0.62 },
  { from: 1000, name: 'Palung Hadal', top: '#050d1a', bottom: '#02050c', darkness: 0.7 },
]

export function zoneAt(depth: number): Zone {
  let zone = ZONES[0]
  for (const candidate of ZONES) if (depth >= candidate.from) zone = candidate
  return zone
}

/** Tingkat kesulitan pada kedalaman tertentu. */
export interface Difficulty {
  /** Jeda antar kemunculan musuh biasa (detik). */
  spawnInterval: number
  /** Pengali kecepatan semua musuh. */
  speedScale: number
  /** Musuh biasa maksimal di layar. */
  maxEnemies: number
  /** Bobot peluang tiap tipe musuh biasa. */
  weights: Partial<Record<EnemyKind, number>>
}

export function difficultyAt(depth: number): Difficulty {
  const d = Math.max(0, depth)
  // Setelah 1000 m kesulitan tetap naik pelan, supaya tidak ada titik aman untuk bertahan selamanya.
  const beyond = Math.max(0, d - 1000)
  return {
    spawnInterval: Math.max(0.35, Math.max(0.6, 2.2 * 0.5 ** (d / 330)) - beyond / 4000),
    speedScale: 1 + Math.min(1.1, d / 750) + beyond / 1500,
    maxEnemies: Math.min(13, 4 + Math.floor(d / 100)),
    weights: {
      piranha: Math.max(0.6, 1.2 - d / 800),
      hiu: Math.min(1.1, 0.35 + d / 250),
      martil: d < 40 ? 0 : Math.min(0.8, (d - 40) / 350),
      bayangan: d < 150 ? 0 : Math.min(0.55, (d - 150) / 450),
    },
  }
}

/** Kejadian berkala, dihitung dalam meter. */
export const EVENTS = {
  /** Kawanan Teri: banyak ikan kecil berhuruf satu, cepat, datang beruntun. */
  swarm: {
    firstAt: 40,
    every: 100,
    /** Jumlah ikan: min + 1 per `growPer` meter, sampai maks. */
    min: 6,
    max: 18,
    growPer: 60,
    /** Jeda antar ikan dalam kawanan (detik). */
    gap: 0.32,
  },
  /** Gelembung oksigen hanya muncul kalau hati berkurang. */
  oxygen: { firstAt: 70, every: 140 },
  mutiara: { firstAt: 120, every: 160 },
  /**
   * Penjaga zona muncul di awal tiap zona, lalu tiap `every` meter setelah zona terakhir. Jenisnya
   * bergiliran menurut `order` (100 m Kraken, 300 m Megalodon, 600 m Kraken, ...).
   */
  boss: { every: 500, order: ['kraken', 'megalodon'] as EnemyKind[] },
}

/**
 * Megalodon Robot. Selama pertarungan tidak ada ikan lain yang muncul dan penyelam berhenti turun.
 * `round` = berapa Megalodon yang sudah dikalahkan sebelumnya (pertarungan berikutnya lebih berat).
 */
export const MEGALODON = {
  /** Jeda minimal setelah peringatan; bos baru masuk setelah semua ikan berbahaya di layar habis. */
  warning: 2.2,
  hp: 10,
  hpPerRound: 3,
  /** Jarak titik tengah bos dari tepi kanan saat bertarung. */
  homeOffset: 150,
  /** Kecepatan pindah posisi naik-turun (px/detik). */
  moveSpeed: 120,
  moveSpeedPerRound: 20,
  /** Lama diam di satu posisi (sambil menembak): `hold` saat HP penuh, menyusut ke `holdMin` saat HP hampir habis. */
  hold: 3.6,
  holdMin: 2.3,
  /** Tembakan pertama setelah berhenti, lalu tiap `fireEvery` detik selama diam. */
  fireDelay: 0.45,
  fireEvery: 1.7,
  /** Tidak menembak kalau sisa waktu diam kurang dari ini, supaya setiap misil masih sempat dipantulkan kena. */
  fireCutoff: 1.1,
  maxMissiles: 2,
  /** Misil boleh 3 sekaligus mulai pertarungan ke berapa (0 = pertama). */
  threeMissilesFromRound: 1,
  missileSpeed: 95,
  missileSpeedPerRound: 12,
  /** Kecepatan misil yang dipantulkan kembali ke bos. */
  returnSpeed: 620,
  /** Area badan bos (elips) untuk menentukan pantulan kena atau meleset. */
  hitbox: { rx: 108, ry: 44 },
  /** QTE "gigitan" dimulai saat HP turun melewati pecahan ini. */
  qteAt: [0.65, 0.3],
  qte: {
    keys: 3,
    keysPerRound: 1,
    maxKeys: 6,
    /** Waktu per huruf (detik); huruf pertama dapat tambahan `lead` untuk bersiap. */
    time: 1.35,
    timePerRound: -0.12,
    minTime: 0.8,
    lead: 0.6,
    /** HP bos yang hilang kalau QTE berhasil. */
    damage: 2,
  },
}

/**
 * Arus Gua: penyelam berhenti turun dan berenang mendatar melewati terowongan acak, digerakkan dengan
 * panah/WASD (atau sentuh di HP). Selama event tidak ada ikan yang muncul dan tidak ada yang diketik.
 * Jarak dalam piksel dunia; `round` = gua ke berapa (0 = pertama).
 */
export const CAVE = {
  firstAt: 200,
  every: 250,
  /** Jeda minimal setelah peringatan; gua baru dimulai setelah ikan berbahaya di layar habis. */
  warning: 2,
  /** Jarak antartitik kerangka terowongan. */
  segment: 140,
  /** Panjang bagian sempit terowongan. */
  length: 3600,
  lengthPerRound: 350,
  /** Kecepatan gulir (px/detik): dasar + per meter kedalaman, sampai maks. */
  speed: 230,
  speedPerMeter: 0.09,
  maxSpeed: 330,
  /** Lebar celah di awal dan akhir gua (menyempit pelan), dikurangi sedikit per meter. */
  gapStart: 260,
  gapEnd: 190,
  gapShrinkPerMeter: 0.035,
  minGap: 150,
  /** Pergeseran pusat terowongan maksimal antartitik (makin besar makin berkelok). */
  maxStep: 62,
  diverSpeed: 300,
  /**
   * Rintangan: jarak minimal `spacing` titik (berkurang 1 mulai gua ke-`denserFromRound`+1, minimal 2),
   * dengan peluang `chance` per titik.
   */
  spacing: 3,
  denserFromRound: 2,
  chance: 0.8,
  /** Peluang rintangan di gua pertama (lebih jarang, untuk belajar kontrol). */
  firstChance: 0.65,
  weights: { moray: 0.45, urchin: 0.3, jelly: 0.25 },
  /** Peluang mutiara di titik tanpa rintangan. */
  pearlChance: 0.4,
  pearlPoints: 30,
  /** Satu gelembung oksigen di paruh kedua tiap gua: +1 hati (skor kalau hati penuh). */
  oxygenPoints: 60,
  /** Belut Moray: panjang terjangan (pecahan celah) dan waktu tiap tahap (detik). */
  moray: { reach: 0.35, peek: 0.45, out: 0.22, hold: 0.9, back: 0.5 },
  /** Kebal setelah tergores di gua (lebih lama dari biasa supaya sempat keluar dari bahaya). */
  grace: 1.4,
  /** Bonus lolos: (dasar + kedalaman × perMeter), ×2 dan +1 Sonar kalau tanpa tergores. */
  bonus: 150,
  bonusPerMeter: 0.25,
}

/** Pengali skor dari kombo (kata beruntun tanpa salah ketik). */
export const COMBO_STEPS: { at: number; multiplier: number }[] = [
  { at: 0, multiplier: 1 },
  { at: 10, multiplier: 2 },
  { at: 25, multiplier: 3 },
  { at: 50, multiplier: 4 },
]

export function multiplierFor(combo: number): number {
  let value = 1
  for (const step of COMBO_STEPS) if (combo >= step.at) value = step.multiplier
  return value
}

/** Bonus skor per meter kedalaman saat musuh dikalahkan (skor = (dasar + kedalaman × ini) × kombo). */
export const DEPTH_POINTS = 0.05
