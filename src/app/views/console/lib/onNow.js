/**
 * Who is on the sites right now, read off the live feed for the console's
 * overview. Pure, so the check can run it against the feed's own shape.
 */

import { sourceLabel } from '../../analytics/lib/sources.js'

/**
 * Everybody on the sites in scope right now, newest arrival first, each with
 * the page they have open and what sent them there.
 *
 * The scope is read from the set of ids rather than from the window's rows,
 * which empty for the length of every window change and would take the live
 * list with them for no reason the live feed knows about. An empty set is every
 * site the account holds.
 *
 * A reader whose arrival is not on record sorts last, since nothing says when
 * they got here.
 */
export function visitorsOnNow(liveSites, siteIds) {
  const held = siteIds.length ? new Set(siteIds) : null
  const began = one => Date.parse(one.started_at ?? '') || 0
  return liveSites
    .filter(entry => !held || held.has(entry.site_id))
    .flatMap(entry =>
      (entry.visitors || []).map(one => ({
        key: `${entry.site_id} ${one.ref}`,
        site: entry.name,
        path: one.path || '/',
        source: sourceLabel(one.source),
        campaign: one.campaign || null,
        started_at: one.started_at ?? null,
      }))
    )
    .sort((a, b) => began(b) - began(a) || a.key.localeCompare(b.key))
}
