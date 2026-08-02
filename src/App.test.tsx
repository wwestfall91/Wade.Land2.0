import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { db, openSave } from './data/saveRepository'
import { useGameStore } from './store/gameStore'

describe('App', () => {
  beforeEach(async () => {
    await db.saves.clear()
    useGameStore.getState().leaveGame()
  })

  it('starts a game from an empty slot and shows it as occupied on return', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /file 2/i }))
    expect(await screen.findByRole('heading', { name: 'The Quiet Threshold' })).toBeInTheDocument()
    expect(screen.getByText('Vessel 02')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /return to title/i }))
    expect(await screen.findByRole('button', { name: /file 2/i })).toHaveTextContent(
      'The Quiet Threshold',
    )
  })

  it('loads and continues an occupied slot', async () => {
    await openSave(3)
    const user = userEvent.setup()
    render(<App />)

    const occupiedSlot = await screen.findByRole('button', { name: /file 3/i })
    expect(occupiedSlot).toHaveTextContent('Chapter 1')
    await user.click(occupiedSlot)

    expect(await screen.findByRole('heading', { name: 'The Quiet Threshold' })).toBeInTheDocument()
    expect(screen.getByText('Vessel 03')).toBeInTheDocument()
  })

  it('shows all four elements and lets the player reposition them', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /file 1/i }))

    const fire = await screen.findByRole('button', { name: /fire element/i })
    expect(screen.getByRole('button', { name: /air element/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /earth element/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /water element/i })).toBeInTheDocument()

    fire.focus()
    await user.keyboard('{ArrowRight}{ArrowDown}')
    expect(fire).toHaveStyle({ left: '52%', top: '26%' })

    const workspace = screen.getByTestId('element-workspace')
    workspace.getBoundingClientRect = () =>
      ({
        bottom: 600,
        height: 600,
        left: 0,
        right: 800,
        top: 0,
        width: 800,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect
    fire.getBoundingClientRect = () =>
      ({
        bottom: 140,
        height: 80,
        left: 80,
        right: 160,
        top: 60,
        width: 80,
        x: 80,
        y: 60,
        toJSON: () => ({}),
      }) as DOMRect

    fireEvent.pointerDown(fire, { clientX: 120, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(fire, { clientX: 600, clientY: 500, pointerId: 1 })
    fireEvent.pointerUp(fire, { pointerId: 1 })

    expect(fire).toHaveStyle({ left: '75%', top: '83.33333333333334%' })
    await waitFor(async () => {
      await expect(db.saves.get(1)).resolves.toMatchObject({
        elementPositions: {
          Fire: { x: 75, y: 83.33333333333334 },
        },
      })
    })

    await user.click(screen.getByRole('button', { name: /return to title/i }))
    await user.click(await screen.findByRole('button', { name: /file 1/i }))

    expect(await screen.findByRole('button', { name: /fire element/i })).toHaveStyle({
      left: '75%',
      top: '83.33333333333334%',
    })
  })
})
