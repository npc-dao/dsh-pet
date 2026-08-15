/** Pure runtime-state projection for the Web pet. */

import type { ConversationSnapshot, SessionListState } from './runtime-types.ts'
import type { PetState } from '../pet-contract.ts'

/** Current session signals used to select one task animation. */
export interface PetStateSignals {
  /** The session is blocked on an answerable user interaction. */
  readonly waiting: boolean
  /** The current session attempt has an unresolved agent failure. */
  readonly currentFailure: boolean
  /** Completed output is waiting for the user to review it. */
  readonly review: boolean
  /** The Host reports active agent work. */
  readonly running: boolean
}

function currentTurnFailed(snapshot: ConversationSnapshot): boolean {
  const latestTurn = snapshot.chat.timeline.turnOrder.at(-1)
  if (latestTurn === undefined) return false
  return snapshot.chat.timeline.turns.get(latestTurn)?.end?.data.reason.kind === 'error'
}

/**
 * Aggregate the non-blank Session list into the single Web mascot's activity facts.
 * @param sessions - global Session list carrying live activity and completion flags.
 * @param current - selected Session's detailed snapshot, when it is mounted.
 * @returns the waiting, selected-failure, review, and running signals.
 */
export function petStateSignals(
  sessions: SessionListState,
  current?: ConversationSnapshot,
): PetStateSignals {
  // `byId` also carries the selected addressed subagent row, which is absent
  // from the ordinary list order but still drives the one global mascot.
  const visible = Object.values(sessions.byId).filter(session => !session.blank)
  const selected = sessions.current === undefined ? undefined : sessions.byId[sessions.current]
  const currentFailure = selected !== undefined
    && !selected.blank
    && current !== undefined
    && current.sessionId === sessions.current
    && !current.running
    && (current.lastAgentError !== null || currentTurnFailed(current))

  return {
    waiting: visible.some(session => session.pendingInteraction !== undefined),
    currentFailure,
    review: visible.some(session => session.completed === true),
    running: visible.some(session => session.running),
  }
}

/**
 * Select the highest-priority Codex task animation for one session.
 * @param signals - current waiting, failure, review, and activity facts.
 * @returns the state whose row the pet renderer should animate.
 */
export function derivePetState(signals: PetStateSignals): PetState {
  if (signals.waiting) return 'waiting'
  if (signals.currentFailure) return 'failed'
  if (signals.review) return 'review'
  if (signals.running) return 'running'
  return 'idle'
}
