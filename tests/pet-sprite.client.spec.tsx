// @vitest-environment jsdom
/** PetSprite playback, hover override, atlas version, and teardown behavior. */

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/client/pet-animation.ts', () => {
  const first = { rowIndex: 0, columnIndex: 0, frameDurationMs: 5 }
  const second = { rowIndex: 1, columnIndex: 1, frameDurationMs: 7 }
  return {
    getPetAnimationSequence: (state: string, reducedMotion: boolean) => reducedMotion
      ? { frames: [first], loopStartIndex: null }
      : { frames: [first, second], loopStartIndex: state === 'running' ? null : 0 },
    petFrameBackgroundPosition: (
      frame: { rowIndex: number; columnIndex: number },
      version: number,
    ) => `${frame.columnIndex}:${frame.rowIndex}:v${version}`,
  }
})

import { PetSprite } from '../src/client/PetSprite.tsx'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('PetSprite', () => {
  it('advances an idle sequence and loops back to its declared cell', () => {
    const view = render(
      <PetSprite
        assetUrl={'/dsh-pet/assets/a pet"atlas'}
        version={1}
        state="idle"
        reducedMotion={false}
        hover={false}
      />,
    )
    const sprite = view.container.firstElementChild as HTMLElement
    expect(sprite.dataset.petState).toBe('idle')
    expect(sprite.dataset.frameColumn).toBe('0')
    expect(sprite.style.getPropertyValue('--pet-atlas')).toContain('/dsh-pet/assets/a pet')
    expect(sprite.style.getPropertyValue('--pet-atlas-rows')).toBe('900%')
    expect(sprite.style.getPropertyValue('--pet-frame-position')).toBe('0:0:v1')

    act(() => { vi.advanceTimersByTime(5) })
    expect(sprite.dataset.frameColumn).toBe('1')
    act(() => { vi.advanceTimersByTime(7) })
    expect(sprite.dataset.frameColumn).toBe('0')
  })

  it('stops a finite sequence on its final frame', () => {
    const view = render(
      <PetSprite assetUrl="/pet.webp" version={1} state="running" reducedMotion={false} hover={false} />,
    )
    const sprite = view.container.firstElementChild as HTMLElement
    act(() => { vi.advanceTimersByTime(12) })
    expect(sprite.dataset.frameColumn).toBe('1')
    act(() => { vi.advanceTimersByTime(100) })
    expect(sprite.dataset.frameColumn).toBe('1')
  })

  it('uses the hover jump and representative v2 frame without starting a timer', () => {
    const view = render(
      <PetSprite assetUrl="/pet.webp" version={2} state="review" reducedMotion hover />,
    )
    const sprite = view.container.firstElementChild as HTMLElement
    expect(sprite.dataset.petState).toBe('jumping')
    expect(sprite.style.getPropertyValue('--pet-atlas-rows')).toBe('1100%')
    expect(sprite.style.getPropertyValue('--pet-frame-position')).toBe('0:0:v2')
    expect(vi.getTimerCount()).toBe(0)
  })
})
