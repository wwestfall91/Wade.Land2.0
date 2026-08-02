import { render, screen } from '@testing-library/react'
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
})
