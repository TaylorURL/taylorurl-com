/**
 * The preview funnel, for the Call List: of the preview sites sent, how many
 * were opened by a person, how many businesses came to look, what they did
 * there and how many wrote back, by layout family, by the week each was sent,
 * and before and after the new layouts.
 *
 * GET answers with the funnel as lib/outreach/funnel.js counts it, from the
 * rows lib/outreach/funnel-rows.js reads. Nothing is written, and nothing but
 * GET is answered.
 *
 * The tables carry row-level security with no public policy, so they are read
 * with the service role, and the service role never leaves this function. The
 * session is verified first and any role other than admin is refused, the
 * same door the Call List's own endpoint stands behind.
 */

import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { tableMissing } from '../lib/db/rows.js'
import { servedHereOr404 } from '../lib/http/guard.js'
import { funnelOf } from '../lib/outreach/funnel.js'
import { readFunnel } from '../lib/outreach/funnel-rows.js'

export const config = { maxDuration: 30 }

const UNREAD = 'The preview results could not be read. Try again in a moment.'

/**
 * The funnel as the page reads it, with whether every row behind it was read.
 *
 * @param {object} db
 * @param {Date} [now]
 */
export async function answer(db, now = new Date()) {
  const rows = await readFunnel(db)
  return { ...funnelOf(rows, { now }), complete: rows.complete }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const authorization = request.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) {
    return response.status(401).json({ error: 'not authorized' })
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'GET only' })
  }

  const wired = connect()
  if (!wired) return response.status(503).json({ error: 'The database is not configured here.' })

  response.setHeader('Cache-Control', 'private, no-store')

  try {
    const account = await authorizeAdmin(wired, authorization)
    if (account.status) return response.status(account.status).json({ error: account.error })
    try {
      return response.status(200).json(await answer(wired.db))
    } catch (cause) {
      if (tableMissing(cause)) {
        return response
          .status(503)
          .json({ error: 'The preview tables are not in this database yet.' })
      }
      console.error('previews-admin: %s', cause?.message || cause)
      return response.status(500).json({ error: UNREAD })
    }
  } catch (cause) {
    console.error('previews-admin: %s', cause?.message || cause)
    return response.status(502).json({ error: 'The preview results endpoint did not answer.' })
  }
}
