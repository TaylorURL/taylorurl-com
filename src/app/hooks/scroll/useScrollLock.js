import { useEffect } from 'react'

/**
 * Holds the page still under a layer laid over it, and puts it back exactly
 * where it was once the layer closes.
 *
 * The root is what scrolls here, so the root is what is held; releasing the
 * clamp without restoring the offset drops the reader wherever it left them,
 * which is a jump they did not ask for on the way out. The restore is instant
 * on purpose - the page is already where it was and gliding there would
 * animate a move that never happened.
 *
 * @param {boolean} [holding] - Whether the layer is open. A layer that only
 *   exists while it is open leaves it out.
 */
export function useScrollLock(holding = true) {
  useEffect(() => {
    if (!holding) return undefined
    const held = window.scrollY
    const root = document.documentElement
    const heldOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      root.style.overflow = heldOverflow
      document.body.style.overflow = ''
      window.scrollTo({ top: held, behavior: 'instant' })
    }
  }, [holding])
}
