import { useEffect, useReducer, useState } from 'react'
import { GameTable } from './components/GameTable'
import { GuestGame, HostGame } from './components/OnlineGame'
import { HomeScreen } from './components/HomeScreen'
import { MusicProvider } from './components/MusicPlayer'
import { invitedRoom, LocalSetup, OnlineSetup } from './components/SetupScreen'
import { useRulesetTheme } from './components/theme'
import { TutorialScreen } from './components/TutorialScreen'
import { roundDeltas } from './game/scoring'
import { initialState, nextDeal, reducer, rollForDealer, type Ruleset } from './game/state'
import { isTimed, timeoutAction, turnLimit } from './game/timer'

type Screen =
  | { kind: 'home' }
  | { kind: 'local-setup' }
  | { kind: 'online-setup' }
  | { kind: 'tutorial' }
  | { kind: 'local'; names: string[]; turnSeconds: number; timeAttack: boolean }
  | { kind: 'host'; name: string; capacity: number; turnSeconds: number; timeAttack: boolean }
  | { kind: 'guest'; name: string; code: string }

const RULESET_KEY = 'mahjong-ruleset'

/** Sistem permainan yang terakhir dipilih di perangkat ini. */
function savedRuleset(): Ruleset {
  try {
    return localStorage.getItem(RULESET_KEY) === 'hk' ? 'hk' : 'classic'
  } catch {
    return 'classic'
  }
}

interface LocalGameProps {
  names: string[]
  ruleset: Ruleset
  turnSeconds: number
  timeAttack: boolean
  onExit: () => void
}

function LocalGame({ names, ruleset, turnSeconds, timeAttack, onExit }: LocalGameProps) {
  const [state, dispatch] = useReducer(reducer, names, (initial) =>
    reducer(initialState, { type: 'start', names: initial, deal: rollForDealer(ruleset, initial.length) }),
  )
  const [deadline, setDeadline] = useState<number | null>(null)
  // Skor dari ronde-ronde sebelumnya; hasil ronde yang sedang tampil dijumlahkan saat ditampilkan.
  const [banked, setBanked] = useState(() => names.map(() => 0))
  const deltas = roundDeltas(state)
  const scores = banked.map((score, i) => score + deltas[i])
  const limit = turnLimit(state, turnSeconds, timeAttack)

  // Tiap state baru yang menunggu keputusan pemain mendapat waktu penuh; saat habis,
  // ubin terakhir dibuang (atau klaim dilewatkan) secara otomatis.
  useEffect(() => {
    const action = isTimed(state) ? timeoutAction(state) : null
    if (!action) {
      setDeadline(null)
      return
    }
    setDeadline(Date.now() + limit.seconds * 1000)
    const timer = setTimeout(() => dispatch(action), limit.seconds * 1000)
    return () => clearTimeout(timer)
  }, [state, limit.seconds])

  return (
    <GameTable
      state={state}
      dispatch={dispatch}
      turnSeconds={limit.seconds}
      rush={limit.rush}
      deadline={deadline}
      // Mode Normal di satu perangkat tidak memakai papan skor.
      scores={ruleset === 'hk' ? scores : undefined}
      onRestart={() => {
        setBanked(scores)
        dispatch({ type: 'start', names, deal: nextDeal(state) })
      }}
      onExit={onExit}
    />
  )
}

function Screens() {
  // Link undangan (?room=KODE) langsung membuka menu online.
  const [screen, setScreen] = useState<Screen>(() =>
    invitedRoom() ? { kind: 'online-setup' } : { kind: 'home' },
  )
  const [ruleset, setRuleset] = useState(savedRuleset)
  useRulesetTheme(ruleset)
  const goHome = () => setScreen({ kind: 'home' })

  function chooseRuleset(next: Ruleset) {
    setRuleset(next)
    try {
      localStorage.setItem(RULESET_KEY, next)
    } catch {
      // localStorage bisa diblokir; pilihannya tetap berlaku selama halaman terbuka.
    }
  }

  switch (screen.kind) {
    case 'home':
      return (
        <HomeScreen
          ruleset={ruleset}
          onRuleset={chooseRuleset}
          onLocal={() => setScreen({ kind: 'local-setup' })}
          onOnline={() => setScreen({ kind: 'online-setup' })}
          onTutorial={() => setScreen({ kind: 'tutorial' })}
        />
      )
    case 'local-setup':
      return (
        <LocalSetup
          ruleset={ruleset}
          onStart={(names, turnSeconds, timeAttack) =>
            setScreen({ kind: 'local', names, turnSeconds, timeAttack })
          }
          onBack={goHome}
        />
      )
    case 'online-setup':
      return (
        <OnlineSetup
          ruleset={ruleset}
          onHost={(name, capacity, turnSeconds, timeAttack) =>
            setScreen({ kind: 'host', name, capacity, turnSeconds, timeAttack })
          }
          onJoin={(name, code) => setScreen({ kind: 'guest', name, code })}
          onBack={goHome}
        />
      )
    case 'tutorial':
      return <TutorialScreen ruleset={ruleset} onBack={goHome} />
    case 'local':
      return (
        <LocalGame
          names={screen.names}
          ruleset={ruleset}
          turnSeconds={screen.turnSeconds}
          timeAttack={screen.timeAttack}
          onExit={goHome}
        />
      )
    case 'host':
      return (
        <HostGame
          name={screen.name}
          capacity={screen.capacity}
          turnSeconds={screen.turnSeconds}
          timeAttack={screen.timeAttack}
          ruleset={ruleset}
          onExit={goHome}
        />
      )
    case 'guest':
      return <GuestGame name={screen.name} code={screen.code} onExit={goHome} />
  }
}

export function App() {
  return (
    // Pemutar musik dipasang di luar layar-layarnya, supaya musik tidak terputus saat berpindah layar.
    <MusicProvider>
      <Screens />
    </MusicProvider>
  )
}
