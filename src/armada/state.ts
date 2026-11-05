import { areaCells, fleetCells, pickTarget, PRESETS, shuffled, type Cell, type Placement, type PresetId } from './grid'
import { MINE_CONFIG, SKILL_CONFIG, SKILLS, type SkillId } from './skills'

/** Tanda di papan; `mine` = ranjau yang sudah meledak (terlihat semua pemain). */
export type Shot = 'miss' | 'hit' | 'mine'
/** Hasil satu tembakan; `mine` berarti mengenai ranjau dan memicu serangan balik ke papan penyerang. */
export type Result = 'miss' | 'hit' | 'sunk' | 'mine'

/** Satu serangan acak dari ledakan ranjau, di papan penyerang. */
export interface Blast {
  cell: Cell
  result: 'miss' | 'hit' | 'sunk'
  /** Nama kapal, hanya kalau tenggelam. */
  ship?: string
}

export interface Ship extends Placement {
  name: string
  size: number
  cells: Cell[]
  sunk: boolean
}

export interface Stats {
  /** Tembakan yang dilepas pemain ini. */
  shots: number
  hits: number
  misses: number
  /** Kapal lawan yang ia tenggelamkan. */
  sunk: number
  /** Sel kapalnya sendiri yang kena. */
  damage: number
  skills: number
}

export interface Player {
  name: string
  /** Armadanya sudah dikunci saat penempatan. */
  ready: boolean
  /** PRIVAT: hanya dikirim ke pemiliknya (lihat viewFor). */
  fleet: Ship[]
  /** PUBLIK: tembakan yang diterima papan ini, satu entri per sel. */
  shots: (Shot | null)[]
  alive: boolean
  /** Urutan gugur (1 = pertama gugur); null selama masih hidup. */
  out: number | null
  sp: number
  /** PRIVAT: sel ranjau yang masih aktif di papan ini (lihat viewFor). */
  mines: Cell[]
  lastTarget: number | null
  stats: Stats
}

/** Hasil Sonar. PRIVAT: hanya dikirim ke pemakainya. */
export interface Sonar {
  by: number
  target: number
  center: Cell
  count: number
}

export interface LastShot {
  /** Naik tiap tembakan, supaya animasi hasil diputar ulang untuk tembakan baru. */
  seq: number
  by: number
  target: number
  cell: Cell
  result: Result
  /** Nama kapal, hanya kalau tenggelam (kena biasa tidak membocorkan kapal mana). */
  ship?: string
  /** Target gugur oleh tembakan ini. */
  out?: boolean
  /** Hanya untuk `mine`: serangan balik di papan penyerang. */
  blasts?: Blast[]
  /** Penyerang gugur oleh ledakan ranjau. */
  selfOut?: boolean
}

/**
 * - `placement`: tiap pemain menyusun armadanya lalu menekan SIAP.
 * - `start`: semua armada terkunci; sebentar lagi giliran pertama.
 * - `target`: target penyerang sedang diundi (animasi).
 * - `aim`: penyerang memilih sel di papan target; boleh memakai skill.
 * - `result`: hasil tembakan terakhir ditampilkan sebelum giliran berikutnya.
 * - `over`: tinggal satu pemain yang masih punya kapal.
 */
export type Phase = 'placement' | 'start' | 'target' | 'aim' | 'result' | 'over'

export interface ArmadaState {
  preset: PresetId
  players: Player[]
  phase: Phase
  round: number
  /** Urutan giliran ronde ini (diacak tiap ronde). */
  order: number[]
  /** Posisi giliran sekarang di `order`. */
  turn: number
  attacker: number | null
  target: number | null
  /** Sisa tembakan di giliran ini: 1, atau 2 dengan Tembakan Ganda. */
  shotsLeft: number
  /** Tembakan yang sudah dilepas di giliran ini. */
  fired: number
  sonarUsed: boolean
  doubleUsed: boolean
  sonar: Sonar | null
  last: LastShot | null
  winner: number | null
  log: string[]
}

/** Aksi dari pemain; host menambahkan `by` (kursi pengirim) sebelum dijalankan. */
export type PlayerAction =
  | { type: 'ready'; fleet: Placement[] | null }
  /** `roll` diisi host (angka acak 0–1) untuk ledakan ranjau; isian dari tamu ditimpa. */
  | { type: 'fire'; cell: Cell; roll?: number }
  | { type: 'skill'; skill: SkillId; center?: Cell }

