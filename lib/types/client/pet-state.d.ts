/** Pure runtime-state projection for the Web pet. */
import type { ConversationSnapshot, SessionListState } from '@deepseek-ai/dsh-client-runtime/client';
import type { PetState } from '../pet-contract.ts';
/** Current session signals used to select one task animation. */
export interface PetStateSignals {
    /** The session is blocked on an answerable user interaction. */
    readonly waiting: boolean;
    /** The current session attempt has an unresolved agent failure. */
    readonly currentFailure: boolean;
    /** Completed output is waiting for the user to review it. */
    readonly review: boolean;
    /** The Host reports active agent work. */
    readonly running: boolean;
}
/**
 * Aggregate the non-blank Session list into the single Web mascot's activity facts.
 * @param sessions - global Session list carrying live activity and completion flags.
 * @param current - selected Session's detailed snapshot, when it is mounted.
 * @returns the waiting, selected-failure, review, and running signals.
 */
export declare function petStateSignals(sessions: SessionListState, current?: ConversationSnapshot): PetStateSignals;
/**
 * Select the highest-priority Codex task animation for one session.
 * @param signals - current waiting, failure, review, and activity facts.
 * @returns the state whose row the pet renderer should animate.
 */
export declare function derivePetState(signals: PetStateSignals): PetState;
//# sourceMappingURL=pet-state.d.ts.map