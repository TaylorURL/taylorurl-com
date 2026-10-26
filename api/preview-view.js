/**
 * preview-view - a prospect looked at their preview site.
 *
 * The preview page (TaylorURL/previews, src/site.js) posts here once a visit
 * has passed its own gate: a preview rather than a sample, not the studio's own
 * browser, not an automated one, and on screen for a few seconds. That gate
 * cannot see a mail scanner, which runs a real browser and waits as long as it
 * is asked to, so the question that can is asked here: whose network the visit
 * came from (lib/outreach/scanners.js).
 *
 * The database's `preview_view()` writes every visit to `preview_views` with
 * its address, agent and network, and counts it on the preview only when it is
 * none of: the studio's own connection, an automated agent, a scanner's
 * network, or so soon after the letter went that nobody could have read it.
 *
 * The answer is always 204. The page has no use for the verdict, and a scanner
 * trying shapes learns nothing from it.
 */

import { connect } from '../lib/db/clients.js'
import { readBody } from '../lib/http/body.js'
import { servedHereOr404 } from '../lib/http/guard.js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'
import { judgeVisit } from '../lib/outreach/scanners.js'

const SLUG = /^[a-z0-9-]{2,63}$/
const TEMPLATE = /^[a-z]{2,24}$/

// One view a visit, and a reader rarely opens more than a few previews.
const views = callerWindow({ limit: 10, windowMs: 60 * 1000 })

/** The view as the database will take it, or null when it is not one. */
export function cleanView(body) {
  if (!body || typeof body !== 'object') return null
  const { slug, template } = body
  if (!SLUG.test(slug ?? '') || !TEMPLATE.test(template ?? '')) return null
  return { slug, template }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).end()
    return
  }
  response.setHeader('Cache-Control', 'no-store')

  const address = callerAddress(request)
  if (!views.allows(address)) {
    response.status(429).end()
    return
  }
  const view = cleanView(readBody(request))
  const connected = view && connect()
  if (!connected) {
    response.status(204).end()
    return
  }

  const agent = String(request.headers['user-agent'] ?? '').slice(0, 400)
  const visit = await judgeVisit(address, agent)
  const { error } = await connected.db.rpc('preview_view', {
    p_slug: view.slug,
    p_industry: view.template,
    p_address: address,
    p_agent: agent,
    p_asn: visit.asn,
    p_network: visit.owner,
    p_scanner: visit.scanner,
    p_automated: visit.automated,
  })
  if (error) console.error('preview view: %s', error.message)
  response.status(204).end()
}
