/**
 * The two switches that decide whether cold email goes out: the outreach
 * chains, and the letters to newly registered businesses.
 *
 * GET answers with both. POST sets either or both:
 *
 *   { cold: true | false, newBusiness: true | false }
 *
 * Each switch is the `sending_enabled` column on its own settings row, which is
 * what the send jobs read before every run, so a switch turned off here stops
 * the next run rather than the next deploy. Nothing else about either pipeline
 * is read or written.
 *
 * Both settings tables carry row-level security with no public policy, so the
 * reads and writes are made with the service role, and the service role never
 * leaves this function. The session is verified first and any role other than
 * admin is refused.
 */

import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { servedHereOr404 } from '../lib/http/guard.js'

/** Which switch each field names, and the row it lives on. */
const SWITCHES = {
  cold: 'outreach_settings',
  newBusiness: 'new_business_settings',
}

const UNREAD = 'The sending switches could not be read. Try again in a moment.'
const UNSAVED = 'That switch could not be saved. Try again in a moment.'

/** Both switches as they stand. A missing row is a pipeline that sends nothing. */
async function read(db) {
  const answers = await Promise.all(
    Object.values(SWITCHES).map(table =>
      db.from(table).select('sending_enabled').eq('id', 1).maybeSingle()
    )
  )
  const failed = answers.find(answer => answer.error)
  if (failed) {
    console.error('outreach-admin: %s', failed.error.message || failed.error)
    return { status: 500, body: { error: UNREAD } }
  }
  const body = {}
  Object.keys(SWITCHES).forEach((name, at) => {
    body[name] = answers[at].data?.sending_enabled === true
  })
  return { status: 200, body }
}

/**
 * The switches named in the body, set. A field that is not a true or a false is
 * not a setting, and a body with no setting in it is refused rather than
 * answered as saved.
 */
async function save(db, body) {
  const asked = Object.keys(SWITCHES).filter(name => typeof body[name] === 'boolean')
  if (!asked.length) {
    return { status: 400, body: { error: 'Say which switch to turn on or off.' } }
  }
  const now = new Date().toISOString()
  for (const name of asked) {
    const saved = await db
      .from(SWITCHES[name])
      .update({ sending_enabled: body[name], updated_at: now })
      .eq('id', 1)
      .select('id')
    if (saved.error) {
      console.error('outreach-admin: %s', saved.error.message || saved.error)
      return { status: 500, body: { error: UNSAVED } }
    }
    if (!saved.data?.length) {
      return { status: 503, body: { error: `The ${SWITCHES[name]} row is missing.` } }
    }
  }
  return read(db)
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const authorization = request.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) {
    response.status(401).json({ error: 'not authorized' })
    return
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    response.status(405).json({ error: 'GET or POST only' })
    return
  }

  const connected = connect()
  if (!connected) {
    response.status(500).json({
      error:
        'The outreach endpoint has no database keys. Set SUPABASE_ANON_KEY and ' +
        'SUPABASE_SERVICE_ROLE_KEY on the deployment.',
    })
    return
  }

  response.setHeader('Cache-Control', 'private, no-store')

  try {
    const caller = await authorizeAdmin(connected, authorization)
    if (caller.error) {
      response.status(caller.status).json({ error: caller.error })
      return
    }
    const answer =
      request.method === 'GET'
        ? await read(connected.db)
        : await save(connected.db, request.body ?? {})
    response.status(answer.status).json(answer.body)
  } catch {
    response.status(502).json({ error: 'The outreach endpoint did not answer.' })
  }
}
