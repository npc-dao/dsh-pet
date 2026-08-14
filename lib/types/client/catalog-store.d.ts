/** Browser catalog loader for the pet Host's same-origin HTTP surface. */
import { type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { PetDescriptor } from '../pet-contract.ts';
/** Browser catalog lifecycle state. */
export interface PetCatalogState {
    /** `idle` before first load, `loading` during a request, then a settled state. */
    status: 'idle' | 'loading' | 'ready' | 'error';
    /** Host catalog revision, zero before the first accepted response. */
    revision: number;
    /** DSH and Codex presets first, followed by compatible local custom pets. */
    pets: readonly PetDescriptor[];
    /** Transport or validation failure text, otherwise null. */
    error: string | null;
}
/** Injectable HTTP dependency for deterministic catalog tests. */
export type PetCatalogFetch = (input: string, init?: RequestInit) => Promise<Response>;
/** Initial browser catalog state. */
export declare const INITIAL_PET_CATALOG_STATE: Readonly<PetCatalogState>;
/**
 * Resolve the selected available pet, falling back to the first available
 * entry while preserving the durable selected id in settings.
 * @param pets - current catalog rows.
 * @param selectedId - durable user preference.
 * @returns the effective row, or undefined when no atlas can be served.
 */
export declare function resolveSelectedPet(pets: readonly PetDescriptor[], selectedId: string): PetDescriptor | undefined;
/**
 * Single-flight catalog transport. A newer load aborts the previous request;
 * disposal aborts the live request and suppresses every later publication.
 */
export declare class PetCatalogController {
    private readonly fetchCatalog;
    /** Observable catalog source bound once by the slot registration. */
    readonly store: SnapshotStore<PetCatalogState>;
    private requestGeneration;
    private active;
    private readonly pending;
    private disposed;
    private disposal;
    /**
     * @param fetchCatalog - same-origin fetch implementation.
     */
    constructor(fetchCatalog?: PetCatalogFetch);
    /**
     * Read the current Host snapshot without forcing a filesystem rescan.
     * @returns settlement after this generation publishes or becomes stale.
     */
    load(): Promise<void>;
    /**
     * Ask the Host to rescan Codex pets, then adopt the returned snapshot.
     * @returns settlement after this generation publishes or becomes stale.
     */
    refresh(): Promise<void>;
    /**
     * Abort current transport, reject future loads, and await all requests that
     * ignored their abort signal.
     * @returns settlement after catalog transport reaches quiescence.
     */
    dispose(): Promise<void>;
    private request;
    private runRequest;
}
//# sourceMappingURL=catalog-store.d.ts.map