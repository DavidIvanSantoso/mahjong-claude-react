import { ARENA, type PatternId } from './config'
import {
  ARENA_BOTTOM,
  ARENA_CX,
  ARENA_CY,
  ARENA_RIGHT,
  edgePoint,
  inward,
  pick,
  puff,
  range,
  spawnShot,
  type Edge,
  type GameState,
  type Run,
} from './state'

/**
 * Delapan pola serangan KOBOI. Tiap pola adalah garis waktu: daftar aksi pada detik tertentu (menaruh
 * tanda peringatan, menembak, melempar dinamit). Peluru dan hazard yang dibuat lalu diurus sistem di
 * engine.ts, jadi pola tidak menyentuh loop utama. `lv` = tingkat kesulitan (0 mudah … ±1,6 sulit).
 *
 * Aturan keadilan yang dipegang semua pola: selalu ada tanda sebelum kerusakan, tidak pernah langsung
 * muncul di atas pemain, dan selalu ada celah/jalur aman.
 */

type Action = [number, () => void]

function timeline(id: PatternId, duration: number, actions: Action[]): Run {
  actions.sort((a, b) => a[0] - b[0])
  let next = 0
  const run: Run = {
    id,
    t: 0,
    duration,
    step: (dt) => {
      run.t += dt
      while (next < actions.length && actions[next][0] <= run.t) actions[next++][1]()
    },
  }
  return run
}

const EDGES: Edge[] = ['top', 'bottom', 'left', 'right']

/** Posisi penembak di luar sisi `edge`, sedikit menjauh dari tepi. */
function gunSpot(s: GameState, edge: Edge): [number, number] {
  return edgePoint(edge, range(s, 0.15, 0.85), 34)
}

// ---------- 1. Kipas Revolver ----------

export function revolverFan(s: GameState, lv: number, fromBoss = false): Run {
  const volleys = 3 + Math.round(lv * 1.6)
  const gap = Math.max(0.6, 0.95 - lv * 0.22)
  const count = 5 + Math.round(lv * 2.5)
  const speed = 150 + lv * 70
  const spread = range(s, 0.75, 1.05) + lv * 0.12
  const edges: Edge[] = fromBoss ? ['top'] : ['top', 'left', 'right']
  const actions: Action[] = []
  const warn = 0.55
  for (let v = 0; v < volleys; v++) {
    const at = warn + v * gap
    if (fromBoss) {
      // Bos mengangkat revolver (tanda) lalu menembak dari posisinya saat itu, ke sekitar pemain.
      actions.push([at - warn * 0.9, () => s.boss && (s.boss.draw = warn)])
      actions.push([
        at,
        () => {
          const boss = s.boss
          if (!boss) return
          const gx = boss.x + 20
          const gy = boss.y - 6
          const base = Math.atan2(s.player.y - gy, s.player.x - gx) + range(s, -0.3, 0.3)
          for (let i = 0; i < count; i++) {
            const angle = base + spread * (i / (count - 1) - 0.5)
            spawnShot(s, 'bullet', 'fan', gx, gy, Math.cos(angle) * speed, Math.sin(angle) * speed)
          }
          puff(s, gx, gy, 5, '#ffe08a', 'spark', 90, 3)
          s.events.push('shot')
        },
      ])
      continue
    }
    const edge = pick(s, edges)
    const [gx, gy] = gunSpot(s, edge)
    // Arah tembakan: ke tengah arena, digeser acak supaya celahnya berpindah-pindah.
    const base = Math.atan2(ARENA_CY - gy, ARENA_CX - gx) + range(s, -0.22, 0.22)
    actions.push([
      at - warn * 0.9,
      () => s.hazards.push({ kind: 'gunman', pattern: 'fan', x: gx, y: gy, aim: base, t: 0, life: warn + 0.35, flash: 0, glint: warn * 0.9 }),
    ])
    actions.push([
      at,
      () => {
        for (let i = 0; i < count; i++) {
          const angle = base + spread * (i / (count - 1) - 0.5)
          spawnShot(s, 'bullet', 'fan', gx, gy, Math.cos(angle) * speed, Math.sin(angle) * speed)
        }
        const gun = s.hazards.find((h) => h.kind === 'gunman' && h.x === gx && h.y === gy)
        if (gun && gun.kind === 'gunman') gun.flash = 0.12
        if (s.boss) s.boss.draw = 0.25
        s.events.push('shot')
      },
    ])
  }
  return timeline('fan', warn + volleys * gap + 1.4, actions)
}

