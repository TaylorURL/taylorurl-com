import { useEffect, useState } from 'react'

/**
 * Whether a media query matches, kept current as it changes.
 *
 * It answers false until it has measured, which is what a component written to
 * static HTML needs: the prerendered page and the render that adopts it agree,
 * and whatever turns on the answer arrives with the browser. A component the
 * prerender never draws can ask while rendering instead, with
 * `readWhileRendering`, so its first frame is already the right one.
 *
 * @param {string} query - The query, as `matchMedia` takes it.
 * @param {{ readWhileRendering?: boolean }} [options]
 * @returns {boolean}
 */
export function useMediaQuery(query, { readWhileRendering = false } = {}) {
  const [matches, setMatches] = useState(() =>
    readWhileRendering && typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )

  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setMatches(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [query])

  return matches
}
