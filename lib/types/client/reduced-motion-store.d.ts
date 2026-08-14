/** Browser motion-preference observable for the pet renderer. */
import { type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
/** Media query used for the Web platform's reduced-motion preference. */
export declare const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
/**
 * Observe the browser motion preference with lifecycle owned by the caller.
 * @param effect - Cordis effect registrar used to release the media listener.
 * @param match - optional media-query implementation for non-browser tests.
 * @returns boolean snapshot store consumed through a slot hooks compartment.
 */
export declare function createReducedMotionStore(effect: (installer: () => () => void, label: string) => void, match?: ((query: string) => MediaQueryList) | undefined): SnapshotStore<boolean>;
//# sourceMappingURL=reduced-motion-store.d.ts.map