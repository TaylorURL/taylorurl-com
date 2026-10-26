/**
 * Copies of the day's cold mail, delivered to the studio's own inbox.
 *
 * Every letter the studio sent today - the outreach chains and the new-business
 * letters both - is handed to the mail server again, addressed to
 * STUDIO_INBOX, from the address the business got it from, under the subject
 * and in the body the business got. It is how the studio reads the day's mail
 * the way the businesses read it, pictures and all.
 *
 * A copy must not pass for the business itself. So each one is the stored
 * letter with the three things in it that report back made inert: the open
 * square is taken out, and the letter's tracking token and its unsubscribe
 * token are both replaced with `copy`, which no row carries. Opening a copy,
 * clicking through one, or following its unsubscribe link then reaches a page
 * and changes nothing about the business it was written to. Every other link,
 * the preview site's included, is left exactly as it went.
 *
 * Nothing is written. A copy is not a message row, not a send against any
 * address's day, not a stamp on any business and not a row in outreach_runs,
 * whose jobs are the pipeline's own, so no queue, cap, chain or ledger ever
 * counts one. Only the schedule may run it.
 *
 * The new-business pipeline stores only the plain half of a letter, so its
 * HTML is written again from the lead, at the moment it was sent, with the
 * token already replaced. It goes as it was written only when the plain half
 * that comes out matches the stored one word for word; otherwise the copy is
 * the stored plain half alone, rather than a body the business never saw.
 */

import { bearerOr401, methodsOr405, servedHereOr404 } from '../../lib/http/guard.js'
import { isScheduler } from '../../lib/http/scheduler.js'
import { connect } from '../../lib/db/clients.js'
import { ownsSchedules } from '../../lib/site/current.js'
import { wait } from '../../lib/time/wait.js'
import { readAll } from '../../lib/db/rows.js'
import { STUDIO_INBOX } from '../../lib/outreach/message.js'
import { PREVIEW_FIRST_SENDER } from '../../lib/outreach/previews.js'
import { dayStartsAt } from '../../lib/outreach/sending/schedule.js'
import { envelopeOf, senderFor } from '../../lib/outreach/sending/senders.js'
import { composeFor } from '../../lib/new-business/email.js'
import { deliverProof, readRoster, sender } from './send.js'

export const config = { maxDuration: 300 }

/** What stands in a copy wherever the letter carried one of its tokens. */
export const INERT = 'copy'

/** A pause between two copies, so the mail server is not handed them at once. */
const SPACING_MS = 1000

/** The open square every tracked letter closes on. */
const OPEN_SQUARE = /<img\b[^>]*\/api\/outreach\/open\?[^>]*>\n?/g

const scrub = (body, tokens) => {
  if (!body) return body
  let out = body.replace(OPEN_SQUARE, '')
  for (const token of tokens) if (token) out = out.split(token).join(INERT)
  return out
}

/**
 * One stored letter as its copy: the same subject and the same two halves,
 * without the open square and with its tokens made inert.
 *
 * @param {{subject: string, body_text: string, body_html?: string|null}} letter
 * @param {Array<string|null>} tokens The letter's tracking and unsubscribe tokens.
 */
export function copyOf(letter, tokens) {
  return {
    subject: letter.subject,
    text: scrub(letter.body_text, tokens),
    html: scrub(letter.body_html, tokens) || undefined,
  }
}

/**
 * The new-business letter as its copy, its HTML written again from the lead.
 *
 * @param {object} row The stored message.
 * @param {object|null} lead The lead it was written to.
 */
export function newBusinessCopyOf(row, lead) {
  const stored = copyOf(row, [lead?.unsub_token])
  if (!lead) return stored
  const again = composeFor({ ...lead, unsub_token: INERT }, new Date(row.sent_at))
  if (again.body_text !== stored.text) return stored
  return { ...stored, html: again.body_html }
}

