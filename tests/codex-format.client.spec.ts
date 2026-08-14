import { mkdir, mkdtemp, open, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_PET_ASSET_BYTES,
  MAX_PET_MANIFEST_BYTES,
  parseCodexPetManifest,
  readCodexPetAsset,
  scanCodexPets,
  validatePetImage,
} from '../src/codex-format.ts'

const fileSystemMocks = vi.hoisted(() => ({ open: vi.fn() }))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  fileSystemMocks.open.mockImplementation(actual.open)
  return { ...actual, open: fileSystemMocks.open }
})

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pet-format-'))
  roots.push(root)
  return root
}

function pngHeader(width: number, height: number): Buffer {
  const body = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(body)
  body.writeUInt32BE(13, 8)
  body.write('IHDR', 12, 'ascii')
  body.writeUInt32BE(width, 16)
  body.writeUInt32BE(height, 20)
  return body
}

const PNG_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  return crc >>> 0
})

function apngChunk(type: string, data: Buffer): Buffer {
  const typeBytes = Buffer.from(type, 'ascii')
  let crc = 0xffffffff
  for (const byte of Buffer.concat([typeBytes, data])) {
    crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([length, typeBytes, data, checksum])
}

function animatedPng(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const animation = Buffer.alloc(8)
  animation.writeUInt32BE(2)
  const frameControl = (sequence: number): Buffer => {
    const control = Buffer.alloc(26)
    control.writeUInt32BE(sequence)
    control.writeUInt32BE(width, 4)
    control.writeUInt32BE(height, 8)
    control.writeUInt16BE(1, 20)
    control.writeUInt16BE(10, 22)
    return control
  }
  const scanlines = Buffer.alloc((width * 4 + 1) * height)
  const first = deflateSync(scanlines)
  scanlines[1] = 255
  const second = deflateSync(scanlines)
  const frameData = Buffer.alloc(second.length + 4)
  frameData.writeUInt32BE(2)
  second.copy(frameData, 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    apngChunk('IHDR', ihdr),
    apngChunk('acTL', animation),
    apngChunk('fcTL', frameControl(0)),
    apngChunk('IDAT', first),
    apngChunk('fcTL', frameControl(1)),
    apngChunk('fdAT', frameData),
    apngChunk('IEND', Buffer.alloc(0)),
  ])
}

async function animatedWebp(width: number, height: number): Promise<Buffer> {
  const channels = 4
  const frameBytes = width * height * channels
  const pixels = Buffer.alloc(frameBytes * 2)
  pixels.fill(16, 0, frameBytes)
  pixels.fill(192, frameBytes)
  for (let alpha = 3; alpha < pixels.length; alpha += channels) pixels[alpha] = 255
  return await sharp(pixels, {
    raw: { width, height: height * 2, channels, pageHeight: height },
  }).webp({ lossless: true, effort: 0, loop: 0, delay: [100, 100] }).toBuffer()
}

const rasters = new Map<string, Promise<Buffer>>()

function raster(format: 'jpeg' | 'png' | 'webp', width: number, height: number): Promise<Buffer> {
  const key = `${format}:${String(width)}x${String(height)}`
  let body = rasters.get(key)
  if (body === undefined) {
    const image = sharp({
      create: { width, height, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0 } },
    })
    body = format === 'png'
      ? image.png().toBuffer()
      : format === 'webp' ? image.webp({ lossless: true, effort: 0 }).toBuffer() : image.jpeg().toBuffer()
    rasters.set(key, body)
  }
  return body
}

async function writePet(
  root: string, collection: 'pets' | 'avatars', name: string, manifest: unknown, image?: Buffer,
): Promise<string> {
  const directory = join(root, collection, name)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, collection === 'pets' ? 'pet.json' : 'avatar.json'), JSON.stringify(manifest))
  await writeFile(join(directory, 'spritesheet.webp'), image ?? await raster('png', 1536, 1872))
  return directory
}

