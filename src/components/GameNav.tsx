import { t } from '../i18n'

export type GameId = 'mahjong' | 'uno'

const GAMES: { id: GameId; label: string; icon: string }[] = [
  // Ubin tegak dengan lingkaran (ubin bulat)
  {
    id: 'mahjong',
    label: 'Mahjong',
    icon: 'M4.5 1h7A1.5 1.5 0 0 1 13 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-11A1.5 1.5 0 0 1 4.5 1ZM8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 1.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z',
  },
  // Kartu miring dengan oval di tengah
  {
    id: 'uno',
    label: 'UNO',
    icon: 'M4 1h8a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 12 15H4a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 4 1Zm6.3 3.2c-1-.6-2.9.3-4.1 2.2-1.2 1.9-1.4 3.9-.5 4.4 1 .6 2.9-.3 4.1-2.2 1.2-1.9 1.4-3.9.5-4.4Z',
  },
]

/** Navbar pemilih game di pojok kiri atas homescreen tiap game. */
export function GameNav({ game, onChange }: { game: GameId; onChange: (game: GameId) => void }) {
  return (
    <nav className="game-nav" aria-label={t('Pilih game', 'Choose a game')}>
      {GAMES.map((option) => {
        const active = option.id === game
        return (
          <button
            key={option.id}
            type="button"
            className={`game-nav__item ${active ? 'game-nav__item--active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(option.id)}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" fillRule="evenodd" aria-hidden="true">
              <path d={option.icon} />
            </svg>
            {option.label}
          </button>
        )
      })}
    </nav>
  )
}
