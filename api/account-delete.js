import { servedHereOr404 } from '../lib/http/guard.js'
/**
 * Closing an account, for good.
 *
 * Deleting an account is the one thing a signed-in browser cannot do for
 * itself: Supabase puts it behind the admin API, and the key that opens it
 * belongs on a server. So the caller's session comes in on the Authorization
 * header, is exchanged for the account it belongs to, and that account - and
 * only that account - is the one deleted. The id is never taken from the
 * request body, which would make this an endpoint for deleting anybody.
 *
 * The delete cascades: the profile row, the site memberships, and the recovery
 * codes all reference auth.users and go with it. Sites the account owned are
 * handed back to nobody rather than removed.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gujgtjqqurildqurpffh.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const TIMEOUT_MS = 8000

/** One call to the auth API, with a ceiling on how long it may take. */
async function call(path, init) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${SUPABASE_URL}/auth/v1${path}`, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'POST only' })
    return
  }

  const authorization = request.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) {
    response.status(401).json({ error: 'not authorized' })
    return
  }

  if (!SERVICE_KEY) {
    response.status(503).json({
      error: 'Your account cannot be closed from here. Get in touch and we will close it for you.',
    })
    return
  }

  try {
    // Whose session this is, answered by the project rather than by the caller.
    const who = await call('/user', {
      headers: { apikey: SERVICE_KEY, Authorization: authorization },
    })
    if (!who.ok) {
      response.status(401).json({ error: 'That session is no longer valid. Sign in again.' })
      return
    }
    const account = await who.json().catch(() => null)
    if (!account?.id) {
      response.status(401).json({ error: 'That session is no longer valid. Sign in again.' })
      return
    }

    const removed = await call(`/admin/users/${account.id}`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    if (!removed.ok) {
      // What the auth API says here is written for whoever holds the service
      // key, and the person reading this asked to close their account and is
      // now being told a number. The status and the body go to the log, where
      // they are what we need to find out why; what they get told is that the
      // account is still theirs and nothing has happened to it.
      const said = await removed.text().catch(() => '')
      console.error(`account-delete: the auth API answered ${removed.status}`, said.slice(0, 500))
      response.status(502).json({
        error: 'Your account has not been closed and nothing on it has changed. Try again shortly.',
      })
      return
    }

    response.setHeader('Cache-Control', 'private, no-store')
    response.status(200).json({ ok: true })
  } catch {
    response.status(502).json({ error: 'The account service did not answer. Try again shortly.' })
  }
}
