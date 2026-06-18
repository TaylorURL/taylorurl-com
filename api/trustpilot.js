/**
 * Live Trustpilot rating fetcher for the home page.
 *
 * Trustpilot does not publish a free public REST endpoint for an unverified
 * business profile, but the review-profile page itself ships server-rendered
 * JSON-LD (`Organization` / `LocalBusiness`) and a `__NEXT_DATA__` payload that
 * both include `aggregateRating` (rating + review count). We fetch the page,
 * extract those numbers, and cache the result at the edge for one hour with a
 * day-long stale window so the home page never blocks on Trustpilot.
 *
 * When the profile has no reviews — or the fetch / parse fails — we return
 * 204 No Content so the client can gracefully hide the badge rather than
 * showing a fake / zero score.
 */

const TRUSTPILOT_DOMAIN = 'taylorurl.com'
const PROFILE_URL = `https://www.trustpilot.com/review/${TRUSTPILOT_DOMAIN}`
const REQUEST_TIMEOUT_MS = 4000
const REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (compatible; TaylorURLBadge/1.0; +https://taylorurl.com) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
}

function findAggregateRating(node) {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findAggregateRating(child)
      if (found) return found
    }
    return null
  }
  if (node.ratingValue != null && (node.reviewCount != null || node.ratingCount != null)) {
    return node
  }
  for (const value of Object.values(node)) {
    const found = findAggregateRating(value)
    if (found) return found
  }
  return null
}

function parseFromJsonLd(html) {
  const blocks = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  if (!blocks) return null
  for (const block of blocks) {
    const inner = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '')
    try {
      const aggregate = findAggregateRating(JSON.parse(inner))
      if (aggregate) return aggregate
    } catch {
      // ignore malformed block, keep scanning
    }
  }
  return null
}

function parseFromNextData(html) {
  const match = html.match(
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
  )
  if (!match) return null
  try {
    return findAggregateRating(JSON.parse(match[1]))
  } catch {
    return null
  }
}

function normalize(aggregate) {
  if (!aggregate) return null
  const rating = Number.parseFloat(aggregate.ratingValue)
  const count = Number.parseInt(aggregate.reviewCount ?? aggregate.ratingCount, 10)
  if (!Number.isFinite(rating) || !Number.isFinite(count) || count <= 0) return null
  return { rating: Math.round(rating * 10) / 10, reviewCount: count }
}

async function fetchProfileHtml() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(PROFILE_URL, {
      headers: REQUEST_HEADERS,
      signal: controller.signal,
    })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(_request, response) {
  const html = await fetchProfileHtml()
  const aggregate = html ? (parseFromJsonLd(html) ?? parseFromNextData(html)) : null
  const rating = normalize(aggregate)

  response.setHeader(
    'Cache-Control',
    'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
  )

  if (!rating) {
    response.status(204).end()
    return
  }

  response.status(200).json({
    ...rating,
    profileUrl: PROFILE_URL,
    fetchedAt: new Date().toISOString(),
  })
}
