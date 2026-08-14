import { createHash } from 'node:crypto'
import { close, constants, open as openFile } from 'node:fs'
import { mkdtemp, rename, rm, truncate, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_ASAR_HEADER_BYTES,
  discoverCodexBuiltinAssets,
  readAsarEntry,
  readAsarIndex,
  windowsCodexAppAsarPath,
} from '../src/codex-asar.ts'

const fileSystemMocks = vi.hoisted(() => ({ open: vi.fn() }))
const closeAsync = promisify(close)
const execFileAsync = promisify(execFile)
const openFileAsync = promisify(openFile)

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  fileSystemMocks.open.mockImplementation(actual.open)
  return { ...actual, open: fileSystemMocks.open }
})

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function temporaryPath(name = 'app.asar'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pet-asar-'))
  roots.push(root)
  return join(root, name)
}

async function expectFastFifoRejection(operation: Promise<unknown>, fifoPath: string): Promise<void> {
  let unblock: Promise<void> | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      unblock = openFileAsync(fifoPath, constants.O_WRONLY).then(async (descriptor) => {
        await closeAsync(descriptor)
      })
      reject(new Error('ASAR FIFO open blocked'))
    }, 500)
  })
  try {
    await expect(Promise.race([operation, timeout])).rejects.toThrow('regular archive file')
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    await unblock
  }
}

function encodedArchive(files: Record<string, unknown>, body: Buffer = Buffer.alloc(0)): Buffer {
  const json = Buffer.from(JSON.stringify({ files }))
  const headerPicklePayload = Math.ceil((json.length + 4) / 4) * 4
  const padding = Buffer.alloc(headerPicklePayload - json.length - 4)
  const prefix = Buffer.alloc(16)
  prefix.writeUInt32LE(4, 0)
  prefix.writeUInt32LE(headerPicklePayload + 4, 4)
  prefix.writeUInt32LE(headerPicklePayload, 8)
  prefix.writeUInt32LE(json.length, 12)
  return Buffer.concat([prefix, json, padding, body])
}

function oneFile(path: string, body: Buffer, overrides: Record<string, unknown> = {}): Buffer {
  const parts = path.split('/')
  let files: Record<string, unknown> = {
    [parts.pop()!]: {
      size: body.length,
      offset: '0',
      integrity: { algorithm: 'SHA256', hash: createHash('sha256').update(body).digest('hex') },
      ...overrides,
    },
  }
  while (parts.length > 0) files = { [parts.pop()!]: { files } }
  return encodedArchive(files, body)
}

function fakeStats(size: number, revision = 1n) {
  return {
    dev: 1n,
    ino: 2n,
    size: BigInt(size),
    mtimeNs: revision,
    ctimeNs: revision,
    isFile: () => true,
  }
}

function fakeFile(bytes: Buffer, revisions: readonly bigint[]) {
  let statCall = 0
  return {
    stat: vi.fn(async () => fakeStats(bytes.length, revisions[statCall++] ?? revisions.at(-1))),
    read: vi.fn(async (buffer: Buffer, offset: number, length: number, position: number) => {
      const bytesRead = bytes.copy(buffer, offset, position, position + length)
      return { buffer, bytesRead }
    }),
    close: vi.fn(async () => undefined),
  }
}

