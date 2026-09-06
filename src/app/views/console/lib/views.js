import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Which of a section's views is open, held in the address rather than in
 * state.
 *
 * A section with more than one thing to show splits into views, and the one
 * that is open is part of where the reader is: the back button returns to the
 * view they left, a reload lands on the one they were reading, and a link
 * from one section into a particular view of another is an address rather
 * than a click to be repeated. So the view is a search parameter, and so is
 * whatever the view was opened on - a business, a letter, a tab inside the
 * view - which `go` sets in the same move.
 *
 * The first view is the section's own and carries no parameter, so the plain
 * address of a section is still its front.
 *
 * @param {ReadonlyArray<{key: string}>} views The views, first one default.
 * @param {{key?: string}} [options] The parameter the view is held under.
 * @returns {[string, (next: string, extra?: Record<string, string|number|null|undefined>) => void, URLSearchParams]}
 *   The open view, the move to another, and every parameter as it stands.
 */
export function useView(views, { key = 'view' } = {}) {
  const [params, setParams] = useSearchParams()
  const fallback = views[0].key
  const held = params.get(key)
  const view = views.some(one => one.key === held) ? held : fallback

  const go = useCallback(
    (next, extra = {}) => {
      setParams(current => {
        const search = new URLSearchParams(current)
        if (!next || next === fallback) search.delete(key)
        else search.set(key, next)
        for (const [name, value] of Object.entries(extra)) {
          if (value === null || value === undefined || value === '') search.delete(name)
          else search.set(name, String(value))
        }
        return search
      })
    },
    [setParams, key, fallback]
  )

  return [view, go, params]
}
