import { solid, type Maze } from './maze'
import { RADIUS, type Body } from './sim'

/**
 * Menggambar LABIRIN ke kanvas: kamera mengikuti pemain sendiri, kabut (ubin yang belum dijelajahi
 * gelap total, yang sudah dijelajahi redup), portal pintu keluar, semua pemain, dan minimap.
 * Labirin digambar sekali ke kanvas cadangan; tiap frame cukup menyalin bagian yang terlihat.
 */

/** Warna tiap kursi (sama di lobi, permainan, dan hasil). */
export const COLORS = ['#ff5a6e', '#3ec1ff', '#ffd23f', '#5ce07a', '#c77dff', '#ff9f43', '#ff7ed1', '#2ee6d6']
export const colorOf = (seat: number) => COLORS[seat % COLORS.length]

export const FONT = '"Rubik", system-ui, sans-serif'

/** Jari-jari cahaya di sekitar pemain (ubin); ubin di dalamnya ditandai sudah dijelajahi. */
const LIGHT = 3.6
/** Berapa ubin yang terlihat dari atas ke bawah layar. */
const VIEW_TILES = 13
/** Resolusi kanvas cadangan labirin (piksel per ubin). */
const BAKE = 32

export interface RenderPlayer {
  seat: number
  name: string
  x: number
  y: number
  local: boolean
  offline?: boolean
  finished?: boolean
}

const FLOOR = '#0c0f1e'
const PLAZA = '#13203a'
const WALL_TOP = '#36437f'
const WALL_FACE = '#222b57'
const EDGE = 'rgba(130, 225, 255, 0.45)'
const FOG = '5, 6, 14'

function bakeMaze(maze: Maze): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = maze.w * BAKE
  canvas.height = maze.h * BAKE
  const ctx = canvas.getContext('2d')!
  const center = (maze.w - 1) / 2
  for (let y = 0; y < maze.h; y++) {
    for (let x = 0; x < maze.w; x++) {
      const px = x * BAKE
      const py = y * BAKE
      if (!solid(maze, x, y)) {
        const plaza = Math.abs(x - center) <= 3 && Math.abs(y - center) <= 3
        ctx.fillStyle = plaza ? PLAZA : FLOOR
        ctx.fillRect(px, py, BAKE, BAKE)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.035)'
        ctx.fillRect(px + BAKE / 2 - 1, py + BAKE / 2 - 1, 2, 2)
        continue
      }
      // Dinding: atap terang, sisi depan lebih gelap kalau di bawahnya lantai (kesan 3D).
      ctx.fillStyle = WALL_TOP
      ctx.fillRect(px, py, BAKE, BAKE)
      if (!solid(maze, x, y + 1)) {
        ctx.fillStyle = WALL_FACE
        ctx.fillRect(px, py + BAKE * 0.62, BAKE, BAKE * 0.38)
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.fillRect(px, py, BAKE, 2)
    }
  }
  // Garis tepi dinding yang menghadap lantai
  ctx.strokeStyle = EDGE
  ctx.lineWidth = 2
  ctx.beginPath()
  for (let y = 0; y < maze.h; y++) {
    for (let x = 0; x < maze.w; x++) {
      if (!solid(maze, x, y)) continue
      const px = x * BAKE
      const py = y * BAKE
      if (!solid(maze, x, y - 1)) {
        ctx.moveTo(px, py + 1)
        ctx.lineTo(px + BAKE, py + 1)
      }
      if (!solid(maze, x - 1, y)) {
        ctx.moveTo(px + 1, py)
        ctx.lineTo(px + 1, py + BAKE)
      }
      if (!solid(maze, x + 1, y)) {
        ctx.moveTo(px + BAKE - 1, py)
        ctx.lineTo(px + BAKE - 1, py + BAKE)
      }
    }
  }
  ctx.stroke()
  return canvas
}

