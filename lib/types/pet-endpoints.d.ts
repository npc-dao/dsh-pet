/** Client-safe HTTP paths shared by the pet Host and browser halves. */
/** Prefix claimed by the Host pet HTTP adapter. */
export declare const PET_HTTP_PREFIX = "/dsh-pet";
/** Read the current built-in and Codex-home catalog. */
export declare const PET_CATALOG_ENDPOINT = "/dsh-pet/catalog";
/** Rescan the Codex-home catalog and return the new snapshot. */
export declare const PET_REFRESH_ENDPOINT = "/dsh-pet/refresh";
/** Prefix for opaque, catalog-addressed pet atlas responses. */
export declare const PET_ASSET_PREFIX = "/dsh-pet/assets";
/**
 * Build the browser URL for one opaque pet id.
 * @param id - built-in id or `custom:<directory>` id.
 * @returns same-origin atlas path with the id encoded as one segment.
 */
export declare function petAssetPath(id: string): string;
/**
 * Add a catalog generation to an atlas URL so a successful refresh also
 * refreshes a changed image whose opaque pet id stayed the same.
 * @param path - catalog-provided same-origin atlas path.
 * @param revision - catalog generation that validated the atlas.
 * @returns cache-busting URL tied to that generation.
 */
export declare function petAssetUrl(path: string, revision: number): string;
