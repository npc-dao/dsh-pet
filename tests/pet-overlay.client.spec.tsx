// @vitest-environment jsdom
/** PetOverlay window bounds, pointer drag states, hover, and keyboard access. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PetSpriteProps } from '../src/client/PetSprite.tsx'

vi.mock('../src/client/PetSprite.tsx', () => ({
  PetSprite: ({ assetUrl, version, state, reducedMotion, hover }: PetSpriteProps) => (
    <span
      data-testid="sprite"
      data-asset={assetUrl}
      data-version={version}
      data-motion={reducedMotion ? 'reduced' : 'full'}
      data-state={hover ? 'jumping' : state}
    />
  ),
}))

import { PetOverlay } from '../src/client/PetOverlay.tsx'
import type { PetDescriptor } from '../src/pet-contract.ts'

const PET: PetDescriptor = {
  id: 'codex',
  kind: 'builtin',
  displayName: 'Codex',
  description: 'Companion',
  spriteVersionNumber: 2,
  available: true,
  assetPath: '/dsh-pet/assets/codex',
}

beforeEach(() => {
  window.innerWidth = 300
  window.innerHeight = 300
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function petSurface(): HTMLElement {
  return screen.getByRole('img', { name: 'Codex' })
}

function spriteState(): string | undefined {
  return screen.getByTestId('sprite').dataset.state
}

describe('PetOverlay', () => {
  it('clamps size, jumps on hover, and supports bounded arrow-key movement', () => {
    const view = render(
      <PetOverlay descriptor={PET} state="idle" size={20} reducedMotion />,
    )
    const pet = petSurface()
    expect(pet.style.width).toBe('80px')
    expect(screen.getByTestId('sprite').dataset.asset).toBe(PET.assetPath)
    expect(screen.getByTestId('sprite').dataset.version).toBe('2')
    expect(screen.getByTestId('sprite').dataset.motion).toBe('reduced')

    fireEvent.pointerEnter(pet)
    expect(spriteState()).toBe('jumping')
    fireEvent.pointerLeave(pet)
    expect(spriteState()).toBe('idle')

    fireEvent.keyDown(pet, { key: 'Enter' })
    expect(pet.style.left).toBe('')
    fireEvent.keyDown(pet, { key: 'ArrowLeft' })
    expect(pet.style.left).toBe('188px')
    fireEvent.keyDown(pet, { key: 'ArrowRight', shiftKey: true })
    expect(pet.style.left).toBe('212px')
    fireEvent.keyDown(pet, { key: 'ArrowUp' })
    const movedTop = Number.parseFloat(pet.style.top)
    fireEvent.keyDown(pet, { key: 'ArrowDown' })
    expect(Number.parseFloat(pet.style.top)).toBeCloseTo(movedTop + 8)

    window.innerWidth = 120
    window.innerHeight = 120
    fireEvent(window, new Event('resize'))
    expect(Number.parseFloat(pet.style.left)).toBeLessThanOrEqual(40)
    expect(Number.parseFloat(pet.style.top)).toBeLessThanOrEqual(120 - 80 * 208 / 192)

    window.innerWidth = 300
    window.innerHeight = 300
    view.rerender(<PetOverlay descriptor={PET} state="review" size={300} reducedMotion={false} />)
    expect(pet.style.width).toBe('224px')
    expect(screen.getByTestId('sprite').dataset.motion).toBe('full')
  })

  it('maps horizontal dragging to direction rows and retains the bounded position', () => {
    render(<PetOverlay descriptor={PET} state="running" size={112} reducedMotion />)
    const pet = petSurface()
    const capture = vi.fn()
    const release = vi.fn()
    Object.defineProperties(pet, {
      setPointerCapture: { configurable: true, value: capture },
      releasePointerCapture: { configurable: true, value: release },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
    })

    fireEvent.pointerDown(pet, { button: 2, pointerId: 1, clientX: 100, clientY: 100 })
    expect(pet.style.left).toBe('')
    fireEvent.pointerMove(pet, { pointerId: 1, clientX: 110, clientY: 100 })
    fireEvent.pointerUp(pet, { pointerId: 1 })

    fireEvent.pointerDown(pet, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    expect(capture).toHaveBeenCalledWith(1)
    fireEvent.pointerMove(pet, { pointerId: 2, clientX: 150, clientY: 100 })
    fireEvent.pointerMove(pet, { pointerId: 1, clientX: 102, clientY: 104 })
    expect(spriteState()).toBe('running')
    fireEvent.pointerMove(pet, { pointerId: 1, clientX: 112, clientY: 104 })
    expect(spriteState()).toBe('running-right')
    fireEvent.pointerEnter(pet)
    expect(spriteState()).toBe('running-right')
    fireEvent.pointerMove(pet, { pointerId: 1, clientX: 100, clientY: 500 })
    expect(spriteState()).toBe('running-left')
    expect(Number.parseFloat(pet.style.top)).toBeCloseTo(300 - 112 * 208 / 192)

    fireEvent.pointerUp(pet, { pointerId: 2 })
    expect(spriteState()).toBe('running-left')
    fireEvent.pointerUp(pet, { pointerId: 1 })
    expect(release).toHaveBeenCalledWith(1)
    expect(spriteState()).toBe('jumping')
    fireEvent.pointerLeave(pet)
    expect(spriteState()).toBe('running')

    fireEvent.pointerMove(pet, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(pet, { pointerId: 1 })
  })

  it('uses measured geometry for a fresh drag, current position later, and handles cancellation', () => {
    render(<PetOverlay descriptor={PET} state="idle" size={112} reducedMotion />)
    const pet = petSurface()
    Object.defineProperties(pet, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
      hasPointerCapture: { configurable: true, value: vi.fn(() => false) },
    })
    vi.spyOn(pet, 'getBoundingClientRect').mockReturnValue({
      width: 112, height: 121, left: 20, top: 30, right: 132, bottom: 151,
      x: 20, y: 30, toJSON: () => ({}),
    })

    fireEvent.pointerDown(pet, { button: 0, pointerId: 7, clientX: 30, clientY: 40 })
    expect(pet.style.left).toBe('20px')
    expect(pet.style.top).toBe('30px')
    fireEvent.pointerCancel(pet, { pointerId: 8 })
    fireEvent.pointerCancel(pet, { pointerId: 7 })

    fireEvent.keyDown(pet, { key: 'ArrowRight' })
    expect(pet.style.left).toBe('28px')
    fireEvent.pointerDown(pet, { button: 0, pointerId: 9, clientX: 30, clientY: 40 })
    fireEvent.pointerCancel(pet, { pointerId: 9 })
  })
})