describe('Codex manifest and image format', () => {
  it('applies exact optional-field defaults and trims supplied values', () => {
    expect(parseCodexPetManifest({})).toEqual({
      description: null,
      spriteVersionNumber: 1,
      spritesheetPath: 'spritesheet.webp',
    })
    expect(parseCodexPetManifest({
      id: ' id ', displayName: ' Pet ', description: ' hello ',
      spriteVersionNumber: 2, spritesheetPath: ' atlas.png ', ignored: true,
    })).toEqual({
      id: 'id', displayName: 'Pet', description: 'hello',
      spriteVersionNumber: 2, spritesheetPath: 'atlas.png',
    })
    expect(parseCodexPetManifest({ description: '  ', id: undefined, displayName: undefined })).toMatchObject({ description: null })
  })

  it.each([
    [null, 'object'],
    [{ id: '' }, 'id'],
    [{ displayName: 1 }, 'displayName'],
    [{ description: 1 }, 'description'],
    [{ spriteVersionNumber: null }, 'spriteVersionNumber'],
    [{ spriteVersionNumber: 3 }, 'spriteVersionNumber'],
    [{ spritesheetPath: ' ' }, 'spritesheetPath'],
  ])('rejects malformed manifest value %#', (value, message) => {
    expect(() => parseCodexPetManifest(value)).toThrow(message)
  })

  it('fully decodes real PNG and WebP atlases for both Codex layouts', async () => {
    await expect(validatePetImage(await raster('png', 1536, 1872), 1)).resolves.toBe('image/png')
    await expect(validatePetImage(await raster('webp', 1536, 1872), 1)).resolves.toBe('image/webp')
    await expect(validatePetImage(await raster('png', 1536, 2288), 2)).resolves.toBe('image/png')
    await expect(validatePetImage(await raster('webp', 1536, 2288), 2)).resolves.toBe('image/webp')
  })

  it('rejects headers without complete pixels, truncated pixels, unsupported formats, and wrong dimensions', async () => {
    await expect(validatePetImage(pngHeader(1536, 1872), 1)).rejects.toThrow('complete PNG or WebP')
    const complete = await raster('png', 1536, 1872)
    const truncated = complete.subarray(0, 62)
    await expect(sharp(truncated).metadata()).resolves.toMatchObject({ format: 'png', width: 1536, height: 1872 })
    await expect(validatePetImage(truncated, 1)).rejects.toThrow('complete PNG or WebP')
    await expect(validatePetImage(await raster('jpeg', 1536, 1872), 1)).rejects.toThrow('complete PNG or WebP')
    await expect(validatePetImage(await raster('png', 1, 1), 1)).rejects.toThrow('1536x1872')
    await expect(validatePetImage(Buffer.alloc(MAX_PET_ASSET_BYTES + 1), 1)).rejects.toThrow('exceeds')
  })

  it('rejects animated PNG and WebP inputs instead of decoding only their first frame', async () => {
    await expect(validatePetImage(animatedPng(1536, 1872), 1)).rejects.toThrow('static PNG or WebP')
    const webp = await animatedWebp(1536, 1872)
    await expect(sharp(webp).metadata()).resolves.toMatchObject({ pages: 2, width: 1536, height: 1872 })
    await expect(validatePetImage(webp, 1)).rejects.toThrow('static PNG or WebP')
  })
})

