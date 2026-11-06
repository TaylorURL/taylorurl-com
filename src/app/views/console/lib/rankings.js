import { sourceLabel } from '../../analytics/lib/sources.js'

/**
 * The two rankings under the traffic chart, counted in people.
 *
 * Both used to count something other than the figure above them: the pages in
 * every load, so one reader going back to the front page five times put it
 * past the site's whole visitor count, and the sources in visits, so a person
 * who came twice was two arrivals. Counted in people, a page can never show
 * more than the Visitors figure above it, and the sources add up to it, since
 * the collector files each person under where their first visit came from.
 *
 * A row from a collector older than the `visitors` field falls back to what it
 * did carry, so the lists still draw while the two are out of step.
 */

// A ranking holds the head of the list. The tail is a run of single visits that
// says nothing the first eight have not.
export const LISTED = 8

/** A page row's count of the people who opened it. */
export function pageVisitors(page) {
  return page?.visitors ?? page?.pageviews ?? 0
}

/** The pages most people opened, most first. */
export function topPages(pages, listed = LISTED) {
  return [...(pages || [])]
    .sort(
      (a, b) =>
        pageVisitors(b) - pageVisitors(a) ||
        (b.pageviews || 0) - (a.pageviews || 0) ||
        String(a.path).localeCompare(String(b.path))
    )
    .slice(0, listed)
}

/**
 * Arrivals by where they came from, named the way a reader says them.
 *
 * Two spellings of one host - `www.google.com` and `google.com` - are one
 * source to the person reading the list, so they are added together under the
 * name it shows rather than listed twice. Each person is filed under one host,
 * so adding the spellings together never counts anybody twice.
 */
export function bySource(referrers, listed = LISTED) {
  const merged = new Map()
  for (const row of referrers || []) {
    const name = sourceLabel(row.source)
    merged.set(name, (merged.get(name) || 0) + (row.visitors ?? row.sessions ?? 0))
  }
  return [...merged]
    .map(([name, visitors]) => ({ name, visitors }))
    .sort((a, b) => b.visitors - a.visitors || a.name.localeCompare(b.name))
    .slice(0, listed)
}
