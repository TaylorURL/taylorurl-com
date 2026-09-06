/**
 * What one caller may ask for inside one window.
 *
 * The record lives in the function instance's memory, so a scaled-out
 * deployment holds one per instance. That is enough to stop a script walking a
 * list of domains through an endpoint and cheap enough to cost a real visitor
 * nothing, and it is deliberately not the whole answer for an endpoint that
 * spends money on each call: a ceiling that has to hold across every instance
 * is counted in the database instead, with this in front of it as the cheap
 * refusal that never reaches one.
 */

/** The caller's address, as the platform's proxy reports it. */
export function callerAddress(request) {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim()
  return request.socket?.remoteAddress || 'unknown'
}

/**
 * A window that counts callers, and answers whether one has room left in it.
 *
 * Each window keeps its own record, so two endpoints sharing this module do not
 * share an allowance. Addresses whose window has run out are dropped on the way
 * past, so the record holds one window's traffic rather than every address the
 * instance has ever answered.
 *
 * @param {{ limit: number, windowMs: number }} spec What the window allows.
 * @returns {{ windowMs: number, allows: (address: string, now?: number) => boolean }}
 */
export function callerWindow({ limit, windowMs }) {
  const seen = new Map()

  return {
    windowMs,
    allows(address, now = Date.now()) {
      for (const [key, times] of seen) {
        const live = times.filter(time => now - time < windowMs)
        if (live.length) seen.set(key, live)
        else seen.delete(key)
      }

      const recent = seen.get(address) || []
      if (recent.length >= limit) return false
      seen.set(address, [...recent, now])
      return true
    },
  }
}
