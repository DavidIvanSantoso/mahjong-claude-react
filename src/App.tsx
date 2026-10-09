import { useReducer, useState } from 'react'
import { GameTable } from './components/GameTable'
import { GuestGame, HostGame } from './components/OnlineGame'
import { HomeScreen } from './components/HomeScreen'
import { invitedRoom, LocalSetup, OnlineSetup } from './components/SetupScreen'
import { TutorialScreen } from './components/TutorialScreen'
import { initialState, reducer } from './game/state'

type Screen =
  | { kind: 'home' }
  | { kind: 'local-setup' }
  | { kind: 'online-setup' }
  | { kind: 'tutorial' }
  | { kind: 'local'; names: string[] }
  | { kind: 'host'; name: string; capacity: number }
  | { kind: 'guest'; name: string; code: string }

function LocalGame({ names, onExit }: { names: string[]; onExit: () => void }) {
  const [state, dispatch] = useReducer(reducer, names, (initial) =>
    reducer(initialState, { type: 'start', names: initial }),
  )
  return (
    <GameTable
      state={state}
      dispatch={dispatch}
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
      return <LocalSetup onStart={(names) => setScreen({ kind: 'local', names })} onBack={goHome} />
    case 'online-setup':
      return (
        <OnlineSetup
          onHost={(name, capacity) => setScreen({ kind: 'host', name, capacity })}
          onJoin={(name, code) => setScreen({ kind: 'guest', name, code })}
          onBack={goHome}
        />
      )
    case 'tutorial':
      return <TutorialScreen onBack={goHome} />
    case 'local':
      return <LocalGame names={screen.names} onExit={goHome} />
    case 'host':
      return <HostGame name={screen.name} capacity={screen.capacity} onExit={goHome} />
    case 'guest':
      return <GuestGame name={screen.name} code={screen.code} onExit={goHome} />
  }
}
