/**
 * One PageSpeed Insights report, and the part of it worth keeping.
 *
 * A report runs two real page loads on Google's hardware and answers with
 * hundreds of audits. What any caller here wants out of it is the same short
 * list: four category scores as whole numbers, the five metrics the performance
 * score is built from, and the largest savings the report names. Reading that
 * list twice would let two callers drift into quoting different figures from
 * the same report, which is the one thing a measurement cannot survive.
 *
 * The reading is separated from the run so a caller holding a report already
 * does not have to take it again.
 */

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

/** A report runs two real page loads on Google's hardware, so it is given minutes. */
export const PSI_TIMEOUT_MS = 60_000

// Lighthouse fails a run of its own accord often enough that a single answer is
// not a reading: it hands back a 500 saying something went wrong, and the same
// address measured a few seconds later scores normally. One report is therefore
// not a verdict on the site, and treating it as one tells a stranger their
// address could not be read when nothing about their address was the problem.
export const PSI_RETRY_PAUSE_MS = 2000

// The room a second report needs before it is worth starting. A report begun
// with less than this behind it cannot finish, and it would replace an error
// that says what happened with one that says the clock ran out.
export const PSI_RETRY_FLOOR_MS = 20_000

/** Savings listed against a reading, largest first. */
const OPPORTUNITY_LIMIT = 5

// The categories one report answers for, against the columns they are stored
// in. Performance leads because it is the one the message argues from; the rest
// are the reading's corroboration.
export const CATEGORIES = {
  performance: 'audit_score',
  accessibility: 'accessibility_score',
  'best-practices': 'best_practices_score',
  seo: 'seo_score',
}

// The audits worth keeping out of a report that runs to hundreds of them.
// These are the five Lighthouse weights the performance score is built from.
const METRICS = {
  'first-contentful-paint': 'first_contentful_paint',
  'largest-contentful-paint': 'largest_contentful_paint',
  'total-blocking-time': 'total_blocking_time',
  'cumulative-layout-shift': 'cumulative_layout_shift',
  'speed-index': 'speed_index',
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * The report for one site, or a throw carrying what the API said.
 *
 * The key is a parameter rather than a module read so a caller that holds no
 * key fails on its own terms, and so a test can drive the whole shape without
 * one. It is stripped out of any error text before that text goes anywhere.
 *
 * A report the service failed on its own side is taken again, because Lighthouse
 * answering 500 says nothing about the address: the same one measured seconds
 * later scores normally. Anything it answers below 500 it will answer again - a
 * malformed address, a spent quota, a key that is not allowed - so those are
 * raised on the first answer rather than paid for twice.
 *
 * @param {string} website The address to measure.
 * @param {{ key?: string, timeoutMs?: number, budgetMs?: number, get?: typeof fetch }} [options]
 *   `timeoutMs` bounds one report; `budgetMs` is what the caller can afford for
 *   all of them, and a second report starts only inside what is left of it.
 * @returns {Promise<object>} The API's own JSON.
 */
export async function measure(website, options = {}) {
  const {
    key = process.env.GOOGLE_PAGESPEED_API_KEY || '',
    timeoutMs = PSI_TIMEOUT_MS,
    budgetMs = timeoutMs,
    get = fetch,
  } = options

  const url = new URL(PSI_ENDPOINT)
  url.searchParams.set('url', website)
  url.searchParams.set('strategy', 'mobile')
  // Repeating the parameter is how the API is asked for more than one category,
  // and four in one call is one page load rather than four.
  for (const category of Object.keys(CATEGORIES)) url.searchParams.append('category', category)
  if (key) url.searchParams.set('key', key)

  const deadline = Date.now() + budgetMs
  const remaining = () => deadline - Date.now()

  for (;;) {
    const upstream = await get(url, {
      // Whichever runs out first. A caller lending less than one report's worth
      // gets one attempt bounded by what it lent, rather than one that outlives
      // the invocation it was called from.
      signal: AbortSignal.timeout(Math.max(Math.min(timeoutMs, remaining()), 1)),
      headers: { Accept: 'application/json' },
    })
    if (upstream.ok) return upstream.json()

    const said = await upstream.text().catch(() => '')
    const detail = (key ? said.replaceAll(key, '[redacted]') : said).slice(0, 300)
    const fault = new Error(`pagespeed answered ${upstream.status} ${detail}`.trim())

    if (upstream.status < 500) throw fault
    if (remaining() - PSI_RETRY_PAUSE_MS < PSI_RETRY_FLOOR_MS) throw fault
    await wait(PSI_RETRY_PAUSE_MS)
  }
}

/** A category's fraction as the whole number out of 100 it is stored as. */
const outOfHundred = fraction => (typeof fraction === 'number' ? Math.round(fraction * 100) : null)

/**
 * The part of a report worth keeping against the row it was run for.
 *
 * @param {object} report A PageSpeed Insights response.
 * @returns {{scores: object, raw: object}} The scores under their column names,
 *   and the faithful record of what the report answered.
 */
export function reading(report) {
  const house = report?.lighthouseResult ?? {}
  const audits = house.audits ?? {}

  // The scores against the columns they are written to, and the same four
  // against the API's own names, which is the faithful record of what the
  // report answered.
  const scores = {}
  const categories = {}
  for (const [id, column] of Object.entries(CATEGORIES)) {
    scores[column] = outOfHundred(house.categories?.[id]?.score)
    categories[id] = scores[column]
  }

  const metrics = {}
  for (const [id, name] of Object.entries(METRICS)) {
    const audit = audits[id]
    if (!audit) continue
    metrics[name] = {
      score: audit.score ?? null,
      numeric: audit.numericValue ?? null,
      display: audit.displayValue ?? null,
    }
  }

  const opportunities = Object.entries(audits)
    .filter(([, audit]) => audit?.details?.type === 'opportunity' && audit.numericValue > 0)
    .map(([id, audit]) => ({
      id,
      title: audit.title ?? id,
      savings_ms: Math.round(audit.numericValue),
    }))
    .sort((first, second) => second.savings_ms - first.savings_ms)
    .slice(0, OPPORTUNITY_LIMIT)

  return {
    scores,
    raw: {
      strategy: 'mobile',
      final_url: house.finalDisplayedUrl ?? house.finalUrl ?? null,
      fetched_at: house.fetchTime ?? null,
      lighthouse_version: house.lighthouseVersion ?? null,
      categories,
      metrics,
      opportunities,
    },
  }
}
