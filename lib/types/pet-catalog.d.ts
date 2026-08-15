/** Host catalog combining the package-owned DSH default with Codex-compatible imports. */
import { type PetImageContentType } from './codex-format.ts';
import { type PetCatalogSnapshot, type PetSpriteVersion } from './pet-contract.ts';
/** Host bytes returned for one opaque catalog id. */
export interface PetCatalogAsset {
    /** Complete validated atlas bytes. */
    readonly body: Buffer;
    /** Signature-derived media type. */
    readonly contentType: PetImageContentType;
    /** Strong SHA-256 used by the HTTP route as an ETag. */
    readonly sha256: string;
}
/** Catalog construction and discovery overrides. */
export interface PetCatalogOptions {
    /** Codex home containing `pets` and legacy `avatars`; defaults to `$CODEX_HOME` or `~/.codex`. */
    readonly codexHome?: string;
    /** Explicit Codex Desktop `app.asar`; malformed explicit archives reject initialization. */
    readonly appAsarPath?: string;
    /** Environment mapping used only for default path discovery. */
    readonly env?: Readonly<Record<string, string | undefined>>;
    /** Platform used only for default ASAR discovery. */
    readonly platform?: NodeJS.Platform;
}
/**
 * Read and validate one package-owned atlas.
 * @param source - package asset URL resolved relative to the active runtime bundle.
 * @param spriteVersionNumber - atlas layout expected for the bundled pet.
 * @returns immutable-generation bytes, media type, and strong digest.
 */
export declare function readBundledPetAsset(source: URL, spriteVersionNumber: PetSpriteVersion): Promise<PetCatalogAsset>;
/**
 * Resolve the Codex home with Codex Desktop's environment precedence.
 * @param configured - explicit catalog override.
 * @param env - environment mapping carrying `CODEX_HOME`.
 * @returns absolute Codex home path.
 */
export declare function resolveCodexHome(configured?: string, env?: Readonly<Record<string, string | undefined>>): string;
/** Mutable Host catalog with atomic scan generations. */
export declare class PetCatalog {
    private readonly options;
    private generation;
    private refreshTail;
    /**
     * Construct an uninitialized catalog; callers normally use {@link createPetCatalog}.
     * @param options - local discovery overrides.
     */
    constructor(options?: PetCatalogOptions);
    /**
     * Return the current immutable catalog generation.
     * @returns built-ins first, then custom pets, plus a monotonic revision.
     */
    list(): PetCatalogSnapshot;
    /**
     * Atomically rescan custom packages and dynamically discover Codex built-ins.
     * @returns newly published catalog generation.
     */
    refresh(): Promise<PetCatalogSnapshot>;
    private scanAndPublish;
    /**
     * Read a current atlas by opaque id; no filesystem path crosses this API.
     * Built-in bytes stay fixed for one validated generation; a custom file
     * removed or replaced after the last refresh rejects validation.
     * @param id - built-in id or `custom:<directory>` id.
     * @returns validated bytes, or undefined when the id is unavailable.
     */
    getAsset(id: string): Promise<PetCatalogAsset | undefined>;
}
/**
 * Construct and perform the first atomic catalog scan.
 * @param options - local discovery overrides.
 * @returns initialized catalog whose first snapshot has revision 1.
 */
export declare function createPetCatalog(options?: PetCatalogOptions): Promise<PetCatalog>;
//# sourceMappingURL=pet-catalog.d.ts.map