/**
 * previews-admin - every preview site the studio has built, and what has
 * happened since: when its letter went, whether it was opened, whether the
 * site was looked at, the follow-up, and any reply.
 *
 * Read by the Previews view of the outreach console. Admin accounts only; it
 * writes nothing.
 */

import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { servedHereOr404 } from '../lib/http/guard.js'
import { previewUrl } from '../lib/outreach/previews.js'

const SITE_COLUMNS =
  'slug, name, industry, prospect_id, created_at, sent_at, message_id, first_viewed_at, last_viewed_at, view_count, follow_up_due_at, follow_up_sent_at, follow_up_message_id'

/** Samples are the template showcases, not sites built for anybody. */
const isSample = slug =>
  ['plumbing', 'barber', 'realestate'].includes(slug) || slug.startsWith('sample-')

async function board(db) {
  const { data: sites, error } = await db
    .from('preview_sites')
    .select(SITE_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const rows = (sites ?? []).filter(site => !isSample(site.slug))

  const messageIds = rows.flatMap(row => [row.message_id, row.follow_up_message_id]).filter(Boolean)
  const prospectIds = rows.map(row => row.prospect_id).filter(Boolean)
  const [messages, prospects] = await Promise.all([
    messageIds.length
      ? db
          .from('outreach_messages')
          .select('id, subject, to_address, opened_at, last_open_at, open_count')
          .in('id', messageIds)
      : { data: [] },
    prospectIds.length
      ? db.from('outreach_prospects').select('id, email, stage, replied_at').in('id', prospectIds)
      : { data: [] },
  ])
  for (const read of [messages, prospects]) if (read.error) throw new Error(read.error.message)
  const message = new Map((messages.data ?? []).map(row => [row.id, row]))
  const prospect = new Map((prospects.data ?? []).map(row => [row.id, row]))

  const previews = rows.map(row => {
    const first = message.get(row.message_id) ?? {}
    const follow = message.get(row.follow_up_message_id) ?? {}
    const who = prospect.get(row.prospect_id) ?? {}
    return {
      slug: row.slug,
      name: row.name,
      industry: row.industry,
      url: previewUrl(row.slug),
      to_address: first.to_address ?? who.email ?? null,
      created_at: row.created_at,
      sent_at: row.sent_at,
      subject: first.subject ?? null,
      opened_at: first.opened_at ?? null,
      last_open_at: first.last_open_at ?? null,
      open_count: first.open_count ?? 0,
      first_viewed_at: row.first_viewed_at,
      last_viewed_at: row.last_viewed_at,
      view_count: row.view_count ?? 0,
      follow_up_due_at: row.follow_up_due_at,
      follow_up_sent_at: row.follow_up_sent_at,
      follow_up_opened_at: follow.opened_at ?? null,
      replied_at: who.replied_at ?? null,
      stage: who.stage ?? null,
    }
  })

  const count = test => previews.filter(test).length
  return {
    previews,
    counts: {
      built: previews.length,
      sent: count(row => row.sent_at),
      opened: count(row => row.opened_at),
      viewed: count(row => row.sent_at && row.view_count > 0),
      followed_up: count(row => row.follow_up_sent_at),
      replied: count(row => row.replied_at),
    },
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const authorization = request.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) {
    response.status(401).json({ error: 'not authorized' })
    return
  }
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.status(405).json({ error: 'GET only' })
    return
  }
  const connected = connect()
  if (!connected) {
    response.status(500).json({ error: 'The previews endpoint has no database keys.' })
    return
  }
  response.setHeader('Cache-Control', 'private, no-store')
  try {
    const caller = await authorizeAdmin(connected, authorization)
    if (caller.error) {
      response.status(caller.status).json({ error: caller.error })
      return
    }
    response.status(200).json(await board(connected.db))
  } catch (cause) {
    console.error('previews admin: %s', cause?.message)
    response.status(502).json({ error: 'The previews could not be read. Try again in a moment.' })
  }
}
