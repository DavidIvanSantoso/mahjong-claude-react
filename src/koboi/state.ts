import { ARENA, PLAYER, type PatternId } from './config'

/**
 * Tipe dan state KOBOI (tanpa DOM), plus pembantu kecil yang dipakai engine.ts, boss.ts, dan patterns.ts:
 * kolam peluru, pembuat hazard, acak ber-seed, dan geometri tabrakan.
 */

export type Mode = 'endless' | 'boss'
export type BossId = 'elang' | 'dinamit' | 'masinis'
export type Difficulty = 'koboi' | 'sheriff' | 'legenda'

export type ShotKind = 'bullet' | 'tumbleweed' | 'thorn' | 'dust'

/** Satu proyektil musuh. Disimpan di kolam (array dipakai ulang) supaya tidak membuat objek baru tiap tembakan. */
export interface Shot {
  alive: boolean
  kind: ShotKind
  /** Pola asal (untuk debug dan statistik). */
  pattern: PatternId
  x: number
  y: number
  vx: number
  vy: number
  /** Percepatan (satuan/detik²). */
  ax: number
  ay: number
  r: number
  damage: number
  age: number
  /** Umur maksimum (detik), pengaman supaya tidak menumpuk. */
  life: number
  /** Sisa pantulan di dinding arena (Peluru Pantul). */
  bounces: number
  /** Gulungan semak: jalur dasar y dan tinggi lompatan. */
  baseY: number
  hop: number
  /** Sudah pernah masuk arena (baru dibuang saat keluar lagi). */
  entered: boolean
  /** Sudah menyerempet pemain (mengisi meter Mata Elang sekali saja). */
  grazed: boolean
}

export type Hazard =
  /** Penembak di luar arena (Kipas Revolver, Tanda Buronan). `flash` = sisa kilatan moncong. */
  | { kind: 'gunman'; pattern: PatternId; x: number; y: number; aim: number; t: number; life: number; flash: number; glint: number }
  /**
   * Dinamit/lampu gantung: dilempar/jatuh, sumbu menyala `fuse` detik, lalu meledak (`boom` = waktu sejak
   * meledak). `kick` = bisa ditendang balik ke bos dengan dash (Bocah Dinamit).
   */
  | { kind: 'blast'; pattern: PatternId; x: number; y: number; r: number; fuse: number; total: number; boom: number; fromX: number; fromY: number; hurt: boolean; t: number; style: 'dynamite' | 'lamp'; kick: boolean; kicked: boolean }
  /** Tanda Buronan: mengikuti pemain (atau memprediksi arah geraknya), lalu terkunci, lalu ditembak. */
  | { kind: 'mark'; pattern: PatternId; x: number; y: number; r: number; follow: number; lock: number; t: number; fired: number; gx: number; gy: number; lead: number }
  /** Laso melingkar: berporos di sudut, menyapu sudut `from`→`to`. */
  | { kind: 'arc'; pattern: PatternId; px: number; py: number; length: number; from: number; to: number; warn: number; sweep: number; t: number }
  /** Laso lurus: tali melintang yang bergerak, dengan simpul (celah) di `gap`. */
  | { kind: 'rope'; pattern: PatternId; axis: 'x' | 'y'; dir: 1 | -1; pos: number; speed: number; gap: number; gapSize: number; warn: number; t: number }
  /** Tanda jalur sebelum serangan (Duri Kaktus, Badai Debu, semak gulung): garis peringatan di tepi. */
  | { kind: 'lane'; pattern: PatternId; edge: Edge; from: number; to: number; safe: boolean; warn: number; t: number }
  /** Lintasan Peluru Pantul yang akan datang. */
  | { kind: 'path'; pattern: PatternId; points: [number, number][]; warn: number; t: number }
  /** Kereta Hantu: rel diperingatkan dulu, lalu lokomotif melintas di satu jalur selebar `band`. */
  | { kind: 'train'; pattern: PatternId; axis: 'x' | 'y'; lane: number; band: number; dir: 1 | -1; pos: number; length: number; speed: number; warn: number; t: number }
  /** Banteng Seruduk: jalur serudukan terlihat dulu, lalu banteng berlari lurus. */
  | { kind: 'bull'; pattern: PatternId; x: number; y: number; dx: number; dy: number; speed: number; r: number; warn: number; t: number }
  /** Putaran Peluru: silinder revolver berputar di satu titik dan menembakkan lengan spiral. */
  | { kind: 'spinner'; pattern: PatternId; x: number; y: number; arms: number; angle: number; spin: number; speed: number; warn: number; fire: number; every: number; next: number; t: number }
  /** Tong Mesiu: menggelinding ke titik sasaran, sumbu menyala, lalu pecah jadi cincin serpihan bercelah. */
  | { kind: 'barrel'; pattern: PatternId; x: number; y: number; fromX: number; fromY: number; tx: number; ty: number; roll: number; fuse: number; pieces: number; speed: number; t: number; burst: boolean }
  /** Tembakan terakhir: lorong aman yang bergeser (panduan hijau di atas arena). */
  | { kind: 'corridor'; pattern: PatternId; x: number; width: number; t: number; life: number }

