/**
 * Carrying a console request through to the Supabase function that answers it.
 *
 * The console calls its own origin rather than the function directly, which
 * keeps a write from needing a preflight and leaves one place to change when an
 * endpoint moves. Nothing is decided here: the caller's session travels through
 * untouched and the far end verifies it, because a proxy that judged the session
 * itself would be a second opinion on a question that already has an answer.
 *
 * What comes back is passed on rather than reinterpreted, up to the point where
 * the far end stops answering the caller. An answer is the caller's and goes
 * through whole. A refusal is the caller's decision to hear, so its status goes
 * through - but not the words beside it, which the far end wrote for whoever
 * runs the function, while the person waiting on this is looking at a console
 * page. A 5xx is not an answer to the caller at all and becomes a 502; a
 * silence becomes a 504, because a far end that ran out of time is this side
 * choosing not to wait rather than anything having broken, and the page's
 * reporter reads the difference before deciding whether a fault is worth
 * filing.
 *
 * So nothing the far end wrote reaches a browser. It goes to `console.error`
 * instead, which is the one place it is worth having and the one place they
 * never see, and the reader is told what happened in the site's own words.
 */

/**
 * What a reader is told for each way the far end can refuse.
 *
 * Keyed on the status, because the status is the whole of what this side
 * understands about a refusal: the far end knows why it said no and this does
 * not, so a sentence here says what the status means and stops. A cause read
 * out of a number - "the database is down" - would be a guess dressed as a
 * fact, and a wrong one is worse than the general sentence below.
 */
const REFUSALS = new Map([
  [400, 'That was not accepted as sent. Check what you entered and try again.'],
  [401, 'You are not signed in any more. Sign in and try that again.'],
  [403, 'This account is not allowed to do that.'],
  [404, 'That is not there any more.'],
  [409, 'That has already been done.'],
  [413, 'That is too large to send. Try a smaller one.'],
  [422, 'That was not accepted as sent. Check what you entered and try again.'],
  [429, 'That is being asked for too quickly. Wait a minute and try again.'],
])

/** A refusal on a status nothing above is written for. */
const REFUSED = 'That did not go through. Nothing was lost, so try it again.'

/** The far end answered, but with nothing this side can hand on. */
const TROUBLE =
  'The server had trouble with that. It is not something you did, so try again shortly.'

/** The far end did not answer at all: it ran out of time, or was never reached. */
const SILENT = 'That did not go through. Give it a moment and try again.'

/**
 * @param {object} request
 * @param {object} response
 * @param {object} route
 * @param {string} route.upstream The function's address.
 * @param {number} route.timeoutMs How long the far end is given to answer.
 * @param {string} route.name What the endpoint is called in the log when it
 *   refuses or goes quiet, as a noun phrase: `the measurement endpoint did not
 *   answer`. It is never repeated to the caller, who has no way of knowing what
 *   it names and nothing to do differently once told.
 * @param {Record<string, string>} [route.searchParams] Query to carry through.
 */
export async function proxyToEdge(request, response, { upstream, timeoutMs, name, searchParams }) {
  const url = new URL(upstream)
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (value) url.searchParams.set(key, value)
  }

  const authorization = request.headers.authorization || ''
  const post = request.method === 'POST'

  try {
    const answer = await fetch(url, {
      method: request.method,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'application/json',
        Authorization: authorization,
        ...(post ? { 'Content-Type': 'application/json' } : {}),
      },
      body: post ? JSON.stringify(request.body ?? {}) : undefined,
    })

    if (answer.status >= 500) {
      console.error('proxy: %s answered %d', name, answer.status)
      response.status(502).json({ error: TROUBLE })
      return
    }

    // Never cached, at any layer: a shared cache in front of an authorised
    // answer is a way to serve it to somebody who did not authorise.
    response.setHeader('Cache-Control', 'private, no-store')

    const body = await answer.json().catch(() => null)

    if (answer.status >= 400) {
      // The whole body rather than one field of it. A refusal puts its detail
      // wherever it likes - `error`, `message`, a nested `details` - and this is
      // the only place any of it is ever read.
      console.error('proxy: %s refused with %d: %j', name, answer.status, body)
      response.status(answer.status).json({ error: REFUSALS.get(answer.status) || REFUSED })
      return
    }

    // A body that will not parse is not an answer, whatever the status said, and
    // passing the status on would leave the console treating nothing as data and
    // drawing an empty table with no reason for it. So it is answered as the
    // failure it is.
    if (!body) {
      console.error('proxy: %s answered %d with a body that would not parse', name, answer.status)
      response.status(502).json({ error: TROUBLE })
      return
    }

    response.status(answer.status).json(body)
  } catch (cause) {
    console.error('proxy: %s did not answer: %s', name, cause?.message || cause)
    response.status(504).json({ error: SILENT })
  }
}
