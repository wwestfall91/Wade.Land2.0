export type SaveSlotId = 1 | 2 | 3

export const ELEMENT_NAMES = ['Fire', 'Air', 'Earth', 'Water'] as const

export type ElementName = (typeof ELEMENT_NAMES)[number]

export interface ElementPosition {
  x: number
  y: number
}

export type ElementPositions = Record<ElementName, ElementPosition>

export const createDefaultElementPositions = (): ElementPositions => ({
  Fire: { x: 50, y: 24 },
  Air: { x: 28, y: 50 },
  Earth: { x: 72, y: 50 },
  Water: { x: 50, y: 76 },
})

export interface SaveRecord {
  slot: SaveSlotId
  createdAt: string
  lastPlayedAt: string
  playTimeSeconds: number
  chapter: number
  location: string
  affinity: 'Unbound'
  elementPositions: ElementPositions
}

export const SAVE_SLOT_IDS: readonly SaveSlotId[] = [1, 2, 3]
