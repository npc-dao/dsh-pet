import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createReducedMotionStore, REDUCED_MOTION_QUERY,
} from '../src/client/reduced-motion-store.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createReducedMotionStore', () => {
  it('stays false and installs no effect when matchMedia is absent', () => {
    vi.stubGlobal('matchMedia', undefined)
    const effect = vi.fn()

    const store = createReducedMotionStore(effect)

    expect(store.getSnapshot()).toBe(false)
    expect(effect).not.toHaveBeenCalled()
  })

  it('publishes media changes and removes the exact listener on teardown', () => {
    let change: ((event: MediaQueryListEvent) => void) | undefined
    const addEventListener = vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
      change = listener as (event: MediaQueryListEvent) => void
    })
    const removeEventListener = vi.fn()
    const media = {
      matches: true,
      addEventListener,
      removeEventListener,
    } as unknown as MediaQueryList
    const match = vi.fn(() => media)
    vi.stubGlobal('matchMedia', match)
    let dispose: (() => void) | undefined
    const effect = vi.fn((installer: () => () => void) => {
      dispose = installer()
    })

    const store = createReducedMotionStore(effect)

    expect(match).toHaveBeenCalledWith(REDUCED_MOTION_QUERY)
    expect(effect).toHaveBeenCalledWith(expect.any(Function), 'dsh-pet: reduced motion preference')
    expect(store.getSnapshot()).toBe(true)
    change?.({ matches: false } as MediaQueryListEvent)
    expect(store.getSnapshot()).toBe(false)

    dispose?.()
    expect(removeEventListener).toHaveBeenCalledWith('change', change)
  })
})
