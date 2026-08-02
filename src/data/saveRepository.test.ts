import { describe, expect, it } from 'vitest'
import { listSaves, openSave, saveElementPositions } from './saveRepository'

describe('saveRepository', () => {
  it('creates a structured save record in the selected slot', async () => {
    const save = await openSave(2)

    expect(save).toMatchObject({
      slot: 2,
      chapter: 1,
      location: 'The Quiet Threshold',
      affinity: 'Unbound',
      playTimeSeconds: 0,
    })
    await expect(listSaves()).resolves.toEqual([save])
  })

  it('continues an existing save without replacing its progress', async () => {
    const original = await openSave(1)
    const continued = await openSave(1)

    expect(continued.createdAt).toBe(original.createdAt)
    expect(continued.slot).toBe(1)
    expect(await listSaves()).toHaveLength(1)
  })

  it('persists the elemental arrangement for a save slot', async () => {
    const original = await openSave(1)
    const elementPositions = {
      ...original.elementPositions,
      Fire: { x: 75, y: 80 },
    }

    await saveElementPositions(1, elementPositions)
    const continued = await openSave(1)

    expect(continued.elementPositions).toEqual(elementPositions)
  })
})
