/**
 * Writes to the new businesses that have an address, inside the same hours
 * outreach writes in and under a daily cap of this pipeline's own.
 *
 * It sends from the same mailbox as outreach, through outreach's own
 * `deliver`, so the address, the signature and the transport are the ones a
 * reader already gets from the studio. Before a company is written to:
 *
 *   - `sending_enabled` on new_business_settings, and OUTREACH_SEND_ARMED on
 *     the deployment, both have to be on. The second is the switch that stops
 *     every cold send from this mailbox, and this pipeline answers to it too.
 *   - The address must not be on the suppression list, must not have been
 *     written to by outreach, and must not have been written to here under
 *     another company.
 *   - The address is checked the way outreach checks one. An address the
 *     check refuses marks the company 'undeliverable'.
 *
 * Newest companies go first, since the email is about their having just
 * started. A company written to is mirrored onto outreach_prospects at
 * 'contacted', which is what lets the inbox watcher see its replies and
 * bounces; see lib/new-business/mirror.js.
 */

import { sender, deliver } from '../outreach/send.js'
import { servedHereOr404 } from '../../lib/http/guard.js'
import { checkAddress } from '../../lib/outreach/prospects/address.js'
import { dayStartsAt } from '../../lib/outreach/sending/schedule.js'
import { sendWindow, suppressed, writtenTo } from '../../lib/outreach/sending/queue.js'
import { composeFor } from '../../lib/new-business/email.js'
import { contactedRow, mirror } from '../../lib/new-business/mirror.js'
import { runNewBusinessJob } from '../../lib/new-business/runtime.js'

export const config = { maxDuration: 120 }

/** The most one run sends, so a day's cap is spread over the day's runs. */
export const SEND_PER_RUN = 3

/** Seconds between two sends in one run. */
const SPACING_MS = 20_000

const ARMED = process.env.OUTREACH_SEND_ARMED === 'true'

async function sentToday(db, now) {
  const { count, error } = await db
    .from('new_business_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', dayStartsAt(now))
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function writtenHere(db, emails) {
  if (!emails.length) return new Set()
  const { data, error } = await db
    .from('new_business_messages')
    .select('to_address')
    .eq('status', 'sent')
    .in('to_address', emails)
  if (error) throw new Error(error.message)
  return new Set(data.map(row => String(row.to_address).toLowerCase()))
}

async function outreachSettings(db) {
  const { data, error } = await db
    .from('outreach_settings')
    .select('from_address, from_name')
    .eq('id', 1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? {}
}

async function setStage(db, id, stage, extra = {}) {
  const at = new Date().toISOString()
  const { error } = await db
    .from('new_business_leads')
    .update({ stage, updated_at: at, ...extra })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function work({
  db,
  settings,
  counts,
  now = new Date(),
  transport,
  wait = ms => new Promise(done => setTimeout(done, ms)),
}) {
  if (!settings.sending_enabled) return { skipped: 'sending is switched off' }
  if (!ARMED) return { skipped: 'OUTREACH_SEND_ARMED is not on for this deployment' }
  const window = sendWindow(now)
  if (!window.open) return { skipped: window.reason }

  const already = await sentToday(db, now)
  const room = Math.min(SEND_PER_RUN, Math.max(0, Number(settings.daily_cap) - already))
  if (!room) return { skipped: `the day's cap of ${settings.daily_cap} is reached` }

  const { data: ready, error } = await db
    .from('new_business_leads')
    .select('*')
    .eq('stage', 'emailable')
    .not('email', 'is', null)
    .order('formed_on', { ascending: false })
    .limit(room * 5)
  if (error) throw new Error(error.message)
  if (!ready.length) return { sent: 0, note: 'Nobody is waiting to be written to.' }

  const emails = ready.map(lead => String(lead.email).toLowerCase())
  const [held, byOutreach, byUs] = await Promise.all([
    suppressed(db, emails),
    writtenTo(db, emails),
    writtenHere(db, emails),
  ])

  const from = sender(await outreachSettings(db))
  const tally = { sent: 0, held: 0, undeliverable: 0, failed: 0 }
  for (const lead of ready) {
    if (tally.sent >= room) break
    counts.examined += 1
    const address = String(lead.email).toLowerCase()

    if (held.has(address)) {
      await setStage(db, lead.id, 'unsubscribed')
      tally.held += 1
      continue
    }
    if (byOutreach.has(address) || byUs.has(address)) {
      // Somebody at this address has already heard from the studio, so this
      // company is left where a person can see it rather than written to twice.
      await setStage(db, lead.id, 'contacted')
      tally.held += 1
      continue
    }

    const verdict = await checkAddress(db, address)
    if (verdict.verdict === 'undeliverable') {
      await setStage(db, lead.id, 'undeliverable')
      tally.undeliverable += 1
      counts.changed += 1
      continue
    }

    const message = composeFor(lead, now)
    if (tally.sent) await wait(SPACING_MS)

    let providerId = null
    let refused = null
    try {
      providerId = await deliver(db, message, from, message.unsubscribe, transport)
    } catch (cause) {
      refused = cause
    }

    const at = new Date().toISOString()
    const logged = await db.from('new_business_messages').insert({
      lead_id: lead.id,
      to_address: message.to_address,
      subject: message.subject,
      body_text: message.body_text,
      status: refused ? 'failed' : 'sent',
      provider_id: providerId,
      error: refused ? String(refused.message ?? refused).slice(0, 2000) : null,
      sent_at: refused ? null : at,
    })
    if (logged.error) throw new Error(logged.error.message)

    if (refused) {
      console.error('new business send: %s failed: %s', message.to_address, refused.message)
      if (refused.verdict === 'undeliverable') await setStage(db, lead.id, 'undeliverable')
      tally.failed += 1
      counts.changed += 1
      continue
    }

    byUs.add(address)
    const prospectId = await mirror(db, contactedRow(lead, at))
    await setStage(db, lead.id, 'contacted', { contacted_at: at, prospect_id: prospectId })
    tally.sent += 1
    counts.changed += 1
  }

  return {
    ...tally,
    sentToday: already + tally.sent,
    cap: settings.daily_cap,
    note: `Sent ${tally.sent} (${already + tally.sent} of ${settings.daily_cap} today), held ${tally.held}, undeliverable ${tally.undeliverable}, failed ${tally.failed}.`,
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runNewBusinessJob({ request, response, job: 'send', work })
}
