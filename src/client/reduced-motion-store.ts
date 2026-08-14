/** Browser motion-preference observable for the pet renderer. */

import {
  createSnapshotStore, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'

/** Media query used for the Web platform's reduced-motion preference. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Observe the browser motion preference with lifecycle owned by the caller.
 * @param effect - Cordis effect registrar used to release the media listener.
 * @param match - optional media-query implementation for non-browser tests.
 * @returns boolean snapshot store consumed through a slot hooks compartment.
 */
export function createReducedMotionStore(
  effect: (installer: () => () => void, label: string) => void,
  match: ((query: string) => MediaQueryList) | undefined =
    typeof matchMedia === 'undefined' ? undefined : matchMedia,
): SnapshotStore<boolean> {
  const media = match?.(REDUCED_MOTION_QUERY)
  const store = createSnapshotStore(media?.matches ?? false)
  if (media === undefined) return store
  const onChange = (event: MediaQueryListEvent): void => { store.set(event.matches) }
  effect(() => {
    media.addEventListener('change', onChange)
    return () => { media.removeEventListener('change', onChange) }
  }, 'dsh-pet: reduced motion preference')
  return store
}
