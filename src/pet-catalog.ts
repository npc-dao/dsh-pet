/** Host catalog combining the package-owned DSH default with Codex-compatible imports. */

import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { expandHomePath } from '@deepseek-ai/dsh-home-paths'
import {
  DEFAULT_CODEX_APP_ASAR_PATH,
  discoverCodexBuiltinAssets,
  readAsarEntry,
  windowsCodexAppAsarPath,
  type CodexBuiltinAsset,
} from './codex-asar.ts'
import {
  MAX_PET_ASSET_BYTES,
  readCodexPetAsset,
  scanCodexPets,
  validatePetImage,
  type CodexCustomPet,
  type PetImageContentType,
} from './codex-format.ts'
import {
  CODEX_BUILTIN_PETS,
  DSH_BUILTIN_PET,
  PET_PRESETS,
  type PetCatalogSnapshot,
  type PetDescriptor,
} from './pet-contract.ts'
import { petAssetPath } from './pet-endpoints.ts'

/** Host bytes returned for one opaque catalog id. */
export interface PetCatalogAsset {
  /** Complete validated atlas bytes. */
  readonly body: Buffer
  /** Signature-derived media type. */
  readonly contentType: PetImageContentType
  /** Strong SHA-256 used by the HTTP route as an ETag. */
  readonly sha256: string
}

/** Catalog construction and discovery overrides. */
export interface PetCatalogOptions {
  /** Codex home containing `pets` and legacy `avatars`; defaults to `$CODEX_HOME` or `~/.codex`. */
  readonly codexHome?: string
  /** Explicit Codex Desktop `app.asar`; malformed explicit archives reject initialization. */
  readonly appAsarPath?: string
  /** Environment mapping used only for default path discovery. */
  readonly env?: Readonly<Record<string, string | undefined>>
  /** Platform used only for default ASAR discovery. */
  readonly platform?: NodeJS.Platform
}

interface CatalogGeneration {
  readonly snapshot: PetCatalogSnapshot
  readonly customAssets: ReadonlyMap<string, CodexCustomPet>
  readonly builtinAssets: ReadonlyMap<string, PetCatalogAsset>
}

const DSH_BUILTIN_ASSET_URL = new URL('../assets/dsh/spritesheet.webp', import.meta.url)
let dshBuiltinAssetPromise: Promise<PetCatalogAsset> | undefined

/**
 * Read and validate the package-owned DSH atlas.
 * @param source - package asset URL resolved relative to the active runtime bundle.
 * @returns immutable-generation bytes, media type, and strong digest.
 */
export async function readBundledPetAsset(source: URL): Promise<PetCatalogAsset> {
  const body = await readFile(source)
  if (body.byteLength > MAX_PET_ASSET_BYTES) throw new Error('bundled DSH pet atlas exceeds the size limit')
  const contentType = await validatePetImage(body, DSH_BUILTIN_PET.spriteVersionNumber)
  if (contentType !== 'image/webp') throw new Error('bundled DSH pet atlas must be WebP')
  return {
    body,
    contentType,
    sha256: createHash('sha256').update(body).digest('hex'),
  }
}

function loadDshBuiltinAsset(): Promise<PetCatalogAsset> {
  dshBuiltinAssetPromise ??= readBundledPetAsset(DSH_BUILTIN_ASSET_URL)
  return dshBuiltinAssetPromise
}

function freezeSnapshot(pets: readonly PetDescriptor[], revision: number): PetCatalogSnapshot {
  return Object.freeze({
    pets: Object.freeze(pets.map(pet => Object.freeze(pet))),
    revision,
  })
}

/**
 * Resolve the Codex home with Codex Desktop's environment precedence.
 * @param configured - explicit catalog override.
 * @param env - environment mapping carrying `CODEX_HOME`.
 * @returns absolute Codex home path.
 */
export function resolveCodexHome(
  configured?: string, env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const configuredPath = configured?.trim()
  const environmentPath = env.CODEX_HOME?.trim()
  const selected = configuredPath || environmentPath || join(homedir(), '.codex')
  return resolve(expandHomePath(selected))
}

function defaultAsarPath(platform: NodeJS.Platform, env: Readonly<Record<string, string | undefined>>): string | undefined {
  if (platform === 'darwin') return DEFAULT_CODEX_APP_ASAR_PATH
  if (platform === 'win32' && env.LOCALAPPDATA !== undefined && env.LOCALAPPDATA !== '') {
    return windowsCodexAppAsarPath(env.LOCALAPPDATA)
  }
  return undefined
}

async function discoverBuiltins(
  explicitPath: string | undefined, platform: NodeJS.Platform, env: Readonly<Record<string, string | undefined>>,
): Promise<ReadonlyMap<string, CodexBuiltinAsset>> {
  const configuredPath = explicitPath?.trim()
  const path = configuredPath === undefined || configuredPath === ''
    ? defaultAsarPath(platform, env)
    : resolve(expandHomePath(configuredPath))
  if (path === undefined) return new Map()
  try {
    return await discoverCodexBuiltinAssets(CODEX_BUILTIN_PETS.map(pet => pet.id), path)
  } catch (error) {
    if (configuredPath !== undefined && configuredPath !== '') throw error
    // An installed Codex build may change its private ASAR layout. Automatic
    // discovery then degrades all built-ins to unavailable without affecting
    // custom pets or DSH startup.
    return new Map()
  }
}

