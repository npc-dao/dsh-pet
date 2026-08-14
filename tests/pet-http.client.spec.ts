import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import type { PetCatalog, PetCatalogAsset } from '../src/pet-catalog.ts'
import {
  PET_ASSET_PREFIX,
  PET_CATALOG_ENDPOINT,
  PET_REFRESH_ENDPOINT,
  createPetHttpHandler,
} from '../src/pet-http.ts'

interface ResponseState {
  status?: number
  headers: Record<string, string>
  body: Buffer | undefined
}

const snapshot = {
  revision: 1,
  pets: [],
}

function fakeCatalog(overrides: Partial<PetCatalog> = {}): PetCatalog {
  return {
    list: vi.fn(() => snapshot),
    refresh: vi.fn(async () => ({ ...snapshot, revision: 2 })),
    getAsset: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as PetCatalog
}

async function invoke(
  catalog: PetCatalog, url: string, method = 'GET', headers: IncomingMessage['headers'] = {},
  isTrustedRequest: (request: IncomingMessage) => boolean = () => true,
): Promise<ResponseState> {
  const state: ResponseState = { headers: {}, body: undefined }
  const request = { url, method, headers } as IncomingMessage
  const response = {
    writeHead(status: number, outgoing: Record<string, string>) {
      state.status = status
      state.headers = outgoing
      return response
    },
    end(body?: Buffer) {
      state.body = body
      return response
    },
  } as unknown as ServerResponse
  await createPetHttpHandler(catalog, isTrustedRequest)(request, response)
  return state
}

function json(state: ResponseState): unknown {
  return JSON.parse(state.body!.toString('utf8'))
}

const atlas: PetCatalogAsset = {
  body: Buffer.from('atlas'),
  contentType: 'image/webp',
  sha256: 'a'.repeat(64),
}

describe('pet HTTP routes', () => {
  it('rejects requests outside the Connection loopback trust fence', async () => {
    const list = vi.fn(() => snapshot)
    const catalog = fakeCatalog({ list })
    const reject = vi.fn(() => false)
    const get = await invoke(catalog, PET_CATALOG_ENDPOINT, 'GET', {}, reject)
    expect(get.status).toBe(403)
    expect(json(get)).toEqual({ error: 'forbidden' })
    expect(reject).toHaveBeenCalledOnce()
    expect(list).not.toHaveBeenCalled()

    const head = await invoke(catalog, PET_CATALOG_ENDPOINT, 'HEAD', {}, () => false)
    expect(head.status).toBe(403)
    expect(head.body).toBeUndefined()
  })

  it.each([
    [{ host: 'attacker.example' }, 'a rebound Host'],
    [{ host: '127.0.0.1:3080', origin: 'http://attacker.example' }, 'a foreign Origin'],
    [{ host: '127.0.0.1:3080', 'sec-fetch-site': 'cross-site' }, 'a cross-site fetch'],
  ] as const)('does not touch catalog resources after rejecting %s', async (headers, _label) => {
    const list = vi.fn(() => snapshot)
    const refresh = vi.fn(async () => ({ ...snapshot, revision: 2 }))
    const getAsset = vi.fn(async () => undefined)
    const catalog = fakeCatalog({ list, refresh, getAsset })
    const trust = vi.fn((request: IncomingMessage) => {
      const host = request.headers.host
      const origin = request.headers.origin
      return host === '127.0.0.1:3080'
        && origin !== 'http://attacker.example'
        && request.headers['sec-fetch-site'] !== 'cross-site'
    })

    expect((await invoke(catalog, PET_CATALOG_ENDPOINT, 'GET', headers, trust)).status).toBe(403)
    expect(list).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
    expect(getAsset).not.toHaveBeenCalled()
  })

  it('returns catalog JSON with no-store caching', async () => {
    const state = await invoke(fakeCatalog(), `${PET_CATALOG_ENDPOINT}?ignored=1`)
    expect(state.status).toBe(200)
    expect(state.headers).toMatchObject({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'cross-origin-resource-policy': 'same-origin',
      'content-length': String(state.body!.length),
    })
    expect(json(state)).toEqual(snapshot)
  })

  it('enforces the catalog and refresh methods', async () => {
    const catalogWrong = await invoke(fakeCatalog(), PET_CATALOG_ENDPOINT, 'HEAD')
    expect(catalogWrong.status).toBe(405)
    expect(catalogWrong.headers.allow).toBe('GET')
    expect(catalogWrong.body).toBeUndefined()

    const refreshWrong = await invoke(fakeCatalog(), PET_REFRESH_ENDPOINT, 'GET')
    expect(refreshWrong.status).toBe(405)
    expect(refreshWrong.headers.allow).toBe('POST')
  })

  it('refreshes successfully and redacts refresh failures', async () => {
    const success = await invoke(fakeCatalog(), PET_REFRESH_ENDPOINT, 'POST')
    expect(success.status).toBe(200)
    expect(json(success)).toEqual({ ...snapshot, revision: 2 })

    const failed = await invoke(fakeCatalog({ refresh: vi.fn(async () => { throw new Error('/private/path') }) }), PET_REFRESH_ENDPOINT, 'POST')
    expect(failed.status).toBe(500)
    expect(json(failed)).toEqual({ error: 'refresh_failed' })
    expect(failed.body?.toString()).not.toContain('/private/path')
  })

  it('serves an opaque encoded id with MIME, cache, length, and strong ETag', async () => {
    const getAsset = vi.fn(async () => atlas)
    const state = await invoke(fakeCatalog({ getAsset }), `${PET_ASSET_PREFIX}/custom%3Acat`)
    expect(getAsset).toHaveBeenCalledWith('custom:cat')
    expect(state.status).toBe(200)
    expect(state.body).toEqual(atlas.body)
    expect(state.headers).toMatchObject({
      'content-type': 'image/webp',
      'content-length': '5',
      'cache-control': 'private, max-age=0, must-revalidate',
      'cross-origin-resource-policy': 'same-origin',
      etag: `"${'a'.repeat(64)}"`,
      'x-content-type-options': 'nosniff',
    })
  })

  it('supports HEAD without a body and conditional GET weak comparison', async () => {
    const catalog = fakeCatalog({ getAsset: vi.fn(async () => atlas) })
    const head = await invoke(catalog, `${PET_ASSET_PREFIX}/codex`, 'HEAD')
    expect(head.status).toBe(200)
    expect(head.body).toBeUndefined()
    expect(head.headers['content-length']).toBe('5')

    const tag = `"${'a'.repeat(64)}"`
    const exact = await invoke(catalog, `${PET_ASSET_PREFIX}/codex`, 'GET', { 'if-none-match': `"other", W/${tag}` })
    expect(exact.status).toBe(304)
    expect(exact.body).toBeUndefined()
    expect(exact.headers).toEqual({
      'cache-control': 'private, max-age=0, must-revalidate',
      'cross-origin-resource-policy': 'same-origin',
      etag: tag,
      'x-content-type-options': 'nosniff',
    })
    const wildcard = await invoke(catalog, `${PET_ASSET_PREFIX}/codex`, 'GET', {
      'if-none-match': ['"no"', '*'] as never,
    })
    expect(wildcard.status).toBe(304)
    const miss = await invoke(catalog, `${PET_ASSET_PREFIX}/codex`, 'GET', { 'if-none-match': '"no"' })
    expect(miss.status).toBe(200)
  })

  it('distinguishes unknown and stale catalog assets without exposing paths', async () => {
    const missing = await invoke(fakeCatalog(), `${PET_ASSET_PREFIX}/missing`)
    expect(missing.status).toBe(404)
    expect(json(missing)).toEqual({ error: 'asset_not_found' })

    const stale = await invoke(fakeCatalog({
      getAsset: vi.fn(async () => { throw new Error('/secret/atlas.webp') }),
    }), `${PET_ASSET_PREFIX}/stale`)
    expect(stale.status).toBe(404)
    expect(json(stale)).toEqual({ error: 'asset_unavailable' })
    expect(stale.body?.toString()).not.toContain('/secret')

    const missingHead = await invoke(fakeCatalog(), `${PET_ASSET_PREFIX}/missing`, 'HEAD')
    expect(missingHead.status).toBe(404)
    expect(missingHead.body).toBeUndefined()
  })

  it('rejects malformed asset ids, extra path segments, and wrong methods', async () => {
    expect((await invoke(fakeCatalog(), `${PET_ASSET_PREFIX}/bad%`, 'GET')).status).toBe(400)
    expect((await invoke(fakeCatalog(), `${PET_ASSET_PREFIX}/`, 'GET')).status).toBe(404)
    expect((await invoke(fakeCatalog(), `${PET_ASSET_PREFIX}/one/two`, 'GET')).status).toBe(404)
    const wrong = await invoke(fakeCatalog(), `${PET_ASSET_PREFIX}/codex`, 'POST')
    expect(wrong.status).toBe(405)
    expect(wrong.headers.allow).toBe('GET, HEAD')
  })

  it('returns bounded JSON errors for an invalid or unknown URL', async () => {
    const invalid = await invoke(fakeCatalog(), 'http://[')
    expect(invalid.status).toBe(400)
    expect(json(invalid)).toEqual({ error: 'invalid_url' })
    const unknown = await invoke(fakeCatalog(), '/dsh-pet/unknown')
    expect(unknown.status).toBe(404)
    expect(json(unknown)).toEqual({ error: 'not_found' })
  })
})
