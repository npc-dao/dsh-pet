/** Window-local draggable pet overlay. */

import { useEffect, useRef, useState } from 'react'
import type {
  CSSProperties, KeyboardEvent, PointerEvent, ReactNode,
} from 'react'
import type { PetDescriptor, PetState } from '../pet-contract.ts'
import {
  MAX_PET_SIZE, MIN_PET_SIZE,
} from '../pet-settings.ts'
import type { PetAnimationState } from './pet-animation.ts'
import { PetSprite } from './PetSprite.tsx'
import css from './PetOverlay.module.css'

/** Inputs for the active pet inside the Web window. */
export interface PetOverlayProps {
  /** Currently resolved and available catalog row. */
  descriptor: PetDescriptor
  /** Activity derived from the live session and conversation snapshots. */
  state: PetState
  /** Requested sprite width in CSS pixels. */
  size: number
  /** Browser motion preference. */
  reducedMotion: boolean
}

interface Point {
  x: number
  y: number
}

interface DragState {
  pointerId: number
  pointerX: number
  pointerY: number
  origin: Point
  previousX: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

function petHeight(width: number): number {
  return width * 208 / 192
}

function viewportPosition(size: number): Point {
  return {
    x: Math.max(0, window.innerWidth - size - 24),
    y: Math.max(0, window.innerHeight - petHeight(size) - 24),
  }
}

function boundedPosition(point: Point, size: number): Point {
  return {
    x: clamp(point.x, 0, window.innerWidth - size),
    y: clamp(point.y, 0, window.innerHeight - petHeight(size)),
  }
}

/**
 * Render the pet over the Web frame with pointer and keyboard repositioning.
 * @param props - active descriptor, activity, size, and motion preference.
 * @returns the draggable overlay surface.
 */
export function PetOverlay({
  descriptor,
  state,
  size,
  reducedMotion,
}: PetOverlayProps): ReactNode {
  const width = clamp(Math.round(size), MIN_PET_SIZE, MAX_PET_SIZE)
  const [position, setPosition] = useState<Point | null>(null)
  const [hover, setHover] = useState(false)
  const [dragAnimation, setDragAnimation] = useState<PetAnimationState | null>(null)
  const drag = useRef<DragState | null>(null)

  useEffect(() => {
    const keepInsideWindow = (): void => {
      setPosition(previous => previous === null ? null : boundedPosition(previous, width))
    }
    window.addEventListener('resize', keepInsideWindow)
    keepInsideWindow()
    return () => { window.removeEventListener('resize', keepInsideWindow) }
  }, [width])

  const moveByKeyboard = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 24 : 8
    let delta: Point
    switch (event.key) {
      case 'ArrowLeft': delta = { x: -step, y: 0 }; break
      case 'ArrowRight': delta = { x: step, y: 0 }; break
      case 'ArrowUp': delta = { x: 0, y: -step }; break
      case 'ArrowDown': delta = { x: 0, y: step }; break
      default: return
    }
    event.preventDefault()
    setPosition((previous) => {
      const origin = previous ?? viewportPosition(width)
      return boundedPosition({ x: origin.x + delta.x, y: origin.y + delta.y }, width)
    })
  }

  const beginDrag = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    const origin = position ?? {
      x: rect.width === 0 ? viewportPosition(width).x : rect.left,
      y: rect.height === 0 ? viewportPosition(width).y : rect.top,
    }
    drag.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      origin,
      previousX: event.clientX,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPosition(origin)
  }

  const continueDrag = (event: PointerEvent<HTMLDivElement>): void => {
    const active = drag.current
    if (active === null || active.pointerId !== event.pointerId) return
    const horizontalDelta = event.clientX - active.previousX
    if (horizontalDelta >= 4) setDragAnimation('running-right')
    else if (horizontalDelta <= -4) setDragAnimation('running-left')
    active.previousX = event.clientX
    setPosition(boundedPosition({
      x: active.origin.x + event.clientX - active.pointerX,
      y: active.origin.y + event.clientY - active.pointerY,
    }, width))
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    const active = drag.current
    if (active === null || active.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    drag.current = null
    setDragAnimation(null)
  }

  const style: CSSProperties = position === null
    ? { width }
    : { width, left: position.x, top: position.y, right: 'auto', bottom: 'auto' }

  return (
    <div className={css.overlay} data-pet-overlay>
      <div
        aria-label={descriptor.displayName}
        className={css.pet}
        data-pet-id={descriptor.id}
        onKeyDown={moveByKeyboard}
        onPointerCancel={endDrag}
        onPointerDown={beginDrag}
        onPointerEnter={() => { setHover(true) }}
        onPointerLeave={() => { setHover(false) }}
        onPointerMove={continueDrag}
        onPointerUp={endDrag}
        role="img"
        style={style}
        tabIndex={0}
      >
        <PetSprite
          assetUrl={descriptor.assetPath}
          version={descriptor.spriteVersionNumber}
          state={dragAnimation ?? state}
          reducedMotion={reducedMotion}
          hover={hover && dragAnimation === null}
        />
      </div>
    </div>
  )
}
