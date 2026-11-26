import { actFor, bossLevel, createBoss, currentAct, makeDuel, moveBoss, placePickup, setupAct, tryRoll, activeDecoy } from './boss'
import { ARENA, BOSSES, DASH, DIFFICULTY, ENDLESS_BOSS, FIGHT, INCOMPATIBLE, INTRO_ORDER, levelFor, PATTERN_NAMES, PLAYER, SCORE, TIMING, waveShape, type PatternId } from './config'
import { lastStand, PATTERNS } from './patterns'
import {
  ARENA_BOTTOM,
  ARENA_RIGHT,
  circleRect,
  inArena,
  mulberry32,
  newPlayer,
  puff,
  range,
  segmentDistance,
  spawnShot,
  type BossId,
  type Difficulty,
  type GameState,
  type Hazard,
  type Mode,
} from './state'

/**
 * Mesin KOBOI (tanpa DOM): gerak koboi, dash, peluru, hazard, tabrakan, penjadwal gelombang, pertarungan
 * bos (revolver, peluru emas, guling, isi ulang, babak, tembakan terakhir, duel), dan skor. Dipanggil
 * tiap frame oleh KoboiGame.tsx; React tidak menyimpan state permainan.
 */

export type { GameState } from './state'

export interface Summary {
  mode: Mode
  difficulty: Difficulty
  bossId: BossId | null
  score: number
  time: number
  wave: number
  hits: number
  dodged: number
  perfectWaves: number
  won: boolean
  bossHp: number
  bossMaxHp: number
  bossesDefeated: number
}

export interface GameOptions {
  difficulty: Difficulty
  dash: boolean
  bossId?: BossId
}

/** Pengali skor per tingkat kesulitan. */
const SCORE_MULT: Record<Difficulty, number> = { koboi: 1, sheriff: 1.5, legenda: 2.5 }

