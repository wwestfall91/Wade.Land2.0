import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { db } from './data/saveRepository'
import { useGameStore } from './store/gameStore'

describe('GDD prototype', () => {
  beforeEach(async () => {
    await db.saves.clear()
    useGameStore.getState().leaveGame()
  })

  it('opens a unified laboratory with party, brewing, shop, and fight controls', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /file 1/i }))

    expect(await screen.findByLabelText('10 Gold')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Party' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Brewing Station' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shop' })).toBeInTheDocument()
    const offers = await screen.findAllByRole('button', { name: /select .* gold/i })
    expect(offers).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Brew' })).toHaveAttribute(
      'title',
      'Please insert two ingredients.',
    )
    expect(screen.getByRole('button', { name: 'Fight!' })).toBeEnabled()

    const buy = screen.getByRole('button', { name: 'Buy' })
    expect(buy).toBeDisabled()
    await user.click(offers[0])
    expect(buy).toBeEnabled()
    await user.click(buy)
    expect(await screen.findByRole('button', { name: /ingredient$/i })).toBeInTheDocument()
  })
})
