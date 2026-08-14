import { describe, expect, it } from 'vitest'
import type {
  ConversationSnapshot, SessionListState, SessionSummary,
} from '@deepseek-ai/dsh-client-runtime/client'
import { derivePetState, petStateSignals } from '../src/client/pet-state.ts'

const sid = (id: string): never => id as never

function summary(
  id: string,
  values: Partial<Pick<
    SessionSummary,
    'blank' | 'completed' | 'pendingInteraction' | 'running'
  >> = {},
): SessionSummary {
  return {
    id: sid(id),
    displayTitle: id,
    blank: false,
    running: false,
    updatedAt: 0,
    ...values,
  }
}

function sessions(
  rows: readonly SessionSummary[],
  current?: string,
  missingId?: string,
): SessionListState {
  const byId = Object.fromEntries(rows.map(row => [row.id, row]))
  return {
    ids: [...rows.map(row => row.id), ...(missingId === undefined ? [] : [sid(missingId)])],
    byId,
    current: current === undefined ? undefined : sid(current),
  } as unknown as SessionListState
}

function conversation(
  sessionId: string,
  values: {
    lastAgentError?: string | null
    running?: boolean
    turnEndKinds?: readonly ('completed' | 'error')[]
    missingLatestTurn?: boolean
  } = {},
): ConversationSnapshot {
  const kinds = values.turnEndKinds ?? []
  const turnOrder = kinds.map((_kind, index) => index + 1)
  if (values.missingLatestTurn === true) turnOrder.push(kinds.length + 1)
  const turns = new Map(kinds.map((kind, index) => {
    const turn = index + 1
    return [turn, {
      end: {
        type: 'turn/end',
        data: {
          turn,
          reason: kind === 'error'
            ? { kind, error: { message: 'failed', code: 'UNKNOWN' } }
            : { kind },
        },
      },
    }]
  }))
  return {
    sessionId: sid(sessionId),
    lastAgentError: values.lastAgentError ?? null,
    running: values.running ?? false,
    chat: { timeline: { turnOrder, turns } },
  } as unknown as ConversationSnapshot
}

describe('derivePetState', () => {
  it('uses waiting before every other current signal', () => {
    expect(derivePetState({
      waiting: true, currentFailure: true, review: true, running: true,
    })).toBe('waiting')
  })

  it('uses a current failure before review or running', () => {
    expect(derivePetState({
      waiting: false, currentFailure: true, review: true, running: true,
    })).toBe('failed')
  })

  it('uses review before running', () => {
    expect(derivePetState({
      waiting: false, currentFailure: false, review: true, running: true,
    })).toBe('review')
  })

  it('uses running when no higher-priority signal is present', () => {
    expect(derivePetState({
      waiting: false, currentFailure: false, review: false, running: true,
    })).toBe('running')
  })

  it('uses idle when every activity signal is absent', () => {
    expect(derivePetState({
      waiting: false, currentFailure: false, review: false, running: false,
    })).toBe('idle')
  })
})

describe('petStateSignals', () => {
  it('filters blank and absent rows from every global signal', () => {
    const blank = summary('blank', {
      blank: true, completed: true, pendingInteraction: 'approval', running: true,
    })
    expect(petStateSignals(sessions([blank], 'blank', 'missing'), conversation('blank', {
      lastAgentError: 'old failure',
    }))).toEqual({ waiting: false, currentFailure: false, review: false, running: false })
  })

  it('aggregates waiting, completed review, and running across visible sessions', () => {
    expect(petStateSignals(sessions([
      summary('waiting', { pendingInteraction: 'question' }),
      summary('review', { completed: true }),
      summary('running', { running: true }),
    ]))).toEqual({ waiting: true, currentFailure: false, review: true, running: true })

    const addressed = sessions([summary('addressed', { running: true })], 'addressed')
    addressed.ids = []
    expect(petStateSignals(addressed).running).toBe(true)
  })

  it('reports only the selected stopped session live error', () => {
    const list = sessions([summary('selected'), summary('other')], 'selected')
    expect(petStateSignals(list, conversation('selected', { lastAgentError: 'failed now' })).currentFailure).toBe(true)
    expect(petStateSignals(list, conversation('other', { lastAgentError: 'not selected' })).currentFailure).toBe(false)
    expect(petStateSignals(sessions([summary('selected', { running: true })], 'selected'), conversation('selected', {
      running: true,
      lastAgentError: 'superseded by current work',
    })).currentFailure).toBe(false)
    expect(petStateSignals(sessions([summary('other')], 'missing'), conversation('missing', {
      lastAgentError: 'row unavailable',
    })).currentFailure).toBe(false)
    expect(petStateSignals(sessions([summary('only')])).currentFailure).toBe(false)
  })

  it('recognizes an error only when it ends the latest timeline turn', () => {
    const list = sessions([summary('selected')], 'selected')
    expect(petStateSignals(list, conversation('selected', {
      turnEndKinds: ['completed', 'error'],
    })).currentFailure).toBe(true)
    expect(petStateSignals(list, conversation('selected', {
      turnEndKinds: ['error', 'completed'],
    })).currentFailure).toBe(false)
    expect(petStateSignals(list, conversation('selected', {
      turnEndKinds: ['error'], missingLatestTurn: true,
    })).currentFailure).toBe(false)
    expect(petStateSignals(list, conversation('selected')).currentFailure).toBe(false)
  })
})
