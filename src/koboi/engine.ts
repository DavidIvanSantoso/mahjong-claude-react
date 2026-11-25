import { ARENA, BOSS, DASH, INCOMPATIBLE, INTRO_ORDER, levelFor, PATTERN_NAMES, PLAYER, RECOVERY, SCORE, TIMING, waveShape, type PatternId } from './config'
import { PATTERNS } from './patterns'
import {
  ARENA_BOTTOM,
  ARENA_RIGHT,
  inArena,
  mulberry32,
  spawnShot,
  newPlayer,
  puff,
  segmentDistance,
  type GameState,
  type Hazard,
  type Mode,
} from './state'

/**
 * Mesin KOBOI (tanpa DOM): gerak jiwa, dash, peluru, hazard, tabrakan, penjadwal gelombang, bos, dan
 * skor. Dipanggil tiap frame oleh KoboiGame.tsx; React tidak menyimpan state permainan.
 */

export type { GameState } from './state'

export interface Summary {
  mode: Mode
  score: number
  time: number
  wave: number
  hits: number
  dodged: number
  perfectWaves: number
  won: boolean
  bossHp: number
}

export function createGame(mode: Mode, dashEnabled: boolean, seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  return {
    mode,
    seed,
    rand: mulberry32(seed),
    phase: 'countdown',
    phaseTime: 0,
    phaseLength: TIMING.countdown,
    time: 0,
    player: newPlayer(),
    input: { up: false, down: false, left: false, right: false },
    dashEnabled,
    shots: [],
    hazards: [],
    particles: [],
    runs: [],
    queue: [],
    recent: [],
    wave: mode === 'endless' ? 1 : 0,
    waveHits: 0,
    score: 0,
    hits: 0,
    dodged: 0,
    perfectWaves: 0,
    boss: mode === 'boss' ? { hp: BOSS.hp, maxHp: BOSS.hp, phase: 0, attacks: 0, hurt: 0, draw: 0 } : null,
    duel: null,
    banner: mode === 'boss' ? { title: 'DUEL!', subtitle: `${BOSS.name} menantangmu`, time: 0, total: TIMING.countdown } : { title: 'GELOMBANG 1', subtitle: 'Bertahan hidup!', time: 0, total: TIMING.countdown },
    shake: 0,
    flash: 0,
    events: [],
    over: false,
  }
}

// ---------- Input ----------

export type Direction = 'up' | 'down' | 'left' | 'right'

export function setInput(s: GameState, direction: Direction, on: boolean) {
  s.input[direction] = on
}

export function releaseInput(s: GameState) {
  s.input = { up: false, down: false, left: false, right: false }
}

export function dash(s: GameState) {
  const p = s.player
  if (!s.dashEnabled || s.over || p.dashCooldown > 0 || s.phase === 'countdown' || s.phase === 'duel') return
  let dx = Number(s.input.right) - Number(s.input.left)
  let dy = Number(s.input.down) - Number(s.input.up)
  if (!dx && !dy) {
    dx = p.faceX
    dy = p.faceY
  }
  const len = Math.hypot(dx, dy) || 1
  p.dashX = dx / len
  p.dashY = dy / len
  p.dash = DASH.duration
  p.dashCooldown = DASH.cooldown
  s.events.push('dash')
}

/** Tombol tembak saat duel cepat (Spasi/Enter/klik). */
export function draw(s: GameState) {
  const duel = s.duel
  if (!duel || duel.result || s.phase !== 'duel') return
  if (duel.t < duel.signal) {
    duel.result = 'early'
    duel.show = 1.4
    hurtPlayer(s, BOSS.earlyPenalty, true)
    s.events.push('duel-fail')
    return
  }
  duel.reaction = duel.t - duel.signal
  duel.result = duel.reaction <= BOSS.duelFast ? 'fast' : 'hit'
  duel.show = 1.4
  damageBoss(s, duel.result === 'fast' ? BOSS.duelFastDamage : BOSS.duelDamage)
  s.events.push('duel-win')
}

