/** Codex-compatible local pet manifest and spritesheet reader. */

import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { open, readdir, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import sharp from 'sharp'

/** Largest Codex pet manifest accepted by the importer. */
export const MAX_PET_MANIFEST_BYTES = 64 * 1024

/** Largest atlas accepted from a local Codex pet package. */
export const MAX_PET_ASSET_BYTES = 20 * 1024 * 1024

/** Codex atlas format versions supported by the DSH renderer. */
export type CodexSpriteVersion = 1 | 2

/** MIME types accepted by Codex pet packages. */
export type PetImageContentType = 'image/png' | 'image/webp'

/** Normalized values from a Codex `pet.json` file. */
export interface CodexPetManifest {
  /** Optional author-supplied id; the containing directory still owns runtime identity. */
  readonly id?: string
  /** Optional author-supplied display label. */
  readonly displayName?: string
  /** Trimmed description, or null when absent or empty. */
  readonly description: string | null
  /** Atlas layout version, defaulting to version 1. */
  readonly spriteVersionNumber: CodexSpriteVersion
  /** Relative atlas path, defaulting to `spritesheet.webp`. */
  readonly spritesheetPath: string
}

/** Validated custom-pet record retained by the Host catalog. */
export interface CodexCustomPet {
  /** Opaque runtime id derived from the containing directory. */
  readonly id: string
  /** Display label after Codex's manifest-id-directory fallback. */
  readonly displayName: string
  /** Trimmed optional description. */
  readonly description: string | null
  /** Validated atlas layout version. */
  readonly spriteVersionNumber: CodexSpriteVersion
  /** MIME type proved from file bytes. */
  readonly contentType: PetImageContentType
  /** SHA-256 binding later HTTP reads to the fully decoded scan bytes. */
  readonly sha256: string
  /** Byte size observed during the catalog scan. */
  readonly size: number
  /** Resolved atlas path, retained only inside the Host process. */
  readonly assetPath: string
  /** Resolved pet directory used for containment checks. */
  readonly directoryPath: string
  /** Resolved `pets` root used for containment checks. */
  readonly petsRoot: string
}

/** Fully read and revalidated custom-pet atlas. */
export interface CodexPetAsset {
  /** Atlas bytes. */
  readonly body: Buffer
  /** MIME type proved from the current bytes. */
  readonly contentType: PetImageContentType
  /** Strong content hash suitable for an HTTP ETag. */
  readonly sha256: string
}

const EXPECTED_DIMENSIONS: Readonly<Record<CodexSpriteVersion, readonly [number, number]>> = {
  1: [1536, 1872],
  2: [1536, 2288],
}

function hasPngAnimationControl(buffer: Buffer): boolean {
  let offset = 8
  while (offset + 12 <= buffer.length) {
    const dataLength = buffer.readUInt32BE(offset)
    const typeStart = offset + 4
    const nextOffset = typeStart + 4 + dataLength + 4
    /* v8 ignore next -- Sharp metadata succeeds only after libpng has rejected truncated chunk ranges. */
    if (nextOffset > buffer.length) return false
    const type = buffer.toString('ascii', typeStart, typeStart + 4)
    if (type === 'acTL') return true
    if (type === 'IEND') return false
    offset = nextOffset
  }
  return false
}

// O_NONBLOCK prevents a path swapped to a FIFO from hanging before fstat;
// O_NOFOLLOW rejects a final-component symlink where the host implements it.
const BOUNDED_READ_FLAGS = constants.O_RDONLY
  | constants.O_NONBLOCK
  | constants.O_NOFOLLOW

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalTrimmedString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`pet.json field "${field}" must be a non-empty string`)
  }
  return value.trim()
}

function containsPath(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate)
  return pathFromParent === ''
    || (pathFromParent !== '..' && !pathFromParent.startsWith(`..${sep}`) && !isAbsolute(pathFromParent))
}

/**
 * Normalize the exact fields consumed by Codex from decoded `pet.json` data.
 * Unknown keys are ignored, matching Codex's object parser.
 * @param value - decoded JSON value.
 * @returns normalized manifest with Codex defaults applied.
 */
