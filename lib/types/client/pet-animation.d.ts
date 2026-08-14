/** DSH pet animation sequences for package-owned and Codex-compatible atlases. */
import { type PetSpriteVersion, type PetState } from '../pet-contract.ts';
/** Hover, drag, and task states with dedicated rows in a Codex atlas. */
export type PetAnimationState = PetState | 'jumping' | 'running-left' | 'running-right' | 'waving';
/** One timed cell in a Codex pet atlas. */
export interface PetAnimationFrame {
    /** Zero-based atlas row. */
    readonly rowIndex: number;
    /** Zero-based atlas column. */
    readonly columnIndex: number;
    /** Time to retain this cell before advancing. */
    readonly frameDurationMs: number;
}
/** Non-empty frame list guaranteed by every supported Codex animation state. */
export type PetAnimationFrames = readonly [PetAnimationFrame, ...PetAnimationFrame[]];
/** Timed cells plus the index to revisit after the final cell. */
export interface PetAnimationSequence {
    /** Cells in playback order. */
    readonly frames: PetAnimationFrames;
    /** Loop target, or null for a finite sequence. */
    readonly loopStartIndex: number | null;
}
/** Number of full task-action passes before the renderer settles into slow idle. */
export declare const CODEX_PET_NON_IDLE_REPEAT_COUNT = 3;
/** Duration multiplier applied to the idle tail after a task animation. */
export declare const CODEX_PET_SLOW_IDLE_MULTIPLIER = 6;
/** Exact row, cell count, and timing table used by Codex pet animations. */
export declare const CODEX_PET_ANIMATION_FRAMES: Readonly<Record<PetAnimationState, PetAnimationFrames>>;
/**
 * Build Codex's finite action lead-in and slow-idle loop.
 * @param state - task, hover, or drag animation to play.
 * @param reducedMotion - whether playback must remain on the state's first cell.
 * @returns frame order and loop target for the renderer's timer.
 */
export declare function getPetAnimationSequence(state: PetAnimationState, reducedMotion: boolean): PetAnimationSequence;
/**
 * Convert one atlas cell to CSS `background-position` percentages.
 * @param frame - cell selected by the animation sequence.
 * @param spriteVersion - atlas layout used by the selected pet.
 * @returns horizontal and vertical background-position percentages.
 */
export declare function petFrameBackgroundPosition(frame: Pick<PetAnimationFrame, 'columnIndex' | 'rowIndex'>, spriteVersion: PetSpriteVersion): string;
//# sourceMappingURL=pet-animation.d.ts.map