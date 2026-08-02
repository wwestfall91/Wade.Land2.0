import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { db } from '../data/saveRepository'

afterEach(async () => {
  cleanup()
  await db.saves.clear()
})
