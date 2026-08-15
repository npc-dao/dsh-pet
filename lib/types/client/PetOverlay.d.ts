/** Window-local draggable pet overlay. */
import type { ReactNode } from 'react';
import type { PetDescriptor, PetState } from '../pet-contract.ts';
/** Inputs for the active pet inside the Web window. */
export interface PetOverlayProps {
    /** Currently resolved and available catalog row. */
    descriptor: PetDescriptor;
    /** Activity derived from the live session and conversation snapshots. */
    state: PetState;
    /** Requested sprite width in CSS pixels. */
    size: number;
    /** Browser motion preference. */
    reducedMotion: boolean;
}
/**
 * Render the pet over the Web frame with pointer and keyboard repositioning.
 * @param props - active descriptor, activity, size, and motion preference.
 * @returns the draggable overlay surface.
 */
export declare function PetOverlay({ descriptor, state, size, reducedMotion, }: PetOverlayProps): ReactNode;
