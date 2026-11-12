import { createCave, DIVER_PROBES, hazardCircles, wallsAt, CAVE_TOP, type Cave } from './cave'
import {
  CAVE,
  DEPTH_POINTS,
  EEL,
  DESCENT,
  difficultyAt,
  ENEMIES,
  EVENTS,
  MEGALODON,
  multiplierFor,
  PLAYER,
  WORLD,
  ZONES,
  zoneAt,
  type EnemyKind,
} from './config'
import { BONUS_WORDS, BOSS_PHRASES, clean, LETTERS, WORDS } from './words'

/**
 * Mesin PALUNG: state permainan dan aturannya, tanpa DOM. Komponen kanvas (PalungGame.tsx) memanggil
 * `update` tiap frame dan `typeKey`/`fireSonar`/`release` dari keyboard, lalu menggambar state dengan
 * render.ts. State diubah langsung (bukan disalin) karena berjalan 60× per detik.
 */

export interface Enemy {
  id: number
  kind: EnemyKind
  /** Satu kata, atau beberapa untuk Kraken (diketik berurutan). */
  words: string[]
  /** Kata ke berapa yang sedang diketik. */
  segment: number
  /** Huruf yang sudah benar di kata sekarang. */
  progress: number
  x: number
  y: number
  /** Jalur renang (y) atau jalur naik (x) sebelum ayunan. */
  base: number
  speed: number
  phase: number
  age: number
  /** Sisa waktu kilatan merah setelah salah ketik. */
  flash: number
  /** Ikan tak kasatmata sudah cukup dekat untuk diketik (selalu true untuk ikan lain). */
  revealed: boolean
  /** Misil: titik tembak di bos. Misil meluncur lurus dari sini ke penyelam, dan dipantulkan kembali ke sini. */
  origin?: { x: number; y: number }
}

/** Misil yang sudah diketik dan terbang balik ke titik tembaknya. */
export interface Rebound {
  x: number
  y: number
  vx: number
  vy: number
  /** Sudah dinilai kena/meleset (yang meleset terus terbang sampai keluar layar). */
  resolved: boolean
}

/** Quick time event: tekan huruf-huruf ini berurutan, masing-masing sebelum waktunya habis. */
export interface Qte {
  keys: string[]
  index: number
  timer: number
  per: number
}

export type MegaPhase = 'warning' | 'enter' | 'fight' | 'qte' | 'stunned' | 'chomp' | 'dying'

/** Pertarungan Megalodon Robot (lihat MEGALODON di config.ts). */
export interface Megalodon {
  phase: MegaPhase
  /** Sisa waktu fase (warning, stunned, chomp, dying). */
  timer: number
  x: number
  y: number
  targetY: number
  /** Sisa waktu diam di posisi sekarang. */
  hold: number
  fireTimer: number
  hp: number
  maxHp: number
  /** Batas HP berikutnya yang memicu QTE. */
  thresholds: number[]
  /** QTE menunggu semua misil di layar habis dulu. */
  pendingQte: boolean
  qte: Qte | null
  rebounds: Rebound[]
  /** Gigitan saat QTE gagal sudah mengenai penyelam. */
  struck: boolean
  /** Sisa waktu animasi: kena (putih), mulut terbuka setelah menembak. */
  hitFlash: number
  fired: number
  age: number
  round: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  max: number
  kind: 'bubble' | 'ink' | 'spark' | 'volt'
}

/** Tombak kecil dari penyelam ke target tiap huruf benar (hanya hiasan). */
export interface Bolt {
  x: number
  y: number
  tx: number
  ty: number
  t: number
}

export interface Popup {
  x: number
  y: number
  text: string
  life: number
  tone: 'score' | 'heal' | 'bonus' | 'hurt'
}

export type GameEvent =
  | 'key'
  | 'lock'
  | 'error'
  | 'release'
  | 'reveal'
  | 'kill'
  | 'segment'
  | 'hurt'
  | 'heal'
  | 'bonus'
  | 'sonar'
  | 'sonar-empty'
  | 'swarm'
  | 'boss'
  | 'alarm'
  | 'missile'
  | 'deflect'
  | 'boss-hit'
  | 'boss-miss'
  | 'qte'
  | 'qte-key'
  | 'qte-win'
  | 'qte-fail'
  | 'boss-down'
  | 'memory'
  | 'release-orbs'
  | 'zap'
  | 'shock'
  | 'cave'
  | 'cave-start'
  | 'eel'
  | 'pickup'
  | 'cave-clear'
  | 'zone'
  | 'over'

export type Direction = 'up' | 'down' | 'left' | 'right'

/** Bola listrik Belut Listrik. */
export interface Orb {
  letter: string
  x: number
  y: number
  /** Posisi tujuan saat dilepas (y = jalur ayunannya). */
  tx: number
  ty: number
  done: boolean
  flash: number
  phase: number
}

export type EelPhase = 'warning' | 'enter' | 'show' | 'memorize' | 'release' | 'orbs' | 'zap' | 'shock' | 'dying'

/** Pertarungan Belut Listrik (lihat EEL di config.ts). */
export interface EelBoss {
  phase: EelPhase
  timer: number
  x: number
  y: number
  hp: number
  maxHp: number
  round: number
  /** Urutan yang sudah berhasil diketik di pertarungan ini (urutan berikutnya makin panjang). */
  wins: number
  sequence: string[]
  /** Berapa huruf yang sudah ditunjukkan (fase show). */
  shown: number
  /** Huruf ke berapa yang harus diketik berikutnya. */
  index: number
  orbs: Orb[]
  speed: number
  /** Sisa waktu urutan ditampilkan ulang oleh Sonar. */
  peek: number
  /** Kilatan panel saat salah ketik / bos saat terkena. */
  wrong: number
  hitFlash: number
  age: number
}

export interface Banner {
  title: string
  subtitle: string
  time: number
}

export interface GameState {
  width: number
  height: number
  /** Waktu bermain (detik, tanpa jeda). */
  time: number
  depth: number
  zone: number
  hearts: number
  sonar: number
  score: number
  combo: number
  bestCombo: number
  correct: number
  errors: number
  kills: Partial<Record<EnemyKind, number>>
  enemies: Enemy[]
  particles: Particle[]
  bolts: Bolt[]
  popups: Popup[]
  lockId: number | null
  spawnTimer: number
  swarm: { left: number; timer: number } | null
  next: { swarm: number; oxygen: number; mutiara: number; boss: number; cave: number }
  bossCount: number
  mega: Megalodon | null
  eel: EelBoss | null
  /** Arus Gua yang sedang berlangsung (lihat cave.ts). */
  cave: Cave | null
  caveCount: number
  /** Tombol arah yang sedang ditekan (dipakai di Arus Gua). */
  steer: Record<Direction, boolean>
  /** Titik sentuh/klik yang ditahan, dalam koordinat dunia (Arus Gua di layar sentuh). */
  pointer: { x: number; y: number } | null
  /** Sisa waktu kebal setelah terkena. */
  grace: number
  /** Kilatan merah di layar dan getaran saat terkena. */
  hurtFlash: number
  shake: number
  /** Gelombang Sonar (0 → 1) saat dipakai. */
  sonarWave: number | null
  bubbleTimer: number
  banner: Banner | null
  recent: string[]
  over: boolean
  /** Kejadian sejak frame lalu (untuk suara); dikosongkan pemanggil. */
  events: GameEvent[]
  nextId: number
  rand: () => number
}

