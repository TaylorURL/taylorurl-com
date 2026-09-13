import { useEffect, useRef } from 'react'

/**
 * Closes an open menu when the reader presses anywhere outside it, or presses
 * Escape.
 *
 * A menu left open behind a press elsewhere is one the reader dismisses twice.
 * Escape closes it too, and hands focus back to the control that opened it
 * rather than dropping the reader at the top of the document.
 *
 * Bound only while the menu is open, and reading the close through a ref, so a
 * parent that re-renders while it is open does not tear the listeners down and
 * put identical ones back on each pass.
 *
 * @param {boolean} open - whether the menu is showing
 * @param {{current: HTMLElement|null}} holder - the element holding the menu and its control
 * @param {string} trigger - the selector, inside `holder`, of the control focus goes back to
 * @param {() => void} onClose
 */
export function useDismiss(open, holder, trigger, onClose) {
  const latest = useRef(onClose)
  latest.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const away = event => {
      if (!holder.current?.contains(event.target)) latest.current()
    }
    const key = event => {
      if (event.key !== 'Escape') return
      latest.current()
      holder.current?.querySelector(trigger)?.focus()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open, holder, trigger])
}
