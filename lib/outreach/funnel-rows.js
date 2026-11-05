/**
 * The rows the preview funnel (lib/outreach/funnel.js) is counted from, read
 * the way the Call List reads them.
 *
 * Every preview site that was sent, every letter sent to those businesses,
 * every visit filed against the sites with its taps on Make It Yours, and
 * every reply that came back from them. The replies are read here for who
 * wrote them, since that takes the mail readers and the funnel itself is
 * strings and arithmetic: a reply is kept only where a person typed it, read
 * the way the 5 PM recap reads one (`isAutomated`, which takes the
 * auto-responders the mailbox reader knew and the receipts it did not) and the
 * way the Call List reads one (`looksAutomatic`, the after-hours notices and
 * help desks). A bounce is filed under a status of its own and is never read
 * as a reply. A reply asking for no more mail is a person, and is marked
 * `stop`.
 *
 * Nothing is written. The lists are asked for a hundred businesses at a time,
 * so a long one is never refused in the query string, and each is read to its
 * end past the thousand-row ceiling (lib/db/rows.js).
 */

import { readAll } from '../db/rows.js'
import { isAutomated } from './daily-report.js'
import { looksAutomatic } from './prospects/engaged.js'
import { readOptOut } from './sending/replies.js'

/** Ids handed to one `in` filter. */
const IDS_AT_ONCE = 100

/** The kind a tap on Make It Yours is filed under in `preview_events`. */
const CLAIM_KIND = 'claim'

const SITE_COLUMNS = 'id, slug, industry, prospect_id, sent_at, created_at, view_count'
const LETTER_COLUMNS = 'id, prospect_id, sent_at, opened_at, last_open_at, open_count'
const VISIT_COLUMNS =
  'id, site_id, started_at, last_seen_at, active_ms, max_scroll, pages, calls, emails, ctas, form_submits'
const REPLY_COLUMNS = 'id, prospect_id, subject, body_text, intent, sent_at'

function runsOf(values, size = IDS_AT_ONCE) {
  const runs = []
  for (let at = 0; at < values.length; at += size) runs.push(values.slice(at, at + size))
  return runs
}

/** Every row of a query asked once per run of ids, and whether each read reached its end. */
async function inRuns(ids, ask) {
  const reads = await Promise.all(runsOf(ids).map(run => readAll(() => ask(run))))
  return { rows: reads.flatMap(read => read.rows), complete: reads.every(read => read.complete) }
}

/** Whether a filed reply is a person writing back. */
export function byPerson(reply) {
  const body = String(reply.body_text ?? '')
  if (isAutomated({ intent: reply.intent, subject: reply.subject, body })) return false
  return !looksAutomatic(reply.subject, body)
}

/**
 * The funnel's rows, gathered.
 *
 * @param {object} db A Supabase client holding the service role.
 * @returns {Promise<{sites: object[], letters: object[], sessions: object[],
 *   replies: object[], complete: boolean}>}
 */
export async function readFunnel(db) {
  const sent = await readAll(() =>
    db
      .from('preview_sites')
      .select(SITE_COLUMNS, { count: 'exact' })
      .not('sent_at', 'is', null)
      .eq('channel', 'email')
      .order('sent_at')
  )
  const sites = sent.rows
  const prospects = [...new Set(sites.map(site => site.prospect_id).filter(Boolean))]
  const siteIds = sites.map(site => site.id).filter(Boolean)

  const [letters, sessions, replies] = await Promise.all([
    inRuns(prospects, run =>
      db
        .from('outreach_messages')
        .select(LETTER_COLUMNS, { count: 'exact' })
        .eq('direction', 'outbound')
        .eq('status', 'sent')
        .in('prospect_id', run)
        .order('id')
    ),
    inRuns(siteIds, run =>
      db
        .from('preview_sessions')
        .select(VISIT_COLUMNS, { count: 'exact' })
        .in('site_id', run)
        .order('id')
    ),
    inRuns(prospects, run =>
      db
        .from('outreach_messages')
        .select(REPLY_COLUMNS, { count: 'exact' })
        .eq('direction', 'inbound')
        .eq('status', 'received')
        .in('prospect_id', run)
        .order('id')
    ),
  ])

  const visitIds = sessions.rows.map(visit => visit.id).filter(Boolean)
  const claims = await inRuns(visitIds, run =>
    db
      .from('preview_events')
      .select('id, session_id', { count: 'exact' })
      .eq('type', 'click')
      .eq('kind', CLAIM_KIND)
      .in('session_id', run)
      .order('id')
  )
  const tapped = new Map()
  for (const event of claims.rows) {
    tapped.set(event.session_id, (tapped.get(event.session_id) ?? 0) + 1)
  }

  return {
    sites,
    letters: letters.rows.filter(letter => letter.sent_at),
    sessions: sessions.rows.map(visit => ({ ...visit, claims: tapped.get(visit.id) ?? 0 })),
    replies: replies.rows.filter(byPerson).map(reply => ({
      prospect_id: reply.prospect_id,
      sent_at: reply.sent_at,
      stop: reply.intent === 'opt_out' || readOptOut(String(reply.body_text ?? '')).optOut,
    })),
    complete: sent.complete && letters.complete && sessions.complete && replies.complete,
  }
}