async function validatedBuiltins(
  discovered: ReadonlyMap<string, CodexBuiltinAsset>,
): Promise<ReadonlyMap<string, PetCatalogAsset>> {
  const valid = new Map<string, PetCatalogAsset>()
  for (const metadata of CODEX_BUILTIN_PETS) {
    const asset = discovered.get(metadata.id)
    if (asset === undefined || asset.entry.size > MAX_PET_ASSET_BYTES) continue
    try {
      const body = await readAsarEntry(asset.index, asset.entry)
      const contentType = await validatePetImage(body, metadata.spriteVersionNumber)
      valid.set(metadata.id, {
        body,
        contentType,
        sha256: createHash('sha256').update(body).digest('hex'),
      })
    } catch {
      // One absent or corrupt member makes only that built-in unavailable.
    }
  }
  return valid
}

/** Mutable Host catalog with atomic scan generations. */
export class PetCatalog {
  private generation: CatalogGeneration = {
    snapshot: freezeSnapshot([], 0),
    customAssets: new Map(),
    builtinAssets: new Map(),
  }
  private refreshTail: Promise<void> = Promise.resolve()

  /**
   * Construct an uninitialized catalog; callers normally use {@link createPetCatalog}.
   * @param options - local discovery overrides.
   */
  constructor(private readonly options: PetCatalogOptions = {}) {}

  /**
   * Return the current immutable catalog generation.
   * @returns built-ins first, then custom pets, plus a monotonic revision.
   */
  list(): PetCatalogSnapshot {
    return this.generation.snapshot
  }

  /**
   * Atomically rescan custom packages and dynamically discover Codex built-ins.
   * @returns newly published catalog generation.
   */
  refresh(): Promise<PetCatalogSnapshot> {
    const result = this.refreshTail.then(() => this.scanAndPublish())
    this.refreshTail = result.then(() => {}, () => {})
    return result
  }

  private async scanAndPublish(): Promise<PetCatalogSnapshot> {
    const env = this.options.env ?? process.env
    const codexHome = resolveCodexHome(this.options.codexHome, env)
    if (this.options.codexHome?.trim()) {
      const details = await stat(codexHome)
      if (!details.isDirectory()) throw new Error('configured Codex home is not a directory')
    }
    const [dshBuiltinAsset, customPets, discoveredBuiltins] = await Promise.all([
      loadDshBuiltinAsset(),
      scanCodexPets(codexHome),
      discoverBuiltins(this.options.appAsarPath, this.options.platform ?? process.platform, env),
    ])
    const codexBuiltinAssets = await validatedBuiltins(discoveredBuiltins)
    const builtinAssets = new Map<string, PetCatalogAsset>([
      [DSH_BUILTIN_PET.id, dshBuiltinAsset],
      ...codexBuiltinAssets,
    ])
    const customAssets = new Map(customPets.map(pet => [pet.id, pet]))
    const descriptors: PetDescriptor[] = [
      ...PET_PRESETS.map(metadata => ({
        ...metadata,
        available: builtinAssets.has(metadata.id),
      })),
      ...customPets.map(pet => ({
        id: pet.id,
        kind: 'custom' as const,
        displayName: pet.displayName,
        description: pet.description,
        spriteVersionNumber: pet.spriteVersionNumber,
        available: true,
        assetPath: petAssetPath(pet.id),
      })),
    ]
    const next: CatalogGeneration = {
      snapshot: freezeSnapshot(descriptors, this.generation.snapshot.revision + 1),
      customAssets,
      builtinAssets,
    }
    this.generation = next
    return next.snapshot
  }

  /**
   * Read a current atlas by opaque id; no filesystem path crosses this API.
   * Built-in bytes stay fixed for one validated generation; a custom file
   * removed or replaced after the last refresh rejects validation.
   * @param id - built-in id or `custom:<directory>` id.
   * @returns validated bytes, or undefined when the id is unavailable.
   */
  async getAsset(id: string): Promise<PetCatalogAsset | undefined> {
    const custom = this.generation.customAssets.get(id)
    if (custom !== undefined) return await readCodexPetAsset(custom)
    const builtin = this.generation.builtinAssets.get(id)
    return builtin
  }
}

/**
 * Construct and perform the first atomic catalog scan.
 * @param options - local discovery overrides.
 * @returns initialized catalog whose first snapshot has revision 1.
 */
export async function createPetCatalog(options: PetCatalogOptions = {}): Promise<PetCatalog> {
  const catalog = new PetCatalog(options)
  await catalog.refresh()
  return catalog
}
