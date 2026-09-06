/**
 * One request takes a lead off the list, and off every other one.
 *
 * The follow-up is the only message a lead ever gets, and this is the link
 * under it. `unsub_token` is the whole credential and the whole interaction:
 * the reader following it carries no session and no account, and asking for
 * either would make the link useless, which is the same thing as not having
 * one.
 *
 * What it writes is a timestamp on the lead and a row on `public.suppression`
 * with the reason 'unsubscribed', which is the list the newsletter and the
 * outreach pipeline both answer to. So unsubscribing here is not a preference
 * about one message; it is this domain being told to stop, and it stops
 * everything.
 *
 * A browser gets the page at /unsubscribe with the outcome in the query
 * string. A mailbox provider sending the one-click POST gets JSON and renders
 * nothing. This mirrors api/outreach/unsubscribe.js deliberately: two links
 * that behave differently is two links a reader has to trust separately.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { connect } from '../lib/db/clients.js'
import { UUID_PATTERN } from '../lib/db/fields.js'
import { LEADS } from '../lib/leads/record.js'

/** The page a click lands on, which reports what the request settled. */
const LANDING = '/unsubscribe'

/** The token, from the query string or from a one-click body. */
function readToken(request) {
  const fromQuery = request.query?.token
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim()
  const fromBody = request.body?.token
  return typeof fromBody === 'string' ? fromBody.trim() : ''
}

/** What the caller is told, in whichever form the caller can read. */
function answer(request, response, { state, status = 200 }) {
  if (request.method === 'POST') {
    const ok = state === 'done' || state === 'already'
    response.status(ok ? 200 : status).json({ ok, already: state === 'already', state })
    return
  }
  response.redirect(302, `${LANDING}?state=${state}`)
}

/**
 * Takes one lead off the list.
 *
 * The suppression row goes on first. If only one of the two writes lands, the
 * one that must have landed is the one that stops the mail: a lead marked
 * unsubscribed with no suppression row would still be reachable by the
 * newsletter, while a suppression row with no timestamp on the lead costs a
 * figure in the console and nothing else.
 *
 * @returns {'done'|'already'|'invalid'|'failed'}
 */
async function retire(db, token) {
  const { data: lead, error: lookupError } = await db
    .from(LEADS)
    .select('id, email, unsubscribed_at')
    .eq('unsub_token', token)
    .maybeSingle()

  if (lookupError) return 'failed'
  if (!lead) return 'invalid'
  if (lead.unsubscribed_at) return 'already'

  // An address already on the list keeps the reason it arrived with, since a
  // bounce or a complaint is the more specific fact about it.
  const { error: suppressError } = await db
    .from('suppression')
    .upsert(
      { email: lead.email, reason: 'unsubscribed', note: 'configurator follow-up' },
      { onConflict: 'email', ignoreDuplicates: true }
    )
  if (suppressError) return 'failed'

  const { error: markError } = await db
    .from(LEADS)
    .update({ unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', lead.id)
  if (markError) return 'failed'

  return 'done'
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'GET or POST only' })
  }

  const token = readToken(request)
  if (!UUID_PATTERN.test(token)) return answer(request, response, { state: 'invalid', status: 400 })

  const wired = connect()
  if (!wired) return answer(request, response, { state: 'failed', status: 503 })

  const state = await retire(wired.db, token)
  answer(request, response, { state, status: state === 'invalid' ? 400 : 500 })
}
