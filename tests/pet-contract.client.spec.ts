import { describe, expect, it } from 'vitest'
import {
  CODEX_BUILTIN_PETS,
  CODEX_PET_ATLASES,
  CODEX_PET_ATLAS_V1,
  CODEX_PET_ATLAS_V2,
  DSH_BUILTIN_PET,
  PET_PRESETS,
} from '../src/pet-contract.ts'

describe('Codex pet contract', () => {
  it('pins both accepted atlas layouts cell for cell', () => {
    expect(CODEX_PET_ATLAS_V1).toEqual({
      version: 1,
      width: 1536,
      height: 1872,
      cellWidth: 192,
      cellHeight: 208,
      columns: 8,
      rows: 9,
      requiredFramesByRow: [6, 8, 8, 4, 5, 8, 6, 6, 6],
    })
    expect(CODEX_PET_ATLAS_V2).toEqual({
      version: 2,
      width: 1536,
      height: 2288,
      cellWidth: 192,
      cellHeight: 208,
      columns: 8,
      rows: 11,
      requiredFramesByRow: [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8],
    })
    expect(CODEX_PET_ATLASES).toEqual({ 1: CODEX_PET_ATLAS_V1, 2: CODEX_PET_ATLAS_V2 })
    expect(Object.isFrozen(CODEX_PET_ATLAS_V1.requiredFramesByRow)).toBe(true)
    expect(Object.isFrozen(CODEX_PET_ATLAS_V2.requiredFramesByRow)).toBe(true)
  })

  it('publishes the nine Codex identities without claiming live availability', () => {
    expect(CODEX_BUILTIN_PETS).toEqual([
      {
        id: 'codex', kind: 'builtin', displayName: 'Codex',
        description: 'Built-in Codex pet.', spriteVersionNumber: 2,
        assetPath: '/dsh-pet/assets/codex',
      },
      {
        id: 'dewey', kind: 'builtin', displayName: 'Dewey',
        description: 'Built-in Codex pet.', spriteVersionNumber: 2,
        assetPath: '/dsh-pet/assets/dewey',
      },
      {
        id: 'fireball', kind: 'builtin', displayName: 'Fireball',
        description: 'Built-in Codex pet.', spriteVersionNumber: 2,
        assetPath: '/dsh-pet/assets/fireball',
      },
      {
        id: 'hoots', kind: 'builtin', displayName: 'Hoots',
        description: 'Built-in Codex pet.', spriteVersionNumber: 2,
        assetPath: '/dsh-pet/assets/hoots',
      },
      {
        id: 'rocky', kind: 'builtin', displayName: 'Rocky',
        description: 'Built-in Codex pet.', spriteVersionNumber: 2,
        assetPath: '/dsh-pet/assets/rocky',
      },
      {
        id: 'seedy', kind: 'builtin', displayName: 'Seedy',
        description: 'Built-in Codex pet.', spriteVersionNumber: 2,
        assetPath: '/dsh-pet/assets/seedy',
      },
      {
        id: 'stacky', kind: 'builtin', displayName: 'Stacky',
        description: 'Built-in Codex pet.', spriteVersionNumber: 2,
        assetPath: '/dsh-pet/assets/stacky',
      },
      {
        id: 'bsod', kind: 'builtin', displayName: 'BSOD',
        description: 'Built-in Codex pet.', spriteVersionNumber: 2,
        assetPath: '/dsh-pet/assets/bsod',
      },
      {
        id: 'null-signal', kind: 'builtin', displayName: 'Null Signal',
        description: 'Built-in Codex pet.', spriteVersionNumber: 2,
        assetPath: '/dsh-pet/assets/null-signal',
      },
    ])
    expect(CODEX_BUILTIN_PETS.every(pet => !('available' in pet))).toBe(true)
    expect(Object.isFrozen(CODEX_BUILTIN_PETS)).toBe(true)
  })

  it('orders the DSH 小深 preset before the nine Codex presets', () => {
    expect(DSH_BUILTIN_PET).toEqual({
      id: 'dsh', kind: 'builtin', displayName: '小深',
      description: 'A friendly DeepSeek-blue whale companion for DSH.', spriteVersionNumber: 2,
      assetPath: '/dsh-pet/assets/dsh',
    })
    expect(PET_PRESETS).toEqual([DSH_BUILTIN_PET, ...CODEX_BUILTIN_PETS])
    expect(PET_PRESETS.map(pet => pet.id)).toEqual([
      'dsh', 'codex', 'dewey', 'fireball', 'hoots', 'rocky', 'seedy', 'stacky', 'bsod', 'null-signal',
    ])
    expect(Object.isFrozen(PET_PRESETS)).toBe(true)
  })
})
