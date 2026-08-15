/** Browser registration for the DSH Web pet and its settings page. */

import { PetCatalogController } from './catalog-store.ts'
import { en, NS, zh, type PetKey } from './locales.ts'
import { PetOverlayRoot } from './PetOverlayRoot.tsx'
import { PetOverlaySlot, type PetOverlaySlotInjected } from './PetOverlaySlot.tsx'
import { PetsSettingsSlot, type PetsSettingsSlotInjected } from './PetsSettingsSlot.tsx'
import { createReducedMotionStore } from './reduced-motion-store.ts'
import type { ClientContext } from './runtime-types.ts'
import {
  PET_SETTINGS_NAMESPACE, type PetSettings,
} from '../pet-settings.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Session-aware occupant rendered through the root pet overlay entry. */
    'shell.overlay.pet': { kind: 'single'; scope: 'session-maybe'; owner: PetOverlayOwnerProps }
  }
  interface LocaleNamespaceMap {
    /** Pet overlay and settings copy. */
    pet: PetKey
  }
}

/** Owner props for the package-internal pet slot. */
export interface PetOverlayOwnerProps {
  /** Marker field: the child seat has no owner-supplied business props. */
  children?: never
}

/** Required services for catalog transport, durable settings, and both slots. */
export const inject = [
  'slots', 'sessions', 'locale', 'connection', 'remote', 'settingsScope',
]

/**
 * Register the frame overlay and Pets settings section.
 * @param ctx - browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-pet: copy dictionaries')
  const catalog = new PetCatalogController()
  const settings = ctx.settingsScope.bind<PetSettings>({ namespace: PET_SETTINGS_NAMESPACE })
  const reducedMotion = createReducedMotionStore(
    (installer, label) => { ctx.effect(installer, label) },
  )
  ctx.effect(() => {
    void catalog.load()
    const reset = ctx.on('connection/reset', () => { void catalog.load() })
    return async () => {
      reset()
      await catalog.dispose()
    }
  }, 'dsh-pet: catalog lifecycle')

  const overlayInjected = (): PetOverlaySlotInjected => ({
    hooks: {
      petCatalog: catalog.store,
      petSettings: settings,
      reducedMotion,
    },
  })
  const sectionInjected = (): PetsSettingsSlotInjected => ({
    hooks: { petCatalog: catalog.store, petSettings: settings },
    refresh: () => catalog.refresh(),
    set: (field, value) => settings.set(field, value),
  })
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('shell.overlay', function* () {
    yield ctx.slots.register({
      name: 'shell.overlay',
      id: 'pet',
      order: 100,
      children: {
        'shell.overlay.pet': { kind: 'single', scope: 'session-maybe' },
      },
    }, PetOverlayRoot)
    yield ctx.slots.register({
      name: 'shell.overlay.pet',
      inject: overlayInjected,
    }, PetOverlaySlot)
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'pets',
    order: 30,
    label: () => t('nav'),
    locale: NS,
    inject: sectionInjected,
  }, PetsSettingsSlot))
}
