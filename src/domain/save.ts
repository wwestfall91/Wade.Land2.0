export type SaveSlotId = 1 | 2 | 3

export interface SaveRecord {
  slot: SaveSlotId
  createdAt: string
  lastPlayedAt: string
  playTimeSeconds: number
  chapter: number
  location: string
  affinity: 'Unbound'
}

export const SAVE_SLOT_IDS: readonly SaveSlotId[] = [1, 2, 3]
