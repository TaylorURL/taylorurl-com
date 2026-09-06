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
 * the far end stops answering for itself. A refusal and a rule the endpoint
 * enforced are both the caller's answer; a 5xx is the proxy's, and becomes a 502
 * naming which endpoint went quiet.
 */

/**
 * @param {object} request
 * @param {object} response
 * @param {object} route
 * @param {string} route.upstream The function's address.
 * @param {number} route.timeoutMs How long the far end is given to answer.
 * @param {string} route.name What the endpoint is called in a refusal a reader
 *   sees, as a noun phrase: `the measurement endpoint did not answer`.
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

    if (answer.status < 500) {
      // Never cached, at any layer: a shared cache in front of an authorised
      // answer is a way to serve it to somebody who did not authorise.
      response.setHeader('Cache-Control', 'private, no-store')
      response
        .status(answer.status)
        .json(await answer.json().catch(() => ({ error: 'unreadable answer' })))
      return
    }

    response.status(502).json({ error: `${name} returned ${answer.status}` })
  } catch {
    response.status(502).json({ error: `${name} did not answer` })
  }
}