export function createGame(mode: Mode, options: GameOptions, seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  const diff = DIFFICULTY[options.difficulty]
  const s: GameState = {
    mode,
    difficulty: options.difficulty,
    seed,
    rand: mulberry32(seed),
    phase: 'countdown',
    phaseTime: 0,
    phaseLength: TIMING.countdown,
    time: 0,
    player: newPlayer(diff.hp),
    input: { up: false, down: false, left: false, right: false },
    dashEnabled: options.dash && diff.dash,
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
    boss: null,
    bossesDefeated: 0,
    duel: null,
    gun: { ammo: 2, max: FIGHT.ammoMax, cool: 0 },
    pickups: [],
    pickupTimer: 1,
    pshots: [],
    deadeye: { meter: 0, active: 0 },
    covers: [],
    pits: [],
    pitTimer: 0,
    levers: [],
    leverTimer: 3,
    wind: 0,
    scroll: 0,
    banner: { title: 'GELOMBANG 1', subtitle: 'Bertahan hidup!', time: 0, total: TIMING.countdown },
    shake: 0,
    flash: 0,
    events: [],
    over: false,
  }
  if (mode === 'boss') {
    const id = options.bossId ?? 'elang'
    s.boss = createBoss(s, id, false, 1, 0)
    setupAct(s)
    s.banner = { title: 'DUEL!', subtitle: `${BOSSES[id].name} menantangmu · ${currentAct(s.boss).name}`, time: 0, total: TIMING.countdown }
  }
  return s
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

/** Bisa menembak sekarang? (ada bos yang sedang bertarung, bukan saat duel/tembakan terakhir.) */
export function canFire(s: GameState): boolean {
  return Boolean(s.boss && s.boss.stage === 'fight' && !s.over && (s.phase === 'attack' || s.phase === 'reload' || s.phase === 'break'))
}

/** Tembak revolver ke arah bos (F/J/klik). */
export function fire(s: GameState) {
  if (!canFire(s)) return
  const gun = s.gun
  if (gun.cool > 0) return
  if (gun.ammo <= 0) {
    gun.cool = 0.3
    s.events.push('click')
    return
  }
  const boss = s.boss!
  const p = s.player
  gun.ammo--
  gun.cool = FIGHT.fireCooldown
  const tx = boss.x
  const ty = boss.y - 22
  const dx = tx - p.x
  const dy = ty - (p.y - 10)
  const len = Math.hypot(dx, dy) || 1
  s.pshots.push({ kind: 'bullet', x: p.x, y: p.y - 10, vx: (dx / len) * FIGHT.shotSpeed, vy: (dy / len) * FIGHT.shotSpeed, homing: s.deadeye.active > 0, alive: true, age: 0 })
  puff(s, p.x, p.y - 14, 4, '#ffe08a', 'spark', 80, 2)
  s.events.push('pshot')
  if (tryRoll(s)) s.events.push('roll')
}

/** Aktifkan Mata Elang (E/Q) kalau meternya penuh: dunia melambat dan tembakan terkunci ke bos. */
export function deadeye(s: GameState) {
  if (s.deadeye.meter < 1 || !canFire(s)) return
  s.deadeye.meter = 0
  s.deadeye.active = FIGHT.deadeyeTime
  s.events.push('deadeye')
}

/** Tombol tembak saat duel cepat (Spasi/Enter/F/klik). */
export function draw(s: GameState) {
  const duel = s.duel
  if (!duel || duel.result || s.phase !== 'duel') return
  if (duel.t < duel.signal) {
    // Menekan sebelum aba-aba asli (termasuk saat kata pengecoh tampil) = kalah duel ini.
    duel.result = activeDecoy(duel) ? 'decoy' : 'early'
    duel.show = 1.5
    hurtPlayer(s, 1, true)
    s.events.push('duel-fail')
    return
  }
  duel.reaction = duel.t - duel.signal
  duel.result = duel.reaction <= FIGHT.duelFast ? 'fast' : 'hit'
  duel.show = 1.4
  s.events.push('duel-win')
  if (duel.final) {
    endGame(s, true)
    return
  }
  damageBoss(s, duel.result === 'fast' ? FIGHT.duelFastDamage : FIGHT.duelDamage)
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
  s.deadeye.active = Math.max(0, s.deadeye.active - dt)
  // Mata Elang: dunia melambat, pemain dan tembakannya tetap normal.
  const wdt = s.deadeye.active > 0 ? dt * FIGHT.deadeyeScale : dt
  s.shake = Math.max(0, s.shake - dt * 2.5)
  s.flash = Math.max(0, s.flash - dt * 3)
  if (s.banner) {
    s.banner.time += dt
    if (s.banner.time >= s.banner.total) s.banner = null
  }
  if (s.boss) {
    s.boss.hurt = Math.max(0, s.boss.hurt - dt)
    s.boss.draw = Math.max(0, s.boss.draw - wdt)
    moveBoss(s, wdt)
  }

  updatePlayer(s, dt)
  if (s.phase !== 'countdown') s.score += SCORE.perSecond * SCORE_MULT[s.difficulty] * dt
  for (const run of s.runs) run.step(wdt)
  updateShots(s, wdt)
  updateHazards(s, wdt)
  updateFight(s, dt, wdt)
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
  // Saat duel cepat koboi tidak bergerak (fokus pada aba-aba).
  const frozen = s.phase === 'duel'
  let speed = frozen ? 0 : PLAYER.speed
  if (p.dash > 0) {
    p.dash -= dt
    vx = p.dashX
    vy = p.dashY
    speed = PLAYER.speed * DASH.boost
    p.trail.push({ x: p.x, y: p.y, age: 0 })
  }
  p.vx = vx * speed
  p.vy = vy * speed
  const wind = frozen ? 0 : s.wind
  p.x = Math.max(ARENA.x + 8, Math.min(ARENA_RIGHT - 8, p.x + (p.vx + wind) * dt))
  p.y = Math.max(ARENA.y + 8, Math.min(ARENA_BOTTOM - 8, p.y + p.vy * dt))
  // Meja saloon menghalangi gerak: dorong keluar lewat sisi yang paling dekat.
  for (const c of s.covers) {
    if (c.hp <= 0 || !circleRect(p.x, p.y, 8, c)) continue
    const pushes = [c.x - 8 - p.x, c.x + c.w + 8 - p.x, c.y - 8 - p.y, c.y + c.h + 8 - p.y]
    const best = pushes.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a))
    if (best === pushes[0] || best === pushes[1]) p.x += best
    else p.y += best
  }
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

