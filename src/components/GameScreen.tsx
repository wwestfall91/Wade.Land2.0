import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import airSprite from '../assets/sprites/elements/Air.png'
import earthSprite from '../assets/sprites/elements/Earth.png'
import fireSprite from '../assets/sprites/elements/Fire.png'
import waterSprite from '../assets/sprites/elements/Water.png'
import { saveElementPositions } from '../data/saveRepository'
import {
  createDefaultElementPositions,
  type ElementName,
  type ElementPosition,
  type ElementPositions,
} from '../domain/save'
import { useGameStore } from '../store/gameStore'

interface GameScreenProps {
  onReturn: () => void
}

const elements = [
  { name: 'Fire', sprite: fireSprite },
  { name: 'Air', sprite: airSprite },
  { name: 'Earth', sprite: earthSprite },
  { name: 'Water', sprite: waterSprite },
] as const

interface DragState {
  name: ElementName
  pointerId: number
  offsetX: number
  offsetY: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum)

export function GameScreen({ onReturn }: GameScreenProps) {
  const currentSave = useGameStore((state) => state.currentSave)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const initialPositions = currentSave?.elementPositions ?? createDefaultElementPositions()
  const positionsRef = useRef<ElementPositions>(initialPositions)
  const [positions, setPositions] = useState(initialPositions)
  const [saveError, setSaveError] = useState<string | null>(null)

  const moveElement = (name: ElementName, position: ElementPosition): ElementPositions => {
    const nextPositions = { ...positionsRef.current, [name]: position }
    positionsRef.current = nextPositions
    setPositions(nextPositions)
    return nextPositions
  }

  const persistPositions = (nextPositions: ElementPositions) => {
    if (!currentSave) return

    setSaveError(null)
    void saveElementPositions(currentSave.slot, nextPositions).catch(() => {
      setSaveError('The elemental arrangement could not be recorded.')
    })
  }

  const handlePointerDown = (name: ElementName, event: PointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    dragRef.current = {
      name,
      pointerId: event.pointerId,
      offsetX: event.clientX - (bounds.left + bounds.width / 2),
      offsetY: event.clientY - (bounds.top + bounds.height / 2),
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const workspace = workspaceRef.current
    if (!drag || drag.pointerId !== event.pointerId || !workspace) return

    const workspaceBounds = workspace.getBoundingClientRect()
    const elementBounds = event.currentTarget.getBoundingClientRect()
    const halfWidth = elementBounds.width / 2
    const halfHeight = elementBounds.height / 2
    const centerX = clamp(
      event.clientX - workspaceBounds.left - drag.offsetX,
      halfWidth,
      workspaceBounds.width - halfWidth,
    )
    const centerY = clamp(
      event.clientY - workspaceBounds.top - drag.offsetY,
      halfHeight,
      workspaceBounds.height - halfHeight,
    )

    moveElement(drag.name, {
      x: (centerX / workspaceBounds.width) * 100,
      y: (centerY / workspaceBounds.height) * 100,
    })
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    dragRef.current = null
    persistPositions(positionsRef.current)
  }

  const handleKeyDown = (name: ElementName, event: KeyboardEvent<HTMLButtonElement>) => {
    const movement = {
      ArrowDown: { x: 0, y: 2 },
      ArrowLeft: { x: -2, y: 0 },
      ArrowRight: { x: 2, y: 0 },
      ArrowUp: { x: 0, y: -2 },
    }[event.key]

    if (!movement) return

    event.preventDefault()
    const current = positions[name]
    const workspaceBounds = workspaceRef.current?.getBoundingClientRect()
    const elementBounds = event.currentTarget.getBoundingClientRect()
    const horizontalInset = workspaceBounds?.width
      ? (elementBounds.width / 2 / workspaceBounds.width) * 100
      : 0
    const verticalInset = workspaceBounds?.height
      ? (elementBounds.height / 2 / workspaceBounds.height) * 100
      : 0
    const nextPositions = moveElement(name, {
      x: clamp(current.x + movement.x, horizontalInset, 100 - horizontalInset),
      y: clamp(current.y + movement.y, verticalInset, 100 - verticalInset),
    })
    persistPositions(nextPositions)
  }

  if (!currentSave) {
    return (
      <main className="app-shell app-shell--centered" role="alert">
        <p className="status-copy">Restoring your game...</p>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <div className="game-screen" ref={workspaceRef} data-testid="element-workspace">
        <header className="game-hud">
          <p className="eyebrow">Vessel {String(currentSave.slot).padStart(2, '0')}</p>
          <h1 id="game-title">{currentSave.location}</h1>
          <p className="game-meta">
            Chapter {currentSave.chapter} / {currentSave.affinity}
          </p>
          <p className="game-instruction">Move the four foundations</p>
          <button className="text-button" type="button" onClick={onReturn}>
            Return to title
          </button>
          {saveError && (
            <p className="game-save-error" role="alert">
              {saveError}
            </p>
          )}
        </header>

        {elements.map(({ name, sprite }) => (
          <button
            aria-label={`${name} element. Drag to move or use arrow keys.`}
            className="element-token"
            key={name}
            onKeyDown={(event) => handleKeyDown(name, event)}
            onPointerCancel={handlePointerUp}
            onPointerDown={(event) => handlePointerDown(name, event)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ left: `${positions[name].x}%`, top: `${positions[name].y}%` }}
            type="button"
          >
            <img alt="" draggable="false" src={sprite} />
            <span>{name}</span>
          </button>
        ))}
      </div>
    </main>
  )
}
