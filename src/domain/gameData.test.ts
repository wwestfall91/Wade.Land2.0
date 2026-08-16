import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { GameDataCatalog } from './gameData'

describe('GameDataCatalog', () => {
  it('parses base ingredients, modifier ingredients, and their ability matrix', async () => {
    const file = await readFile('public/data/EleMENTAL Game Data.xlsx')
    const catalog = await GameDataCatalog.fromWorkbook(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    )

    expect(catalog.baseIngredients).toHaveLength(10)
    expect(catalog.modifierIngredients).toHaveLength(19)
    expect(catalog.baseIngredients.map((entry) => entry.name)).toContain('Deathcap')
    expect(catalog.modifierIngredients.map((entry) => entry.name)).toContain('Spider Silk')

    const recipe = catalog.recipeFor('deathcap', 'spider-silk')
    expect(recipe).toMatchObject({
      trigger: '-> Dies',
      effectText: '+5 AGI',
      isPassive: true,
    })

    // Base+Base and Modifier+Modifier are not valid combinations.
    expect(catalog.recipeFor('deathcap', 'red-essence')).toBeUndefined()
    expect(catalog.recipeFor('spider-silk', 'rock')).toBeUndefined()

    // A cell without a trigger phrase is a one-time effect, not a passive.
    const oneTime = catalog.recipeFor('moon-blossom', 'elven-hair')
    expect(oneTime).toMatchObject({ trigger: null, isPassive: false, effectText: 'Increase MAG +1' })

    expect(catalog.classes.map((entry) => entry.name)).toContain('White Mage')
    const warrior = catalog.class('warrior')
    expect(warrior?.classAbility).toMatchObject({ trigger: 'While Frontline', isPassive: true })
    const adventurer = catalog.class('adventurer')
    expect(adventurer?.classAbility).toBeNull()

    expect(catalog.buffs.map((entry) => entry.name)).toContain('Drunk')
    expect(catalog.debuffs.map((entry) => entry.name)).toContain('Poison')
    expect(catalog.effects.map((entry) => entry.name)).toContain('Overheal')

    expect(catalog.enemies[0]).toMatchObject({ name: 'Cellar Slime', gold: 6 })
  })
})
