import { useEffect, useState } from 'react'
import { THEME_EVENT } from '@hooks/useTheme'

// What a token reads as before a document exists to read it from. The prerender
// pass is the only place that happens, and the layers that use this draw in the
// browser, so nothing is ever painted with it.
const UNRESOLVED = 'transparent'

function read(names, scope) {
  if (typeof window === 'undefined') {
    return Object.fromEntries(names.map(name => [name, UNRESOLVED]))
  }
  const from = scope?.current || document.documentElement
  const style = window.getComputedStyle(from)
  return Object.fromEntries(
    names.map(name => [name, style.getPropertyValue(name).trim() || UNRESOLVED])
  )
}

/**
 * Design tokens as values a canvas or a shader can use.
 *
 * WebGL and the 2D canvas take a colour string but resolve nothing: `var(--x)`
 * reaches them as a literal that parses to black. So the tokens are read off the
 * document and handed over as the values they hold, which keeps the drawn layers
 * on the same palette as the CSS around them rather than a second copy of it.
 *
 * The first read happens during the first render, so a shader never draws a
 * frame in a colour it has to correct afterwards.
 *
 * A custom property has no change event, so the read is taken again when the
 * document's theme is stamped. Without it a canvas keeps the palette it was
 * mounted in while the CSS around it moves to the other one.
 *
 * @param {string[]} names - custom property names, including the leading `--`.
 * @param {React.RefObject<Element>} [scope] - element to read from, when the
 *   value depends on a theme scope rather than the root.
 * @returns {Record<string, string>} each name, resolved.
 */
export function useThemeTokens(names, scope) {
  // The list is written inline at the call site, so its identity changes every
  // render; its contents are what the read depends on.
  const key = names.join(',')
  const [resolved, setResolved] = useState(() => read(names, scope))

  useEffect(() => {
    const reread = () => {
      const next = read(key.split(','), scope)
      setResolved(current =>
        Object.keys(next).every(name => current[name] === next[name]) ? current : next
      )
    }
    reread()
    window.addEventListener(THEME_EVENT, reread)
    return () => window.removeEventListener(THEME_EVENT, reread)
  }, [key, scope])

  return resolved
}
