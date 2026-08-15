/** Settings page for the DSH pet catalog and Codex-compatible imports. */
import type { ReactNode } from 'react';
import { type PetCatalogSnapshot } from '../pet-contract.ts';
import { type PetKey } from './locales.ts';
/** Settings values and host-backed mutations consumed by the page. */
export interface PetsSectionProps {
    /** Latest Host catalog, including custom rows and availability. */
    catalog: PetCatalogSnapshot;
    /** Browser catalog request lifecycle. */
    status: 'idle' | 'loading' | 'ready' | 'error';
    /** Transport or catalog validation failure, otherwise null. */
    error: string | null;
    /** Whether this browser scope may persist user settings. */
    writable: boolean;
    /** Whether the overlay is visible. */
    enabled: boolean;
    /** Effective available selected id, or empty when no atlas can be served. */
    selectedId: string;
    /** Durable sprite width in CSS pixels. */
    size: number;
    /** Rescan the Host catalog. */
    refresh: () => void | Promise<void>;
    /** Persist the selected catalog id. */
    select: (id: string) => void | Promise<void>;
    /** Persist overlay visibility. */
    setEnabled: (enabled: boolean) => void | Promise<void>;
    /** Persist sprite width. */
    setSize: (size: number) => void | Promise<void>;
    /** Active `pet` namespace lookup. */
    t: (key: PetKey) => string;
}
/**
 * Render visibility, size, refresh, and catalog-selection controls.
 * @param props - catalog snapshot, settings values, actions, and locale lookup.
 * @returns the complete pet settings section; pet creation is intentionally absent.
 */
export declare function PetsSection({ catalog, status, error, writable, enabled, selectedId, size, refresh, select, setEnabled, setSize, t, }: PetsSectionProps): ReactNode;