describe('ASAR reader', () => {
  it('indexes nested packed members, skips unpacked members, and reads exact bytes', async () => {
    const path = await temporaryPath()
    const body = Buffer.from('atlas')
    await writeFile(path, encodedArchive({
      webview: { files: { assets: { files: {
        'codex-spritesheet-v6-HASH.webp': {
          size: body.length,
          offset: '0',
          integrity: { algorithm: 'SHA256', hash: createHash('sha256').update(body).digest('hex') },
        },
        'native.node': { unpacked: true, size: 1 },
      } } } },
    }, body))
    const index = await readAsarIndex(path)
    expect(index.contentOffset).toBeLessThan(index.archiveSize)
    expect([...index.entries.keys()]).toEqual(['webview/assets/codex-spritesheet-v6-HASH.webp'])
    const entry = index.entries.values().next().value!
    expect(entry.integrityHash).toBe(createHash('sha256').update(body).digest('hex'))
    expect(await readAsarEntry(index, entry)).toEqual(body)
    await expect(readAsarEntry(index, { ...entry })).rejects.toThrow('does not belong')
  })

  it('accepts pickle padding after a JSON header that is not four-byte aligned', async () => {
    const path = await temporaryPath()
    const body = Buffer.from('atlas')
    const bytes = encodedArchive({ xxxx: { size: body.length, offset: '0' } }, body)
    expect(bytes.readUInt32LE(12) % 4).toBe(2)
    expect(bytes.readUInt32LE(8) - bytes.readUInt32LE(12)).toBe(6)
    await writeFile(path, bytes)

    const index = await readAsarIndex(path)
    expect(await readAsarEntry(index, index.entries.get('xxxx')!)).toEqual(body)
  })

  it('discovers fuzzy hashed names per id and ignores missing ids', async () => {
    const path = await temporaryPath()
    const body = Buffer.from('x')
    await writeFile(path, encodedArchive({
      z: { size: 0, offset: '0' },
      webview: { files: { assets: { files: {
        'null-signal-spritesheet-v7-Ab_9.webp': {
          size: body.length,
          offset: '0',
          integrity: { algorithm: 'SHA256', hash: createHash('sha256').update(body).digest('hex') },
        },
      } } } },
    }, body))
    const found = await discoverCodexBuiltinAssets(['null-signal', 'codex'], path)
    expect([...found.keys()]).toEqual(['null-signal'])
    expect(found.get('null-signal')?.entry.path).toContain('null-signal-spritesheet')
    await expect(discoverCodexBuiltinAssets(['codex'], join(dirname(path), 'missing.asar'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects stale member ranges after an archive is truncated', async () => {
    const path = await temporaryPath()
    await writeFile(path, oneFile('a', Buffer.from('body')))
    const index = await readAsarIndex(path)
    const entry = index.entries.get('a')!
    await truncate(path, entry.offset + entry.size - 1)
    await expect(readAsarEntry(index, entry)).rejects.toThrow('no longer available')
  })

  it.skipIf(process.platform === 'win32')('rejects a FIFO archive without blocking in open', async () => {
    const path = await temporaryPath()
    await execFileAsync('mkfifo', [path])

    await expectFastFifoRejection(readAsarIndex(path), path)
  })

  it.skipIf(process.platform === 'win32')('rejects a FIFO that replaces an indexed archive without blocking in open', async () => {
    const path = await temporaryPath()
    const original = join(dirname(path), 'original.asar')
    await writeFile(path, oneFile('a', Buffer.from('body')))
    const index = await readAsarIndex(path)
    const entry = index.entries.get('a')!
    await rename(path, original)
    await execFileAsync('mkfifo', [path])

    await expectFastFifoRejection(readAsarEntry(index, entry), path)
  })

  it('rejects a same-size archive replacement instead of using stale offsets', async () => {
    const path = await temporaryPath()
    const replacement = join(dirname(path), 'replacement.asar')
    await writeFile(path, oneFile('a', Buffer.from('body')))
    const index = await readAsarIndex(path)
    const entry = index.entries.get('a')!
    await writeFile(replacement, oneFile('a', Buffer.from('evil')))
    await rename(replacement, path)

    await expect(readAsarEntry(index, entry)).rejects.toThrow('changed since its index')
  })

  it('rejects member bytes that do not match the ASAR integrity hash', async () => {
    const path = await temporaryPath()
    await writeFile(path, oneFile('a', Buffer.from('body'), {
      integrity: { algorithm: 'SHA256', hash: 'a'.repeat(64) },
    }))
    const index = await readAsarIndex(path)

    await expect(readAsarEntry(index, index.entries.get('a')!)).rejects.toThrow('SHA-256 integrity')
  })

  it('rejects an archive revision that changes during index parsing', async () => {
    const bytes = encodedArchive({})
    const file = fakeFile(bytes, [1n, 2n])
    fileSystemMocks.open.mockResolvedValueOnce(file)

    await expect(readAsarIndex('/virtual/app.asar')).rejects.toThrow('changed while its index')
    expect(file.close).toHaveBeenCalledOnce()
  })

  it('rejects an archive revision that changes during a member read', async () => {
    const bytes = Buffer.from('body')
    const file = fakeFile(bytes, [1n, 2n])
    fileSystemMocks.open.mockResolvedValueOnce(file)
    const entry = { path: 'a', size: bytes.length, offset: 0 }
    const index = {
      archivePath: '/virtual/app.asar',
      archiveSize: bytes.length,
      archiveRevision: `1:2:${String(bytes.length)}:1:1`,
      contentOffset: 0,
      entries: new Map([['a', entry]]),
    }

    await expect(readAsarEntry(index, entry)).rejects.toThrow('changed while its member')
    expect(file.close).toHaveBeenCalledOnce()
  })

  it('builds the conventional Windows installation path', () => {
    expect(windowsCodexAppAsarPath('C:\\Users\\u\\AppData\\Local')).toContain(join('Programs', 'ChatGPT', 'resources', 'app.asar'))
  })

  it.each([
    ['too short', Buffer.alloc(8), 'regular archive'],
    ['bad outer pickle', (() => { const b = encodedArchive({}); b.writeUInt32LE(3, 0); return b })(), 'pickle lengths'],
    ['bad header size', (() => { const b = encodedArchive({}); b.writeUInt32LE(99, 4); return b })(), 'pickle lengths'],
    ['bad inner pickle', (() => { const b = encodedArchive({}); b.writeUInt32LE(99, 8); return b })(), 'pickle lengths'],
    ['missing pickle padding', (() => { const b = encodedArchive({ xxxx: { size: 0, offset: '0' } }); const jsonSize = b.readUInt32LE(12); b.writeUInt32LE(jsonSize + 8, 4); b.writeUInt32LE(jsonSize + 4, 8); return b })(), 'pickle lengths'],
    ['zero JSON', (() => { const b = Buffer.alloc(16); b.writeUInt32LE(4, 0); b.writeUInt32LE(8, 4); b.writeUInt32LE(4, 8); return b })(), 'between 1'],
    ['huge JSON', (() => { const b = Buffer.alloc(16); b.writeUInt32LE(4, 0); b.writeUInt32LE(MAX_ASAR_HEADER_BYTES + 12, 4); b.writeUInt32LE(MAX_ASAR_HEADER_BYTES + 8, 8); b.writeUInt32LE(MAX_ASAR_HEADER_BYTES + 1, 12); return b })(), 'between 1'],
    ['header beyond file', (() => { const b = Buffer.alloc(16); b.writeUInt32LE(4, 0); b.writeUInt32LE(108, 4); b.writeUInt32LE(104, 8); b.writeUInt32LE(100, 12); return b })(), 'beyond'],
    ['invalid JSON', (() => { const b = encodedArchive({}); b[16] = 0xff; return b })(), 'JSON header is invalid'],
    ['missing files map', (() => { const json = Buffer.from('{}'); const payload = Math.ceil((json.length + 4) / 4) * 4; const p = Buffer.alloc(16); p.writeUInt32LE(4, 0); p.writeUInt32LE(payload + 4, 4); p.writeUInt32LE(payload, 8); p.writeUInt32LE(json.length, 12); return Buffer.concat([p, json, Buffer.alloc(payload - json.length - 4)]) })(), 'no files map'],
  ])('rejects an invalid archive header: %s', async (_name, bytes, message) => {
    const path = await temporaryPath()
    await writeFile(path, bytes)
    await expect(readAsarIndex(path)).rejects.toThrow(message)
  })

  it.each([
    ['invalid member', { a: 1 }, 'invalid record'],
    ['invalid directory', { a: { files: 1 } }, 'invalid files map'],
    ['missing size', { a: { offset: '0' } }, 'size'],
    ['negative size', { a: { size: -1, offset: '0' } }, 'size'],
    ['fractional size', { a: { size: 1.2, offset: '0' } }, 'size'],
    ['numeric offset', { a: { size: 0, offset: 0 } }, 'decimal string'],
    ['bad offset', { a: { size: 0, offset: 'x' } }, 'decimal string'],
    ['unsafe offset', { a: { size: 0, offset: '99999999999999999999' } }, 'safe integer'],
    ['range beyond archive', { a: { size: 10, offset: '0' } }, 'escapes'],
  ])('rejects malformed file nodes: %s', async (_name, files, message) => {
    const path = await temporaryPath()
    await writeFile(path, encodedArchive(files))
    await expect(readAsarIndex(path)).rejects.toThrow(message)
  })

  it('omits malformed optional integrity metadata', async () => {
    const path = await temporaryPath()
    await writeFile(path, oneFile('a', Buffer.alloc(0), { integrity: { algorithm: 'MD5', hash: 1 } }))
    const index = await readAsarIndex(path)
    expect(index.entries.get('a')?.integrityHash).toBeUndefined()
  })
})
