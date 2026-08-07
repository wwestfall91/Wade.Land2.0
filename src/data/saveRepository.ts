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
  knownSaleRecipeIds: [],
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

const shuffledOffers = (
  catalog: GameDataCatalog,
  excluded: readonly string[] = [],
  count = 5,
) => {
  const available = catalog.ingredients.filter((item) => item.gold > 0)
  if (!available.length) return []
  const start = Math.floor(Math.random() * available.length)
  const rotated = [...available.slice(start), ...available.slice(0, start)]
  const prioritized = [
    ...rotated.filter((item) => !excluded.includes(item.id)),
    ...rotated.filter((item) => excluded.includes(item.id)),
  ]
  return Array.from({ length: Math.min(count, available.length) }, (_, index) =>
    prioritized[index % prioritized.length].id,
  )
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
      save.shopOffers.every((id) => validIngredients.has(id))
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
  const replacement = shuffledOffers(catalog, save.shopOffers, 1)[0] ?? ingredient.id
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
  if (!recipe) throw new Error('Those ingredients do not produce a known potion.')
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
    (item) => item.kind === 'ingredient' && item.definitionId === recipe.ingredientA,
  )
  const second = save.inventory.find(
    (item) =>
      item.kind === 'ingredient' &&
      item.definitionId === recipe.ingredientB &&
      item.id !== first?.id,
  )
  return first && second ? [first.id, second.id] : null
}

export function sellPotion(
  save: SaveRecord,
  catalog: GameDataCatalog,
  itemId: string,
): SaveRecord {
  const potionItem = save.inventory.find(
    (item) => item.id === itemId && item.kind === 'potion',
  )
  const potion = potionItem ? catalog.potion(potionItem.definitionId) : undefined
  if (!potionItem || !potion) throw new Error('Only a potion can be sold.')
  return {
    ...save,
    gold: save.gold + potion.saleGold,
    inventory: save.inventory.filter((item) => item.id !== itemId),
    knownSaleRecipeIds: save.knownSaleRecipeIds.includes(potion.id)
      ? save.knownSaleRecipeIds
      : [...save.knownSaleRecipeIds, potion.id],
  }
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
  const party = save.party.map((member) => {
    if (member.id !== memberId) return member
    const stats = { ...member.stats }
    if (potion.benefitType === 'heal') {
      stats.health = Math.min(stats.maxHealth, stats.health + potion.benefitValue)
    } else if (potion.benefitType === 'max-health') {
      stats.maxHealth += potion.benefitValue
      stats.health += potion.benefitValue
    } else if (potion.benefitType === 'attack') stats.attack += potion.benefitValue
    else if (potion.benefitType === 'speed') stats.speed += potion.benefitValue
    else stats.luck += potion.benefitValue
    return { ...member, stats }
  })
  return {
    ...save,
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
