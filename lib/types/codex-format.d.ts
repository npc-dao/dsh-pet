/** Codex-compatible local pet manifest and spritesheet reader. */
/** Largest Codex pet manifest accepted by the importer. */
export declare const MAX_PET_MANIFEST_BYTES: number;
/** Largest atlas accepted from a local Codex pet package. */
export declare const MAX_PET_ASSET_BYTES: number;
/** Codex atlas format versions supported by the DSH renderer. */
export type CodexSpriteVersion = 1 | 2;
/** MIME types accepted by Codex pet packages. */
export type PetImageContentType = 'image/png' | 'image/webp';
/** Normalized values from a Codex `pet.json` file. */
export interface CodexPetManifest {
    /** Optional author-supplied id; the containing directory still owns runtime identity. */
    readonly id?: string;
    /** Optional author-supplied display label. */
    readonly displayName?: string;
    /** Trimmed description, or null when absent or empty. */
    readonly description: string | null;
    /** Atlas layout version, defaulting to version 1. */
    readonly spriteVersionNumber: CodexSpriteVersion;
    /** Relative atlas path, defaulting to `spritesheet.webp`. */
    readonly spritesheetPath: string;
}
/** Validated custom-pet record retained by the Host catalog. */
export interface CodexCustomPet {
    /** Opaque runtime id derived from the containing directory. */
    readonly id: string;
    /** Display label after Codex's manifest-id-directory fallback. */
    readonly displayName: string;
    /** Trimmed optional description. */
    readonly description: string | null;
    /** Validated atlas layout version. */
    readonly spriteVersionNumber: CodexSpriteVersion;
    /** MIME type proved from file bytes. */
    readonly contentType: PetImageContentType;
    /** SHA-256 binding later HTTP reads to the fully decoded scan bytes. */
    readonly sha256: string;
    /** Byte size observed during the catalog scan. */
    readonly size: number;
    /** Resolved atlas path, retained only inside the Host process. */
    readonly assetPath: string;
    /** Resolved pet directory used for containment checks. */
    readonly directoryPath: string;
    /** Resolved `pets` root used for containment checks. */
    readonly petsRoot: string;
}
/** Fully read and revalidated custom-pet atlas. */
export interface CodexPetAsset {
    /** Atlas bytes. */
    readonly body: Buffer;
    /** MIME type proved from the current bytes. */
    readonly contentType: PetImageContentType;
    /** Strong content hash suitable for an HTTP ETag. */
    readonly sha256: string;
}
/**
 * Normalize the exact fields consumed by Codex from decoded `pet.json` data.
 * Unknown keys are ignored, matching Codex's object parser.
 * @param value - decoded JSON value.
 * @returns normalized manifest with Codex defaults applied.
 */
export declare function parseCodexPetManifest(value: unknown): CodexPetManifest;
/**
 * Validate complete atlas bytes against a Codex sprite version.
 * @param buffer - complete PNG or WebP bytes.
 * @param version - manifest atlas version.
 * @returns MIME type after a complete raster decode.
 */
export declare function validatePetImage(buffer: Buffer, version: CodexSpriteVersion): Promise<PetImageContentType>;
/**
 * Scan modern `<codexHome>/pets` packages and legacy
 * `<codexHome>/avatars` packages. A modern directory overrides a legacy
 * directory with the same runtime id, matching Codex.
 * @param codexHome - resolved or lexical Codex home directory.
 * @returns valid custom pets sorted by directory-derived id.
 */
export declare function scanCodexPets(codexHome: string): Promise<readonly CodexCustomPet[]>;
/**
 * Re-read a cataloged custom atlas with containment, size, and format checks.
 * @param pet - record returned by {@link scanCodexPets}.
 * @returns current validated bytes and content hash.
 */
export declare function readCodexPetAsset(pet: CodexCustomPet): Promise<CodexPetAsset>;
//# sourceMappingURL=codex-format.d.ts.map