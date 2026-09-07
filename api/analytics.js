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
 */

const UPSTREAM =
  process.env.ANALYTICS_SUMMARY_URL ||
  'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/analytics-summary'
const TIMEOUT_MS = 8000

const VIEWS = new Set(['live', 'live-history', 'overview', 'site'])

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const authorization = request.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) {
    response.status(401).json({ error: 'not authorized' })
    return
  }

  const { view = 'overview', days, site, sites, path, minutes } = request.query
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
  if (minutes) url.searchParams.set('minutes', minutes)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', Authorization: authorization },
    })

    // A refused session is the caller's answer to pass on, not a proxy fault:
    // turning it into a 502 would send the console into a retry loop over a
    // request that will never succeed.
    if (upstream.status === 401 || upstream.status === 403) {
      response
        .status(upstream.status)
        .json(await upstream.json().catch(() => ({ error: 'not authorized' })))
      return
    }

    if (!upstream.ok) {
      // The status names the far end and means nothing to somebody looking at
      // a page of visitor figures, so it is logged rather than drawn.
      console.error('analytics: the collector answered %s for view %s', upstream.status, view)
      response
        .status(502)
        .json({ error: 'The traffic figures could not be read just now. Try again shortly.' })
      return
    }

    // Never cached, at any layer: the figures move by the second, and a shared
    // cache in front of an authorised response is a way to serve it to someone
    // who did not authorise.
    response.setHeader('Cache-Control', 'private, no-store')
    response.status(200).json(await upstream.json())
  } catch (cause) {
    console.error('analytics: the collector did not answer for view %s', view, cause)
    response
      .status(502)
      .json({ error: 'The traffic figures could not be read just now. Try again shortly.' })
  } finally {
    clearTimeout(timer)
  }
}
