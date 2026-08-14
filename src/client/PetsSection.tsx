/** Settings page for the DSH pet catalog and Codex-compatible imports. */

import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  PET_PRESETS,
  type PetCatalogSnapshot,
  type PetDescriptor,
} from '../pet-contract.ts'
import { petAssetUrl } from '../pet-endpoints.ts'
import { MAX_PET_SIZE, MIN_PET_SIZE } from '../pet-settings.ts'
import { PetSprite } from './PetSprite.tsx'
import { petLocaleValue, type PetKey } from './locales.ts'
import css from './PetsSection.module.css'

/** Settings values and host-backed mutations consumed by the page. */
export interface PetsSectionProps {
  /** Latest Host catalog, including custom rows and availability. */
  catalog: PetCatalogSnapshot
  /** Browser catalog request lifecycle. */
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Transport or catalog validation failure, otherwise null. */
  error: string | null
  /** Whether this browser scope may persist user settings. */
  writable: boolean
  /** Whether the overlay is visible. */
  enabled: boolean
  /** Effective available selected id, or empty when no atlas can be served. */
  selectedId: string
  /** Durable sprite width in CSS pixels. */
  size: number
  /** Rescan the Host catalog. */
  refresh: () => void | Promise<void>
  /** Persist the selected catalog id. */
  select: (id: string) => void | Promise<void>
  /** Persist overlay visibility. */
  setEnabled: (enabled: boolean) => void | Promise<void>
  /** Persist sprite width. */
  setSize: (size: number) => void | Promise<void>
  /** Active `pet` namespace lookup. */
  t: (key: PetKey) => string
}

function displayPresets(catalog: PetCatalogSnapshot): readonly PetDescriptor[] {
  return PET_PRESETS.map((metadata) => {
    const live = catalog.pets.find(pet => pet.kind === 'builtin' && pet.id === metadata.id)
    return live ?? {
      ...metadata,
      available: false,
    }
  })
}

interface PetGroupProps {
  revision: number
  heading: string
  pets: readonly PetDescriptor[]
  selectedId: string
  select: PetsSectionProps['select']
  t: PetsSectionProps['t']
  writable: boolean
  empty?: string
}

function PetGroup({ heading, pets, revision, selectedId, select, t, writable, empty }: PetGroupProps): ReactNode {
  return (
    <section className={css.group}>
      <h3 className={css.groupHeading}>{heading}</h3>
      {pets.length === 0
        ? <p className={css.empty}>{empty}</p>
        : (
          <ul className={css.cards}>
            {pets.map((pet) => {
              const selected = pet.id === selectedId
              const actionLabel = pet.available
                ? petLocaleValue(t(selected ? 'selectedPet' : 'selectPet'), 'pet', pet.displayName)
                : petLocaleValue(t('unavailablePet'), 'pet', pet.displayName)
              return (
                <li
                  className={`${css.card}${selected ? ` ${css.cardSelected}` : ''}${pet.available ? '' : ` ${css.cardUnavailable}`}`}
                  key={pet.id}
                >
                  <button
                    aria-label={actionLabel}
                    aria-pressed={selected}
                    className={css.cardButton}
                    disabled={!writable || !pet.available || selected}
                    onClick={() => { void select(pet.id) }}
                    type="button"
                  >
                    <span className={css.preview}>
                      {pet.available
                        ? (
                          <PetSprite
                            assetUrl={petAssetUrl(pet.assetPath, revision)}
                            version={pet.spriteVersionNumber}
                            state="idle"
                            reducedMotion
                            hover={false}
                          />
                        )
                        : <span aria-hidden="true" className={css.previewUnavailable}>—</span>}
                    </span>
                    <span className={css.copy}>
                      <span className={css.cardHeading}>
                        <span className={css.petName}>{pet.displayName}</span>
                        {!pet.available && <span className={css.unavailable}>{t('unavailable')}</span>}
                        {selected && <span className={css.selected}>{t('selected')}</span>}
                      </span>
                      <span className={css.description}>{pet.description ?? t('noDescription')}</span>
                      <code className={css.petId}>{pet.id}</code>
                    </span>
                    <span className={css.action}>{t(selected ? 'selected' : pet.available ? 'select' : 'unavailable')}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
    </section>
  )
}

/**
 * Render visibility, size, refresh, and catalog-selection controls.
 * @param props - catalog snapshot, settings values, actions, and locale lookup.
 * @returns the complete pet settings section; pet creation is intentionally absent.
 */
export function PetsSection({
  catalog,
  status,
  error,
  writable,
  enabled,
  selectedId,
  size,
  refresh,
  select,
  setEnabled,
  setSize,
  t,
}: PetsSectionProps): ReactNode {
  const boundedSize = Math.min(MAX_PET_SIZE, Math.max(MIN_PET_SIZE, Math.round(size)))
  const customPets = catalog.pets.filter(pet => pet.kind === 'custom')
  const busy = status === 'loading'
  const initialLoad = catalog.pets.length === 0

  return (
    <div className={css.section} data-catalog-revision={catalog.revision}>
      <div className={css.header}>
        <div>
          <h2 className={css.title}>{t('title')}</h2>
          <p className={css.intro}>{t('intro')}</p>
        </div>
        <Button
          disabled={busy}
          size="sm"
          variant="outline"
          onClick={() => { void refresh() }}
        >
          {busy ? t('refreshing') : t('refresh')}
        </Button>
      </div>

      <p className={css.importHint}>
        {t('importPrefix')}
        {' '}<code>$CODEX_HOME/pets</code>
        {' '}({t('importDefault')} <code>~/.codex/pets</code>)
        {t('importSuffix')}
      </p>

      {(status === 'idle' || (busy && initialLoad))
        && <p className={css.status} role="status">{t('loading')}</p>}
      {status === 'error'
        && <p className={css.error} role="alert">{error ?? t('loadError')}</p>}
      {!writable && <p className={css.status}>{t('readOnly')}</p>}

      <div className={css.controls}>
        <label className={css.toggle}>
          <input
            checked={enabled}
            disabled={!writable}
            onChange={(event) => { void setEnabled(event.currentTarget.checked) }}
            type="checkbox"
          />
          <span>{t('enabled')}</span>
        </label>
        <label className={css.sizeControl}>
          <span className={css.sizeLabel}>
            <span>{t('size')}</span>
            <output>{petLocaleValue(t('pixels'), 'size', String(boundedSize))}</output>
          </span>
          <input
            aria-label={t('size')}
            disabled={!writable}
            max={MAX_PET_SIZE}
            min={MIN_PET_SIZE}
            onChange={(event) => { void setSize(Number(event.currentTarget.value)) }}
            step={1}
            type="range"
            value={boundedSize}
          />
        </label>
      </div>

      <PetGroup
        heading={t('presetGroup')}
        pets={displayPresets(catalog)}
        revision={catalog.revision}
        selectedId={selectedId}
        select={select}
        t={t}
        writable={writable}
      />
      <PetGroup
        empty={t('noCustom')}
        heading={t('customGroup')}
        pets={customPets}
        revision={catalog.revision}
        selectedId={selectedId}
        select={select}
        t={t}
        writable={writable}
      />
    </div>
  )
}
