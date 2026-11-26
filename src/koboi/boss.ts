import { ARENA, BOSSES, DIFFICULTY, FIGHT, type BossAct } from './config'
import { ARENA_BOTTOM, ARENA_RIGHT, circleRect, range, type Boss, type BossId, type Duel, type GameState, type Pickup } from './state'

/**
 * Bagian pertarungan bos yang tidak menyentuh nyawa/skor (itu di engine.ts): membuat bos, menyiapkan
 * arena tiap babak (meja saloon, angin atap kereta), gerak dan guling bos, letak peluru emas, dan duel.
 */

/** Posisi bos di atas arena. */
export const BOSS_Y = 152

export function createBoss(s: GameState, id: BossId, mini: boolean, hpScale: number, levelBonus: number): Boss {
  const hp = Math.max(8, Math.round(BOSSES[id].hp * hpScale * DIFFICULTY[s.difficulty].bossHp))
  return {
    id,
    hp,
    maxHp: hp,
    act: 0,
    attacks: 0,
    hurt: 0,
    draw: 0,
    x: 400,
    y: BOSS_Y,
    targetX: 400,
    roll: 0,
    rollDir: 1,
    rollCd: 0,
    reload: 0,
    stage: 'fight',
    mini,
    levelBonus,
  }
}

export function currentAct(boss: Boss): BossAct {
  return BOSSES[boss.id].acts[boss.act]
}

/** Tingkat kesulitan pola bos sekarang. */
export function bossLevel(s: GameState): number {
  const boss = s.boss!
  return currentAct(boss).level + DIFFICULTY[s.difficulty].level + boss.levelBonus
}

/** Babak dari sisa nyali (0, 1, 2). */
export function actFor(boss: Boss): number {
  const ratio = boss.hp / boss.maxHp
  return FIGHT.acts.filter((limit) => ratio <= limit).length
}

/** Menyiapkan arena untuk babak sekarang: meja di saloon, angin dan celah gerbong di atap kereta. */
export function setupAct(s: GameState) {
  const arena = s.boss ? currentAct(s.boss).arena : 'street'
  s.covers = []
  s.pits = []
  s.wind = 0
  if (arena === 'saloon') {
    // Tiga meja tersebar, tidak di atas pemain.
    const spots = [
      [ARENA.x + 70, ARENA.y + 80],
      [ARENA.x + ARENA.w / 2 - 23, ARENA.y + 150],
      [ARENA_RIGHT - 116, ARENA.y + 90],
      [ARENA.x + 110, ARENA_BOTTOM - 70],
      [ARENA_RIGHT - 150, ARENA_BOTTOM - 72],
    ]
    for (const [x, y] of spots) {
      const box = { x, y, w: 46, h: 22 }
      if (circleRect(s.player.x, s.player.y, 30, box)) continue
      if (s.covers.length < 3 || s.rand() < 0.4) s.covers.push({ ...box, hp: 3, hit: 0 })
    }
  }
  if (arena === 'train') {
    s.wind = FIGHT.wind
    s.pitTimer = 1.2
  }
  s.leverTimer = 3
  s.levers = []
}

/** Bos berjalan pelan ke titik acak di atas arena; saat berguling ia melesat ke samping. */
export function moveBoss(s: GameState, dt: number) {
  const boss = s.boss!
  boss.rollCd = Math.max(0, boss.rollCd - dt)
  boss.reload = Math.max(0, boss.reload - dt)
  if (boss.roll > 0) {
    boss.roll -= dt
    boss.x += boss.rollDir * 330 * dt
  } else if (boss.reload <= 0) {
    if (Math.abs(boss.targetX - boss.x) < 4) boss.targetX = range(s, ARENA.x + 50, ARENA_RIGHT - 50)
    const speed = 55 + boss.act * 20
    boss.x += Math.sign(boss.targetX - boss.x) * Math.min(Math.abs(boss.targetX - boss.x), speed * dt)
  }
  boss.x = Math.max(ARENA.x + 30, Math.min(ARENA_RIGHT - 30, boss.x))
}

/**
 * Pemain menembak: bos mencoba berguling menghindar, kecuali sedang mengisi ulang, sedang jeda guling,
 * atau pemain memakai Mata Elang. Mengembalikan true kalau bos berguling.
 */
