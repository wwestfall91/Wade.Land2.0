import { create } from 'zustand'
import type { SaveRecord } from '../domain/save'

interface GameState {
  currentSave: SaveRecord | null
  sessionStartedAt: string | null
  enterGame: (save: SaveRecord) => void
  leaveGame: () => void
}

export const useGameStore = create<GameState>((set) => ({
  currentSave: null,
  sessionStartedAt: null,
  enterGame: (save) =>
    set({
      currentSave: save,
      sessionStartedAt: new Date().toISOString(),
    }),
  leaveGame: () => set({ currentSave: null, sessionStartedAt: null }),
}))
