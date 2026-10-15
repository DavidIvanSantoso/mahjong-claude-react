import { useState } from 'react'
import { RULESET_NAMES, type Ruleset } from '../game/state'
import { rushSeconds } from '../game/timer'
import { useGuestRoom, useHostRoom, type Room } from '../net/rooms'
import { GameTable } from './GameTable'
import { t } from '../i18n'
import type { RoomError } from '../net/online'
import { useRulesetTheme } from './theme'

interface ExitProps {
  onExit: () => void
}

interface HostGameProps extends ExitProps {
  name: string
  capacity: number
  turnSeconds: number
  timeAttack: boolean
  ruleset: Ruleset
}

export function HostGame({ name, capacity, turnSeconds, timeAttack, ruleset, onExit }: HostGameProps) {
  return <RoomView room={useHostRoom(name, capacity, turnSeconds, timeAttack, ruleset)} onExit={onExit} />
}

export function GuestGame({ name, code, onExit }: { name: string; code: string } & ExitProps) {
  return <RoomView room={useGuestRoom(code, name)} onExit={onExit} />
}

function errorMessage(error: RoomError | null): string {
  switch (error?.code) {
    case 'id-taken':
      return t('Kode room sudah dipakai. Coba buat room lagi.', 'That room code is already in use. Try creating the room again.')
    case 'host-failed':
      return t(
        `Gagal membuat room (${error.detail}). Periksa koneksi internet.`,
        `Could not create the room (${error.detail}). Check your internet connection.`,
      )
    case 'started':
      return t('Permainan di room ini sudah dimulai.', 'The game in this room has already started.')
    case 'full':
      return t('Room sudah penuh.', 'The room is full.')
    case 'host-lost':
      return t('Koneksi ke host terputus.', 'The connection to the host was lost.')
    case 'not-found':
      return t(
        'Room tidak ditemukan. Periksa kodenya dan pastikan host masih membuka room.',
        'Room not found. Check the code and make sure the host still has the room open.',
      )
    case 'connect-failed':
      return t(
        `Gagal terhubung (${error.detail}). Periksa koneksi internet.`,
        `Could not connect (${error.detail}). Check your internet connection.`,
      )
    default:
      return ''
  }
}

function inviteLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}?room=${code}`
}

function RoomView({ room, onExit }: { room: Room } & ExitProps) {
  const [copied, setCopied] = useState(false)
  // Tampilan mengikuti sistem permainan room, yang bisa berbeda dari pilihan tamu di menu awal.
  useRulesetTheme(room.lobby.ruleset)

  if (room.status === 'error') {
    return (
      <main className="setup">
        <div className="card setup__card">
          <h1 className="setup__title">{t('Tidak terhubung', 'Not connected')}</h1>
          <p className="setup__lead">{errorMessage(room.error)}</p>
          {!room.isHost && (
            <button type="button" className="btn btn--primary btn--wide" onClick={room.retry}>
              {t('Coba sambung lagi', 'Try reconnecting')}
            </button>
          )}
          <button type="button" className="btn btn--wide" onClick={onExit}>
            {t('Kembali ke menu', 'Back to menu')}
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
        scores={room.lobby.players.map((player) => player.score)}
        onRestart={room.isHost ? room.start : undefined}
        onExit={onExit}
      />
    )
  }

  const { players, capacity, turnSeconds, timeAttack, ruleset } = room.lobby
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
            <h1 className="setup__title">{t('Menghubungkan…', 'Connecting…')}</h1>
            <p className="setup__lead">
              {room.isHost
                ? t('Membuat room.', 'Creating the room.')
                : t(`Mencari room ${room.code}.`, `Looking for room ${room.code}.`)}
            </p>
          </>
        ) : (
          <>
            <div>
              <p className="setup__lead">{t('Kode room', 'Room code')}</p>
              <h1 className="lobby__code">{room.code}</h1>
            </div>

            <div className="setup__field">
              <span className="setup__label">{t('Bagikan link ini ke pemain lain', 'Share this link with the other players')}</span>
              <div className="setup__row setup__names">
                <input type="text" readOnly value={link} aria-label={t('Link undangan', 'Invite link')} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn" onClick={copyLink}>
                  {copied ? t('Tersalin', 'Copied') : t('Salin', 'Copy')}
                </button>
              </div>
            </div>

            <div className="setup__field">
              <span className="setup__label">
                {t('Pemain', 'Players')} ({players.length}/{capacity})
              </span>
              <ol className="lobby__players">
                {Array.from({ length: capacity }, (_, i) => (
                  <li key={i} className={players[i] ? '' : 'lobby__empty'}>
                    {players[i]
                      ? `${players[i].name}${i === 0 ? ' (host)' : ''}${i === room.seat ? t(' — kamu', ' — you') : ''}`
                      : t('Menunggu pemain…', 'Waiting for a player…')}
                  </li>
                ))}
              </ol>
            </div>

            <p className="setup__lead">
              {t(
                <>
                  Sistem skor: <strong>{RULESET_NAMES[ruleset]}</strong>. Waktu per giliran:{' '}
                  <strong>{turnSeconds} detik</strong>. Kalau habis, ubin terakhir yang didapat otomatis
                  dibuang.
                  {timeAttack && (
                    <>
                      {' '}
                      <strong>Time attack aktif</strong>: waktunya jadi {rushSeconds(turnSeconds)} detik
                      selama ada pemain yang hampir menang.
                    </>
                  )}
                </>,
                <>
                  Scoring: <strong>{RULESET_NAMES[ruleset]}</strong>. Time per turn:{' '}
                  <strong>{turnSeconds} seconds</strong>. When it runs out, the last tile you got is
                  discarded automatically.
                  {timeAttack && (
                    <>
                      {' '}
                      <strong>Time attack on</strong>: the limit drops to {rushSeconds(turnSeconds)} seconds
                      while any player is about to win.
                    </>
                  )}
                </>,
              )}
            </p>

            {room.isHost ? (
              <button type="button" className="btn btn--primary btn--wide" disabled={!full} onClick={room.start}>
                {full ? t('Mulai permainan', 'Start game') : t('Menunggu semua pemain masuk', 'Waiting for all players to join')}
              </button>
            ) : (
              <p className="setup__lead">{t('Menunggu host memulai permainan…', 'Waiting for the host to start the game…')}</p>
            )}
          </>
        )}

        <button type="button" className="btn btn--wide" onClick={onExit}>
          {t('Keluar', 'Leave')}
        </button>
      </div>
    </main>
  )
}