/** Minimap: 1 piksel per ubin. */
function bakeMini(maze: Maze): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = maze.w
  canvas.height = maze.h
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(maze.w, maze.h)
  for (let i = 0; i < maze.w * maze.h; i++) {
    const wall = maze.walls[i] === 1
    image.data[i * 4] = wall ? 70 : 24
    image.data[i * 4 + 1] = wall ? 86 : 30
    image.data[i * 4 + 2] = wall ? 150 : 52
    image.data[i * 4 + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

export class MazeRenderer {
  private baked: HTMLCanvasElement
  private mini: HTMLCanvasElement
  /** Kabut minimap: hitam untuk ubin yang belum dijelajahi. */
  private miniFog: HTMLCanvasElement
  private miniFogCtx: CanvasRenderingContext2D
  private fog = document.createElement('canvas')
  /** 1 = sudah dijelajahi pemain di perangkat ini. */
  readonly explored: Uint8Array

  constructor(private maze: Maze) {
    this.baked = bakeMaze(maze)
    this.mini = bakeMini(maze)
    this.explored = new Uint8Array(maze.w * maze.h)
    this.miniFog = document.createElement('canvas')
    this.miniFog.width = maze.w
    this.miniFog.height = maze.h
    this.miniFogCtx = this.miniFog.getContext('2d')!
    this.miniFogCtx.fillStyle = '#05060e'
    this.miniFogCtx.fillRect(0, 0, maze.w, maze.h)
  }

  /** Tandai ubin di sekitar pemain sebagai sudah dijelajahi. */
  private explore(at: Body) {
    const r = Math.ceil(LIGHT)
    for (let y = Math.floor(at.y) - r; y <= Math.floor(at.y) + r; y++) {
      for (let x = Math.floor(at.x) - r; x <= Math.floor(at.x) + r; x++) {
        if (x < 0 || y < 0 || x >= this.maze.w || y >= this.maze.h) continue
        if (Math.hypot(x + 0.5 - at.x, y + 0.5 - at.y) > LIGHT - 0.3) continue
        const i = y * this.maze.w + x
        if (this.explored[i]) continue
        this.explored[i] = 1
        this.miniFogCtx.clearRect(x, y, 1, 1)
      }
    }
  }

  /**
   * Satu frame. `w`/`h` dalam piksel CSS, `dpr` rasio piksel layar. `focus` = posisi pemain sendiri
   * (null = penonton: seluruh labirin terlihat tanpa kabut).
   */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, players: RenderPlayer[], focus: Body | null, clock: number, reveal = false) {
    const maze = this.maze
    if (focus) this.explore(focus)
    const tile = reveal || !focus ? Math.min(w / (maze.w + 1), h / (maze.h + 1)) : Math.max(24, Math.min(54, h / VIEW_TILES))
    // Kamera: pemain di tengah, dibatasi supaya tidak melihat jauh ke luar labirin.
    const viewW = w / tile
    const viewH = h / tile
    const cx = !focus || reveal ? maze.w / 2 : viewW >= maze.w ? maze.w / 2 : Math.max(viewW / 2 - 0.5, Math.min(maze.w - viewW / 2 + 0.5, focus.x))
    const cy = !focus || reveal ? maze.h / 2 : viewH >= maze.h ? maze.h / 2 : Math.max(viewH / 2 - 0.5, Math.min(maze.h - viewH / 2 + 0.5, focus.y))
    const left = cx - viewW / 2
    const top = cy - viewH / 2
    const toX = (x: number) => (x - left) * tile
    const toY = (y: number) => (y - top) * tile

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#07080f'
    ctx.fillRect(0, 0, w, h)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(this.baked, left * BAKE, top * BAKE, viewW * BAKE, viewH * BAKE, 0, 0, w, h)

    this.drawSpawns(ctx, players, toX, toY, tile)
    this.drawExit(ctx, toX(maze.exit.x + 0.5), toY(maze.exit.y + 0.5), tile, clock, false)
    if (focus && !reveal) this.drawFog(ctx, w, h, dpr, left, top, tile, toX(focus.x), toY(focus.y))
    // Cahaya portal tetap terlihat menembus kabut sebagai penunjuk arah.
    this.drawExit(ctx, toX(maze.exit.x + 0.5), toY(maze.exit.y + 0.5), tile, clock, true)
    for (const player of [...players].sort((a, b) => Number(a.local) - Number(b.local))) this.drawPlayer(ctx, player, toX(player.x), toY(player.y), tile, clock)
    if (focus && !reveal) {
      this.drawExitArrow(ctx, w, h, toX(maze.exit.x + 0.5), toY(maze.exit.y + 0.5), clock)
      this.drawMinimap(ctx, w, h, players)
    }
  }

  private drawSpawns(ctx: CanvasRenderingContext2D, players: RenderPlayer[], toX: (x: number) => number, toY: (y: number) => number, tile: number) {
    for (const player of players) {
      const spawn = this.maze.spawns[player.seat]
      if (!spawn) continue
      ctx.strokeStyle = colorOf(player.seat)
      ctx.globalAlpha = 0.45
      ctx.lineWidth = 2
      ctx.strokeRect(toX(spawn.x) + tile * 0.12, toY(spawn.y) + tile * 0.12, tile * 0.76, tile * 0.76)
      ctx.globalAlpha = 1
    }
  }

  private drawExit(ctx: CanvasRenderingContext2D, x: number, y: number, tile: number, clock: number, glowOnly: boolean) {
    ctx.save()
    if (glowOnly) {
      ctx.globalCompositeOperation = 'lighter'
      const r = tile * (2.4 + Math.sin(clock * 2) * 0.3)
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r)
      glow.addColorStop(0, 'rgba(120, 255, 200, 0.45)')
      glow.addColorStop(1, 'rgba(120, 255, 200, 0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      return
    }
    // Portal: cincin berputar
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(120, 255, 200, ${0.9 - i * 0.25})`
      ctx.lineWidth = Math.max(2, tile * 0.08)
      ctx.beginPath()
      const a = clock * (2 - i * 0.6) + i
      ctx.arc(x, y, tile * (0.42 - i * 0.1), a, a + Math.PI * 1.4)
      ctx.stroke()
    }
    ctx.fillStyle = '#eafff6'
    ctx.beginPath()
    ctx.arc(x, y, tile * 0.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private drawFog(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, left: number, top: number, tile: number, px: number, py: number) {
    const fog = this.fog
    if (fog.width !== Math.round(w * dpr) || fog.height !== Math.round(h * dpr)) {
      fog.width = Math.round(w * dpr)
      fog.height = Math.round(h * dpr)
    }
    const f = fog.getContext('2d')!
    f.setTransform(dpr, 0, 0, dpr, 0, 0)
    f.globalCompositeOperation = 'source-over'
    f.clearRect(0, 0, w, h)
    const x0 = Math.max(0, Math.floor(left))
    const y0 = Math.max(0, Math.floor(top))
    const x1 = Math.min(this.maze.w - 1, Math.ceil(left + w / tile))
    const y1 = Math.min(this.maze.h - 1, Math.ceil(top + h / tile))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        f.fillStyle = this.explored[y * this.maze.w + x] ? `rgba(${FOG}, 0.62)` : `rgb(${FOG})`
        f.fillRect(Math.floor((x - left) * tile), Math.floor((y - top) * tile), Math.ceil(tile) + 1, Math.ceil(tile) + 1)
      }
    }
    // Lubang cahaya di sekitar pemain (tepi lembut).
    f.globalCompositeOperation = 'destination-out'
    const r = LIGHT * tile
    const light = f.createRadialGradient(px, py, r * 0.45, px, py, r)
    light.addColorStop(0, 'rgba(0, 0, 0, 1)')
    light.addColorStop(1, 'rgba(0, 0, 0, 0)')
    f.fillStyle = light
    f.beginPath()
    f.arc(px, py, r, 0, Math.PI * 2)
    f.fill()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(fog, 0, 0)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, player: RenderPlayer, x: number, y: number, tile: number, clock: number) {
    const color = colorOf(player.seat)
    const r = RADIUS * tile * 1.15
    ctx.save()
    if (player.offline) ctx.globalAlpha = 0.35
    if (player.local) {
      ctx.globalCompositeOperation = 'lighter'
      const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6)
      glow.addColorStop(0, `${color}66`)
      glow.addColorStop(1, `${color}00`)
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, r * 2.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    }
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = player.local ? 3 : 2
    ctx.strokeStyle = player.local ? '#ffffff' : 'rgba(0, 0, 0, 0.55)'
    ctx.stroke()
    // Mata kecil: wajah yang ramah
    const blink = Math.sin(clock * 1.3 + player.seat) > 0.97
    ctx.fillStyle = '#10131f'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(x + side * r * 0.33, y - r * 0.1, r * 0.13, blink ? r * 0.03 : r * 0.2, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    // Nama di atas pemain
    ctx.font = `600 ${Math.max(11, Math.round(tile * 0.3))}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const label = player.local ? 'Kamu' : player.name
    const tw = ctx.measureText(label).width + 10
    ctx.fillStyle = 'rgba(5, 8, 18, 0.72)'
    ctx.beginPath()
    ctx.roundRect(x - tw / 2, y - r - tile * 0.5, tw, tile * 0.38 + 4, 6)
    ctx.fill()
    ctx.fillStyle = player.local ? '#ffffff' : color
    ctx.fillText(label, x, y - r - tile * 0.1)
    ctx.restore()
  }

  /** Panah di tepi layar ke arah pintu keluar kalau portal di luar layar. */
  private drawExitArrow(ctx: CanvasRenderingContext2D, w: number, h: number, ex: number, ey: number, clock: number) {
    const margin = 34
    if (ex > margin && ex < w - margin && ey > margin && ey < h - margin) return
    const cx = w / 2
    const cy = h / 2
    const angle = Math.atan2(ey - cy, ex - cx)
    const scale = Math.min((w / 2 - margin) / Math.abs(Math.cos(angle) || 1e-6), (h / 2 - margin) / Math.abs(Math.sin(angle) || 1e-6))
    const x = cx + Math.cos(angle) * scale
    const y = cy + Math.sin(angle) * scale
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.globalAlpha = 0.75 + Math.sin(clock * 5) * 0.2
    ctx.fillStyle = '#78ffc8'
    ctx.beginPath()
    ctx.moveTo(14, 0)
    ctx.lineTo(-8, -10)
    ctx.lineTo(-3, 0)
    ctx.lineTo(-8, 10)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, w: number, h: number, players: RenderPlayer[]) {
    const size = Math.min(150, Math.max(96, Math.min(w, h) * 0.24))
    const scale = size / this.maze.w
    const x = w - size - 14
    const y = h - size - 14
    ctx.save()
    ctx.fillStyle = 'rgba(5, 6, 14, 0.9)'
    ctx.strokeStyle = 'rgba(140, 160, 255, 0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x - 6, y - 6, size + 12, size + 12, 10)
    ctx.fill()
    ctx.stroke()
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(this.mini, x, y, size, size)
    ctx.drawImage(this.miniFog, x, y, size, size)
    ctx.fillStyle = '#78ffc8'
    ctx.beginPath()
    ctx.arc(x + (this.maze.exit.x + 0.5) * scale, y + (this.maze.exit.y + 0.5) * scale, Math.max(3, scale * 1.2), 0, Math.PI * 2)
    ctx.fill()
    for (const player of players) {
      ctx.fillStyle = colorOf(player.seat)
      ctx.globalAlpha = player.offline ? 0.4 : 1
      ctx.beginPath()
      ctx.arc(x + player.x * scale, y + player.y * scale, player.local ? 3.5 : 2.6, 0, Math.PI * 2)
      ctx.fill()
      if (player.local) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.2
        ctx.stroke()
      }
    }
    ctx.restore()
  }
}
