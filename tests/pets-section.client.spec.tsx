// @vitest-environment jsdom
/** PetsSection catalog lifecycle, selection, settings, and read-only behavior. */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PetSpriteProps } from '../src/client/PetSprite.tsx'

vi.mock('../src/client/PetSprite.tsx', () => ({
  PetSprite: ({ assetUrl, version, state, reducedMotion, hover }: PetSpriteProps) => (
    <span
      data-testid="pet-preview"
      data-asset={assetUrl}
      data-version={version}
      data-state={hover ? 'jumping' : state}
      data-motion={reducedMotion ? 'reduced' : 'full'}
    />
  ),
}))

import { PetsSection } from '../src/client/PetsSection.tsx'
import type { PetsSectionProps } from '../src/client/PetsSection.tsx'
import { CODEX_BUILTIN_PETS, DSH_BUILTIN_PET, PET_PRESETS, type PetCatalogSnapshot, type PetDescriptor } from '../src/pet-contract.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const available = (
  source: typeof PET_PRESETS[number],
  overrides: Partial<PetDescriptor> = {},
): PetDescriptor => ({ ...source, available: true, ...overrides })

const CUSTOM: PetDescriptor = {
  id: 'custom:fox',
  kind: 'custom',
  displayName: 'Fox',
  description: null,
  spriteVersionNumber: 1,
  available: true,
  assetPath: '/dsh-pet/assets/custom%3Afox',
}

function mount(options: Partial<PetsSectionProps> = {}) {
  const catalog: PetCatalogSnapshot = options.catalog ?? {
    revision: 7,
    pets: [CUSTOM, available(CODEX_BUILTIN_PETS[0]), available(DSH_BUILTIN_PET)],
  }
  const actions = {
    refresh: vi.fn(),
    select: vi.fn(),
    setEnabled: vi.fn(),
    setSize: vi.fn(),
  }
  const props: PetsSectionProps = {
    catalog,
    status: 'ready',
    error: null,
    writable: true,
    enabled: true,
    selectedId: 'codex',
    size: 112,
    ...actions,
    t: key => en[key],
    ...options,
  }
  const view = render(<PetsSection {...props} />)
  return { ...view, ...actions, props }
}

