/**
 * The one message a lead who did not finish ever gets, sent a day after they
 * left.
 *
 * The configurator records an address on its first step, so the studio knows
 * about everyone who saw the second screen. Most of them do not finish. This
 * is what asks the ones who did not what stopped them, and puts half the
 * up-front fee on the table in case the answer was the price.
 *
 * Five rules hold it to being marketing rather than a complaint:
 *
 *   One message. `followed_up_at` is stamped before the next run reads the
 *   row, so nobody is chased twice however often this runs.
 *
 *   A window, not a backlog. Only leads first seen between a day and four days
 *   ago are eligible, and one older than that is passed over for good. Without
 *   that, the day the switch is first turned on is the day every lead the site
 *   ever recorded gets a message at once, which is a spam report rather than a
 *   campaign.
 *
 *   The suppression list first. The same list the newsletter and the outreach
 *   pipeline answer to, so somebody who has said no once is never asked again
 *   by a different part of the same domain.
 *
 *   An unsubscribe in every message, one click, no sign-in. The address it
 *   goes on is the same suppression list, so unsubscribing here stops
 *   everything rather than this alone.
 *
 *   Nothing is sent where nothing can arrive. An address at a domain reserved
 *   for documentation is never selected, because a message to one is a hard
 *   bounce on the sending domain and a live Stripe code spent on nobody, and a
 *   sender that bounces is a sender whose real mail stops arriving.
 *
 * It sends nothing until it is turned on. `START_FOLLOWUP_LIVE` is the switch,
 * and with it unset the run still reads, still reports what it would have
 * done, and stamps nothing - so the wiring can be watched working for as long
 * as anyone wants before a stranger is written to.
 */

import { ownsSchedules } from '../lib/site/current.js'
import { servedHereOr404 } from '../lib/http/guard.js'
import { isScheduler } from '../lib/http/scheduler.js'
import { connect } from '../lib/db/clients.js'
import { tableMissing } from '../lib/db/rows.js'
import { sendNotice } from '../lib/mail/notice.js'
import { formatInstant } from '../lib/time/zone.js'
import { LEADS, deliverable, suppressed } from '../lib/leads/record.js'
import { followUpMessage } from '../lib/leads/message.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const SITE_URL = process.env.SITE_URL || 'https://www.taylorurl.com'

/**
 * The coupon the codes are cut from: half off the up-front build line, once.
 *
 * A coupon rather than a percentage written here, because the discount has to
 * apply to the build line and not to the monthly, and only Stripe can say
 * which line an amount belongs to. With no coupon configured nothing is sent
 * at all: a message promising half off that carries no working code is worse
 * than no message.
 */
const COUPON = process.env.STRIPE_COUPON_HALF_BUILD || ''

/** The switch. Anything but this and the run reads without sending. */
const LIVE = process.env.START_FOLLOWUP_LIVE === '1'

const HOUR_MS = 60 * 60 * 1000

// How long a lead is left alone before it is worth asking, and how long after
// that it stops being worth asking. A day is enough that somebody who is still
// thinking about it has not been interrupted; four days is where a message
// about something they did last week starts reading as surveillance.
const WAIT_HOURS = 24
const STALE_HOURS = 96

// What one run sends. The window means a normal day holds a handful, so this is
// a ceiling against a surprise rather than a rate: a hundred messages leaving a
// warmed domain in one minute is the kind of burst that gets a domain looked at.
const PER_RUN = 25

// How long a code lives. Long enough to be acted on over a weekend, short
// enough that it is a reason to move rather than a coupon left in an inbox.
const CODE_DAYS = 7

const STRIPE_PROMOTION_CODES = 'https://api.stripe.com/v1/promotion_codes'
const TIMEOUT_MS = 10000

/** The date a code stops working, written the way the message says it. */
function writtenDate(instant) {
  return formatInstant(instant, { month: 'long', day: 'numeric' }, 'shortly')
}

/**
 * A code somebody can read off a screen and type without a mistake.
 *
 * No vowels and no characters that are two characters in a different typeface,
 * so nothing here can be read as something else over a phone.
 */
