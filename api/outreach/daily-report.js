/**
 * The 5 PM recap of the day's outreach, delivered to the studio's own inbox.
 *
 * Every day at five in Texas one letter goes to the studio inbox: a single
 * table of what each chain sent today, how many of those letters were opened,
 * and who wrote back, with the first line of each person's reply under the
 * chain their business was written on. The figures and the layout are
 * lib/outreach/daily-report.js's.
 *
 * The schedule asks at both 22:00 and 23:00 UTC, since five in Texas is one of
 * the two depending on the clocks, and only the run that lands on the five
 * o'clock hour sends. The other answers that it is not five yet, or not five
 * any more, and sends nothing.
 *
 * It leaves the way the studio's notices do, from the site's own address
 * through Resend (lib/mail/notice.js), so it is not a send against any outreach
 * address's day, not a message row and not a row in outreach_runs. Nothing is
 * written. Only the schedule may run it.
 *
 * A new business letter that failed is counted beside that chain only while
 * its lead has had no letter since, so a failure the next run put right drops
 * out of the recap rather than reading as a business missed.
 */

import { bearerOr401, methodsOr405, servedHereOr404 } from '../../lib/http/guard.js'
import { isScheduler } from '../../lib/http/scheduler.js'
import { connect } from '../../lib/db/clients.js'
import { ownsSchedules } from '../../lib/site/current.js'
import { readAll } from '../../lib/db/rows.js'
import { sendNotice } from '../../lib/mail/notice.js'
import { localDay } from '../../lib/outreach/sending/schedule.js'
import { clockIn } from '../../lib/time/zone.js'
import { OTHER, chainOf, renderRecap, tallyOf, windowOf } from '../../lib/outreach/daily-report.js'
import { CHAIN_REGISTRY } from '../../lib/outreach/variants.js'

/**
 * The name of the chain a letter id belongs to, looked up in the registry the
 * chains derive, or null where the registry does not know the id - a letter
 * retired before the chains existed, whose messages this recap still counts.
 *
 * `chainOf` reads this in place of guessing from a word in the id.
 */
const chainNameOf = id => CHAIN_REGISTRY.chainOf(id)?.name ?? null

export const config = { maxDuration: 60 }

/** The hour in Texas the recap goes at. */
export const RECAP_HOUR = 17

const RESEND_API_KEY = process.env.RESEND_API_KEY

/** Rows of `table` whose `column` is one of `values`, read in runs. */
async function rowsIn(db, table, select, column, values, narrow = query => query) {
  if (!values.length) return []
  const { rows } = await readAll(() =>
    narrow(db.from(table).select(select, { count: 'exact' }).in(column, values))
  )
  return rows
}

/**
 * The chain each reply came back on: the draft preview where its business was
 * sent one, else the chain of the first cold letter it got, else the new
 * business chain where it is a new business, else none of the four.
 */
async function chainsOf(db, replies) {
  const ids = [...new Set(replies.map(reply => reply.prospect_id).filter(Boolean))]
  const froms = [...new Set(replies.map(reply => reply.from_address).filter(Boolean))]
  const [previews, letters, leadsById, leadsByEmail] = await Promise.all([
    rowsIn(db, 'preview_sites', 'prospect_id', 'prospect_id', ids, query =>
      query.not('sent_at', 'is', null)
    ),
    rowsIn(db, 'outreach_messages', 'prospect_id, variant_id, sent_at', 'prospect_id', ids, query =>
      query.eq('direction', 'outbound').eq('status', 'sent').order('sent_at')
    ),
    rowsIn(db, 'new_business_leads', 'prospect_id, name', 'prospect_id', ids),
    rowsIn(db, 'new_business_leads', 'email, name', 'email', froms),
  ])
  const previewed = new Set(previews.map(row => row.prospect_id))
  const first = new Map()
  for (const letter of letters)
    if (!first.has(letter.prospect_id)) first.set(letter.prospect_id, letter)
  const leadOf = new Map(leadsById.map(lead => [lead.prospect_id, lead]))
  const leadFrom = new Map(leadsByEmail.map(lead => [String(lead.email).toLowerCase(), lead]))

  return replies.map(reply => {
    const id = reply.prospect_id
    const lead = (id && leadOf.get(id)) || leadFrom.get(String(reply.from_address).toLowerCase())
    let chain = OTHER
    if (id && previewed.has(id)) chain = 'Draft preview'
    else if (id && first.has(id)) chain = chainOf(first.get(id).variant_id, chainNameOf)
    else if (lead) chain = 'New business'
    return {
      chain,
      name: reply.outreach_prospects?.name || lead?.name || '',
      from: reply.from_address,
      subject: reply.subject,
      body: reply.body_text,
      intent: reply.intent,
    }
  })
}

