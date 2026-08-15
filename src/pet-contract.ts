/** DSH pet metadata and Codex-compatible atlas layout contracts. */

import { petAssetPath } from './pet-endpoints.ts'

/** Pet atlas formats accepted by the renderer. */
export type PetSpriteVersion = 1 | 2

/** Runtime activity states projected onto Codex's task animation rows. */
export type PetState = 'idle' | 'running' | 'waiting' | 'failed' | 'review'

/** One Codex atlas layout. */
export interface CodexPetAtlas {
  /** Manifest version selecting this layout. */
  readonly version: PetSpriteVersion
  /** Full spritesheet width in pixels. */
  readonly width: number
  /** Full spritesheet height in pixels. */
  readonly height: number
  /** One frame's width in pixels. */
  readonly cellWidth: number
  /** One frame's height in pixels. */
  readonly cellHeight: number
  /** Number of frame columns. */
  readonly columns: number
  /** Number of animation rows. */
  readonly rows: number
  /** Required populated cells for each row, in top-to-bottom order. */
  readonly requiredFramesByRow: readonly number[]
}

/** Codex version 1 atlas dimensions and populated-cell counts. */
export const CODEX_PET_ATLAS_V1: Readonly<CodexPetAtlas> = Object.freeze({
  version: 1,
  width: 1536,
  height: 1872,
  cellWidth: 192,
  cellHeight: 208,
  columns: 8,
  rows: 9,
  requiredFramesByRow: Object.freeze([6, 8, 8, 4, 5, 8, 6, 6, 6]),
})

/** Codex version 2 atlas dimensions and populated-cell counts. */
export const CODEX_PET_ATLAS_V2: Readonly<CodexPetAtlas> = Object.freeze({
  version: 2,
  width: 1536,
  height: 2288,
  cellWidth: 192,
  cellHeight: 208,
  columns: 8,
  rows: 11,
  requiredFramesByRow: Object.freeze([6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8]),
})

/** Atlas lookup keyed by a normalized Codex sprite version. */
export const CODEX_PET_ATLASES: Readonly<Record<PetSpriteVersion, Readonly<CodexPetAtlas>>> =
  Object.freeze({ 1: CODEX_PET_ATLAS_V1, 2: CODEX_PET_ATLAS_V2 })

/** Catalog source distinguishing bundled entries from Codex-home entries. */
export type PetKind = 'builtin' | 'custom'

/** Browser-facing catalog row for a built-in or imported Codex pet. */
export interface PetDescriptor {
  /** Stable built-in id or opaque custom-pet id. */
  readonly id: string
  /** Bundled or Codex-home catalog source. */
  readonly kind: PetKind
  /** Human-facing pet name. */
  readonly displayName: string
  /** Optional author description. */
  readonly description: string | null
  /** Atlas layout used by this pet. */
  readonly spriteVersionNumber: PetSpriteVersion
  /** Whether the Host can currently serve this row's atlas. */
  readonly available: boolean
  /** Same-origin browser path for the atlas bytes. */
  readonly assetPath: string
}

/** Static fields for a bundled pet; availability belongs to the live Host catalog. */
export interface BuiltinPetMetadata {
  /** Stable built-in id. */
  readonly id: string
  /** Bundled product catalog source. */
  readonly kind: 'builtin'
  /** Human-facing pet name. */
  readonly displayName: string
  /** Product description. */
  readonly description: string
  /** Atlas layout used by the bundled asset. */
  readonly spriteVersionNumber: PetSpriteVersion
  /** Same-origin browser path reserved for this atlas. */
  readonly assetPath: string
}

/** DSH's bundled default pet, available without a Codex Desktop installation. */
export const DSH_BUILTIN_PET = Object.freeze({
  id: 'dsh',
  kind: 'builtin',
  displayName: '小深',
  description: 'A friendly DeepSeek-blue whale companion for DSH.',
  spriteVersionNumber: 2,
  assetPath: petAssetPath('dsh'),
} as const satisfies BuiltinPetMetadata)

/** DSH's bundled portrait pet, selectable without changing the default. */
export const ALIANG_BUILTIN_PET = Object.freeze({
  id: 'aliang',
  kind: 'builtin',
  displayName: '阿良',
  description: 'The original DSH companion.',
  spriteVersionNumber: 2,
  assetPath: petAssetPath('aliang'),
} as const satisfies BuiltinPetMetadata)

/** The nine pet identities shipped by Codex, without their binary atlases. */
export const CODEX_BUILTIN_PETS = Object.freeze([
  {
    id: 'codex', kind: 'builtin', displayName: 'Codex',
    description: 'Built-in Codex pet.', spriteVersionNumber: 2,
    assetPath: petAssetPath('codex'),
  },
  {
    id: 'dewey', kind: 'builtin', displayName: 'Dewey',
    description: 'Built-in Codex pet.', spriteVersionNumber: 2,
    assetPath: petAssetPath('dewey'),
  },
  {
    id: 'fireball', kind: 'builtin', displayName: 'Fireball',
    description: 'Built-in Codex pet.', spriteVersionNumber: 2,
    assetPath: petAssetPath('fireball'),
  },
  {
    id: 'hoots', kind: 'builtin', displayName: 'Hoots',
    description: 'Built-in Codex pet.', spriteVersionNumber: 2,
    assetPath: petAssetPath('hoots'),
  },
  {
    id: 'rocky', kind: 'builtin', displayName: 'Rocky',
    description: 'Built-in Codex pet.', spriteVersionNumber: 2,
    assetPath: petAssetPath('rocky'),
  },
  {
    id: 'seedy', kind: 'builtin', displayName: 'Seedy',
    description: 'Built-in Codex pet.', spriteVersionNumber: 2,
    assetPath: petAssetPath('seedy'),
  },
  {
    id: 'stacky', kind: 'builtin', displayName: 'Stacky',
    description: 'Built-in Codex pet.', spriteVersionNumber: 2,
    assetPath: petAssetPath('stacky'),
  },
  {
    id: 'bsod', kind: 'builtin', displayName: 'BSOD',
    description: 'Built-in Codex pet.', spriteVersionNumber: 2,
    assetPath: petAssetPath('bsod'),
  },
  {
    id: 'null-signal', kind: 'builtin', displayName: 'Null Signal',
    description: 'Built-in Codex pet.', spriteVersionNumber: 2,
    assetPath: petAssetPath('null-signal'),
  },
] as const satisfies readonly BuiltinPetMetadata[])

/** Built-in picker order: DSH's default, its optional portrait, then Codex presets. */
export const PET_PRESETS = Object.freeze([
  DSH_BUILTIN_PET,
  ALIANG_BUILTIN_PET,
  ...CODEX_BUILTIN_PETS,
] as const satisfies readonly BuiltinPetMetadata[])

/** Stable id union for every built-in pet identity. */
export type BuiltinPetId = typeof PET_PRESETS[number]['id']

/** Immutable Host catalog generation consumed by the browser controller. */
export interface PetCatalogSnapshot {
  /** Package-owned and Codex presets followed by discovered custom pets. */
  readonly pets: readonly PetDescriptor[]
  /** Monotonic in-process scan revision. */
  readonly revision: number
}