function codeFor() {
  const alphabet = '23456789BCDFGHJKMNPQRTVWXY'
  let tail = ''
  for (let at = 0; at < 6; at += 1) {
    tail += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `BUILD50-${tail}`
}

/**
 * Cuts one single-use code off the coupon.
 *
 * Restricted to one redemption and given an expiry, so a code that reaches a
 * forum is a code that has already been used or has already died. The lead's
 * address rides along as metadata, which is what makes a redemption traceable
 * back to the message that caused it.
 *
 * @returns {Promise<{code: string, expires: Date}|null>}
 */
async function cutCode(email) {
  const expires = new Date(Date.now() + CODE_DAYS * 24 * HOUR_MS)
  const body = new URLSearchParams({
    coupon: COUPON,
    code: codeFor(),
    max_redemptions: '1',
    expires_at: String(Math.floor(expires.getTime() / 1000)),
    'metadata[lead_email]': email,
    'metadata[source]': 'start-followup',
  })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const created = await fetch(STRIPE_PROMOTION_CODES, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const answer = await created.json()
    if (!created.ok || !answer.code) {
      console.error(
        'start-followup: Stripe refused the code',
        answer?.error?.message || created.status
      )
      return null
    }
    return { code: answer.code, expires }
  } catch (error) {
    console.error(
      `start-followup: ${error?.name === 'AbortError' ? 'Stripe timed out' : 'Stripe unreachable'}`
    )
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The leads old enough to ask and not so old that asking is strange, minus the
 * ones no message could ever reach.
 *
 * An address at a reserved domain is refused here rather than at send time,
 * and the ordering is the whole point. `chase` goes to Stripe before it goes
 * to the mailbox, so a guard standing there would refuse only after a live
 * single-use code had already been cut, and a lead that comes back without a
 * stamp is read as unfinished and offered again on the next run - four days of
 * codes and bounces for one address that was never a person. Filtered out of
 * the selection, it is never chosen at all, and it ages out of the window on
 * its own.
 *
 * The filter is applied here rather than as a pattern in the query. A `like`
 * written wrong matches nothing and fails open, which for this guard means
 * every undeliverable address sails through and nothing says so; the same rule
 * in JavaScript is one a test can hold.
 *
 * More rows are asked for than a run will send, so a test address cannot take
 * the place of somebody real. Without that, the ceiling is spent on rows that
 * are then dropped and a lead waits another day for no reason.
 *
 * @returns {Promise<{leads: object[], skipped: number}>} Who to write to, and
 *   how many were passed over as undeliverable - reported by the run so the
 *   guard can be watched working rather than assumed.
 */
async function due(db) {
  const now = Date.now()
  const { data, error } = await db
    .from(LEADS)
    .select('id, email, trade, step, unsub_token, created_at')
    .lt('created_at', new Date(now - WAIT_HOURS * HOUR_MS).toISOString())
    .gt('created_at', new Date(now - STALE_HOURS * HOUR_MS).toISOString())
    .is('bought_at', null)
    .is('followed_up_at', null)
    .is('unsubscribed_at', null)
    .order('created_at', { ascending: true })
    .limit(PER_RUN * 2)

  if (error) {
    if (tableMissing(error)) return { leads: [], skipped: 0 }
    throw error
  }

  const found = data || []
  const reachable = found.filter(lead => deliverable(lead.email))
  return { leads: reachable.slice(0, PER_RUN), skipped: found.length - reachable.length }
}

/**
 * Writes to one lead, having first claimed them.
 *
 * The stamp goes on before the message leaves rather than after it. Two runs
 * overlapping is the failure worth designing against, and the cost of the two
 * orderings is not symmetric: a stamp that lands without a message costs one
 * lead a message they never knew about, while a message that leaves without a
 * stamp is the same person written to twice.
 *
 * @returns {Promise<'sent'|'suppressed'|'nocode'|'failed'|'taken'>}
 */
async function chase(db, lead) {
  if (await suppressed(db, lead.email)) return 'suppressed'

  const cut = await cutCode(lead.email)
  if (!cut) return 'nocode'

  const claim = await db
    .from(LEADS)
    .update({
      followed_up_at: new Date().toISOString(),
      promo_code: cut.code,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead.id)
    .is('followed_up_at', null)
    .select('id')

  if (claim.error) {
    console.error('start-followup: the lead was not claimed: %s', claim.error.message)
    return 'failed'
  }
  // Another run got there first. Nothing is sent, and nothing is undone.
  if (!claim.data?.length) return 'taken'

  const unsubscribe = `${SITE_URL}/api/lead-unsubscribe?token=${lead.unsub_token}`
  const message = followUpMessage({
    trade: lead.trade || '',
    step: lead.step || 0,
    code: cut.code,
    expires: writtenDate(cut.expires),
    startUrl: `${SITE_URL}/start?utm_source=followup&utm_medium=email&utm_campaign=start-followup`,
    unsubscribeUrl: unsubscribe,
  })

  try {
    await sendNotice(message, RESEND_API_KEY, {
      to: [lead.email],
      // Nothing here is urgent to the person receiving it. The headers that
      // mark a message high are for somebody waiting on an answer, and a
      // marketing message wearing them is the reason those headers stop
      // meaning anything.
      urgent: false,
      // RFC 8058's one-click contract, the same pair the newsletter and the
      // outreach pipeline send. The link in the body is what a person clicks;
      // these are what the mailbox provider reads, and a bulk sender without
      // them is one Gmail and Yahoo are entitled to put straight in spam.
      // api/lead-unsubscribe.js already answers the POST this promises.
      headers: {
        'List-Unsubscribe': `<${unsubscribe}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    return 'sent'
  } catch (cause) {
    console.error('start-followup: the message did not send: %s', cause.message)
    return 'failed'
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (!ownsSchedules()) return response.status(404).json({ error: 'not found' })
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    return response.status(405).json({ error: 'GET or POST only' })
  }
  if (!isScheduler(request.headers.authorization)) {
    return response.status(401).json({ error: 'not authorized' })
  }

  const wired = connect()
  if (!wired) return response.status(503).json({ error: 'The database is not configured here.' })

  const missing = [
    !RESEND_API_KEY && 'RESEND_API_KEY',
    !SECRET_KEY && 'STRIPE_SECRET_KEY',
    !COUPON && 'STRIPE_COUPON_HALF_BUILD',
  ].filter(Boolean)

  let leads = []
  let skipped = 0
  try {
    ;({ leads, skipped } = await due(wired.db))
  } catch (cause) {
    console.error('start-followup: the leads could not be read: %s', cause.message)
    return response.status(500).json({ error: 'The leads could not be read.' })
  }

  // Reading is the whole of a run that is not live, and it is worth doing: the
  // count says the window and the rules are picking out the people they should
  // be, which is the thing worth watching before anything leaves.
  if (!LIVE || missing.length) {
    return response.status(200).json({
      ok: true,
      live: false,
      due: leads.length,
      undeliverable: skipped,
      waiting: missing.length
        ? `not configured: ${missing.join(', ')}`
        : 'START_FOLLOWUP_LIVE is not set',
    })
  }

  const tally = { sent: 0, suppressed: 0, nocode: 0, failed: 0, taken: 0 }
  for (const lead of leads) {
    tally[await chase(wired.db, lead)] += 1
  }

  return response
    .status(200)
    .json({ ok: true, live: true, due: leads.length, undeliverable: skipped, ...tally })
}
