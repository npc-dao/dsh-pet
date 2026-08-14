/** Session-aware adapter from DSH snapshots and durable settings to the pet overlay. */
import type { ReactNode } from 'react';
import type { SettingsScopeSnapshot, SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { HostObservable, InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type PetSettings } from '../pet-settings.ts';
import type { PetCatalogState } from './catalog-store.ts';
/** Registration-side observable inputs for the overlay entry. */
export interface PetOverlaySlotInjected {
    hooks: {
        /** Host catalog transport state. */
        petCatalog: SnapshotStore<PetCatalogState>;
        /** Durable namespace state. */
        petSettings: HostObservable<SettingsScopeSnapshot<PetSettings>>;
        /** Browser motion preference. */
        reducedMotion: SnapshotStore<boolean>;
    };
}
/** Full component props synthesized by the session-maybe slot outlet. */
export type PetOverlaySlotProps = PropsRuntime<'shell.overlay.pet'> & InjectFace<PetOverlaySlotInjected>;
/**
 * Select the effective available pet and render it over the Web frame.
 * @param props - runtime snapshot hooks supplied by the slot renderer.
 * @returns the pet overlay, or null until an enabled atlas is available.
 */
export declare function PetOverlaySlot({ usePetCatalog, usePetSettings, useReducedMotion, useSession, useSessions, }: PetOverlaySlotProps): ReactNode;
//# sourceMappingURL=PetOverlaySlot.d.ts.map