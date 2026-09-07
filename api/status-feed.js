import { servedHereOr404 } from '../lib/http/guard.js'
/**
 * Reverse proxy for the uptime-monitor feed.
 *
 * The raw feed lives on an internal host that browsers cannot reach directly.
 * This function fetches the JSON server-side and returns it with a short edge
 * cache so concurrent visitors share a single upstream roundtrip.
 */

// Where the monitor publishes its feed. The host is named by `STATUS_FEED_URL`
// rather than carried here, and a deployment that never set it answers 503.
const UPSTREAM = process.env.STATUS_FEED_URL || ''

// The upstream is a home connection behind a relay, so a first byte can be slow
// without the host being down. One retry covers a dropped connection; the pair
// of attempts still finishes inside the function's own execution ceiling.
const TIMEOUT_MS = 12000
const ATTEMPTS = 2

/** Which stage failed, in the words the response and the log both use. */
function describe(error) {
  if (error && error.status) return error.message
  if (error && error.name === 'AbortError') return 'upstream timed out'
  if (error && error.name === 'SyntaxError') return 'upstream sent malformed JSON'
  const cause = error && error.cause
  if (cause && cause.code) return `upstream unreachable (${cause.code})`
  return 'upstream unreachable'
}

// Projects the site does not present. The monitor watches whatever it is
// pointed at, and a board is a claim about the work on offer rather than a
// list of every host that answers, so these are dropped here instead of in the
// view: filtered server-side they never reach a browser, and every surface
// reading this proxy - the public board, the console, the signed-in case - is
// covered by the one rule.
const WITHHELD = ['domebreak', 'knightplugins', 'knight-plugins', 'knight plugins']

/** Whether a feed row names one of the projects the site does not present. */
function withheld(row) {
  const fields = [row && row.id, row && row.name, row && row.domain, row && row.site]
    .concat((row && row.domains) || [])
    .filter(Boolean)
    .map(value =>
      String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
    )
  return fields.some(field => WITHHELD.some(name => field.includes(name.replace(/[^a-z0-9]/g, ''))))
}

/**
 * The feed with the withheld projects taken out of it, and the counts it
 * carries brought back into step.
 *
 * A summary that still counts a row nobody can see reads as a board that has
 * lost track of itself: an outage tallied against no visible site, or a banner
 * reporting trouble above fifteen rows that all say they are fine. The tally
 * gives up only what the removed rows put into it, and the banner is lowered
 * only when nothing left standing disagrees with it.
 */
function present(body) {
  if (!body || !Array.isArray(body.sites)) return body
  const hidden = body.sites.filter(withheld)
  if (!hidden.length) return body

  const sites = body.sites.filter(row => !withheld(row))
  const names = new Set(hidden.map(row => String(row.name || '').toLowerCase()))
  const incidents = (body.incidents || []).filter(
    entry => !names.has(String(entry.site || '').toLowerCase()) && !withheld(entry)
  )

  const surrendered = hidden.filter(row => (row.uptime_30d ?? 100) < 100).length
  const troubled = sites.some(row => row.status && row.status !== 'operational')

  return {
    ...body,
    sites,
    incidents,
    outages_30d: Math.max((body.outages_30d ?? 0) - surrendered, 0),
    overall: troubled ? body.overall : 'operational',
  }
}

async function readFeed() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const upstream = await fetch(`${UPSTREAM}?t=${Date.now()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!upstream.ok) {
      const status = new Error(`upstream returned ${upstream.status}`)
      status.status = upstream.status
      throw status
    }
    return await upstream.json()
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (!UPSTREAM) {
    response.status(503).json({
      error:
        'The status feed is not available. Get in touch if you need to know whether a site is up.',
    })
    return
  }

  let last = null
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const body = await readFeed()
      response.setHeader(
        'Cache-Control',
        'public, max-age=0, s-maxage=15, stale-while-revalidate=30'
      )
      response.status(200).json(present(body))
      return
    } catch (error) {
      last = error
      // An upstream that answered with a status of its own is reporting a real
      // condition rather than a lost connection, so a second attempt would ask
      // the same question and get the same answer.
      if (error && error.status) break
    }
  }

  // The reason travels as far as the log and no further. A slow relay, a dead
  // host and a bad payload need telling apart, and none of them is a
  // difference to somebody looking at a board of green and red dots: what
  // reaches them is that the board is not current and that it will keep
  // trying, which is the whole of what they can do about it.
  const reason = describe(last)
  console.error('status-feed: %s reading %s', reason, UPSTREAM, last)
  response
    .status(502)
    .json({ error: 'The status feed could not be read just now. It refreshes on its own.' })
}