// ---------- 2. Peluru Pantul ----------

/** Lintasan pantulan di dalam arena dari (x,y) dengan arah (dx,dy), sampai `bounces` pantulan. */
export function bouncePath(x: number, y: number, dx: number, dy: number, bounces: number): [number, number][] {
  const points: [number, number][] = [[x, y]]
  for (let b = 0; b <= bounces; b++) {
    const tx = dx > 0 ? (ARENA_RIGHT - x) / dx : dx < 0 ? (ARENA.x - x) / dx : Infinity
    const ty = dy > 0 ? (ARENA_BOTTOM - y) / dy : dy < 0 ? (ARENA.y - y) / dy : Infinity
    const t = Math.min(tx, ty)
    x += dx * t
    y += dy * t
    points.push([x, y])
    if (tx < ty) dx = -dx
    else dy = -dy
  }
  return points
}

export function ricochetRound(s: GameState, lv: number): Run {
  const count = 3 + Math.round(lv * 1.8)
  const gap = Math.max(0.75, 1.15 - lv * 0.3)
  const warn = Math.max(0.5, 0.8 - lv * 0.18)
  const speed = 175 + lv * 55
  const bounces = lv > 0.9 ? 3 : 2
  const actions: Action[] = []
  for (let i = 0; i < count; i++) {
    actions.push([
      i * gap,
      () => {
        // Titik masuk di dinding yang jauh dari pemain (tidak pernah muncul tepat di dekatnya).
        let edge: Edge = pick(s, EDGES)
        let [x, y] = edgePoint(edge, range(s, 0.1, 0.9))
        for (let tries = 0; tries < 8 && Math.hypot(x - s.player.x, y - s.player.y) < 120; tries++) {
          edge = pick(s, EDGES)
          ;[x, y] = edgePoint(edge, range(s, 0.1, 0.9))
        }
        const [nx, ny] = inward(edge)
        const tilt = range(s, 0.45, 1.05) * (s.rand() < 0.5 ? -1 : 1)
        const dx = nx * Math.cos(tilt) - ny * Math.sin(tilt)
        const dy = nx * Math.sin(tilt) + ny * Math.cos(tilt)
        s.hazards.push({ kind: 'path', pattern: 'ricochet', points: bouncePath(x, y, dx, dy, bounces), warn, t: 0 })
        // Peluru menyusul setelah lintasannya terlihat.
        s.hazards.push({ kind: 'gunman', pattern: 'ricochet', x: x - nx * 30, y: y - ny * 30, aim: Math.atan2(dy, dx), t: 0, life: warn + 0.3, flash: 0, glint: warn })
        const fireAt = s.time + warn
        const fire = () => {
          spawnShot(s, 'bullet', 'ricochet', x, y, dx * speed, dy * speed, { bounces, entered: true, life: 7 })
          s.events.push('ricochet')
        }
        pending.push([fireAt, fire])
      },
    ])
  }
  // Tembakan tertunda dijalankan berdasarkan waktu permainan (bisa melewati batas aksi di atas).
  const pending: [number, () => void][] = []
  const run = timeline('ricochet', count * gap + warn + 2.2, actions)
  const base = run.step
  run.step = (dt) => {
    base(dt)
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i][0] <= s.time) {
        pending[i][1]()
        pending.splice(i, 1)
      }
    }
  }
  return run
}

// ---------- 3. Dinamit ----------

