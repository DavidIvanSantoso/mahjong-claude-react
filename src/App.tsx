import { useEffect, useReducer, useState } from 'react'
import { GameTable } from './components/GameTable'
import { GuestGame, HostGame } from './components/OnlineGame'
import { HomeScreen } from './components/HomeScreen'
import { invitedRoom, LocalSetup, OnlineSetup } from './components/SetupScreen'
import { TutorialScreen } from './components/TutorialScreen'
import { initialState, reducer } from './game/state'
import { isTimed, timeoutAction, turnLimit } from './game/timer'

type Screen =
  | { kind: 'home' }
  | { kind: 'local-setup' }
  | { kind: 'online-setup' }
  | { kind: 'tutorial' }
  | { kind: 'local'; names: string[]; turnSeconds: number; timeAttack: boolean }
  | { kind: 'host'; name: string; capacity: number; turnSeconds: number; timeAttack: boolean }
  | { kind: 'guest'; name: string; code: string }

interface LocalGameProps {
  names: string[]
  turnSeconds: number
  timeAttack: boolean
  onExit: () => void
}

function LocalGame({ names, turnSeconds, timeAttack, onExit }: LocalGameProps) {
  const [state, dispatch] = useReducer(reducer, names, (initial) =>
    reducer(initialState, { type: 'start', names: initial }),
  )
  const [deadline, setDeadline] = useState<number | null>(null)
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
      onRestart={() => dispatch({ type: 'start', names })}
      onExit={onExit}
    />
  )
}

export function App() {
  // Link undangan (?room=KODE) langsung membuka menu online.
  const [screen, setScreen] = useState<Screen>(() =>
    invitedRoom() ? { kind: 'online-setup' } : { kind: 'home' },
  )
  const goHome = () => setScreen({ kind: 'home' })

  switch (screen.kind) {
    case 'home':
      return (
        <HomeScreen
          onLocal={() => setScreen({ kind: 'local-setup' })}
          onOnline={() => setScreen({ kind: 'online-setup' })}
          onTutorial={() => setScreen({ kind: 'tutorial' })}
        />
      )
    case 'local-setup':
      return <LocalSetup onStart={(names, turnSeconds, timeAttack) =>
            setScreen({ kind: 'local', names, turnSeconds, timeAttack })
          } onBack={goHome} />
    case 'online-setup':
      return (
        <OnlineSetup
          onHost={(name, capacity, turnSeconds, timeAttack) =>
            setScreen({ kind: 'host', name, capacity, turnSeconds, timeAttack })
          }
          onJoin={(name, code) => setScreen({ kind: 'guest', name, code })}
          onBack={goHome}
        />
      )
    case 'tutorial':
      return <TutorialScreen onBack={goHome} />
    case 'local':
      return (
        <LocalGame
          names={screen.names}
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
          onExit={goHome}
        />
      )
    case 'guest':
      return <GuestGame name={screen.name} code={screen.code} onExit={goHome} />
  }
}
