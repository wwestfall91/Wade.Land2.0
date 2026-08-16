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

  it('brews Base+Modifier potions, applies passive/one-time effects, and rejects invalid pairs', async () => {
    const save = {
      ...synchronizeGameData(await openSave(2), catalog),
      inventory: [
        createInventoryItem('deathcap', 'Deathcap', 'ingredient', { x: 40, y: 75 }),
        createInventoryItem('red-essence', 'Red Essence', 'ingredient', { x: 42, y: 75 }),
        createInventoryItem('spider-silk', 'Spider Silk', 'ingredient', { x: 44, y: 75 }),
        createInventoryItem('moon-blossom', 'Moon Blossom', 'ingredient', { x: 46, y: 75 }),
        createInventoryItem('elven-hair', 'Elven Hair', 'ingredient', { x: 48, y: 75 }),
      ],
    }

    // Base + Base is not a valid combination.
    expect(() =>
      brewRecipe(save, catalog, [save.inventory[0].id, save.inventory[1].id]),
    ).toThrow('A potion needs exactly one Base ingredient and one Modifier ingredient.')

    // Deathcap (base) + Spider Silk (modifier) => "-> Dies: +5 AGI", a passive ability.
    const brewedPassive = brewRecipe(save, catalog, [
      save.inventory[0].id,
      save.inventory[2].id,
    ])
    expect(brewedPassive.discoveredRecipeIds).toContain('deathcap__spider-silk')
    const passivePotion = brewedPassive.inventory.find((item) => item.kind === 'potion')!
    expect(passivePotion).toMatchObject({ name: 'Deathcap & Spider Silk Potion' })

    const memberId = brewedPassive.party[0].id
    const learned = usePotion(brewedPassive, catalog, passivePotion.id, memberId)
    expect(learned.party[0].passivePotionAbilityIds).toEqual(['deathcap__spider-silk'])
    expect(learned.inventory.some((item) => item.kind === 'potion')).toBe(false)

    // Moon Blossom (base) + Elven Hair (modifier) => "Increase MAG +1", a one-time effect.
    const brewedOneTime = brewRecipe(learned, catalog, [
      learned.inventory.find((item) => item.definitionId === 'moon-blossom')!.id,
      learned.inventory.find((item) => item.definitionId === 'elven-hair')!.id,
    ])
    const oneTimePotion = brewedOneTime.inventory.find((item) => item.kind === 'potion')!
    const oneTimeDefinition = catalog.potion(oneTimePotion.definitionId)
    expect(oneTimeDefinition).toMatchObject({ isPassive: false, effectText: 'Increase MAG +1' })

    const beforeMagic = brewedOneTime.party[0].stats.magic
    const consumed = usePotion(brewedOneTime, catalog, oneTimePotion.id, brewedOneTime.party[0].id)
    expect(consumed.party[0].stats.magic).toBe(beforeMagic + 1)
    expect(consumed.inventory.some((item) => item.kind === 'potion')).toBe(false)

  })

  it('resolves battle and converts victory into workbook rewards', async () => {
    const save = synchronizeGameData(await openSave(3), catalog)
    const result = resolveBattle(save, catalog)
    expect(result.won).toBe(true)
    const finished = finishBattle(save, catalog, result)
    const claimed = claimRewards(finished, catalog)
    expect(claimed.gold).toBe(16)
    expect(claimed.inventory[0].name).toBe('Spider Silk')
    expect(claimed.battlesWon).toBe(1)
  })
})
