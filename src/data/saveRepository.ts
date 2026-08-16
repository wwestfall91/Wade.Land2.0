import Dexie, { type EntityTable } from 'dexie'
import type { GameDataCatalog, PotionDefinition } from '../domain/gameData'
import {
  CURRENT_GAMEPLAY_VERSION,
  createInventoryItem,
  createStartingParty,
  type InventoryItem,
  type PartyMember,
  type Position,
  type SaveRecord,
  type SaveSlotId,
} from '../domain/save'

class ElementalDatabase extends Dexie {
  saves!: EntityTable<SaveRecord, 'slot'>

  constructor() {
    super('elemental-saves')
    this.version(1).stores({ saves: 'slot, lastPlayedAt' })
  }
}

export const db = new ElementalDatabase()

const now = () => new Date().toISOString()

const newSave = (slot: SaveSlotId): SaveRecord => ({
  gameplayVersion: CURRENT_GAMEPLAY_VERSION,
  slot,
  createdAt: now(),
  lastPlayedAt: now(),
  playTimeSeconds: 0,
  chapter: 1,
  location: 'The Threshold Laboratory',
  affinity: 'Unbound',
  gold: 10,
  inventory: [],
  party: createStartingParty(),
  discoveredRecipeIds: [],
  shopOffers: [],
  battlesWon: 0,
  pendingReward: null,
})

export async function listSaves(): Promise<SaveRecord[]> {
  return db.saves.orderBy('slot').toArray()
}

export async function openSave(slot: SaveSlotId): Promise<SaveRecord> {
  const existing = await db.saves.get(slot)
  if (!existing || existing.gameplayVersion !== CURRENT_GAMEPLAY_VERSION) {
    const created = newSave(slot)
    await db.saves.put(created)
    return created
  }
  const updated = { ...existing, lastPlayedAt: now() }
  await db.saves.put(updated)
  return updated
}

export async function saveGame(save: SaveRecord): Promise<void> {
  await db.saves.put({ ...save, lastPlayedAt: now() })
}

/** Rarer ingredients should appear less often in the shop. */
const RARITY_WEIGHT: Record<string, number> = { I: 3, II: 2, III: 1 }

/** Left 2 shop slots are Base ingredients, right 3 are Modifier ingredients. */
const SHOP_SLOT_KIND: readonly ('base' | 'modifier')[] = [
  'base',
  'base',
  'modifier',
  'modifier',
  'modifier',
]

const shuffledOffersOfKind = (
  catalog: GameDataCatalog,
  kind: 'base' | 'modifier',
  excluded: readonly string[] = [],
  count = 1,
) => {
  const available = catalog.ingredients.filter(
    (item) => item.gold > 0 && item.kind === kind,
  )
  if (!available.length) return []
  const weighted = available.flatMap((item) =>
    Array(RARITY_WEIGHT[item.rarity] ?? 1).fill(item),
  )
  const start = Math.floor(Math.random() * weighted.length)
  const rotated = [...weighted.slice(start), ...weighted.slice(0, start)]
  const prioritized = [
    ...rotated.filter((item) => !excluded.includes(item.id)),
    ...rotated.filter((item) => excluded.includes(item.id)),
  ]
  const offers: string[] = []
  for (const item of prioritized) {
    if (offers.length >= count) break
    if (!offers.includes(item.id)) offers.push(item.id)
  }
  let index = 0
  while (offers.length < Math.min(count, available.length) && index < prioritized.length) {
    if (!offers.includes(prioritized[index].id)) offers.push(prioritized[index].id)
    index += 1
  }
  return offers
}

const shuffledOffers = (
  catalog: GameDataCatalog,
  excluded: readonly string[] = [],
): string[] => {
  const offers: string[] = []
  for (const kind of SHOP_SLOT_KIND) {
    const [pick] = shuffledOffersOfKind(catalog, kind, [...excluded, ...offers], 1)
    if (pick) offers.push(pick)
  }
  return offers
}

export function synchronizeGameData(
  save: SaveRecord,
  catalog: GameDataCatalog,
): SaveRecord {
  const validIngredients = new Set(catalog.ingredients.map((item) => item.id))
  const validPotions = new Set(catalog.potions.map((item) => item.id))
  const inventory = save.inventory
    .filter((item) =>
      item.kind === 'ingredient'
        ? validIngredients.has(item.definitionId)
        : validPotions.has(item.definitionId),
    )
    .map((item) => ({
      ...item,
      name:
        item.kind === 'ingredient'
          ? (catalog.ingredient(item.definitionId)?.name ?? item.name)
          : (catalog.potion(item.definitionId)?.name ?? item.name),
    }))
  return {
    ...save,
    inventory,
    shopOffers:
      save.shopOffers.length === 5 &&
      save.shopOffers.every(
        (id, index) =>
          validIngredients.has(id) &&
          catalog.ingredient(id)?.kind === SHOP_SLOT_KIND[index],
      )
        ? save.shopOffers
        : shuffledOffers(catalog),
  }
}

