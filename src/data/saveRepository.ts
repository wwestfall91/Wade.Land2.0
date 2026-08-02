import Dexie, { type EntityTable } from 'dexie'
import type { SaveRecord, SaveSlotId } from '../domain/save'

class ElementalDatabase extends Dexie {
  saves!: EntityTable<SaveRecord, 'slot'>

  constructor() {
    super('elemental-saves')
    this.version(1).stores({
      saves: 'slot, lastPlayedAt',
    })
  }
}

export const db = new ElementalDatabase()

export async function listSaves(): Promise<SaveRecord[]> {
  return db.saves.orderBy('slot').toArray()
}

export async function openSave(slot: SaveSlotId): Promise<SaveRecord> {
  const existing = await db.saves.get(slot)
  const now = new Date().toISOString()

  if (existing) {
    const updated = { ...existing, lastPlayedAt: now }
    await db.saves.put(updated)
    return updated
  }

  const created: SaveRecord = {
    slot,
    createdAt: now,
    lastPlayedAt: now,
    playTimeSeconds: 0,
    chapter: 1,
    location: 'The Quiet Threshold',
    affinity: 'Unbound',
  }

  await db.saves.add(created)
  return created
}
