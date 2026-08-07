import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import mageSprite from '../assets/sprites/characters/Mage.gif'
import thiefSprite from '../assets/sprites/characters/Thief.gif'
import warriorSprite from '../assets/sprites/characters/Warrior.gif'
import {
  brewRecipe,
  claimRewards,
  finishBattle,
  moveInventoryItem,
  purchaseOffer,
  quickBrewIngredients,
  refreshShop,
  resolveBattle,
  saveGame,
  sellPotion,
  swapFormation,
  synchronizeGameData,
  usePotion as applyPotion,
  type BattleResult,
} from '../data/saveRepository'
import type { InventoryItem, SaveRecord } from '../domain/save'
import { useGameData } from '../hooks/useGameData'
import { useGameStore } from '../store/gameStore'
import { BrewingStation } from './game/BrewingStation'
import { GoldDisplay } from './game/GoldDisplay'
import { ItemArtwork } from './game/ItemArtwork'
import { PartyPanel } from './game/PartyPanel'
import { ShopPanel } from './game/ShopPanel'

interface GameScreenProps {
  onReturn: () => void
}

type Scene = 'laboratory' | 'battle' | 'rewards'

const CHARACTER_SPRITES: Record<string, string> = {
  warrior: warriorSprite,
  thief: thiefSprite,
  'black-mage': mageSprite,
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum)