const POOLS: Partial<Record<EnemyKind, string[]>> = {}

/** Kata yang cocok untuk tipe musuh, menurut panjangnya (dihitung sekali). */
function pool(kind: EnemyKind): string[] {
  if (!POOLS[kind]) {
    if (kind === 'teri') POOLS[kind] = LETTERS
    else if (kind === 'oksigen' || kind === 'mutiara') POOLS[kind] = clean(BONUS_WORDS[kind])
    else {
      const [min, max] = ENEMIES[kind].length
      POOLS[kind] = clean(WORDS).filter((word) => word.length >= min && word.length <= max)
    }
  }
  return POOLS[kind]!
}

/** Kedalaman penjaga zona berikutnya setelah `after` meter. */
function nextBossDepth(after: number): number {
  const zone = ZONES.find((candidate) => candidate.from > after)
  if (zone) return zone.from
  const last = ZONES[ZONES.length - 1].from
  return last + Math.ceil((after - last + 1) / EVENTS.boss.every) * EVENTS.boss.every
}

export function createGame(width: number, rand: () => number = Math.random): GameState {
  return {
    width,
    height: WORLD.height,
    time: 0,
    depth: 0,
    zone: 0,
    hearts: PLAYER.hearts,
    sonar: PLAYER.sonar,
    score: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    errors: 0,
    kills: {},
    enemies: [],
    particles: [],
    bolts: [],
    popups: [],
    lockId: null,
    spawnTimer: 1.6,
    swarm: null,
    next: { swarm: EVENTS.swarm.firstAt, oxygen: EVENTS.oxygen.firstAt, mutiara: EVENTS.mutiara.firstAt, boss: nextBossDepth(0), cave: CAVE.firstAt },
    bossCount: 0,
    mega: null,
    eel: null,
    cave: null,
    caveCount: 0,
    steer: { up: false, down: false, left: false, right: false },
    pointer: null,
    grace: 0,
    hurtFlash: 0,
    shake: 0,
    sonarWave: null,
    bubbleTimer: 0,
    banner: { title: ZONES[0].name, subtitle: 'Ketik kata di atas ikan sebelum mereka mencapaimu', time: 3.2 },
    recent: [],
    over: false,
    events: [],
    nextId: 1,
    rand,
  }
}

// ---------- Statistik ----------

export function wpm(s: GameState): number {
  return s.time < 1 ? 0 : s.correct / 5 / (s.time / 60)
}

export function accuracy(s: GameState): number {
  const total = s.correct + s.errors
  return total === 0 ? 1 : s.correct / total
}

export function totalKills(s: GameState): number {
  return Object.values(s.kills).reduce((sum, count) => sum + (count ?? 0), 0)
}

export function lockedEnemy(s: GameState): Enemy | null {
  return s.lockId === null ? null : (s.enemies.find((enemy) => enemy.id === s.lockId) ?? null)
}

export const diverY = (s: GameState) => s.height / 2

/** Posisi penyelam di layar: tetap, kecuali saat berenang bebas di Arus Gua. */
export function diverAt(s: GameState): { x: number; y: number } {
  return s.cave && s.cave.phase !== 'warning' ? { x: s.cave.x, y: s.cave.y } : { x: WORLD.diverX, y: diverY(s) }
}

/** Arus Gua sedang berjalan: penyelam digerakkan, mengetik tidak berlaku. */
export const steering = (s: GameState) => s.cave !== null && s.cave.phase !== 'warning'

/** Jari-jari tabrakan musuh (dari titik tengahnya). */
export function reachOf(enemy: Enemy): number {
  return 26 * ENEMIES[enemy.kind].size
}

// ---------- Kemunculan ----------

function pick<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)]
}

/** Huruf awal kata yang sedang dikejar musuh lain: dihindari supaya penguncian tidak ambigu. */
function usedInitials(s: GameState): Set<string> {
  return new Set(s.enemies.map((enemy) => enemy.words[enemy.segment]?.[0]).filter(Boolean))
}

function pickWord(s: GameState, kind: EnemyKind): string {
  const words = pool(kind)
  const used = usedInitials(s)
  const fresh = words.filter((word) => !used.has(word[0]) && !s.recent.includes(word))
  const fallback = words.filter((word) => !used.has(word[0]))
  const word = pick(fresh.length ? fresh : fallback.length ? fallback : words, s.rand)
  s.recent = [...s.recent, word].slice(-30)
  return word
}

/** Jalur renang yang paling jauh dari musuh lain yang baru muncul. */
function pickLane(s: GameState): number {
  const near = s.enemies.filter((enemy) => enemy.x > s.width * 0.55)
  let best = WORLD.laneTop
  let bestGap = -1
  for (let i = 0; i < 8; i++) {
    const y = WORLD.laneTop + s.rand() * (WORLD.laneBottom - WORLD.laneTop)
    const gap = Math.min(999, ...near.map((enemy) => Math.abs(enemy.y - y)))
    if (gap > bestGap) {
      best = y
      bestGap = gap
    }
  }
  return best
}

function spawn(s: GameState, kind: EnemyKind, words?: string[]): Enemy {
  const type = ENEMIES[kind]
  const scale = kind === 'kraken' || type.motion === 'rise' ? 1 : difficultyAt(s.depth).speedScale
  const rising = type.motion === 'rise'
  const base = rising ? s.width * (0.4 + s.rand() * 0.45) : kind === 'kraken' ? s.height / 2 + 10 : pickLane(s)
  const enemy: Enemy = {
    id: s.nextId++,
    kind,
    words: words ?? [pickWord(s, kind)],
    segment: 0,
    progress: 0,
    x: rising ? base : s.width + 40 * type.size,
    y: rising ? s.height + 40 : base,
    base,
    speed: type.speed * scale * (0.9 + s.rand() * 0.2),
    phase: s.rand() * Math.PI * 2,
    age: 0,
    flash: 0,
    revealed: type.reveal === undefined,
  }
  s.enemies.push(enemy)
  return enemy
}

function pickKind(s: GameState): EnemyKind {
  const weights = Object.entries(difficultyAt(s.depth).weights) as [EnemyKind, number][]
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = s.rand() * total
  for (const [kind, weight] of weights) {
    roll -= weight
    if (roll <= 0) return kind
  }
  return 'piranha'
}

const isRegular = (enemy: Enemy) => ENEMIES[enemy.kind].damage > 0 && enemy.kind !== 'kraken' && enemy.kind !== 'teri'
const bossAlive = (s: GameState) => s.mega !== null || s.eel !== null || s.enemies.some((enemy) => enemy.kind === 'kraken')

function banner(s: GameState, title: string, subtitle: string, time = 2.6) {
  s.banner = { title, subtitle, time }
}