function clearField(s: GameState) {
  s.runs = []
  s.hazards = []
  for (const shot of s.shots) shot.alive = false
  s.pshots = []
  s.pits = []
}

function damageBoss(s: GameState, amount: number) {
  const boss = s.boss
  if (!boss || boss.stage !== 'fight') return
  boss.hp = Math.max(0, boss.hp - amount)
  boss.hurt = 0.5
  s.score += amount * 40 * SCORE_MULT[s.difficulty]
  s.events.push('boss-hurt')
  if (boss.hp <= 0) {
    if (boss.mini) defeatMiniBoss(s)
    else startLastStand(s)
    return
  }
  const act = actFor(boss)
  if (act > boss.act) changeAct(s, act)
}

function changeAct(s: GameState, act: number) {
  const boss = s.boss!
  boss.act = act
  // Napas sejenak: babak baru memberi nyawa (kecuali Legenda).
  const heal = DIFFICULTY[s.difficulty].actHeal
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + heal)
  clearField(s)
  s.duel = null
  setupAct(s)
  s.phase = 'recovery'
  s.phaseTime = 0
  s.phaseLength = 2.8
  const name = currentAct(boss).name
  s.banner = { title: `BABAK ${act + 1}`, subtitle: `${heal ? `+${heal} nyawa · ` : ''}${name}${currentAct(boss).arena === 'saloon' ? ' · berlindung di balik meja' : currentAct(boss).arena === 'train' ? ' · lompati celah gerbong (dash)' : ''}`, time: 0, total: 2.6 }
  s.events.push('phase')
}

/** Nyali habis: bos melepas tembakan terakhir, lalu duel penentuan. */
function startLastStand(s: GameState) {
  const boss = s.boss!
  boss.stage = 'laststand'
  clearField(s)
  s.duel = null
  s.pickups = []
  s.levers = []
  s.wind = 0
  s.deadeye.active = 0
  s.phase = 'laststand'
  s.phaseTime = 0
  s.runs = [lastStand(s, FIGHT.lastStand, BOSSES[boss.id].curtain)]
  s.banner = { title: 'TEMBAKAN TERAKHIR!', subtitle: 'Ikuti lorong hijau', time: 0, total: 2 }
  s.events.push('phase')
}

/** Mode Bertahan: bos mini kalah → lanjut gelombang berikutnya dengan bonus dan nyawa. */
function defeatMiniBoss(s: GameState) {
  const boss = s.boss!
  clearField(s)
  s.duel = null
  s.boss = null
  s.pickups = []
  s.levers = []
  s.covers = []
  s.wind = 0
  s.deadeye = { meter: 0, active: 0 }
  s.bossesDefeated++
  const bonus = Math.round(ENDLESS_BOSS.score * (1 + (s.bossesDefeated - 1) * 0.5) * SCORE_MULT[s.difficulty])
  s.score += bonus
  if (s.waveHits === 0) s.perfectWaves++
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + ENDLESS_BOSS.heal)
  s.wave++
  s.waveHits = 0
  s.queue = buildWave(s)
  s.phase = 'recovery'
  s.phaseTime = 0
  s.phaseLength = 3.4
  s.banner = { title: 'BURONAN TERTANGKAP', subtitle: `${BOSSES[boss.id].name} · +${bonus.toLocaleString('id-ID')} · +${ENDLESS_BOSS.heal} nyawa`, time: 0, total: 3.2 }
  s.events.push('win')
}

