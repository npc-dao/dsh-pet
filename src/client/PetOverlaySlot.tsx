/** Session-aware adapter from DSH snapshots and durable settings to the pet overlay. */

import type { ReactNode } from 'react'
import { petAssetUrl } from '../pet-endpoints.ts'
import { DEFAULT_PET_SETTINGS, type PetSettings } from '../pet-settings.ts'
import type { PetCatalogState } from './catalog-store.ts'
import { resolveSelectedPet } from './catalog-store.ts'
import { PetOverlay } from './PetOverlay.tsx'
import { derivePetState, petStateSignals } from './pet-state.ts'
import type {
  ConversationSnapshot, Observable, SelectorHook, SessionListState, SettingsScopeSnapshot,
} from './runtime-types.ts'
import type { SnapshotStore } from './snapshot-store.ts'

/** Registration-side observable inputs for the overlay entry. */
export interface PetOverlaySlotInjected {
  hooks: {
    /** Host catalog transport state. */
    petCatalog: SnapshotStore<PetCatalogState>
    /** Durable namespace state. */
    petSettings: Observable<SettingsScopeSnapshot<PetSettings>>
    /** Browser motion preference. */
    reducedMotion: SnapshotStore<boolean>
  }
}

/** Full component props synthesized by the session-maybe slot outlet. */
export interface PetOverlaySlotProps {
  usePetCatalog: SelectorHook<PetCatalogState>
  usePetSettings: SelectorHook<SettingsScopeSnapshot<PetSettings>>
  useReducedMotion: SelectorHook<boolean>
  useSession: SelectorHook<ConversationSnapshot | undefined>
  useSessions: SelectorHook<SessionListState>
}

/**
 * Select the effective available pet and render it over the Web frame.
 * @param props - runtime snapshot hooks supplied by the slot renderer.
 * @returns the pet overlay, or null until an enabled atlas is available.
 */
export function PetOverlaySlot({
  usePetCatalog,
  usePetSettings,
  useReducedMotion,
  useSession,
  useSessions,
}: PetOverlaySlotProps): ReactNode {
  const catalog = usePetCatalog(state => state)
  const settings = usePetSettings(state => state.value) ?? DEFAULT_PET_SETTINGS
  const reducedMotion = useReducedMotion(value => value)
  const sessions = useSessions(state => state)
  const current = useSession(snapshot => snapshot)
  const descriptor = resolveSelectedPet(catalog.pets, settings.selectedId)
  if (!settings.enabled || descriptor === undefined) return null
  return (
    <PetOverlay
      descriptor={{
        ...descriptor,
        assetPath: petAssetUrl(descriptor.assetPath, catalog.revision),
      }}
      reducedMotion={reducedMotion}
      size={settings.size}
      state={derivePetState(petStateSignals(sessions, current))}
    />
  )
}
