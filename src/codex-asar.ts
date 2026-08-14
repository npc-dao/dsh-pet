/** Minimal, bounds-checked ASAR reader for Codex's bundled pet atlases. */

import { createHash } from 'node:crypto'
import { constants, type BigIntStats } from 'node:fs'
import { open } from 'node:fs/promises'
import { join } from 'node:path'

/** Conventional Codex Desktop ASAR location on macOS. */
export const DEFAULT_CODEX_APP_ASAR_PATH = '/Applications/ChatGPT.app/Contents/Resources/app.asar'

/** Maximum ASAR JSON index accepted by this focused reader. */
export const MAX_ASAR_HEADER_BYTES = 32 * 1024 * 1024

// O_NONBLOCK prevents an archive path swapped to a FIFO from hanging before
// the same descriptor can be classified with fstat.
const ASAR_READ_FLAGS = constants.O_RDONLY | constants.O_NONBLOCK

/** One packed ASAR member with a range already proved inside the archive. */
export interface AsarEntry {
  /** Slash-separated member path. */
  readonly path: string
  /** Member byte length. */
  readonly size: number
  /** Absolute byte offset inside the archive. */
  readonly offset: number
  /** Optional SHA-256 recorded by Electron's packager. */
  readonly integrityHash?: string
}

/** Parsed ASAR index used for later bounded member reads. */
export interface AsarIndex {
  /** Host-only archive path. */
  readonly archivePath: string
  /** Archive size observed while parsing. */
  readonly archiveSize: number
  /** Opaque filesystem revision observed while parsing this index. */
  readonly archiveRevision: string
  /** First byte of packed member data. */
  readonly contentOffset: number
  /** Packed files keyed by slash-separated member path. */
  readonly entries: ReadonlyMap<string, AsarEntry>
}

/** Host-only reference to one dynamically discovered Codex built-in atlas. */
export interface CodexBuiltinAsset {
  /** Stable built-in pet id. */
  readonly id: string
  /** Parsed archive index containing the atlas. */
  readonly index: AsarIndex
  /** Packed atlas member. */
  readonly entry: AsarEntry
}

interface AsarNode {
  files?: unknown
  size?: unknown
  offset?: unknown
  integrity?: unknown
  unpacked?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fileRevision(details: BigIntStats): string {
  return [
    details.dev,
    details.ino,
    details.size,
    details.mtimeNs,
    details.ctimeNs,
  ].join(':')
}

function safeArchiveSize(details: BigIntStats): number {
  /* v8 ignore next -- supported filesystems cannot create a regular file beyond JavaScript's safe offset range in a test. */
  if (details.size > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('ASAR archive size exceeds the safe integer range')
  }
  return Number(details.size)
}

async function readExactly(file: Awaited<ReturnType<typeof open>>, position: number, length: number): Promise<Buffer> {
  const buffer = Buffer.alloc(length)
  let read = 0
  while (read < length) {
    const result = await file.read(buffer, read, length - read, position + read)
    /* v8 ignore next -- requires the archive to shrink between its validated stat and this positional read. */
    if (result.bytesRead === 0) throw new Error('ASAR ended before the declared range')
    read += result.bytesRead
  }
  return buffer
}

function parseNonnegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`ASAR ${label} must be a non-negative safe integer`)
  }
  return value
}

function parseOffset(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error('ASAR packed file offset must be a decimal string')
  }
  const offset = Number(value)
  if (!Number.isSafeInteger(offset)) throw new Error('ASAR packed file offset exceeds the safe integer range')
  return offset
}

function integrityHash(value: unknown): string | undefined {
  if (!isRecord(value) || value.algorithm !== 'SHA256' || typeof value.hash !== 'string'
    || !/^[a-f\d]{64}$/i.test(value.hash)) return undefined
  return value.hash.toLowerCase()
}

function collectEntries(
  files: Record<string, unknown>, prefix: string, contentOffset: number, archiveSize: number, entries: Map<string, AsarEntry>,
): void {
  for (const [name, rawNode] of Object.entries(files)) {
    if (!isRecord(rawNode)) throw new Error(`ASAR member "${name}" has an invalid record`)
    const node = rawNode as AsarNode
    const memberPath = prefix === '' ? name : `${prefix}/${name}`
    if (node.files !== undefined) {
      if (!isRecord(node.files)) throw new Error(`ASAR directory "${memberPath}" has an invalid files map`)
      collectEntries(node.files, memberPath, contentOffset, archiveSize, entries)
      continue
    }
    if (node.unpacked === true) continue
    const size = parseNonnegativeInteger(node.size, `member "${memberPath}" size`)
    const relativeOffset = parseOffset(node.offset)
    const absoluteOffset = contentOffset + relativeOffset
    const end = absoluteOffset + size
    if (!Number.isSafeInteger(absoluteOffset) || !Number.isSafeInteger(end)
      || absoluteOffset < contentOffset || end > archiveSize) {
      throw new Error(`ASAR member "${memberPath}" escapes the archive`)
    }
    const hash = integrityHash(node.integrity)
    entries.set(memberPath, {
      path: memberPath,
      size,
      offset: absoluteOffset,
      ...(hash === undefined ? {} : { integrityHash: hash }),
    })
  }
}

