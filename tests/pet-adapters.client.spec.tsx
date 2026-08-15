// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  ConversationSnapshot, SessionListState, SessionSummary, SettingsScopeSnapshot,
} from '../src/client/runtime-types.ts'
import type { PetOverlayProps } from '../src/client/PetOverlay.tsx'
import type { PetsSectionProps } from '../src/client/PetsSection.tsx'

vi.mock('../src/client/PetOverlay.tsx', () => ({
  PetOverlay: ({ descriptor, reducedMotion, size, state }: PetOverlayProps) => (
    <output
      data-testid="pet-overlay"
      data-asset={descriptor.assetPath}
      data-motion={String(reducedMotion)}
      data-size={String(size)}
      data-state={state}
    />
  ),
}))

vi.mock('../src/client/PetsSection.tsx', () => ({
  PetsSection: (props: PetsSectionProps) => (
    <section
      data-testid="pets-section"
      data-enabled={String(props.enabled)}
      data-error={props.error ?? ''}
      data-pets={String(props.catalog.pets.length)}
      data-revision={String(props.catalog.revision)}
      data-selected={props.selectedId}
      data-size={String(props.size)}
      data-status={props.status}
      data-writable={String(props.writable)}
    >
      <span>{props.t('title')}</span>
      <button onClick={() => { void props.refresh() }}>refresh</button>
      <button onClick={() => { void props.select('custom:fox') }}>select</button>
      <button onClick={() => { void props.setEnabled(false) }}>disable</button>
      <button onClick={() => { void props.setSize(144) }}>resize</button>
    </section>
  ),
}))

import { PetOverlayRoot } from '../src/client/PetOverlayRoot.tsx'
import type { PetOverlayRootProps } from '../src/client/PetOverlayRoot.tsx'
import { PetOverlaySlot } from '../src/client/PetOverlaySlot.tsx'
import type { PetOverlaySlotProps } from '../src/client/PetOverlaySlot.tsx'
import { PetsSettingsSlot } from '../src/client/PetsSettingsSlot.tsx'
import type { PetsSettingsSlotProps } from '../src/client/PetsSettingsSlot.tsx'
import { en } from '../src/client/locales.ts'
import type { PetCatalogState } from '../src/client/catalog-store.ts'
import type { PetDescriptor, PetState } from '../src/pet-contract.ts'
import type { PetSettings } from '../src/pet-settings.ts'

afterEach(cleanup)

const PET: PetDescriptor = {
  id: 'codex',
  kind: 'builtin',
  displayName: 'Codex',
  description: 'Companion',
  spriteVersionNumber: 2,
  available: true,
  assetPath: '/dsh-pet/assets/codex',
}

const UNAVAILABLE: PetDescriptor = { ...PET, available: false }

const CUSTOM: PetDescriptor = {
  ...PET,
  id: 'custom:fox',
  kind: 'custom',
  displayName: 'Fox',
  spriteVersionNumber: 1,
  assetPath: '/dsh-pet/assets/custom%3Afox',
}

function catalog(pets: readonly PetDescriptor[] = [PET]): PetCatalogState {
  return { status: 'ready', revision: 12, pets, error: null }
}

function settingsSnapshot(
  value: PetSettings | undefined,
  writable = true,
): SettingsScopeSnapshot<PetSettings> {
  return {
    status: 'ready', value, base: value, user: value, revision: 1, writable, mode: 'host',
  }
}

function summary(values: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: 's1' as never,
    displayTitle: 'Session',
    running: false,
    blank: false,
    updatedAt: 1,
    ...values,
  }
}

