/**
 * A checkout session at Stripe, opened or read back.
 *
 * Two endpoints open a session and a third reads one back once it has been
 * paid for. Each of those is one request answered with one JSON body, given ten
 * seconds for both halves, since a Stripe that sends its headers and then stalls
 * on the body has not answered either.
 *
 * The clock is an abort controller rather than `timedFetch`, because the
 * endpoints tell a Stripe that ran out of time from one that could not be reached
 * by the `AbortError` a controller raises, and a timed fetch raises a different
 * one.
 */

const SESSIONS = 'https://api.stripe.com/v1/checkout/sessions'

const TIMEOUT_MS = 10000

/**
 * Stripe takes form encoding with square brackets for nesting, not JSON.
 *
 * Written out rather than reached for from a library because the shape is
 * small and fixed, and because a helper that flattens anything would happily
 * flatten a field nobody meant to send.
 *
 * @param {Record<string, unknown>} fields
 * @returns {URLSearchParams}
 */
export function form(fields) {
  const body = new URLSearchParams()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue
    body.append(key, String(value))
  }
  return body
}

/** The address the receipt went to, whichever field Stripe filled in. */
export function buyerEmail(session) {
  return session?.customer_details?.email || session?.customer_email || null
}

/**
 * One request to Stripe's sessions, and the body it came back with.
 *
 * @returns {Promise<{answer: Response, session: any}>} Rejects with an
 *   `AbortError` at the deadline.
 */
async function ask(url, init) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const answer = await fetch(url, { ...init, signal: controller.signal })
    return { answer, session: await answer.json() }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Opens a session.
 *
 * @param {URLSearchParams} fields What `form` made of the session.
 * @param {string} secret The account's secret key.
 */
export function openSession(fields, secret) {
  return ask(SESSIONS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: fields,
  })
}

/**
 * Reads one session back.
 *
 * @param {string} id A session id, already checked for shape, since it becomes
 *   part of the path.
 * @param {string} secret The account's secret key.
 */
export function readSession(id, secret) {
  return ask(`${SESSIONS}/${id}`, { headers: { Authorization: `Bearer ${secret}` } })
}
