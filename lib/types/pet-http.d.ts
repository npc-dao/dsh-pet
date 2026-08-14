/** Node HTTP adapter for the Host pet catalog and opaque atlas assets. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { PetCatalog } from './pet-catalog.ts';
export { PET_ASSET_PREFIX, PET_CATALOG_ENDPOINT, PET_REFRESH_ENDPOINT } from './pet-endpoints.ts';
/** Complete Host handler suitable for one `/dsh-pet` prefix route. */
export type PetHttpHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;
/** Connection-owned browser trust decision for one pet HTTP request. */
export type PetHttpRequestTrust = (request: IncomingMessage) => boolean;
/**
 * Create the full pet HTTP dispatcher. Paths select only opaque catalog ids;
 * request path text is never interpreted as a filesystem or ASAR member path.
 * @param catalog - initialized mutable Host catalog.
 * @param isTrustedRequest - Connection trust fence pinned to loopback authority.
 * @returns async route handler for exact and asset-prefix requests.
 */
export declare function createPetHttpHandler(catalog: PetCatalog, isTrustedRequest: PetHttpRequestTrust): PetHttpHandler;
//# sourceMappingURL=pet-http.d.ts.map