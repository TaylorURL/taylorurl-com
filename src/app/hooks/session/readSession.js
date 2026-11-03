/**
 * Reading the stored session back, with the network given more than one chance.
 *
 * `getSession` is the first request the console makes and the one everything
 * else waits on. It asks GoTrue, and supabase-js answers a request that never
 * landed with `AuthRetryableFetchError` - the name says what to do about it.
 * Nothing did. The call site took the `data` half, dropped the `error`, and a
 * request that failed at the network layer arrived at the guard as `session:
 * null`, which is the same shape a signed-out visitor has.
 *
 * So a dropped request signed people out. The console's guard read "no
 * session", sent the reader to the sign-in form with `from` set, and the
 * session was still sitting in storage the whole time - the nav bar went on
 * saying they were signed in, because it reads storage directly. One lost
 * packet on a phone changing networks was enough. That is the fault behind
 * `AuthRetryableFetchError: Load failed` on /console/calls.
 *
 * Nothing is imported here, for the same reason `sessionGate` imports nothing:
 * the caller hands in the request, so the ladder is decidable on its own and
 * `scripts/auth/check-auth-retry.js` can spend it without a browser.
 *
 * Two things are needed and they are separate. This module is the first: ask
 * again before believing the answer. The second is that a read which never
 * succeeded must not be reported as a signed-out account at all, which is
 * `unreachable` here and in `sessionGate`.
 */

/** The default pause between rungs. Replaced by a check, which spends none. */
const sleep = ms => new Promise(settle => setTimeout(settle, ms))

// The quick pair, for a request that was simply dropped and lands on the next
// ask. The same rungs the asset ladder uses, measured for the same failure.
export const SESSION_RETRIES = 2
export const SESSION_RETRY_MS = 350

// And one more, long after the quick pair is spent. `lazyWithRetry` carries the
// reading this is taken from: the outages that actually happen last two or
// three seconds, so a ladder finishing inside one second is a ladder spent
// entirely inside the outage. The quick pair is gone by 1,050ms; this rung is
// the one still unspent when the network comes back.
export const SESSION_WAIT_MS = 5000

/**
 * Whether asking again could answer differently.
 *
 * Only a request that did not complete is worth repeating. A session that has
 * genuinely expired, or an account that is genuinely signed out, answers the
 * same way however many times it is asked, and retrying it would hold the
 * console on a placeholder for five seconds on the way to the sign-in form
 * every visitor who is not signed in sees.
 *
 * supabase-js names this case itself, so the name is what is read first. The
 * sentences are the fallback for a cause that arrived without one - Safari
 * renders a failed fetch as the bare message "Load failed".
 *
 * @param {unknown} cause
 * @returns {boolean}
 */
export function worthAnotherAsk(cause) {
  if (!cause) return false
  const name = typeof cause === 'object' && cause !== null ? String(cause.name ?? '') : ''
  if (name === 'AuthRetryableFetchError') return true
  if (name === 'AuthSessionMissingError' || name === 'AuthApiError') return false
  const said = String(
    (typeof cause === 'object' && cause !== null && cause.message) || cause || ''
  ).toLowerCase()
  return /load failed|failed to fetch|networkerror|network request failed|err_network|err_internet_disconnected/.test(
    said
  )
}

/**
 * Read the stored session back, asking again while the asking is what failed.
 *
 * @param {{ask: () => Promise<{data?: {session?: object|null}, error?: unknown}>,
 *   pause?: (ms: number) => Promise<void>}} options - `ask` is the session read
 *   itself, handed in so the ladder can be asserted rather than assumed; see
 *   `scripts/auth/check-auth-retry.js`.
 * @returns {Promise<{session: object|null, unreachable: boolean, asked: number}>}
 *   `unreachable` is true only when every attempt failed at the network layer,
 *   and it is the one case where `session: null` does not mean signed out.
 */
/**
 * Spend the ladder on one auth call.
 *
 * Shared because the console has two of these and they failed the same way.
 * The session read is the first; the refresh the console makes when a read is
 * refused is the second, and that one ended the session on a single dropped
 * request.
 *
 * @param {() => Promise<{data?: object, error?: unknown}>} request - the one
 *   auth call, handed in rather than reached for, so this module depends on
 *   nothing and the ladder can be asserted without a browser.
 * @param {{pause?: (ms: number) => Promise<void>}} [options]
 * @returns {Promise<{answer: object|null, cause: unknown, unreachable: boolean,
 *   asked: number}>} `unreachable` is true only when every attempt failed at
 *   the network layer - the one case where there is no answer rather than an
 *   unwelcome one.
 */
export async function askWithLadder(request, { pause = sleep } = {}) {
  // The rungs, spelled out rather than computed, so the shape of the ladder is
  // the thing a reader and a check both see: 350ms, 700ms, then 5s.
  const rungs = [
    ...Array.from({ length: SESSION_RETRIES }, (_, step) => SESSION_RETRY_MS * (step + 1)),
    SESSION_WAIT_MS,
  ]

  let asked = 0
  let last = null

  for (let attempt = 0; attempt <= rungs.length; attempt += 1) {
    asked += 1
    let answer = null
    let cause = null
    try {
      answer = await request()
      cause = answer?.error ?? null
    } catch (thrown) {
      // A rejection and an `error` field are the same failure wearing two
      // shapes, and which one arrives depends on the version. Both land here.
      cause = thrown
    }

    if (!cause) return { answer, cause: null, unreachable: false, asked }

    last = cause
    // A definite answer, however unwelcome. Asking again cannot change it.
    if (!worthAnotherAsk(cause)) return { answer: null, cause, unreachable: false, asked }

    if (attempt < rungs.length) await pause(rungs[attempt])
  }

  return { answer: null, cause: last, unreachable: true, asked }
}

/**
 * Read the stored session back, asking again while the asking is what failed.
 *
 * @param {{ask: () => Promise<{data?: {session?: object|null}, error?: unknown}>,
 *   pause?: (ms: number) => Promise<void>}} options - `ask` is the session read
 *   itself, handed in so the ladder can be asserted rather than assumed; see
 *   `scripts/auth/check-auth-retry.js`.
 * @returns {Promise<{session: object|null, unreachable: boolean, asked: number}>}
 *   `unreachable` is true only when every attempt failed at the network layer,
 *   and it is the one case where `session: null` does not mean signed out.
 */
export async function readSession({ ask, pause = sleep } = {}) {
  const { answer, unreachable, asked } = await askWithLadder(ask, { pause })
  // Every attempt failed at the network layer. What is true is that the session
  // is unknown, and saying "signed out" here is the bug this exists to stop.
  if (unreachable) return { session: null, unreachable: true, asked }
  return { session: answer?.data?.session ?? null, unreachable: false, asked }
}
