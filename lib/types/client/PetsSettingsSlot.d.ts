/** Slot adapter joining catalog and settings observables for the Pets page. */
import type { ReactNode } from 'react';
import type { SettingsScope, SettingsScopeSnapshot, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { PetSettings } from '../pet-settings.ts';
import { type PetCatalogState } from './catalog-store.ts';
/** Registration-side sources and actions for the Pets settings page. */
export interface PetsSettingsSlotInjected {
    hooks: {
        /** Host catalog transport state. */
        petCatalog: SnapshotStore<PetCatalogState>;
        /** Durable namespace state. */
        petSettings: HostObservable<SettingsScopeSnapshot<PetSettings>>;
    };
    /** Rescan the Codex-compatible catalog. */
    refresh: () => Promise<void>;
    /** Persist one scalar field through the namespace scope. */
    set: SettingsScope<PetSettings>['set'];
}
/** Full component props synthesized by the settings section outlet. */
export type PetsSettingsSlotProps = PropsRuntime<'settings.section'> & PropsLocale<'pet'> & InjectFace<PetsSettingsSlotInjected>;
/**
 * Render the Pets settings page from its two independent Host-backed sources.
 * @param props - catalog/settings hooks, mutations, and localized copy.
 * @returns the complete settings section.
 */
export declare function PetsSettingsSlot({ usePetCatalog, usePetSettings, refresh, set, t, }: PetsSettingsSlotProps): ReactNode;
//# sourceMappingURL=PetsSettingsSlot.d.ts.map