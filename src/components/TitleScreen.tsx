import mageSprite from '../assets/sprites/characters/Mage.gif'
import monkSprite from '../assets/sprites/characters/Monk.gif'
import thiefSprite from '../assets/sprites/characters/Thief.gif'
import warriorSprite from '../assets/sprites/characters/Warrior.gif'
import type { SaveRecord, SaveSlotId } from '../domain/save'
import { SAVE_SLOT_IDS } from '../domain/save'

interface TitleScreenProps {
  saves: SaveRecord[]
  isOpening: boolean
  onSelect: (slot: SaveSlotId) => void
}

const PARTY_SPRITES = [
  { src: warriorSprite, name: 'Warrior' },
  { src: mageSprite, name: 'Mage' },
  { src: monkSprite, name: 'Monk' },
  { src: thiefSprite, name: 'Thief' },
] as const

function formatLastPlayed(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })
    .format(new Date(timestamp))
    .toUpperCase()
}

function formatPlayTime(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function TitleScreen({ saves, isOpening, onSelect }: TitleScreenProps) {
  return (
    <main className="app-shell title-shell">
      <div className="nes-stage">
        <div className="corner-pixel corner-pixel--top-left" aria-hidden="true" />
        <div className="corner-pixel corner-pixel--top-right" aria-hidden="true" />

        <header className="brand-lockup">
          <p className="title-kicker">A tale of craft and courage</p>
          <h1 className="brand">
            Ele<span>MENTAL</span>
          </h1>
          <p className="tagline">Brew. Prepare. Descend.</p>
        </header>

        <section className="file-panel pixel-panel" aria-labelledby="save-slots-title">
          <div className="panel-heading">
            <span aria-hidden="true">◆</span>
            <h2 id="save-slots-title">Choose thy record</h2>
            <span aria-hidden="true">◆</span>
          </div>

          <div className="slot-list">
            {SAVE_SLOT_IDS.map((slot) => {
              const save = saves.find((candidate) => candidate.slot === slot)

              return (
                <button
                  aria-busy={isOpening}
                  aria-label={`File ${slot}: ${save ? `continue at ${save.location}` : 'begin a new quest'}`}
                  className={`save-slot ${save ? 'save-slot--occupied' : 'save-slot--empty'}`}
                  disabled={isOpening}
                  key={slot}
                  onClick={() => onSelect(slot)}
                  type="button"
                >
                  <span className="slot-cursor" aria-hidden="true">
                    ▶
                  </span>
                  <span className="slot-number">File {slot}</span>
                  <span className="slot-copy">
                    <span className="slot-title">{save ? save.location : 'Begin a new quest'}</span>
                    <span className="slot-detail">
                      {save ? `Chapter ${save.chapter} / ${save.affinity}` : 'No chronicle written'}
                    </span>
                  </span>
                  <span className="slot-meta">
                    <span>{save ? formatPlayTime(save.playTimeSeconds) : '--:--'}</span>
                    <span>{save ? formatLastPlayed(save.lastPlayedAt) : 'Empty'}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <p className="menu-help">
            <span aria-hidden="true">A</span> Select
          </p>
        </section>

        <div className="party-strip" aria-label="Adventurer classes">
          {PARTY_SPRITES.map((character) => (
            <figure key={character.name}>
              <div className="sprite-frame">
              <img className="character-sprite" src={character.src} alt="" />
              </div>
              <figcaption>{character.name}</figcaption>
            </figure>
          ))}
        </div>

        <p className="copyright-line">© 2026 Wade.land</p>
      </div>
    </main>
  )
}