/** Every letter sent since `since`, oldest first, in the shape a copy is made from. */
async function sentSince(db, since) {
  const [outreach, newBusiness] = await Promise.all([
    readAll(() =>
      db
        .from('outreach_messages')
        .select(
          'id, subject, body_text, body_html, from_address, to_address, track_token, variant_id, sent_at, ' +
            'outreach_prospects(unsub_token)',
          { count: 'exact' }
        )
        .eq('direction', 'outbound')
        .eq('status', 'sent')
        .gte('sent_at', since)
        .order('sent_at')
    ),
    readAll(() =>
      db
        .from('new_business_messages')
        .select('id, subject, body_text, to_address, sent_at, ' + 'new_business_leads(*)', {
          count: 'exact',
        })
        .eq('status', 'sent')
        .gte('sent_at', since)
        .order('sent_at')
    ),
  ])
  const letters = [
    ...outreach.rows.map(row => ({ kind: 'outreach', row })),
    ...newBusiness.rows.map(row => ({ kind: 'new-business', row })),
  ]
  return letters.sort((a, b) => a.row.sent_at.localeCompare(b.row.sent_at))
}

/**
 * The envelope and the transport one copy goes under: the address the letter
 * left from, under the name it was signed with. A preview letter goes under
 * the preview name, as it did; a chain letter under its address's own.
 */
function senderOf(letter, roster, studio) {
  if (letter.kind === 'new-business') return { from: envelopeOf(studio) }
  const on = senderFor(roster.senders, letter.row.from_address)
  if (!on) return null
  const named = letter.row.variant_id ? on : { ...on, name: PREVIEW_FIRST_SENDER }
  return { from: envelopeOf(named), sender: on }
}

/** The single settings row, which names the studio's own address. */
async function readSettings(db) {
  const { data, error } = await db.from('outreach_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('outreach_settings holds no row 1')
  return data
}

export async function work({ db, settings, counts }, post = deliverProof) {
  const since = dayStartsAt()
  const letters = await sentSince(db, since)
  counts.examined = letters.length
  if (!letters.length) return { note: 'Nothing was sent today.' }

  const roster = await readRoster(db, settings)
  const studio = sender(settings)
  const missed = []
  for (const [index, letter] of letters.entries()) {
    const via = senderOf(letter, roster, studio)
    if (!via) {
      missed.push(`${letter.row.id}: ${letter.row.from_address} is not on the roster`)
      continue
    }
    const copy =
      letter.kind === 'new-business'
        ? newBusinessCopyOf(letter.row, letter.row.new_business_leads)
        : copyOf(letter.row, [letter.row.track_token, letter.row.outreach_prospects?.unsub_token])
    if (index) await wait(SPACING_MS)
    try {
      await post({ ...via, to: STUDIO_INBOX, ...copy })
      counts.changed += 1
    } catch (cause) {
      missed.push(`${letter.row.id}: ${cause?.message || cause}`)
    }
  }

  const note = `${counts.changed} of ${letters.length} copies went to ${STUDIO_INBOX}.`
  return missed.length ? { note, error: missed.join('\n') } : { note }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (!ownsSchedules()) return response.status(204).end()
  const authorization = bearerOr401(request, response)
  if (!authorization) return
  if (!methodsOr405(request, response, ['GET', 'POST'])) return
  if (!isScheduler(authorization)) {
    return response.status(403).json({ error: 'Only the schedule sends the copies.' })
  }
  const connected = connect()
  if (!connected) return response.status(503).json({ error: 'The copies have no database keys.' })

  response.setHeader('Cache-Control', 'private, no-store')
  const counts = { examined: 0, changed: 0 }
  try {
    const settings = await readSettings(connected.db)
    const detail = await work({ db: connected.db, settings, counts })
    if (detail.error) console.error('outreach copies: %s', detail.error)
    console.log('outreach copies: %s', detail.note)
    response.status(200).json({ ...counts, ...detail })
  } catch (cause) {
    const message = cause?.message || String(cause)
    console.error('outreach copies: %s', message)
    response.status(502).json({ ...counts, error: 'the copies did not complete' })
  }
}