/** One Central day's rows, in the shape `tallyOf` counts. */
async function rowsOf(db, date) {
  const { from, to } = windowOf(date)
  const [outreach, newBusiness, failed, replies] = await Promise.all([
    readAll(() =>
      db
        .from('outreach_messages')
        .select('id, variant_id, opened_at, sent_at', { count: 'exact' })
        .eq('direction', 'outbound')
        .eq('status', 'sent')
        .gte('sent_at', from)
        .lt('sent_at', to)
        .order('sent_at')
    ),
    readAll(() =>
      db
        .from('new_business_messages')
        .select('id, lead_id, sent_at', { count: 'exact' })
        .eq('status', 'sent')
        .gte('sent_at', from)
        .lt('sent_at', to)
        .order('sent_at')
    ),
    readAll(() =>
      db
        .from('new_business_messages')
        .select('id, lead_id, error, created_at, new_business_leads(name)', { count: 'exact' })
        .eq('status', 'failed')
        .gte('created_at', from)
        .lt('created_at', to)
        .order('created_at')
    ),
    readAll(() =>
      db
        .from('outreach_messages')
        .select(
          'id, prospect_id, from_address, subject, body_text, intent, sent_at, outreach_prospects(name)',
          { count: 'exact' }
        )
        .eq('direction', 'inbound')
        .eq('status', 'received')
        .gte('sent_at', from)
        .lt('sent_at', to)
        .order('sent_at')
    ),
  ])

  const failedLeads = failed.rows.map(row => row.lead_id).filter(Boolean)
  const putRight = new Set(
    (
      await rowsIn(db, 'new_business_messages', 'lead_id', 'lead_id', failedLeads, query =>
        query.eq('status', 'sent')
      )
    ).map(row => row.lead_id)
  )

  return {
    outreach: outreach.rows,
    newBusiness: newBusiness.rows,
    failed: failed.rows
      .filter(row => !putRight.has(row.lead_id))
      .map(row => ({ name: row.new_business_leads?.name ?? 'a new business', error: row.error })),
    replies: await chainsOf(db, replies.rows),
  }
}

export async function work({ db, counts, now = new Date() }, post = sendNotice) {
  const clock = clockIn(now)
  if (clock.hour !== RECAP_HOUR) {
    return { note: `It is ${clock.hour}:00 in Texas, not five, so no recap was sent.` }
  }
  const today = localDay(now).date
  const rows = await rowsOf(db, today)
  const recap = renderRecap(today, tallyOf(rows, chainNameOf))
  counts.examined = rows.outreach.length + rows.newBusiness.length + rows.replies.length
  await post(recap, RESEND_API_KEY, { urgent: false })
  counts.changed = 1
  return { note: `The recap for ${today} went to the studio inbox: ${recap.subject}` }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (!ownsSchedules()) return response.status(204).end()
  const authorization = bearerOr401(request, response)
  if (!authorization) return
  if (!methodsOr405(request, response, ['GET', 'POST'])) return
  if (!isScheduler(authorization)) {
    return response.status(403).json({ error: 'Only the schedule sends the recap.' })
  }
  const connected = connect()
  if (!connected) return response.status(503).json({ error: 'The recap has no database keys.' })

  response.setHeader('Cache-Control', 'private, no-store')
  const counts = { examined: 0, changed: 0 }
  try {
    const detail = await work({ db: connected.db, counts })
    console.log('outreach recap: %s', detail.note)
    response.status(200).json({ ...counts, ...detail })
  } catch (cause) {
    const message = cause?.message || String(cause)
    console.error('outreach recap: %s', message)
    response.status(502).json({ ...counts, error: 'the recap did not go' })
  }
}