export type Action =
  | (PlayerAction & { by: number })
  // Hanya dijalankan host:
  | { type: 'begin'; fleets: (Placement[] | null)[] }
  | { type: 'turn'; order: number[]; turn: number; target: number }
  | { type: 'aim' }

const LOG_SIZE = 8

function log(s: ArmadaState, text: string) {
  s.log = [...s.log, text].slice(-LOG_SIZE)
}

function emptyStats(): Stats {
  return { shots: 0, hits: 0, misses: 0, sunk: 0, damage: 0, skills: 0 }
}

export function newGame(names: string[], preset: PresetId): ArmadaState {
  const { size } = PRESETS[preset]
  return {
    preset,
    players: names.map((name) => ({
      name,
      ready: false,
      fleet: [],
      shots: Array.from({ length: size * size }, () => null),
      alive: true,
      out: null,
      sp: SKILL_CONFIG.start,
      mines: [],
      lastTarget: null,
      stats: emptyStats(),
    })),
    phase: 'placement',
    round: 0,
    order: [],
    turn: -1,
    attacker: null,
    target: null,
    shotsLeft: 0,
    fired: 0,
    sonarUsed: false,
    doubleUsed: false,
    sonar: null,
    last: null,
    winner: null,
    log: [],
  }
}

export function aliveSeats(s: { players: { alive: boolean }[] }): number[] {
  return s.players.map((player, i) => (player.alive ? i : -1)).filter((i) => i >= 0)
}

/** Kapal dari susunan yang sudah dicek sah (`fleetCells`). */
function buildFleet(fleet: Placement[], s: ArmadaState): Ship[] | null {
  const preset = PRESETS[s.preset]
  const cells = fleetCells(fleet, preset)
  if (!cells) return null
  return preset.ships.map((spec, i) => {
    const { cell, dir } = fleet.find((p) => p.id === spec.id)!
    return { id: spec.id, name: spec.name, size: spec.size, cell, dir, cells: cells[i], sunk: false }
  })
}

function gainSp(player: Player, amount: number) {
  player.sp = Math.min(SKILL_CONFIG.max, player.sp + amount)
}

/**
 * Giliran berikutnya: pemain hidup berikutnya di `order`; kalau ronde habis, urutan baru diacak.
 * Dijalankan host (butuh angka acak), hasilnya dikirim sebagai aksi `turn`.
 */
export function planTurn(s: ArmadaState, rand: () => number = Math.random): Action | null {
  const alive = aliveSeats(s)
  if (alive.length < 2) return null
  let order = s.order
  let turn = s.turn + 1
  while (turn < order.length && !s.players[order[turn]].alive) turn++
  if (turn >= order.length) {
    order = shuffled(alive, rand)
    // Penyerang terakhir ronde lalu tidak langsung menyerang lagi di awal ronde baru.
    if (order[0] === s.attacker) [order[0], order[1]] = [order[1], order[0]]
    turn = 0
  }
  const attacker = order[turn]
  return { type: 'turn', order, turn, target: pickTarget(attacker, alive, s.players[attacker].lastTarget, rand) }
}

