import { coalesced } from '../lib/http/coalesce.js'
import { servedHereOr404 } from '../lib/http/guard.js'
/**
 * Reverse proxy for the traffic analytics endpoint.
 *
 * It carries the caller's Supabase session through to the collector and
 * nothing else. Whether that session may read anything is decided at the far
 * end, where the token is verified against the project and the account checked
 * against the one allowed to read: a proxy that made that decision itself
 * would be a second opinion on a question that already has an answer.
 *
 * The console goes through here rather than calling the collector directly so
 * the page talks to its own origin — no preflight on every poll, and one place
 * to change if the collector moves.
 *
 * It is also the one place that knows how many of these polls are the same
 * poll. Every console page carries the frame's three feeds, so a reader with
 * two tabs open, or a retry landing beside a success, asks the collector the
 * same question several times in the same second — and the overview question
 * costs the database seconds of work to answer. Identical polls are therefore
 * answered together rather than separately (lib/http/coalesce.js), keyed on
 * the session so one account's figures are never handed to another.
 */

const UPSTREAM =
  process.env.ANALYTICS_SUMMARY_URL ||
  'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/analytics-summary'
const TIMEOUT_MS = 8000

/**
 * How long a landed answer is reused for.
 *
 * Shorter than the fastest of the frame's polls - the live view asks every ten
 * seconds, the scoped view every thirty, the overview every minute - so no
 * reader is ever shown figures staler than the interval it asked on. What this
 * collapses is the same question asked twice at once, not the refresh.
 */
const HELD_MS = 3000

const VIEWS = new Set(['live', 'overview', 'site'])

/**
 * The collector's answer, parsed, with the status it came back with.
 *
 * The body is read here rather than handed back unread because the callers
 * sharing one of these reads share the answer itself, and a response body can
 * only be taken once.
 */
async function askCollector(url, authorization) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', Authorization: authorization },
    })
    const payload = await upstream.json().catch(() => null)
    return { status: upstream.status, ok: upstream.ok, payload }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The same read, shared by the polls that arrive on top of each other.
 *
 * The session is in the key, so a hold is per reader and an authorised answer
 * can never be served to somebody who did not authorise it.
 */
const collector = coalesced(HELD_MS, askCollector)

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const authorization = request.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) {
    response.status(401).json({ error: 'not authorized' })
    return
  }

  const { view = 'overview', days, site, sites, path } = request.query
  if (!VIEWS.has(view)) {
    response.status(400).json({ error: 'unknown view' })
    return
  }

  const url = new URL(UPSTREAM)
  url.searchParams.set('view', view)
  if (days) url.searchParams.set('days', days)
  if (site) url.searchParams.set('site', site)
  // A set of sites arrives as one comma-separated value, and as a repeated
  // parameter from anything that builds a query string the other way. Both are
  // handed on as the one shape the collector reads.
  if (sites) url.searchParams.set('sites', Array.isArray(sites) ? sites.join(',') : sites)
  if (path) url.searchParams.set('path', path)

  try {
    const answer = await collector(`${authorization}\n${url}`, url, authorization)

    // A refused session is the caller's answer to pass on, not a proxy fault:
    // turning it into a 502 would send the console into a retry loop over a
    // request that will never succeed.
    if (answer.status === 401 || answer.status === 403) {
      response.status(answer.status).json(answer.payload || { error: 'not authorized' })
      return
    }

    if (!answer.ok) {
      // The status names the far end and means nothing to somebody looking at
      // a page of visitor figures, so it is logged rather than drawn.
      console.error('analytics: the collector answered %s for view %s', answer.status, view)
      response
        .status(502)
        .json({ error: 'The traffic figures could not be read just now. Try again shortly.' })
      return
    }

    // Never cached outside this instance, at any layer: the figures move by the
    // second, and a shared cache in front of an authorised response is a way to
    // serve it to someone who did not authorise. The hold above is a different
    // thing - it is this instance answering one question once, for the session
    // that asked it.
    response.setHeader('Cache-Control', 'private, no-store')
    response.status(200).json(answer.payload)
  } catch (cause) {
    // 504 rather than 502, because the two are different conditions and only
    // this one is routine. The collector answering badly is a fault; the
    // collector not answering inside the deadline is this proxy choosing not to
    // wait, which is the policy above working. The console rides straight over
    // it on the last good figures, and the status is what lets the page's
    // reporter tell a slow upstream from a broken one rather than raising an
    // incident over a poll that cleared itself.
    console.error('analytics: the collector did not answer for view %s', view, cause)
    response
      .status(504)
      .json({ error: 'The traffic figures could not be read just now. Try again shortly.' })
  }
}
