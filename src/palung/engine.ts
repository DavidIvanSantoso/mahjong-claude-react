import {
  DEPTH_POINTS,
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
  kind: 'bubble' | 'ink' | 'spark'
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
  | 'zone'
  | 'over'

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
  next: { swarm: number; oxygen: number; mutiara: number; boss: number }
  bossCount: number
  mega: Megalodon | null
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
    next: { swarm: EVENTS.swarm.firstAt, oxygen: EVENTS.oxygen.firstAt, mutiara: EVENTS.mutiara.firstAt, boss: nextBossDepth(0) },
    bossCount: 0,
    mega: null,
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
const bossAlive = (s: GameState) => s.mega !== null || s.enemies.some((enemy) => enemy.kind === 'kraken')

function banner(s: GameState, title: string, subtitle: string, time = 2.6) {
  s.banner = { title, subtitle, time }
}

function schedule(s: GameState, dt: number) {
  // Selama Megalodon: tidak ada yang muncul sama sekali.
  if (s.mega) return
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
    spawn(s, 'kraken', [...BOSS_PHRASES[(s.kills.kraken ?? 0) % BOSS_PHRASES.length]])
    s.events.push('boss')
    banner(s, 'KRAKEN MENGHADANG!', 'Ketik semua katanya berurutan · penyelam berhenti turun', 3)
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
  if (s.over || !/^[a-z]$/.test(c)) return
  if (s.mega?.qte) {
    qteKey(s, s.mega, c)
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
  if (!target || s.over || s.mega?.qte) return
  target.progress = 0
  s.lockId = null
  s.events.push('release')
}

/** Enter: Sonar menghancurkan semua musuh biasa dan teri di layar (tanpa kombo). */
export function fireSonar(s: GameState) {
  if (s.over || s.mega?.qte) return
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
  if (!bossAlive(s)) s.depth += Math.min(DESCENT.max, DESCENT.base + (s.depth / 100) * DESCENT.per100m) * dt
  const zone = ZONES.indexOf(zoneAt(s.depth))
  if (zone !== s.zone) {
    s.zone = zone
    banner(s, ZONES[zone].name, `${ZONES[zone].from} m · makin gelap, makin ramai`, 3)
    s.events.push('zone')
  }
  s.grace = Math.max(0, s.grace - dt)
  schedule(s, dt)
  updateMegalodon(s, dt)
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
    for (let i = 0; i < 3; i++) {
      const life = 1.6 + s.rand()
      s.particles.push({ x: WORLD.diverX + 14, y: diverY(s) - 18, vx: (s.rand() - 0.5) * 14, vy: -40 - s.rand() * 30 - i * 12, r: 1.5 + s.rand() * 2.5, life, max: life, kind: 'bubble' })
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