export function dynamiteWarning(s: GameState, lv: number): Run {
  const count = 4 + Math.round(lv * 2.5)
  const gap = Math.max(0.42, 0.72 - lv * 0.2)
  const fuse = Math.max(0.9, 1.35 - lv * 0.3)
  const radius = 44 + lv * 10
  const actions: Action[] = []
  for (let i = 0; i < count; i++) {
    actions.push([
      i * gap,
      () => {
        // Separuh dinamit diarahkan ke dekat pemain (memaksa bergerak), sisanya acak.
        const near = s.rand() < 0.5
        const x = near ? s.player.x + range(s, -50, 50) : range(s, ARENA.x + 30, ARENA_RIGHT - 30)
        const y = near ? s.player.y + range(s, -40, 40) : range(s, ARENA.y + 30, ARENA_BOTTOM - 30)
        s.hazards.push({
          kind: 'blast',
          pattern: 'dynamite',
          x: Math.max(ARENA.x + 16, Math.min(ARENA_RIGHT - 16, x)),
          y: Math.max(ARENA.y + 16, Math.min(ARENA_BOTTOM - 16, y)),
          r: radius,
          fuse,
          total: fuse,
          boom: -1,
          fromX: s.boss ? s.boss.x : s.rand() < 0.5 ? ARENA.x - 60 : ARENA_RIGHT + 60,
          fromY: s.boss ? s.boss.y - 20 : ARENA.y - 40,
          hurt: false,
          t: 0,
          style: 'dynamite',
          kick: s.boss?.id === 'dinamit',
          kicked: false,
        })
        if (s.boss) s.boss.draw = 0.3
        s.events.push('fuse')
      },
    ])
  }
  return timeline('dynamite', count * gap + fuse + 0.8, actions)
}

// ---------- 4. Semak Gulung ----------

export function tumbleweedRoll(s: GameState, lv: number): Run {
  const count = 4 + Math.round(lv * 2.5)
  const gap = Math.max(0.5, 0.95 - lv * 0.28)
  const warn = 0.5
  const actions: Action[] = []
  for (let i = 0; i < count; i++) {
    const at = i * gap
    actions.push([
      at,
      () => {
        const fromLeft = s.rand() < 0.5
        const y = range(s, ARENA.y + 28, ARENA_BOTTOM - 22)
        const edge: Edge = fromLeft ? 'left' : 'right'
        const along = (y - ARENA.y) / ARENA.h
        s.hazards.push({ kind: 'lane', pattern: 'tumbleweed', edge, from: along - 0.06, to: along + 0.06, safe: false, warn, t: 0 })
        const speed = (115 + lv * 75) * range(s, 0.85, 1.2)
        const curve = range(s, -18, 18)
        later.push([
          s.time + warn,
          () => {
            spawnShot(s, 'tumbleweed', 'tumbleweed', fromLeft ? ARENA.x - 20 : ARENA_RIGHT + 20, y, fromLeft ? speed : -speed, 0, {
              ay: curve,
              baseY: y,
              hop: range(s, 6, 14),
              life: 8,
            })
            s.events.push('tumble')
          },
        ])
      },
    ])
  }
  const later: [number, () => void][] = []
  return withLater(s, timeline('tumbleweed', count * gap + warn + 3.2, actions), later)
}

/** Menambahkan aksi tertunda (berdasarkan waktu permainan) ke sebuah pola. */
function withLater(s: GameState, run: Run, later: [number, () => void][]): Run {
  const base = run.step
  run.step = (dt) => {
    base(dt)
    for (let i = later.length - 1; i >= 0; i--) {
      if (later[i][0] <= s.time) {
        later[i][1]()
        later.splice(i, 1)
      }
    }
  }
  return run
}

// ---------- 5. Duri Kaktus ----------