function sessionList(row?: SessionSummary): SessionListState {
  return {
    ids: row === undefined ? [] : [row.id],
    byId: row === undefined ? {} : { [row.id]: row },
    current: row?.id,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

function failedConversation(): ConversationSnapshot {
  return {
    sessionId: 's1' as never,
    running: false,
    lastAgentError: 'failed',
    chat: { timeline: { turnOrder: [], turns: new Map() } },
  } as unknown as ConversationSnapshot
}

function overlayProps(options: {
  pets?: readonly PetDescriptor[] | undefined
  settings?: PetSettings | undefined
  reducedMotion?: boolean | undefined
  row?: SessionSummary | undefined
  current?: ConversationSnapshot | undefined
} = {}): PetOverlaySlotProps {
  const catalogState = catalog(options.pets)
  const scope = settingsSnapshot(options.settings)
  const sessions = sessionList(options.row)
  return {
    usePetCatalog: (selector: (value: PetCatalogState) => unknown) => selector(catalogState),
    usePetSettings: (selector: (value: SettingsScopeSnapshot<PetSettings>) => unknown) => selector(scope),
    useReducedMotion: (selector: (value: boolean) => unknown) => selector(options.reducedMotion ?? false),
    useSessions: (selector: (value: SessionListState) => unknown) => selector(sessions),
    useSession: (selector: (value: ConversationSnapshot | undefined) => unknown) => selector(options.current),
  } as unknown as PetOverlaySlotProps
}

describe('pet slot adapters', () => {
  it('dispatches the package-internal session-maybe seat from the root entry', () => {
    const renderSlot = vi.fn(() => <span>pet child</span>)

    render(<PetOverlayRoot {...({ renderSlot } as unknown as PetOverlayRootProps)} />)

    expect(screen.getByText('pet child')).toBeTruthy()
    expect(renderSlot).toHaveBeenCalledWith('shell.overlay.pet', {})
  })

  it('renders nothing while disabled or while every catalog row is unavailable', () => {
    const disabled = render(<PetOverlaySlot {...overlayProps({
      settings: { enabled: false, selectedId: 'codex', size: 112 },
    })} />)
    expect(disabled.container.childElementCount).toBe(0)

    disabled.rerender(<PetOverlaySlot {...overlayProps({
      pets: [UNAVAILABLE],
      settings: { enabled: true, selectedId: 'codex', size: 112 },
    })} />)
    expect(disabled.container.childElementCount).toBe(0)
  })

  it.each<[PetState, SessionSummary | undefined, ConversationSnapshot | undefined]>([
    ['idle', undefined, undefined],
    ['running', summary({ running: true }), undefined],
    ['waiting', summary({ pendingInteraction: 'question' }), undefined],
    ['review', summary({ completed: true }), undefined],
    ['failed', summary(), failedConversation()],
  ])('projects the %s state into the effective pet overlay', (state, row, current) => {
    render(<PetOverlaySlot {...overlayProps({
      settings: state === 'idle'
        ? undefined
        : { enabled: true, selectedId: 'codex', size: 136 },
      reducedMotion: true,
      row,
      current,
    })} />)

    const overlay = screen.getByTestId('pet-overlay')
    expect(overlay.dataset.state).toBe(state)
    expect(overlay.dataset.asset).toBe('/dsh-pet/assets/codex?revision=12')
    expect(overlay.dataset.motion).toBe('true')
    expect(overlay.dataset.size).toBe(state === 'idle' ? '112' : '136')
  })

  it('adapts catalog and default settings, then forwards every settings action', () => {
    const refresh = vi.fn(() => Promise.resolve())
    const set = vi.fn(() => Promise.resolve())
    let catalogState: PetCatalogState = {
      status: 'error', revision: 8, pets: [PET], error: 'offline',
    }
    let scope = settingsSnapshot(undefined, false)
    const props = {
      usePetCatalog: (selector: (value: PetCatalogState) => unknown) => selector(catalogState),
      usePetSettings: (selector: (value: SettingsScopeSnapshot<PetSettings>) => unknown) => selector(scope),
      refresh,
      set,
      t: (key: keyof typeof en) => en[key],
    } as unknown as PetsSettingsSlotProps
    const view = render(<PetsSettingsSlot {...props} />)

    let section = screen.getByTestId('pets-section')
    expect(section.dataset).toMatchObject({
      enabled: 'true', error: 'offline', pets: '1', revision: '8',
      selected: 'codex', size: '112', status: 'error', writable: 'false',
    })
    expect(screen.getByText(en.title)).toBeTruthy()

    catalogState = { status: 'ready', revision: 9, pets: [UNAVAILABLE], error: null }
    view.rerender(<PetsSettingsSlot {...props} />)
    section = screen.getByTestId('pets-section')
    expect(section.dataset.selected).toBe('')

    catalogState = { status: 'ready', revision: 9, pets: [UNAVAILABLE, CUSTOM], error: null }
    scope = settingsSnapshot({ enabled: true, selectedId: 'codex', size: 128 })
    view.rerender(<PetsSettingsSlot {...props} />)
    section = screen.getByTestId('pets-section')
    expect(section.dataset).toMatchObject({ selected: 'custom:fox', size: '128', writable: 'true' })
    expect(set).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'refresh' }))
    fireEvent.click(screen.getByRole('button', { name: 'select' }))
    fireEvent.click(screen.getByRole('button', { name: 'disable' }))
    fireEvent.click(screen.getByRole('button', { name: 'resize' }))
    expect(refresh).toHaveBeenCalledOnce()
    expect(set.mock.calls).toEqual([
      ['selectedId', 'custom:fox'],
      ['enabled', false],
      ['size', 144],
    ])
  })
})
