import { assign, fromPromise, setup } from 'xstate'
import { listSaves, openSave } from './data/saveRepository'
import type { SaveRecord, SaveSlotId } from './domain/save'
import { useGameStore } from './store/gameStore'

interface AppContext {
  saves: SaveRecord[]
  selectedSlot: SaveSlotId | null
  error: string | null
}

type AppEvent =
  | { type: 'SELECT_SLOT'; slot: SaveSlotId }
  | { type: 'RETURN_TO_TITLE' }
  | { type: 'RETRY' }

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unexpected storage error occurred.'
}

export const appMachine = setup({
  types: {
    context: {} as AppContext,
    events: {} as AppEvent,
  },
  actors: {
    loadSaves: fromPromise(() => listSaves()),
    openSelectedSave: fromPromise(
      ({ input }: { input: { slot: SaveSlotId } }) => openSave(input.slot),
    ),
  },
  actions: {
    enterCurrentGame: (_, params: { save: SaveRecord }) => {
      useGameStore.getState().enterGame(params.save)
    },
    leaveCurrentGame: () => {
      useGameStore.getState().leaveGame()
    },
  },
}).createMachine({
  id: 'elemental',
  initial: 'loading',
  context: {
    saves: [],
    selectedSlot: null,
    error: null,
  },
  states: {
    loading: {
      invoke: {
        src: 'loadSaves',
        onDone: {
          target: 'title',
          actions: assign({
            saves: ({ event }) => event.output,
            error: null,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => errorMessage(event.error),
          }),
        },
      },
    },
    title: {
      on: {
        SELECT_SLOT: {
          target: 'opening',
          actions: assign({
            selectedSlot: ({ event }) => event.slot,
          }),
        },
      },
    },
    opening: {
      invoke: {
        src: 'openSelectedSave',
        input: ({ context }) => ({ slot: context.selectedSlot! }),
        onDone: {
          target: 'playing',
          actions: [
            assign({
              saves: ({ context, event }) => [
                ...context.saves.filter((save) => save.slot !== event.output.slot),
                event.output,
              ].sort((a, b) => a.slot - b.slot),
            }),
            {
              type: 'enterCurrentGame',
              params: ({ event }) => ({ save: event.output }),
            },
          ],
        },
        onError: {
          target: 'error',
          actions: assign({
            error: ({ event }) => errorMessage(event.error),
          }),
        },
      },
    },
    playing: {
      on: {
        RETURN_TO_TITLE: {
          target: 'title',
          actions: [
            'leaveCurrentGame',
            assign({
              selectedSlot: null,
            }),
          ],
        },
      },
    },
    error: {
      on: {
        RETRY: 'loading',
      },
    },
  },
})
