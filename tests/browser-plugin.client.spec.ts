// @vitest-environment jsdom

import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { stubSettingsScope, TestRemote } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '../src/client/index.ts'
import { PetOverlayRoot } from '../src/client/PetOverlayRoot.tsx'
import { PetOverlaySlot, type PetOverlaySlotInjected } from '../src/client/PetOverlaySlot.tsx'
import { PetsSettingsSlot, type PetsSettingsSlotInjected } from '../src/client/PetsSettingsSlot.tsx'
import { NS, en, zh } from '../src/client/locales.ts'
import {
  PET_CATALOG_ENDPOINT, PET_REFRESH_ENDPOINT,
} from '../src/pet-endpoints.ts'
import { PET_SETTINGS_NAMESPACE, type PetSettings } from '../src/pet-settings.ts'
import type { PetDescriptor } from '../src/pet-contract.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

const PET: PetDescriptor = {
  id: 'codex',
  kind: 'builtin',
  displayName: 'Codex',
  description: 'Companion',
  spriteVersionNumber: 2,
  available: true,
  assetPath: '/dsh-pet/assets/codex',
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

async function bench() {
  let revision = 0
  const fetchCatalog = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
    () => Promise.resolve(response(++revision)),
  )
  vi.stubGlobal('fetch', fetchCatalog)
  const media = {
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => media))

  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  new TestRemote(ctx)
  ctx.provide('connection', { api: { settings: {} }, isLoopback: true } as never)
  ctx.provide('sessions', {} as never)
  const settings = stubSettingsScope<PetSettings>()
  const bind = vi.fn(() => settings.scope)
  ctx.provide('settingsScope', { bind } as never)
  return { ctx, slots, locale, fetchCatalog, settings, bind, media }
}

function declareShell(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: {
      'shell.overlay': { kind: 'list', scope: 'root' },
      'settings.section': { kind: 'list', scope: 'root' },
    },
  } as never, () => null)
}

describe('dsh-pet browser plugin', () => {
  it('declares the complete service face used by the browser half', () => {
    expect(inject).toEqual([
      'slots', 'sessions', 'locale', 'connection', 'remote', 'settingsScope',
    ])
  })

  it('loads and refreshes one catalog behind both registered surfaces', async () => {
    const b = await bench()
    const releaseShell = declareShell(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    expect(b.bind).toHaveBeenCalledWith({ namespace: PET_SETTINGS_NAMESPACE })
    expect(b.slots.spec('shell.overlay.pet')).toEqual({ kind: 'single', scope: 'session-maybe' })
    const rootEntry = b.slots.entries('shell.overlay')[0]!
    expect(rootEntry.component).toBe(PetOverlayRoot)
    expect(rootEntry.options).toMatchObject({ id: 'pet', order: 100 })
    expect(rootEntry.children).toEqual({
      'shell.overlay.pet': { kind: 'single', scope: 'session-maybe' },
    })
    const overlayEntry = b.slots.entries('shell.overlay.pet')[0]!
    expect(overlayEntry.component).toBe(PetOverlaySlot)
    const overlay = (overlayEntry.inject as unknown as () => PetOverlaySlotInjected)()

    const settingsEntry = b.slots.entries('settings.section')[0]!
    expect(settingsEntry.component).toBe(PetsSettingsSlot)
    expect(settingsEntry.options).toMatchObject({ id: 'pets', order: 30 })
    expect(settingsEntry.locale).toBe(NS)
    expect(resolveSlotLabel(settingsEntry.options.label)).toBe(zh.nav)
    b.locale.setLocale('en')
    expect(resolveSlotLabel(settingsEntry.options.label)).toBe(en.nav)
    const section = (settingsEntry.inject as unknown as () => PetsSettingsSlotInjected)()
    expect(section.hooks.petCatalog).toBe(overlay.hooks.petCatalog)
    expect(section.hooks.petSettings).toBe(overlay.hooks.petSettings)

    await vi.waitFor(() => {
      expect(overlay.hooks.petCatalog.getSnapshot()).toMatchObject({
        status: 'ready', revision: 1, pets: [PET], error: null,
      })
    })
    b.ctx.emit('connection/reset')
    await vi.waitFor(() => {
      expect(overlay.hooks.petCatalog.getSnapshot().revision).toBe(2)
    })
    await section.refresh()
    expect(overlay.hooks.petCatalog.getSnapshot().revision).toBe(3)
    await section.set('enabled', false)
    expect(b.settings.set).toHaveBeenCalledWith('enabled', false)
    expect(b.fetchCatalog.mock.calls.map(([path, options]) => [
      path,
      (options as RequestInit).method,
    ])).toEqual([
      [PET_CATALOG_ENDPOINT, 'GET'],
      [PET_CATALOG_ENDPOINT, 'GET'],
      [PET_REFRESH_ENDPOINT, 'POST'],
    ])

    await fiber.dispose()
    releaseShell()
  })

  it('follows late declarations, declarer reloads, and plugin teardown', async () => {
    const b = await bench()
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await vi.waitFor(() => { expect(b.fetchCatalog).toHaveBeenCalledOnce() })
    expect(b.slots.entries('shell.overlay')).toHaveLength(0)
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    expect(b.slots.spec('shell.overlay.pet')).toBeUndefined()
    expect(b.media.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    const firstShell = declareShell(b.slots)
    await vi.waitFor(() => {
      expect(b.slots.entries('shell.overlay.pet')[0]?.component).toBe(PetOverlaySlot)
    })
    firstShell()
    expect(b.slots.entries('shell.overlay')).toHaveLength(0)
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    expect(b.slots.entries('shell.overlay.pet')).toHaveLength(0)
    expect(b.slots.spec('shell.overlay.pet')).toBeUndefined()

    const secondShell = declareShell(b.slots)
    await vi.waitFor(() => {
      expect(b.slots.entries('shell.overlay')[0]?.component).toBe(PetOverlayRoot)
      expect(b.slots.entries('settings.section')[0]?.component).toBe(PetsSettingsSlot)
    })
    const beforeDispose = b.fetchCatalog.mock.calls.length
    await fiber.dispose()
    expect(b.slots.entries('shell.overlay')).toHaveLength(0)
    expect(b.slots.entries('settings.section')).toHaveLength(0)
    expect(b.slots.spec('shell.overlay.pet')).toBeUndefined()
    expect(b.media.removeEventListener).toHaveBeenCalledWith(
      'change', b.media.addEventListener.mock.calls[0]![1],
    )
    b.ctx.emit('connection/reset')
    await Promise.resolve()
    expect(b.fetchCatalog).toHaveBeenCalledTimes(beforeDispose)
    expect(() => b.locale.register(NS, { zh, en })).not.toThrow()

    secondShell()
  })

  it('waits for an abort-ignoring catalog request before plugin disposal completes', async () => {
    const b = await bench()
    const pending = deferred<Response>()
    const fetchCatalog = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', fetchCatalog)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await vi.waitFor(() => { expect(fetchCatalog).toHaveBeenCalledOnce() })

    let disposed = false
    const disposal = fiber.dispose()
    void disposal.then(() => { disposed = true })
    await Promise.resolve()
    expect(disposed).toBe(false)

    pending.resolve(response(1))
    await disposal
    expect(disposed).toBe(true)
  })
})
