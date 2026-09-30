/**
 * What the outreach console's New Businesses view reads and changes.
 *
 * GET answers with the settings, how many companies stand at each stage, what
 * has been sent today, the last runs of each job, and one page of companies,
 * narrowed to a stage where one is asked for. POST with `action: 'settings'`
 * changes the sending switch or the daily cap.
 *
 * An admin session is the only way in, the same as the outreach endpoint.
 */

import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { servedHereOr404 } from '../lib/http/guard.js'
import { dayStartsAt } from '../lib/outreach/sending/schedule.js'
import { LEAD_STAGES } from '../lib/new-business/stages.js'

const PAGE = 50

const LEAD_COLUMNS =
  'id, name, formed_on, city, state, stage, website, site_found_by, email, phone, checks, next_check_at, contacted_at, created_at'

async function board(db, query) {
  const stage = LEAD_STAGES.includes(query.stage) ? query.stage : null
  const page = Math.max(0, Number.parseInt(query.page, 10) || 0)

  const counting = LEAD_STAGES.map(name =>
    db.from('new_business_leads').select('id', { count: 'exact', head: true }).eq('stage', name)
  )
  let listing = db
    .from('new_business_leads')
    .select(LEAD_COLUMNS, { count: 'exact' })
    .order(stage === 'contacted' ? 'contacted_at' : 'formed_on', {
      ascending: false,
      nullsFirst: false,
    })
    .range(page * PAGE, page * PAGE + PAGE - 1)
  if (stage) listing = listing.eq('stage', stage)
  else listing = listing.neq('stage', 'waiting')

  const [settings, sent, runs, list, ...counted] = await Promise.all([
    db
      .from('new_business_settings')
      .select('sending_enabled, daily_cap, source_cursor')
      .eq('id', 1)
      .maybeSingle(),
    db
      .from('new_business_messages')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', dayStartsAt()),
    db
      .from('new_business_runs')
      .select('job, started_at, finished_at, examined, changed, note, error')
      .order('started_at', { ascending: false })
      .limit(12),
    listing,
    ...counting,
  ])
  for (const read of [settings, sent, runs, list, ...counted]) {
    if (read.error) throw new Error(read.error.message)
  }

  const counts = {}
  LEAD_STAGES.forEach((name, index) => (counts[name] = counted[index].count ?? 0))

  return {
    status: 200,
    body: {
      settings: settings.data,
      counts,
      sent_today: sent.count ?? 0,
      runs: runs.data,
      stage,
      page,
      page_size: PAGE,
      total: list.count ?? 0,
      leads: list.data,
    },
  }
}

async function saveSettings(db, body) {
  const change = {}
  if (typeof body.sending_enabled === 'boolean') change.sending_enabled = body.sending_enabled
  if (body.daily_cap !== undefined) {
    const cap = Number(body.daily_cap)
    if (!Number.isInteger(cap) || cap < 0 || cap > 500) {
      return {
        status: 400,
        body: { error: 'The daily cap has to be a whole number from 0 to 500.' },
      }
    }
    change.daily_cap = cap
  }
  if (!Object.keys(change).length) return { status: 400, body: { error: 'Nothing to change.' } }
  const { data, error } = await db
    .from('new_business_settings')
    .update({ ...change, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select('sending_enabled, daily_cap, source_cursor')
    .single()
  if (error) throw new Error(error.message)
  return { status: 200, body: { settings: data } }
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
    response.status(500).json({ error: 'The new-business endpoint has no database keys.' })
    return
  }
  response.setHeader('Cache-Control', 'private, no-store')

  try {
    const caller = await authorizeAdmin(connected, authorization)
    if (caller.error) {
      response.status(caller.status).json({ error: caller.error })
      return
    }
    let answer
    if (request.method === 'GET') {
      answer = await board(connected.db, request.query ?? {})
    } else {
      const body = request.body ?? {}
      answer =
        body.action === 'settings'
          ? await saveSettings(connected.db, body)
          : { status: 400, body: { error: 'Unknown action.' } }
    }
    response.status(answer.status).json(answer.body)
  } catch (cause) {
    console.error('new business admin: %s', cause?.message)
    response
      .status(502)
      .json({ error: 'The new businesses could not be read. Try again in a moment.' })
  }
}
