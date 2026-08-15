/** Browser registration for the DSH Web pet and its settings page. */
import { type PetKey } from './locales.ts';
import type { ClientContext } from './runtime-types.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        /** Session-aware occupant rendered through the root pet overlay entry. */
        'shell.overlay.pet': {
            kind: 'single';
            scope: 'session-maybe';
            owner: PetOverlayOwnerProps;
        };
    }
    interface LocaleNamespaceMap {
        /** Pet overlay and settings copy. */
        pet: PetKey;
    }
}
/** Owner props for the package-internal pet slot. */
export interface PetOverlayOwnerProps {
    /** Marker field: the child seat has no owner-supplied business props. */
    children?: never;
}
/** Required services for catalog transport, durable settings, and both slots. */
export declare const inject: string[];
/**
 * Register the frame overlay and Pets settings section.
 * @param ctx - browser plugin context.
 */
export declare function apply(ctx: ClientContext): void;