export function parseCodexPetManifest(value: unknown): CodexPetManifest {
  if (!isRecord(value)) throw new Error('pet.json must contain an object')
  const id = optionalTrimmedString(value.id, 'id')
  const displayName = optionalTrimmedString(value.displayName, 'displayName')
  let description: string | null
  if (value.description === undefined || value.description === null) {
    description = null
  } else if (typeof value.description === 'string') {
    description = value.description.trim() || null
  } else {
    throw new Error('pet.json field "description" must be a string or null')
  }
  const version = value.spriteVersionNumber === undefined ? 1 : value.spriteVersionNumber
  if (version !== 1 && version !== 2) {
    throw new Error('pet.json field "spriteVersionNumber" must be 1 or 2')
  }
  const spritesheetPath = optionalTrimmedString(value.spritesheetPath, 'spritesheetPath') ?? 'spritesheet.webp'
  return {
    ...(id === undefined ? {} : { id }),
    ...(displayName === undefined ? {} : { displayName }),
    description,
    spriteVersionNumber: version,
    spritesheetPath,
  }
}

/**
 * Validate complete atlas bytes against a Codex sprite version.
 * @param buffer - complete PNG or WebP bytes.
 * @param version - manifest atlas version.
 * @returns MIME type after a complete raster decode.
 */
export async function validatePetImage(
  buffer: Buffer, version: CodexSpriteVersion,
): Promise<PetImageContentType> {
  if (buffer.length > MAX_PET_ASSET_BYTES) {
    throw new Error(`pet atlas exceeds ${String(MAX_PET_ASSET_BYTES)} bytes`)
  }
  const [width, height] = EXPECTED_DIMENSIONS[version]
  const image = sharp(buffer, {
    failOn: 'error',
    limitInputPixels: width * height,
  })
  let metadata: Awaited<ReturnType<typeof image.metadata>>
  try {
    metadata = await image.metadata()
  } catch (cause) {
    throw new Error('pet atlas must be a complete PNG or WebP image', { cause })
  }
  const contentType: PetImageContentType | undefined = metadata.format === 'png'
    ? 'image/png'
    : metadata.format === 'webp' ? 'image/webp' : undefined
  if (contentType === undefined) throw new Error('pet atlas must be a complete PNG or WebP image')
  if ((metadata.pages ?? 1) !== 1
    || (contentType === 'image/png' && hasPngAnimationControl(buffer))) {
    throw new Error('pet atlas must be a static PNG or WebP image')
  }
  if (metadata.width !== width || metadata.height !== height) {
    throw new Error(`pet atlas version ${String(version)} must be ${String(width)}x${String(height)}`)
  }
  try {
    await image.raw().toBuffer()
  } catch (cause) {
    throw new Error('pet atlas must be a complete PNG or WebP image', { cause })
  }
  return contentType
}

async function readBoundedRegularFile(
  path: string, maxBytes: number, label: 'pet atlas' | 'pet manifest',
): Promise<Buffer> {
  const file = await open(path, BOUNDED_READ_FLAGS)
  try {
    const details = await file.stat()
    if (!details.isFile()) throw new Error(`${label} is not a regular file`)
    if (details.size > maxBytes) {
      throw new Error(`${label} exceeds ${String(maxBytes)} bytes`)
    }
    const buffer = Buffer.allocUnsafe(details.size + 1)
    let total = 0
    while (total < buffer.length) {
      const { bytesRead } = await file.read(buffer, total, buffer.length - total, null)
      if (bytesRead === 0) break
      total += bytesRead
    }
    if (total !== details.size) throw new Error(`${label} changed while being read`)
    return buffer.subarray(0, total)
  } finally {
    await file.close()
  }
}

