import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { GameDataCatalog } from './gameData'

describe('GameDataCatalog', () => {
  it('loads explicit two-ingredient recipes without elemental attributes', async () => {
    const file = await readFile('public/data/EleMENTAL Game Data.xlsx')
    const catalog = await GameDataCatalog.fromWorkbook(
      file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
    )

    expect(catalog.ingredients).toHaveLength(7)
    expect(catalog.recipeFor('mushroom', 'herb')).toMatchObject({
      name: 'Healing Draught',
      benefitType: 'heal',
      benefitValue: 8,
    })
    expect(catalog.classes.map((entry) => entry.name)).toContain('White Mage')
    expect(catalog.enemies[0]).toMatchObject({ name: 'Cellar Slime', gold: 6 })
  })
})