export function cactusBarrage(s: GameState, lv: number): Run {
  const bursts = 3 + (lv > 0.8 ? 1 : 0)
  const gap = Math.max(1, 1.45 - lv * 0.3)
  const warn = Math.max(0.6, 0.95 - lv * 0.25)
  const lanes = 8
  const safeLanes = lv < 0.6 ? 2 : 1
  const speed = 190 + lv * 70
  const actions: Action[] = []
  const later: [number, () => void][] = []
  let lastSafe = -1
  for (let b = 0; b < bursts; b++) {
    actions.push([
      b * gap,
      () => {
        const edge = pick(s, EDGES)
        // Celah aman berpindah tiap semburan, supaya pemain harus bergeser.
        let safe = Math.floor(s.rand() * (lanes - safeLanes + 1))
        if (safe === lastSafe) safe = (safe + 3) % (lanes - safeLanes + 1)
        lastSafe = safe
        for (let i = 0; i < lanes; i++) {
          const isSafe = i >= safe && i < safe + safeLanes
          s.hazards.push({ kind: 'lane', pattern: 'cactus', edge, from: i / lanes, to: (i + 1) / lanes, safe: isSafe, warn, t: 0 })
          if (isSafe) continue
          const [nx, ny] = inward(edge)
          for (const k of [0.3, 0.7]) {
            const [x, y] = edgePoint(edge, (i + k) / lanes, 8)
            later.push([
              s.time + warn + k * 0.12,
              () => spawnShot(s, 'thorn', 'cactus', x, y, nx * speed, ny * speed, { life: 4 }),
            ])
          }
        }
        later.push([s.time + warn, () => s.events.push('thorn')])
      },
    ])
  }
  return withLater(s, timeline('cactus', bursts * gap + warn + 1.8, actions), later)
}

// ---------- 6. Sabetan Laso ----------

export function lassoSweep(s: GameState, lv: number): Run {
  const warn = Math.max(0.65, 1.05 - lv * 0.28)
  const actions: Action[] = []
  const sweeps = lv < 0.5 ? 2 : 3
  for (let i = 0; i < sweeps; i++) {
    const at = i * (warn + 1.25)
    if (i % 2 === 0) {
      actions.push([
        at,
        () => {
          // Laso berporos di salah satu sudut, menyapu 90°; ujung jauh arena aman.
          const corner = Math.floor(s.rand() * 4)
          const px = corner % 2 === 0 ? ARENA.x : ARENA_RIGHT
          const py = corner < 2 ? ARENA.y : ARENA_BOTTOM
          const toward = Math.atan2(ARENA_CY - py, ARENA_CX - px)
          const clockwise = s.rand() < 0.5
          const length = Math.hypot(ARENA.w, ARENA.h) * (0.62 - lv * 0.02)
          s.hazards.push({
            kind: 'arc',
            pattern: 'lasso',
            px,
            py,
            length,
            from: toward + (clockwise ? -Math.PI / 4 : Math.PI / 4),
            to: toward + (clockwise ? Math.PI / 4 : -Math.PI / 4),
            warn,
            sweep: Math.max(0.6, 1 - lv * 0.25),
            t: 0,
          })
          s.events.push('whip-warn')
        },
      ])
    } else {
      actions.push([
        at,
        () => {
          // Tali melintang yang bergerak, dengan simpul laso sebagai satu-satunya celah.
          const axis: 'x' | 'y' = s.rand() < 0.5 ? 'x' : 'y'
          const dir: 1 | -1 = s.rand() < 0.5 ? 1 : -1
          const span = axis === 'y' ? ARENA.w : ARENA.h
          const gapSize = Math.max(48, 74 - lv * 16)
          const gap = range(s, gapSize, span - gapSize)
          const start = axis === 'y' ? (dir === 1 ? ARENA.y : ARENA_BOTTOM) : dir === 1 ? ARENA.x : ARENA_RIGHT
          s.hazards.push({ kind: 'rope', pattern: 'lasso', axis, dir, pos: start, speed: 120 + lv * 45, gap, gapSize, warn, t: 0 })
          s.events.push('whip-warn')
        },
      ])
    }
  }
  return timeline('lasso', sweeps * (warn + 1.25) + 1.6, actions)
}

// ---------- 7. Tanda Buronan ----------

