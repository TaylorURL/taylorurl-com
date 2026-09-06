import { createContext, useContext } from 'react'

/**
 * Data the build hands a route before rendering it to static HTML.
 *
 * Routes whose content lives in a database have nothing to show a crawler
 * unless the build fetches it first: an effect never runs during static
 * rendering, so the file on disk would be a loading shell with no title, no
 * description and no structured data. The prerender pass reads the rows once
 * and passes each route its own slice through this context.
 *
 * The browser gets the same provider holding null, so every consumer there
 * falls back to fetching. It is present rather than absent because the browser
 * adopts the prerendered markup instead of replacing it, and a provider on one
 * side only would renumber every id React generates below it.
 */
export const PrerenderDataContext = createContext(null)

/** @returns {object|null} The current route's seed, or null in the browser. */
export function usePrerenderData() {
  return useContext(PrerenderDataContext)
}
