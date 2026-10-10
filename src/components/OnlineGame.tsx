import { useState } from 'react'
import { rushSeconds } from '../game/timer'
import { useGuestRoom, useHostRoom, type Room } from '../net/rooms'
import { GameTable } from './GameTable'

interface ExitProps {
  onExit: () => void
}

interface HostGameProps extends ExitProps {
  name: string
  capacity: number
  turnSeconds: number
  timeAttack: boolean
}

export function HostGame({ name, capacity, turnSeconds, timeAttack, onExit }: HostGameProps) {
  return <RoomView room={useHostRoom(name, capacity, turnSeconds, timeAttack)} onExit={onExit} />
}

export function GuestGame({ name, code, onExit }: { name: string; code: string } & ExitProps) {
  return <RoomView room={useGuestRoom(code, name)} onExit={onExit} />
}

function inviteLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}?room=${code}`
}

function RoomView({ room, onExit }: { room: Room } & ExitProps) {
  const [copied, setCopied] = useState(false)

  if (room.status === 'error') {
    return (
      <main className="setup">
        <div className="card setup__card">
          <h1 className="setup__title">Tidak terhubung</h1>
          <p className="setup__lead">{room.error}</p>
          {!room.isHost && (
            <button type="button" className="btn btn--primary btn--wide" onClick={room.retry}>
              Coba sambung lagi
            </button>
          )}
          <button type="button" className="btn btn--wide" onClick={onExit}>
            Kembali ke menu
          </button>
        </div>
      </main>
    )
  }

  if (room.view) {
    return (
      <GameTable
        state={room.view}
        dispatch={room.send}
        viewer={room.seat}
        roomCode={room.code}
        turnSeconds={room.rush ? rushSeconds(room.lobby.turnSeconds) : room.lobby.turnSeconds}
        rush={room.rush}
        deadline={room.deadline}
        connected={room.lobby.players.map((player) => player.connected)}
        onRestart={room.isHost ? room.start : undefined}
        onExit={onExit}
      />
    )
  }

  const { players, capacity, turnSeconds, timeAttack } = room.lobby
  const full = players.length === capacity
  const link = inviteLink(room.code)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      // Clipboard bisa ditolak browser; link tetap bisa disalin manual dari kolomnya.
    }
  }

  return (
    <main className="setup">
      <div className="card setup__card">
        {room.status === 'connecting' ? (
          <>
            <h1 className="setup__title">Menghubungkan…</h1>
            <p className="setup__lead">
              {room.isHost ? 'Membuat room.' : `Mencari room ${room.code}.`}
            </p>
          </>
        ) : (
          <>
            <div>
              <p className="setup__lead">Kode room</p>
              <h1 className="lobby__code">{room.code}</h1>
            </div>

            <div className="setup__field">
              <span className="setup__label">Bagikan link ini ke pemain lain</span>
              <div className="setup__row setup__names">
                <input type="text" readOnly value={link} aria-label="Link undangan" onFocus={(e) => e.target.select()} />
                <button type="button" className="btn" onClick={copyLink}>
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              </div>
            </div>

            <div className="setup__field">
              <span className="setup__label">
                Pemain ({players.length}/{capacity})
              </span>
              <ol className="lobby__players">
                {Array.from({ length: capacity }, (_, i) => (
                  <li key={i} className={players[i] ? '' : 'lobby__empty'}>
                    {players[i]
                      ? `${players[i].name}${i === 0 ? ' (host)' : ''}${i === room.seat ? ' — kamu' : ''}`
                      : 'Menunggu pemain…'}
                  </li>
                ))}
              </ol>
            </div>

            <p className="setup__lead">
              Waktu per giliran: <strong>{turnSeconds} detik</strong>. Kalau habis, ubin terakhir yang
              didapat otomatis dibuang.
              {timeAttack && (
                <>
                  {' '}
                  <strong>Time attack aktif</strong>: waktunya jadi {rushSeconds(turnSeconds)} detik
                  selama ada pemain yang hampir menang.
                </>
              )}
            </p>

            {room.isHost ? (
              <button type="button" className="btn btn--primary btn--wide" disabled={!full} onClick={room.start}>
                {full ? 'Mulai permainan' : 'Menunggu semua pemain masuk'}
              </button>
            ) : (
              <p className="setup__lead">Menunggu host memulai permainan…</p>
            )}
          </>
        )}

        <button type="button" className="btn btn--wide" onClick={onExit}>
          Keluar
        </button>
      </div>
    </main>
  )
}