export function wantedMark(s: GameState, lv: number): Run {
  const count = 3 + Math.round(lv * 1.8)
  const gap = Math.max(0.75, 1.1 - lv * 0.25)
  const lock = Math.max(0.34, 0.52 - lv * 0.12)
  const actions: Action[] = []
  for (let i = 0; i < count; i++) {
    actions.push([
      i * gap,
      () => {
        const edge = pick(s, s.boss ? (['top'] as Edge[]) : EDGES)
        const [gx, gy] = s.boss ? [s.boss.x + 20, s.boss.y - 6] : gunSpot(s, edge)
        // Bos (dan gelombang tinggi) membidik ke depan arah gerak pemain, bukan posisinya sekarang.
        const lead = s.boss ? (s.boss.act >= 1 || s.boss.id === 'elang' ? 0.35 : 0) : lv > 1 ? 0.25 : 0
        s.hazards.push({ kind: 'mark', pattern: 'mark', x: s.player.x, y: s.player.y, r: 17, follow: 0.85, lock, t: 0, fired: -1, gx, gy, lead })
        s.events.push('mark')
      },
    ])
  }
  return timeline('mark', count * gap + 0.85 + lock + 0.8, actions)
}

// ---------- 8. Badai Debu ----------

export function dustStorm(s: GameState, lv: number): Run {
  const walls = 3 + Math.round(lv * 1.6)
  const gap = Math.max(0.95, 1.4 - lv * 0.3)
  const warn = 0.6
  const speed = 95 + lv * 45
  const gapSize = Math.max(52, 92 - lv * 26)
  const actions: Action[] = []
  const later: [number, () => void][] = []
  for (let w = 0; w < walls; w++) {
    actions.push([
      w * gap,
      () => {
        const edge = pick(s, EDGES)
        const horizontal = edge === 'top' || edge === 'bottom'
        const span = horizontal ? ARENA.w : ARENA.h
        const hole = range(s, gapSize * 0.6, span - gapSize * 0.6)
        s.hazards.push({ kind: 'lane', pattern: 'dust', edge, from: (hole - gapSize / 2) / span, to: (hole + gapSize / 2) / span, safe: true, warn, t: 0 })
        const [nx, ny] = inward(edge)
        later.push([
          s.time + warn,
          () => {
            for (let d = 6; d < span; d += 15) {
              if (Math.abs(d - hole) < gapSize / 2) continue
              for (const row of [0, 1]) {
                const [x, y] = edgePoint(edge, d / span, 10 + row * 14)
                const wobble = row ? 7 : 0
                spawnShot(s, 'dust', 'dust', x + (horizontal ? wobble : 0), y + (horizontal ? 0 : wobble), nx * speed, ny * speed, { life: 6 })
              }
            }
            s.events.push('dust')
          },
        ])
      },
    ])
  }
  return withLater(s, timeline('dust', walls * gap + warn + span() / speed + 0.6, actions), later)
}

function span() {
  return Math.max(ARENA.w, ARENA.h)
}

// ---------- 9. Kereta Hantu ----------

export function ghostTrain(s: GameState, lv: number): Run {
  const trains = 2 + (lv > 0.7 ? 1 : 0)
  const gap = Math.max(1.1, 1.6 - lv * 0.3)
  const warn = Math.max(0.85, 1.25 - lv * 0.25)
  const band = 58
  const actions: Action[] = []
  let lastLane = -1
  for (let i = 0; i < trains; i++) {
    actions.push([
      i * gap,
      () => {
        // Jalur mendatar (paling sering) atau tegak; tidak di jalur yang sama dua kali berturut-turut.
        const axis: 'x' | 'y' = s.rand() < 0.7 ? 'x' : 'y'
        const span = axis === 'x' ? ARENA.h : ARENA.w
        let lane = range(s, band / 2, span - band / 2)
        if (lastLane >= 0 && Math.abs(lane - lastLane) < band) lane = lane > span / 2 ? lane - band * 1.5 : lane + band * 1.5
        lastLane = lane
        const dir: 1 | -1 = s.rand() < 0.5 ? 1 : -1
        const length = 230
        const start = axis === 'x' ? (dir === 1 ? ARENA.x - length - 40 : ARENA_RIGHT + 40) : dir === 1 ? ARENA.y - length - 40 : ARENA_BOTTOM + 40
        s.hazards.push({ kind: 'train', pattern: 'train', axis, lane, band, dir, pos: start, length, speed: 520 + lv * 130, warn, t: 0 })
        s.events.push('horn')
      },
    ])
  }
  return timeline('train', trains * gap + warn + 1.6, actions)
}

