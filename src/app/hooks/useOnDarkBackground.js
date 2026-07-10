import { useCallback, useEffect, useState } from 'react'

const DARK_LUMINANCE_THRESHOLD = 0.45

function isDarkColor(rgb) {
  if (!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return null
  const match = rgb.match(/\d+/g)
  if (!match || match.length < 3) return null
  const [r, g, b] = match.map(Number)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance < DARK_LUMINANCE_THRESHOLD
}

function getBackgroundAtPoint(x, y, ignoreEls) {
  const els = document.elementsFromPoint(x, y)
  for (const el of els) {
    if (ignoreEls.some(node => node && node.contains(el))) continue
    const dark = isDarkColor(window.getComputedStyle(el).backgroundColor)
    if (dark !== null) return dark
  }
  return false
}

/**
 * Tracks whether the section directly behind a probe element has a dark
 * background. Returns a stable boolean that flips as the user scrolls past
 * dark/light section boundaries. Use to drive theme-aware overlay chrome
 * (nav, indicators) so text/icons stay readable over any section.
 *
 * @param {React.RefObject<HTMLElement>} probeRef Element whose center is sampled.
 * @param {React.RefObject<HTMLElement>[]} [ignoreRefs] Refs whose subtrees should
 *   be skipped during sampling (e.g. the overlay chrome itself).
 * @returns {boolean} True when the section behind the probe is dark.
 */
export function useOnDarkBackground(probeRef, ignoreRefs = []) {
  const [onDark, setOnDark] = useState(false)

  const check = useCallback(() => {
    const el = probeRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ignoreNodes = ignoreRefs.map(ref => ref?.current).filter(Boolean)
    setOnDark(
      getBackgroundAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, ignoreNodes)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probeRef, ...ignoreRefs])

  useEffect(() => {
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check, { passive: true })
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [check])

  return [onDark, check]
}
