import type { IngredientDefinition } from '../../domain/gameData'

export function ItemArtwork({
  item,
  className = '',
}: {
  item?: Pick<IngredientDefinition, 'name' | 'spriteUrl'>
  className?: string
}) {
  if (!item) return <span className={`item-fallback ${className}`}>?</span>
  return item.spriteUrl ? (
    <img className={className} src={item.spriteUrl} alt="" draggable="false" />
  ) : (
    <span className={`item-fallback ${className}`} aria-hidden="true">
      {item.name.slice(0, 2)}
    </span>
  )
}