/**
 * Parse and validate an ASAR index without reading packed file bodies.
 * @param archivePath - local `app.asar` path.
 * @returns validated index of packed members.
 */
export async function readAsarIndex(archivePath: string): Promise<AsarIndex> {
  const file = await open(archivePath, ASAR_READ_FLAGS)
  try {
    const details = await file.stat({ bigint: true })
    if (!details.isFile() || details.size < 16n) throw new Error('ASAR is not a regular archive file')
    const archiveSize = safeArchiveSize(details)
    const archiveRevision = fileRevision(details)
    const prefix = await readExactly(file, 0, 16)
    const sizePicklePayload = prefix.readUInt32LE(0)
    const headerSize = prefix.readUInt32LE(4)
    const headerPicklePayload = prefix.readUInt32LE(8)
    const jsonSize = prefix.readUInt32LE(12)
    const expectedHeaderPicklePayload = Math.ceil((jsonSize + 4) / 4) * 4
    if (sizePicklePayload !== 4 || headerSize !== headerPicklePayload + 4
      || headerPicklePayload !== expectedHeaderPicklePayload) {
      throw new Error('ASAR header pickle lengths are inconsistent')
    }
    if (jsonSize === 0 || jsonSize > MAX_ASAR_HEADER_BYTES) {
      throw new Error(`ASAR JSON header must be between 1 and ${String(MAX_ASAR_HEADER_BYTES)} bytes`)
    }
    const contentOffset = 8 + headerSize
    if (!Number.isSafeInteger(contentOffset) || contentOffset > archiveSize) {
      throw new Error('ASAR header extends beyond the archive')
    }
    const encoded = await readExactly(file, 16, jsonSize)
    let root: unknown
    try {
      root = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(encoded))
    } catch (error) {
      throw new Error('ASAR JSON header is invalid', { cause: error })
    }
    if (!isRecord(root) || !isRecord(root.files)) throw new Error('ASAR JSON header has no files map')
    const entries = new Map<string, AsarEntry>()
    collectEntries(root.files, '', contentOffset, archiveSize, entries)
    if (fileRevision(await file.stat({ bigint: true })) !== archiveRevision) {
      throw new Error('ASAR archive changed while its index was being read')
    }
    return {
      archivePath,
      archiveSize,
      archiveRevision,
      contentOffset,
      entries,
    }
  } finally {
    await file.close()
  }
}

/**
 * Read one indexed ASAR member from a revision-stable archive and verify any
 * packager-provided SHA-256 integrity value.
 * @param index - validated index returned by {@link readAsarIndex}.
 * @param entry - member from that index.
 * @returns exact member bytes.
 */
export async function readAsarEntry(index: AsarIndex, entry: AsarEntry): Promise<Buffer> {
  if (index.entries.get(entry.path) !== entry) throw new Error('ASAR entry does not belong to this index')
  const file = await open(index.archivePath, ASAR_READ_FLAGS)
  try {
    const before = await file.stat({ bigint: true })
    if (!before.isFile()) throw new Error('ASAR is not a regular archive file')
    const beforeSize = safeArchiveSize(before)
    if (entry.offset + entry.size > beforeSize) {
      throw new Error('ASAR member range is no longer available')
    }
    if (fileRevision(before) !== index.archiveRevision) {
      throw new Error('ASAR archive changed since its index was read')
    }
    const body = await readExactly(file, entry.offset, entry.size)
    if (fileRevision(await file.stat({ bigint: true })) !== index.archiveRevision) {
      throw new Error('ASAR archive changed while its member was being read')
    }
    if (entry.integrityHash !== undefined
      && createHash('sha256').update(body).digest('hex') !== entry.integrityHash) {
      throw new Error('ASAR member does not match its SHA-256 integrity value')
    }
    return body
  } finally {
    await file.close()
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Locate hashed Codex spritesheet members for stable built-in ids.
 * Missing and malformed archives reject; callers decide whether their path
 * was an explicit referent or an optional automatic candidate.
 * @param ids - built-in ids whose hashed filenames should be located.
 * @param appAsarPath - configured archive path, or the conventional macOS path.
 * @returns discovered Host-only asset references keyed by id.
 */
export async function discoverCodexBuiltinAssets(
  ids: readonly string[], appAsarPath = DEFAULT_CODEX_APP_ASAR_PATH,
): Promise<ReadonlyMap<string, CodexBuiltinAsset>> {
  const index = await readAsarIndex(appAsarPath)
  const entries = [...index.entries.entries()].sort(([left], [right]) => left.localeCompare(right))
  const assets = new Map<string, CodexBuiltinAsset>()
  for (const id of ids) {
    const pattern = new RegExp(`(?:^|/)${escapeRegExp(id)}-spritesheet(?:-[^/]+)*\\.webp$`, 'i')
    const match = entries.find(([path]) => pattern.test(path))
    if (match === undefined) continue
    assets.set(id, { id, index, entry: match[1] })
  }
  return assets
}

/**
 * Build the conventional Windows archive path when LocalAppData is known.
 * @param localAppData - Windows LocalAppData directory.
 * @returns candidate ChatGPT ASAR path.
 */
export function windowsCodexAppAsarPath(localAppData: string): string {
  return join(localAppData, 'Programs', 'ChatGPT', 'resources', 'app.asar')
}
