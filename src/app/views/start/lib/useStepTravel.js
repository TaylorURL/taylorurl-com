import { useEffect, useRef, useState } from 'react'

/**
 * Which step a frame that holds one at a time is showing, and the moves
 * between them. The configurator, the free tools and the brief a client fills
 * in all move this way; what each of them opens is its own business, and
 * arrives here as `reach`.
 *
 * The step asked for is clamped by `reach` and by the steps there are, so a
 * number that has gone stale cannot open a step that is not there or not yet
 * open.
 *
 * A move puts focus on the new step's heading - the element whose id is the
 * step's own with `-title` after it - which is what puts a screen reader at the
 * top of the step rather than wherever the last control left it. The step a
 * frame opens on takes no focus, because nobody moved to it.
 *
 * @param {object} options
 * @param {Array<{ id: string }>} options.steps
 * @param {number} options.reach - The furthest step that can be opened.
 * @param {boolean} [options.retreat] - A reach that falls takes the frame back
 *   with it, rather than only clamping it for the render.
 * @param {number|null} [options.resumeAt] - The step to move to once it
 *   arrives. Whatever it is restored from lands after the first paint, so it is
 *   taken then rather than opening on a question already answered.
 * @param {(step: number) => void} [options.onStep] - Told which step is in
 *   front, so whoever writes the answers down can write the place in them too.
 * @returns {{ active: number, step: object, direction: 1 | -1,
 *   open: (target: number) => void }}
 */
export function useStepTravel({ steps, reach, retreat = false, resumeAt = null, onStep }) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const travelled = useRef(false)

  const active = Math.min(index, reach, steps.length - 1)
  const step = steps[active]

  useEffect(() => {
    if (!travelled.current) return
    document.getElementById(`${step.id}-title`)?.focus()
  }, [step.id])

  useEffect(() => {
    if (retreat) setIndex(current => Math.min(current, reach))
  }, [retreat, reach])

  useEffect(() => {
    if (resumeAt === null) return
    setDirection(1)
    setIndex(resumeAt)
  }, [resumeAt])

  useEffect(() => {
    onStep?.(active)
  }, [active, onStep])

  const open = target => {
    if (target === active || target > reach || target < 0) return
    travelled.current = true
    setDirection(target > active ? 1 : -1)
    setIndex(target)
  }

  return { active, step, direction, open }
}
