export type SaveSlotId = 1 | 2 | 3

export const CURRENT_GAMEPLAY_VERSION = 10

export interface Position {
  x: number
  y: number
}

export interface InventoryItem {
  id: string
  definitionId: string
  name: string
  kind: 'ingredient' | 'potion'
  position: Position
}

export interface CharacterStats {
  maxHealth: number
  health: number
  attack: number
  magic: number
  speed: number
  luck: number
}

export interface PartyMember {
  id: string
  name: string
  classId: string
  formation: number
  stats: CharacterStats
  /** Ability ids from consumed passive potions. Capped at 2, on top of the
   * character's class ability (which is unlimited/always active). */
  passivePotionAbilityIds: string[]
}

export interface PendingReward {
  gold: number
  ingredientIds: string[]
  enemyName: string
}

export interface SaveRecord {
  gameplayVersion: number
  slot: SaveSlotId
  createdAt: string
  lastPlayedAt: string
  playTimeSeconds: number
  chapter: number
  location: string
  affinity: 'Unbound'
  gold: number
  inventory: InventoryItem[]
  party: PartyMember[]
  discoveredRecipeIds: string[]
  shopOffers: string[]
  battlesWon: number
  pendingReward: PendingReward | null
}

export const SAVE_SLOT_IDS: readonly SaveSlotId[] = [1, 2, 3]

export const createInventoryItem = (
  definitionId: string,
  name: string,
  kind: InventoryItem['kind'],
  position: Position,
): InventoryItem => ({
  id: crypto.randomUUID(),
  definitionId,
  name,
  kind,
  position,
})

export const createStartingParty = (): PartyMember[] => [
  {
    id: crypto.randomUUID(),
    name: 'Bram',
    classId: 'warrior',
    formation: 4,
    stats: { maxHealth: 28, health: 28, attack: 7, magic: 1, speed: 3, luck: 2 },
    passivePotionAbilityIds: [],
  },
  {
    id: crypto.randomUUID(),
    name: 'Nyx',
    classId: 'black-mage',
    formation: 3,
    stats: { maxHealth: 18, health: 18, attack: 3, magic: 8, speed: 4, luck: 3 },
    passivePotionAbilityIds: [],
  },
  {
    id: crypto.randomUUID(),
    name: 'Pip',
    classId: 'thief',
    formation: 2,
    stats: { maxHealth: 21, health: 21, attack: 5, magic: 2, speed: 8, luck: 6 },
    passivePotionAbilityIds: [],
  },
]