// ---------- Update ----------

export function update(s: GameState, rawDt: number) {
  // Jeda panjang (pindah tab) tidak boleh membuat peluru melompat.
  const dt = Math.min(0.05, Math.max(0, rawDt))
  if (s.over) {
    updateParticles(s, dt)
    return
  }
  s.time += dt
  s.phaseTime += dt
  s.shake = Math.max(0, s.shake - dt * 2.5)
  s.flash = Math.max(0, s.flash - dt * 3)
  if (s.banner) {
    s.banner.time += dt
    if (s.banner.time >= s.banner.total) s.banner = null
  }
  if (s.boss) {
    s.boss.hurt = Math.max(0, s.boss.hurt - dt)
    s.boss.draw = Math.max(0, s.boss.draw - dt)
  }

  updatePlayer(s, dt)
  if (s.phase !== 'countdown') {
    // Skor waktu bertahan dihitung sepanjang permainan (kecuali hitung mundur).
    s.score += SCORE.perSecond * dt
  }
  for (const run of s.runs) run.step(dt)
  updateShots(s, dt)
  updateHazards(s, dt)
  updateParticles(s, dt)
  if (s.phase === 'duel') updateDuel(s, dt)
  schedule(s)
}

function updatePlayer(s: GameState, dt: number) {
  const p = s.player
  p.invuln = Math.max(0, p.invuln - dt)
  p.dashCooldown = Math.max(0, p.dashCooldown - dt)
  let vx = Number(s.input.right) - Number(s.input.left)
  let vy = Number(s.input.down) - Number(s.input.up)
  const len = Math.hypot(vx, vy)
  if (len) {
    vx /= len
    vy /= len
    p.faceX = vx
    p.faceY = vy
  }
  // Saat duel cepat jiwa tidak bergerak (fokus pada aba-aba).
  const frozen = s.phase === 'duel'
  let speed = frozen ? 0 : PLAYER.speed
  if (p.dash > 0) {
    p.dash -= dt
    vx = p.dashX
    vy = p.dashY
    speed = PLAYER.speed * DASH.boost
    p.trail.push({ x: p.x, y: p.y, age: 0 })
  }
  p.x = Math.max(ARENA.x + 8, Math.min(ARENA_RIGHT - 8, p.x + vx * speed * dt))
  p.y = Math.max(ARENA.y + 8, Math.min(ARENA_BOTTOM - 8, p.y + vy * speed * dt))
  // Hadap gambar koboi: kiri/kanan kalau ada komponen mendatar, selain itu atas/bawah.
  p.moving = len > 0 && !frozen
  if (len) {
    if (Math.abs(vx) >= 0.38) {
      p.view = 'side'
      p.flip = vx < 0
    } else {
      p.view = vy < 0 ? 'up' : 'down'
    }
  }
  for (const point of p.trail) point.age += dt
  p.trail = p.trail.filter((point) => point.age < 0.25)
}

function vulnerable(s: GameState): boolean {
  const p = s.player
  return p.invuln <= 0 && !(DASH.invulnerable && p.dash > 0) && s.phase !== 'countdown'
}

function hurtPlayer(s: GameState, amount: number, force = false) {
  const p = s.player
  if (!force && !vulnerable(s)) return
  p.hp = Math.max(0, p.hp - amount)
  p.invuln = PLAYER.invuln
  s.hits++
  s.waveHits++
  s.shake = Math.min(1, s.shake + 0.55)
  s.flash = 1
  puff(s, p.x, p.y, 14, '#ffd36b', 'spark', 140, 3)
  s.events.push('hit')
  if (p.hp <= 0) endGame(s, false)
}

