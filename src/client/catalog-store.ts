/** Browser catalog loader for the pet Host's same-origin HTTP surface. */

import { createSnapshotStore, type SnapshotStore } from './snapshot-store.ts'
import type { PetDescriptor } from '../pet-contract.ts'
import {
  PET_ASSET_PREFIX, PET_CATALOG_ENDPOINT, PET_REFRESH_ENDPOINT,
} from '../pet-endpoints.ts'

/** Browser catalog lifecycle state. */
export interface PetCatalogState {
  /** `idle` before first load, `loading` during a request, then a settled state. */
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Host catalog revision, zero before the first accepted response. */
  revision: number
  /** Package-owned and Codex presets first, followed by compatible local custom pets. */
  pets: readonly PetDescriptor[]
  /** Transport or validation failure text, otherwise null. */
  error: string | null
}

/** Injectable HTTP dependency for deterministic catalog tests. */
export type PetCatalogFetch = (input: string, init?: RequestInit) => Promise<Response>

/** Initial browser catalog state. */
export const INITIAL_PET_CATALOG_STATE: Readonly<PetCatalogState> = Object.freeze({
  status: 'idle',
  revision: 0,
  pets: Object.freeze([]),
  error: null,
})

/**
 * Resolve the selected available pet, falling back to the first available
 * entry while preserving the durable selected id in settings.
 * @param pets - current catalog rows.
 * @param selectedId - durable user preference.
 * @returns the effective row, or undefined when no atlas can be served.
 */
export function resolveSelectedPet(
  pets: readonly PetDescriptor[],
  selectedId: string,
): PetDescriptor | undefined {
  const selected = pets.find(pet => pet.id === selectedId && pet.available)
  return selected ?? pets.find(pet => pet.available)
}

/**
 * Single-flight catalog transport. A newer load aborts the previous request;
 * disposal aborts the live request and suppresses every later publication.
 */
export class PetCatalogController {
  /** Observable catalog source bound once by the slot registration. */
  readonly store: SnapshotStore<PetCatalogState>

  private requestGeneration = 0
  private active: AbortController | undefined
  private readonly pending = new Set<Promise<void>>()
  private disposed = false
  private disposal: Promise<void> | undefined

  /**
   * @param fetchCatalog - same-origin fetch implementation.
   */
  constructor(
    private readonly fetchCatalog: PetCatalogFetch =
      (input, init) => globalThis.fetch(input, init),
  ) {
    this.store = createSnapshotStore<PetCatalogState>({ ...INITIAL_PET_CATALOG_STATE })
  }

  /**
   * Read the current Host snapshot without forcing a filesystem rescan.
   * @returns settlement after this generation publishes or becomes stale.
   */
  load(): Promise<void> {
    return this.request(PET_CATALOG_ENDPOINT, { method: 'GET' })
  }

  /**
   * Ask the Host to rescan Codex pets, then adopt the returned snapshot.
   * @returns settlement after this generation publishes or becomes stale.
   */
  refresh(): Promise<void> {
    return this.request(PET_REFRESH_ENDPOINT, { method: 'POST' })
  }

  /**
   * Abort current transport, reject future loads, and await all requests that
   * ignored their abort signal.
   * @returns settlement after catalog transport reaches quiescence.
   */
  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal
    this.disposed = true
    this.requestGeneration += 1
    this.active?.abort()
    this.active = undefined
    this.disposal = Promise.all(this.pending).then(() => {})
    return this.disposal
  }

  private request(path: string, init: RequestInit): Promise<void> {
    if (this.disposed) return Promise.resolve()
    const pending = this.runRequest(path, init)
    this.pending.add(pending)
    void pending.then(() => { this.pending.delete(pending) })
    return pending
  }

  private async runRequest(path: string, init: RequestInit): Promise<void> {
    const generation = ++this.requestGeneration
    this.active?.abort()
    const active = new AbortController()
    this.active = active
    this.store.update((draft) => {
      draft.status = 'loading'
      draft.error = null
    })
    try {
      const response = await this.fetchCatalog(path, { ...init, signal: active.signal })
      if (!response.ok) throw new Error(`Pet catalog request failed (${response.status})`)
      const snapshot = decodeCatalog(await response.json() as unknown)
      if (generation !== this.requestGeneration) return
      this.store.set({
        status: 'ready',
        revision: snapshot.revision,
        pets: snapshot.pets,
        error: null,
      })
    } catch (error) {
      // Supersession and disposal synchronously abort this exact controller;
      // no second stale predicate is needed on the rejection path.
      if (active.signal.aborted) return
      this.store.update((draft) => {
        draft.status = 'error'
        draft.error = error instanceof Error ? error.message : String(error)
      })
    } finally {
      if (this.active === active) this.active = undefined
    }
  }
}

interface CatalogEnvelope {
  revision: number
  pets: readonly PetDescriptor[]
}

function isPetAssetPath(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const prefix = `${PET_ASSET_PREFIX}/`
  if (!value.startsWith(prefix)) return false
  const encodedId = value.slice(prefix.length)
  if (encodedId === '' || encodedId.includes('/')) return false
  try {
    const id = decodeURIComponent(encodedId)
    return id !== '' && !id.includes('/') && encodeURIComponent(id) === encodedId
  } catch {
    return false
  }
}

function decodeCatalog(value: unknown): CatalogEnvelope {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Pet catalog response must be an object')
  }
  const record = value as Record<string, unknown>
  if (!Number.isInteger(record.revision) || (record.revision as number) < 0) {
    throw new TypeError('Pet catalog revision must be a non-negative integer')
  }
  if (!Array.isArray(record.pets)) throw new TypeError('Pet catalog pets must be an array')
  const pets = record.pets.map(decodePet)
  return { revision: record.revision as number, pets: Object.freeze(pets) }
}

function decodePet(value: unknown): PetDescriptor {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Pet catalog entry must be an object')
  }
  const pet = value as Record<string, unknown>
  const description = pet.description
  if (typeof pet.id !== 'string' || pet.id.length === 0
    || typeof pet.displayName !== 'string' || pet.displayName.length === 0
    || !(description === null || typeof description === 'string')
    || !(pet.spriteVersionNumber === 1 || pet.spriteVersionNumber === 2)
    || !(pet.kind === 'builtin' || pet.kind === 'custom')
    || typeof pet.available !== 'boolean'
    || !isPetAssetPath(pet.assetPath)) {
    throw new TypeError('Pet catalog entry is invalid')
  }
  return Object.freeze({
    id: pet.id,
    displayName: pet.displayName,
    description,
    spriteVersionNumber: pet.spriteVersionNumber,
    kind: pet.kind,
    available: pet.available,
    assetPath: pet.assetPath,
  })
}
