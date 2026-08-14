/** Node HTTP adapter for the Host pet catalog and opaque atlas assets. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { PetCatalog } from './pet-catalog.ts'
import {
  PET_ASSET_PREFIX,
  PET_CATALOG_ENDPOINT,
  PET_REFRESH_ENDPOINT,
} from './pet-endpoints.ts'

export { PET_ASSET_PREFIX, PET_CATALOG_ENDPOINT, PET_REFRESH_ENDPOINT } from './pet-endpoints.ts'

/** Complete Host handler suitable for one `/dsh-pet` prefix route. */
export type PetHttpHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>

/** Connection-owned browser trust decision for one pet HTTP request. */
export type PetHttpRequestTrust = (request: IncomingMessage) => boolean

function sendJson(
  response: ServerResponse, status: number, value: unknown, headers: Record<string, string> = {}, head = false,
): void {
  const body = Buffer.from(JSON.stringify(value))
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.length),
    'cache-control': 'no-store',
    'cross-origin-resource-policy': 'same-origin',
    ...headers,
  })
  response.end(head ? undefined : body)
}

function methodNotAllowed(response: ServerResponse, allow: string, head: boolean): void {
  sendJson(response, 405, { error: 'method_not_allowed' }, { allow }, head)
}

function etagMatches(header: string | string[] | undefined, etag: string): boolean {
  if (header === undefined) return false
  const values = Array.isArray(header) ? header : [header]
  const bareEtag = etag.replace(/^W\//, '')
  return values.some(value => value.split(',').some((candidate) => {
    const trimmed = candidate.trim()
    return trimmed === '*' || trimmed.replace(/^W\//, '') === bareEtag
  }))
}

async function serveAsset(
  catalog: PetCatalog, id: string, request: IncomingMessage, response: ServerResponse,
): Promise<void> {
  let asset
  try {
    asset = await catalog.getAsset(id)
  } catch {
    // A catalog entry can disappear or fail validation between refresh and
    // request. Keep local filesystem details private and expose it as a miss.
    sendJson(response, 404, { error: 'asset_unavailable' }, {}, request.method === 'HEAD')
    return
  }
  if (asset === undefined) {
    sendJson(response, 404, { error: 'asset_not_found' }, {}, request.method === 'HEAD')
    return
  }
  const etag = `"${asset.sha256}"`
  const headers = {
    'content-type': asset.contentType,
    'content-length': String(asset.body.length),
    'cache-control': 'private, max-age=0, must-revalidate',
    'cross-origin-resource-policy': 'same-origin',
    etag,
    'x-content-type-options': 'nosniff',
  }
  if (etagMatches(request.headers['if-none-match'], etag)) {
    response.writeHead(304, {
      'cache-control': headers['cache-control'],
      'cross-origin-resource-policy': headers['cross-origin-resource-policy'],
      etag,
      'x-content-type-options': headers['x-content-type-options'],
    })
    response.end()
    return
  }
  response.writeHead(200, headers)
  response.end(request.method === 'HEAD' ? undefined : asset.body)
}

/**
 * Create the full pet HTTP dispatcher. Paths select only opaque catalog ids;
 * request path text is never interpreted as a filesystem or ASAR member path.
 * @param catalog - initialized mutable Host catalog.
 * @param isTrustedRequest - Connection trust fence pinned to loopback authority.
 * @returns async route handler for exact and asset-prefix requests.
 */
export function createPetHttpHandler(
  catalog: PetCatalog,
  isTrustedRequest: PetHttpRequestTrust,
): PetHttpHandler {
  return async (request, response): Promise<void> => {
    if (!isTrustedRequest(request)) {
      sendJson(response, 403, { error: 'forbidden' }, {}, request.method === 'HEAD')
      return
    }
    let pathname: string
    try {
      /* v8 ignore next -- node:http always supplies url for server requests. */
      pathname = new URL(request.url ?? '/', 'http://localhost').pathname
    } catch {
      sendJson(response, 400, { error: 'invalid_url' }, {}, request.method === 'HEAD')
      return
    }
    if (pathname === PET_CATALOG_ENDPOINT) {
      if (request.method !== 'GET') {
        methodNotAllowed(response, 'GET', request.method === 'HEAD')
        return
      }
      sendJson(response, 200, catalog.list())
      return
    }
    if (pathname === PET_REFRESH_ENDPOINT) {
      if (request.method !== 'POST') {
        methodNotAllowed(response, 'POST', request.method === 'HEAD')
        return
      }
      try {
        sendJson(response, 200, await catalog.refresh())
      } catch {
        sendJson(response, 500, { error: 'refresh_failed' })
      }
      return
    }
    const assetPrefix = `${PET_ASSET_PREFIX}/`
    if (pathname.startsWith(assetPrefix)) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        methodNotAllowed(response, 'GET, HEAD', false)
        return
      }
      const encodedId = pathname.slice(assetPrefix.length)
      if (encodedId === '' || encodedId.includes('/')) {
        sendJson(response, 404, { error: 'asset_not_found' }, {}, request.method === 'HEAD')
        return
      }
      let id: string
      try {
        id = decodeURIComponent(encodedId)
      } catch {
        sendJson(response, 400, { error: 'invalid_asset_id' }, {}, request.method === 'HEAD')
        return
      }
      await serveAsset(catalog, id, request, response)
      return
    }
    sendJson(response, 404, { error: 'not_found' }, {}, request.method === 'HEAD')
  }
}
