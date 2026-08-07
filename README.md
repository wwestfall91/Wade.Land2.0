# EleMENTAL

EleMENTAL is a pixel-art dungeon auto-battler about discovering potions, preparing a party, and
surviving increasingly dangerous fights. React renders the game, XState coordinates the title/game
flow, and Dexie persists three local save slots.

## Prototype loop

1. Buy from five rotating ingredient offers.
2. Combine exactly two ingredients at the Brewing Station.
3. Discover explicit recipes and Quick Brew them from the Recipe Book.
4. Sell potions to learn their value or give them to party members for permanent benefits.
5. Arrange up to five formation slots; the rightmost occupied slot is the frontline.
6. Fight an automatic battle, claim enemy-specific ingredients and Gold, then return to a freely
   refreshed shop.

The former Hot, Cold, Wet, and Dry model, customer commissions, Fire fuel, and Glass Vials are not
part of this version.

## Editable game data

`public/data/EleMENTAL Game Data.xlsx` is the runtime source of truth. The game checks it for changes
every 1.5 seconds. Edit it in desktop Excel while the development server is running.

| Sheet | Required columns |
| --- | --- |
| Ingredients | `Name`, `Description`, `Gold` |
| Potions | `Potion Name`, `Ingredient 1`, `Ingredient 2`, `Description`, `Benefit`, `Benefit Type`, `Benefit Value`, `Sale Gold` |
| Classes | `Class Name`, `Description`, `Passive` |
| Enemies | `Enemy Name`, `Health`, `Attack`, `Gold`, `Drop Ingredient` |

Potion ingredient order does not matter. Supported benefit types are `heal`, `attack`, `max-health`,
`speed`, and `luck`. Ingredient names in Potions and Enemies must match the Ingredients sheet.

Add ingredient art to `src/assets/sprites/items/`. The filename stem must exactly match the
ingredient name, case-insensitively.

## Commands

- `npm run dev` — start the development server
- `npm test` — run tests
- `npm run build` — type-check and build
- `npm run lint` — run Oxlint