function endGame(s: GameState, won: boolean) {
  s.over = true
  s.phase = won ? 'won' : 'over'
  s.phaseTime = 0
  s.runs = []
  if (won) {
    s.score += (SCORE.boss + Math.max(0, 240 - s.time) * SCORE.bossTime) * SCORE_MULT[s.difficulty]
    s.banner = { title: 'MENANG!', subtitle: `${BOSSES[s.boss!.id].name} tumbang`, time: 0, total: 3 }
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
  const grazing = Boolean(s.boss && s.boss.stage === 'fight')
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

    // Meja saloon menahan peluru dan perlahan hancur.
    const cover = s.covers.find((c) => c.hp > 0 && circleRect(shot.x, shot.y, shot.r, c))
    if (cover) {
      shot.alive = false
      cover.hp--
      cover.hit = 0.2
      puff(s, shot.x, shot.y, 5, '#a06a3a', 'dust', 80, 3)
      s.events.push(cover.hp <= 0 ? 'crash' : 'thud')
      continue
    }

    const distance = Math.hypot(shot.x - p.x, shot.y - p.y)
    if (distance < shot.r + PLAYER.radius && vulnerable(s)) {
      hurtPlayer(s, shot.damage)
      if (shot.kind !== 'tumbleweed') shot.alive = false
      continue
    }
    // Serempetan: peluru lewat sangat dekat tanpa kena mengisi meter Mata Elang.
    if (grazing && !shot.grazed && distance < shot.r + PLAYER.radius + FIGHT.grazeRange && s.player.invuln <= 0) {
      shot.grazed = true
      const before = s.deadeye.meter
      s.deadeye.meter = Math.min(1, s.deadeye.meter + FIGHT.grazeFill)
      s.events.push(before < 1 && s.deadeye.meter >= 1 ? 'deadeye-ready' : 'graze')
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
      return h.kicked || h.boom > 0.45
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
    case 'corridor':
      return h.t > h.life
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
        // Bocah Dinamit: dash menabrak batang dinamit yang masih menyala = menendangnya balik ke bos.
        if (h.kick && p.dash > 0 && h.t > h.total * 0.25 && h.fuse > 0.1 && Math.hypot(p.x - h.x, p.y - h.y) < 26 && s.boss) {
          h.kicked = true
          s.pshots.push({ kind: 'kick', x: h.x, y: h.y, vx: 0, vy: -420, homing: true, alive: true, age: 0 })
          puff(s, h.x, h.y, 8, '#ffe08a', 'spark', 120, 3)
          s.events.push('kick')
          return
        }
        h.fuse -= dt
        if (h.fuse <= 0) {
          h.boom = 0
          s.shake = Math.min(1, s.shake + 0.3)
          puff(s, h.x, h.y, 18, h.style === 'lamp' ? '#ffe9b0' : '#ffb347', 'spark', 220, 4)
          puff(s, h.x, h.y, 10, 'rgba(120, 90, 70, 0.7)', 'smoke', 70, 10)
          s.events.push(h.style === 'lamp' ? 'glass' : 'boom')
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
        // Mengikuti pemain dengan jeda; kalau `lead` > 0, membidik ke depan arah geraknya.
        const k = 1 - Math.exp(-dt * 3.2)
        const tx = Math.max(ARENA.x + 10, Math.min(ARENA_RIGHT - 10, p.x + p.vx * h.lead))
        const ty = Math.max(ARENA.y + 10, Math.min(ARENA_BOTTOM - 10, p.y + p.vy * h.lead))
        h.x += (tx - h.x) * k
        h.y += (ty - h.y) * k
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
    case 'corridor':
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

// ---------- Pertarungan bos: peluru emas, tembakan pemain, tuas, celah gerbong ----------

function updateFight(s: GameState, dt: number, wdt: number) {
  const boss = s.boss
  s.gun.cool = Math.max(0, s.gun.cool - dt)
  for (const c of s.covers) c.hit = Math.max(0, c.hit - dt)
  if (!boss) return
  const active = boss.stage === 'fight' && (s.phase === 'attack' || s.phase === 'reload')
  const p = s.player

  // Peluru emas
  if (active) {
    s.pickupTimer -= wdt
    if (s.pickupTimer <= 0) {
      s.pickupTimer = FIGHT.pickupEvery
      if (s.gun.ammo + s.pickups.length * 2 < s.gun.max) {
        const pickup = placePickup(s)
        if (pickup) s.pickups.push(pickup)
      }
    }
  }
  for (const pickup of s.pickups) {
    pickup.t += wdt
    if (Math.hypot(pickup.x - p.x, pickup.y - p.y) < FIGHT.pickupRadius + PLAYER.radius) {
      pickup.life = -1
      s.gun.ammo = Math.min(s.gun.max, s.gun.ammo + 2)
      puff(s, pickup.x, pickup.y, 8, '#ffe08a', 'star', 70, 2.5)
      s.events.push('pickup')
    }
  }
  s.pickups = s.pickups.filter((pickup) => pickup.t < pickup.life)

  // Peluru pemain dan dinamit yang ditendang
  const bx = boss.x
  const by = boss.y - 22
  for (const shot of s.pshots) {
    shot.age += dt
    if (shot.homing) {
      const dx = bx - shot.x
      const dy = by - shot.y
      const len = Math.hypot(dx, dy) || 1
      const speed = shot.kind === 'kick' ? 460 : FIGHT.shotSpeed
      shot.vx += ((dx / len) * speed - shot.vx) * Math.min(1, dt * 10)
      shot.vy += ((dy / len) * speed - shot.vy) * Math.min(1, dt * 10)
    }
    shot.x += shot.vx * dt
    shot.y += shot.vy * dt
    const radius = FIGHT.bossRadius + (shot.kind === 'kick' ? 10 : 0)
    // Dinamit tendangan dan tembakan Mata Elang selalu kena; peluru biasa meleset kalau bos sedang berguling.
    if (Math.hypot(shot.x - bx, shot.y - by) < radius && (boss.roll <= 0 || shot.homing)) {
      shot.alive = false
      puff(s, shot.x, shot.y, shot.kind === 'kick' ? 18 : 8, shot.kind === 'kick' ? '#ffb347' : '#ffe08a', 'spark', shot.kind === 'kick' ? 200 : 120, 3)
      if (shot.kind === 'kick') {
        s.shake = Math.min(1, s.shake + 0.3)
        s.events.push('boom')
      }
      damageBoss(s, shot.kind === 'kick' ? FIGHT.kickDamage : FIGHT.shotDamage)
      if (!s.boss) return
      continue
    }
    if (shot.age > 2 || shot.y < 30 || shot.y > 560 || shot.x < -20 || shot.x > 820) shot.alive = false
  }
  s.pshots = s.pshots.filter((shot) => shot.alive)

  // Tuas rel (Hantu Masinis)
  if (BOSSES[boss.id].special === 'lever' && active) {
    s.leverTimer -= wdt
    if (s.leverTimer <= 0 && !s.levers.some((lever) => lever.pulled === 0)) {
      s.leverTimer = FIGHT.leverEvery
      for (let tries = 0; tries < 12; tries++) {
        const x = range(s, ARENA.x + 30, ARENA_RIGHT - 30)
        const y = range(s, ARENA.y + 40, ARENA_BOTTOM - 26)
        if (Math.hypot(x - p.x, y - p.y) < 90) continue
        s.levers.push({ x, y, progress: 0, t: 0, life: 7, pulled: 0 })
        s.events.push('lever-up')
        break
      }
    }
  }
  for (const lever of s.levers) {
    lever.t += wdt
    if (lever.pulled > 0) {
      lever.pulled += dt
      continue
    }
    if (Math.hypot(lever.x - p.x, lever.y - p.y) < 18) lever.progress += dt / FIGHT.leverTime
    else lever.progress = Math.max(0, lever.progress - dt * 0.6)
    if (lever.progress >= 1) {
      lever.pulled = 0.001
      puff(s, lever.x, lever.y, 12, '#c9b6ff', 'spark', 120, 3)
      s.shake = Math.min(1, s.shake + 0.4)
      s.events.push('lever')
      damageBoss(s, FIGHT.leverDamage)
      if (!s.boss) return
    }
  }
  s.levers = s.levers.filter((lever) => (lever.pulled > 0 ? lever.pulled < 1.2 : lever.t < lever.life))

  // Atap kereta: celah antar gerbong bergerak ke kiri; jatuh = −1 nyawa kecuali sedang dash atau di papan.
  if (currentAct(boss).arena === 'train' && boss.stage === 'fight') {
    s.scroll += FIGHT.pitSpeed * wdt
    if (active) {
      s.pitTimer -= wdt
      if (s.pitTimer <= 0) {
        s.pitTimer = FIGHT.pitEvery
        s.pits.push({ x: ARENA_RIGHT, w: FIGHT.pitWidth, plankY: range(s, ARENA.y + 40, ARENA_BOTTOM - 40), plankH: FIGHT.plank })
      }
    }
    // Celah hanya bergerak (dan hanya berbahaya) saat bos menyerang; saat duel/jeda kereta seolah melambat.
    const moving = active || s.phase === 'break'
    if (moving) for (const pit of s.pits) pit.x -= FIGHT.pitSpeed * wdt
    s.pits = s.pits.filter((pit) => pit.x + pit.w > ARENA.x)
    const over = s.pits.find((pit) => p.x > pit.x + 2 && p.x < pit.x + pit.w - 2 && Math.abs(p.y - pit.plankY) > pit.plankH / 2 - 4)
    if (moving && over && p.dash <= 0 && vulnerable(s)) {
      hurtPlayer(s, 1)
      // Didorong ke sisi kanan celah supaya tidak jatuh lagi.
      p.x = Math.min(ARENA_RIGHT - 8, over.x + over.w + 10)
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

// ---------- Duel cepat ----------

function startDuel(s: GameState, final: boolean) {
  // Celah gerbong di bawah pemain dibersihkan supaya duel tidak berakhir jatuh.
  s.pits = s.pits.filter((pit) => s.player.x < pit.x - 20 || s.player.x > pit.x + pit.w + 20)
  s.phase = 'duel'
  s.phaseTime = 0
  s.deadeye.active = 0
  s.duel = makeDuel(s, final)
  s.banner = final
    ? { title: 'DUEL PENENTUAN', subtitle: 'Awas kata pengecoh! Tekan hanya saat TEMBAK!', time: 0, total: 1 }
    : { title: 'DUEL CEPAT', subtitle: s.duel.decoys.length ? 'Awas kata pengecoh…' : 'Tunggu aba-aba, lalu tekan Spasi', time: 0, total: 1 }
  s.events.push('duel-ready')
}

function updateDuel(s: GameState, dt: number) {
  const duel = s.duel
  if (!duel) return
  const before = duel.t
  duel.t += dt
  if (before < duel.signal && duel.t >= duel.signal && !duel.result) s.events.push('draw')
  for (const decoy of duel.decoys) if (before < decoy.at && duel.t >= decoy.at && !duel.result) s.events.push('decoy')
  if (!duel.result && duel.t > duel.signal + FIGHT.duelWindow) {
    // Terlalu lambat: bos menembak lebih dulu.
    duel.result = 'slow'
    duel.show = 1.4
    if (s.boss) s.boss.draw = 0.3
    hurtPlayer(s, 1, true)
    s.events.push('duel-fail')
  }
  if (!duel.result || s.over) return
  duel.show -= dt
  if (duel.show > 0) return
  if (duel.final) {
    // Kalah duel penentuan: ulangi sampai menang (atau nyawa habis).
    startDuel(s, true)
    return
  }
  s.duel = null
  s.phase = 'break'
  s.phaseTime = 0
  s.phaseLength = TIMING.betweenPatterns + 0.4
}

// ---------- Penjadwal ----------

function compatible(a: PatternId, b: PatternId): boolean {
  return a !== b && !INCOMPATIBLE.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/** Memilih pola dari `pool`, menghindari yang baru saja dipakai dan yang tidak cocok dengan `avoid`. */
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
  const boss = s.boss!
  const act = currentAct(boss)
  const slot: PatternId[] = [choose(s, act.patterns)]
  if (act.together > 1 && boss.attacks % 2 === 1) slot.push(choose(s, act.patterns, slot))
  return slot
}

function levelNow(s: GameState): number {
  return s.boss ? bossLevel(s) : levelFor(s.wave) + DIFFICULTY[s.difficulty].level
}

function startSlot(s: GameState, slot: PatternId[]) {
  const lv = levelNow(s)
  s.runs = slot.map((id) => PATTERNS[id](s, lv))
  s.phase = 'attack'
  s.phaseTime = 0
  if (s.boss) s.waveHits = 0
}

function schedule(s: GameState) {
  if (s.over) return
  switch (s.phase) {
    case 'countdown':
      if (s.phaseTime >= TIMING.countdown) nextAttack(s)
      return
    case 'break':
    case 'recovery':
    case 'reload':
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
    case 'laststand':
      if (s.runs.every((run) => run.t >= run.duration)) {
        s.runs = []
        if (s.boss) s.boss.stage = 'final'
        startDuel(s, true)
      }
      return
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
  const mult = SCORE_MULT[s.difficulty]
  s.score += (SCORE.perWave * s.wave + (perfect ? SCORE.perfect * s.wave : 0)) * mult
  if (perfect) s.perfectWaves++
  s.events.push(perfect ? 'perfect' : 'wave')
  const cleared = s.wave
  s.wave++
  s.waveHits = 0
  s.phaseTime = 0
  // Tiap beberapa gelombang: bos mini (bergiliran), bukan gelombang biasa.
  if (s.wave % ENDLESS_BOSS.every === 0) {
    startEndlessBoss(s)
    return
  }
  s.queue = buildWave(s)
  const fresh = s.wave <= INTRO_ORDER.length ? INTRO_ORDER[s.wave - 1] : null
  s.phase = 'break'
  s.phaseLength = TIMING.betweenWaves
  s.banner = {
    title: `GELOMBANG ${s.wave}`,
    subtitle: perfect ? `Sempurna! +${Math.round(SCORE.perfect * cleared * mult)}` : fresh ? `Baru: ${PATTERN_NAMES[fresh]}` : 'Makin cepat…',
    time: 0,
    total: TIMING.betweenWaves,
  }
}

function startEndlessBoss(s: GameState) {
  const index = s.wave / ENDLESS_BOSS.every - 1
  const id = ENDLESS_BOSS.order[index % ENDLESS_BOSS.order.length]
  const scale = Math.min(ENDLESS_BOSS.hpMax, ENDLESS_BOSS.hpBase + s.wave * ENDLESS_BOSS.hpPerWave)
  // Putaran kedua dan seterusnya: bos yang sama tapi pola lebih ganas.
  const bonus = Math.floor(index / ENDLESS_BOSS.order.length) * 0.25
  s.boss = createBoss(s, id, true, scale, bonus)
  setupAct(s)
  s.gun.ammo = 2
  s.pickupTimer = 1
  s.deadeye.meter = Math.max(s.deadeye.meter, 0)
  s.phase = 'recovery'
  s.phaseLength = 3
  s.banner = { title: 'BURONAN MUNCUL!', subtitle: `${BOSSES[id].name} · ambil peluru emas, tekan F untuk menembak`, time: 0, total: 3 }
  s.events.push('phase')
}

function finishBossAttack(s: GameState) {
  const boss = s.boss!
  boss.attacks++
  if (s.waveHits === 0) s.perfectWaves++
  if (boss.attacks % FIGHT.duelEvery === 0) {
    startDuel(s, false)
    return
  }
  // Bos mengisi ulang: celah terbaik untuk menembak (ia tidak bisa berguling).
  s.phase = 'reload'
  s.phaseTime = 0
  s.phaseLength = DIFFICULTY[s.difficulty].reload
  boss.reload = s.phaseLength
  s.events.push('reload')
}

export function summary(s: GameState): Summary {
  return {
    mode: s.mode,
    difficulty: s.difficulty,
    bossId: s.mode === 'boss' && s.boss ? s.boss.id : null,
    score: Math.round(s.score),
    time: s.time,
    wave: s.wave,
    hits: s.hits,
    dodged: s.dodged,
    perfectWaves: s.perfectWaves,
    won: s.phase === 'won',
    bossHp: s.boss?.hp ?? 0,
    bossMaxHp: s.boss?.maxHp ?? 0,
    bossesDefeated: s.bossesDefeated,
  }
}
