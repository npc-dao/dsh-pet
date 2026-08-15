/** Slot adapter joining catalog and settings observables for the Pets page. */

import type { ReactNode } from 'react'
import type { PetSettings } from '../pet-settings.ts'
import { DEFAULT_PET_SETTINGS } from '../pet-settings.ts'
import { resolveSelectedPet, type PetCatalogState } from './catalog-store.ts'
import { PetsSection } from './PetsSection.tsx'
import type {
  Observable, SelectorHook, SettingsScope, SettingsScopeSnapshot,
} from './runtime-types.ts'
import type { SnapshotStore } from './snapshot-store.ts'
import type { PetKey } from './locales.ts'

/** Registration-side sources and actions for the Pets settings page. */
export interface PetsSettingsSlotInjected {
  hooks: {
    /** Host catalog transport state. */
    petCatalog: SnapshotStore<PetCatalogState>
    /** Durable namespace state. */
    petSettings: Observable<SettingsScopeSnapshot<PetSettings>>
  }
  /** Rescan the Codex-compatible catalog. */
  refresh: () => Promise<void>
  /** Persist one scalar field through the namespace scope. */
  set: SettingsScope<PetSettings>['set']
}

/** Full component props synthesized by the settings section outlet. */
export interface PetsSettingsSlotProps {
  usePetCatalog: SelectorHook<PetCatalogState>
  usePetSettings: SelectorHook<SettingsScopeSnapshot<PetSettings>>
  refresh: () => Promise<void>
  set: SettingsScope<PetSettings>['set']
  t: (key: PetKey) => string
}

/**
 * Render the Pets settings page from its two independent Host-backed sources.
 * @param props - catalog/settings hooks, mutations, and localized copy.
 * @returns the complete settings section.
 */
export function PetsSettingsSlot({
  usePetCatalog,
  usePetSettings,
  refresh,
  set,
  t,
}: PetsSettingsSlotProps): ReactNode {
  const catalog = usePetCatalog(state => state)
  const settingsScope = usePetSettings(state => state)
  const settings = settingsScope.value ?? DEFAULT_PET_SETTINGS
  const effectiveSelectedId = resolveSelectedPet(catalog.pets, settings.selectedId)?.id ?? ''
  return (
    <PetsSection
      catalog={{ pets: catalog.pets, revision: catalog.revision }}
      enabled={settings.enabled}
      error={catalog.error}
      refresh={refresh}
      select={id => set('selectedId', id)}
      selectedId={effectiveSelectedId}
      setEnabled={enabled => set('enabled', enabled)}
      setSize={size => set('size', size)}
      size={settings.size}
      status={catalog.status}
      t={t}
      writable={settingsScope.writable}
    />
  )
}