function damageBoss(s: GameState, amount: number) {
  const boss = s.boss
  if (!boss) return
  boss.hp = Math.max(0, boss.hp - amount)
  boss.hurt = 0.5
  s.events.push('boss-hurt')
  if (boss.hp <= 0) endGame(s, true)
}

function endGame(s: GameState, won: boolean) {
  s.over = true
  s.phase = won ? 'won' : 'over'
  s.phaseTime = 0
  s.runs = []
  if (won) {
    s.score += SCORE.boss + Math.max(0, 180 - s.time) * SCORE.bossTime
    s.banner = { title: 'MENANG!', subtitle: `${BOSS.name} tumbang`, time: 0, total: 3 }
    for (const shot of s.shots) shot.alive = false
    s.hazards = []
    s.events.push('win')
  } else {
    s.events.push('over')
  }
  s.score = Math.round(s.score)
}

function updateShots(s: GameState, dt: number) {
  const p = s.player
  for (const shot of s.shots) {
    if (!shot.alive) continue
    shot.age += dt
    shot.vx += shot.ax * dt
    shot.vy += (shot.kind === 'tumbleweed' ? 0 : shot.ay) * dt
    shot.x += shot.vx * dt
    if (shot.kind === 'tumbleweed') {
      // Semak bergulir dan melompat kecil; jalurnya melengkung pelan.
      shot.baseY += shot.ay * dt
      shot.y = shot.baseY - Math.abs(Math.sin(shot.age * 5.5)) * shot.hop
      if (Math.abs(Math.sin(shot.age * 5.5)) < 0.08 && s.rand() < 0.3) puff(s, shot.x, shot.baseY + shot.r * 0.7, 1, 'rgba(214, 170, 110, 0.6)', 'dust', 20, 3)
    } else {
      shot.y += shot.vy * dt
    }
    if (inArena(shot.x, shot.y)) shot.entered = true

    // Pantulan di dinding arena
    if (shot.bounces > 0) {
      let bounced = false
      if (shot.x < ARENA.x || shot.x > ARENA_RIGHT) {
        shot.vx = -shot.vx
        shot.x = Math.max(ARENA.x, Math.min(ARENA_RIGHT, shot.x))
        bounced = true
      }
      if (shot.y < ARENA.y || shot.y > ARENA_BOTTOM) {
        shot.vy = -shot.vy
        shot.y = Math.max(ARENA.y, Math.min(ARENA_BOTTOM, shot.y))
        bounced = true
      }
      if (bounced) {
        shot.bounces--
        puff(s, shot.x, shot.y, 4, '#ffe2a0', 'spark', 80, 2)
        s.events.push('ping')
      }
    }

    if (Math.hypot(shot.x - p.x, shot.y - p.y) < shot.r + PLAYER.radius && vulnerable(s)) {
      hurtPlayer(s, shot.damage)
      if (shot.kind !== 'tumbleweed') shot.alive = false
      continue
    }
    const gone = (shot.entered && !inArena(shot.x, shot.y, 40)) || shot.age > shot.life || !inArena(shot.x, shot.y, 260)
    if (gone) {
      shot.alive = false
      if (shot.kind !== 'dust') s.dodged++
    }
  }
}

function updateHazards(s: GameState, dt: number) {
  const p = s.player
  for (const h of s.hazards) updateHazard(s, h, dt, p)
  s.hazards = s.hazards.filter((h) => !expired(h))
}

function expired(h: Hazard): boolean {
  switch (h.kind) {
    case 'gunman':
      return h.t >= h.life
    case 'blast':
      return h.boom > 0.45
    case 'mark':
      return h.fired > 0.35
    case 'arc':
      return h.t > h.warn + h.sweep + 0.25
    case 'rope':
      return h.t > h.warn && (h.axis === 'y' ? h.pos < ARENA.y - 20 || h.pos > ARENA_BOTTOM + 20 : h.pos < ARENA.x - 20 || h.pos > ARENA_RIGHT + 20)
    case 'lane':
    case 'path':
      return h.t >= h.warn + 0.15
    case 'train':
      return h.t > h.warn && (h.dir === 1 ? h.pos > (h.axis === 'x' ? ARENA_RIGHT : ARENA_BOTTOM) + 20 : h.pos + h.length < (h.axis === 'x' ? ARENA.x : ARENA.y) - 20)
    case 'bull':
      return h.t > h.warn + 0.3 && !inArena(h.x, h.y, 60)
    case 'spinner':
      return h.t > h.warn + h.fire + 0.4
    case 'barrel':
      return h.burst
  }
}