describe('PetsSection', () => {
  it('shows ten presets plus custom pets, import guidance, and availability', () => {
    const result = mount()

    expect(screen.getByRole('heading', { name: en.presetGroup })).toBeTruthy()
    expect(screen.getByRole('heading', { name: en.customGroup })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /is unavailable$/ })).toHaveLength(8)
    const presetSection = screen.getByRole('heading', { name: en.presetGroup }).closest('section')!
    expect(within(presetSection).getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual([
      'Select 小深', 'Selected: Codex', 'Dewey is unavailable', 'Fireball is unavailable',
      'Hoots is unavailable', 'Rocky is unavailable', 'Seedy is unavailable', 'Stacky is unavailable',
      'BSOD is unavailable', 'Null Signal is unavailable',
    ])
    expect(screen.getByRole('button', { name: 'Select 小深' })).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: 'Selected: Codex' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Dewey is unavailable' })).toHaveProperty('disabled', true)
    expect(screen.getByText(en.noDescription)).toBeTruthy()
    expect(screen.getAllByTestId('pet-preview')).toHaveLength(3)
    expect(screen.getAllByTestId('pet-preview')[0]?.dataset.asset).toBe('/dsh-pet/assets/dsh?revision=7')
    expect(screen.getAllByTestId('pet-preview')[1]?.dataset.asset).toBe('/dsh-pet/assets/codex?revision=7')
    expect(screen.getAllByTestId('pet-preview')[2]?.dataset.asset).toBe('/dsh-pet/assets/custom%3Afox?revision=7')
    expect(screen.getAllByTestId('pet-preview')[0]?.dataset.version).toBe('2')
    expect(screen.getAllByTestId('pet-preview')[0]?.dataset.motion).toBe('reduced')
    fireEvent.click(screen.getByRole('button', { name: 'Select 小深' }))
    expect(result.select).toHaveBeenCalledWith('dsh')
    expect(screen.getByText('$CODEX_HOME/pets').tagName).toBe('CODE')
    expect(screen.getByText('~/.codex/pets').tagName).toBe('CODE')
    expect(result.container.firstElementChild?.getAttribute('data-catalog-revision')).toBe('7')
    expect(screen.queryByRole('button', { name: /create/i })).toBeNull()
  })

  it('persists enablement, size, selection, and refresh through the injected actions', () => {
    const actions = mount({ selectedId: 'not-selected' })

    fireEvent.click(screen.getByRole('checkbox', { name: en.enabled }))
    expect(actions.setEnabled).toHaveBeenCalledWith(false)
    fireEvent.change(screen.getByRole('slider', { name: en.size }), { target: { value: '144' } })
    expect(actions.setSize).toHaveBeenCalledWith(144)
    fireEvent.click(screen.getByRole('button', { name: 'Select Fox' }))
    expect(actions.select).toHaveBeenCalledWith('custom:fox')
    fireEvent.click(screen.getByRole('button', { name: en.refresh }))
    expect(actions.refresh).toHaveBeenCalledOnce()
  })

  it('clamps the displayed size at both supported limits', () => {
    const view = mount({ size: 12 })
    expect(screen.getByRole<HTMLInputElement>('slider').value).toBe('80')
    expect(screen.getByText('80 px')).toBeTruthy()

    view.rerender(<PetsSection {...view.props} size={999} />)
    expect(screen.getByRole<HTMLInputElement>('slider').value).toBe('224')
    expect(screen.getByText('224 px')).toBeTruthy()
  })

  it('shows initial loading and disables refresh while a request is live', () => {
    mount({
      catalog: { revision: 0, pets: [] },
      status: 'loading',
    })
    expect(screen.getByText(en.loading)).toBeTruthy()
    expect(screen.getByRole('button', { name: en.refreshing })).toHaveProperty('disabled', true)
    expect(screen.getByText(en.noCustom)).toBeTruthy()
  })

  it('uses the refresh label for a stale catalog and the loading label while idle', () => {
    const stale = mount({ status: 'loading' })
    expect(screen.queryByText(en.loading)).toBeNull()
    expect(screen.getByRole('button', { name: en.refreshing })).toHaveProperty('disabled', true)
    stale.unmount()

    mount({ status: 'idle' })
    expect(screen.getByText(en.loading)).toBeTruthy()
    expect(screen.getByRole('button', { name: en.refresh })).toHaveProperty('disabled', false)
  })

  it('keeps stale rows visible with transport detail, or a generic error fallback', () => {
    const failed = mount({ status: 'error', error: 'Catalog response was invalid' })
    expect(screen.getByRole('alert').textContent).toBe('Catalog response was invalid')
    expect(screen.getByRole('button', { name: 'Selected: Codex' })).toBeTruthy()
    failed.unmount()

    mount({ status: 'error', error: null })
    expect(screen.getByRole('alert').textContent).toBe(en.loadError)
  })

  it('leaves refresh available but disables every settings mutation when read-only', () => {
    const actions = mount({ writable: false, selectedId: 'not-selected' })
    expect(screen.getByText(en.readOnly)).toBeTruthy()
    expect(screen.getByRole('checkbox')).toHaveProperty('disabled', true)
    expect(screen.getByRole('slider')).toHaveProperty('disabled', true)
    const fox = screen.getByRole('button', { name: 'Select Fox' })
    expect(fox).toHaveProperty('disabled', true)
    fireEvent.click(fox)
    expect(actions.select).not.toHaveBeenCalled()
    const refresh = screen.getByRole('button', { name: en.refresh })
    expect(refresh).toHaveProperty('disabled', false)
    fireEvent.click(refresh)
    expect(actions.refresh).toHaveBeenCalledOnce()
  })

  it('shows an unavailable selected pet without treating it as a selectable action', () => {
    mount({ selectedId: 'dewey' })
    const card = screen.getByRole('button', { name: 'Dewey is unavailable' })
    expect(card.getAttribute('aria-pressed')).toBe('true')
    expect(within(card).getAllByText(en.selected)).toHaveLength(2)
    expect(within(card).getAllByText(en.unavailable).length).toBeGreaterThan(0)
  })
})