function schedule(s: GameState, dt: number) {
  // Selama Megalodon atau Arus Gua: tidak ada yang muncul sama sekali.
  if (s.mega || s.eel || s.cave) return
  const boss = bossAlive(s)

  if (!boss && s.depth >= s.next.boss) {
    const order = EVENTS.boss.order
    const kind = order[s.bossCount % order.length]
    s.bossCount++
    s.next.boss = nextBossDepth(s.next.boss)
    if (kind === 'megalodon') {
      startMegalodon(s)
      return
    }
    if (kind === 'listrik') {
      startEel(s)
      return
    }
    spawn(s, 'kraken', [...BOSS_PHRASES[(s.kills.kraken ?? 0) % BOSS_PHRASES.length]])
    s.events.push('boss')
    banner(s, 'KRAKEN MENGHADANG!', 'Ketik semua katanya berurutan · penyelam berhenti turun', 3)
    return
  }
  if (!boss && !s.swarm && s.depth >= s.next.cave) {
    s.next.cave += CAVE.every
    s.cave = createCave(s.width, s.height, s.depth, s.caveCount, s.rand)
    s.events.push('cave')
    banner(s, 'ARUS GUA DI DEPAN', 'Bersiap berenang mendatar · ikan berhenti datang', 3)
    return
  }
  if (!boss && !s.swarm && s.depth >= s.next.swarm) {
    const { min, max, growPer, every } = EVENTS.swarm
    s.swarm = { left: Math.min(max, min + Math.floor(s.depth / growPer)), timer: 0.6 }
    s.next.swarm += every
    s.events.push('swarm')
    banner(s, 'KAWANAN TERI!', 'Satu huruf, datang beruntun', 2)
  }
  if (s.depth >= s.next.oxygen) {
    if (s.hearts < PLAYER.maxHearts) {
      spawn(s, 'oksigen')
      s.next.oxygen += EVENTS.oxygen.every
    } else s.next.oxygen += 20
  }
  if (s.depth >= s.next.mutiara) {
    spawn(s, 'mutiara')
    s.next.mutiara += EVENTS.mutiara.every
  }

  if (s.swarm) {
    s.swarm.timer -= dt
    if (s.swarm.timer <= 0) {
      spawn(s, 'teri')
      s.swarm.left--
      s.swarm.timer = EVENTS.swarm.gap * (0.6 + s.rand() * 0.8)
      if (s.swarm.left <= 0) {
        s.swarm = null
        s.spawnTimer = 1.4
      }
    }
    return
  }

  const level = difficultyAt(s.depth)
  s.spawnTimer -= dt
  const max = boss ? 2 : level.maxEnemies
  if (s.spawnTimer <= 0 && s.enemies.filter(isRegular).length < max) {
    spawn(s, pickKind(s))
    s.spawnTimer = level.spawnInterval * (boss ? 1.8 : 1) * (0.75 + s.rand() * 0.5)
  }
}

// ---------- Efek ----------

function burst(s: GameState, x: number, y: number, count: number, kind: Particle['kind'] = 'bubble', spread = 1) {
  for (let i = 0; i < count; i++) {
    const angle = s.rand() * Math.PI * 2
    const speed = (30 + s.rand() * 110) * spread
    const life = 0.5 + s.rand() * 0.8
    s.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      r: kind === 'ink' ? 8 + s.rand() * 14 : 1.5 + s.rand() * 4.5,
      life,
      max: life,
      kind,
    })
  }
}

function popup(s: GameState, x: number, y: number, text: string, tone: Popup['tone'] = 'score') {
  s.popups.push({ x, y, text, life: 1, tone })
}

// ---------- Aksi pemain ----------

function destroy(s: GameState, enemy: Enemy, bySonar = false) {
  s.enemies = s.enemies.filter((other) => other !== enemy)
  if (s.lockId === enemy.id) s.lockId = null
  const type = ENEMIES[enemy.kind]
  s.kills[enemy.kind] = (s.kills[enemy.kind] ?? 0) + 1
  if (!bySonar) {
    s.combo++
    s.bestCombo = Math.max(s.bestCombo, s.combo)
  }
  const points = Math.round((type.points + s.depth * DEPTH_POINTS) * (bySonar ? 1 : multiplierFor(s.combo)))
  s.score += points
  popup(s, enemy.x, enemy.y - 24, `+${points}`)
  burst(s, enemy.x, enemy.y, Math.round(10 + 10 * type.size), 'bubble', type.size)

  if (enemy.kind === 'oksigen') {
    s.hearts = Math.min(PLAYER.maxHearts, s.hearts + 1)
    popup(s, WORLD.diverX, diverY(s) - 40, '+1 ♥', 'heal')
    s.events.push('heal')
  } else if (enemy.kind === 'mutiara') {
    s.sonar = Math.min(PLAYER.maxSonar, s.sonar + 1)
    popup(s, enemy.x, enemy.y - 46, '+1 SONAR', 'bonus')
    s.events.push('bonus')
  } else if (enemy.kind === 'misil') {
    burst(s, enemy.x, enemy.y, 10, 'spark', 0.8)
    if (s.mega && enemy.origin && !bySonar) rebound(s, s.mega, enemy)
    else s.events.push('kill')
  } else if (enemy.kind === 'kraken') {
    burst(s, enemy.x, enemy.y, 14, 'ink', 1.4)
    banner(s, 'KRAKEN KALAH!', 'Lanjut menyelam', 2)
    s.events.push('kill')
  } else s.events.push('kill')
}

/**
 * Bisa dikunci atau tidak. Label setiap musuh selalu digambar di dalam layar (walau badannya baru
 * separuh masuk), jadi semua musuh bisa diketik begitu labelnya terlihat, kecuali ikan tak kasatmata
 * (`reveal`) yang baru bisa diketik setelah dekat penyelam.
 */
export function isTypeable(enemy: Enemy): boolean {
  const reveal = ENEMIES[enemy.kind].reveal
  return reveal === undefined || enemy.x - reachOf(enemy) <= WORLD.diverX + reveal
}

/** Mengetik satu huruf: mengunci musuh terdekat yang cocok, atau melanjutkan musuh yang terkunci. */
export function typeKey(s: GameState, key: string) {
  const c = key.toLowerCase()
  if (s.over || !/^[a-z]$/.test(c) || steering(s)) return
  if (s.mega?.qte) {
    qteKey(s, s.mega, c)
    return
  }
  if (s.eel && s.eel.phase !== 'warning') {
    memoryKey(s, s.eel, c)
    return
  }
  let target = lockedEnemy(s)
  if (!target) {
    const visible = s.enemies.filter((enemy) => isTypeable(enemy) && enemy.words[enemy.segment][enemy.progress] === c)
    // Terdekat ke penyelam = paling mengancam.
    target = visible.sort((a, b) => a.x - reachOf(a) - (b.x - reachOf(b)))[0] ?? null
    if (!target) {
      mistake(s, null)
      return
    }
    s.lockId = target.id
    s.events.push('lock')
  }

  const word = target.words[target.segment]
  if (word[target.progress] !== c) {
    mistake(s, target)
    return
  }
  target.progress++
  s.correct++
  s.events.push('key')
  s.bolts.push({ x: WORLD.diverX + 18, y: diverY(s) - 4, tx: target.x, ty: target.y, t: 0 })
  if (target.progress < word.length) return

  if (target.segment < target.words.length - 1) {
    // Kraken: kata berikutnya, dan ia terdorong mundur sedikit.
    target.segment++
    target.progress = 0
    target.x = Math.min(s.width - 60, target.x + 34)
    burst(s, target.x - 30, target.y, 8, 'ink', 0.7)
    s.events.push('segment')
    return
  }
  destroy(s, target)
}