function updateHazard(s: GameState, h: Hazard, dt: number, p: GameState['player']) {
  h.t += dt
  switch (h.kind) {
    case 'gunman':
      h.flash = Math.max(0, h.flash - dt)
      return
    case 'blast': {
      if (h.boom < 0) {
        h.fuse -= dt
        if (h.fuse <= 0) {
          h.boom = 0
          s.shake = Math.min(1, s.shake + 0.3)
          puff(s, h.x, h.y, 18, '#ffb347', 'spark', 220, 4)
          puff(s, h.x, h.y, 10, 'rgba(120, 90, 70, 0.7)', 'smoke', 70, 10)
          s.events.push('boom')
        }
        return
      }
      h.boom += dt
      // Kerusakan hanya di jendela singkat ledakan dan hanya di dalam radius.
      if (h.boom < 0.18 && !h.hurt && Math.hypot(p.x - h.x, p.y - h.y) < h.r + PLAYER.radius && vulnerable(s)) {
        h.hurt = true
        hurtPlayer(s, 1)
      }
      if (h.boom >= 0.18 && !h.hurt) {
        h.hurt = true
        s.dodged++
      }
      return
    }
    case 'mark': {
      if (h.fired >= 0) {
        h.fired += dt
        return
      }
      if (h.t < h.follow) {
        // Mengikuti pemain dengan jeda (tidak menempel sempurna).
        const k = 1 - Math.exp(-dt * 3.2)
        h.x += (p.x - h.x) * k
        h.y += (p.y - h.y) * k
        return
      }
      if (h.t >= h.follow + h.lock) {
        h.fired = 0
        puff(s, h.x, h.y, 10, '#ffe08a', 'spark', 150, 3)
        if (s.boss) s.boss.draw = 0.25
        s.events.push('bang')
        if (Math.hypot(p.x - h.x, p.y - h.y) < h.r + PLAYER.radius && vulnerable(s)) hurtPlayer(s, 1)
        else s.dodged++
      }
      return
    }
    case 'arc': {
      if (h.t < h.warn) return
      if (h.t - dt < h.warn) s.events.push('whip')
      const k = Math.min(1, (h.t - h.warn) / h.sweep)
      if (k >= 1) return
      const angle = h.from + (h.to - h.from) * k
      const tx = h.px + Math.cos(angle) * h.length
      const ty = h.py + Math.sin(angle) * h.length
      if (segmentDistance(p.x, p.y, h.px, h.py, tx, ty) < 4 + PLAYER.radius && vulnerable(s)) hurtPlayer(s, 1)
      return
    }
    case 'rope': {
      if (h.t < h.warn) return
      if (h.t - dt < h.warn) s.events.push('whip')
      h.pos += h.dir * h.speed * dt
      const along = h.axis === 'y' ? p.x - ARENA.x : p.y - ARENA.y
      const across = h.axis === 'y' ? p.y : p.x
      const inGap = Math.abs(along - h.gap) < h.gapSize / 2 - PLAYER.radius
      if (!inGap && Math.abs(across - h.pos) < 4 + PLAYER.radius && vulnerable(s)) hurtPlayer(s, 1)
      return
    }
    case 'lane':
    case 'path':
      return
    case 'train': {
      if (h.t < h.warn) return
      if (h.t - dt < h.warn) s.events.push('train')
      h.pos += h.dir * h.speed * dt
      const along = h.axis === 'x' ? p.x : p.y
      const across = h.axis === 'x' ? p.y - ARENA.y : p.x - ARENA.x
      if (Math.abs(across - h.lane) < h.band / 2 - 4 + PLAYER.radius && along > h.pos - PLAYER.radius && along < h.pos + h.length + PLAYER.radius && vulnerable(s)) hurtPlayer(s, 1)
      // Asap cerobong dari lokomotif (ujung depan)
      const front = h.dir === 1 ? h.pos + h.length - 30 : h.pos + 30
      if (s.rand() < 0.5) {
        if (h.axis === 'x') puff(s, front, ARENA.y + h.lane - 18, 1, 'rgba(210, 200, 220, 0.5)', 'smoke', 30, 7)
        else puff(s, ARENA.x + h.lane - 18, front, 1, 'rgba(210, 200, 220, 0.5)', 'smoke', 30, 7)
      }
      return
    }
    case 'bull': {
      if (h.t < h.warn) return
      if (h.t - dt < h.warn) s.events.push('charge')
      h.x += h.dx * h.speed * dt
      h.y += h.dy * h.speed * dt
      if (s.rand() < 0.4) puff(s, h.x - h.dx * 14, h.y - h.dy * 14 + 8, 1, 'rgba(214, 170, 110, 0.6)', 'dust', 30, 4)
      if (Math.hypot(p.x - h.x, p.y - h.y) < h.r + PLAYER.radius && vulnerable(s)) hurtPlayer(s, 1)
      return
    }
    case 'spinner': {
      h.angle += h.spin * dt
      if (h.t < h.warn || h.t > h.warn + h.fire) return
      h.next -= dt
      if (h.next > 0) return
      h.next = h.every
      for (let i = 0; i < h.arms; i++) {
        const a = h.angle + (i * Math.PI * 2) / h.arms
        spawnShot(s, 'bullet', 'spiral', h.x + Math.cos(a) * 12, h.y + Math.sin(a) * 12, Math.cos(a) * h.speed, Math.sin(a) * h.speed, { entered: true, life: 5 })
      }
      if (Math.floor(h.t * 4) !== Math.floor((h.t - dt) * 4)) s.events.push('shot-soft')
      return
    }
    case 'barrel': {
      const k = Math.min(1, h.t / h.roll)
      const ease = 1 - (1 - k) * (1 - k)
      h.x = h.fromX + (h.tx - h.fromX) * ease
      h.y = h.fromY + (h.ty - h.fromY) * ease
      if (Math.hypot(p.x - h.x, p.y - h.y) < 12 + PLAYER.radius && vulnerable(s)) hurtPlayer(s, 1)
      if (h.t < h.roll + h.fuse) return
      // Pecah jadi cincin serpihan dengan dua celah berhadapan (selalu ada jalan keluar).
      h.burst = true
      const skip = Math.floor(s.rand() * h.pieces)
      const skip2 = (skip + Math.floor(h.pieces / 2)) % h.pieces
      const offset = s.rand() * Math.PI * 2
      for (let i = 0; i < h.pieces; i++) {
        if (i === skip || i === skip2 || i === (skip + 1) % h.pieces || i === (skip2 + 1) % h.pieces) continue
        const a = offset + (i * Math.PI * 2) / h.pieces
        spawnShot(s, 'thorn', 'barrel', h.x, h.y, Math.cos(a) * h.speed, Math.sin(a) * h.speed, { entered: true, life: 5, r: 4.5 })
      }
      puff(s, h.x, h.y, 16, '#ffb347', 'spark', 200, 4)
      puff(s, h.x, h.y, 6, 'rgba(120, 90, 70, 0.7)', 'smoke', 60, 9)
      s.shake = Math.min(1, s.shake + 0.25)
      s.events.push('boom')
      return
    }
  }
}

