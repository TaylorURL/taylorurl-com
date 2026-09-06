/**
 * Reverse proxy for the admin console's endpoint.
 *
 * It carries the caller's Supabase session through and nothing else. Whether
 * that session may read or change anything is decided at the far end, where
 * the token is verified against the project and the account checked for the
 * admin role: a proxy that made that decision itself would be a second opinion
 * on a question that already has an answer.
 *
 * The console goes through here rather than calling the function directly so
 * the page talks to its own origin - no preflight on a write, and one place to
 * change if the endpoint moves.
 */

import { bearerOr401, methodsOr405, servedHereOr404 } from '../lib/http/guard.js'
import { proxyToEdge } from '../lib/http/proxy.js'

const UPSTREAM =
  process.env.CONSOLE_ADMIN_URL ||
  'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/console-admin'
const TIMEOUT_MS = 8000

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (!bearerOr401(request, response)) return
  if (!methodsOr405(request, response, ['GET', 'POST'])) return

  await proxyToEdge(request, response, {
    upstream: UPSTREAM,
    timeoutMs: TIMEOUT_MS,
    name: 'the admin endpoint',
  })
}
