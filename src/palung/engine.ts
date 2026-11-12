import {
  DEPTH_POINTS,
  DESCENT,
  difficultyAt,
  ENEMIES,
  EVENTS,
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
const bossAlive = (s: GameState) => s.enemies.some((enemy) => enemy.kind === 'kraken')

function banner(s: GameState, title: string, subtitle: string, time = 2.6) {
  s.banner = { title, subtitle, time }
}

function schedule(s: GameState, dt: number) {
  const boss = bossAlive(s)

  if (!boss && s.depth >= s.next.boss) {
    s.bossCount++
    spawn(s, 'kraken', [...BOSS_PHRASES[(s.bossCount - 1) % BOSS_PHRASES.length]])
    s.next.boss = nextBossDepth(s.next.boss)
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
  if (!target || s.over) return
  target.progress = 0
  s.lockId = null
  s.events.push('release')
}

/** Enter: Sonar menghancurkan semua musuh biasa dan teri di layar (tanpa kombo). */
export function fireSonar(s: GameState) {
  if (s.over) return
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
  if (s.grace > 0) return
  const damage = ENEMIES[enemy.kind].damage
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
    enemy.y = enemy.base + Math.sin(enemy.phase + enemy.age * 2.2) * type.wobble
    if (!enemy.revealed && isTypeable(enemy)) {
      enemy.revealed = true
      burst(s, enemy.x, enemy.y, 10, 'bubble', 0.6)
      s.events.push('reveal')
    }
    if (enemy.x - reachOf(enemy) <= WORLD.diverX + WORLD.reach) hurt(s, enemy)
    if (s.over) return
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
