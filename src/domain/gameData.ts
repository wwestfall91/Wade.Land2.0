import type { WorkBook, WorkSheet } from '@e965/xlsx'

export type Rarity = 'I' | 'II' | 'III'

/** Gold cost assigned per rarity tier. Tune here once real pricing is defined. */
const RARITY_GOLD: Record<Rarity, number> = { I: 3, II: 6, III: 10 }

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

/** Strips the leading backtick some cells use to stop spreadsheet apps from
 * treating the value as a formula (per the workbook author's note). */
const stripBacktick = (raw: string) => raw.replace(/^`+/, '').trim()

/** Rarity labels are usually roman numerals, but a couple of cells use pipe
 * characters ("||", "|||") as a visual stand-in for II/III. */
const parseRarity = (raw: string): Rarity => {
  const normalized = raw.trim().replace(/\|/g, 'I').toUpperCase()
  return normalized === 'II' || normalized === 'III' ? normalized : 'I'
}

export interface ParsedAbility {
  /** The trigger phrase (e.g. "On Death", "While Drunk"), or null when the
   * effect only happens once, immediately, on consumption/activation. */
  trigger: string | null
  effectText: string
  /** True when the ability is retained permanently (has a trigger phrase). */
  isPassive: boolean
  rawText: string
}

/** Cells follow the pattern "Trigger phrase:\nEffect text". Anything without
 * a colon-terminated first line is a one-time effect, not a passive. */
const parseAbilityCell = (raw: string): ParsedAbility => {
  const cleaned = stripBacktick(raw)
  const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean)
  const [first, ...rest] = lines
  if (first && rest.length > 0 && first.endsWith(':')) {
    return {
      trigger: first.slice(0, -1).trim(),
      effectText: rest.join('\n'),
      isPassive: true,
      rawText: cleaned,
    }
  }
  return { trigger: null, effectText: cleaned, isPassive: false, rawText: cleaned }
}

export interface IngredientDefinition {
  id: string
  name: string
  kind: 'base' | 'modifier'
  rarity: Rarity
  gold: number
  spriteUrl?: string
  /** Only present for base ingredients: the row's trigger theme (e.g. "Death"). */
  triggerLabel?: string
}

export interface AbilityDefinition {
  id: string
  baseIngredientId: string
  modifierIngredientId: string
  trigger: string | null
  effectText: string
  isPassive: boolean
  rawText: string
}

export interface PotionDefinition {
  id: string
  name: string
  baseIngredientId: string
  modifierIngredientId: string
  description: string
  trigger: string | null
  effectText: string
  isPassive: boolean
}

export interface ClassAbility {
  trigger: string | null
  effectText: string
  isPassive: boolean
  rawText: string
}

export interface ClassDefinition {
  id: string
  name: string
  description: string
  primaryStats: string[]
  /** Raw stat-boost tier from the sheet ("+", "++", "+++"). */
  statBoostTier: string
  classAbility: ClassAbility | null
}

export interface StatusEffectDefinition {
  id: string
  name: string
  description: string
  stacking: boolean
}

export interface DebuffDefinition {
  id: string
  name: string
  description: string
}

export interface InstantEffectDefinition {
  id: string
  name: string
  description: string
}

export interface EnemyDefinition {
  id: string
  name: string
  health: number
  attack: number
  gold: number
  dropIngredientId: string
}

const findSheetByColumns = (
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
) => xlsx.utils.sheet_to_json<Row>(findSheetByColumns(workbook, xlsx, columns), { defval: '' })

/** Finds the ability matrix sheet by name instead of headers, since its
 * header row is irregular (merged/blank cells unsuited to object parsing). */
const findMatrixSheet = (workbook: WorkBook): WorkSheet => {
  const name = workbook.SheetNames.find(
    (candidate) =>
      /filtered.*potions/i.test(candidate) && !/master/i.test(candidate),
  )
  if (!name) throw new Error('No "Filtered Potions List" worksheet was found.')
  return workbook.Sheets[name]
}

const CLASS_COLUMNS = ['Class', 'Description', 'Class Ability', 'Primary Stat(s)', 'Stat Boost'] as const
const BUFF_COLUMNS = ['Name', 'Description', 'Type'] as const
const DEBUFF_COLUMNS = ['Name', 'Description'] as const
const ENEMY_COLUMNS = ['Enemy Name', 'Health', 'Attack', 'Gold', 'Drop Ingredient'] as const

export class GameDataCatalog {
  readonly baseIngredients: readonly IngredientDefinition[]
  readonly modifierIngredients: readonly IngredientDefinition[]
  readonly ingredients: readonly IngredientDefinition[]
  readonly abilities: readonly AbilityDefinition[]
  readonly potions: readonly PotionDefinition[]
  readonly classes: readonly ClassDefinition[]
  readonly buffs: readonly StatusEffectDefinition[]
  readonly debuffs: readonly DebuffDefinition[]
  readonly effects: readonly InstantEffectDefinition[]
  readonly enemies: readonly EnemyDefinition[]
  readonly warnings: readonly string[]
  readonly signature: string

  private constructor(data: {
    baseIngredients: IngredientDefinition[]
    modifierIngredients: IngredientDefinition[]
    abilities: AbilityDefinition[]
    potions: PotionDefinition[]
    classes: ClassDefinition[]
    buffs: StatusEffectDefinition[]
    debuffs: DebuffDefinition[]
    effects: InstantEffectDefinition[]
    enemies: EnemyDefinition[]
    warnings: string[]
  }) {
    this.baseIngredients = data.baseIngredients
    this.modifierIngredients = data.modifierIngredients
    this.ingredients = [...data.baseIngredients, ...data.modifierIngredients]
    this.abilities = data.abilities
    this.potions = data.potions
    this.classes = data.classes
    this.buffs = data.buffs
    this.debuffs = data.debuffs
    this.effects = data.effects
    this.enemies = data.enemies
    this.warnings = data.warnings
    this.signature = JSON.stringify(data)
  }

  static async fromWorkbook(
    data: ArrayBuffer,
    sprites: ReadonlyMap<string, string> = new Map(),
  ) {
    const xlsx = await import('@e965/xlsx')
    const workbook = xlsx.read(new Uint8Array(data), { type: 'array' })
    const warnings: string[] = []

    const matrixSheet = findMatrixSheet(workbook)
    const matrixRows = xlsx.utils.sheet_to_json<unknown[]>(matrixSheet, {
      header: 1,
      blankrows: false,
    })
    const [rarityRow, nameRow, ...abilityRows] = matrixRows
    if (!Array.isArray(rarityRow) || !Array.isArray(nameRow)) {
      throw new Error('The Filtered Potions List worksheet is missing its header rows.')
    }

    const modifierIngredients: IngredientDefinition[] = []
    const modifierColumnIndexes: number[] = []
    for (let column = 2; column < nameRow.length; column += 1) {
      const name = String(nameRow[column] ?? '').trim()
      if (!name) continue
      const rarity = parseRarity(String(rarityRow[column] ?? 'I'))
      const id = dataId(name)
      modifierColumnIndexes.push(column)
      modifierIngredients.push({
        id,
        name,
        kind: 'modifier',
        rarity,
        gold: RARITY_GOLD[rarity],
        spriteUrl: sprites.get(normalize(name)),
      })
    }

    const baseIngredients: IngredientDefinition[] = []
    const abilities: AbilityDefinition[] = []
    for (const rawRow of abilityRows) {
      if (!Array.isArray(rawRow)) continue
      const triggerLabel = String(rawRow[0] ?? '').trim()
      const baseName = String(rawRow[1] ?? '').trim()
      if (!triggerLabel || !baseName) continue
      const baseId = dataId(baseName)
      baseIngredients.push({
        id: baseId,
        name: baseName,
        kind: 'base',
        rarity: 'I',
        gold: RARITY_GOLD.I,
        spriteUrl: sprites.get(normalize(baseName)),
        triggerLabel,
      })
      for (const column of modifierColumnIndexes) {
        const cell = String(rawRow[column] ?? '').trim()
        if (!cell) continue
        const modifierIngredient = modifierIngredients[modifierColumnIndexes.indexOf(column)]
        const parsed = parseAbilityCell(cell)
        abilities.push({
          id: `${baseId}__${modifierIngredient.id}`,
          baseIngredientId: baseId,
          modifierIngredientId: modifierIngredient.id,
          ...parsed,
        })
      }
    }

    const potions: PotionDefinition[] = abilities.map((ability) => {
      const base = baseIngredients.find((entry) => entry.id === ability.baseIngredientId)
      const modifier = modifierIngredients.find(
        (entry) => entry.id === ability.modifierIngredientId,
      )
      return {
        id: ability.id,
        name: `${base?.name ?? ability.baseIngredientId} & ${modifier?.name ?? ability.modifierIngredientId} Potion`,
        baseIngredientId: ability.baseIngredientId,
        modifierIngredientId: ability.modifierIngredientId,
        description: ability.rawText,
        trigger: ability.trigger,
        effectText: ability.effectText,
        isPassive: ability.isPassive,
      }
    })

    const parseClassAbility = (raw: string): ClassAbility | null => {
      if (!raw || normalize(raw) === 'none') return null
      return parseAbilityCell(raw)
    }

    let classes: ClassDefinition[] = []
    try {
      classes = rowsFor(workbook, xlsx, CLASS_COLUMNS)
        .filter((row) => text(row, 'Class'))
        .map((row) => ({
          id: dataId(text(row, 'Class')),
          name: text(row, 'Class'),
          description: text(row, 'Description'),
          primaryStats: text(row, 'Primary Stat(s)')
            .split(',')
            .map((stat) => stat.trim())
            .filter((stat) => stat && normalize(stat) !== 'none'),
          statBoostTier: stripBacktick(text(row, 'Stat Boost')),
          classAbility: parseClassAbility(text(row, 'Class Ability')),
        }))
    } catch (error) {
      warnings.push(`Classes: ${error instanceof Error ? error.message : 'Invalid sheet.'}`)
    }

    let buffs: StatusEffectDefinition[] = []
    try {
      buffs = rowsFor(workbook, xlsx, BUFF_COLUMNS)
        .filter((row) => text(row, 'Name'))
        .map((row) => ({
          id: dataId(text(row, 'Name')),
          name: text(row, 'Name'),
          description: text(row, 'Description'),
          stacking: normalize(text(row, 'Type')) === 'stack',
        }))
    } catch (error) {
      warnings.push(`Buffs: ${error instanceof Error ? error.message : 'Invalid sheet.'}`)
    }

    const sheetHasColumns = (name: string, columns: readonly string[]) => {
      try {
        const [header] = xlsx.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
          header: 1,
          blankrows: false,
        })
        return Array.isArray(header) && columns.every((column) => header.includes(column))
      } catch {
        return false
      }
    }

    let debuffs: DebuffDefinition[] = []
    let effects: InstantEffectDefinition[] = []
    try {
      const debuffSheetName = workbook.SheetNames.find(
        (candidate) => /debuff/i.test(candidate) && sheetHasColumns(candidate, DEBUFF_COLUMNS),
      )
      if (debuffSheetName) {
        debuffs = xlsx.utils
          .sheet_to_json<Row>(workbook.Sheets[debuffSheetName], { defval: '' })
          .filter((row) => text(row, 'Name'))
          .map((row) => ({
            id: dataId(text(row, 'Name')),
            name: text(row, 'Name'),
            description: text(row, 'Description'),
          }))
      }

      const effectSheetName = workbook.SheetNames.find(
        (candidate) =>
          /effect/i.test(candidate) &&
          !/debuff/i.test(candidate) &&
          sheetHasColumns(candidate, DEBUFF_COLUMNS),
      )
      if (effectSheetName) {
        effects = xlsx.utils
          .sheet_to_json<Row>(workbook.Sheets[effectSheetName], { defval: '' })
          .filter((row) => text(row, 'Name'))
          .map((row) => ({
            id: dataId(text(row, 'Name')),
            name: text(row, 'Name'),
            description: text(row, 'Description'),
          }))
      }
    } catch (error) {
      warnings.push(`Debuffs/Effects: ${error instanceof Error ? error.message : 'Invalid sheet.'}`)
    }

    const allIngredientIds = new Set([
      ...baseIngredients.map((entry) => entry.id),
      ...modifierIngredients.map((entry) => entry.id),
    ])
    const enemies: EnemyDefinition[] = []
    try {
      for (const row of rowsFor(workbook, xlsx, ENEMY_COLUMNS)) {
        const name = text(row, 'Enemy Name')
        if (!name) continue
        const dropIngredientId = dataId(text(row, 'Drop Ingredient'))
        if (!allIngredientIds.has(dropIngredientId)) {
          warnings.push(
            `${name}: Drop Ingredient "${text(row, 'Drop Ingredient')}" is not a known ingredient.`,
          )
          continue
        }
        enemies.push({
          id: dataId(name),
          name,
          health: number(row, 'Health'),
          attack: number(row, 'Attack'),
          gold: number(row, 'Gold'),
          dropIngredientId,
        })
      }
    } catch (error) {
      warnings.push(`Enemies: ${error instanceof Error ? error.message : 'Invalid sheet.'}`)
    }

    return new GameDataCatalog({
      baseIngredients,
      modifierIngredients,
      abilities,
      potions,
      classes,
      buffs,
      debuffs,
      effects,
      enemies,
      warnings,
    })
  }

  ingredient(id: string) {
    return this.ingredients.find((ingredient) => ingredient.id === id)
  }

  potion(id: string) {
    return this.potions.find((potion) => potion.id === id)
  }

  /**
   * Display label for a potion that avoids its flavor name — just the two
   * ingredients it was brewed from, since potion names may not be final.
   */
  potionLabel(id: string) {
    const potion = this.potion(id)
    if (!potion) return 'Unknown Potion'
    const base = this.ingredient(potion.baseIngredientId)
    const modifier = this.ingredient(potion.modifierIngredientId)
    return `${base?.name ?? '?'} + ${modifier?.name ?? '?'}`
  }

  class(id: string) {
    return this.classes.find((characterClass) => characterClass.id === id)
  }

  buff(id: string) {
    return this.buffs.find((buff) => buff.id === id)
  }

  debuff(id: string) {
    return this.debuffs.find((debuff) => debuff.id === id)
  }

  effect(id: string) {
    return this.effects.find((effect) => effect.id === id)
  }

  /** A potion only exists when one ingredient is a Base ingredient and the
   * other is a Modifier ingredient — Base+Base or Modifier+Modifier is invalid. */
  recipeFor(ingredientIdA: string, ingredientIdB: string) {
    const base = this.baseIngredients.find(
      (entry) => entry.id === ingredientIdA || entry.id === ingredientIdB,
    )
    const modifier = this.modifierIngredients.find(
      (entry) => entry.id === ingredientIdA || entry.id === ingredientIdB,
    )
    if (!base || !modifier || base.id === modifier.id) return undefined
    return this.potions.find(
      (potion) =>
        potion.baseIngredientId === base.id && potion.modifierIngredientId === modifier.id,
    )
  }
}
