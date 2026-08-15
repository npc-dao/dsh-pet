import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { createPetCatalog, readBundledPetAsset, resolveCodexHome } from '../src/pet-catalog.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-pet-catalog-'))
  roots.push(root)
  return root
}

const rasters = new Map<string, Promise<Buffer>>()

function png(width: number, height: number): Promise<Buffer> {
  const key = `${String(width)}x${String(height)}`
  let body = rasters.get(key)
  if (body === undefined) {
    body = sharp({
      create: { width, height, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0 } },
    }).png().toBuffer()
    rasters.set(key, body)
  }
  return body
}

async function webp(width: number, height: number): Promise<Buffer> {
  return await sharp({
    create: { width, height, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0 } },
  }).webp({ lossless: true }).toBuffer()
}

function expectOnlyPackagePresetsAvailable(catalog: Awaited<ReturnType<typeof createPetCatalog>>): void {
  const pets = catalog.list().pets
  expect(pets).toHaveLength(11)
  expect(pets[0]).toMatchObject({ id: 'dsh', displayName: '小深', available: true })
  expect(pets[1]).toMatchObject({ id: 'aliang', displayName: '阿良', available: true })
  expect(pets.slice(2).every(pet => pet.kind === 'builtin' && !pet.available)).toBe(true)
}

function asarAssets(assets: Readonly<Record<string, Buffer>>): Buffer {
  let offset = 0
  const files: Record<string, unknown> = {}
  const bodies: Buffer[] = []
  for (const [name, body] of Object.entries(assets)) {
    files[name] = { size: body.length, offset: String(offset) }
    offset += body.length
    bodies.push(body)
  }
  const json = Buffer.from(JSON.stringify({ files: { webview: { files: { assets: { files } } } } }))
  const headerPicklePayload = Math.ceil((json.length + 4) / 4) * 4
  const padding = Buffer.alloc(headerPicklePayload - json.length - 4)
  const prefix = Buffer.alloc(16)
  prefix.writeUInt32LE(4, 0)
  prefix.writeUInt32LE(headerPicklePayload + 4, 4)
  prefix.writeUInt32LE(headerPicklePayload, 8)
  prefix.writeUInt32LE(json.length, 12)
  return Buffer.concat([prefix, json, padding, ...bodies])
}

async function writeCustom(root: string, name: string): Promise<string> {
  const directory = join(root, 'pets', name)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'pet.json'), JSON.stringify({ displayName: 'Mine' }))
  await writeFile(join(directory, 'spritesheet.webp'), await png(1536, 1872))
  return directory
}