function updateParticles(s: GameState, dt: number) {
  for (const particle of s.particles) {
    particle.age += dt
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.vx *= 1 - dt * 2
    particle.vy *= 1 - dt * 2
  }
  s.particles = s.particles.filter((particle) => particle.age < particle.life)
}

// ---------- Duel cepat (mode bos) ----------

function startDuel(s: GameState) {
  s.phase = 'duel'
  s.phaseTime = 0
  const [min, max] = BOSS.duelWait
  s.duel = { signal: min + s.rand() * (max - min), t: 0, result: null, reaction: 0, show: 0 }
  s.banner = { title: 'DUEL CEPAT', subtitle: 'Tunggu aba-aba, lalu tekan Spasi', time: 0, total: 1.4 }
  s.events.push('duel-ready')
}

function updateDuel(s: GameState, dt: number) {
  const duel = s.duel!
  const before = duel.t
  duel.t += dt
  if (before < duel.signal && duel.t >= duel.signal && !duel.result) s.events.push('draw')
  if (!duel.result && duel.t > duel.signal + BOSS.duelWindow) {
    // Terlalu lambat: bos menembak lebih dulu.
    duel.result = 'slow'
    duel.show = 1.4
    if (s.boss) s.boss.draw = 0.3
    hurtPlayer(s, 1, true)
    s.events.push('duel-fail')
  }
  if (duel.result) {
    duel.show -= dt
    if (duel.show <= 0 && !s.over) {
      s.duel = null
      s.phase = 'break'
      s.phaseTime = 0
      s.phaseLength = TIMING.betweenPatterns + 0.4
    }
  }
}

