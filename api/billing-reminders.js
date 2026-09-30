/**
 * Every Monday morning, a letter to each client who owes an invoice a week or
 * more past the day it was owed.
 *
 * The week is the same one that takes a client's site offline, read from the
 * same rule in lib/billing/overdue.js, so a client is told on the Monday after
 * their site went dark and every Monday after that until they pay. A client
 * whose site is exempt, or who has no site yet, is on the same schedule; the
 * letter simply says nothing about a site.
 *
 * Vercel's schedule is written in UTC and a Texas morning is not one fixed UTC
 * hour across the year, so the cron fires at both hours nine o'clock Central
 * can fall on and the run acts from nine onward. The earlier firing is eight
 * o'clock half the year and does nothing. The later one is ten o'clock the
 * other half, and finds every client already written to that day.
 *
 * What stops a second letter is `billing_reminders`. A client is claimed for
 * the day by inserting their row before the letter is written, and the unique
 * pair of customer and date refuses the second claim, so two overlapping runs
 * or a retried one never write to anybody twice on one Monday. A send that
 * fails gives its claim back, so the later firing tries that client again.
 */

import { holdsSite } from '../lib/billing/overdue.js'
import { connect } from '../lib/db/clients.js'
import { servedHereOr404 } from '../lib/http/guard.js'
import { isScheduler } from '../lib/http/scheduler.js'
import { sendNotice } from '../lib/mail/notice.js'
import { REMINDER_FROM, REMINDER_REPLY_TO, overdueReminder } from '../lib/mail/overdue.js'
import { ownsSchedules } from '../lib/site/current.js'
import { stripeList } from '../lib/stripe/read.js'
import { isClient, loadRoster } from '../lib/stripe/roster.js'
import { clockIn, dayIn } from '../lib/time/zone.js'

/** The read-only key where the deployment holds it, for the reason api/payments-admin.js gives. */
const SECRET_KEY = process.env.STRIPE_READONLY_KEY || process.env.STRIPE_SECRET_KEY || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

export const config = { maxDuration: 60 }

/** The hour, Central, from which a Monday's letters go. */
export const SEND_HOUR = 9

/** Postgres's answer to a second insert of a key that is already there. */
const ALREADY_CLAIMED = '23505'

/**
 * Whether the letters are due at this moment: a Monday, nine o'clock Central or later.
 *
 * @param {Date} now
 * @returns {boolean}
 */
export function isSendingTime(now) {
  const clock = clockIn(now)
  return clock?.weekday === 'Mon' && clock.hour >= SEND_HOUR
}

/** The customer an invoice belongs to, whether Stripe expanded it or not. */
function customerOf(invoice) {
  return typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null
}

/**
 * Writes this Monday's letters.
 *
 * Split out from the handler so the check can run it against a stub database,
 * a stub Stripe and a stub mailbox.
 *
 * @param {{db: object, list: Function, send: Function, now: Date}} deps
 * @returns {Promise<{sent: string[], already: string[], failed: string[], complete: boolean}>}
 *   The invoice numbers each outcome covered, and whether Stripe's list was read to the end.
 */
export async function remind({ db, list, send, now }) {
  const outcome = { sent: [], already: [], failed: [], complete: true }

  const open = await list('invoices', { status: 'open' })
  outcome.complete = open.complete
  const late = open.rows.filter(invoice => holdsSite(invoice, now))
  if (!late.length) return outcome

  // The studio's own card and the people who were never clients are told
  // nothing, whatever they owe.
  const roster = await loadRoster(db)
  if (!roster) throw new Error('the roster could not be read')

  const owedBy = new Map()
  for (const invoice of late) {
    const id = customerOf(invoice)
    if (!id) continue
    if (!owedBy.has(id)) owedBy.set(id, [])
    owedBy.get(id).push(invoice)
  }

  const customers = new Map((await list('customers', {})).rows.map(row => [row.id, row]))

  const { data: siteRows, error: sitesError } = await db
    .from('client_sites')
    .select('domain, stripe_customer, exempt')
    .limit(1000)
  if (sitesError) throw new Error(sitesError.message)

  const day = dayIn(now)
  for (const [id, invoices] of owedBy) {
    const customer = customers.get(id) || { id }
    if (!isClient(customer, roster)) continue
    const email = customer.email || invoices[0].customer_email
    if (!email) continue
    const numbers = invoices.map(invoice => invoice.number || invoice.id)

    const { error: claimError } = await db.from('billing_reminders').insert({
      stripe_customer: id,
      sent_on: day,
      invoices: numbers,
      email,
    })
    if (claimError) {
      if (claimError.code !== ALREADY_CLAIMED) throw new Error(claimError.message)
      outcome.already.push(...numbers)
      continue
    }

    // Only a site that is actually offline over this is named in the letter.
    const sites = (siteRows || [])
      .filter(row => row.stripe_customer === id && !row.exempt)
      .map(row => row.domain)
      .sort()

    try {
      const letter = overdueReminder({ customer, invoices, sites })
      const providerId = await send(letter, email)
      await db
        .from('billing_reminders')
        .update({ provider_id: providerId })
        .eq('stripe_customer', id)
        .eq('sent_on', day)
      outcome.sent.push(...numbers)
    } catch (cause) {
      console.error(
        'billing-reminders: the letter for %s did not go: %s',
        numbers.join(', '),
        cause.message
      )
      await db.from('billing_reminders').delete().eq('stripe_customer', id).eq('sent_on', day)
      outcome.failed.push(...numbers)
    }
  }

  return outcome
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  // Both projects register every cron, because vercel.json is read before any
  // build runs. This is what decides which deployment acts on it.
  if (!ownsSchedules()) return response.status(204).end()

  if (!isScheduler(request.headers.authorization)) {
    response.status(401).json({ error: 'not authorized' })
    return
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    response.status(405).json({ error: 'GET or POST only' })
    return
  }
  response.setHeader('Cache-Control', 'private, no-store')

  const now = new Date()
  if (!isSendingTime(now)) {
    response.status(200).json({ due: false })
    return
  }

  const clients = connect()
  if (!clients || !SECRET_KEY || !RESEND_API_KEY) {
    response.status(503).json({ error: 'billing reminders not configured' })
    return
  }

  try {
    const outcome = await remind({
      db: clients.db,
      list: (path, query) => stripeList(path, SECRET_KEY, query),
      send: ({ subject, text, html }, email) =>
        sendNotice({ subject, text, html, replyTo: REMINDER_REPLY_TO }, RESEND_API_KEY, {
          from: REMINDER_FROM,
          to: [email],
          urgent: false,
        }),
      now,
    })
    response.status(200).json({
      due: true,
      ...outcome,
      // A Monday that wrote to nobody and a Monday that could not are the same
      // quiet 200 otherwise, and the second one is a week before anybody looks.
      needsAttention: outcome.failed.length > 0 || !outcome.complete,
    })
  } catch (cause) {
    console.error('billing-reminders: %s', cause.message)
    response.status(502).json({ error: 'the reminders could not be sent' })
  }
}
