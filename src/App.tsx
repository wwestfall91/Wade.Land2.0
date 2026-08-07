import { useMachine } from '@xstate/react'
import { appMachine } from './appMachine'
import { GameScreen } from './components/GameScreen'
import { TitleScreen } from './components/TitleScreen'
import './App.css'

function App() {
  const [snapshot, send] = useMachine(appMachine)

  if (snapshot.matches('loading')) {
    return (
      <main className="app-shell app-shell--centered" aria-live="polite">
        <div className="loader" aria-hidden="true" />
        <p className="status-copy">Reading game data...</p>
      </main>
    )
  }

  if (snapshot.matches('error')) {
    return (
      <main className="app-shell app-shell--centered">
        <section className="error-card" role="alert">
          <p className="eyebrow">The archive is unavailable</p>
          <h1>Something shifted out of place.</h1>
          <p>{snapshot.context.error ?? 'Your save data could not be loaded.'}</p>
          <button className="primary-button" type="button" onClick={() => send({ type: 'RETRY' })}>
            Try again
          </button>
        </section>
      </main>
    )
  }

  if (snapshot.matches('playing')) {
    return <GameScreen onReturn={() => send({ type: 'RETURN_TO_TITLE' })} />
  }

  return (
    <TitleScreen
      isOpening={snapshot.matches('opening')}
      saves={snapshot.context.saves}
      onSelect={(slot) => send({ type: 'SELECT_SLOT', slot })}
    />
  )
}

export default App
