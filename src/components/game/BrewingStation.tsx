import type { InventoryItem } from '../../domain/save'

type IngredientSlotState = 'No Ingredient Inserted' | 'Ingredient Inserted'

interface BrewingStationProps {
  ingredients: readonly (InventoryItem | undefined)[]
  slotStates: readonly IngredientSlotState[]
  previewName?: string
  previewKnown: boolean
  onLoadIngredient: (slot: 0 | 1) => void
  onBrew: () => void
}

export function BrewingStation({
  ingredients,
  slotStates,
  previewName,
  previewKnown,
  onLoadIngredient,
  onBrew,
}: BrewingStationProps) {
  const canBrew = Boolean(ingredients[0] && ingredients[1])

  return (
    <section className="mockup-brewing" aria-labelledby="brewing-title">
      <h2 id="brewing-title">Brewing</h2>
      <div className="brew-diagram">
        <div className="brew-output">
          <span className={previewKnown ? 'brew-output--known' : ''}>
            {previewKnown ? previewName : 'Out'}
          </span>
        </div>
        <div className="brew-input-row">
          {[0, 1].map((slot) => {
            const hasIngredient = slotStates[slot] === 'Ingredient Inserted'
            return (
              <button
                aria-label={
                  ingredients[slot]
                    ? `${slot === 0 ? 'Base' : 'Mod'} slot: ${ingredients[slot]?.name}`
                    : `Load ${slot === 0 ? 'Base' : 'Mod'} ingredient slot`
                }
                className={hasIngredient ? 'brew-input brew-input--filled' : 'brew-input'}
                data-ingredient-slot={slot}
                data-tooltip={ingredients[slot]?.name ?? ''}
                key={slot}
                type="button"
              >
                {(slot === 0 ? 'Base' : 'Mod')}
              </button>
            )
          })}
        </div>
      </div>
      <button
        className="mockup-brew-button"
        disabled={!canBrew}
        title={!canBrew ? 'Please insert two ingredients.' : undefined}
        type="button"
        onClick={onBrew}
      >
        Brew
      </button>
    </section>
  )
}
