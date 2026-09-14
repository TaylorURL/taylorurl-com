/**
 * One business's audit, read off its row the way a person on a call reads it.
 *
 * The audit job writes four scores, the moment it took them and a trimmed copy
 * of the report, and it writes them for a business with a site of its own. The
 * call list is made of the businesses that have no site of their own, so on
 * most of its rows there is nothing here to read - and the difference between
 * "never measured" and "measured, and the number is nought" is the whole of
 * what this module has to keep straight. A score is only ever a number the
 * report answered with; an absence is said as the absence it is.
 *
 * Strings and pure functions only. The call screen imports this into the
 * browser bundle beside `calls.js`, and the email that carries the same
 * reading imports it on the server, so the two cannot disagree about what a
 * row says.
 */

import { CATEGORIES, GOOD_FLOOR, bandOf } from './bands.js'
import { hostOf, platformName, platformOf } from '../prospects/platforms.js'

/** The columns a reading is taken from, for a select that has to name them. */
export const AUDIT_COLUMNS = Object.freeze([
  'audit_score',
  'accessibility_score',
  'best_practices_score',
  'seo_score',
  'audit_at',
  'audit_raw',
])

/** Savings the report names that are worth a sentence, in the order shown. */
const ISSUE_LIMIT = 4

/**
 * What the report's largest savings mean, said for the person who owns the
 * page rather than the person who built it.
 *
 * Lighthouse titles its audits for developers - "Reduce unused JavaScript",
 * "Eliminate render-blocking resources" - and read aloud to a shop owner those
 * are noise. Each id the report commonly names is given the sentence a caller
 * would say instead. An id not listed falls back to the report's own title,
 * which is still true, just not plain.
 */
const PLAIN_ISSUES = Object.freeze({
  'unused-javascript':
    'The page loads code it never uses, which is time a phone spends before it shows anything.',
  'unused-css-rules': 'The page loads styling it never uses, which slows the first paint.',
  'render-blocking-resources':
    'Files have to finish downloading before anything appears, so the screen stays blank longer than it needs to.',
  'server-response-time': 'The server is slow to answer, so every visit starts late.',
  redirects: 'The address bounces through more than one redirect before the page arrives.',
  'modern-image-formats':
    'The photos are saved in older formats that are bigger than they need to be.',
  'uses-optimized-images':
    'The photos are larger files than the page needs, so they take longer to arrive.',
  'uses-responsive-images':
    'Phones are sent desktop-sized photos and have to download far more than they show.',
  'offscreen-images': 'Pictures further down the page are loaded before the top of it is ready.',
  'efficient-animated-content':
    'An animated image is doing the work a short video would do at a fraction of the size.',
  'uses-text-compression':
    'The page is sent uncompressed, so it is bigger over the wire than it has to be.',
  'uses-long-cache-ttl':
    'Returning visitors download the whole page again instead of reusing what their phone already has.',
  'total-byte-weight': 'The page is heavy, which is what a slow connection feels most.',
  'legacy-javascript':
    'The page ships code for browsers nobody uses any more, on top of the code for the ones they do.',
  'unminified-javascript':
    'The code is sent in its long form rather than the compact one browsers need.',
  'unminified-css':
    'The styling is sent in its long form rather than the compact one browsers need.',
  'font-display':
    'Text waits for a font to download before it shows, so the page reads as blank while it loads.',
  'third-party-summary': 'Code from other companies is running on the page and slowing it down.',
  'largest-contentful-paint-element':
    'The biggest thing on the screen is the last thing to show up.',
  'prioritize-lcp-image':
    'The main picture is not asked for until late, so the page looks unfinished for longer.',
  'uses-rel-preconnect':
    'The page waits to connect to other servers it could have reached earlier.',
  'dom-size': 'The page is built out of far more pieces than it shows, which slows every scroll.',
  'mainthread-work-breakdown':
    'The phone is kept busy behind the scenes for seconds before the page responds.',
  'bootup-time': 'The phone spends seconds running code before the page can be used.',
  'duplicated-javascript': 'The same code is loaded more than once.',
})

/**
 * What kind of nothing a row carries, where it carries no reading.
 *
 * @param {object} row
 * @returns {string} A sentence a caller can say, or an empty string where the
 *   row is measured.
 */
