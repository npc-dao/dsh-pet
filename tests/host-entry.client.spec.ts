import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SettingsProvider, {
  settingsNamespace, type SettingsNamespace,
} from '@deepseek-ai/dsh-settings'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostConnectionHandle, WebRoute, WebServer } from '../src/host-types.ts'

const catalog = vi.hoisted(() => ({
  list: vi.fn(() => ({ revision: 1, pets: [] })),
  refresh: vi.fn(async () => ({ revision: 2, pets: [] })),
  getAsset: vi.fn(async () => undefined),
}))
const createPetCatalog = vi.hoisted(() => vi.fn(async () => catalog))

vi.mock('../src/pet-catalog.ts', () => ({ createPetCatalog }))

import {
  Config,
  DEFAULT_PET_SETTINGS,
  MAX_PET_SIZE,
  MIN_PET_SIZE,
  PET_HTTP_PREFIX,
  PET_SETTINGS_NAMESPACE,
  apply,
  inject,
  name,
} from '../src/index.ts'

class MemorySettings extends SettingsProvider {
  readonly writable = true

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve({})
  }

  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

interface WebServerBench {
  readonly register: ReturnType<typeof vi.fn<(route: WebRoute) => () => void>>
  readonly disposeRoute: ReturnType<typeof vi.fn>
  route: WebRoute | undefined
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => { resolve = accept })
  return { promise, resolve }
}

function provideWebServer(ctx: Context): WebServerBench {
  const disposeRoute = vi.fn()
  const bench: WebServerBench = {
    register: vi.fn((route: WebRoute) => {
      bench.route = route
      return disposeRoute
    }),
    disposeRoute,
    route: undefined,
  }
  ctx.provide('webServer', { register: bench.register } as unknown as WebServer)
  return bench
}

function provideConnection(ctx: Context): ReturnType<typeof vi.fn<HostConnectionHandle['isTrustedRequest']>> {
  const isTrustedRequest = vi.fn<HostConnectionHandle['isTrustedRequest']>(() => true)
  ctx.provide('connection', {
    isTrustedRequest,
    rpc: {},
  } as unknown as HostConnectionHandle)
  return isTrustedRequest
}

beforeEach(() => {
  createPetCatalog.mockClear()
  catalog.list.mockClear()
  catalog.refresh.mockClear()
  catalog.getAsset.mockClear()
})

describe('dsh-pet Host entry', () => {
  it('declares optional string path overrides', () => {
    expect(name).toBe('dsh-pet')
    expect(Config({})).toEqual({})
    expect(Config({ codexHome: '/tmp/codex', appAsarPath: '/tmp/app.asar' })).toEqual({
      codexHome: '/tmp/codex',
      appAsarPath: '/tmp/app.asar',
    })
    expect(() => Config({ codexHome: 1 } as never)).toThrow()
    expect(() => Config({ appAsarPath: false } as never)).toThrow()
  })

  it('registers, validates, and disposes the durable pet namespace', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    provideWebServer(ctx)
    provideConnection(ctx)
    const fiber = ctx.plugin({ apply, inject: [...inject] })
    await fiber.await()

    const ns = settingsNamespace(PET_SETTINGS_NAMESPACE)
    expect(ctx.settings.get(ns)).toEqual(DEFAULT_PET_SETTINGS)
    await ctx.settings.update(ns, { enabled: false, selectedId: 'custom:cat', size: MIN_PET_SIZE })
    expect(ctx.settings.get(ns)).toEqual({ enabled: false, selectedId: 'custom:cat', size: MIN_PET_SIZE })
    await expect(ctx.settings.update(ns, { selectedId: '' })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { size: MIN_PET_SIZE - 1 })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { size: MAX_PET_SIZE + 1 })).rejects.toThrow()

    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(ns)
    expect(createPetCatalog).toHaveBeenCalledOnce()
  })

  it('declares the settings, transport, and HTTP services as activation dependencies', () => {
    expect(inject).toEqual(['connection', 'settings', 'webServer'])
  })

  it.each([
    ['the default config', undefined, {}],
    ['blank overrides', { codexHome: '  ', appAsarPath: '\t' }, {}],
    ['trimmed tilde overrides', {
      codexHome: '  ~/codex-pets  ',
      appAsarPath: '  ~/Applications/ChatGPT/app.asar  ',
    }, {
      codexHome: join(homedir(), 'codex-pets'),
      appAsarPath: join(homedir(), 'Applications/ChatGPT/app.asar'),
    }],
  ] as const)('registers and releases the HTTP prefix with %s', async (_label, config, expected) => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const webServer = provideWebServer(ctx)
    const isTrustedRequest = provideConnection(ctx)
    const plugin = { apply, inject: [...inject] }
    const fiber = config === undefined ? ctx.plugin(plugin) : ctx.plugin(plugin, config)
    await fiber.await()

    expect(createPetCatalog).toHaveBeenCalledWith(expected)
    expect(webServer.register).toHaveBeenCalledOnce()
    expect(webServer.route).toMatchObject({ kind: 'prefix', path: PET_HTTP_PREFIX })

    const writeHead = vi.fn().mockReturnThis()
    const response = {
      writeHead,
      end: vi.fn().mockReturnThis(),
    } as unknown as ServerResponse
    const request = {
      url: `${PET_HTTP_PREFIX}/catalog`, method: 'GET', headers: { host: '127.0.0.1:3080' },
    } as IncomingMessage
    await webServer.route?.handler(request, response)
    expect(isTrustedRequest).toHaveBeenCalledWith(request, 'loopback')
    expect(catalog.list).toHaveBeenCalledOnce()

    await fiber.dispose()
    expect(webServer.disposeRoute).toHaveBeenCalledOnce()
  })

  it('rejects activation before registering the route when initial discovery fails', async () => {
    createPetCatalog.mockRejectedValueOnce(new Error('broken app.asar'))
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const webServer = provideWebServer(ctx)
    provideConnection(ctx)
    const fiber = ctx.plugin({ apply, inject: [...inject] })

    await expect(fiber).rejects.toThrow('broken app.asar')
    expect(webServer.register).not.toHaveBeenCalled()
  })

  it('unregisters first and waits for an in-flight route before disposal completes', async () => {
    const pendingRefresh = deferred<{ revision: number; pets: never[] }>()
    catalog.refresh.mockImplementationOnce(() => pendingRefresh.promise)
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const webServer = provideWebServer(ctx)
    provideConnection(ctx)
    const fiber = ctx.plugin({ apply, inject: [...inject] })
    await fiber.await()
    const responseWriteHead = vi.fn().mockReturnThis()
    const response = {
      writeHead: responseWriteHead,
      end: vi.fn().mockReturnThis(),
    } as unknown as ServerResponse
    const request = {
      url: `${PET_HTTP_PREFIX}/refresh`, method: 'POST', headers: { host: '127.0.0.1:3080' },
    } as IncomingMessage

    const routeCall = webServer.route!.handler(request, response)
    await vi.waitFor(() => { expect(catalog.refresh).toHaveBeenCalledOnce() })
    let disposed = false
    const disposal = fiber.dispose()
    void disposal.then(() => { disposed = true })
    await vi.waitFor(() => { expect(webServer.disposeRoute).toHaveBeenCalledOnce() })
    expect(disposed).toBe(false)

    pendingRefresh.resolve({ revision: 2, pets: [] })
    await routeCall
    await disposal
    expect(disposed).toBe(true)
    expect(responseWriteHead).toHaveBeenCalledWith(200, expect.any(Object))
  })
})
