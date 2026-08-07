import type { InventoryItem } from '../../domain/save'

interface BrewingStationProps {
  ingredients: readonly (InventoryItem | undefined)[]
  previewName?: string
  previewKnown: boolean
  onLoadIngredient: (slot: 0 | 1) => void
  onBrew: () => void
}

export function BrewingStation({
  ingredients,
  previewName,
  previewKnown,
  onLoadIngredient,
  onBrew,
}: BrewingStationProps) {
  const canBrew = Boolean(ingredients[0] && ingredients[1])

  return (
    <section className="mockup-panel mockup-brewing" aria-labelledby="brewing-title">
      <h2 id="brewing-title">Brewing Station</h2>
      <div className="brew-diagram">
        <div className="brew-output">
          <span className={previewKnown ? 'brew-output--known' : ''}>
            {previewKnown ? previewName : 'Out'}
          </span>
        </div>
        <div className="brew-connectors" aria-hidden="true" />
        <div className="brew-input-row">
          {[0, 1].map((slot) => (
            <button
              aria-label={
                ingredients[slot]
                  ? `Ingredient ${slot + 1}: ${ingredients[slot]?.name}`
                  : `Load ingredient ${slot + 1}`
              }
              className="brew-input"
              data-ingredient-slot={slot}
              key={slot}
              type="button"
              onClick={() => onLoadIngredient(slot as 0 | 1)}
            >
              {ingredients[slot]?.name ?? slot + 1}
            </button>
          ))}
          <span className="brew-modifier" title="Modifier socket — coming later">+</span>
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
