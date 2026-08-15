/** Slot adapter joining catalog and settings observables for the Pets page. */
import type { ReactNode } from 'react';
import type { PetSettings } from '../pet-settings.ts';
import { type PetCatalogState } from './catalog-store.ts';
import type { Observable, SelectorHook, SettingsScope, SettingsScopeSnapshot } from './runtime-types.ts';
import type { SnapshotStore } from './snapshot-store.ts';
import type { PetKey } from './locales.ts';
/** Registration-side sources and actions for the Pets settings page. */
export interface PetsSettingsSlotInjected {
    hooks: {
        /** Host catalog transport state. */
        petCatalog: SnapshotStore<PetCatalogState>;
        /** Durable namespace state. */
        petSettings: Observable<SettingsScopeSnapshot<PetSettings>>;
    };
    /** Rescan the Codex-compatible catalog. */
    refresh: () => Promise<void>;
    /** Persist one scalar field through the namespace scope. */
    set: SettingsScope<PetSettings>['set'];
}
/** Full component props synthesized by the settings section outlet. */
export interface PetsSettingsSlotProps {
    usePetCatalog: SelectorHook<PetCatalogState>;
    usePetSettings: SelectorHook<SettingsScopeSnapshot<PetSettings>>;
    refresh: () => Promise<void>;
    set: SettingsScope<PetSettings>['set'];
    t: (key: PetKey) => string;
}
/**
 * Render the Pets settings page from its two independent Host-backed sources.
 * @param props - catalog/settings hooks, mutations, and localized copy.
 * @returns the complete settings section.
 */
export declare function PetsSettingsSlot({ usePetCatalog, usePetSettings, refresh, set, t, }: PetsSettingsSlotProps): ReactNode;
