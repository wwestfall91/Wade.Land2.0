import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { db } from '../data/saveRepository'

const workbook = readFileSync(
  resolve(process.cwd(), 'public/data/EleMENTAL Game Data.xlsx'),
)

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(workbook, { status: 200 })),
  )
})

afterEach(async () => {
  cleanup()
  await db.saves.clear()
})
