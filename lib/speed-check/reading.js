/**
 * What a visitor asking about their own site is allowed, and what they get back.
 *
 * The arithmetic and the shaping live here rather than in the endpoint because
 * both decide things a test should be able to settle without a network or a
 * database: whether an address is one worth answering, whether a caller has
 * asked too often, whether a reading taken earlier still stands, and what the
 * page is handed once it does.
 *
 * The reading itself is not composed here. It comes from the same two modules
 * the outreach pipeline reads its own from, so a figure quoted on the page and
 * a figure quoted in a message are the same figure with the same meaning behind
 * it.
 */

import { normalise, shapeOf } from '../outreach/prospects/address.js'
import { GOOD_FLOOR, bandOf, supporting, verdict, verify } from '../outreach/audit/bands.js'

/**
 * The ceilings, in the order they are counted.
 *
 * A reading costs a PageSpeed report and a rendered screenshot, so a public
 * field pointing at both is a bill anybody can run up. The per-caller ceilings
 * are what a person doing this for their own site never notices and a script
 * walking a list of domains reaches immediately; the daily one is the ceiling
 * that holds when the caller changes address between requests.
 */
const LIMITS = {
  perCallerHour: 3,
  perCallerDay: 8,
  perEmailDay: 3,
  perDay: 150,
}

/** How long a reading of one host stands in for the next request about it. */
const FRESH_MS = 6 * 60 * 60 * 1000

/** The window the per-caller and per-address ceilings are counted over. */
export const HOUR_MS = 60 * 60 * 1000
export const DAY_MS = 24 * HOUR_MS

// The five Lighthouse metrics the performance score is built from, under the
// names the report stores them by. The order is the order the report weighs
// them in, which is the order they are worth reading in.
const METRIC_LABELS = [
  ['largest_contentful_paint', 'Largest Contentful Paint'],
  ['total_blocking_time', 'Total Blocking Time'],
  ['cumulative_layout_shift', 'Cumulative Layout Shift'],
  ['first_contentful_paint', 'First Contentful Paint'],
  ['speed_index', 'Speed Index'],
]

// The four categories one report answers for, against the columns holding them.
// Performance leads because it is the figure the reading is about.
const CATEGORY_LABELS = [
  ['audit_score', 'Performance'],
  ['accessibility_score', 'Accessibility'],
  ['best_practices_score', 'Best Practices'],
  ['seo_score', 'SEO'],
]

/**
 * The refusals that are the outreach sender's business and not this form's.
 * Each says who an address reaches, not whether it can receive mail.
 */
const SENDERS_OWN = new Set(['role_box', 'not_a_person', 'platform', 'held_domain'])

/**
 * The address to answer to, or the reason it will not be taken.
 *
 * A role or shared mailbox passes here where the outreach sender refuses one:
 * `info@` is the wrong address to write to a stranger at and the right one for
 * a shop owner to give for their own shop. A throwaway domain does not
 * pass, because an address nobody has to keep is the shape a free reading gets
 * farmed with.
 *
 * @param {string} value Whatever was typed in the field.
 * @returns {{ email: string } | { fault: string }}
 */
export function readEmail(value) {
  const email = normalise(value)
  if (!email) return { fault: 'Enter an email address.' }

  const refused = shapeOf(email)
  if (refused?.reason === 'disposable') {
    return { fault: 'That is a throwaway address. Use one you can be reached at.' }
  }
  if (refused && !SENDERS_OWN.has(refused.reason)) {
    return { fault: 'That does not look like an email address.' }
  }

  return { email }
}

/**
 * Whether a ceiling has been reached, and which.
 *
 * The counts are taken from the ledger rather than from anything held in a
 * function instance, because the ceilings that matter are the ones that hold
 * across every instance the platform happens to be running.
 *
 * @param {{callerHour: number, callerDay: number, emailDay: number, day: number}} counts
 * @returns {string|null} The sentence to answer with, or null to go ahead.
 */
export function overCeiling(counts) {
  if (counts.callerHour >= LIMITS.perCallerHour || counts.callerDay >= LIMITS.perCallerDay) {
    return 'That is as many checks as this connection gets today. Get in touch and the reading comes with a person attached.'
  }
  if (counts.emailDay >= LIMITS.perEmailDay) {
    return 'That address has had its checks for today. Get in touch and the reading comes with a person attached.'
  }
  if (counts.day >= LIMITS.perDay) {
    return 'The checks for today have all been run. Try again tomorrow, or get in touch.'
  }
  return null
}

/**
 * A finished reading of the same host that is recent enough to stand in for a
 * fresh one.
 *
 * Two people asking about one site inside an afternoon get one report between
 * them. The figure moves a few points between runs and the band it sits in does
 * not, so the second reader loses nothing a second report would have given
 * them, and the quota keeps a run for somebody asking about a site nobody has
 * measured yet.
 *
 * @param {object|null} row The most recent finished reading of that host.
 * @param {number} [now]
 * @returns {boolean}
 */
export function stillFresh(row, now = Date.now()) {
  if (!row?.created_at || row.status !== 'done') return false
  const taken = new Date(row.created_at).getTime()
  if (!Number.isFinite(taken)) return false
  return now - taken < FRESH_MS
}

/** One category, as the card draws it. */
const categoryOf = (row, column, label) => ({
  label,
  value: typeof row[column] === 'number' ? row[column] : null,
  band: bandOf(row[column]),
})

/**
 * The reading, in the shape the page draws.
 *
 * Built from a stored row rather than from a report, so a reading answered from
 * an earlier run and a reading measured a second ago arrive identical and the
 * page cannot tell which it is drawing.
 *
 * @param {object} row A row from `speed_checks` at status 'done'.
 * @returns {object} What the page is handed.
 */
export function readingFor(row) {
  const raw = row.audit_raw ?? {}
  const metrics = raw.metrics ?? {}

  return {
    site: row.site,
    host: row.host,
    score: typeof row.score === 'number' ? row.score : null,
    band: bandOf(row.score),
    verdict: verdict(row.score),
    goodFloor: GOOD_FLOOR,
    categories: CATEGORY_LABELS.map(([column, label]) => categoryOf(row, column, label)),
    short: supporting(row),
    metrics: METRIC_LABELS.filter(([name]) => metrics[name]?.display).map(([name, label]) => ({
      label,
      display: metrics[name].display,
    })),
    opportunities: (raw.opportunities ?? []).map(entry => ({
      title: entry.title,
      savings: Math.round((entry.savings_ms ?? 0) / 100) / 10,
    })),
    shot: row.shot_url ?? null,
    measuredAt: row.created_at ?? null,
    // The same check the outreach letters carry, run on the address this reading was taken on.
    verify: verify(row.site),
  }
}