function mistake(s: GameState, target: Enemy | null) {
  s.errors++
  s.combo = 0
  if (target) target.flash = 0.25
  s.events.push('error')
}

/** Backspace: melepas kunci; kemajuan kata itu diulang dari awal. */
export function release(s: GameState) {
  const target = lockedEnemy(s)
  if (!target || s.over || s.mega?.qte || steering(s) || (s.eel && s.eel.phase !== 'warning')) return
  target.progress = 0
  s.lockId = null
  s.events.push('release')
}

/** Enter: Sonar menghancurkan semua musuh biasa dan teri di layar (tanpa kombo). */
export function fireSonar(s: GameState) {
  if (s.over || s.mega?.qte || steering(s)) return
  if (s.eel && s.eel.phase !== 'warning') {
    // Melawan Belut Listrik: Sonar menampilkan ulang urutan sebentar (hanya saat bola sudah dilepas).
    if (s.eel.phase !== 'orbs' || s.eel.peek > 0) return
    if (s.sonar <= 0) {
      s.events.push('sonar-empty')
      return
    }
    s.sonar--
    s.sonarWave = 0
    s.eel.peek = EEL.peek
    s.events.push('sonar')
    return
  }
  if (s.sonar <= 0) {
    s.events.push('sonar-empty')
    return
  }
  s.sonar--
  s.sonarWave = 0
  s.events.push('sonar')
  for (const enemy of [...s.enemies]) if (ENEMIES[enemy.kind].sonarable) destroy(s, enemy, true)
}

// ---------- Frame ----------

function hurt(s: GameState, enemy: Enemy) {
  s.enemies = s.enemies.filter((other) => other !== enemy)
  if (s.lockId === enemy.id) s.lockId = null
  burst(s, enemy.x, enemy.y, 12, enemy.kind === 'kraken' ? 'ink' : 'spark')
  damagePlayer(s, ENEMIES[enemy.kind].damage)
}

function damagePlayer(s: GameState, damage: number) {
  if (s.grace > 0) return
  s.hearts = Math.max(0, s.hearts - damage)
  s.combo = 0
  s.grace = PLAYER.hurtGrace
  s.hurtFlash = 1
  s.shake = 0.4
  popup(s, WORLD.diverX + 20, diverY(s) - 40, `-${damage} ♥`, 'hurt')
  s.events.push('hurt')
  if (s.hearts <= 0) {
    s.over = true
    s.lockId = null
    s.events.push('over')
  }
}

export function update(s: GameState, rawDt: number) {
  const dt = Math.min(rawDt, 0.05)
  updateEffects(s, dt)
  if (s.over) return

  s.time += dt
  if (!bossAlive(s) && !s.cave) s.depth += Math.min(DESCENT.max, DESCENT.base + (s.depth / 100) * DESCENT.per100m) * dt
  const zone = ZONES.indexOf(zoneAt(s.depth))
  if (zone !== s.zone) {
    s.zone = zone
    banner(s, ZONES[zone].name, `${ZONES[zone].from} m · makin gelap, makin ramai`, 3)
    s.events.push('zone')
  }
  s.grace = Math.max(0, s.grace - dt)
  schedule(s, dt)
  updateMegalodon(s, dt)
  updateEel(s, dt)
  updateCave(s, dt)
  if (s.over) return

  for (const enemy of [...s.enemies]) {
    const type = ENEMIES[enemy.kind]
    enemy.age += dt
    enemy.flash = Math.max(0, enemy.flash - dt)
    if (type.motion === 'rise') {
      enemy.y -= enemy.speed * dt
      enemy.x = enemy.base + Math.sin(enemy.phase + enemy.age * 1.6) * type.wobble
      if (enemy.y < -50) {
        s.enemies = s.enemies.filter((other) => other !== enemy)
        if (s.lockId === enemy.id) s.lockId = null
      }
      continue
    }
    enemy.x -= enemy.speed * dt
    if (enemy.origin) {
      // Misil: lurus dari titik tembak ke penyelam.
      const t = Math.min(1, Math.max(0, (enemy.origin.x - enemy.x) / Math.max(1, enemy.origin.x - WORLD.diverX)))
      enemy.y = enemy.origin.y + (diverY(s) - enemy.origin.y) * t
    } else enemy.y = enemy.base + Math.sin(enemy.phase + enemy.age * 2.2) * type.wobble
    if (!enemy.revealed && isTypeable(enemy)) {
      enemy.revealed = true
      burst(s, enemy.x, enemy.y, 10, 'bubble', 0.6)
      s.events.push('reveal')
    }
    if (enemy.x - reachOf(enemy) <= WORLD.diverX + WORLD.reach) hurt(s, enemy)
    if (s.over) return
  }
}

// ---------- Megalodon Robot ----------

const STUN_TIME = 1.8
const CHOMP_TIME = 1.1
const DYING_TIME = 2.2
const QTE_LETTERS = 'asdfghjklqwertyuiopzxcvbnm'

const bossTop = () => WORLD.laneTop + 34
const bossBottom = () => WORLD.laneBottom - 34
const homeX = (s: GameState) => s.width - MEGALODON.homeOffset

function startMegalodon(s: GameState) {
  const round = s.kills.megalodon ?? 0
  const maxHp = MEGALODON.hp + MEGALODON.hpPerRound * round
  s.swarm = null
  s.mega = {
    phase: 'warning',
    timer: MEGALODON.warning,
    x: s.width + 220,
    y: s.height / 2,
    targetY: s.height / 2,
    hold: 0,
    fireTimer: 0,
    hp: maxHp,
    maxHp,
    thresholds: MEGALODON.qteAt.map((fraction) => Math.ceil(maxHp * fraction)),
    pendingQte: false,
    qte: null,
    rebounds: [],
    struck: false,
    hitFlash: 0,
    fired: 0,
    age: 0,
    round,
  }
  s.events.push('alarm')
  banner(s, 'SINYAL LOGAM TERDETEKSI', 'Sesuatu yang besar mendekat · ikan-ikan menyingkir', 3)
}

/** Lama diam di satu posisi: makin sedikit HP, makin gelisah. */
function holdTime(m: Megalodon): number {
  return MEGALODON.holdMin + (MEGALODON.hold - MEGALODON.holdMin) * (m.hp / m.maxHp)
}

function pickBossY(s: GameState, m: Megalodon): number {
  for (let i = 0; i < 12; i++) {
    const y = bossTop() + s.rand() * (bossBottom() - bossTop())
    if (Math.abs(y - m.y) >= 120) return y
  }
  return m.y < s.height / 2 ? bossBottom() : bossTop()
}

function fireMissile(s: GameState, m: Megalodon) {
  const missile = spawn(s, 'misil')
  const ox = m.x - 96
  const oy = m.y + 12
  missile.x = ox
  missile.y = oy
  missile.base = oy
  missile.origin = { x: ox, y: oy }
  missile.speed = MEGALODON.missileSpeed + MEGALODON.missileSpeedPerRound * m.round
  m.fired = 0.4
  s.events.push('missile')
}

