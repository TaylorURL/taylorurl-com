import { useRef } from 'react'
import {
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'

const DEFAULT_OFFSET = ['start end', 'end start']
const DEFAULT_SPRING = { stiffness: 120, damping: 30, mass: 0.5 }

/**
 * Scroll-driven (scroll-as-playhead) parallax. The section's scroll progress
 * IS the animation timeline — scrolling up runs it backward. A spring lags the
 * raw progress slightly so the motion feels physical instead of locked to the
 * pointer. Output is a full `translate3d` string fed into `style={{ transform }}`
 * for compositor-thread (hardware accelerated) animation; `x` / `y` shorthand
 * props would put it back on the main thread.
 *
 * Honors `prefers-reduced-motion`: the position range collapses to [0, 0] so
 * the element holds still while opacity stays unaffected.
 *
 * @param {object} [options]
 * @param {[number, number]} [options.range] Pixel distance to drift across the
 *   section, mapped to scroll progress 0 → 1 (e.g. `[80, -80]` to rise).
 * @param {[string, string]} [options.offset] `useScroll` offset window.
 * @param {object} [options.spring] `useSpring` config — keep light so the lag
 *   stays subtle.
 * @returns {{ ref: import('react').MutableRefObject, transform: any, value: any }}
 *   `ref` attaches to the scrolling section; `transform` is the
 *   `translate3d(...)` string; `value` is the raw spring motion value if you
 *   want to compose further transforms (scale, opacity ranges, etc.).
 */
export function useScrollParallax({
  range = [0, -60],
  offset = DEFAULT_OFFSET,
  spring = DEFAULT_SPRING,
} = {}) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset })
  const target = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : range)
  const value = useSpring(target, spring)
  const transform = useMotionTemplate`translate3d(0, ${value}px, 0)`
  return { ref, transform, value, scrollYProgress }
}