/** PRNG kecil (mulberry32): ledakan ranjau ditentukan dari satu angka acak dari host. */
function seeded(seed: number): () => number {
  let a = Math.floor(seed * 2 ** 32) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

/** Menandai sel kapal yang kena di papan `victim`; mengembalikan kapal itu kalau tenggelam. */
function strikeShip(s: ArmadaState, victim: Player, cell: Cell): Ship | null {
  const ship = victim.fleet.find((candidate) => candidate.cells.includes(cell))!
  victim.shots[cell] = 'hit'
  victim.stats.damage++
  gainSp(victim, SKILL_CONFIG.hit)
  ship.sunk = ship.cells.every((c) => victim.shots[c] === 'hit')
  if (!ship.sunk) return null
  gainSp(victim, SKILL_CONFIG.sunk)
  victim.alive = victim.fleet.some((other) => !other.sunk)
  if (!victim.alive) {
    victim.out = s.players.filter((player) => player.out !== null).length + 1
    victim.mines = []
  }
  return ship
}

/**
 * Ranjau meledak: `MINE_CONFIG.blasts` sel acak yang belum ditembak di papan penyerang diserang.
 * Ranjau milik penyerang sendiri tidak ikut dipilih (tidak ada ledakan berantai).
 */
function detonate(s: ArmadaState, owner: Player, shooter: Player, roll: number): Blast[] {
  const free = shooter.shots.flatMap((shot, c) => (shot === null && !shooter.mines.includes(c) ? [c] : []))
  const blasts: Blast[] = []
  for (const c of shuffled(free, seeded(roll)).slice(0, MINE_CONFIG.blasts)) {
    if (!shooter.alive) break
    if (!shooter.fleet.some((ship) => ship.cells.includes(c))) {
      shooter.shots[c] = 'miss'
      blasts.push({ cell: c, result: 'miss' })
      continue
    }
    owner.stats.hits++
    const sunk = strikeShip(s, shooter, c)
    if (sunk) owner.stats.sunk++
    blasts.push(sunk ? { cell: c, result: 'sunk', ship: sunk.name } : { cell: c, result: 'hit' })
  }
  return blasts
}

function fire(s: ArmadaState, cell: Cell, roll: number): boolean {
  const by = s.attacker
  const target = s.target
  if (by === null || target === null) return false
  const victim = s.players[target]
  const shooter = s.players[by]
  if (!Number.isInteger(cell) || cell < 0 || cell >= victim.shots.length || victim.shots[cell] !== null) return false

  s.fired++
  s.shotsLeft--
  shooter.stats.shots++
  gainSp(victim, SKILL_CONFIG.target)
  const seq = (s.last?.seq ?? 0) + 1

  if (victim.mines.includes(cell)) {
    victim.mines = victim.mines.filter((c) => c !== cell)
    victim.shots[cell] = 'mine'
    shooter.stats.misses++
    // Ledakan ranjau mengakhiri giliran, termasuk sisa Tembakan Ganda.
    s.shotsLeft = 0
    const blasts = detonate(s, victim, shooter, roll)
    s.last = { seq, by, target, cell, result: 'mine', blasts, selfOut: !shooter.alive }
    const hits = blasts.filter((blast) => blast.result !== 'miss').length
    log(s, `${shooter.name} kena RANJAU ${victim.name}! ${blasts.length} serangan balik, ${hits} kena.`)
    for (const blast of blasts) if (blast.ship) log(s, `${blast.ship} milik ${shooter.name} tenggelam oleh ranjau!`)
    if (!shooter.alive) log(s, `${shooter.name} gugur!`)
  } else if (!victim.fleet.some((ship) => ship.cells.includes(cell))) {
    victim.shots[cell] = 'miss'
    shooter.stats.misses++
    s.last = { seq, by, target, cell, result: 'miss' }
    log(s, `${shooter.name} ➜ ${victim.name}: meleset.`)
  } else {
    shooter.stats.hits++
    const ship = strikeShip(s, victim, cell)
    if (!ship) {
      s.last = { seq, by, target, cell, result: 'hit' }
      log(s, `${shooter.name} ➜ ${victim.name}: KENA!`)
    } else {
      shooter.stats.sunk++
      s.last = { seq, by, target, cell, result: 'sunk', ship: ship.name, out: !victim.alive }
      log(s, `${shooter.name} menenggelamkan ${ship.name} milik ${victim.name}!`)
      if (!victim.alive) log(s, `${victim.name} gugur!`)
    }
  }

  const alive = aliveSeats(s)
  if (alive.length <= 1) {
    s.phase = 'over'
    s.winner = alive[0] ?? null
    if (s.winner !== null) log(s, `${s.players[s.winner].name} menang!`)
  } else if (s.shotsLeft <= 0 || !victim.alive || !shooter.alive) s.phase = 'result'
  return true
}

function useSkill(s: ArmadaState, by: number, skill: SkillId, center: unknown): boolean {
  const player = s.players[by]
  if (!player?.alive || player.sp < SKILLS[skill].cost) return false
  const myAim = s.phase === 'aim' && s.attacker === by
  switch (skill) {
    case 'mine': {
      if (!['start', 'target', 'aim', 'result'].includes(s.phase) || player.mines.length >= MINE_CONFIG.limit) return false
      // Hanya di sel kosong papan sendiri: belum ditembak, bukan kapal, belum ada ranjau.
      const cell = center
      if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell >= player.shots.length) return false
      if (player.shots[cell] !== null || player.mines.includes(cell) || player.fleet.some((ship) => ship.cells.includes(cell))) return false
      player.mines = [...player.mines, cell]
      log(s, `${player.name} memasang Ranjau.`)
      break
    }
    case 'sonar': {
      const target = s.target
      if (!myAim || s.sonarUsed || target === null) return false
      const size = PRESETS[s.preset].size
      if (typeof center !== 'number' || !Number.isInteger(center) || center < 0 || center >= size * size) return false
      const victim = s.players[target]
      const count = areaCells(center, size).filter(
        (c) => victim.shots[c] !== 'hit' && victim.fleet.some((ship) => ship.cells.includes(c)),
      ).length
      s.sonar = { by, target, center, count }
      s.sonarUsed = true
      log(s, `${player.name} memakai Sonar.`)
      break
    }
    case 'double':
      if (!myAim || s.fired > 0 || s.doubleUsed) return false
      s.shotsLeft = 2
      s.doubleUsed = true
      log(s, `${player.name} menyiapkan Tembakan Ganda!`)
      break
  }
  player.sp -= SKILLS[skill].cost
  player.stats.skills++
  return true
}