// ---------- 10. Banteng Seruduk ----------

export function bullCharge(s: GameState, lv: number): Run {
  const bulls = 3 + Math.round(lv * 1.5)
  const gap = Math.max(0.8, 1.2 - lv * 0.25)
  const warn = Math.max(0.6, 0.9 - lv * 0.2)
  const actions: Action[] = []
  for (let i = 0; i < bulls; i++) {
    actions.push([
      i * gap,
      () => {
        // Banteng masuk dari tepi dan membidik posisi pemain SAAT INI (bukan mengejar).
        const edge = pick(s, EDGES)
        const [x, y] = edgePoint(edge, range(s, 0.1, 0.9), 26)
        const dx = s.player.x - x
        const dy = s.player.y - y
        const len = Math.hypot(dx, dy) || 1
        s.hazards.push({ kind: 'bull', pattern: 'bull', x, y, dx: dx / len, dy: dy / len, speed: 330 + lv * 110, r: 15, warn, t: 0 })
        s.events.push('snort')
      },
    ])
  }
  return timeline('bull', bulls * gap + warn + 1.6, actions)
}

// ---------- 11. Putaran Peluru ----------

export function spiralShot(s: GameState, lv: number): Run {
  const fire = 2.6 + lv * 0.6
  const actions: Action[] = [
    [
      0,
      () => {
        // Silinder muncul jauh dari pemain; lengan spiral berputar pelan sehingga celahnya bisa diikuti.
        let x = 0
        let y = 0
        for (let tries = 0; tries < 20; tries++) {
          x = range(s, ARENA.x + 70, ARENA_RIGHT - 70)
          y = range(s, ARENA.y + 60, ARENA_BOTTOM - 60)
          if (Math.hypot(x - s.player.x, y - s.player.y) > 150) break
        }
        s.hazards.push({
          kind: 'spinner',
          pattern: 'spiral',
          x,
          y,
          arms: 3 + Math.round(lv * 1.2),
          angle: s.rand() * Math.PI * 2,
          spin: (s.rand() < 0.5 ? -1 : 1) * (1.5 + lv * 0.5),
          speed: 105 + lv * 35,
          warn: 0.8,
          fire,
          every: Math.max(0.1, 0.15 - lv * 0.03),
          next: 0,
          t: 0,
        })
        s.events.push('spin')
      },
    ],
  ]
  return timeline('spiral', 0.8 + fire + 2.4, actions)
}

// ---------- 12. Tong Mesiu ----------

export function powderBarrel(s: GameState, lv: number): Run {
  const barrels = 2 + Math.round(lv * 1.4)
  const gap = Math.max(0.8, 1.25 - lv * 0.25)
  const fuse = Math.max(0.75, 1.05 - lv * 0.2)
  const actions: Action[] = []
  for (let i = 0; i < barrels; i++) {
    actions.push([
      i * gap,
      () => {
        const edge = pick(s, EDGES)
        const [fx, fy] = edgePoint(edge, range(s, 0.2, 0.8), 30)
        let tx = 0
        let ty = 0
        for (let tries = 0; tries < 20; tries++) {
          tx = range(s, ARENA.x + 50, ARENA_RIGHT - 50)
          ty = range(s, ARENA.y + 45, ARENA_BOTTOM - 45)
          if (Math.hypot(tx - s.player.x, ty - s.player.y) > 110) break
        }
        s.hazards.push({ kind: 'barrel', pattern: 'barrel', x: fx, y: fy, fromX: fx, fromY: fy, tx, ty, roll: 0.7, fuse, pieces: 12 + Math.round(lv * 5), speed: 125 + lv * 40, t: 0, burst: false })
        s.events.push('tumble')
      },
    ])
  }
  return timeline('barrel', barrels * gap + 0.7 + fuse + 2.4, actions)
}

