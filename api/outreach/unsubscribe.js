/**
 * unsubscribe — one request takes a prospect off the list.
 *
 * `unsub_token` is the whole credential and the whole interaction. A GET from
 * the link in a message and a POST from an RFC 8058 one-click header both do
 * the same work on arrival: the prospect moves to 'unsubscribed' and the
 * address goes onto `public.suppression` with the reason 'unsubscribed', which
 * holds it off every other list too.
 *
 * There is no confirmation step and no session. This is the one endpoint under
 * api/outreach that stands outside the door in lib/outreach/runtime.js, because
 * the reader following the link carries neither the scheduler's secret nor a
 * console account, and asking for either would make the link useless. The token
 * is what stands in for both: it is a UUID, it is checked against the shape of
 * one before it reaches the database, and it identifies exactly one row.
 *
 * A browser gets the page at /unsubscribe, told what happened in the query
 * string, so the reader sees a plain statement rather than a JSON body. A
 * mailbox provider sending the one-click POST gets JSON and renders nothing.
 *
 * What it writes: the prospect's stage and unsubscribed timestamp, one
 * suppression row, and the mailing list row for the same address where one
 * exists. An address already suppressed keeps the reason it arrived with, since
 * a bounce or a complaint is the more specific fact.
 */

import { servedHereOr404 } from '../../lib/http/guard.js'
import { connect } from '../../lib/db/clients.js'
import { UUID_PATTERN } from '../../lib/db/fields.js'

/** The page a click lands on, which reports what the request settled. */
const LANDING = '/unsubscribe'

/**
 * The token, from the query string or the posted body.
 *
 * One-click sends `List-Unsubscribe=One-Click` as a form body and keeps the
 * token on the URL, so the query string is read first and a body is only
 * consulted when there is nothing there.
 */
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
 * Moves one prospect off the list.
 *
 * @returns {'done'|'already'|'invalid'|'failed'} What the token turned out to be.
 */
async function retire(db, token) {
  const { data: prospect, error: lookupError } = await db
    .from('outreach_prospects')
    .select('id, email, stage')
    .eq('unsub_token', token)
    .maybeSingle()

  if (lookupError) return 'failed'
  if (!prospect) return 'invalid'
  if (prospect.stage === 'unsubscribed') return 'already'

  const { error: updateError } = await db
    .from('outreach_prospects')
    .update({ stage: 'unsubscribed', skip_reason: 'unsubscribed by link' })
    .eq('id', prospect.id)
  if (updateError) return 'failed'

  // The stage stops this pipeline and the suppression stops the rest, so an
  // address that asked once is off every list without asking again. A prospect
  // sourced without an address has nothing to suppress and is already stopped
  // by its stage.
  if (prospect.email) {
    const address = String(prospect.email).toLowerCase()
    const { error: suppressionError } = await db
      .from('suppression')
      .upsert(
        { email: address, reason: 'unsubscribed', note: 'outreach link' },
        { onConflict: 'email', ignoreDuplicates: true }
      )
    if (suppressionError) return 'failed'

    // The mailing list carries the same address, because being written to is
    // what put it there. Suppression is already enough to stop every send, but
    // a row still reading 'subscribed' says on screen that somebody is on a
    // list they have just left - so the record is corrected as well as
    // overruled. An address that was never on the list updates nothing, which
    // is the right answer rather than an error.
    const { error: listError } = await db
      .from('subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('email', address)
      .neq('status', 'unsubscribed')
    if (listError) console.error('outreach unsubscribe: list: %s', listError.message)
  }

  return 'done'
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    response.status(405).json({ error: 'GET or POST only' })
    return
  }

  response.setHeader('Cache-Control', 'private, no-store')

  const token = readToken(request)
  if (!UUID_PATTERN.test(token)) {
    answer(request, response, { state: 'invalid', status: 400 })
    return
  }

  const connected = connect()
  if (!connected) {
    answer(request, response, { state: 'failed', status: 503 })
    return
  }

  let state = 'failed'
  try {
    state = await retire(connected.db, token)
  } catch (cause) {
    console.error('outreach unsubscribe: %s', cause.message)
  }

  answer(request, response, { state, status: state === 'invalid' ? 404 : 500 })
}
