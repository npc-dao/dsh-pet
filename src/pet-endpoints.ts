/** Client-safe HTTP paths shared by the pet Host and browser halves. */

/** Prefix claimed by the Host pet HTTP adapter. */
export const PET_HTTP_PREFIX = '/dsh-pet'

/** Read the current built-in and Codex-home catalog. */
export const PET_CATALOG_ENDPOINT = `${PET_HTTP_PREFIX}/catalog`

/** Rescan the Codex-home catalog and return the new snapshot. */
export const PET_REFRESH_ENDPOINT = `${PET_HTTP_PREFIX}/refresh`

/** Prefix for opaque, catalog-addressed pet atlas responses. */
export const PET_ASSET_PREFIX = `${PET_HTTP_PREFIX}/assets`

/**
 * Build the browser URL for one opaque pet id.
 * @param id - built-in id or `custom:<directory>` id.
 * @returns same-origin atlas path with the id encoded as one segment.
 */
export function petAssetPath(id: string): string {
  return `${PET_ASSET_PREFIX}/${encodeURIComponent(id)}`
}

/**
 * Add a catalog generation to an atlas URL so a successful refresh also
 * refreshes a changed image whose opaque pet id stayed the same.
 * @param path - catalog-provided same-origin atlas path.
 * @param revision - catalog generation that validated the atlas.
 * @returns cache-busting URL tied to that generation.
 */
export function petAssetUrl(path: string, revision: number): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}revision=${String(revision)}`
}