// ---------- Khusus bos: Lampu Gantung ----------

export function chandelier(s: GameState, lv: number): Run {
  const count = 4 + Math.round(lv * 2)
  const gap = Math.max(0.45, 0.75 - lv * 0.2)
  const fuse = Math.max(0.9, 1.25 - lv * 0.25)
  const actions: Action[] = []
  for (let i = 0; i < count; i++) {
    actions.push([
      i * gap,
      () => {
        // Bos menembak tali lampu: bayangannya membesar di lantai sebelum lampu jatuh.
        const near = s.rand() < 0.45
        const x = near ? s.player.x + range(s, -60, 60) : range(s, ARENA.x + 30, ARENA_RIGHT - 30)
        const y = near ? s.player.y + range(s, -40, 40) : range(s, ARENA.y + 30, ARENA_BOTTOM - 30)
        s.hazards.push({
          kind: 'blast',
          pattern: 'lamp',
          x: Math.max(ARENA.x + 20, Math.min(ARENA_RIGHT - 20, x)),
          y: Math.max(ARENA.y + 20, Math.min(ARENA_BOTTOM - 20, y)),
          r: 34,
          fuse,
          total: fuse,
          boom: -1,
          fromX: x,
          fromY: ARENA.y - 60,
          hurt: false,
          t: 0,
          style: 'lamp',
          kick: false,
          kicked: false,
        })
        if (s.boss) s.boss.draw = 0.25
        s.events.push('creak')
      },
    ])
  }
  return timeline('lamp', count * gap + fuse + 0.8, actions)
}

// ---------- Khusus bos: Tembakan Terakhir ----------

/**
 * Tirai proyektil dari atas selama `duration` detik dengan satu lorong aman yang bergeser pelan
 * (lorongnya selalu ditandai hijau di tepi atas). Terlihat mustahil, tapi selalu bisa dilewati.
 */
export function lastStand(s: GameState, duration: number, kind: 'bullet' | 'thorn' | 'dust'): Run {
  const width = 78
  const corridor = { kind: 'corridor' as const, pattern: 'curtain' as const, x: s.player.x, width, t: 0, life: duration + 1.5 }
  s.hazards.push(corridor)
  const phase = s.rand() * Math.PI * 2
  let next = 0.6
  const run: Run = {
    id: 'curtain',
    t: 0,
    duration: duration + 1.6,
    step: (dt) => {
      run.t += dt
      // Lorong bergoyang pelan; kecepatan geraknya < kecepatan pemain sehingga selalu bisa diikuti.
      const wobble = Math.sin(run.t * 0.7 + phase) * 0.6 + Math.sin(run.t * 0.31 + phase * 2) * 0.4
      corridor.x = ARENA_CX + wobble * (ARENA.w / 2 - width)
      if (run.t > duration || run.t < next) return
      next = run.t + 0.3
      for (let x = ARENA.x + 6; x < ARENA_RIGHT; x += 17) {
        if (Math.abs(x - corridor.x) < width / 2) continue
        spawnShot(s, kind, 'curtain', x, ARENA.y - 12, 0, 175, { life: 4, entered: true })
      }
      if (s.boss) s.boss.draw = 0.2
      s.events.push('shot-soft')
    },
  }
  return run
}

export const PATTERNS: Record<PatternId, (s: GameState, lv: number) => Run> = {
  fan: (s, lv) => revolverFan(s, lv, Boolean(s.boss)),
  ricochet: ricochetRound,
  dynamite: dynamiteWarning,
  tumbleweed: tumbleweedRoll,
  cactus: cactusBarrage,
  lasso: lassoSweep,
  mark: wantedMark,
  dust: dustStorm,
  train: ghostTrain,
  bull: bullCharge,
  spiral: spiralShot,
  barrel: powderBarrel,
  lamp: chandelier,
  curtain: (s) => lastStand(s, 8, 'bullet'),
}