/** Misil yang diketik habis berbalik ke titik tembaknya. */
function rebound(s: GameState, m: Megalodon, missile: Enemy) {
  const { x, y } = missile.origin!
  const dx = x - missile.x
  const dy = y - missile.y
  const length = Math.hypot(dx, dy) || 1
  m.rebounds.push({ x: missile.x, y: missile.y, vx: (dx / length) * MEGALODON.returnSpeed, vy: (dy / length) * MEGALODON.returnSpeed, resolved: false })
  s.events.push('deflect')
}

const targetable = (m: Megalodon) => m.phase !== 'warning' && m.phase !== 'enter' && m.phase !== 'dying'

function updateRebounds(s: GameState, m: Megalodon, dt: number) {
  const { rx, ry } = MEGALODON.hitbox
  for (const r of m.rebounds) {
    r.x += r.vx * dt
    r.y += r.vy * dt
    if (r.resolved || !targetable(m)) continue
    const nx = (r.x - m.x) / rx
    const ny = (r.y - m.y) / ry
    if (nx * nx + ny * ny <= 1) {
      r.resolved = true
      r.x = -9999
      damageBoss(s, m, 1, 'KENA! -1')
    } else if (r.x > m.x + rx * 0.4) {
      r.resolved = true
      popup(s, Math.min(s.width - 60, m.x), m.y - 70, 'MELESET', 'hurt')
      s.events.push('boss-miss')
    }
  }
  m.rebounds = m.rebounds.filter((r) => r.x > -50 && r.x < s.width + 80 && r.y > -80 && r.y < s.height + 80)
}

function damageBoss(s: GameState, m: Megalodon, amount: number, label: string) {
  m.hp = Math.max(0, m.hp - amount)
  m.hitFlash = 0.3
  s.shake = Math.max(s.shake, 0.25)
  s.score += Math.round(20 * amount * multiplierFor(s.combo))
  burst(s, m.x - 40, m.y, 16, 'spark', 1.3)
  popup(s, m.x - 20, m.y - 64, label, 'bonus')
  s.events.push('boss-hit')
  if (m.hp <= 0) {
    m.phase = 'dying'
    m.timer = DYING_TIME
    m.qte = null
    m.pendingQte = false
    // Misil yang tersisa ikut meledak.
    for (const enemy of s.enemies.filter((other) => other.kind === 'misil')) burst(s, enemy.x, enemy.y, 10, 'spark')
    s.enemies = s.enemies.filter((enemy) => enemy.kind !== 'misil')
    if (s.lockId !== null && !lockedEnemy(s)) s.lockId = null
    return
  }
  if (m.thresholds.length && m.hp <= m.thresholds[0]) {
    while (m.thresholds.length && m.hp <= m.thresholds[0]) m.thresholds.shift()
    m.pendingQte = true
  }
}

function startQte(s: GameState, m: Megalodon) {
  const { keys, keysPerRound, maxKeys, time, timePerRound, minTime, lead } = MEGALODON.qte
  const count = Math.min(maxKeys, keys + keysPerRound * m.round)
  const letters: string[] = []
  while (letters.length < count) {
    const letter = QTE_LETTERS[Math.floor(s.rand() * QTE_LETTERS.length)]
    if (letter !== letters[letters.length - 1]) letters.push(letter)
  }
  const per = Math.max(minTime, time + timePerRound * m.round)
  m.phase = 'qte'
  m.pendingQte = false
  m.qte = { keys: letters, index: 0, timer: per + lead, per }
  s.lockId = null
  s.events.push('qte')
}

function qteKey(s: GameState, m: Megalodon, c: string) {
  const qte = m.qte!
  if (c !== qte.keys[qte.index]) {
    failQte(s, m)
    return
  }
  qte.index++
  qte.timer = qte.per
  s.events.push('qte-key')
  if (qte.index < qte.keys.length) return
  m.qte = null
  m.phase = 'stunned'
  m.timer = STUN_TIME
  s.events.push('qte-win')
  burst(s, m.x - 110, m.y, 14, 'bubble', 1.2)
  damageBoss(s, m, MEGALODON.qte.damage, `TERPENTAL! -${MEGALODON.qte.damage}`)
}

function failQte(s: GameState, m: Megalodon) {
  m.qte = null
  m.phase = 'chomp'
  m.timer = CHOMP_TIME
  m.struck = false
  s.combo = 0
  s.errors++
  s.events.push('qte-fail')
}

function finishMegalodon(s: GameState, m: Megalodon) {
  s.mega = null
  s.kills.megalodon = (s.kills.megalodon ?? 0) + 1
  s.combo++
  s.bestCombo = Math.max(s.bestCombo, s.combo)
  const points = Math.round((ENEMIES.megalodon.points + s.depth * DEPTH_POINTS) * multiplierFor(s.combo))
  s.score += points
  popup(s, m.x, m.y - 30, `+${points}`)
  burst(s, m.x, m.y, 40, 'bubble', 2)
  s.spawnTimer = 1.6
  banner(s, 'MEGALODON HANCUR!', 'Lanjut menyelam', 2.4)
  s.events.push('boss-down')
}

function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step)
}

