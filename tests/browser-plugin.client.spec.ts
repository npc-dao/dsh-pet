// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.ts'
import { PetOverlayRoot } from '../src/client/PetOverlayRoot.tsx'
import { PetOverlaySlot, type PetOverlaySlotInjected } from '../src/client/PetOverlaySlot.tsx'
import { PetsSettingsSlot, type PetsSettingsSlotInjected } from '../src/client/PetsSettingsSlot.tsx'
import { en, NS, zh } from '../src/client/locales.ts'
import type { ClientContext, SettingsScope, SettingsScopeSnapshot } from '../src/client/runtime-types.ts'
import { createSnapshotStore } from '../src/client/snapshot-store.ts'
import { PET_CATALOG_ENDPOINT, PET_REFRESH_ENDPOINT } from '../src/pet-endpoints.ts'
import { DEFAULT_PET_SETTINGS, PET_SETTINGS_NAMESPACE, type PetSettings } from '../src/pet-settings.ts'
import type { PetDescriptor } from '../src/pet-contract.ts'

afterEach(() => { vi.unstubAllGlobals() })

const PET: PetDescriptor = {
  id: 'dsh', kind: 'builtin', displayName: '小深', description: 'Companion',
  spriteVersionNumber: 2, available: true, assetPath: '/dsh-pet/assets/dsh',
}

function response(revision: number): Response {
  return new Response(JSON.stringify({ revision, pets: [PET] }), {
    headers: { 'content-type': 'application/json' },
  })
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => { resolve = accept })
  return { promise, resolve }
}

interface RegisteredEntry {
  options: Record<string, unknown>
  component: unknown
}

interface ClientBench {
  ctx: ClientContext
  entries: RegisteredEntry[]
  setSetting: ReturnType<typeof vi.fn>
  media: { addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> }
  emitReset(): void
  dispose(): Promise<void>
}

function createSettingsScope(): { scope: SettingsScope<PetSettings>; set: ReturnType<typeof vi.fn> } {
  const store = createSnapshotStore<SettingsScopeSnapshot<PetSettings>>({
    status: 'ready', value: DEFAULT_PET_SETTINGS, base: DEFAULT_PET_SETTINGS,
    user: undefined, revision: 1, writable: true, mode: 'host',
  })
  const set = vi.fn(async <K extends keyof PetSettings>(field: K, value: PetSettings[K]) => {
    store.update((draft) => {
      draft.value = { ...(draft.value ?? DEFAULT_PET_SETTINGS), [field]: value }
      draft.revision += 1
    })
  })
  return { scope: { ...store, set }, set }
}

function createBench(): ClientBench {
  const entries: RegisteredEntry[] = []
  const disposers: Array<() => void | Promise<void>> = []
  const resetListeners = new Set<() => void>()
  const dictionaries = new Map<string, { zh: Record<string, string>; en: Record<string, string> }>()
  const settings = createSettingsScope()
  const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal('matchMedia', vi.fn(() => media))

  const ctx: ClientContext = {
    effect(installer) {
      const disposer = installer()
      if (disposer !== undefined) disposers.push(disposer)
    },
    on(_event, listener) {
      resetListeners.add(listener)
      return () => { resetListeners.delete(listener) }
    },
    locale: {
      register(namespace, value) {
        const previous = dictionaries.get(namespace)
        dictionaries.set(namespace, value as { zh: Record<string, string>; en: Record<string, string> })
        return () => {
          if (previous === undefined) dictionaries.delete(namespace)
          else dictionaries.set(namespace, previous)
        }
      },
      bind(namespace) {
        return key => dictionaries.get(namespace)?.zh[key] ?? key
      },
    },
    settingsScope: {
      bind(options) {
        expect(options).toEqual({ namespace: PET_SETTINGS_NAMESPACE })
        return settings.scope as never
      },
    },
    slots: {
      inject(_name, installer) {
        const installed = installer()
        if (typeof installed === 'function') disposers.push(installed)
        else for (const disposer of installed) disposers.push(disposer)
      },
      register(options, component) {
        const entry = { options, component }
        entries.push(entry)
        return () => {
          const index = entries.indexOf(entry)
          if (index >= 0) entries.splice(index, 1)
        }
      },
    },
  }

  return {
    ctx, entries, setSetting: settings.set, media,
    emitReset() { for (const listener of resetListeners) listener() },
    async dispose() { for (const disposer of [...disposers].reverse()) await disposer() },
  }
}

describe('dsh-pet browser plugin', () => {
  it('declares the complete service face used by the browser half', () => {
    expect(inject).toEqual(['slots', 'sessions', 'locale', 'connection', 'remote', 'settingsScope'])
  })

  it('loads and refreshes one catalog behind both registered surfaces', async () => {
    let revision = 0
    const fetchCatalog = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      () => Promise.resolve(response(++revision)),
    )
    vi.stubGlobal('fetch', fetchCatalog)
    const bench = createBench()
    apply(bench.ctx)

    const rootEntry = bench.entries.find(entry => entry.component === PetOverlayRoot)!
    expect(rootEntry.options).toMatchObject({ name: 'shell.overlay', id: 'pet', order: 100 })
    expect(rootEntry.options.children).toEqual({
      'shell.overlay.pet': { kind: 'single', scope: 'session-maybe' },
    })
    const overlayEntry = bench.entries.find(entry => entry.component === PetOverlaySlot)!
    const overlay = (overlayEntry.options.inject as () => PetOverlaySlotInjected)()
    const settingsEntry = bench.entries.find(entry => entry.component === PetsSettingsSlot)!
    expect(settingsEntry.options).toMatchObject({
      name: 'settings.section', id: 'pets', order: 30, locale: NS,
    })
    expect((settingsEntry.options.label as () => string)()).toBe(zh.nav)
    const section = (settingsEntry.options.inject as () => PetsSettingsSlotInjected)()
    expect(section.hooks.petCatalog).toBe(overlay.hooks.petCatalog)
    expect(section.hooks.petSettings).toBe(overlay.hooks.petSettings)

    await vi.waitFor(() => {
      expect(overlay.hooks.petCatalog.getSnapshot()).toMatchObject({
        status: 'ready', revision: 1, pets: [PET], error: null,
      })
    })
    bench.emitReset()
    await vi.waitFor(() => { expect(overlay.hooks.petCatalog.getSnapshot().revision).toBe(2) })
    await section.refresh()
    await section.set('enabled', false)
    expect(bench.setSetting).toHaveBeenCalledWith('enabled', false)
    expect(fetchCatalog.mock.calls.map(([path, options]) => [path, (options as RequestInit).method])).toEqual([
      [PET_CATALOG_ENDPOINT, 'GET'],
      [PET_CATALOG_ENDPOINT, 'GET'],
      [PET_REFRESH_ENDPOINT, 'POST'],
    ])
    expect(en.nav).toBe('Pets')

    await bench.dispose()
    expect(bench.entries).toHaveLength(0)
    expect(bench.media.removeEventListener).toHaveBeenCalledWith(
      'change', bench.media.addEventListener.mock.calls[0]![1],
    )
  })

  it('waits for an abort-ignoring request before disposal completes', async () => {
    const pending = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => pending.promise))
    const bench = createBench()
    apply(bench.ctx)

    let disposed = false
    const disposal = bench.dispose()
    void disposal.then(() => { disposed = true })
    await Promise.resolve()
    expect(disposed).toBe(false)

    pending.resolve(response(1))
    await disposal
    expect(disposed).toBe(true)
    bench.emitReset()
  })
})
