export function GoldDisplay({ gold }: { gold: number }) {
  return (
    <div className="mockup-gold" aria-label={`${gold} Gold`}>
      <span aria-hidden="true">●</span>
      <strong>{gold}</strong>
    </div>
  )
}
