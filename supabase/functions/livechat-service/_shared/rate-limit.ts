// Per-session in-memory rate limit. Edge function isolates may recycle, so
// limits aren't perfectly enforced across cold starts — but for the abuse
// shape we care about (one tab hammering the endpoint), it's plenty. Anything
// stronger belongs in a paid WAF.

const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 20

const buckets = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { ok: true, retryAfterSeconds: 0 }
  }
  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  bucket.count += 1
  return { ok: true, retryAfterSeconds: 0 }
}