export type Edge = 'top' | 'bottom' | 'left' | 'right'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  age: number
  size: number
  color: string
  kind: 'dust' | 'spark' | 'smoke' | 'flash' | 'star'
}

/** Satu pola yang sedang berjalan. */
export interface Run {
  id: PatternId
  t: number
  duration: number
  /** Dipanggil tiap frame selama pola berjalan. */
  step: (dt: number) => void
}

export type Phase = 'countdown' | 'attack' | 'break' | 'recovery' | 'reload' | 'laststand' | 'duel' | 'over' | 'won'

export interface Duel {
  /** Kapan aba-aba "TEMBAK!" muncul (detik sejak duel dimulai). */
  signal: number
  t: number
  /** Hasil: null = belum, lalu teks hasilnya. */
  result: null | 'early' | 'slow' | 'hit' | 'fast' | 'decoy'
  reaction: number
  /** Sisa waktu menampilkan hasil. */
  show: number
  /** Kata pengecoh yang muncul sebelum aba-aba asli. */
  decoys: { at: number; word: string }[]
  /** Duel penentuan (setelah tembakan terakhir): menang = bos kalah. */
  final: boolean
}

export interface Boss {
  id: BossId
  hp: number
  maxHp: number
  /** Babak 0–2. */
  act: number
  attacks: number
  /** Kilatan putih saat terluka, dan animasi menembak/melempar. */
  hurt: number
  draw: number
  x: number
  y: number
  targetX: number
  /** Sedang berguling menghindar (kebal) dan arah gulingnya. */
  roll: number
  rollDir: number
  rollCd: number
  /** Sisa waktu mengisi ulang (celah serang: tidak bisa menghindar). */
  reload: number
  /** 'fight' → 'laststand' (tembakan terakhir) → 'final' (duel penentuan). */
  stage: 'fight' | 'laststand' | 'final'
  /** Bos mini di mode Bertahan (tanpa tembakan terakhir dan duel penentuan). */
  mini: boolean
  /** Tambahan tingkat kesulitan pola (mode Bertahan: ikut gelombang). */
  levelBonus: number
}

/** Peluru pemain atau dinamit yang ditendang balik. */
export interface PlayerShot {
  kind: 'bullet' | 'kick'
  x: number
  y: number
  vx: number
  vy: number
  homing: boolean
  alive: boolean
  age: number
}

export interface Pickup {
  x: number
  y: number
  t: number
  life: number
}

/** Meja saloon: menahan peluru musuh dan menghalangi gerak; hancur setelah beberapa tembakan. */
export interface Cover {
  x: number
  y: number
  w: number
  h: number
  hp: number
  hit: number
}

/** Celah antar gerbong di atap kereta: jatuh = −1 nyawa, kecuali sedang dash (melompat) atau lewat papan. */
export interface Pit {
  x: number
  w: number
  plankY: number
  plankH: number
}

/** Tuas rel (Hantu Masinis): berdiri di atasnya sampai penuh untuk membelokkan kereta ke bos. */
export interface Lever {
  x: number
  y: number
  progress: number
  t: number
  life: number
  pulled: number
}

export interface GameState {
  mode: Mode
  difficulty: Difficulty
  seed: number
  rand: () => number
  phase: Phase
  /** Waktu di fase sekarang. */
  phaseTime: number
  /** Lama fase jeda/istirahat sekarang. */
  phaseLength: number
  time: number
  player: {
    x: number
    y: number
    hp: number
    maxHp: number
    invuln: number
    dash: number
    dashCooldown: number
    dashX: number
    dashY: number
    /** Arah hadap terakhir (untuk dash tanpa tombol arah). */
    faceX: number
    faceY: number
    /** Kecepatan gerak terakhir (dipakai Tanda Buronan yang memprediksi). */
    vx: number
    vy: number
    /** Hadap gambar: 'side' (kiri/kanan sesuai `flip`), 'up' (membelakangi), 'down' (menghadap layar). */
    view: 'side' | 'up' | 'down'
    flip: boolean
    moving: boolean
    trail: { x: number; y: number; age: number }[]
  }
  input: { up: boolean; down: boolean; left: boolean; right: boolean }
  dashEnabled: boolean
  shots: Shot[]
  hazards: Hazard[]
  particles: Particle[]
  runs: Run[]
  /** Antrean serangan gelombang ini: tiap elemen dijalankan bersamaan. */
  queue: PatternId[][]
  /** Pola yang baru saja dipakai (mencegah pengulangan). */
  recent: PatternId[]
  wave: number
  waveHits: number
  score: number
  hits: number
  dodged: number
  perfectWaves: number
  boss: Boss | null
  /** Bos yang sudah dikalahkan (mode Bertahan). */
  bossesDefeated: number
  duel: Duel | null
  /** Revolver pemain (hanya aktif saat melawan bos). */
  gun: { ammo: number; max: number; cool: number }
  pickups: Pickup[]
  pickupTimer: number
  pshots: PlayerShot[]
  /** Meter Mata Elang (0–1) dan sisa waktu gerak lambat. */
  deadeye: { meter: number; active: number }
  covers: Cover[]
  pits: Pit[]
  pitTimer: number
  levers: Lever[]
  leverTimer: number
  /** Dorongan angin (satuan/detik, negatif = ke kiri) dan gulungan lantai (atap kereta). */
  wind: number
  scroll: number
  banner: { title: string; subtitle: string; time: number; total: number } | null
  shake: number
  /** Kilatan layar saat terkena. */
  flash: number
  events: string[]
  over: boolean
}