function updateMegalodon(s: GameState, dt: number) {
  const m = s.mega
  if (!m) return
  m.age += dt
  m.timer -= dt
  m.hitFlash = Math.max(0, m.hitFlash - dt)
  m.fired = Math.max(0, m.fired - dt)
  updateRebounds(s, m, dt)
  if (s.mega !== m) return
  const home = homeX(s)

  // Gelembung mesin dari ekor
  if (m.phase !== 'warning' && s.rand() < dt * 9) {
    const life = 0.8 + s.rand() * 0.6
    s.particles.push({ x: m.x + 120, y: m.y + (s.rand() - 0.5) * 16, vx: 60 + s.rand() * 50, vy: -10 - s.rand() * 30, r: 1.5 + s.rand() * 3, life, max: life, kind: 'bubble' })
  }

  switch (m.phase) {
    case 'warning':
      if (m.timer <= 0 && !s.enemies.some((enemy) => ENEMIES[enemy.kind].damage > 0)) {
        m.phase = 'enter'
        m.x = s.width + 220
        s.events.push('boss')
        banner(s, 'MEGALODON ROBOT!', 'Ketik misilnya untuk memantulkan ke bos · kena kalau ia masih di jalurnya', 3.4)
      }
      break
    case 'enter':
      m.x = Math.max(home, m.x - 240 * dt)
      if (m.x <= home) {
        m.phase = 'fight'
        m.hold = holdTime(m)
        m.fireTimer = 0.8
      }
      break
    case 'fight': {
      m.x = approach(m.x, home, 200 * dt)
      if (m.pendingQte) {
        // Bersiap menggigit setelah misil di layar habis.
        if (!s.enemies.some((enemy) => enemy.kind === 'misil')) startQte(s, m)
        break
      }
      if (Math.abs(m.targetY - m.y) > 0.5) {
        m.y = approach(m.y, m.targetY, (MEGALODON.moveSpeed + MEGALODON.moveSpeedPerRound * m.round) * dt)
        break
      }
      m.hold -= dt
      m.fireTimer -= dt
      const missiles = s.enemies.filter((enemy) => enemy.kind === 'misil').length
      const max = MEGALODON.maxMissiles + (m.round >= MEGALODON.threeMissilesFromRound ? 1 : 0)
      if (m.fireTimer <= 0 && missiles < max && m.hold > MEGALODON.fireCutoff) {
        fireMissile(s, m)
        m.fireTimer = MEGALODON.fireEvery
      }
      if (m.hold <= 0) {
        m.targetY = pickBossY(s, m)
        m.hold = holdTime(m)
        m.fireTimer = MEGALODON.fireDelay
      }
      break
    }
    case 'qte': {
      // Mundur sedikit, siap menerjang.
      m.x = approach(m.x, home + 40, 120 * dt)
      m.y = approach(m.y, diverY(s), 140 * dt)
      const qte = m.qte!
      qte.timer -= dt
      if (qte.timer <= 0) failQte(s, m)
      break
    }
    case 'stunned':
      m.x = approach(m.x, home + 30, 60 * dt)
      if (m.timer <= 0) {
        m.phase = 'fight'
        m.targetY = pickBossY(s, m)
        m.hold = holdTime(m)
        m.fireTimer = MEGALODON.fireDelay
      }
      break
    case 'chomp': {
      // Menerjang ke penyelam lalu kembali.
      const t = 1 - Math.max(0, m.timer) / CHOMP_TIME
      const reach = WORLD.diverX + 150
      m.x = home - (home - reach) * Math.sin(Math.PI * Math.min(1, t))
      m.y = approach(m.y, diverY(s), 300 * dt)
      if (!m.struck && t >= 0.5) {
        m.struck = true
        burst(s, WORLD.diverX + 30, diverY(s), 14, 'spark', 1.2)
        s.grace = 0
        damagePlayer(s, 1)
      }
      if (m.timer <= 0) {
        m.phase = 'fight'
        m.x = home
        m.targetY = pickBossY(s, m)
        m.hold = holdTime(m)
        m.fireTimer = MEGALODON.fireDelay
      }
      break
    }
    case 'dying':
      m.y += 30 * dt
      if (s.rand() < dt * 10) burst(s, m.x + (s.rand() - 0.5) * 200, m.y + (s.rand() - 0.5) * 60, 8, 'spark', 1.1)
      if (m.timer <= 0) finishMegalodon(s, m)
      break
  }
}

// ---------- Belut Listrik ----------

const ENTER_PAUSE = 1.2
const RELEASE_TIME = 0.9
const ZAP_TIME = 1.2
const SHOCK_TIME = 1.3
const EEL_DYING = 2.2

const eelHome = (s: GameState) => s.width - EEL.homeOffset
const eelLength = (e: EelBoss) => Math.min(EEL.maxLength, EEL.length + e.wins + e.round)

function startEel(s: GameState) {
  const round = s.kills.listrik ?? 0
  const maxHp = EEL.hp + EEL.hpPerRound * round
  s.swarm = null
  s.eel = {
    phase: 'warning',
    timer: EEL.warning,
    x: s.width + 220,
    y: s.height / 2,
    hp: maxHp,
    maxHp,
    round,
    wins: 0,
    sequence: [],
    shown: 0,
    index: 0,
    orbs: [],
    speed: 0,
    peek: 0,
    wrong: 0,
    hitFlash: 0,
    age: 0,
  }
  s.events.push('alarm')
  banner(s, 'ARUS LISTRIK TERDETEKSI', 'Sesuatu bermuatan mendekat · ikan-ikan menyingkir', 3)
}

/** Urutan baru (huruf tidak berulang), lalu mulai ditunjukkan satu per satu. */
function newSequence(s: GameState, e: EelBoss) {
  const pool = EEL.letters.split('')
  const sequence: string[] = []
  while (sequence.length < eelLength(e)) sequence.push(pool.splice(Math.floor(s.rand() * pool.length), 1)[0])
  e.sequence = sequence
  e.shown = 1
  e.index = 0
  e.orbs = []
  e.peek = 0
  e.phase = 'show'
  e.timer = EEL.reveal
  s.events.push('memory')
}

/** Bola dilepas ke posisi acak (berjauhan satu sama lain), di antara penyelam dan bos. */
function releaseOrbs(s: GameState, e: EelBoss) {
  const minX = s.width * 0.4
  const maxX = Math.max(minX + 80, e.x - 120)
  const top = WORLD.laneTop + 60
  const bottom = WORLD.laneBottom - 10
  const placed: { x: number; y: number }[] = []
  for (const letter of e.sequence) {
    let best = { x: minX, y: top }
    let bestGap = -1
    for (let i = 0; i < 24; i++) {
      const candidate = { x: minX + s.rand() * (maxX - minX), y: top + s.rand() * (bottom - top) }
      const gap = Math.min(999, ...placed.map((p) => Math.hypot(p.x - candidate.x, p.y - candidate.y)))
      if (gap > bestGap) {
        best = candidate
        bestGap = gap
      }
      if (gap > 110) break
    }
    placed.push(best)
    e.orbs.push({ letter, x: e.x - 40, y: e.y, tx: best.x, ty: best.y, done: false, flash: 0, phase: s.rand() * Math.PI * 2 })
  }
  e.phase = 'release'
  e.timer = RELEASE_TIME
  s.events.push('release-orbs')
}

function memoryKey(s: GameState, e: EelBoss, c: string) {
  if (e.phase !== 'orbs') return
  if (c === e.sequence[e.index]) {
    const orb = e.orbs.find((o) => o.letter === c)!
    orb.done = true
    e.index++
    s.correct++
    s.events.push('zap')
    s.bolts.push({ x: WORLD.diverX + 18, y: diverY(s) - 4, tx: orb.x, ty: orb.y, t: 0 })
    burst(s, orb.x, orb.y, 12, 'volt', 0.8)
    if (e.index < e.sequence.length) return
    // Urutan lengkap: petir balik menyambar bos.
    e.phase = 'zap'
    e.timer = ZAP_TIME
    e.wins++
    e.hp = Math.max(0, e.hp - 1)
    e.hitFlash = 0.4
    s.combo++
    s.bestCombo = Math.max(s.bestCombo, s.combo)
    const points = Math.round(EEL.pointsPerLetter * e.sequence.length * multiplierFor(s.combo))
    s.score += points
    s.shake = Math.max(s.shake, 0.3)
    popup(s, e.x - 30, e.y - 70, `URUTAN BENAR! +${points}`, 'bonus')
    burst(s, e.x - 30, e.y, 20, 'volt', 1.4)
    s.events.push('boss-hit')
    return
  }
  // Salah: kombo putus dan semua bola melompat mendekat.
  s.errors++
  s.combo = 0
  e.wrong = 0.35
  for (const orb of e.orbs) {
    if (orb.done) continue
    orb.x -= EEL.wrongPush
    orb.flash = 0.3
  }
  s.events.push('error')
}

