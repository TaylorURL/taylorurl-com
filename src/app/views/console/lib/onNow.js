/**
 * Who is on the sites right now, read off the live feed for the console's
 * overview. Pure, so the check can run it against the feed's own shape.
 */

import { sourceLabel } from '../../analytics/lib/sources.js'

/**
 * Everybody on the sites in scope right now, put together by the page they
 * have open and what sent them there, with how many of them that is.
 *
 * Five people reading the front page after typing the address in are one row
 * that says five, not five rows that say the same thing. Two spellings of one
 * source - `www.google.com` and `google.com` - are one source to the reader, so
 * they are put together under the name it shows; a tagged link's campaign is
 * part of where somebody came from, so it keeps its own row.
 *
 * The busiest row leads; between two the same size, the one somebody arrived
 * at most recently. A reader whose arrival is not on record counts in its row
 * and moves nothing up.
 *
 * The scope is read from the set of ids rather than from the window's rows,
 * which empty for the length of every window change and would take the live
 * list with them for no reason the live feed knows about. An empty set is every
 * site the account holds.
 */
export function visitorGroups(liveSites, siteIds) {
  const held = siteIds.length ? new Set(siteIds) : null
  const groups = new Map()
  for (const entry of liveSites) {
    if (held && !held.has(entry.site_id)) continue
    for (const one of entry.visitors || []) {
      const path = one.path || '/'
      const source = sourceLabel(one.source)
      const campaign = one.campaign || null
      const key = [entry.site_id, path, source, campaign ?? ''].join('\n')
      const group = groups.get(key) ?? {
        key,
        site: entry.name,
        path,
        source,
        campaign,
        n: 0,
        latest: 0,
      }
      group.n += 1
      group.latest = Math.max(group.latest, Date.parse(one.started_at ?? '') || 0)
      groups.set(key, group)
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.n - a.n || b.latest - a.latest || a.key.localeCompare(b.key)
  )
}
