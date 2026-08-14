import { describe, expect, it } from 'vitest'
import {
  CODEX_PET_ANIMATION_FRAMES,
  CODEX_PET_NON_IDLE_REPEAT_COUNT,
  CODEX_PET_SLOW_IDLE_MULTIPLIER,
  getPetAnimationSequence,
  petFrameBackgroundPosition,
  type PetAnimationState,
} from '../src/client/pet-animation.ts'

const STATE_TIMING: Readonly<Record<
  PetAnimationState,
  { row: number; durations: readonly number[] }
>> = {
  idle: { row: 0, durations: [280, 110, 110, 140, 140, 320] },
  'running-right': { row: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  'running-left': { row: 2, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  waving: { row: 3, durations: [140, 140, 140, 280] },
  jumping: { row: 4, durations: [140, 140, 140, 140, 280] },
  failed: { row: 5, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { row: 6, durations: [150, 150, 150, 150, 150, 260] },
  running: { row: 7, durations: [120, 120, 120, 120, 120, 220] },
  review: { row: 8, durations: [150, 150, 150, 150, 150, 280] },
}

describe('Codex pet animation', () => {
  it('pins every state row, column, and frame duration', () => {
    for (const [state, expected] of Object.entries(STATE_TIMING) as [PetAnimationState, typeof STATE_TIMING[PetAnimationState]][]) {
      const frames = CODEX_PET_ANIMATION_FRAMES[state]
      expect(frames.map(frame => frame.rowIndex), state).toEqual(expected.durations.map(() => expected.row))
      expect(frames.map(frame => frame.columnIndex), state).toEqual(expected.durations.map((_, index) => index))
      expect(frames.map(frame => frame.frameDurationMs), state).toEqual(expected.durations)
      expect(Object.isFrozen(frames), state).toBe(true)
    }
  })

  it('holds every reduced-motion state on its first cell', () => {
    for (const state of Object.keys(STATE_TIMING) as PetAnimationState[]) {
      expect(getPetAnimationSequence(state, true)).toEqual({
        frames: [CODEX_PET_ANIMATION_FRAMES[state][0]],
        loopStartIndex: null,
      })
    }
  })

  it('loops ordinary idle at full speed', () => {
    expect(getPetAnimationSequence('idle', false)).toEqual({
      frames: CODEX_PET_ANIMATION_FRAMES.idle,
      loopStartIndex: 0,
    })
  })

  it('plays each non-idle action three times before looping six-times-slower idle', () => {
    expect(CODEX_PET_NON_IDLE_REPEAT_COUNT).toBe(3)
    expect(CODEX_PET_SLOW_IDLE_MULTIPLIER).toBe(6)
    const states = (Object.keys(STATE_TIMING) as PetAnimationState[]).filter(state => state !== 'idle')
    for (const state of states) {
      const source = CODEX_PET_ANIMATION_FRAMES[state]
      const sequence = getPetAnimationSequence(state, false)
      const actionLength = source.length * CODEX_PET_NON_IDLE_REPEAT_COUNT
      expect(sequence.loopStartIndex, state).toBe(actionLength)
      expect(sequence.frames.slice(0, actionLength), state).toEqual([...source, ...source, ...source])
      expect(sequence.frames.slice(actionLength), state).toEqual(
        CODEX_PET_ANIMATION_FRAMES.idle.map(frame => ({
          ...frame,
          frameDurationMs: frame.frameDurationMs * CODEX_PET_SLOW_IDLE_MULTIPLIER,
        })),
      )
    }
  })

  it('positions cells against the selected version row count', () => {
    expect(petFrameBackgroundPosition({ columnIndex: 0, rowIndex: 0 }, 1)).toBe('0% 0%')
    expect(petFrameBackgroundPosition({ columnIndex: 7, rowIndex: 8 }, 1)).toBe('100% 100%')
    expect(petFrameBackgroundPosition({ columnIndex: 7, rowIndex: 8 }, 2)).toBe('100% 80%')
    expect(petFrameBackgroundPosition({ columnIndex: 7, rowIndex: 10 }, 2)).toBe('100% 100%')
  })
})