// ---------- Penjadwal ----------

function compatible(a: PatternId, b: PatternId): boolean {
  return a !== b && !INCOMPATIBLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/** Memilih pola dari `pool`, menghindari yang baru saja dipakai dan yang tidak cocok dengan `with`. */
function choose(s: GameState, pool: PatternId[], avoid: PatternId[] = []): PatternId {
  const fresh = pool.filter((id) => !s.recent.includes(id) && avoid.every((other) => compatible(id, other)))
  const options = fresh.length ? fresh : pool.filter((id) => avoid.every((other) => compatible(id, other)))
  const id = options.length ? options[Math.floor(s.rand() * options.length)] : pool[0]
  s.recent = [id, ...s.recent].slice(0, 2)
  return id
}

function buildWave(s: GameState): PatternId[][] {
  const { patterns, together } = waveShape(s.wave)
  const known = INTRO_ORDER.slice(0, Math.min(INTRO_ORDER.length, s.wave))
  const queue: PatternId[][] = []
  for (let i = 0; i < patterns; i++) {
    // Gelombang awal: pola baru diperkenalkan sendirian dulu.
    if (i === 0 && s.wave <= INTRO_ORDER.length) {
      const id = INTRO_ORDER[s.wave - 1]
      s.recent = [id, ...s.recent].slice(0, 2)
      queue.push([id])
      continue
    }
    const slot: PatternId[] = [choose(s, known)]
    if (together > 1 && i > 0) slot.push(choose(s, known, slot))
    queue.push(slot)
  }
  return queue
}

function buildBossAttack(s: GameState): PatternId[] {
  const phase = BOSS.phasePatterns[s.boss!.phase]
  const slot: PatternId[] = [choose(s, phase.patterns)]
  if (phase.together > 1 && s.boss!.attacks % 2 === 1) slot.push(choose(s, phase.patterns, slot))
  return slot
}

function levelNow(s: GameState): number {
  return s.boss ? BOSS.phasePatterns[s.boss.phase].level : levelFor(s.wave)
}

function startSlot(s: GameState, slot: PatternId[]) {
  const lv = levelNow(s)
  s.runs = slot.map((id) => PATTERNS[id](s, lv))
  s.phase = 'attack'
  s.phaseTime = 0
  s.waveHits = s.boss ? 0 : s.waveHits
}

function schedule(s: GameState) {
  if (s.over) return
  switch (s.phase) {
    case 'countdown':
      if (s.phaseTime >= TIMING.countdown) nextAttack(s)
      return
    case 'break':
    case 'recovery':
      if (s.phaseTime >= s.phaseLength) nextAttack(s)
      return
    case 'attack': {
      const done = s.runs.every((run) => run.t >= run.duration)
      if (!done) return
      s.runs = []
      if (s.boss) {
        finishBossAttack(s)
        return
      }
      if (s.queue.length) {
        s.phase = 'break'
        s.phaseTime = 0
        s.phaseLength = TIMING.betweenPatterns
        return
      }
      finishWave(s)
      return
    }
    case 'duel':
    case 'over':
    case 'won':
      return
  }
}

function nextAttack(s: GameState) {
  if (s.boss) {
    startSlot(s, buildBossAttack(s))
    return
  }
  if (!s.queue.length) s.queue = buildWave(s)
  startSlot(s, s.queue.shift()!)
}

function finishWave(s: GameState) {
  const perfect = s.waveHits === 0
  s.score += SCORE.perWave * s.wave + (perfect ? SCORE.perfect * s.wave : 0)
  if (perfect) s.perfectWaves++
  s.events.push(perfect ? 'perfect' : 'wave')
  const cleared = s.wave
  s.wave++
  s.waveHits = 0
  s.queue = buildWave(s)
  const fresh = s.wave <= INTRO_ORDER.length ? INTRO_ORDER[s.wave - 1] : null
  if (cleared % RECOVERY.every === 0) {
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + RECOVERY.heal)
    s.phase = 'recovery'
    s.phaseLength = RECOVERY.duration
    s.banner = { title: 'ISTIRAHAT', subtitle: `+${RECOVERY.heal} nyawa · gelombang ${s.wave} berikutnya`, time: 0, total: RECOVERY.duration }
    s.events.push('heal')
  } else {
    s.phase = 'break'
    s.phaseLength = TIMING.betweenWaves
    s.banner = {
      title: `GELOMBANG ${s.wave}`,
      subtitle: perfect ? `Sempurna! +${SCORE.perfect * cleared}` : fresh ? `Baru: ${PATTERN_NAMES[fresh]}` : 'Makin cepat…',
      time: 0,
      total: TIMING.betweenWaves,
    }
  }
  s.phaseTime = 0
}

