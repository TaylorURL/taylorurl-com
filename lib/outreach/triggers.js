/**
 * The triggers that put a business on a chain, and the rules about moving one.
 *
 * Each triggered chain fires on something that just happened to one business -
 * a certificate that expired, a listing with no photographs, a site on a
 * builder it has outgrown, a run of new reviews, a business put aside months
 * ago. chainwork's adapters do the judging; this decides which businesses are
 * offered to them and what is written on a row that one of them matched.
 *
 * ## What may be moved
 *
 * A business already in a conversation is never moved. One that replied, asked
 * to stop, bounced, or has already been written to on a chain of its own is
 * left exactly where it is: a trigger is a reason to write to somebody nobody
 * is writing to, not a reason to interrupt. Nor is a business moved off a
 * chain it is part way through, because a chain that stops halfway reads as a
 * studio that lost interest.
 *
 * So the offer is narrow: a business that is enriched or further along, has an
 * address, carries no chain of its own yet, and has not been written to.
 *
 * ## The order between triggers
 *
 * A business can match two at once - a listing with no photographs on a site
 * whose certificate has expired. The stronger signal wins, and the strength is
 * the order the chains are swept in, which is the order of `TRIGGERS` below:
 * what is broken now, then what is missing, then what is old, then what is
 * growing, then asking again. The first match stands and the rest are passed
 * over, so a business hears about the thing it would fix first.
 *
 * ## What is written
 *
 * The chain, the fault, and the sentence the letter opens on. The sentence is
 * stored rather than composed again at send time, because the figure in it was
 * true when the fault was found: a letter that recomputed it would say a
 * certificate expires in three days when the row was swept three days ago.
 */

import { listingSource } from 'chainwork/adapters/listing/judge.js'
import { builderSource } from 'chainwork/adapters/builder/judge.js'
import { growthSource } from 'chainwork/adapters/growth/judge.js'
import { reactivationSource } from 'chainwork/adapters/reactivation/judge.js'
import { siteHealthSource } from 'chainwork/adapters/site-health/visit.js'
import { timedFetch } from '../http/timed.js'

/** Columns a trigger reads, which is everything any of them judges on. */
export const TRIGGER_COLUMNS =
  'id, name, website, place_id, stage, source, chain, site_kind, business_status, ' +
  'place_photos, rating_count, rating_count_first, created_at, updated_at, contacted_at, ' +
  'replied_at, bounced_at, skip_reason, email'

/** Businesses offered to the triggers at a time, so one run is bounded. */
export const TRIGGER_BATCH = 300

/** How long a page is given to answer while a builder is being read off it. */
const READ_TIMEOUT_MS = 10_000

/** How much of a page is read, which is far past where a builder names itself. */
const READ_BYTES = 200_000

/**
 * Whether a business may be offered to a trigger at all.
 *
 * Read here rather than in the database query because two of the rules are
 * about absence - no chain, never written to - and a query that expressed all
 * of them would be a condition nobody could read against the sentence above.
 */
export function movable(row) {
  if (!row?.email) return false
  if (row.replied_at || row.bounced_at) return false
  if (row.contacted_at) return false
  if (row.chain) return false
  return ['enriched', 'audited', 'queued'].includes(String(row.stage ?? ''))
}

/** The page a builder is read off, bounded so one slow site cannot stall a sweep. */
async function readPage(website) {
  const address = /^https?:\/\//i.test(website) ? website : `https://${website}`
  const answer = await timedFetch(
    address,
    { redirect: 'follow', headers: { accept: 'text/html' } },
    READ_TIMEOUT_MS
  )
  if (!answer?.ok) throw new Error(`the page answered ${answer?.status ?? 'nothing'}`)
  const page = await answer.text()
  return page.slice(0, READ_BYTES)
}

/**
 * The triggers, strongest signal first.
 *
 * `chain` is what a matched business is put on, and it is named here rather
 * than taken from the source's name so the two can be read side by side: a
 * trigger and the chain it feeds are different things and one day a chain will
 * have two triggers.
 *
 * @param {() => Promise<object[]>} rows Answers the businesses to offer.
 */
export function triggersFor(rows) {
  return [
    { chain: 'broken-site', source: siteHealthSource({ rows, how: { fetch: timedFetch } }) },
    { chain: 'listing', source: listingSource({ rows }) },
    { chain: 'builder', source: builderSource({ rows, read: readPage }) },
    { chain: 'growing', source: growthSource({ rows }) },
    { chain: 'again', source: reactivationSource({ rows }) },
  ]
}

/**
 * What a matched business has written on it.
 *
 * @param {string} chain The chain it goes on.
 * @param {object} payload What the trigger found.
 * @param {Date} now
 */
export function patchFor(chain, payload, now = new Date()) {
  return {
    chain,
    fault: payload?.fault ?? null,
    fault_says: payload?.says ?? null,
    fault_at: payload?.fault_at ?? null,
    fault_checked_at: payload?.checked_at ?? now.toISOString(),
    fault_payload: payload ?? null,
  }
}

/**
 * The first match for each business across every trigger, in trigger order.
 *
 * @param {Array<{chain: string, found: object[]}>} swept One entry per trigger,
 *   strongest first.
 * @returns {Map<string, {chain: string, payload: object}>} Keyed on the row id.
 */
export function firstMatches(swept) {
  const held = new Map()
  for (const { chain, found } of swept) {
    for (const row of found ?? []) {
      if (held.has(row.ref)) continue
      held.set(row.ref, { chain, payload: row.payload })
    }
  }
  return held
}
