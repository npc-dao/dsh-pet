import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CodexCustomPet } from '../src/codex-format.ts'

const mocks = vi.hoisted(() => ({
  scanCodexPets: vi.fn(),
}))

vi.mock('../src/codex-format.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../src/codex-format.ts')>(),
  scanCodexPets: mocks.scanCodexPets,
}))

import { PetCatalog } from '../src/pet-catalog.ts'

beforeEach(() => {
  mocks.scanCodexPets.mockReset()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}

describe('PetCatalog refresh serialization', () => {
  it('runs concurrent refresh requests in arrival order', async () => {
    const firstScan = deferred<readonly CodexCustomPet[]>()
    const secondScan = deferred<readonly CodexCustomPet[]>()
    mocks.scanCodexPets
      .mockImplementationOnce(() => firstScan.promise)
      .mockImplementationOnce(() => secondScan.promise)
    const catalog = new PetCatalog({ platform: 'linux' })

    const first = catalog.refresh()
    const second = catalog.refresh()
    await vi.waitFor(() => { expect(mocks.scanCodexPets).toHaveBeenCalledOnce() })

    firstScan.resolve([])
    await expect(first).resolves.toMatchObject({ revision: 1 })
    await vi.waitFor(() => { expect(mocks.scanCodexPets).toHaveBeenCalledTimes(2) })
    secondScan.resolve([])
    await expect(second).resolves.toMatchObject({ revision: 2 })
    expect(catalog.list().revision).toBe(2)
  })

  it('continues the queue after one refresh fails', async () => {
    const firstScan = deferred<readonly CodexCustomPet[]>()
    mocks.scanCodexPets
      .mockImplementationOnce(() => firstScan.promise)
      .mockResolvedValueOnce([])
    const catalog = new PetCatalog({ platform: 'linux' })

    const first = catalog.refresh()
    const second = catalog.refresh()
    firstScan.reject(new Error('scan failed'))

    await expect(first).rejects.toThrow('scan failed')
    await expect(second).resolves.toMatchObject({ revision: 1 })
    expect(mocks.scanCodexPets).toHaveBeenCalledTimes(2)
  })
})
