/**
 * How an unsubscribe link reads its token and says what it settled.
 *
 * A lead's link and a prospect's link retire different rows and are otherwise
 * the same link. The token is the whole credential, a click from the message and
 * a one-click POST from the reader's mailbox provider both arrive carrying it,
 * and each is answered in the form its caller can read: a browser is sent to the
 * page at /unsubscribe with the outcome in the query string, and a mailbox
 * provider gets JSON and renders nothing.
 */

/** The page a click lands on, which reports what the request settled. */
const LANDING = '/unsubscribe'

/**
 * The token, from the query string or the posted body.
 *
 * One-click sends `List-Unsubscribe=One-Click` as a form body and keeps the
 * token on the URL, so the query string is read first and a body is only
 * consulted when there is nothing there.
 *
 * @param {object} request
 * @returns {string} The token trimmed, or an empty string.
 */
export function readToken(request) {
  const fromQuery = request.query?.token
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim()
  const fromBody = request.body?.token
  return typeof fromBody === 'string' ? fromBody.trim() : ''
}

/**
 * What the caller is told, in whichever form the caller can read.
 *
 * @param {object} request
 * @param {object} response
 * @param {{state: 'done'|'already'|'invalid'|'failed', status?: number}} outcome The
 *   state the request settled, and the status a POST is answered with when that
 *   state is not a success.
 */
export function answer(request, response, { state, status = 200 }) {
  if (request.method === 'POST') {
    const ok = state === 'done' || state === 'already'
    response.status(ok ? 200 : status).json({ ok, already: state === 'already', state })
    return
  }
  response.redirect(302, `${LANDING}?state=${state}`)
}
