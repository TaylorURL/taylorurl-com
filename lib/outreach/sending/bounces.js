/**
 * Hard bounces against sends, one day at a time.
 *
 * The trailing rate is the figure the whole ramp is judged on, so it has to be
 * readable rather than derivable, and it has to be the same figure wherever it
 * is read. Two callers need it: lib/outreach/sending/ramp.js decides the day's cap on
 * it, and api/outreach-admin.js shows it on the mail view. A second
 * implementation would be a console reporting one rate while the cap moved on
 * another.
 *
 * A bounce is counted against the day its message went out rather than the day
 * the notice arrived, since a notice can take hours to come back and a rate
 * that put it on the wrong day would blame a day that sent nothing. The day is
 * the local one the cap is already counted in.
 *
 * Only a hard bounce is here. api/outreach/watch.js records a permanent failure
 * and drops a temporary one, so every bounced row in the table is a hard one by
 * construction.
 *
 * Nothing here reads a complaint, because nothing can. Sending is over Gmail
 * SMTP, which runs no feedback loop, so a reader marking a message as spam
 * tells Google and tells this side nothing at all. There is no column for it
 * and no reading behind one. lib/outreach/sending/limits.js RAMP_BLIND_MAX is what the
 * ramp does about that.
 */

import { readAll } from '../../db/rows.js'
import { dayStartsAt, localDay } from './schedule.js'
import { followUpColumns } from './queue.js'

// Days of sending the record is read over. A rate taken over two days of
// sending at a low cap swings on a single address, so the window is wide enough
// that one bad day moves it rather than deciding it.
export const BOUNCE_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

// How many addresses one question about bounce notices names.
//
// A filter on a list of ids is not sent as a body. PostgREST takes it in the
// query string, so the whole list travels in the address line, and an address
// line has a length the server refuses past - with no useful sentence when it
// does. What comes back is a bare 400 whose message is the words "Bad Request",
// which the console then showed as a board it could not read and the ramp read
// as a day it could not price.
//
// The list this is built from is every address written to in the trailing two
// weeks, so it does not settle at a size: it is the sending rate times the
// window, and it grows with the first of those. At 640 addresses the request
// was 25,318 characters and refused; nothing had changed but the number of
// people written to. That is #565, and it is why a cap rather than a bigger
// one - any fixed ceiling is a date the board stops working on.
//
// Two hundred is what the enrichment sweep writes at a time, and at roughly
// forty characters an address it puts a question near eight thousand.
const ASK_ABOUT = 200

/**
 * Sends and hard bounces across the trailing window, per day and in total.
 *
 * @param {object} db A service-role client.
 * @returns {Promise<{days: object[], window_days: number, sent: number,
 *   bounced: number, rate: number|null}>} `rate` is a percentage, and null on a
 *   day or a window that sent nothing.
 */
export async function bounceRecord(db) {
  const opened = new Date(Date.now() - (BOUNCE_DAYS - 1) * DAY_MS)
  const from = dayStartsAt(opened)

  // Follow-ups run outside the ramp, so where the column that marks them
  // exists they are left out of the record the cap moves on.
  const firstOnly = await followUpColumns(db)
  const sent = await readAll(() => {
    let query = db
      .from('outreach_messages')
      .select('prospect_id, sent_at')
      .eq('direction', 'outbound')
      .eq('status', 'sent')
      .gte('sent_at', from)
    if (firstOnly) query = query.or('step.is.null,step.eq.1')
    return query.order('sent_at', { ascending: true })
  })

  // Every day in the window, including the ones that sent nothing. A run of
  // days with a gap in it reads as a shorter history rather than as a quiet
  // week.
  const days = new Map()
  for (let back = BOUNCE_DAYS - 1; back >= 0; back -= 1) {
    const { date } = localDay(new Date(Date.now() - back * DAY_MS))
    days.set(date, { date, sent: 0, bounced: 0 })
  }

  const dayOf = new Map()
  for (const row of sent.rows) {
    if (!row.sent_at) continue
    const { date } = localDay(new Date(row.sent_at))
    dayOf.set(row.prospect_id, date)
    const day = days.get(date)
    if (day) day.sent += 1
  }

  const ids = [...dayOf.keys()]
  let bounced = 0
  // One address bounces once however many notices its server sends, and it is
  // counted once however many questions the addresses were spread across.
  const bouncedIds = new Set()
  for (let at = 0; at < ids.length; at += ASK_ABOUT) {
    const asking = ids.slice(at, at + ASK_ABOUT)
    const notices = await readAll(() =>
      db
        .from('outreach_messages')
        .select('prospect_id')
        .eq('direction', 'inbound')
        .eq('status', 'bounced')
        .in('prospect_id', asking)
    )
    for (const row of notices.rows) bouncedIds.add(row.prospect_id)
  }
  for (const id of bouncedIds) {
    const day = days.get(dayOf.get(id))
    if (!day) continue
    day.bounced += 1
    bounced += 1
  }

  const total = sent.rows.length
  return {
    days: [...days.values()].map(day => ({
      ...day,
      rate: day.sent ? (day.bounced / day.sent) * 100 : null,
    })),
    window_days: BOUNCE_DAYS,
    sent: total,
    bounced,
    rate: total ? (bounced / total) * 100 : null,
  }
}
