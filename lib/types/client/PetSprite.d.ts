/** DSH pet spritesheet renderer for package-owned and Codex-compatible atlases. */
import type { ReactNode } from 'react';
import { type PetAnimationState } from './pet-animation.ts';
/** Inputs required to render one spritesheet cell at a time. */
export interface PetSpriteProps {
    /** Same-origin URL returned by the pet catalog. */
    assetUrl: string;
    /** Codex atlas layout version. */
    version: 1 | 2;
    /** Requested activity before the optional hover jump overrides it. */
    state: PetAnimationState;
    /** Whether to collapse motion to the representative frame. */
    reducedMotion: boolean;
    /** Whether the pointer is currently over the owning pet surface. */
    hover: boolean;
}
/**
 * Render a pixel-aligned frame and advance it with the animation timing table.
 * @param props - atlas, state, and motion preference.
 * @returns an assistive-technology-hidden sprite span.
 */
export declare function PetSprite({ assetUrl, version, state, reducedMotion, hover, }: PetSpriteProps): ReactNode;
