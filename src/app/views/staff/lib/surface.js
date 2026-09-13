import { useEffect, useRef } from 'react'
import { useMediaQuery } from '@hooks/useMediaQuery'

/** How far the column travels before the head starts casting over it. */
const CAST_AT = 4

/**
 * Whether the column has moved under the head, written to the head as an
 * attribute rather than held in state.
 *
 * A bar only throws a shadow onto something. Until the column has scrolled there
 * is nothing under the head but the top of the first line, and a bar casting
 * over a page that is sitting at its own top reads as a bar stuck to the page
 * rather than one held above it. The site's own navigation settled this the same
 * way and calls it `data-surfaced`, so the staff bars answer to the same name.
 *
 * The scroll position never reaches React: a representative scrolls the call
 * screen with a thumb while reading it, and re-rendering the whole column on
 * every frame of that is a screen that stutters under the thing it is for.
 *
 * @returns {{scroll: React.RefObject<HTMLElement>, head: React.RefObject<HTMLElement>}}
 */
export function useSurfaced() {
  const scroll = useRef(null)
  const head = useRef(null)

  useEffect(() => {
    const column = scroll.current
    if (!column) return undefined
    let cast = null
    const read = () => {
      const now = column.scrollTop > CAST_AT
      if (now === cast) return
      cast = now
      head.current?.setAttribute('data-surfaced', String(now))
    }
    read()
    column.addEventListener('scroll', read, { passive: true })
    return () => column.removeEventListener('scroll', read)
  }, [])

  return { scroll, head }
}

/**
 * Whether the screen is a desk rather than a phone, read once and kept current.
 *
 * The one thing on these screens that changes shape between the two rather
 * than merely reflowing is the script on the call screen: a fold a thumb opens
 * on a phone, and a column that is simply there on a desk. A `<details>` cannot
 * be opened by a stylesheet, so the screen has to know which it is drawing for.
 *
 * @param {string} [query] The width a desk starts at.
 * @returns {boolean}
 */
export function useDesk(query = '(min-width: 1024px)') {
  return useMediaQuery(query, { readWhileRendering: true })
}
