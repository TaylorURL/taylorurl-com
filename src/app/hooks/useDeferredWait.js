import { useEffect, useRef, useState } from 'react'

// A wait shorter than this never earns a placeholder: by the time the eye has
// found one it is already gone, and what is left is a flicker where a page
// should have been.
const DEFAULT_DELAY_MS = 180

// Once a placeholder is up it stays up this long, however early the answer
// arrives. A line of text that appears and vanishes inside a frame or two reads
// as a fault rather than as a wait.
const DEFAULT_HOLD_MS = 420

/**
 * Gives a wait a floor and a ceiling, so what a reader sees is paced by what
 * they can follow rather than by when a promise happens to settle.
 *
 * A gate driven straight off its own loading flag has two failure modes and
 * they pull in opposite directions. Resolve in forty milliseconds and the
 * placeholder strobes; resolve in two seconds and it arrives out of nothing,
 * with no fade to say the screen is still working. Both are the same mistake -
 * a clock that belongs to the network deciding what a person watches.
 *
 * `blocked` says the placeholder is still mounted and the content behind it is
 * not to be shown yet. `visible` says it should be opaque. Between them a fast
 * answer passes through with nothing drawn at all, and a slow one fades in,
 * stays long enough to be read, and fades out.
 *
 * @param {boolean} waiting - Whether the thing being waited on is outstanding.
 * @param {{delay?: number, hold?: number}} [options] - `delay` is how long an
 *   answer has to arrive before nothing is drawn; `hold` is the shortest time a
 *   placeholder stays once it has been drawn.
 * @returns {{blocked: boolean, visible: boolean}}
 */
export function useDeferredWait(waiting, options = {}) {
  const { delay = DEFAULT_DELAY_MS, hold = DEFAULT_HOLD_MS } = options
  const [visible, setVisible] = useState(false)
  const shownAt = useRef(0)

  useEffect(() => {
    if (waiting) {
      if (visible) return undefined
      const timer = setTimeout(() => {
        shownAt.current = Date.now()
        setVisible(true)
      }, delay)
      return () => clearTimeout(timer)
    }

    if (!visible) return undefined
    const remaining = hold - (Date.now() - shownAt.current)
    if (remaining <= 0) {
      setVisible(false)
      return undefined
    }
    const timer = setTimeout(() => setVisible(false), remaining)
    return () => clearTimeout(timer)
  }, [waiting, visible, delay, hold])

  return { blocked: waiting || visible, visible }
}