export function purchaseOffer(
  save: SaveRecord,
  catalog: GameDataCatalog,
  offerIndex: number,
  dropPosition?: Position,
): SaveRecord {
  const ingredient = catalog.ingredient(save.shopOffers[offerIndex] ?? '')
  if (!ingredient || ingredient.gold <= 0) throw new Error('That offer is unavailable.')
  if (save.gold < ingredient.gold) throw new Error('There is not enough Gold.')
  const slotKind = SHOP_SLOT_KIND[offerIndex] ?? ingredient.kind
  const replacement =
    shuffledOffersOfKind(catalog, slotKind, save.shopOffers, 1)[0] ?? ingredient.id
  const offers = [...save.shopOffers]
  offers[offerIndex] = replacement
  const itemCount = save.inventory.length
  return {
    ...save,
    gold: save.gold - ingredient.gold,
    shopOffers: offers,
    inventory: [
      ...save.inventory,
      createInventoryItem(
        ingredient.id,
        ingredient.name,
        'ingredient',
        dropPosition ?? {
          x: 42 + (itemCount % 7) * 7,
          y: 76 + Math.floor(itemCount / 7) * 8,
        },
      ),
    ],
  }
}

export function refreshShop(
  save: SaveRecord,
  catalog: GameDataCatalog,
  free = false,
): SaveRecord {
  if (!free && save.gold < 3) throw new Error('A manual refresh costs 3 Gold.')
  return {
    ...save,
    gold: free ? save.gold : save.gold - 3,
    shopOffers: shuffledOffers(catalog, save.shopOffers),
  }
}

export function moveInventoryItem(
  save: SaveRecord,
  itemId: string,
  position: Position,
): SaveRecord {
  return {
    ...save,
    inventory: save.inventory.map((item) =>
      item.id === itemId ? { ...item, position } : item,
    ),
  }
}

export function brewRecipe(
  save: SaveRecord,
  catalog: GameDataCatalog,
  ingredientIds: readonly [string, string],
): SaveRecord {
  if (ingredientIds[0] === ingredientIds[1]) {
    throw new Error('Two separate ingredient items are required.')
  }
  const ingredients = ingredientIds.map((id) =>
    save.inventory.find((item) => item.id === id && item.kind === 'ingredient'),
  )
  if (!ingredients[0] || !ingredients[1]) throw new Error('Two ingredients are required.')
  const recipe = catalog.recipeFor(
    ingredients[0].definitionId,
    ingredients[1].definitionId,
  )
  if (!recipe) {
    throw new Error('A potion needs exactly one Base ingredient and one Modifier ingredient.')
  }
  const consumed = new Set(ingredientIds)
  return {
    ...save,
    inventory: [
      ...save.inventory.filter((item) => !consumed.has(item.id)),
      createInventoryItem(recipe.id, recipe.name, 'potion', { x: 54, y: 69 }),
    ],
    discoveredRecipeIds: save.discoveredRecipeIds.includes(recipe.id)
      ? save.discoveredRecipeIds
      : [...save.discoveredRecipeIds, recipe.id],
  }
}

export function quickBrewIngredients(
  save: SaveRecord,
  recipe: PotionDefinition,
): [string, string] | null {
  const first = save.inventory.find(
    (item) => item.kind === 'ingredient' && item.definitionId === recipe.baseIngredientId,
  )
  const second = save.inventory.find(
    (item) =>
      item.kind === 'ingredient' &&
      item.definitionId === recipe.modifierIngredientId &&
      item.id !== first?.id,
  )
  return first && second ? [first.id, second.id] : null
}

/** Very small parser for the ~70% of one-time (non-passive) effect cells that
 * follow a simple "+N STAT" or "Increase STAT +N" pattern. Anything else is
 * left unrecognized for now — full free-text execution is a later phase. */
const STAT_FIELD: Record<string, keyof PartyMember['stats']> = {
  AGI: 'speed',
  STR: 'attack',
  MAG: 'magic',
  LUK: 'luck',
  HP: 'maxHealth',
}

interface OneTimeEffect {
  statField?: keyof PartyMember['stats']
  statAmount?: number
  gold?: number
  kill?: boolean
  unrecognized?: boolean
}

function parseOneTimeEffect(effectText: string): OneTimeEffect {
  const value = effectText.trim()
  if (/^die$/i.test(value)) return { kill: true }
  const goldMatch = value.match(/^Receive (\d+) Gold$/i)
  if (goldMatch) return { gold: Number(goldMatch[1]) }
  const statFirst = value.match(/^Increase\s+(AGI|STR|MAG|LUK|HP)\s*\+?(\d+)%?$/i)
  const numberFirst = value.match(/^\+(\d+)%?\s*(AGI|STR|MAG|LUK|HP)$/i)
  const match = statFirst ?? numberFirst
  if (match) {
    const [, first, second] = match
    const stat = (statFirst ? first : second).toUpperCase()
    const amount = Number(statFirst ? second : first)
    const statField = STAT_FIELD[stat]
    if (statField) return { statField, statAmount: amount }
  }
  return { unrecognized: true }
}

