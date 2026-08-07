import { useRef, useState, type PointerEvent } from 'react'
import type { IngredientDefinition } from '../../domain/gameData'
import { ItemArtwork } from './ItemArtwork'

interface ShopOffer {
  id: string
  ingredient?: IngredientDefinition
}

interface ShopPanelProps {
  offers: readonly ShopOffer[]
  gold: number
  selectedOffer: number | null
  canSell: boolean
  onSelectOffer: (index: number) => void
  onPurchase: (
    index: number,
    dropPoint?: { clientX: number; clientY: number },
  ) => void
  onRefresh: () => void
  onSell: () => void
}

export function ShopPanel({
  offers,
  gold,
  selectedOffer,
  canSell,
  onSelectOffer,
  onPurchase,
  onRefresh,
  onSell,
}: ShopPanelProps) {
  const dragOrigin = useRef<DOMRect | null>(null)
  const purchasedByDrag = useRef(false)
  const [draggingOffer, setDraggingOffer] = useState<number | null>(null)
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
  const selected = selectedOffer === null ? undefined : offers[selectedOffer]?.ingredient

  const finishOfferDrag = (
    index: number,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    const origin = dragOrigin.current
    dragOrigin.current = null
    setDraggingOffer(null)
    setDragPoint(null)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (
      origin &&
      (event.clientX < origin.left ||
        event.clientX > origin.right ||
        event.clientY < origin.top ||
        event.clientY > origin.bottom)
    ) {
      purchasedByDrag.current = true
      onPurchase(index, { clientX: event.clientX, clientY: event.clientY })
    }
  }

  const draggedIngredient =
    draggingOffer === null ? undefined : offers[draggingOffer]?.ingredient

  return (
    <>
      <section className="mockup-panel mockup-shop" aria-labelledby="shop-title">
      <h2 id="shop-title">Shop</h2>
      <div className="mockup-shop-controls">
        <button disabled={gold < 3} type="button" onClick={onRefresh}>
          Refresh
          <span className="control-price">3</span>
        </button>
        <button
          disabled={!selected || gold < selected.gold}
          type="button"
          onClick={() => selectedOffer !== null && onPurchase(selectedOffer)}
        >
          Buy
        </button>
      </div>
      <div className="mockup-shop-row">
        <div className="mockup-offers">
          {offers.map(({ id, ingredient }, index) => (
            <button
              aria-label={
                ingredient
                  ? `Select ${ingredient.name} for ${ingredient.gold} Gold`
                  : 'Unavailable offer'
              }
              aria-pressed={selectedOffer === index}
              className={draggingOffer === index ? 'mockup-offer--dragging' : ''}
              disabled={!ingredient || gold < ingredient.gold}
              key={`${id}-${index}`}
              type="button"
              onClick={() => {
                if (purchasedByDrag.current) {
                  purchasedByDrag.current = false
                  return
                }
                onSelectOffer(index)
              }}
              onPointerDown={(event) => {
                dragOrigin.current = event.currentTarget.getBoundingClientRect()
                setDraggingOffer(index)
                setDragPoint({ x: event.clientX, y: event.clientY })
                event.currentTarget.setPointerCapture?.(event.pointerId)
              }}
              onPointerMove={(event) => {
                if (draggingOffer === index) {
                  setDragPoint({ x: event.clientX, y: event.clientY })
                }
              }}
              onPointerUp={(event) => finishOfferDrag(index, event)}
              onPointerCancel={() => {
                dragOrigin.current = null
                setDraggingOffer(null)
                setDragPoint(null)
              }}
            >
              <ItemArtwork item={ingredient} />
              <span className="offer-price">{ingredient?.gold ?? '-'}</span>
            </button>
          ))}
        </div>
        <button
          className="mockup-sell"
          data-sell-slot
          disabled={!canSell}
          type="button"
          onClick={onSell}
        >
          Sell
        </button>
      </div>
      </section>
      {draggedIngredient && dragPoint && (
        <div
          className="shop-drag-preview"
          aria-hidden="true"
          style={{ left: dragPoint.x, top: dragPoint.y }}
        >
          <ItemArtwork item={draggedIngredient} />
        </div>
      )}
    </>
  )
}
