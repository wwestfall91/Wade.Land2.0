import mageSprite from '../../assets/sprites/characters/Mage.gif'
import thiefSprite from '../../assets/sprites/characters/Thief.gif'
import warriorSprite from '../../assets/sprites/characters/Warrior.gif'
import type { PartyMember } from '../../domain/save'

const CHARACTER_SPRITES: Record<string, string> = {
  warrior: warriorSprite,
  thief: thiefSprite,
  'black-mage': mageSprite,
}

interface PartyPanelProps {
  party: readonly PartyMember[]
  glowingMemberId: string | null
  canUsePotion: boolean
  canFight: boolean
  onFight: () => void
  onSwap: (memberId: string, formation: number) => void
  onUsePotion: (memberId: string) => void
}

export function PartyPanel({
  party,
  glowingMemberId,
  canUsePotion,
  canFight,
  onFight,
  onSwap,
  onUsePotion,
}: PartyPanelProps) {
  return (
    <section className="mockup-panel mockup-party" aria-labelledby="party-title">
      <h2 id="party-title">Party</h2>
      <div className="mockup-formation">
        {[0, 1, 2, 3, 4].map((formation) => {
          const member = party.find((entry) => entry.formation === formation)
          return (
            <div
              className={`mockup-party-slot ${member ? 'mockup-party-slot--filled' : ''}`}
              data-formation={formation}
              key={formation}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const memberId = event.dataTransfer.getData('text/member-id')
                if (memberId) onSwap(memberId, formation)
              }}
            >
              {member ? (
                <button
                  aria-label={`${member.name}: ${member.stats.health} Health, ${member.stats.attack} Attack`}
                  className={`mockup-character ${glowingMemberId === member.id ? 'mockup-character--glow' : ''}`}
                  data-member-id={member.id}
                  draggable
                  type="button"
                  onClick={() => canUsePotion && onUsePotion(member.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/member-id', member.id)
                  }}
                >
                  <img src={CHARACTER_SPRITES[member.classId]} alt="" draggable="false" />
                  <span className="character-stat character-stat--health">
                    {member.stats.health}
                  </span>
                  <span className="character-stat character-stat--attack">
                    {member.stats.attack}
                  </span>
                </button>
              ) : (
                <span>{5 - formation}</span>
              )}
            </div>
          )
        })}
      </div>
      <button className="mockup-fight-button" disabled={!canFight} type="button" onClick={onFight}>
        Fight!
      </button>
    </section>
  )
}
