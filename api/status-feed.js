/**
 * Reverse proxy for the uptime-monitor feed.
 *
 * The raw feed lives on an internal host that browsers cannot reach directly.
 * This function fetches the JSON server-side and returns it with a short edge
 * cache so concurrent visitors share a single upstream roundtrip. The internal
 * URL is read from the `STATUS_FEED_URL` environment variable set in Vercel.
 */

// The monitor's public feed. `STATUS_FEED_URL` overrides it when the host
// moves; without a default the function answers 503 on a deployment where the
// variable was never set, which is a broken page rather than a missing option.
const DEFAULT_UPSTREAM = 'https://sunday.tail1f78d7.ts.net/status.json'
const UPSTREAM = process.env.STATUS_FEED_URL || DEFAULT_UPSTREAM
const TIMEOUT_MS = 6000

export default async function handler(_request, response) {
  if (!UPSTREAM) {
    response.status(503).json({ error: 'status feed not configured' })
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const upstream = await fetch(`${UPSTREAM}?t=${Date.now()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (!upstream.ok) {
      response.status(502).json({ error: `upstream returned ${upstream.status}` })
      return
    }

    const body = await upstream.json()

    response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15, stale-while-revalidate=30')
    response.status(200).json(body)
  } catch {
    response.status(502).json({ error: 'upstream unreachable' })
  } finally {
    clearTimeout(timer)
  }
}