describe('Codex home scanning', () => {
  it('merges legacy avatars and modern pets with modern precedence and Codex fallbacks', async () => {
    const root = await temporaryRoot()
    await writePet(root, 'avatars', 'same', { id: 'Legacy', displayName: 'Old', description: null })
    await writePet(root, 'pets', 'same', { id: 'Modern', displayName: ' New ' })
    await writePet(root, 'avatars', 'by-id', { id: ' Manifest Id ' })
    await writePet(root, 'pets', 'by-dir', {})
    await writeFile(join(root, 'pets', 'not-a-directory'), 'ignored')

    const pets = await scanCodexPets(root)
    expect(pets.map(pet => [pet.id, pet.displayName, pet.description, pet.contentType])).toEqual([
      ['custom:by-dir', 'by-dir', null, 'image/png'],
      ['custom:by-id', 'Manifest Id', null, 'image/png'],
      ['custom:same', 'New', null, 'image/png'],
    ])
    expect(pets[2]?.assetPath).toMatch(/\/pets\/same\/spritesheet\.webp$/)
    expect(pets[2]?.size).toBe((await raster('png', 1536, 1872)).length)
  })

  it('returns no entries when both compatibility roots are absent', async () => {
    expect(await scanCodexPets(await temporaryRoot())).toEqual([])
  })

  it('accepts an exact-limit manifest and omits a manifest one byte over the limit', async () => {
    const root = await temporaryRoot()
    const exact = await writePet(root, 'pets', 'exact', {})
    const oversized = await writePet(root, 'pets', 'oversized-manifest', {})
    const prefix = '{"displayName":"'
    const suffix = '"}'
    const manifest = prefix + 'x'.repeat(MAX_PET_MANIFEST_BYTES - Buffer.byteLength(prefix + suffix)) + suffix
    expect(Buffer.byteLength(manifest)).toBe(MAX_PET_MANIFEST_BYTES)
    await writeFile(join(exact, 'pet.json'), manifest)
    await writeFile(join(oversized, 'pet.json'), `${manifest} `)

    expect((await scanCodexPets(root)).map(pet => pet.id)).toEqual(['custom:exact'])
  })

  it('omits a package whose opened manifest grows after its descriptor stat', async () => {
    const root = await temporaryRoot()
    await writePet(root, 'pets', 'changing', {})
    const changingHandle = {
      stat: vi.fn(async () => ({ isFile: () => true, size: 2 })),
      read: vi.fn(async (buffer: Buffer) => {
        buffer.write('{} ', 0, 'utf8')
        return { buffer, bytesRead: 3 }
      }),
      close: vi.fn(async () => undefined),
    }
    fileSystemMocks.open.mockResolvedValueOnce(changingHandle)

    expect(await scanCodexPets(root)).toEqual([])
    expect(changingHandle.close).toHaveBeenCalledOnce()
  })

  it('omits independently malformed, escaping, unsupported, and oversized packages', async () => {
    const root = await temporaryRoot()
    await writePet(root, 'pets', 'good', {})
    const invalidJson = await writePet(root, 'pets', 'invalid-json', {})
    await writeFile(join(invalidJson, 'pet.json'), '{')
    const manifestLink = await writePet(root, 'pets', 'manifest-link', {})
    await rm(join(manifestLink, 'pet.json'))
    await writeFile(join(root, 'outside-manifest.json'), '{}')
    await symlink(join(root, 'outside-manifest.json'), join(manifestLink, 'pet.json'))
    await writePet(root, 'pets', 'bad-dimensions', {}, await raster('png', 1, 1))
    await writePet(root, 'pets', 'traversal', { spritesheetPath: '../outside.png' })
    await writeFile(join(root, 'pets', 'outside.png'), await raster('png', 1536, 1872))
    const link = await writePet(root, 'pets', 'link-out', { spritesheetPath: 'link.png' })
    await writeFile(join(root, 'outside.png'), await raster('png', 1536, 1872))
    await symlink(join(root, 'outside.png'), join(link, 'link.png'))
    const invalidUtf8 = await writePet(root, 'pets', 'invalid-utf8', {})
    await writeFile(join(invalidUtf8, 'pet.json'), Buffer.concat([
      Buffer.from('{"displayName":"'), Buffer.from([0xff]), Buffer.from('"}'),
    ]))
    const oversized = await writePet(root, 'pets', 'oversized', {})
    const handle = await open(join(oversized, 'spritesheet.webp'), 'r+')
    await handle.truncate(MAX_PET_ASSET_BYTES + 1)
    await handle.close()
    await symlink(join(root, 'pets', 'good'), join(root, 'pets', 'directory-link'))

    expect((await scanCodexPets(root)).map(pet => pet.id)).toEqual(['custom:good'])
  })

  it('opens and retains the resolved target of an in-directory atlas symlink', async () => {
    const root = await temporaryRoot()
    const directory = await writePet(root, 'pets', 'linked', { spritesheetPath: 'atlas-link.webp' })
    const linkPath = join(directory, 'atlas-link.webp')
    const targetPath = join(directory, 'spritesheet.webp')
    await symlink(targetPath, linkPath)

    const pet = (await scanCodexPets(root))[0]!
    expect(pet.assetPath).toBe(await realpath(targetPath))
    await rm(linkPath)
    await writeFile(join(root, 'outside.png'), await raster('png', 1536, 1872))
    await symlink(join(root, 'outside.png'), linkPath)
    await expect(readCodexPetAsset(pet)).resolves.toMatchObject({ contentType: 'image/png' })
  })

  it('propagates a collection-level filesystem error', async () => {
    const root = await temporaryRoot()
    await writeFile(join(root, 'pets'), 'not a directory')
    await expect(scanCodexPets(root)).rejects.toThrow()
  })

  it('propagates a non-absence root resolution error', async () => {
    const root = await temporaryRoot()
    await symlink(join(root, 'pets'), join(root, 'pets'))
    await expect(scanCodexPets(root)).rejects.toThrow()
  })

  it('revalidates a cataloged atlas and detects replacement outside its directory', async () => {
    const root = await temporaryRoot()
    const directory = await writePet(root, 'pets', 'safe', {})
    const pet = (await scanCodexPets(root))[0]!
    const asset = await readCodexPetAsset(pet)
    expect(asset.contentType).toBe('image/png')
    expect(asset.sha256).toMatch(/^[a-f\d]{64}$/)

    const changed = await sharp({
      create: { width: 1536, height: 1872, channels: 4, background: { r: 9, g: 8, b: 7, alpha: 1 } },
    }).png().toBuffer()
    await writeFile(join(directory, 'spritesheet.webp'), changed)
    await expect(readCodexPetAsset(pet)).rejects.toThrow('changed since the catalog refresh')
    await writeFile(join(directory, 'spritesheet.webp'), await raster('png', 1536, 1872))

    await expect(readCodexPetAsset({ ...pet, assetPath: directory })).rejects.toThrow()
    await expect(readCodexPetAsset({ ...pet, directoryPath: root })).rejects.toThrow('pets root')

    await rm(join(directory, 'spritesheet.webp'))
    await writeFile(join(root, 'outside.png'), await raster('png', 1536, 1872))
    await symlink(join(root, 'outside.png'), join(directory, 'spritesheet.webp'))
    await expect(readCodexPetAsset(pet)).rejects.toThrow('outside')
  })
})
