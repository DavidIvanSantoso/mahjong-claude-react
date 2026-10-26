import type { CSSProperties } from 'react'

/**
 * Gambar pixel art dari peta karakter: tiap karakter satu kotak, '.' kosong, karakter lain
 * dipetakan ke kelas warna (`bkpx-<karakter>`, warnanya di bomkata.css). Hasilnya SVG yang tajam
 * di ukuran berapa pun (`shape-rendering: crispEdges`).
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
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects.map(({ x, y, c }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} className={`bkpx-${c}`} />
      ))}
    </svg>
  )
}

/** Bom: badan (k), kilau (w), tutup (c), sumbu (f), percikan api (s/o) yang berkedip. */
const BOMB = [
  '...........s.s..',
  '..........o.s...',
  '.........sfs....',
  '.........f......',
  '........f.......',
  '......ccf.......',
  '.....cccc.......',
  '....kkkkkkk.....',
  '...kkkkkkkkk....',
  '..kkwwkkkkkkk...',
  '..kwwkkkkkkkk...',
  '..kwkkkkkkkkk...',
  '..kkkkkkkkkkk...',
  '..kkkkkkkkkkk...',
  '...kkkkkkkkk....',
  '....kkkkkkk.....',
]

/** `heat` menentukan kecepatan kedip (lihat bomkata.css); `lit` false = sumbu belum menyala. */
export function PixelBomb({ heat = 0, lit = true, className }: { heat?: number; lit?: boolean; className?: string }) {
  return (
    <div className={`bk-bomb ${lit ? `bk-bomb--lit bk-bomb--heat-${heat}` : ''} ${className ?? ''}`}>
      <PixelArt rows={BOMB} className="bk-bomb__art" title="Bom" />
    </div>
  )
}

/** Ledakan: tiga lapis cincin bergerigi (kuning, oranye, merah). */
const BLAST = [
  '......r..r......',
  '..r...rr.r...r..',
  '...r.roooor.r...',
  '....rooyyoor....',
  '.r.rooyyyyoor.r.',
  '..rooyyyyyyoor..',
  '..royyywwyyyor..',
  'rrooyywwwwyyoorr',
  'rrooyywwwwyyoorr',
  '..royyywwyyyor..',
  '..rooyyyyyyoor..',
  '.r.rooyyyyoor.r.',
  '....rooyyoor....',
  '...r.roooor.r...',
  '..r...r.rr...r..',
  '......r..r......',
]

export function PixelBlast({ className }: { className?: string }) {
  return <PixelArt rows={BLAST} className={className} title="Ledakan" />
}

/** Panah menunjuk ke kanan; diputar mengikuti kursi pemain yang memegang bom. */
const ARROW = ['....y...', '....yy..', 'yyyyyyy.', 'yyyyyyyy', 'yyyyyyy.', '....yy..', '....y...']

export function PixelArrow({ className }: { className?: string }) {
  return <PixelArt rows={ARROW} className={className} />
}

const HEART = ['.hh.hh.', 'hhhhhhh', 'hhhhhhh', '.hhhhh.', '..hhh..', '...h...']
const HEART_EMPTY = ['.ee.ee.', 'e..e..e', 'e.....e', '.e...e.', '..e.e..', '...e...']

export function PixelHeart({ full }: { full: boolean }) {
  return <PixelArt rows={full ? HEART : HEART_EMPTY} className="bk-heart" />
}

/** Wajah pemain 8x8; warnanya dari `--seat` (lihat bomkata.css). Gugur: mata silang. */
const FACE = ['..aaaa..', '.aaaaaa.', 'aanaana.', 'aaaaaaaa', 'aaaaaaaa', 'aamaamaa', '.aammaa.', '..aaaa..']
const FACE_OUT = ['..dddd..', '.dddddd.', 'dxdddxd.', 'ddxdxdd.', 'dxdddxdd', 'dddddddd', '.dmmmmd.', '..dddd..']

export function PixelFace({ out, seat }: { out?: boolean; seat: number }) {
  return <PixelArt rows={out ? FACE_OUT : FACE} className={`bk-face bk-face--${seat % 6}`} />
}