export function usePotion(
  save: SaveRecord,
  catalog: GameDataCatalog,
  itemId: string,
  memberId: string,
): SaveRecord {
  const potionItem = save.inventory.find(
    (item) => item.id === itemId && item.kind === 'potion',
  )
  const potion = potionItem ? catalog.potion(potionItem.definitionId) : undefined
  if (!potionItem || !potion) throw new Error('Only a potion can be used.')
  const member = save.party.find((entry) => entry.id === memberId)
  if (!member) throw new Error('That party member could not be found.')

  if (potion.isPassive) {
    if (member.passivePotionAbilityIds.includes(potion.id)) {
      throw new Error(`${member.name} already has that passive ability.`)
    }
    if (member.passivePotionAbilityIds.length >= 2) {
      throw new Error(`${member.name} already knows two passive potion abilities.`)
    }
    return {
      ...save,
      party: save.party.map((entry) =>
        entry.id === memberId
          ? { ...entry, passivePotionAbilityIds: [...entry.passivePotionAbilityIds, potion.id] }
          : entry,
      ),
      inventory: save.inventory.filter((item) => item.id !== itemId),
    }
  }

  const effect = parseOneTimeEffect(potion.effectText)
  const party = save.party.map((entry) => {
    if (entry.id !== memberId) return entry
    const stats = { ...entry.stats }
    if (effect.statField && effect.statAmount) {
      stats[effect.statField] += effect.statAmount
      if (effect.statField === 'maxHealth') stats.health += effect.statAmount
    }
    if (effect.kill) stats.health = 0
    return { ...entry, stats }
  })
  return {
    ...save,
    gold: save.gold + (effect.gold ?? 0),
    party,
    inventory: save.inventory.filter((item) => item.id !== itemId),
  }
}

export function swapFormation(
  save: SaveRecord,
  memberId: string,
  targetFormation: number,
): SaveRecord {
  const moving = save.party.find((member) => member.id === memberId)
  if (!moving) return save
  const occupying = save.party.find((member) => member.formation === targetFormation)
  return {
    ...save,
    party: save.party.map((member) => {
      if (member.id === moving.id) return { ...member, formation: targetFormation }
      if (occupying && member.id === occupying.id) {
        return { ...member, formation: moving.formation }
      }
      return member
    }),
  }
}

export interface BattleResult {
  won: boolean
  party: PartyMember[]
  log: string[]
}

export function resolveBattle(save: SaveRecord, catalog: GameDataCatalog): BattleResult {
  const enemy = catalog.enemies[save.battlesWon % Math.max(catalog.enemies.length, 1)]
  if (!enemy) throw new Error('No enemy is configured.')
  let enemyHealth = enemy.health
  let party = save.party.map((member) => ({ ...member, stats: { ...member.stats } }))
  const log: string[] = []

  for (let round = 1; round <= 12 && enemyHealth > 0; round += 1) {
    const living = party.filter((member) => member.stats.health > 0)
    if (!living.length) break
    const partyDamage = living.reduce(
      (total, member) => total + member.stats.attack + Math.floor(member.stats.magic / 2),
      0,
    )
    enemyHealth -= partyDamage
    log.push(`Round ${round}: The party deals ${partyDamage} damage.`)
    if (enemyHealth <= 0) break
    const frontline = [...living].sort((a, b) => b.formation - a.formation)[0]
    party = party.map((member) =>
      member.id === frontline.id
        ? { ...member, stats: { ...member.stats, health: Math.max(0, member.stats.health - enemy.attack) } }
        : member,
    )
    log.push(`${enemy.name} strikes ${frontline.name} for ${enemy.attack}.`)
  }
  return { won: enemyHealth <= 0, party, log }
}

export function finishBattle(
  save: SaveRecord,
  catalog: GameDataCatalog,
  result: BattleResult,
): SaveRecord {
  const enemy = catalog.enemies[save.battlesWon % Math.max(catalog.enemies.length, 1)]
  return {
    ...save,
    party: result.party,
    pendingReward:
      result.won && enemy
        ? { gold: enemy.gold, ingredientIds: [enemy.dropIngredientId], enemyName: enemy.name }
        : null,
  }
}

export function claimRewards(save: SaveRecord, catalog: GameDataCatalog): SaveRecord {
  if (!save.pendingReward) throw new Error('There are no rewards to claim.')
  const drops: InventoryItem[] = save.pendingReward.ingredientIds.flatMap((id, index) => {
    const ingredient = catalog.ingredient(id)
    return ingredient
      ? [createInventoryItem(id, ingredient.name, 'ingredient', { x: 45 + index * 8, y: 76 })]
      : []
  })
  return refreshShop(
    {
      ...save,
      gold: save.gold + save.pendingReward.gold,
      inventory: [...save.inventory, ...drops],
      battlesWon: save.battlesWon + 1,
      pendingReward: null,
      party: save.party.map((member) => ({
        ...member,
        stats: { ...member.stats, health: member.stats.maxHealth },
      })),
    },
    catalog,
    true,
  )
}
