/**
 * Reverse proxy for the console's PageSpeed endpoint.
 *
 * The same shape every console proxy takes: it carries the caller's Supabase
 * session through and decides nothing itself. The one difference is the
 * ceiling. A measurement runs two real page loads on Google's hardware, so this
 * function is allowed minutes rather than the default seconds; a proxy that
 * timed out halfway would leave the reading written and the reader told it
 * failed.
 */

import { bearerOr401, methodsOr405, servedHereOr404 } from '../lib/http/guard.js'
import { proxyToEdge } from '../lib/http/proxy.js'

const UPSTREAM =
  process.env.SITE_SPEED_URL || 'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/site-speed'
const TIMEOUT_MS = 170_000

export const config = { maxDuration: 300 }

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (!bearerOr401(request, response)) return
  if (!methodsOr405(request, response, ['GET', 'POST'])) return

  await proxyToEdge(request, response, {
    upstream: UPSTREAM,
    timeoutMs: TIMEOUT_MS,
    name: 'the measurement endpoint',
    searchParams: { site: request.query.site },
  })
}
