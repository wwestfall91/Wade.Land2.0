import type { WorkBook, WorkSheet } from '@e965/xlsx'

export type PotionBenefitType = 'heal' | 'attack' | 'max-health' | 'speed' | 'luck'

export interface IngredientDefinition {
  id: string
  name: string
  description: string
  gold: number
  spriteUrl?: string
}

export interface PotionDefinition {
  id: string
  name: string
  ingredientA: string
  ingredientB: string
  description: string
  benefit: string
  benefitType: PotionBenefitType
  benefitValue: number
  saleGold: number
}

export interface ClassDefinition {
  id: string
  name: string
  description: string
  passive: string
}

export interface EnemyDefinition {
  id: string
  name: string
  health: number
  attack: number
  gold: number
  dropIngredientId: string
}

type Row = Record<string, unknown>
type XlsxModule = typeof import('@e965/xlsx')

const normalize = (value: string) => value.trim().toLocaleLowerCase()
export const dataId = (value: string) =>
  normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const text = (row: Row, column: string) => String(row[column] ?? '').trim()
const number = (row: Row, column: string) => {
  const value = Number(row[column])
  if (!Number.isFinite(value)) throw new Error(`${column} must be numeric.`)
  return value
}

const findSheet = (
  workbook: WorkBook,
  xlsx: XlsxModule,
  columns: readonly string[],
): WorkSheet => {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name]
    const [header] = xlsx.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
    })
    if (Array.isArray(header) && columns.every((column) => header.includes(column))) {
      return sheet
    }
  }
  throw new Error(`No worksheet contains ${columns.join(', ')}.`)
}

const rowsFor = (
  workbook: WorkBook,
  xlsx: XlsxModule,
  columns: readonly string[],
) => xlsx.utils.sheet_to_json<Row>(findSheet(workbook, xlsx, columns), { defval: '' })

const INGREDIENT_COLUMNS = ['Name', 'Description', 'Gold'] as const
const POTION_COLUMNS = [
  'Potion Name',
  'Ingredient 1',
  'Ingredient 2',
  'Description',
  'Benefit',
  'Benefit Type',
  'Benefit Value',
  'Sale Gold',
] as const
const CLASS_COLUMNS = ['Class Name', 'Description', 'Passive'] as const
const ENEMY_COLUMNS = ['Enemy Name', 'Health', 'Attack', 'Gold', 'Drop Ingredient'] as const
const BENEFIT_TYPES = new Set<PotionBenefitType>([
  'heal',
  'attack',
  'max-health',
  'speed',
  'luck',
])

export class GameDataCatalog {
  readonly ingredients: readonly IngredientDefinition[]
  readonly potions: readonly PotionDefinition[]
  readonly classes: readonly ClassDefinition[]
  readonly enemies: readonly EnemyDefinition[]
  readonly warnings: readonly string[]
  readonly signature: string

  private constructor(
    ingredients: IngredientDefinition[],
    potions: PotionDefinition[],
    classes: ClassDefinition[],
    enemies: EnemyDefinition[],
    warnings: string[],
  ) {
    this.ingredients = ingredients
    this.potions = potions
    this.classes = classes
    this.enemies = enemies
    this.warnings = warnings
    this.signature = JSON.stringify({ ingredients, potions, classes, enemies, warnings })
  }

  static async fromWorkbook(
    data: ArrayBuffer,
    sprites: ReadonlyMap<string, string> = new Map(),
  ) {
    const xlsx = await import('@e965/xlsx')
    const workbook = xlsx.read(new Uint8Array(data), { type: 'array' })
    const warnings: string[] = []
    const ingredients: IngredientDefinition[] = []
    const ingredientNames = new Set<string>()

    for (const row of rowsFor(workbook, xlsx, INGREDIENT_COLUMNS)) {
      const name = text(row, 'Name')
      if (!name) continue
      const id = dataId(name)
      if (ingredientNames.has(id)) {
        warnings.push(`Duplicate ingredient "${name}" was omitted.`)
        continue
      }
      try {
        const gold = number(row, 'Gold')
        if (gold < 0) throw new Error('Gold must be zero or greater.')
        ingredientNames.add(id)
        ingredients.push({
          id,
          name,
          description: text(row, 'Description'),
          gold,
          spriteUrl: sprites.get(normalize(name)),
        })
      } catch (error) {
        warnings.push(`${name}: ${error instanceof Error ? error.message : 'Invalid row.'}`)
      }
    }

    const potions: PotionDefinition[] = []
    const recipePairs = new Set<string>()
    for (const row of rowsFor(workbook, xlsx, POTION_COLUMNS)) {
      const name = text(row, 'Potion Name')
      if (!name) continue
      const ingredientA = dataId(text(row, 'Ingredient 1'))
      const ingredientB = dataId(text(row, 'Ingredient 2'))
      const pair = [ingredientA, ingredientB].sort().join('+')
      const benefitType = normalize(text(row, 'Benefit Type')) as PotionBenefitType
      try {
        if (!ingredientNames.has(ingredientA) || !ingredientNames.has(ingredientB)) {
          throw new Error('Both ingredients must exist on the Ingredients sheet.')
        }
        if (recipePairs.has(pair)) throw new Error('That ingredient pair already has a recipe.')
        if (!BENEFIT_TYPES.has(benefitType)) {
          throw new Error('Benefit Type must be heal, attack, max-health, speed, or luck.')
        }
        recipePairs.add(pair)
        potions.push({
          id: dataId(name),
          name,
          ingredientA,
          ingredientB,
          description: text(row, 'Description'),
          benefit: text(row, 'Benefit'),
          benefitType,
          benefitValue: number(row, 'Benefit Value'),
          saleGold: number(row, 'Sale Gold'),
        })
      } catch (error) {
        warnings.push(`${name}: ${error instanceof Error ? error.message : 'Invalid row.'}`)
      }
    }

    const classes = rowsFor(workbook, xlsx, CLASS_COLUMNS)
      .map((row) => ({
        id: dataId(text(row, 'Class Name')),
        name: text(row, 'Class Name'),
        description: text(row, 'Description'),
        passive: text(row, 'Passive'),
      }))
      .filter((entry) => entry.name)

    const enemies: EnemyDefinition[] = []
    for (const row of rowsFor(workbook, xlsx, ENEMY_COLUMNS)) {
      const name = text(row, 'Enemy Name')
      if (!name) continue
      enemies.push({
        id: dataId(name),
        name,
        health: number(row, 'Health'),
        attack: number(row, 'Attack'),
        gold: number(row, 'Gold'),
        dropIngredientId: dataId(text(row, 'Drop Ingredient')),
      })
    }

    return new GameDataCatalog(ingredients, potions, classes, enemies, warnings)
  }

  ingredient(id: string) {
    return this.ingredients.find((ingredient) => ingredient.id === id)
  }

  potion(id: string) {
    return this.potions.find((potion) => potion.id === id)
  }

  class(id: string) {
    return this.classes.find((characterClass) => characterClass.id === id)
  }

  recipeFor(ingredientA: string, ingredientB: string) {
    const pair = [ingredientA, ingredientB].sort().join('+')
    return this.potions.find(
      (potion) => [potion.ingredientA, potion.ingredientB].sort().join('+') === pair,
    )
  }
}