async function readOnePet(petsRoot: string, directoryName: string, manifestName: string): Promise<CodexCustomPet> {
  const lexicalDirectory = join(petsRoot, directoryName)
  const directoryPath = await realpath(lexicalDirectory)
  /* v8 ignore next -- readdir admitted a real directory under petsRoot; only a concurrent rename can escape it here. */
  if (!containsPath(petsRoot, directoryPath)) throw new Error('pet directory escapes the pets root')
  const manifestPath = await realpath(join(directoryPath, manifestName))
  if (!containsPath(directoryPath, manifestPath)) throw new Error(`${manifestName} escapes its pet directory`)
  const manifestBody = await readBoundedRegularFile(manifestPath, MAX_PET_MANIFEST_BYTES, 'pet manifest')
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBody))
  const manifest = parseCodexPetManifest(parsed)
  const lexicalAssetPath = resolve(directoryPath, manifest.spritesheetPath)
  if (!containsPath(directoryPath, lexicalAssetPath)) throw new Error('pet atlas path escapes its pet directory')
  const resolvedAssetPath = await realpath(lexicalAssetPath)
  if (!containsPath(directoryPath, resolvedAssetPath)) throw new Error('pet atlas resolves outside its pet directory')
  const body = await readBoundedRegularFile(resolvedAssetPath, MAX_PET_ASSET_BYTES, 'pet atlas')
  const contentType = await validatePetImage(body, manifest.spriteVersionNumber)
  const sha256 = createHash('sha256').update(body).digest('hex')
  return {
    id: `custom:${directoryName}`,
    displayName: manifest.displayName ?? manifest.id ?? directoryName,
    description: manifest.description,
    spriteVersionNumber: manifest.spriteVersionNumber,
    contentType,
    sha256,
    size: body.length,
    assetPath: resolvedAssetPath,
    directoryPath,
    petsRoot,
  }
}

/**
 * Scan valid Codex packages under `<codexHome>/pets`.
 * Invalid entries are omitted independently so one broken pet cannot hide the
 * rest of the catalog.
 * @param codexHome - resolved or lexical Codex home directory.
 * @returns valid custom pets sorted by directory-derived id.
 */
async function scanCodexPetRoot(
  codexHome: string, rootName: 'avatars' | 'pets', manifestName: 'avatar.json' | 'pet.json',
): Promise<readonly CodexCustomPet[]> {
  let petsRoot: string
  try {
    petsRoot = await realpath(join(codexHome, rootName))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const entries = await readdir(petsRoot, { withFileTypes: true })
  const pets: CodexCustomPet[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory()) continue
    try {
      pets.push(await readOnePet(petsRoot, entry.name, manifestName))
    } catch {
      // A catalog scan intentionally omits one malformed, unreadable, or
      // escaping package while preserving independently valid siblings.
    }
  }
  return pets
}

/**
 * Scan modern `<codexHome>/pets` packages and legacy
 * `<codexHome>/avatars` packages. A modern directory overrides a legacy
 * directory with the same runtime id, matching Codex.
 * @param codexHome - resolved or lexical Codex home directory.
 * @returns valid custom pets sorted by directory-derived id.
 */
export async function scanCodexPets(codexHome: string): Promise<readonly CodexCustomPet[]> {
  const [avatars, pets] = await Promise.all([
    scanCodexPetRoot(codexHome, 'avatars', 'avatar.json'),
    scanCodexPetRoot(codexHome, 'pets', 'pet.json'),
  ])
  const byId = new Map(avatars.map(pet => [pet.id, pet]))
  for (const pet of pets) byId.set(pet.id, pet)
  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id))
}

/**
 * Re-read a cataloged custom atlas with containment, size, and format checks.
 * @param pet - record returned by {@link scanCodexPets}.
 * @returns current validated bytes and content hash.
 */
export async function readCodexPetAsset(pet: CodexCustomPet): Promise<CodexPetAsset> {
  const currentDirectory = await realpath(pet.directoryPath)
  if (!containsPath(pet.petsRoot, currentDirectory)) throw new Error('pet directory escapes the pets root')
  const currentAsset = await realpath(pet.assetPath)
  if (!containsPath(currentDirectory, currentAsset)) throw new Error('pet atlas resolves outside its pet directory')
  const body = await readBoundedRegularFile(currentAsset, MAX_PET_ASSET_BYTES, 'pet atlas')
  const sha256 = createHash('sha256').update(body).digest('hex')
  if (sha256 !== pet.sha256) throw new Error('pet atlas changed since the catalog refresh')
  return {
    body,
    contentType: pet.contentType,
    sha256,
  }
}
