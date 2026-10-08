import { tileName, type Tile } from '../game/tiles'

const WIND_GLYPHS = ['東', '南', '西', '北']
const WIND_LETTERS = ['T', 'S', 'B', 'U']
const DRAGON_GLYPHS = ['中', '發', '']
const DRAGON_COLORS = ['red', 'green', 'blue']
const FLOWER_GLYPHS = ['梅', '蘭', '菊', '竹', '春', '夏', '秋', '冬']

/**
 * hand/side/open/pond mengikuti ukuran meja (lihat index.css);
 * md/sm berukuran tetap untuk dipakai di luar meja.
 */
export type TileSize = 'hand' | 'side' | 'open' | 'pond' | 'md' | 'sm'

interface TileViewProps {
  tile: Tile
  size?: TileSize
  selected?: boolean
  /** Penanda ubin yang baru diambil / baru dibuang. */
  marked?: boolean
  onClick?: () => void
}

function TileFace({ tile }: { tile: Tile }) {
  if (tile.suit === 'wind') {
    return (
      <>
        <span className="tile__corner">{WIND_LETTERS[tile.rank - 1]}</span>
        <span className="tile__glyph">{WIND_GLYPHS[tile.rank - 1]}</span>
      </>
    )
  }
  if (tile.suit === 'flower') {
    return (
      <>
        <span className="tile__corner">{((tile.rank - 1) % 4) + 1}</span>
        <span className="tile__glyph">{FLOWER_GLYPHS[tile.rank - 1]}</span>
      </>
    )
  }
  if (tile.suit === 'dragon') {
    const glyph = DRAGON_GLYPHS[tile.rank - 1]
    return glyph ? (
      <span className="tile__glyph">{glyph}</span>
    ) : (
      <span className="tile__frame" />
    )
  }
  return (
    <>
      <span className="tile__rank">{tile.rank}</span>
      <span className={`tile__suit tile__suit--${tile.suit}`}>{tile.suit === 'man' ? '萬' : ''}</span>
    </>
  )
}

function tileColor(tile: Tile): string {
  if (tile.suit === 'dragon') return DRAGON_COLORS[tile.rank - 1]
  if (tile.suit === 'flower') return tile.rank <= 4 ? 'red' : 'green'
  if (tile.suit === 'man') return 'red'
  if (tile.suit === 'sou') return 'green'
  if (tile.suit === 'pin') return 'blue'
  return 'ink'
}

export function TileView({ tile, size = 'md', selected, marked, onClick }: TileViewProps) {
  const className = [
    'tile',
    `tile--${size}`,
    `tile--${tileColor(tile)}`,
    tile.suit === 'flower' && 'tile--flower',
    selected && 'tile--selected',
    marked && 'tile--marked',
  ]
    .filter(Boolean)
    .join(' ')
  const name = tileName(tile)

  if (onClick) {
    return (
      <button type="button" className={className} title={name} aria-label={name} aria-pressed={selected} onClick={onClick}>
        <TileFace tile={tile} />
      </button>
    )
  }
  return (
    <span className={className} title={name} role="img" aria-label={name}>
      <TileFace tile={tile} />
    </span>
  )
}

export function TileBack({ size = 'sm' }: { size?: TileSize }) {
  return <span className={`tile tile--${size} tile--back`} aria-hidden="true" />
}
