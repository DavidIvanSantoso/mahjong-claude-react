import type { CSSProperties } from 'react'
import type { Dir } from './grid'

/**
 * Pixel art Armada Royale, semuanya digambar di sini dari peta karakter (tanpa file gambar):
 * tiap karakter satu kotak, '.' kosong, karakter lain dipetakan ke kelas warna `arpx-<karakter>`
 * (warnanya di armada.css).
 */
function PixelArt({ rows, className, style, title }: { rows: string[]; className?: string; style?: CSSProperties; title?: string }) {
  const width = Math.max(...rows.map((row) => row.length))
  const rects: { x: number; y: number; c: string }[] = []
  rows.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && rects.push({ x, y, c })))
  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${width} ${rows.length}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects.map(({ x, y, c }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} className={`arpx-${c}`} />
      ))}
    </svg>
  )
}

/** Panjang satu segmen kapal dalam pixel art (satu sel papan). */
const SEGMENT = 8

/**
 * Kapal mendatar sepanjang `size` sel, haluan di kanan: lambung (h), dek (d), cat bawah (r),
 * jendela (w), anjungan (c), tiang (m), meriam (g). Kapal tegak = gambar yang sama diputar.
 */
function shipRows(size: number): string[] {
  const w = size * SEGMENT
  const cabinFrom = Math.floor(w * 0.3)
  const cabinTo = Math.floor(w * 0.58)
  const mast = Math.floor((cabinFrom + cabinTo) / 2)
  const rows: string[] = []
  for (let y = 0; y < SEGMENT; y++) {
    let row = ''
    for (let x = 0; x < w; x++) {
      // Haluan miring ke kanan bawah, buritan sedikit membulat.
      const right = w - 1 - Math.max(0, y - 3)
      const left = y >= 6 ? 2 : 1
      let c = '.'
      if (y >= 3 && y <= 6 && x >= left && x <= right) {
        if (y === 3) c = 'd'
        else if (y === 6) c = 'r'
        else if (y === 4 && x % 4 === 2 && x > 3 && x < right - 3) c = 'w'
        else c = 'h'
      } else if ((y === 1 || y === 2) && x >= cabinFrom && x <= cabinTo) c = y === 1 && (x === cabinFrom || x === cabinTo) ? '.' : 'c'
      else if (y === 0 && x === mast) c = 'm'
      else if (y === 2 && size >= 3 && (x === w - 9 || x === w - 8 || x === 4 || x === 5)) c = 'g'
      row += c
    }
    rows.push(row)
  }
  return rows
}

/** Putar 90°: haluan menghadap ke atas. */
function upright(rows: string[]): string[] {
  const w = rows[0].length
  return Array.from({ length: w }, (_, i) => rows.map((row) => row[w - 1 - i]).join(''))
}

export function ShipArt({ size, dir, sunk, className }: { size: number; dir: Dir; sunk?: boolean; className?: string }) {
  const rows = shipRows(size)
  return <PixelArt rows={dir === 'h' ? rows : upright(rows)} className={`ar-ship-art ${sunk ? 'ar-ship-art--sunk' : ''} ${className ?? ''}`} />
}

/** Tembakan meleset: cipratan air. */
const SPLASH = ['........', '..b..b..', '.b.bb.b.', '..bwwb..', '.bbwwbb.', 'b.bbbb.b', '.b....b.', '........']

/** Tembakan kena: api. */
const FLAME = ['...o....', '..oy.o..', '.oyyo.o.', '.oyyyyo.', 'oyywwyyo', 'oyywwyyo', '.oyyyyo.', '..oooo..']

export function PixelSplash({ className }: { className?: string }) {
  return <PixelArt rows={SPLASH} className={className} title="Meleset" />
}

export function PixelFlame({ className }: { className?: string }) {
  return <PixelArt rows={FLAME} className={className} title="Kena" />
}

const SHIELD = ['ssssssss', 'sqqwqqqs', 'sqwqqqqs', 'sqqqqqqs', '.sqqqqs.', '.sqqqqs.', '..sqqs..', '...ss...']
const RADAR = ['..eeee..', '.e....e.', 'e..ee..e', 'e.e..e.e', 'e.e.ye.e', 'e..ee..e', '.e....e.', '..eeee..']
const CROSSHAIR = ['...oo...', '..o..o..', '.o.oo.o.', 'ooo..ooo', 'ooo..ooo', '.o.oo.o.', '..o..o..', '...oo...']

const SKILL_ART = { shield: SHIELD, sonar: RADAR, double: CROSSHAIR }

export function SkillIcon({ skill, className }: { skill: keyof typeof SKILL_ART; className?: string }) {
  return <PixelArt rows={SKILL_ART[skill]} className={className ?? 'ar-skill-icon'} />
}

/** Bendera pemain; warnanya dari kursi (`ar-flag--<kursi>` di armada.css). Gugur: bendera robek abu-abu. */
const FLAG = ['m.......', 'maaaaa..', 'maaaaaa.', 'maaaaa..', 'm.......', 'm.......', 'm.......', 'mm......']
const FLAG_OUT = ['m.......', 'mzz.z...', 'mz.zz...', 'mzz.....', 'm.......', 'm.......', 'm.......', 'mm......']

export function PixelFlag({ seat, out }: { seat: number; out?: boolean }) {
  return <PixelArt rows={out ? FLAG_OUT : FLAG} className={`ar-flag ar-flag--${seat % 6}`} />
}

/** Ombak bergerigi untuk hiasan homescreen. */
const WAVES = ['..ff......ff......ff....', '.fbbf....fbbf....fbbf...', 'fbbbbf..fbbbbf..fbbbbf..', 'bbbbbbffbbbbbbffbbbbbbff']

export function PixelWaves({ className }: { className?: string }) {
  return <PixelArt rows={WAVES} className={className} />
}
