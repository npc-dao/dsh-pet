/** DSH pet metadata and Codex-compatible atlas layout contracts. */
/** Pet atlas formats accepted by the renderer. */
export type PetSpriteVersion = 1 | 2;
/** Runtime activity states projected onto Codex's task animation rows. */
export type PetState = 'idle' | 'running' | 'waiting' | 'failed' | 'review';
/** One Codex atlas layout. */
export interface CodexPetAtlas {
    /** Manifest version selecting this layout. */
    readonly version: PetSpriteVersion;
    /** Full spritesheet width in pixels. */
    readonly width: number;
    /** Full spritesheet height in pixels. */
    readonly height: number;
    /** One frame's width in pixels. */
    readonly cellWidth: number;
    /** One frame's height in pixels. */
    readonly cellHeight: number;
    /** Number of frame columns. */
    readonly columns: number;
    /** Number of animation rows. */
    readonly rows: number;
    /** Required populated cells for each row, in top-to-bottom order. */
    readonly requiredFramesByRow: readonly number[];
}
/** Codex version 1 atlas dimensions and populated-cell counts. */
export declare const CODEX_PET_ATLAS_V1: Readonly<CodexPetAtlas>;
/** Codex version 2 atlas dimensions and populated-cell counts. */
export declare const CODEX_PET_ATLAS_V2: Readonly<CodexPetAtlas>;
/** Atlas lookup keyed by a normalized Codex sprite version. */
export declare const CODEX_PET_ATLASES: Readonly<Record<PetSpriteVersion, Readonly<CodexPetAtlas>>>;
/** Catalog source distinguishing bundled entries from Codex-home entries. */
export type PetKind = 'builtin' | 'custom';
/** Browser-facing catalog row for a built-in or imported Codex pet. */
export interface PetDescriptor {
    /** Stable built-in id or opaque custom-pet id. */
    readonly id: string;
    /** Bundled or Codex-home catalog source. */
    readonly kind: PetKind;
    /** Human-facing pet name. */
    readonly displayName: string;
    /** Optional author description. */
    readonly description: string | null;
    /** Atlas layout used by this pet. */
    readonly spriteVersionNumber: PetSpriteVersion;
    /** Whether the Host can currently serve this row's atlas. */
    readonly available: boolean;
    /** Same-origin browser path for the atlas bytes. */
    readonly assetPath: string;
}
/** Static fields for a bundled pet; availability belongs to the live Host catalog. */
export interface BuiltinPetMetadata {
    /** Stable built-in id. */
    readonly id: string;
    /** Bundled product catalog source. */
    readonly kind: 'builtin';
    /** Human-facing pet name. */
    readonly displayName: string;
    /** Product description. */
    readonly description: string;
    /** Atlas layout used by the bundled asset. */
    readonly spriteVersionNumber: PetSpriteVersion;
    /** Same-origin browser path reserved for this atlas. */
    readonly assetPath: string;
}
/** DSH's bundled default pet, available without a Codex Desktop installation. */
export declare const DSH_BUILTIN_PET: Readonly<{
    readonly id: "dsh";
    readonly kind: "builtin";
    readonly displayName: "阿良";
    readonly description: "The default DSH companion.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}>;
/** The nine pet identities shipped by Codex, without their binary atlases. */
export declare const CODEX_BUILTIN_PETS: readonly [{
    readonly id: "codex";
    readonly kind: "builtin";
    readonly displayName: "Codex";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "dewey";
    readonly kind: "builtin";
    readonly displayName: "Dewey";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "fireball";
    readonly kind: "builtin";
    readonly displayName: "Fireball";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "hoots";
    readonly kind: "builtin";
    readonly displayName: "Hoots";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "rocky";
    readonly kind: "builtin";
    readonly displayName: "Rocky";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "seedy";
    readonly kind: "builtin";
    readonly displayName: "Seedy";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "stacky";
    readonly kind: "builtin";
    readonly displayName: "Stacky";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "bsod";
    readonly kind: "builtin";
    readonly displayName: "BSOD";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "null-signal";
    readonly kind: "builtin";
    readonly displayName: "Null Signal";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}];
/** Built-in picker order: DSH's bundled default, then Codex-discovered presets. */
export declare const PET_PRESETS: readonly [Readonly<{
    readonly id: "dsh";
    readonly kind: "builtin";
    readonly displayName: "阿良";
    readonly description: "The default DSH companion.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}>, {
    readonly id: "codex";
    readonly kind: "builtin";
    readonly displayName: "Codex";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "dewey";
    readonly kind: "builtin";
    readonly displayName: "Dewey";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "fireball";
    readonly kind: "builtin";
    readonly displayName: "Fireball";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "hoots";
    readonly kind: "builtin";
    readonly displayName: "Hoots";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "rocky";
    readonly kind: "builtin";
    readonly displayName: "Rocky";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "seedy";
    readonly kind: "builtin";
    readonly displayName: "Seedy";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "stacky";
    readonly kind: "builtin";
    readonly displayName: "Stacky";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "bsod";
    readonly kind: "builtin";
    readonly displayName: "BSOD";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}, {
    readonly id: "null-signal";
    readonly kind: "builtin";
    readonly displayName: "Null Signal";
    readonly description: "Built-in Codex pet.";
    readonly spriteVersionNumber: 2;
    readonly assetPath: string;
}];
/** Stable id union for every built-in pet identity. */
export type BuiltinPetId = typeof PET_PRESETS[number]['id'];
/** Immutable Host catalog generation consumed by the browser controller. */
export interface PetCatalogSnapshot {
    /** DSH and Codex presets followed by discovered custom pets. */
    readonly pets: readonly PetDescriptor[];
    /** Monotonic in-process scan revision. */
    readonly revision: number;
}
//# sourceMappingURL=pet-contract.d.ts.map