// ---------- Acak ber-seed ----------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

export const range = (s: GameState, min: number, max: number) => min + s.rand() * (max - min)
export const pick = <T,>(s: GameState, list: readonly T[]): T => list[Math.floor(s.rand() * list.length)]

// ---------- Kolam peluru ----------

const MAX_SHOTS = 600

export function spawnShot(s: GameState, kind: ShotKind, pattern: PatternId, x: number, y: number, vx: number, vy: number, extra: Partial<Shot> = {}): Shot | null {
  let shot = s.shots.find((item) => !item.alive)
  if (!shot) {
    if (s.shots.length >= MAX_SHOTS) return null
    shot = {} as Shot
    s.shots.push(shot)
  }
  Object.assign(shot, {
    alive: true,
    kind,
    pattern,
    x,
    y,
    vx,
    vy,
    ax: 0,
    ay: 0,
    r: kind === 'tumbleweed' ? 12 : kind === 'dust' ? 5.5 : kind === 'thorn' ? 4 : 3.6,
    damage: 1,
    age: 0,
    life: 9,
    bounces: 0,
    baseY: y,
    hop: 0,
    entered: false,
    grazed: false,
    ...extra,
  })
  return shot
}

// ---------- Geometri ----------

export const ARENA_RIGHT = ARENA.x + ARENA.w
export const ARENA_BOTTOM = ARENA.y + ARENA.h
export const ARENA_CX = ARENA.x + ARENA.w / 2
export const ARENA_CY = ARENA.y + ARENA.h / 2

export function inArena(x: number, y: number, margin = 0): boolean {
  return x > ARENA.x - margin && x < ARENA_RIGHT + margin && y > ARENA.y - margin && y < ARENA_BOTTOM + margin
}

/** Jarak titik (px,py) ke ruas garis (ax,ay)-(bx,by). */
export function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

/** Titik di tepi luar arena sepanjang sisi `edge` pada posisi `along` (0–1). */
export function edgePoint(edge: Edge, along: number, outside = 0): [number, number] {
  switch (edge) {
    case 'top':
      return [ARENA.x + ARENA.w * along, ARENA.y - outside]
    case 'bottom':
      return [ARENA.x + ARENA.w * along, ARENA_BOTTOM + outside]
    case 'left':
      return [ARENA.x - outside, ARENA.y + ARENA.h * along]
    case 'right':
      return [ARENA_RIGHT + outside, ARENA.y + ARENA.h * along]
  }
}

/** Arah masuk (vektor satuan) dari sisi `edge` ke dalam arena. */
export function inward(edge: Edge): [number, number] {
  return edge === 'top' ? [0, 1] : edge === 'bottom' ? [0, -1] : edge === 'left' ? [1, 0] : [-1, 0]
}

export function newPlayer(hp: number = PLAYER.hp) {
  return {
    x: ARENA_CX,
    y: ARENA_CY + ARENA.h * 0.2,
    hp,
    maxHp: hp,
    invuln: 0,
    dash: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 0,
    faceX: 0,
    faceY: -1,
    vx: 0,
    vy: 0,
    view: 'side' as const,
    flip: false,
    moving: false,
    trail: [],
  }
}

export function puff(s: GameState, x: number, y: number, count: number, color: string, kind: Particle['kind'] = 'dust', speed = 60, size = 4) {
  for (let i = 0; i < count; i++) {
    const angle = s.rand() * Math.PI * 2
    const v = speed * (0.3 + s.rand() * 0.7)
    s.particles.push({ x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 0.4 + s.rand() * 0.5, age: 0, size: size * (0.6 + s.rand() * 0.8), color, kind })
  }
  if (s.particles.length > 400) s.particles.splice(0, s.particles.length - 400)
}

/** Tabrakan lingkaran (x,y,r) dengan persegi panjang. */
export function circleRect(x: number, y: number, r: number, box: { x: number; y: number; w: number; h: number }): boolean {
  const cx = Math.max(box.x, Math.min(box.x + box.w, x))
  const cy = Math.max(box.y, Math.min(box.y + box.h, y))
  return Math.hypot(x - cx, y - cy) < r
}
