import { useEffect, useRef } from 'react'
import { isTyping } from '@utils/keyboard'

/**
 * Opens the site search from the keyboard, from anywhere on the page.
 *
 * Two bindings, because the two habits are both real: the modifier one every
 * application has taught, and the bare slash the reader who lives in a browser
 * already uses. The slash asks whether the press belongs to a field first --
 * the contact form has a message box in it, and a shortcut that eats a
 * character out of somebody's sentence is worse than no shortcut.
 *
 * The modifier pair is not gated that way on purpose: a reader who is halfway
 * through typing into the speed check box and reaches for the search is asking
 * for the search, and no field on the site wants that combination for itself.
 *
 * Bound once on the window and reading the callback through a ref, so a parent
 * that re-renders on every keystroke does not tear the listener down and put an
 * identical one back on each pass.
 */
export function useSearchShortcut(onOpen) {
  const latest = useRef(onOpen)
  latest.current = onOpen

  useEffect(() => {
    const handleKeyDown = event => {
      // Something nearer the press has already claimed it -- an open dialog
      // walking its own rows, or a field with its own binding.
      if (event.defaultPrevented) return

      if (event.metaKey || event.ctrlKey) {
        if (event.altKey || event.key.toLowerCase() !== 'k') return
        event.preventDefault()
        latest.current()
        return
      }

      if (event.key !== '/' || isTyping(event.target)) return
      event.preventDefault()
      latest.current()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
