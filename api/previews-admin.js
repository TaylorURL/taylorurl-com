/**
 * previews-admin - every preview site the studio has built, and what has
 * happened since: when its letter went, whether it was opened, whether the
 * site was looked at, the follow-up, and any reply. Beside each one, what its
 * visits did on the site - read from `preview_behaviour()`, which rolls up the
 * sessions /api/preview-events records - and, across previews, which sections
 * and calls to action hold attention in each template.
 *
 * Beside them, every text thread: the preview texts the line sent a business
 * it can only text, and whatever came back, newest thread first. A POST naming
 * a number and a body answers that thread from the same line, as the person
 * at the console; it is the one write here, and a number that texted STOP is
 * refused before Twilio is asked.
 *
 * Read by the Previews view of the outreach console. Admin accounts only.
 */

import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { servedHereOr404 } from '../lib/http/guard.js'
import { previewUrl } from '../lib/outreach/previews.js'
import { sendText, usPhone } from '../lib/outreach/sending/texts.js'

const SITE_COLUMNS =
  'id, slug, name, industry, prospect_id, created_at, sent_at, message_id, first_viewed_at, last_viewed_at, view_count, follow_up_due_at, follow_up_sent_at, follow_up_message_id, channel'

/** How many texts the threads are read from, newest first. */
const TEXT_ROWS = 500

/** The longest answer the console sends, which is ten text segments. */
const REPLY_MAX = 1600

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
  const [messages, prospects, behaviour] = await Promise.all([
    messageIds.length
      ? db
          .from('outreach_messages')
          .select('id, subject, to_address, opened_at, last_open_at, open_count')
          .in('id', messageIds)
      : { data: [] },
    prospectIds.length
      ? db
          .from('outreach_prospects')
          .select('id, email, phone, stage, replied_at')
          .in('id', prospectIds)
      : { data: [] },
    db.rpc('preview_behaviour'),
  ])
  for (const read of [messages, prospects, behaviour]) {
    if (read.error) throw new Error(read.error.message)
  }
  const visits = behaviour.data?.sites ?? {}
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
      channel: row.channel,
      to_address:
        row.channel === 'text' ? usPhone(who.phone) : (first.to_address ?? who.email ?? null),
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
      behaviour: visits[row.id] ?? null,
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
    templates: behaviour.data?.templates ?? {},
    texts: await threads(db),
  }
}

/**
 * Every text thread, newest first: the business, its preview, whether the
 * number is closed and why, and each text in the order it went.
 */
async function threads(db) {
  const { data: texts, error } = await db
    .from('outreach_texts')
    .select(
      'id, prospect_id, site_id, direction, status, step, phone, body, error, sent_at, created_at'
    )
    .neq('status', 'drafted')
    .order('created_at', { ascending: false })
    .limit(TEXT_ROWS)
  if (error) throw new Error(error.message)
  if (!texts?.length) return []

  const phones = [...new Set(texts.map(text => text.phone))]
  const prospectIds = [...new Set(texts.map(text => text.prospect_id).filter(Boolean))]
  const siteIds = [...new Set(texts.map(text => text.site_id).filter(Boolean))]
  const [closed, prospects, sites] = await Promise.all([
    db.from('text_suppression').select('phone, reason').in('phone', phones),
    prospectIds.length
      ? db.from('outreach_prospects').select('id, name').in('id', prospectIds)
      : { data: [] },
    siteIds.length ? db.from('preview_sites').select('id, slug').in('id', siteIds) : { data: [] },
  ])
  for (const read of [closed, prospects, sites]) {
    if (read.error) throw new Error(read.error.message)
  }
  const reason = new Map((closed.data ?? []).map(row => [row.phone, row.reason]))
  const name = new Map((prospects.data ?? []).map(row => [row.id, row.name]))
  const slug = new Map((sites.data ?? []).map(row => [row.id, row.slug]))

  const byPhone = new Map()
  for (const text of [...texts].reverse()) {
    const thread = byPhone.get(text.phone) ?? {
      phone: text.phone,
      name: null,
      slug: null,
      url: null,
      closed: reason.get(text.phone) ?? null,
      last_at: null,
      texts: [],
    }
    thread.name ??= name.get(text.prospect_id) ?? null
    const site = slug.get(text.site_id)
    if (site && !thread.slug) {
      thread.slug = site
      thread.url = previewUrl(site)
    }
    thread.last_at = text.sent_at ?? text.created_at
    thread.texts.push({
      id: text.id,
      direction: text.direction,
      status: text.status,
      body: text.body,
      error: text.error,
      at: text.sent_at ?? text.created_at,
    })
    byPhone.set(text.phone, thread)
  }
  return [...byPhone.values()].sort((a, b) => Date.parse(b.last_at) - Date.parse(a.last_at))
}

/**
 * One answer to a text thread, from the same line, as the person at the
 * console. It is not a preview text, so no window or cap holds it: somebody
 * who wrote back is answered when the studio answers them. A number that has
 * texted STOP is refused here, which Twilio would refuse anyway.
 */
async function reply(db, body) {
  const phone = usPhone(body?.phone)
  const words = typeof body?.body === 'string' ? body.body.trim().slice(0, REPLY_MAX) : ''
  if (!phone || !words) return { status: 400, error: 'Name a number and write the answer.' }

  const [settings, closed, last] = await Promise.all([
    db.from('outreach_settings').select('text_service_sid').eq('id', 1).maybeSingle(),
    db.from('text_suppression').select('reason').eq('phone', phone).maybeSingle(),
    db
      .from('outreach_texts')
      .select('prospect_id, site_id')
      .eq('phone', phone)
      .not('prospect_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1),
  ])
  for (const read of [settings, closed, last]) {
    if (read.error) throw new Error(read.error.message)
  }
  const service = settings.data?.text_service_sid
  if (!service) return { status: 409, error: 'The text line has no number yet.' }
  if (closed.data?.reason === 'stop') {
    return { status: 409, error: 'That number texted STOP, so the line cannot text it.' }
  }
  const thread = last.data?.[0]
  if (!thread) return { status: 404, error: 'No thread with that number.' }

  const { data: row, error } = await db
    .from('outreach_texts')
    .insert({
      prospect_id: thread.prospect_id,
      site_id: thread.site_id,
      direction: 'outbound',
      status: 'drafted',
      phone,
      body: words,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  try {
    const providerId = await sendText({ to: phone, body: words, service })
    const at = new Date().toISOString()
    const marked = await db
      .from('outreach_texts')
      .update({ status: 'sent', sent_at: at, provider_id: providerId })
      .eq('id', row.id)
    if (marked.error) throw new Error(marked.error.message)
    return { status: 200, sent: row.id, at }
  } catch (cause) {
    const said = String(cause?.message || cause).slice(0, 500)
    await db.from('outreach_texts').update({ status: 'failed', error: said }).eq('id', row.id)
    return { status: 502, error: `Twilio refused it: ${said}` }
  }
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
    if (request.method === 'POST') {
      const { status, ...answer } = await reply(connected.db, request.body)
      response.status(status).json(answer)
      return
    }
    response.status(200).json(await board(connected.db))
  } catch (cause) {
    console.error('previews admin: %s', cause?.message)
    response.status(502).json({ error: 'The previews could not be read. Try again in a moment.' })
  }
}
