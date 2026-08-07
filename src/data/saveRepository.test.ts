import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, it } from 'vitest'
import { GameDataCatalog } from '../domain/gameData'
import { createInventoryItem } from '../domain/save'
import {
  brewRecipe,
  claimRewards,
  finishBattle,
  openSave,
  purchaseOffer,
  resolveBattle,
  sellPotion,
  synchronizeGameData,
  usePotion,
} from './saveRepository'

let catalog: GameDataCatalog

beforeAll(async () => {
  const file = await readFile('public/data/EleMENTAL Game Data.xlsx')
  catalog = await GameDataCatalog.fromWorkbook(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
  )
})

describe('saveRepository gameplay', () => {
  it('starts with 10 Gold, five offers, and a three-character party', async () => {
    const save = synchronizeGameData(await openSave(1), catalog)
    expect(save.gold).toBe(10)
    expect(save.shopOffers).toHaveLength(5)
    expect(save.party).toHaveLength(3)

    const purchased = purchaseOffer(save, catalog, 0, { x: 27, y: 41 })
    expect(purchased.inventory).toHaveLength(1)
    expect(purchased.inventory[0].position).toEqual({ x: 27, y: 41 })
    expect(purchased.shopOffers).toHaveLength(5)
  })

  it('discovers, uses, and sells workbook-defined potions', async () => {
    const save = {
      ...synchronizeGameData(await openSave(2), catalog),
      inventory: [
        createInventoryItem('herb', 'Herb', 'ingredient', { x: 40, y: 75 }),
        createInventoryItem('mushroom', 'Mushroom', 'ingredient', { x: 48, y: 75 }),
      ],
    }
    const brewed = brewRecipe(save, catalog, [
      save.inventory[0].id,
      save.inventory[1].id,
    ])
    expect(brewed.discoveredRecipeIds).toContain('healing-draught')
    expect(brewed.inventory[0]).toMatchObject({ kind: 'potion', name: 'Healing Draught' })

    const injured = {
      ...brewed,
      party: brewed.party.map((member, index) =>
        index === 0
          ? { ...member, stats: { ...member.stats, health: 10 } }
          : member,
      ),
    }
    const used = usePotion(injured, catalog, injured.inventory[0].id, injured.party[0].id)
    expect(used.party[0].stats.health).toBe(18)

    const freshIngredients = [
      createInventoryItem('herb', 'Herb', 'ingredient', { x: 40, y: 75 }),
      createInventoryItem('mushroom', 'Mushroom', 'ingredient', { x: 48, y: 75 }),
    ]
    const brewedAgain = brewRecipe(
      { ...used, inventory: freshIngredients },
      catalog,
      [freshIngredients[0].id, freshIngredients[1].id],
    )
    const sold = sellPotion(brewedAgain, catalog, brewedAgain.inventory[0].id)
    expect(sold.knownSaleRecipeIds).toContain('healing-draught')
  })

  it('resolves battle and converts victory into workbook rewards', async () => {
    const save = synchronizeGameData(await openSave(3), catalog)
    const result = resolveBattle(save, catalog)
    expect(result.won).toBe(true)
    const finished = finishBattle(save, catalog, result)
    const claimed = claimRewards(finished, catalog)
    expect(claimed.gold).toBe(16)
    expect(claimed.inventory[0].name).toBe('Mushroom')
    expect(claimed.battlesWon).toBe(1)
  })
})
