/** Root overlay entry that declares the current-session-aware pet seat. */
import type { ReactNode } from 'react';
import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Full props for the root-scoped overlay declaration entry. */
export type PetOverlayRootProps = PropsRuntime<'shell.overlay'> & PropsRenderSlots<'shell.overlay.pet'>;
/**
 * Render the session-maybe child seat at the frame-wide overlay position.
 * @param props - slot dispatcher authorized by this entry's child declaration.
 * @returns the current pet contribution, or null when no occupant is present.
 */
export declare function PetOverlayRoot({ renderSlot }: PetOverlayRootProps): ReactNode;
//# sourceMappingURL=PetOverlayRoot.d.ts.map