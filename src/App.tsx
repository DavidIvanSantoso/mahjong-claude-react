import { useReducer, useState } from 'react'
import { GameTable } from './components/GameTable'
import { GuestGame, HostGame } from './components/OnlineGame'
import { SetupScreen } from './components/SetupScreen'
import { initialState, reducer } from './game/state'

type Screen =
  | { kind: 'home' }
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
  const [screen, setScreen] = useState<Screen>({ kind: 'home' })
  const goHome = () => setScreen({ kind: 'home' })

  switch (screen.kind) {
    case 'home':
      return (
        <SetupScreen
          onStartLocal={(names) => setScreen({ kind: 'local', names })}
          onHost={(name, capacity) => setScreen({ kind: 'host', name, capacity })}
          onJoin={(name, code) => setScreen({ kind: 'guest', name, code })}
        />
      )
    case 'local':
      return <LocalGame names={screen.names} onExit={goHome} />
    case 'host':
      return <HostGame name={screen.name} capacity={screen.capacity} onExit={goHome} />
    case 'guest':
      return <GuestGame name={screen.name} code={screen.code} onExit={goHome} />
  }
}