export function unmeasuredReason(row) {
  if (measured(row)) return ''
  if (row?.site_kind === 'none' || !row?.website) {
    return 'No website to measure. The audit starts from the listing.'
  }
  const root = platformOf(hostOf(row.website))
  if (root) {
    const name = platformName(hostOf(row.website)) || 'a platform'
    return `The listing points at ${name}, which measures ${name} rather than the business. Not audited.`
  }
  return 'Not audited yet.'
}

/** Whether the row carries a reading at all. */
export function measured(row) {
  return typeof row?.audit_score === 'number' && Boolean(row?.audit_at)
}

/**
 * The four scores as the screen and the email draw them, in the report's own
 * order, each with the band it lands in.
 *
 * A category the report answered nothing for is carried as null rather than
 * dropped, so a row measured before the audit asked for all four still draws
 * four cells, one of them saying so.
 *
 * @param {object} row
 * @returns {Array<{column: string, label: string, value: number|null, band: string}>}
 */
export function scoresOf(row) {
  return CATEGORIES.map(entry => {
    const value = typeof row?.[entry.column] === 'number' ? row[entry.column] : null
    return { column: entry.column, label: entry.label, value, band: bandOf(value) }
  })
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * How old a reading is, as a person says it.
 *
 * The number moves a few points between runs and the band it lands in does
 * not, so a reading two weeks old is still the reading; what a caller needs
 * is to know whether the number is from this month or from the spring, and to
 * say so before the owner asks.
 *
 * @param {string|Date|null} at When the reading was taken.
 * @param {Date} [now]
 * @returns {{days: number, said: string}|null} Null where there is no instant.
 */
export function ageOf(at, now = new Date()) {
  if (!at) return null
  const when = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(when.getTime())) return null
  const days = Math.max(0, Math.floor((now.getTime() - when.getTime()) / DAY_MS))
  let said
  if (days === 0) said = 'Measured today'
  else if (days === 1) said = 'Measured yesterday'
  else if (days < 14) said = `Measured ${days} days ago`
  else if (days < 60) said = `Measured ${Math.floor(days / 7)} weeks ago`
  else if (days < 365) said = `Measured ${Math.floor(days / 30)} months ago`
  else said = 'Measured over a year ago'
  return { days, said }
}

/**
 * The main things wrong with the page, in plain English, largest first.
 *
 * Two sources, in this order: every category short of the good band, said as
 * what that category is about, and then the largest savings the report names,
 * each translated. A category in the good band is not an issue and is not
 * listed - a hundred beside a complaint reads as padding.
 *
 * @param {object} row
 * @returns {Array<{id: string, text: string}>}
 */
export function issuesOf(row) {
  if (!measured(row)) return []
  const issues = []
  const short = scoresOf(row).filter(score => score.value !== null && score.value < GOOD_FLOOR)
  const about = {
    audit_score: 'Speed on a phone is below the band Google calls good.',
    accessibility_score:
      'Parts of the page are hard to use for people with poor eyesight or a screen reader.',
    best_practices_score:
      'The page breaks some of the rules browsers expect, which is what warnings and broken pictures come from.',
    seo_score: 'The page leaves out things Google reads to decide where to show it.',
  }
  for (const score of short) issues.push({ id: score.column, text: about[score.column] })

  const savings = Array.isArray(row?.audit_raw?.opportunities) ? row.audit_raw.opportunities : []
  for (const saving of savings) {
    if (issues.length >= ISSUE_LIMIT + short.length) break
    if (!saving || typeof saving.id !== 'string') continue
    // A saving of nothing is the report saying the audit passed. It is listed
    // in the raw report because the report lists everything; it is not an issue.
    if (!(Number(saving.savings_ms) > 0)) continue
    const text =
      PLAIN_ISSUES[saving.id] ?? (saving.title ? `${String(saving.title).replace(/\.$/, '')}.` : '')
    if (!text) continue
    issues.push({ id: saving.id, text })
  }
  return issues
}

/**
 * The whole reading, as one object the screen and the email both draw from.
 *
 * @param {object} row A prospect carrying the audit columns.
 * @param {Date} [now]
 * @returns {{measured: boolean, why: string, scores: object[], age: object|null,
 *   at: string|null, issues: object[], website: string|null}}
 */
export function auditReading(row, now = new Date()) {
  const has = measured(row)
  return {
    measured: has,
    why: has ? '' : unmeasuredReason(row),
    scores: has ? scoresOf(row) : [],
    age: has ? ageOf(row.audit_at, now) : null,
    at: has ? row.audit_at : null,
    issues: issuesOf(row),
    website: has ? (row?.audit_raw?.final_url ?? row?.website ?? null) : null,
  }
}
