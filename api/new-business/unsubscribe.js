/**
 * Takes a new business off the list from the link in its email.
 *
 * The token on the link is the whole credential, the same as on every other
 * unsubscribe link the studio sends. The address goes on the shared
 * suppression list, so nothing the studio sends reaches it again, the lead is
 * marked 'unsubscribed', and so is its row on outreach_prospects where it has
 * one, so the call list drops it too. A GET lands on the site's own
 * unsubscribe page and a one-click POST from a mail client is answered in
 * JSON, both through lib/http/unsubscribe.js.
 */

import { connect } from '../../lib/db/clients.js'
import { UUID_PATTERN } from '../../lib/db/fields.js'
import { servedHereOr404 } from '../../lib/http/guard.js'
import { answer, readToken } from '../../lib/http/unsubscribe.js'

async function retire(db, token) {
  const { data: lead, error } = await db
    .from('new_business_leads')
    .select('id, email, stage, prospect_id')
    .eq('unsub_token', token)
    .maybeSingle()
  if (error) return 'failed'
  if (!lead) return 'invalid'
  if (lead.stage === 'unsubscribed') return 'already'

  if (lead.email) {
    const { error: held } = await db.from('suppression').upsert(
      {
        email: String(lead.email).toLowerCase(),
        reason: 'unsubscribed',
        note: 'new business mail',
      },
      { onConflict: 'email', ignoreDuplicates: true }
    )
    if (held) return 'failed'
  }

  const at = new Date().toISOString()
  const { error: marked } = await db
    .from('new_business_leads')
    .update({ stage: 'unsubscribed', updated_at: at })
    .eq('id', lead.id)
  if (marked) return 'failed'

  if (lead.prospect_id) {
    const { error: mirrored } = await db
      .from('outreach_prospects')
      .update({ stage: 'unsubscribed' })
      .eq('id', lead.prospect_id)
    if (mirrored) return 'failed'
  }
  return 'done'
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'GET or POST only' })
  }
  response.setHeader('Cache-Control', 'private, no-store')

  const token = readToken(request)
  if (!UUID_PATTERN.test(token)) return answer(request, response, { state: 'invalid', status: 400 })

  const wired = connect()
  if (!wired) return answer(request, response, { state: 'failed', status: 503 })

  const state = await retire(wired.db, token)
  answer(request, response, { state, status: state === 'invalid' ? 400 : 500 })
}
