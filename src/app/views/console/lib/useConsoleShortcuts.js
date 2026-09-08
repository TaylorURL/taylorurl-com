import { useEffect, useRef, useState } from 'react'
import { isTyping } from '@utils/keyboard'

/**
 * The console's keyboard, which is three keys.
 *
 * A dashboard is used by somebody who came to look at a figure, not by somebody
 * learning an instrument, and a key that saves one click on a control already
 * on screen is a key nobody remembers. There were six here: four digits setting
 * a window that sits in the bar as four buttons, and a letter for a button
 * beside them. That is a shortcut list written for its own sake, and the digits
 * and the letter are gone.
 *
 * The two that are left both change the shape of the screen rather than press
 * something on it, which is the case where reaching for the pointer costs more
 * than the action is worth. Search reaches every section and every site from
 * wherever the reader is, which is the one thing the column cannot do at all
 * without scrolling it. The rail toggle gives the figures two hundred pixels
 * back, and it is wanted mid-read, halfway down a wide table, where the control
 * for it is at the far bottom corner of the screen. The list is how both are
 * found.
 *
 * Both carry a modifier, and they carry the ones every other application uses
 * for the same two things. A bare letter could not open the search anyway: the
 * next thing a reader typed would go to the page instead of the field.
 *
 * @param {object} props
 * @param {() => void} props.openSearch
 * @param {() => void} props.toggleRail
 */

/**
 * The modifier as this keyboard carries it, re-exported under the name the bar
 * and the sheet already reach it by. The console and the marketing bar both
 * draw a shortcut and both bind one, and two copies of the same platform sniff
 * is how a shortcut ends up printed one way and bound another.
 *
 * A hook rather than a constant. The bar is part of a page the browser adopts
 * from served markup, and a platform read once at import time answers for the
 * browser during the render that markup is checked against.
 */
export { useModifierLabel } from '@utils/keyboard'

export function useConsoleShortcuts({ openSearch, toggleRail }) {
  const [sheetOpen, setSheetOpen] = useState(false)

  // The handler reads these through a ref so it can be bound once. Rebinding it
  // on every figure that arrives would drop a press mid-flight.
  const latest = useRef({})
  latest.current = { openSearch, toggleRail }

  useEffect(() => {
    const onKeyDown = event => {
      const { openSearch: search, toggleRail: rail } = latest.current

      // Both modified keys work from inside a field, because a reader halfway
      // through typing a filter is exactly who wants to jump somewhere else or
      // widen the page. They are checked before the guard that turns the bare
      // key off.
      if (event.metaKey || event.ctrlKey) {
        const key = event.key.toLowerCase()
        if (key === 'k') {
          event.preventDefault()
          setSheetOpen(false)
          search?.()
        }
        if (key === 'b') {
          event.preventDefault()
          rail?.()
        }
        return
      }

      if (event.altKey) return
      if (isTyping(event.target)) return

      if (event.key === 'Escape') {
        setSheetOpen(false)
        return
      }
      if (event.key === '?') {
        event.preventDefault()
        setSheetOpen(open => !open)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { sheetOpen, closeSheet: () => setSheetOpen(false), openSheet: () => setSheetOpen(true) }
}