export function GameScreen({ onReturn }: GameScreenProps) {
  const currentSave = useGameStore((state) => state.currentSave)
  const { catalog, error: dataError } = useGameData()
  const workspaceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null)
  const [save, setSave] = useState<SaveRecord | null>(currentSave)
  const saveRef = useRef<SaveRecord | null>(currentSave)
  const [scene, setScene] = useState<Scene>('laboratory')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedOffer, setSelectedOffer] = useState<number | null>(null)
  const [ingredientIds, setIngredientIds] = useState<[string | null, string | null]>([
    null,
    null,
  ])
  const [recipeBookOpen, setRecipeBookOpen] = useState(false)
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
  const [message, setMessage] = useState('Choose two ingredients. Discover what they become.')
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null)
  const [glowingMemberId, setGlowingMemberId] = useState<string | null>(null)

  const commit = (next: SaveRecord) => {
    saveRef.current = next
    setSave(next)
    void saveGame(next)
  }

  useEffect(() => {
    if (!save || !catalog) return
    const synchronized = synchronizeGameData(save, catalog)
    if (JSON.stringify(synchronized) !== JSON.stringify(save)) commit(synchronized)
    // Catalog changes are the only trigger; save changes are committed at their source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog])

  if (!save) {
    return (
      <main className="app-shell app-shell--centered" role="alert">
        <p className="status-copy">Restoring your game...</p>
      </main>
    )
  }

  const selectedItem = save.inventory.find((item) => item.id === selectedId)
  const loadedIngredients = ingredientIds.map((id) =>
    save.inventory.find((item) => item.id === id),
  )
  const previewRecipe =
    catalog && loadedIngredients[0] && loadedIngredients[1]
      ? catalog.recipeFor(
          loadedIngredients[0].definitionId,
          loadedIngredients[1].definitionId,
        )
      : undefined
  const previewKnown =
    previewRecipe && save.discoveredRecipeIds.includes(previewRecipe.id)
  const selectedRecipe = catalog?.potion(selectedRecipeId ?? '')
  const currentEnemy =
    catalog?.enemies[save.battlesWon % Math.max(catalog.enemies.length, 1)]

  const loadIngredient = (slot: 0 | 1, item = selectedItem) => {
    if (!item || item.kind !== 'ingredient') {
      setMessage('Potions cannot be placed in ingredient slots.')
      return
    }
    setIngredientIds((current) => {
      const next: [string | null, string | null] = [...current]
      const previousSlot = next.indexOf(item.id)
      if (previousSlot >= 0) next[previousSlot] = null
      next[slot] = item.id
      return next
    })
    setSelectedId(item.id)
    setMessage(`${item.name} loaded into ingredient slot ${slot + 1}.`)
  }

  const handleBrew = () => {
    if (!catalog || !ingredientIds[0] || !ingredientIds[1]) return
    try {
      const next = brewRecipe(save, catalog, [
        ingredientIds[0],
        ingredientIds[1],
      ])
      const potion = next.inventory[next.inventory.length - 1]
      commit(next)
      setIngredientIds([null, null])
      setSelectedId(potion.id)
      setMessage(`${potion.name} brewed. Its recipe is now recorded.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Brewing failed.')
    }
  }

  const handleQuickBrew = (recipeId: string) => {
    const recipe = catalog?.potion(recipeId)
    if (!recipe) return
    const ingredients = quickBrewIngredients(save, recipe)
    if (!ingredients) {
      setMessage(`You do not have both ingredients for ${recipe.name}.`)
      return
    }
    setIngredientIds(ingredients)
    setRecipeBookOpen(false)
    setMessage(`${recipe.name} ingredients loaded. Press BREW when ready.`)
  }

  const handlePurchase = (
    index: number,
    dropPoint?: { clientX: number; clientY: number },
  ) => {
    if (!catalog) return
    try {
      const bounds = workspaceRef.current?.getBoundingClientRect()
      const dropPosition =
        dropPoint && bounds
          ? {
              x: clamp(((dropPoint.clientX - bounds.left) / bounds.width) * 100, 3, 97),
              y: clamp(((dropPoint.clientY - bounds.top) / bounds.height) * 100, 4, 96),
            }
          : undefined
      const next = purchaseOffer(save, catalog, index, dropPosition)
      commit(next)
      setSelectedOffer(null)
      setSelectedId(next.inventory[next.inventory.length - 1]?.id ?? null)
      setMessage('Purchased. A new shop offer has arrived.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Purchase failed.')
    }
  }

  const handleRefresh = () => {
    if (!catalog) return
    try {
      commit(refreshShop(save, catalog))
      setMessage('The shopkeeper restocked all five offers.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Refresh failed.')
    }
  }

  const handleSell = (item = selectedItem) => {
    if (!catalog || item?.kind !== 'potion') return
    try {
      const potionName = item.name
      const next = sellPotion(save, catalog, item.id)
      commit(next)
      setSelectedId(null)
      setMessage(`${potionName} sold. Its value is now recorded in the Recipe Book.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sale failed.')
    }
  }

  const handleUsePotion = (memberId: string, item = selectedItem) => {
    if (!catalog || item?.kind !== 'potion') return
    try {
      commit(applyPotion(save, catalog, item.id, memberId))
      setGlowingMemberId(memberId)
      window.setTimeout(() => setGlowingMemberId(null), 650)
      setSelectedId(null)
      setMessage(`${item.name} consumed. Its benefit is permanent for this run.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Potion use failed.')
    }
  }

  const beginBattle = () => {
    if (!catalog || !currentEnemy) return
    setBattleResult(null)
    setScene('battle')
    window.setTimeout(() => {
      const result = resolveBattle(save, catalog)
      setBattleResult(result)
      const next = finishBattle(save, catalog, result)
      commit(next)
      if (result.won) window.setTimeout(() => setScene('rewards'), 900)
    }, 500)
  }

  const handleClaim = () => {
    if (!catalog) return
    commit(claimRewards(save, catalog))
    setBattleResult(null)
    setScene('laboratory')
    setMessage('Rewards claimed. The shop refreshed for free.')
  }

  const moveSelected = (item: InventoryItem, x: number, y: number) => {
    const next = moveInventoryItem(save, item.id, {
      x: clamp(x, 3, 97),
      y: clamp(y, 4, 96),
    })
    saveRef.current = next
    setSave(next)
  }

  const handlePointerMove = (
    item: InventoryItem,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (
      dragRef.current?.id !== item.id ||
      dragRef.current.pointerId !== event.pointerId ||
      !workspaceRef.current
    ) {
      return
    }
    const bounds = workspaceRef.current.getBoundingClientRect()
    moveSelected(
      item,
      ((event.clientX - bounds.left) / bounds.width) * 100,
      ((event.clientY - bounds.top) / bounds.height) * 100,
    )
  }

  const finishDrag = (item: InventoryItem, event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    const targets = document.elementsFromPoint(event.clientX, event.clientY)
    const ingredientSlot = targets
      .map((target) => target.closest<HTMLElement>('[data-ingredient-slot]'))
      .find(Boolean)
    const memberCard = targets
      .map((target) => target.closest<HTMLElement>('[data-member-id]'))
      .find(Boolean)
    const sellSlot = targets
      .map((target) => target.closest<HTMLElement>('[data-sell-slot]'))
      .find(Boolean)
    if (ingredientSlot && item.kind === 'ingredient') {
      loadIngredient(Number(ingredientSlot.dataset.ingredientSlot) as 0 | 1, item)
    } else if (memberCard && item.kind === 'potion') {
      handleUsePotion(memberCard.dataset.memberId ?? '', item)
    } else if (sellSlot && item.kind === 'potion') {
      setSelectedId(item.id)
      handleSell(item)
    } else {
      if (saveRef.current) void saveGame(saveRef.current)
    }
  }

  const handleKeyDown = (
    item: InventoryItem,
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    const movement = {
      ArrowLeft: [-2, 0],
      ArrowRight: [2, 0],
      ArrowUp: [0, -2],
      ArrowDown: [0, 2],
    }[event.key]
    if (!movement) return
    event.preventDefault()
    const next = moveInventoryItem(save, item.id, {
      x: clamp(item.position.x + movement[0], 3, 97),
      y: clamp(item.position.y + movement[1], 4, 96),
    })
    commit(next)
  }

  if (scene === 'battle') {
    return (
      <main className="app-shell battle-scene">
        <header className="battle-header">
          <p>Dungeon depth {save.battlesWon + 1}</p>
          <h1>{currentEnemy?.name ?? 'Unknown Enemy'}</h1>
        </header>
        <section className="battlefield" aria-label="Auto battle">
          <div className="battle-party">
            {[...save.party]
              .sort((a, b) => a.formation - b.formation)
              .map((member) => (
                <article key={member.id}>
                  <img src={CHARACTER_SPRITES[member.classId]} alt="" />
                  <strong>{member.name}</strong>
                  <span>{member.stats.health} HP</span>
                </article>
              ))}
          </div>
          <div className="battle-versus">VS</div>
          <div className="enemy-card">
            <span className="enemy-sprite" aria-hidden="true">☠</span>
            <strong>{currentEnemy?.name}</strong>
            <span>{currentEnemy?.health} HP</span>
          </div>
        </section>
        <section className="combat-log" aria-live="polite">
          {!battleResult && <p>The combatants advance automatically...</p>}
          {battleResult?.log.slice(-5).map((entry) => <p key={entry}>{entry}</p>)}
          {battleResult && !battleResult.won && (
            <button type="button" onClick={() => setScene('laboratory')}>
              Retreat to Laboratory
            </button>
          )}
        </section>
      </main>
    )
  }

  if (scene === 'rewards' && save.pendingReward) {
    return (
      <main className="app-shell reward-scene">
        <section className="reward-panel">
          <p>Battle won</p>
          <h1>{save.pendingReward.enemyName} Defeated!</h1>
          <div className="reward-list">
            <strong>{save.pendingReward.gold} Gold</strong>
            {save.pendingReward.ingredientIds.map((id) => (
              <strong key={id}>{catalog?.ingredient(id)?.name ?? id}</strong>
            ))}
          </div>
          <button type="button" onClick={handleClaim}>Claim Rewards</button>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell laboratory-shell">
      <div className="laboratory-frame" ref={workspaceRef}>
        <div className="mockup-top-row">
          <GoldDisplay gold={save.gold} />
          <PartyPanel
            canFight={Boolean(catalog && currentEnemy)}
            canUsePotion={selectedItem?.kind === 'potion'}
            glowingMemberId={glowingMemberId}
            party={save.party}
            onFight={beginBattle}
            onSwap={(memberId, formation) =>
              commit(swapFormation(save, memberId, formation))
            }
            onUsePotion={handleUsePotion}
          />
          <nav className="mockup-utility" aria-label="Game menu">
            <button type="button" onClick={() => setRecipeBookOpen(true)}>Recipes</button>
            <button type="button" onClick={onReturn}>Title</button>
          </nav>
        </div>

        <div className="mockup-bottom-row">
          <BrewingStation
            ingredients={loadedIngredients}
            previewKnown={Boolean(previewKnown)}
            previewName={previewRecipe?.name}
            onBrew={handleBrew}
            onLoadIngredient={loadIngredient}
          />
          <ShopPanel
            canSell={selectedItem?.kind === 'potion'}
            gold={save.gold}
            offers={save.shopOffers.map((id) => ({
              id,
              ingredient: catalog?.ingredient(id),
            }))}
            selectedOffer={selectedOffer}
            onPurchase={handlePurchase}
            onRefresh={handleRefresh}
            onSelectOffer={setSelectedOffer}
            onSell={() => handleSell()}
          />
        </div>

        <p className="visually-hidden" aria-live="polite">{message}</p>

        <section className="loose-item-layer" aria-label="Laboratory inventory">
        {save.inventory.map((item) => {
          const ingredient = item.kind === 'ingredient'
            ? catalog?.ingredient(item.definitionId)
            : undefined
          return (
            <button
              aria-label={`${item.name} ${item.kind}`}
              aria-pressed={selectedId === item.id}
              className={`loose-item loose-item--${item.kind}`}
              key={item.id}
              type="button"
              style={{ left: `${item.position.x}%`, top: `${item.position.y}%` }}
              onClick={() => setSelectedId(item.id)}
              onKeyDown={(event) => handleKeyDown(item, event)}
              onPointerDown={(event) => {
                setSelectedId(item.id)
                dragRef.current = { id: item.id, pointerId: event.pointerId }
                event.currentTarget.setPointerCapture?.(event.pointerId)
              }}
              onPointerMove={(event) => handlePointerMove(item, event)}
              onPointerUp={(event) => finishDrag(item, event)}
            >
              {item.kind === 'ingredient' ? <ItemArtwork item={ingredient} /> : <span>⚗</span>}
            </button>
          )
        })}
        </section>

        {Boolean(dataError || catalog?.warnings.length) && (
          <aside className="data-warning" role="alert">
            {dataError ?? catalog?.warnings.join(' ')}
          </aside>
        )}

        {recipeBookOpen && (
          <section className="recipe-book" role="dialog" aria-labelledby="recipe-book-title">
          <header>
            <div>
              <p>Discovered mixtures</p>
              <h2 id="recipe-book-title">Recipe Book</h2>
            </div>
            <button type="button" onClick={() => setRecipeBookOpen(false)}>Close</button>
          </header>
          <div className="recipe-layout">
            <nav aria-label="Discovered recipes">
              {save.discoveredRecipeIds.length ? save.discoveredRecipeIds.map((id) => {
                const recipe = catalog?.potion(id)
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selectedRecipeId === id}
                    onClick={() => setSelectedRecipeId(id)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      handleQuickBrew(id)
                    }}
                  >
                    {recipe?.name ?? id}
                  </button>
                )
              }) : <p>No recipes discovered yet.</p>}
            </nav>
            <article>
              {selectedRecipe ? (
                <>
                  <h3>{selectedRecipe.name}</h3>
                  <p>{catalog?.ingredient(selectedRecipe.ingredientA)?.name} + {catalog?.ingredient(selectedRecipe.ingredientB)?.name}</p>
                  <p>{selectedRecipe.description}</p>
                  <strong>{selectedRecipe.benefit}</strong>
                  <p>
                    Sale value: {save.knownSaleRecipeIds.includes(selectedRecipe.id)
                      ? `${selectedRecipe.saleGold} Gold`
                      : '???'}
                  </p>
                  <button type="button" onClick={() => handleQuickBrew(selectedRecipe.id)}>Quick Brew</button>
                </>
              ) : <p>Select a recipe. Right-click one to Quick Brew.</p>}
            </article>
          </div>
          </section>
        )}
      </div>
    </main>
  )
}
