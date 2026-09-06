import { useCallback, useEffect, useState } from 'react'
import { useMotionValueEvent, useScroll } from 'framer-motion'

/**
 * Fired by a section that has changed the ground beneath the fixed chrome
 * without the page moving. Anything sampling the background listens for it.
 */
export const GROUND_CHANGE = 'taylorurl:ground-change'

/** Announce a ground change once the swap has finished painting. */
export function announceGroundChange() {
  window.dispatchEvent(new Event(GROUND_CHANGE))
}

const DARK_LUMINANCE_THRESHOLD = 0.45

/**
 * One background colour, as channels in 0-255 and an alpha in 0-1.
 *
 * Computed style answers in `rgb()` and `rgba()` for most colours and in
 * `color(<space> r g b / a)` for any that came through a wide-gamut path, and
 * the two carry their channels on different scales. Reading the second as
 * though it were the first turns white into black, so the space name is
 * dropped and the form decides the scale.
 */
function parseColor(value) {
  if (!value || value === 'transparent') return null
  const wide = value.startsWith('color(')
  const numbers = (wide ? value.slice(value.indexOf(' ') + 1) : value).match(/[\d.]+/g)
  if (!numbers || numbers.length < 3) return null
  const scale = wide ? 255 : 1
  const [r, g, b] = numbers.slice(0, 3).map(n => Number(n) * scale)
  return { r, g, b, alpha: numbers.length > 3 ? Number(numbers[3]) : 1 }
}

/**
 * The colour actually painted at a point, composited from the layers over it.
 *
 * The topmost layer carrying a colour is rarely the ground. A scrim, a tint or
 * a wash sits over the thing that decides what the ground is, so taking the
 * first colour found reads a 45% black curtain as a black page - which is how
 * the bar came to hold light ink over a light page after a panel was open
 * during a page change. Every layer is laid over the one behind it instead,
 * front to back, until the accumulated colour is opaque.
 *
 * Only the colour's own alpha is read, never the element's opacity. A section
 * arriving on a page change spends that change at an opacity the ground it is
 * about to be does not have, and a reading that took it would answer for a
 * frame rather than for the page. A layer part way through fading can only
 * pull the answer toward the middle, since what is behind it is in the
 * composite too.
 */
function backgroundAtPoint(x, y, ignoreEls) {
  let r = 0
  let g = 0
  let b = 0
  let covered = 0
  for (const el of document.elementsFromPoint(x, y)) {
    if (ignoreEls.some(node => node && node.contains(el))) continue
    const colour = parseColor(window.getComputedStyle(el).backgroundColor)
    if (!colour || colour.alpha <= 0) continue
    const share = (1 - covered) * colour.alpha
    r += share * colour.r
    g += share * colour.g
    b += share * colour.b
    covered += share
    if (covered >= 0.995) break
  }
  // Nothing opaque under the point. What is left shows the canvas, which is
  // white until a page paints over it.
  const rest = 1 - covered
  return (0.299 * (r + rest * 255) + 0.587 * (g + rest * 255) + 0.114 * (b + rest * 255)) / 255
}

/**
 * Whether the section sitting behind a fixed overlay is dark, so the overlay
 * can pick its ink from what is actually under it.
 *
 * The centre of `probeRef` is the sampled point. `ignoreRefs` names the
 * subtrees to look through rather than at — the overlay's own chrome above
 * all, which would otherwise answer with its own background every time.
 *
 * A view arriving in its own chunk lands after the last reading was taken, so
 * it announces itself with `announceGroundChange` and the reading is retaken.
 *
 * @param {{current: Element|null}} probeRef - The element whose centre is sampled.
 * @param {Array<{current: Element|null}>} [ignoreRefs] - Subtrees to look
 *   through rather than at.
 * @returns {boolean} Whether the ground behind the probe is dark.
 */
export function useOnDarkBackground(probeRef, ignoreRefs = []) {
  const [onDark, setOnDark] = useState(false)

  const check = useCallback(() => {
    const el = probeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ignoreNodes = ignoreRefs.map(ref => ref?.current).filter(Boolean)
    setOnDark(
      backgroundAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, ignoreNodes) <
        DARK_LUMINANCE_THRESHOLD
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probeRef, ...ignoreRefs])

  // Sampling reads layout and computed style, so it rides the batched scroll
  // value rather than a listener that would force that read on every event.
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', check)

  // GROUND_CHANGE is for a surface that swaps its own ground while the page
  // sits still - the homepage hero rotating between a dark presentation and a
  // paper one. Scroll and resize never fire for it, so it says so instead.
  useEffect(() => {
    check()
    window.addEventListener('resize', check, { passive: true })
    window.addEventListener(GROUND_CHANGE, check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener(GROUND_CHANGE, check)
    }
  }, [check])

  return onDark
}