export function tryRoll(s: GameState): boolean {
  const boss = s.boss!
  if (boss.reload > 0 || boss.rollCd > 0 || s.deadeye.active > 0 || boss.stage !== 'fight') return false
  const chance = Math.min(0.95, BOSSES[boss.id].roll * DIFFICULTY[s.difficulty].rollChance)
  if (s.rand() > chance) return false
  boss.roll = FIGHT.rollTime
  // Berguling menjauh dari peluru (ke sisi yang lebih lapang).
  boss.rollDir = boss.x < 400 ? 1 : -1
  if (s.rand() < 0.3) boss.rollDir = -boss.rollDir as 1 | -1
  boss.rollCd = FIGHT.rollCooldown / DIFFICULTY[s.difficulty].rollChance
  boss.targetX = boss.x + boss.rollDir * 100
  return true
}

/** Titik bahaya yang sedang aktif (tempat peluru emas sengaja diletakkan supaya mengambilnya berisiko). */
function dangerSpots(s: GameState): [number, number][] {
  const spots: [number, number][] = []
  for (const h of s.hazards) {
    if (h.kind === 'blast' && h.boom < 0) spots.push([h.x + range(s, -h.r, h.r) * 0.6, h.y + range(s, -h.r, h.r) * 0.6])
    else if (h.kind === 'train') {
      const along = range(s, 30, (h.axis === 'x' ? ARENA.w : ARENA.h) - 30)
      spots.push(h.axis === 'x' ? [ARENA.x + along, ARENA.y + h.lane] : [ARENA.x + h.lane, ARENA.y + along])
    } else if (h.kind === 'spinner') {
      const a = s.rand() * Math.PI * 2
      spots.push([h.x + Math.cos(a) * 55, h.y + Math.sin(a) * 55])
    } else if (h.kind === 'barrel') spots.push([h.tx + range(s, -30, 30), h.ty + range(s, -30, 30)])
    else if (h.kind === 'bull' && h.t < h.warn) {
      const k = range(s, 0.3, 0.7)
      spots.push([h.x + h.dx * 300 * k, h.y + h.dy * 300 * k])
    }
  }
  for (const shot of s.shots) if (shot.alive && shot.entered && s.rand() < 0.05) spots.push([shot.x + shot.vx * 0.6, shot.y + shot.vy * 0.6])
  return spots
}

export function placePickup(s: GameState): Pickup | null {
  const spots = dangerSpots(s)
  for (let tries = 0; tries < 12; tries++) {
    const [x, y] =
      spots.length && s.rand() < FIGHT.pickupDanger
        ? spots[Math.floor(s.rand() * spots.length)]
        : [range(s, ARENA.x + 24, ARENA_RIGHT - 24), range(s, ARENA.y + 24, ARENA_BOTTOM - 24)]
    if (x < ARENA.x + 16 || x > ARENA_RIGHT - 16 || y < ARENA.y + 16 || y > ARENA_BOTTOM - 16) continue
    // Tidak tepat di dekat pemain (harus dijemput) dan tidak di dalam meja.
    if (Math.hypot(x - s.player.x, y - s.player.y) < 60) continue
    if (s.covers.some((c) => circleRect(x, y, 12, c))) continue
    return { x, y, t: 0, life: FIGHT.pickupLife }
  }
  return null
}

/** Duel cepat. Kata pengecoh muncul di babak 3, di Sheriff/Legenda, dan selalu di duel penentuan. */
export function makeDuel(s: GameState, final: boolean): Duel {
  const [min, max] = FIGHT.duelWait
  const signal = (final ? max : min) + s.rand() * (max - min)
  const decoys: Duel['decoys'] = []
  const tricky = final || s.difficulty !== 'koboi' || (s.boss?.act ?? 0) >= 2
  // Pengecoh muncul setelah spanduk duel hilang (1 detik) dan selalu ≥0,4 detik sebelum aba-aba asli.
  if (tricky && signal > 1.6) {
    const count = final ? 3 : 1 + Math.floor(s.rand() * 2)
    const span = signal - 0.4 - 1.05
    for (let i = 0; i < count; i++) {
      const at = 1.05 + (i / count) * span + s.rand() * Math.min(0.2, span / count - 0.5)
      if (at + 0.45 < signal - 0.3) decoys.push({ at, word: FIGHT.decoys[Math.floor(s.rand() * FIGHT.decoys.length)] })
    }
  }
  return { signal, t: 0, result: null, reaction: 0, show: 0, decoys, final }
}

/** Kata pengecoh yang sedang tampil (masing-masing 0,45 detik), atau null. */
export function activeDecoy(duel: Duel): string | null {
  const shown = duel.decoys.find((d) => duel.t >= d.at && duel.t < d.at + 0.45)
  return shown ? shown.word : null
}