function updateEel(s: GameState, dt: number) {
  const e = s.eel
  if (!e) return
  e.age += dt
  e.timer -= dt
  e.peek = Math.max(0, e.peek - dt)
  e.wrong = Math.max(0, e.wrong - dt)
  e.hitFlash = Math.max(0, e.hitFlash - dt)
  if (e.phase !== 'warning' && e.phase !== 'enter' && e.phase !== 'dying') {
    e.x += (eelHome(s) - e.x) * Math.min(1, dt * 3)
    e.y = s.height / 2 + 20 + Math.sin(e.age * 0.7) * 50
  }

  switch (e.phase) {
    case 'warning':
      if (e.timer <= 0 && !s.enemies.some((enemy) => ENEMIES[enemy.kind].damage > 0)) {
        e.phase = 'enter'
        e.timer = 99
        s.events.push('boss')
        banner(s, 'BELUT LISTRIK!', 'Ingat urutan hurufnya, lalu ketik dari ingatan', 2.4)
      }
      break
    case 'enter':
      e.x = Math.max(eelHome(s), e.x - 260 * dt)
      e.y = s.height / 2 + 20
      if (e.x <= eelHome(s) && e.timer > ENTER_PAUSE) e.timer = ENTER_PAUSE
      if (e.timer <= 0) newSequence(s, e)
      break
    case 'show':
      if (e.timer > 0) break
      if (e.shown < e.sequence.length) {
        e.shown++
        e.timer = EEL.reveal
        s.events.push('memory')
      } else {
        e.phase = 'memorize'
        e.timer = Math.max(EEL.minHold, EEL.hold + EEL.holdPerWin * e.wins)
      }
      break
    case 'memorize':
      if (e.timer <= 0) releaseOrbs(s, e)
      break
    case 'release': {
      const t = 1 - Math.max(0, e.timer) / RELEASE_TIME
      const ease = 1 - (1 - t) ** 3
      for (const orb of e.orbs) {
        orb.x = e.x - 40 + (orb.tx - (e.x - 40)) * ease
        orb.y = e.y + (orb.ty - e.y) * ease
      }
      if (e.timer <= 0) {
        e.phase = 'orbs'
        const front = Math.min(...e.orbs.map((orb) => orb.tx))
        const time = (EEL.time + EEL.timePerLetter * e.sequence.length) * Math.max(0.5, 1 - EEL.roundSpeedup * e.round)
        e.speed = Math.max(10, (front - (WORLD.diverX + WORLD.reach + 14)) / time)
      }
      break
    }
    case 'orbs':
      for (const orb of e.orbs) {
        orb.flash = Math.max(0, orb.flash - dt)
        if (orb.done) continue
        orb.x -= e.speed * dt
        orb.y = orb.ty + Math.sin(e.age * 2 + orb.phase) * 6
        if (orb.x <= WORLD.diverX + WORLD.reach + 14) {
          // Bola sampai: semua bola tersisa meledak menyetrum penyelam.
          for (const other of e.orbs) if (!other.done) burst(s, other.x, other.y, 10, 'volt')
          e.orbs = []
          e.phase = 'shock'
          e.timer = SHOCK_TIME
          s.combo = 0
          s.grace = 0
          damagePlayer(s, 1)
          s.events.push('shock')
          return
        }
      }
      break
    case 'zap':
      if (e.timer <= 0) {
        if (e.hp <= 0) {
          e.phase = 'dying'
          e.timer = EEL_DYING
        } else newSequence(s, e)
      }
      break
    case 'shock':
      if (e.timer <= 0) newSequence(s, e)
      break
    case 'dying':
      e.y += 28 * dt
      if (s.rand() < dt * 10) burst(s, e.x + s.rand() * 200 - 40, e.y + (s.rand() - 0.5) * 60, 8, 'volt', 1.1)
      if (e.timer <= 0) finishEel(s, e)
      break
  }
}

function finishEel(s: GameState, e: EelBoss) {
  s.eel = null
  s.kills.listrik = (s.kills.listrik ?? 0) + 1
  const points = Math.round((ENEMIES.listrik.points + s.depth * DEPTH_POINTS) * multiplierFor(s.combo))
  s.score += points
  popup(s, e.x, e.y - 30, `+${points}`)
  burst(s, e.x, e.y, 36, 'bubble', 2)
  s.spawnTimer = 1.6
  banner(s, 'BELUT LISTRIK KALAH!', 'Lanjut menyelam', 2.4)
  s.events.push('boss-down')
}

// ---------- Arus Gua ----------

/** Tombol arah ditekan / dilepas. */
export function steer(s: GameState, direction: Direction, on: boolean) {
  s.steer[direction] = on
}

/** Sentuhan/klik yang ditahan (koordinat dunia), atau null saat dilepas. */
export function setPointer(s: GameState, point: { x: number; y: number } | null) {
  s.pointer = point
}

/** Melepas semua kontrol arah (misalnya saat dijeda), supaya penyelam tidak terus bergerak. */
export function releaseSteer(s: GameState) {
  s.steer = { up: false, down: false, left: false, right: false }
  s.pointer = null
}

function caveHit(s: GameState, cave: Cave, x: number, y: number) {
  if (s.grace > 0) return
  cave.hits++
  burst(s, x, y, 14, 'spark', 1.1)
  damagePlayer(s, 1)
  s.grace = CAVE.grace
}

function moveDiver(s: GameState, cave: Cave, dt: number) {
  let dx = (s.steer.right ? 1 : 0) - (s.steer.left ? 1 : 0)
  let dy = (s.steer.down ? 1 : 0) - (s.steer.up ? 1 : 0)
  if (s.pointer) {
    // Layar sentuh: berenang menuju jari (pelan saat sudah dekat).
    const px = s.pointer.x - cave.x
    const py = s.pointer.y - cave.y
    const length = Math.hypot(px, py)
    const pull = Math.min(1, length / 60)
    dx = length > 4 ? (px / length) * pull : 0
    dy = length > 4 ? (py / length) * pull : 0
  } else if (dx && dy) {
    dx *= Math.SQRT1_2
    dy *= Math.SQRT1_2
  }
  const response = Math.min(1, dt * 10)
  cave.vx += (dx * CAVE.diverSpeed - cave.vx) * response
  cave.vy += (dy * CAVE.diverSpeed - cave.vy) * response
  cave.x = Math.max(50, Math.min(s.width * 0.62, cave.x + cave.vx * dt))
  cave.y = Math.max(CAVE_TOP + 10, Math.min(s.height - 10, cave.y + cave.vy * dt))

  // Dinding padat: penyelam didorong keluar dari batu, dan tergores kalau menyentuhnya.
  for (const probe of DIVER_PROBES) {
    const { top, bottom } = wallsAt(cave, cave.dist + cave.x + probe.dx)
    const y = cave.y + probe.dy
    if (y - probe.r < top) {
      cave.y += top - (y - probe.r)
      cave.vy = Math.max(cave.vy, 60)
      caveHit(s, cave, cave.x + probe.dx, top)
    } else if (y + probe.r > bottom) {
      cave.y -= y + probe.r - bottom
      cave.vy = Math.min(cave.vy, -60)
      caveHit(s, cave, cave.x + probe.dx, bottom)
    }
  }
}

