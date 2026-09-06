import { useEffect, useRef, useState } from 'react'
import {
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'

const DEFAULT_OFFSET = ['start end', 'end start']
const DEFAULT_SPRING = { stiffness: 140, damping: 32, mass: 0.4 }

/**
 * Where in its own pass across the screen a thing counts as the one being read.
 *
 * Progress runs 0 at the moment its top clears the bottom edge to 1 as its
 * bottom leaves the top, so a half is its middle against the middle of the
 * screen. The two inner stops hold it at full size across the third of the pass
 * either side of that: a single peak turns size into a readout of scroll
 * position, and the reader watches the card breathe instead of reading it. Held
 * across a band it is a state the card arrives in, sits in long enough to be
 * read, and then leaves.
 */
const PASS = [0, 0.35, 0.65, 1]
const HELD = [0, 1, 1, 0]
const STILL = [1, 1, 1, 1]

/**
 * Scroll-as-playhead focus: whatever is crossing the middle of the screen is at
 * its own full size and full strength, and everything above and below it is
 * fractionally smaller and fainter. Scrolling back up runs it backward, and a
 * spring lags the raw progress so a card settles into focus rather than being
 * dragged into it.
 *
 * Nothing ever grows past the size it was laid out at. A card that scaled above
 * one would push its own shadow into its neighbour's gap and, on a phone, past
 * the edge of the page; the reading of one thing growing is carried by the
 * others receding from it, which costs no layout and cannot overflow.
 *
 * Size and strength come off one spring rather than two, so a card cannot be
 * caught part-way into focus on one and part-way out on the other.
 *
 * Honors `prefers-reduced-motion`: the range collapses and the element holds at
 * full size and full strength for the whole pass. It holds there before the
 * first measurement too, which is what keeps a prerendered page and the paint
 * after it from showing a wall of shrunken cards until the bundle lands.
 *
 * @param {object} [options]
 * @param {number} [options.scale] What a thing at the far end of its pass is
 *   scaled to, with 1 being the size it was laid out at.
 * @param {number} [options.dim] What it fades to over the same distance.
 * @param {[string, string]} [options.offset] `useScroll` offset window.
 * @param {object} [options.spring] `useSpring` config.
 * @returns {{ ref: import('react').MutableRefObject, transform: any, opacity: any }}
 *   `ref` attaches to the thing making the pass; `transform` is the `scale3d(...)`
 *   string and `opacity` its matching strength, both for `style`.
 */
export function useScrollFocus({
  scale = 0.93,
  dim = 0.72,
  offset = DEFAULT_OFFSET,
  spring = DEFAULT_SPRING,
} = {}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const [measured, setMeasured] = useState(false)

  useEffect(() => setMeasured(true), [])

  const still = reduced || !measured
  const { scrollYProgress } = useScroll({ target: ref, offset })
  const focus = useSpring(useTransform(scrollYProgress, PASS, still ? STILL : HELD), spring)
  const size = useTransform(focus, [0, 1], [scale, 1])
  const opacity = useTransform(focus, [0, 1], [dim, 1])
  const transform = useMotionTemplate`scale3d(${size}, ${size}, 1)`

  return { ref, transform, opacity }
}
