import { useGameStore } from '../store/gameStore'

interface GameScreenProps {
  onReturn: () => void
}

export function GameScreen({ onReturn }: GameScreenProps) {
  const currentSave = useGameStore((state) => state.currentSave)

  if (!currentSave) {
    return (
      <main className="app-shell app-shell--centered" role="alert">
        <p className="status-copy">Restoring your game...</p>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <div className="game-screen">
        <section className="game-panel" aria-labelledby="game-title">
          <p className="eyebrow">Vessel {String(currentSave.slot).padStart(2, '0')}</p>
          <h1 id="game-title">{currentSave.location}</h1>
          <p className="game-copy">
            The air is still here. Your journey has been recorded, and the first element is waiting
            for you to make a choice.
          </p>
          <dl className="game-stats">
            <div>
              <dt>Chapter</dt>
              <dd>{currentSave.chapter}</dd>
            </div>
            <div>
              <dt>Affinity</dt>
              <dd>{currentSave.affinity}</dd>
            </div>
          </dl>
          <button className="text-button" type="button" onClick={onReturn}>
            Return to title
          </button>
        </section>
      </div>
    </main>
  )
}