function updateHazards(s: GameState, cave: Cave, dt: number) {
  for (const h of cave.hazards) {
    const x = h.wx - cave.dist
    if (x < -120 || x > s.width + 120) continue
    if (h.kind === 'moray') {
      // Mulai mengintip saat penyelam ±1 detik lagi sampai.
      if (h.t < 0 && x - cave.x < cave.speed * 1.0 + 40) {
        h.t = 0
        s.events.push('eel')
      } else if (h.t >= 0) h.t += dt
    }
    if (h.done) continue
    const circles = hazardCircles(cave, h)
    const pickup = h.kind === 'pearl' || h.kind === 'oxygen'
    const touch = circles.some((c) =>
      // Rintangan sedikit memaafkan (badan penyelam dihitung 80%), hadiah sebaliknya mudah diambil.
      DIVER_PROBES.some((p) => Math.hypot(cave.x + p.dx - c.x, cave.y + p.dy - c.y) < c.r + (pickup ? p.r + 10 : p.r * 0.8)),
    )
    if (!touch) continue
    if (h.kind === 'oxygen') {
      h.done = true
      burst(s, circles[0].x, circles[0].y, 14, 'bubble', 0.8)
      if (s.hearts < PLAYER.maxHearts) {
        s.hearts++
        popup(s, circles[0].x, circles[0].y - 20, '+1 ♥', 'heal')
        s.events.push('heal')
      } else {
        s.score += CAVE.oxygenPoints
        popup(s, circles[0].x, circles[0].y - 20, `+${CAVE.oxygenPoints}`, 'bonus')
        s.events.push('pickup')
      }
    } else if (h.kind === 'pearl') {
      h.done = true
      cave.pearls++
      const points = Math.round(CAVE.pearlPoints * multiplierFor(s.combo))
      s.score += points
      popup(s, circles[0].x, circles[0].y - 16, `+${points}`, 'bonus')
      burst(s, circles[0].x, circles[0].y, 8, 'bubble', 0.6)
      s.events.push('pickup')
    } else if (s.grace <= 0) {
      caveHit(s, cave, cave.x + 10, cave.y)
      // Dorong menjauh dari rintangan.
      const c = circles[circles.length - 1]
      cave.vy = (cave.y < c.y ? -1 : 1) * 260
      cave.vx = -120
    }
  }
}

function updateCave(s: GameState, dt: number) {
  const cave = s.cave
  if (!cave) return
  cave.age += dt
  cave.timer -= dt
  switch (cave.phase) {
    case 'warning':
      if (cave.timer <= 0 && !s.enemies.some((enemy) => ENEMIES[enemy.kind].damage > 0)) {
        // Bonus yang masih naik ikut hilang (gelembung pecah).
        for (const enemy of s.enemies) burst(s, enemy.x, enemy.y, 10)
        s.enemies = []
        s.lockId = null
        cave.phase = 'run'
        cave.x = WORLD.diverX
        cave.y = diverY(s)
        s.events.push('cave-start')
        banner(s, 'ARUS GUA!', 'Gerak dengan ← ↑ → ↓ / WASD (atau tahan & geser di layar) · hindari dinding dan penghuninya', 3.4)
      }
      break
    case 'run':
      cave.dist += cave.speed * dt
      moveDiver(s, cave, dt)
      if (s.over) return
      updateHazards(s, cave, dt)
      if (cave.dist >= cave.end) {
        cave.phase = 'exit'
        cave.timer = 1.1
      }
      break
    case 'exit': {
      // Mulut gua: arus mereda, penyelam kembali ke posisinya lalu lanjut turun.
      cave.dist += cave.speed * dt * Math.max(0, cave.timer)
      const pull = Math.min(1, dt * 4)
      cave.x += (WORLD.diverX - cave.x) * pull
      cave.y += (diverY(s) - cave.y) * pull
      if (cave.timer <= 0) finishCave(s, cave)
      break
    }
  }
}

function finishCave(s: GameState, cave: Cave) {
  s.cave = null
  s.caveCount++
  releaseSteer(s)
  const perfect = cave.hits === 0
  const points = Math.round((CAVE.bonus + s.depth * CAVE.bonusPerMeter) * (perfect ? 2 : 1))
  s.score += points
  popup(s, WORLD.diverX + 40, diverY(s) - 50, `+${points}`, 'bonus')
  if (perfect && s.sonar < PLAYER.maxSonar) {
    s.sonar++
    popup(s, WORLD.diverX + 40, diverY(s) - 76, '+1 SONAR', 'bonus')
  }
  s.spawnTimer = 1.4
  banner(s, perfect ? 'LOLOS TANPA GORESAN!' : 'LOLOS DARI GUA!', `${cave.pearls} mutiara · ${perfect ? 'bonus ×2' : `${cave.hits}× tergores`}`, 2.6)
  s.events.push('cave-clear')
}

/** Partikel, tombak, teks melayang, dan efek layar; tetap berjalan setelah permainan selesai. */
function updateEffects(s: GameState, dt: number) {
  s.hurtFlash = Math.max(0, s.hurtFlash - dt * 2)
  s.shake = Math.max(0, s.shake - dt)
  if (s.sonarWave !== null) s.sonarWave = s.sonarWave + dt * 1.4 >= 1 ? null : s.sonarWave + dt * 1.4
  if (s.banner) s.banner = s.banner.time - dt <= 0 ? null : { ...s.banner, time: s.banner.time - dt }

  // Gelembung napas penyelam
  s.bubbleTimer -= dt
  if (!s.over && s.bubbleTimer <= 0) {
    s.bubbleTimer = 0.9 + s.rand() * 0.8
    const diver = diverAt(s)
    for (let i = 0; i < 3; i++) {
      const life = 1.6 + s.rand()
      s.particles.push({ x: diver.x + 14, y: diver.y - 18, vx: (s.rand() - 0.5) * 14, vy: -40 - s.rand() * 30 - i * 12, r: 1.5 + s.rand() * 2.5, life, max: life, kind: 'bubble' })
    }
  }

  for (const p of s.particles) {
    p.life -= dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 1 - dt * 2.5
    // Gelembung naik, tinta menyebar pelan.
    p.vy = p.kind === 'bubble' ? p.vy * (1 - dt * 1.5) - 60 * dt : p.vy * (1 - dt * 3)
  }
  s.particles = s.particles.filter((p) => p.life > 0)
  for (const bolt of s.bolts) bolt.t += dt / 0.12
  s.bolts = s.bolts.filter((bolt) => bolt.t < 1)
  for (const p of s.popups) {
    p.life -= dt * 1.1
    p.y -= 34 * dt
  }
  s.popups = s.popups.filter((p) => p.life > 0)
}

export interface Summary {
  depth: number
  time: number
  score: number
  wpm: number
  accuracy: number
  kills: number
  bestCombo: number
  byKind: Partial<Record<EnemyKind, number>>
}

export function summary(s: GameState): Summary {
  return {
    depth: Math.floor(s.depth),
    time: s.time,
    score: s.score,
    wpm: wpm(s),
    accuracy: accuracy(s),
    kills: totalKills(s),
    bestCombo: s.bestCombo,
    byKind: { ...s.kills },
  }
}
