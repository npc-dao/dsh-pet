import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PetDescriptor } from '../src/pet-contract.ts'
import {
  INITIAL_PET_CATALOG_STATE,
  PetCatalogController,
  resolveSelectedPet,
} from '../src/client/catalog-store.ts'
import {
  PET_CATALOG_ENDPOINT,
  PET_REFRESH_ENDPOINT,
  petAssetPath,
  petAssetUrl,
} from '../src/pet-endpoints.ts'

const BUILTIN: PetDescriptor = {
  id: 'codex',
  kind: 'builtin',
  displayName: 'Codex',
  description: null,
  spriteVersionNumber: 2,
  available: false,
  assetPath: '/dsh-pet/assets/codex',
}

const CUSTOM: PetDescriptor = {
  id: 'custom:cat',
  kind: 'custom',
  displayName: 'Cat',
  description: 'A local pet.',
  spriteVersionNumber: 1,
  available: true,
  assetPath: '/dsh-pet/assets/custom%3Acat',
}

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept
    reject = decline
  })
  return { promise, resolve, reject }
}

async function catalogError(value: unknown): Promise<string | null> {
  const controller = new PetCatalogController(() => Promise.resolve(response(value)))
  await controller.load()
  return controller.store.getSnapshot().error
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pet browser catalog', () => {
  it('calls the native browser transport with the global receiver', async () => {
    vi.stubGlobal('fetch', function (this: unknown) {
      expect(this).toBe(globalThis)
      return Promise.resolve(response({ revision: 1, pets: [CUSTOM] }))
    })
    const controller = new PetCatalogController()

    await controller.load()

    expect(controller.store.getSnapshot()).toMatchObject({
      status: 'ready', revision: 1, pets: [CUSTOM], error: null,
    })
  })

  it('starts idle and resolves only available catalog entries', () => {
    const controller = new PetCatalogController()
    expect(controller.store.getSnapshot()).toEqual(INITIAL_PET_CATALOG_STATE)
    expect(resolveSelectedPet([BUILTIN, CUSTOM], CUSTOM.id)).toBe(CUSTOM)
    expect(resolveSelectedPet([BUILTIN, CUSTOM], BUILTIN.id)).toBe(CUSTOM)
    expect(resolveSelectedPet([BUILTIN], BUILTIN.id)).toBeUndefined()
  })

  it('builds encoded and revision-scoped asset URLs', () => {
    expect(petAssetPath('custom:猫')).toBe('/dsh-pet/assets/custom%3A%E7%8C%AB')
    expect(petAssetUrl('/dsh-pet/assets/codex', 7)).toBe('/dsh-pet/assets/codex?revision=7')
    expect(petAssetUrl('/dsh-pet/assets/codex?variant=small', 8))
      .toBe('/dsh-pet/assets/codex?variant=small&revision=8')
  })

  it('publishes loading, GET, and refresh POST generations', async () => {
    const first = deferred<Response>()
    const calls: { path: string; init?: RequestInit }[] = []
    const fetchCatalog = vi.fn((path: string, init?: RequestInit) => {
      calls.push({ path, ...(init === undefined ? {} : { init }) })
      return calls.length === 1
        ? first.promise
        : Promise.resolve(response({ revision: 2, pets: [CUSTOM] }))
    })
    const controller = new PetCatalogController(fetchCatalog)

    const load = controller.load()
    expect(controller.store.getSnapshot()).toMatchObject({ status: 'loading', error: null })
    first.resolve(response({ revision: 1, pets: [BUILTIN, CUSTOM] }))
    await load
    expect(controller.store.getSnapshot()).toEqual({
      status: 'ready', revision: 1, pets: [BUILTIN, CUSTOM], error: null,
    })

    await controller.refresh()
    expect(controller.store.getSnapshot()).toEqual({
      status: 'ready', revision: 2, pets: [CUSTOM], error: null,
    })
    expect(calls.map(call => [call.path, call.init?.method])).toEqual([
      [PET_CATALOG_ENDPOINT, 'GET'],
      [PET_REFRESH_ENDPOINT, 'POST'],
    ])
    expect(calls.every(call => call.init?.signal instanceof AbortSignal)).toBe(true)
  })

  it('lets a newer generation win even when an aborted fetch ignores its signal', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    const signals: AbortSignal[] = []
    const fetchCatalog = vi.fn((_path: string, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal)
      return signals.length === 1 ? first.promise : second.promise
    })
    const controller = new PetCatalogController(fetchCatalog)

    const oldLoad = controller.load()
    const newLoad = controller.refresh()
    expect(signals[0]!.aborted).toBe(true)
    second.resolve(response({ revision: 3, pets: [CUSTOM] }))
    await newLoad
    first.resolve(response({ revision: 1, pets: [BUILTIN] }))
    await oldLoad

    expect(controller.store.getSnapshot()).toMatchObject({ revision: 3, pets: [CUSTOM] })
  })

  it('keeps the last catalog and reports HTTP, transport, and non-Error failures', async () => {
    const replies: Array<Response | Error | number> = [
      response({ revision: 1, pets: [CUSTOM] }),
      response({ message: 'down' }, 503),
      new Error('socket closed'),
      17,
    ]
    const controller = new PetCatalogController(async () => {
      const next = replies.shift()!
      if (next instanceof Response) return next
      throw next
    })
    await controller.load()
    await controller.load()
    expect(controller.store.getSnapshot()).toMatchObject({
      status: 'error', revision: 1, pets: [CUSTOM], error: 'Pet catalog request failed (503)',
    })
    await controller.load()
    expect(controller.store.getSnapshot().error).toBe('socket closed')
    await controller.load()
    expect(controller.store.getSnapshot().error).toBe('17')
  })

  it('aborts disposal once, suppresses ignored completions, and refuses later work', async () => {
    const pending = deferred<Response>()
    let signal: AbortSignal | undefined
    const fetchCatalog = vi.fn((_path: string, init?: RequestInit) => {
      signal = init?.signal as AbortSignal
      return pending.promise
    })
    const controller = new PetCatalogController(fetchCatalog)
    const load = controller.load()
    const dispose = controller.dispose()
    expect(controller.dispose()).toBe(dispose)
    expect(signal?.aborted).toBe(true)
    let disposed = false
    void dispose.then(() => { disposed = true })
    await Promise.resolve()
    expect(disposed).toBe(false)
    pending.resolve(response({ revision: 4, pets: [CUSTOM] }))
    await load
    await dispose
    expect(disposed).toBe(true)
    await controller.load()
    await controller.refresh()
    expect(fetchCatalog).toHaveBeenCalledOnce()
    expect(controller.store.getSnapshot()).toMatchObject({ status: 'loading', revision: 0 })

    const neverLoaded = new PetCatalogController(fetchCatalog)
    await neverLoaded.dispose()
    await neverLoaded.load()
    expect(fetchCatalog).toHaveBeenCalledOnce()
  })

  it('suppresses the rejection produced by aborting an older request', async () => {
    const first = deferred<Response>()
    let firstSignal: AbortSignal | undefined
    let calls = 0
    const controller = new PetCatalogController((_path, init) => {
      calls += 1
      if (calls === 1) {
        firstSignal = init?.signal as AbortSignal
        firstSignal.addEventListener('abort', () => { first.reject(new Error('aborted')) })
        return first.promise
      }
      return Promise.resolve(response({ revision: 5, pets: [] }))
    })
    const old = controller.load()
    await controller.refresh()
    await old
    expect(firstSignal?.aborted).toBe(true)
    expect(controller.store.getSnapshot()).toMatchObject({ status: 'ready', revision: 5 })
  })

  it.each([
    ['non-object envelope', 'bad'],
    ['null envelope', null],
    ['array envelope', []],
    ['string revision', { revision: '1', pets: [] }],
    ['fractional revision', { revision: 1.5, pets: [] }],
    ['negative revision', { revision: -1, pets: [] }],
    ['non-array pets', { revision: 1, pets: {} }],
  ])('rejects a %s', async (_label, value) => {
    expect(await catalogError(value)).toMatch(/Pet catalog/)
  })

  it.each([
    ['non-object', 'bad'],
    ['null', null],
    ['array', []],
    ['empty id', { ...CUSTOM, id: '' }],
    ['non-string id', { ...CUSTOM, id: 1 }],
    ['empty display name', { ...CUSTOM, displayName: '' }],
    ['non-string display name', { ...CUSTOM, displayName: 1 }],
    ['invalid description', { ...CUSTOM, description: 1 }],
    ['invalid version', { ...CUSTOM, spriteVersionNumber: 3 }],
    ['invalid kind', { ...CUSTOM, kind: 'remote' }],
    ['invalid availability', { ...CUSTOM, available: 'yes' }],
    ['invalid asset type', { ...CUSTOM, assetPath: 1 }],
    ['relative asset path', { ...CUSTOM, assetPath: 'asset.webp' }],
    ['scheme-relative asset path', { ...CUSTOM, assetPath: '//evil.example/atlas.webp' }],
    ['wrong asset prefix', { ...CUSTOM, assetPath: '/other/assets/custom%3Acat' }],
    ['empty asset id', { ...CUSTOM, assetPath: '/dsh-pet/assets/' }],
    ['extra asset path segment', { ...CUSTOM, assetPath: '/dsh-pet/assets/custom%3Acat/atlas.webp' }],
    ['encoded asset path separator', { ...CUSTOM, assetPath: '/dsh-pet/assets/custom%3Acat%2Fatlas.webp' }],
    ['malformed asset encoding', { ...CUSTOM, assetPath: '/dsh-pet/assets/custom%3Zcat' }],
    ['non-canonical asset encoding', { ...CUSTOM, assetPath: '/dsh-pet/assets/custom:cat' }],
  ])('rejects a pet entry with %s', async (_label, pet) => {
    expect(await catalogError({ revision: 1, pets: [pet] }))
      .toMatch(/^Pet catalog entry (?:must be an object|is invalid)$/)
  })
})
