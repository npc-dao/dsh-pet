/** DSH pet spritesheet renderer for package-owned and Codex-compatible atlases. */

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  getPetAnimationSequence,
  petFrameBackgroundPosition,
  type PetAnimationFrame,
  type PetAnimationState,
} from './pet-animation.ts'
import css from './PetSprite.module.css'

/** Inputs required to render one spritesheet cell at a time. */
export interface PetSpriteProps {
  /** Same-origin URL returned by the pet catalog. */
  assetUrl: string
  /** Codex atlas layout version. */
  version: 1 | 2
  /** Requested activity before the optional hover jump overrides it. */
  state: PetAnimationState
  /** Whether to collapse motion to the representative frame. */
  reducedMotion: boolean
  /** Whether the pointer is currently over the owning pet surface. */
  hover: boolean
}

interface PetSpriteStyle extends CSSProperties {
  '--pet-atlas': string
  '--pet-atlas-rows': string
  '--pet-frame-position': string
}

/**
 * Render a pixel-aligned frame and advance it with the animation timing table.
 * @param props - atlas, state, and motion preference.
 * @returns an assistive-technology-hidden sprite span.
 */
export function PetSprite({
  assetUrl,
  version,
  state,
  reducedMotion,
  hover,
}: PetSpriteProps): ReactNode {
  const animationState: PetAnimationState = hover ? 'jumping' : state
  const sequence = useMemo(
    () => getPetAnimationSequence(animationState, reducedMotion),
    [animationState, reducedMotion],
  )
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    let timer: number | undefined
    let index = 0
    setFrameIndex(0)

    const schedule = (): void => {
      const frame = sequence.frames[index] as PetAnimationFrame
      timer = window.setTimeout(() => {
        if (index + 1 < sequence.frames.length) {
          index += 1
        } else if (sequence.loopStartIndex !== null) {
          index = sequence.loopStartIndex
        } else {
          return
        }
        setFrameIndex(index)
        schedule()
      }, frame.frameDurationMs)
    }

    if (sequence.frames.length > 1) schedule()
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [sequence])

  const boundedIndex = Math.min(frameIndex, sequence.frames.length - 1)
  const frame = sequence.frames[boundedIndex] as PetAnimationFrame
  const style: PetSpriteStyle = {
    '--pet-atlas': `url(${JSON.stringify(assetUrl)})`,
    '--pet-atlas-rows': version === 1 ? '900%' : '1100%',
    '--pet-frame-position': petFrameBackgroundPosition(frame, version),
  }

  return (
    <span
      aria-hidden="true"
      className={css.sprite}
      data-frame-column={frame.columnIndex}
      data-frame-row={frame.rowIndex}
      data-pet-state={animationState}
      style={style}
    />
  )
}
