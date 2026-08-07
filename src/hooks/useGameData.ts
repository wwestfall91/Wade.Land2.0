import { useEffect, useState } from 'react'
import { itemSprites } from '../data/itemSprites'
import { GameDataCatalog } from '../domain/gameData'

const DATA_URL = '/data/EleMENTAL%20Game%20Data.xlsx'
const POLL_INTERVAL_MS = 1500

export function useGameData() {
  const [catalog, setCatalog] = useState<GameDataCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let signature = ''

    const load = async () => {
      try {
        const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' })
        if (!response.ok) throw new Error(`Game data returned ${response.status}.`)
        const next = await GameDataCatalog.fromWorkbook(
          await response.arrayBuffer(),
          itemSprites,
        )
        if (!active) return
        if (next.signature !== signature) {
          signature = next.signature
          setCatalog(next)
        }
        setError(null)
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Game data could not be read.')
      }
    }

    void load()
    const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  return { catalog, error }
}