describe('PetCatalog', () => {
  it('resolves explicit, environment, and default Codex homes', () => {
    expect(resolveCodexHome('./chosen', { CODEX_HOME: '/ignored' })).toBe(resolve('./chosen'))
    expect(resolveCodexHome(undefined, { CODEX_HOME: '/from-env' })).toBe('/from-env')
    expect(resolveCodexHome(undefined, {})).toBe(join(homedir(), '.codex'))
    expect(resolveCodexHome('  ', { CODEX_HOME: ' ' })).toBe(join(homedir(), '.codex'))
    expect(resolveCodexHome('~/pets-home', {})).toBe(join(homedir(), 'pets-home'))
  })

  it('initializes both package pets before nine unavailable Codex presets', async () => {
    const root = await temporaryRoot()
    const catalog = await createPetCatalog({ codexHome: root, platform: 'linux' })
    expect(catalog.list().revision).toBe(1)
    expectOnlyPackagePresetsAvailable(catalog)
    expect(await catalog.getAsset('dsh')).toMatchObject({ contentType: 'image/webp' })
    expect(await catalog.getAsset('aliang')).toMatchObject({ contentType: 'image/webp' })
    expect(await catalog.getAsset('codex')).toBeUndefined()
    expect(await catalog.getAsset('unknown')).toBeUndefined()
  })

  it('fails loud for an invalid explicit Codex home', async () => {
    const root = await temporaryRoot()
    await expect(createPetCatalog({ codexHome: join(root, 'missing'), platform: 'linux' }))
      .rejects.toMatchObject({ code: 'ENOENT' })
    const file = join(root, 'not-a-directory')
    await writeFile(file, 'x')
    await expect(createPetCatalog({ codexHome: file, platform: 'linux' }))
      .rejects.toThrow('configured Codex home is not a directory')
  })

  it('keeps an absent environment-selected Codex home optional', async () => {
    const root = await temporaryRoot()
    const catalog = await createPetCatalog({
      codexHome: ' ',
      env: { CODEX_HOME: join(root, 'missing') },
      platform: 'linux',
    })
    expectOnlyPackagePresetsAvailable(catalog)
  })

  it('discovers, serves, and refreshes custom packages atomically', async () => {
    const root = await temporaryRoot()
    const catalog = await createPetCatalog({ codexHome: root, platform: 'linux' })
    const directory = await writeCustom(root, 'mine')
    const refreshed = await catalog.refresh()
    expect(refreshed.revision).toBe(2)
    expect(refreshed.pets.at(-1)).toEqual({
      id: 'custom:mine', kind: 'custom', displayName: 'Mine', description: null,
      spriteVersionNumber: 1, available: true, assetPath: '/dsh-pet/assets/custom%3Amine',
    })
    const asset = await catalog.getAsset('custom:mine')
    expect(asset).toMatchObject({ contentType: 'image/png' })
    expect(asset?.body).toEqual(await png(1536, 1872))

    await rm(join(directory, 'spritesheet.webp'))
    await expect(catalog.getAsset('custom:mine')).rejects.toThrow()
  })

  it('publishes no partial generation when a collection-level refresh fails', async () => {
    const root = await temporaryRoot()
    const catalog = await createPetCatalog({ codexHome: root, platform: 'linux' })
    await writeFile(join(root, 'pets'), 'not a directory')
    await expect(catalog.refresh()).rejects.toThrow()
    expect(catalog.list().revision).toBe(1)
  })

  it('dynamically discovers valid built-ins and leaves corrupt siblings unavailable', async () => {
    const root = await temporaryRoot()
    const archive = join(root, 'app.asar')
    await mkdir(join(root, 'home'))
    await writeFile(archive, asarAssets({
      'codex-spritesheet-v6-Hash.webp': await png(1536, 2288),
      'dewey-spritesheet-v5-Hash.webp': Buffer.from('corrupt'),
    }))
    const catalog = await createPetCatalog({ codexHome: join(root, 'home'), appAsarPath: archive })
    expect(catalog.list().pets.find(pet => pet.id === 'codex')?.available).toBe(true)
    expect(catalog.list().pets.find(pet => pet.id === 'dewey')?.available).toBe(false)
    await rm(archive)
    expect(await catalog.getAsset('codex')).toMatchObject({ contentType: 'image/png', body: await png(1536, 2288) })
    expect(await catalog.getAsset('dewey')).toBeUndefined()
  })

  it('fails loud for a missing explicitly configured archive', async () => {
    const root = await temporaryRoot()
    await expect(createPetCatalog({ codexHome: root, appAsarPath: join(root, 'missing.asar') }))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects malformed explicitly configured archives', async () => {
    const root = await temporaryRoot()
    const archive = join(root, 'bad.asar')
    await writeFile(archive, 'bad')
    await expect(createPetCatalog({ codexHome: root, appAsarPath: archive })).rejects.toThrow('ASAR')
  })

  it('degrades malformed auto-discovered Windows archives to unavailable metadata', async () => {
    const root = await temporaryRoot()
    const localAppData = join(root, 'local')
    const archive = join(localAppData, 'Programs', 'ChatGPT', 'resources', 'app.asar')
    await mkdir(join(localAppData, 'Programs', 'ChatGPT', 'resources'), { recursive: true })
    await mkdir(join(root, 'home'))
    await writeFile(archive, 'bad')
    const catalog = await createPetCatalog({
      codexHome: join(root, 'home'),
      platform: 'win32',
      env: { LOCALAPPDATA: localAppData },
    })
    expectOnlyPackagePresetsAvailable(catalog)
  })

  it('supports platforms without an automatic archive candidate', async () => {
    const root = await temporaryRoot()
    const windows = await createPetCatalog({ codexHome: root, platform: 'win32', env: {} })
    expectOnlyPackagePresetsAvailable(windows)
    const linux = await createPetCatalog({ codexHome: root, platform: 'linux', env: {} })
    expectOnlyPackagePresetsAvailable(linux)
  })

  it('uses the conventional macOS archive candidate without requiring it to exist', async () => {
    const root = await temporaryRoot()
    const catalog = await createPetCatalog({ codexHome: root, platform: 'darwin', env: {} })
    expect(catalog.list().pets).toHaveLength(11)
    expect(catalog.list().pets[0]).toMatchObject({ id: 'dsh', displayName: '小深', available: true })
    expect(catalog.list().pets[1]).toMatchObject({ id: 'aliang', displayName: '阿良', available: true })
  })

  it('treats a blank archive override as automatic discovery rather than the working directory', async () => {
    const root = await temporaryRoot()
    const catalog = await createPetCatalog({ codexHome: root, appAsarPath: ' ', platform: 'linux' })
    expectOnlyPackagePresetsAvailable(catalog)
  })
})

describe('readBundledPetAsset', () => {
  it('accepts one complete v2 WebP and computes a strong digest', async () => {
    const root = await temporaryRoot()
    const path = join(root, 'pet.webp')
    await writeFile(path, await webp(1536, 2288))
    const asset = await readBundledPetAsset(pathToFileURL(path), 2)
    expect(asset.contentType).toBe('image/webp')
    expect(asset.body).toEqual(await webp(1536, 2288))
    expect(asset.sha256).toMatch(/^[\da-f]{64}$/)
  })

  it('rejects missing, oversized, and non-WebP package assets', async () => {
    const root = await temporaryRoot()
    await expect(readBundledPetAsset(pathToFileURL(join(root, 'missing.webp')), 2))
      .rejects.toMatchObject({ code: 'ENOENT' })
    const oversized = join(root, 'oversized.webp')
    await writeFile(oversized, Buffer.alloc(20 * 1024 * 1024 + 1))
    await expect(readBundledPetAsset(pathToFileURL(oversized), 2)).rejects.toThrow('size limit')
    const wrongType = join(root, 'pet.png')
    await writeFile(wrongType, await png(1536, 2288))
    await expect(readBundledPetAsset(pathToFileURL(wrongType), 2)).rejects.toThrow('must be WebP')
  })
})