function finishBossAttack(s: GameState) {
  const boss = s.boss!
  boss.attacks++
  const perfect = s.waveHits === 0
  if (perfect) s.perfectWaves++
  damageBoss(s, BOSS.survive + (perfect ? BOSS.perfectBonus : 0))
  if (s.over) return
  // Pindah fase saat nyali turun melewati batas.
  const ratio = boss.hp / boss.maxHp
  const phase = BOSS.phases.filter((limit) => ratio <= limit).length
  if (phase > boss.phase) {
    boss.phase = phase
    s.banner = { title: `FASE ${phase + 1}`, subtitle: phase === 2 ? 'Si Mata Elang mengamuk!' : 'Pelurunya mulai memantul…', time: 0, total: 2.2 }
    s.events.push('phase')
    s.phase = 'recovery'
    s.phaseTime = 0
    s.phaseLength = 2.4
    return
  }
  if (boss.attacks % BOSS.duelEvery === 0) {
    startDuel(s)
    return
  }
  s.phase = 'break'
  s.phaseTime = 0
  s.phaseLength = TIMING.betweenPatterns + 0.3
}

export function summary(s: GameState): Summary {
  return {
    mode: s.mode,
    score: Math.round(s.score),
    time: s.time,
    wave: s.wave,
    hits: s.hits,
    dodged: s.dodged,
    perfectWaves: s.perfectWaves,
    won: s.phase === 'won',
    bossHp: s.boss?.hp ?? 0,
  }
}
