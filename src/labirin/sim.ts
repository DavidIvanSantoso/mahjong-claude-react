import { solid, type Maze } from './maze'

/**
 * Gerakan pemain LABIRIN: langkah waktu tetap (60 per detik), sama persis di host dan tamu, supaya
 * prediksi tamu bisa dicocokkan dengan hasil host. Satuan posisi = ubin; ubin (x, y) menempati
 * [x, x+1] × [y, y+1].
 */

/** Detik per langkah simulasi. */
export const STEP = 1 / 60
/** Kecepatan (ubin per detik). */
export const SPEED = 4.6
/** Setengah lebar kotak tabrakan pemain (ubin). Lorong selebar 1 ubin, jadi ada kelonggaran 0,4. */
export const RADIUS = 0.3

/** Tombol arah sebagai bit, supaya input cukup dikirim sebagai satu angka. */
export const UP = 1
export const DOWN = 2
export const LEFT = 4
export const RIGHT = 8
export const isDirs = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 15

export interface Body {
  x: number
  y: number
}

const EPS = 1e-4

function collides(maze: Maze, x: number, y: number): boolean {
  for (let ty = Math.floor(y - RADIUS); ty <= Math.floor(y + RADIUS - EPS); ty++) {
    for (let tx = Math.floor(x - RADIUS); tx <= Math.floor(x + RADIUS - EPS); tx++) if (solid(maze, tx, ty)) return true
  }
  return false
}

/** Geser satu sumbu; berhenti tepat di tepi dinding kalau menabrak. Mengembalikan true kalau terhalang. */
function moveAxis(maze: Maze, body: Body, dx: number, dy: number): boolean {
  if (!dx && !dy) return false
  const nx = body.x + dx
  const ny = body.y + dy
  if (!collides(maze, nx, ny)) {
    body.x = nx
    body.y = ny
    return false
  }
  // Langkah selalu < 1 ubin, jadi cukup menempel ke batas ubin terdekat.
  if (dx > 0) body.x = Math.floor(nx + RADIUS - EPS) - RADIUS - EPS
  else if (dx < 0) body.x = Math.floor(nx - RADIUS) + 1 + RADIUS + EPS
  if (dy > 0) body.y = Math.floor(ny + RADIUS - EPS) - RADIUS - EPS
  else if (dy < 0) body.y = Math.floor(ny - RADIUS) + 1 + RADIUS + EPS
  return true
}

/**
 * Bantuan sudut: kalau terhalang padahal ubin di depan (di baris/kolom tempat pemain berada) terbuka,
 * pemain digeser ke tengah lorong supaya bisa masuk, tidak tersangkut di ujung dinding.
 */
function assist(maze: Maze, body: Body, horizontal: boolean, sign: number, amount: number) {
  if (horizontal) {
    const ahead = Math.floor(body.x + sign * (RADIUS + 0.1))
    const row = Math.floor(body.y)
    if (solid(maze, ahead, row)) return
    const target = row + 0.5
    moveAxis(maze, body, 0, Math.sign(target - body.y) * Math.min(amount, Math.abs(target - body.y)))
  } else {
    const ahead = Math.floor(body.y + sign * (RADIUS + 0.1))
    const col = Math.floor(body.x)
    if (solid(maze, col, ahead)) return
    const target = col + 0.5
    moveAxis(maze, body, Math.sign(target - body.x) * Math.min(amount, Math.abs(target - body.x)), 0)
  }
}

/** Satu langkah simulasi untuk satu pemain dengan tombol arah `dirs`. */
export function step(maze: Maze, body: Body, dirs: number) {
  let dx = (dirs & RIGHT ? 1 : 0) - (dirs & LEFT ? 1 : 0)
  let dy = (dirs & DOWN ? 1 : 0) - (dirs & UP ? 1 : 0)
  if (!dx && !dy) return
  if (dx && dy) {
    dx *= Math.SQRT1_2
    dy *= Math.SQRT1_2
  }
  const distance = SPEED * STEP
  const blockedX = moveAxis(maze, body, dx * distance, 0)
  const blockedY = moveAxis(maze, body, 0, dy * distance)
  if (blockedX && !dy) assist(maze, body, true, Math.sign(dx), distance)
  if (blockedY && !dx) assist(maze, body, false, Math.sign(dy), distance)
}

export function spawnBody(maze: Maze, seat: number): Body {
  const tile = maze.spawns[seat % maze.spawns.length]
  return { x: tile.x + 0.5, y: tile.y + 0.5 }
}

/** Sampai = titik tengah pemain sudah masuk ubin pintu keluar. */
export function atExit(maze: Maze, body: Body): boolean {
  return Math.floor(body.x) === maze.exit.x && Math.floor(body.y) === maze.exit.y
}