export function reducer(state: ArmadaState, action: Action): ArmadaState {
  const s = structuredClone(state)
  switch (action.type) {
    case 'ready': {
      const player = s.players[action.by]
      if (s.phase !== 'placement' || !player) return state
      if (action.fleet === null) {
        if (!player.ready) return state
        player.ready = false
        return s
      }
      const fleet = buildFleet(action.fleet, s)
      if (!fleet) return state
      player.fleet = fleet
      player.ready = true
      return s
    }
    case 'begin': {
      if (s.phase !== 'placement') return state
      for (const [i, player] of s.players.entries()) {
        if (player.ready) continue
        const fleet = buildFleet(action.fleets[i] ?? [], s)
        if (!fleet) return state
        player.fleet = fleet
        player.ready = true
      }
      s.phase = 'start'
      log(s, 'Semua armada siap. Pertempuran dimulai!')
      return s
    }
    case 'turn': {
      if (s.phase !== 'start' && s.phase !== 'result') return state
      const attacker = action.order[action.turn]
      if (!s.players[attacker]?.alive || !s.players[action.target]?.alive || attacker === action.target) return state
      if (action.turn === 0) {
        s.round++
        log(s, `Ronde ${s.round}.`)
      }
      s.order = action.order
      s.turn = action.turn
      s.attacker = attacker
      s.target = action.target
      s.players[attacker].lastTarget = action.target
      s.phase = 'target'
      s.shotsLeft = 1
      s.fired = 0
      s.sonarUsed = false
      s.doubleUsed = false
      s.sonar = null
      return s
    }
    case 'aim':
      if (s.phase !== 'target') return state
      s.phase = 'aim'
      return s
    case 'fire':
      if (s.phase !== 'aim' || s.attacker !== action.by || !fire(s, action.cell, action.roll ?? Math.random())) return state
      return s
    case 'skill':
      return useSkill(s, action.by, action.skill, action.center) ? s : state
    default:
      return state
  }
}

export interface PlayerView extends Omit<Player, 'fleet' | 'mines' | 'lastTarget'> {
  /** Armada lengkap: hanya milik sendiri, atau semua pemain setelah permainan selesai. */
  fleet: Ship[] | null
  /** Ranjau aktif: seperti armada, hanya milik sendiri atau semua setelah permainan selesai. */
  mines: Cell[] | null
  /** Kapal yang sudah tenggelam; posisinya boleh diketahui semua pemain. */
  sunk: Ship[]
  afloat: number
}

export interface ArmadaView extends Omit<ArmadaState, 'players'> {
  players: PlayerView[]
}

/**
 * State yang dikirim ke kursi `seat`. Posisi kapal lawan yang belum tenggelam, ranjau lawan, dan
 * hasil Sonar pemain lain tidak pernah ikut terkirim.
 */
export function viewFor(s: ArmadaState, seat: number): ArmadaView {
  const reveal = s.phase === 'over'
  return {
    ...s,
    players: s.players.map(({ fleet, mines, lastTarget: _lastTarget, ...player }, i) => ({
      ...player,
      fleet: i === seat || reveal ? fleet : null,
      mines: i === seat || reveal ? mines : null,
      sunk: fleet.filter((ship) => ship.sunk),
      afloat: fleet.filter((ship) => !ship.sunk).length,
    })),
    sonar: s.sonar?.by === seat ? s.sonar : null,
  }
}
