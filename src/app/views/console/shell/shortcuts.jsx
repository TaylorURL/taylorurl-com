import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { MODIFIER } from '../lib/useConsoleShortcuts'

/**
 * The written half of the keyboard: the list a reader opens with `?` to find
 * out what the keys do. Three rows, because there are three keys.
 *
 * This is the help, and it is the reason `?` is worth one of the three: the
 * other two carry a modifier and are invisible until somebody says what they
 * are. A set of shortcuts with nothing that lists them is a set only its author
 * knows.
 *
 * The modifier is drawn as the one the reader's own keyboard carries. A Mac
 * shown Ctrl and a PC shown Command are each being told to press a key they do
 * not have.
 */

const KEYS = [
  { press: `${MODIFIER}K`, does: 'Search sections and sites' },
  { press: `${MODIFIER}B`, does: 'Narrow or widen the menu' },
  { press: '?', does: 'Open this list' },
]

export function ShortcutSheet({ open, onClose }) {
  const closer = useRef(null)
  useEffect(() => {
    if (open) closer.current?.focus()
  }, [open])

  if (!open) return null

  // Straight onto the body, because the console frame isolates itself and a
  // z-index inside an isolated element cannot rise past the chrome outside it.
  return createPortal(
    <div
      data-theme="console"
      className="console-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="console-modal-card">
        <header>
          <h2>Keyboard</h2>
          <button ref={closer} type="button" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </header>
        <ul>
          {KEYS.map(row => (
            <li key={row.press}>
              <span>{row.does}</span>
              <kbd>{row.press}</kbd>
            </li>
          ))}
        </ul>
        <p>Escape closes it.</p>
      </div>
    </div>,
    document.body
  )
}
