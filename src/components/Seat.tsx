import type { Meld, Player } from '../game/state'
import { TileBack, TileView } from './TileView'

function MeldView({ meld }: { meld: Meld }) {
  return (
    <span className="meld" title={meld.type}>
      {meld.tiles.map((tile, i) =>
        // Kong tertutup: dua ubin luar ditelungkupkan seperti di meja asli.
        meld.concealed && (i === 0 || i === 3) ? (
          <TileBack key={tile.id} size="open" />
        ) : (
          <TileView key={tile.id} tile={tile} size="open" />
        ),
      )}
    </span>
  )
}

interface SeatProps {
  player: Player
  /** Posisi kursi searah giliran: 0 bawah, 1 kanan, 2 atas, 3 kiri. */
  position: number
  faceUp: boolean
  /** Tangan pemain yang sedang memegang perangkat ditampilkan lebih besar. */
  large: boolean
  drawnId: number | null
  lastDiscardId: number | null
  selectedId?: number | null
  onTileClick?: (tileId: number) => void
  /**
   * Putaran tambahan (derajat, kelipatan 90) untuk muka ubin di kolam buangan, supaya tetap
   * tegak menghadap pemain di perangkat ini walaupun kursinya ada di samping atau seberang.
   */
  pondFaceTurn?: number
}

export function Seat({
  player,
  position,
  faceUp,
  large,
  drawnId,
  lastDiscardId,
  selectedId,
  onTileClick,
  pondFaceTurn = 0,
}: SeatProps) {
  const handSize = large ? 'hand' : 'side'

  return (
    <div className="seat" style={{ transform: `rotate(${-position * 90}deg)` }}>
      <div className={`pond pond--turn-${pondFaceTurn}`} aria-label={`Buangan ${player.name}`}>
        {player.discards.map((tile) => (
          <TileView key={tile.id} tile={tile} size="pond" marked={tile.id === lastDiscardId} />
        ))}
      </div>

      <div className="seat__edge">
        {(player.flowers.length > 0 || player.melds.length > 0) && (
          <div className="seat__open">
            {player.flowers.length > 0 && (
              <span className="meld" title="Bunga">
                {player.flowers.map((tile) => (
                  <TileView key={tile.id} tile={tile} size="open" />
                ))}
              </span>
            )}
            {player.melds.map((meld, i) => (
              <MeldView key={i} meld={meld} />
            ))}
          </div>
        )}

        <div className="seat__hand">
          {player.hand.map((tile) =>
            faceUp ? (
              <TileView
                key={tile.id}
                tile={tile}
                size={handSize}
                marked={tile.id === drawnId}
                selected={tile.id === selectedId}
                onClick={onTileClick && (() => onTileClick(tile.id))}
              />
            ) : (
              <TileBack key={tile.id} size={handSize} />
            ),
          )}
        </div>
      </div>
    </div>
  )
}
