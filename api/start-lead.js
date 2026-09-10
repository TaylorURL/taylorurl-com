/**
 * Records the address a visitor leaves on the way to a build, and puts a new
 * one in front of a person.
 *
 * The step is a gate: a trade and a working address open the four screens
 * behind them. Everything the visitor picks after that was held in their own
 * browser and nowhere else, so the site's warmest visitor - somebody who chose
 * a trade, liked four designs, read the price and then closed the tab - was
 * the one it could say least about. This is the endpoint that changes that.
 *
 * The payment page reports here too. It asks three questions rather than five
 * screens' worth and is handed to somebody who has already agreed to the build,
 * but a person who types a name, an address and a number and then meets a card
 * they do not use is a lead by every reading that matters - and until this took
 * both, that person left no trace at all. What tells the two pages apart in the
 * row afterwards is the path each report carries.
 *
 * It is posted at as the address is answered, again as the visitor moves
 * through the steps, and again when what they picked changes, so it is written
 * to be cheap and to be called often: one row per address, the furthest step
 * kept, the latest brief kept, and no answer that tells a caller anything
 * about what is stored. The configurator does not wait on the reply
 * and never shows a visitor a failure from here. A lead lost to a refusing
 * database is a figure; a configurator that stalls on the first question is
 * the sale.
 *
 * The notice is sent the first time an address is seen and not afterwards. The
 * same person reaches this three or four times in one sitting as they move
 * through the steps, and an inbox holding four copies of one lead is an inbox
 * where the fourth is deleted without being read.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'
import { connect } from '../lib/db/clients.js'
import { notice, sendNotice } from '../lib/mail/notice.js'
import { recordLead, usableEmail } from '../lib/leads/record.js'
import { SOURCES, keepLead } from '../lib/leads/spine.js'
import { STEP_COUNT, fromPaymentPage } from '../lib/leads/paths.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const SITE_URL = process.env.SITE_URL || 'https://www.taylorurl.com'

// What one connection may record inside one window. A visitor moving through
// five steps and changing their mind on a few answers is a dozen or so calls;
// a script walking a list of addresses through the endpoint is not, and this
// is what tells them apart without costing the first one anything.
//
// The room above that is for the shared address. Two people in one office, or
// behind one carrier, arrive here as one caller, and a limit tight enough to
// be interesting is a limit that silently stops recording the second of them.
const recordWindow = callerWindow({ limit: 60, windowMs: 10 * 60 * 1000 })

/** The posted JSON, however the platform hands the body over. */
function readBody(request) {
  const body = request.body
  if (!body) return {}
  if (typeof body !== 'string') return body
  try {
    return JSON.parse(body)
  } catch {
    return {}
  }
}

/**
 * How far the visitor had reached, as the configurator counts its steps.
 *
 * Written as the step's own number rather than as its name, because the names
 * are the page's and would have to be kept level with it from here.
 *
 * The payment page has no steps to count. It reports at the screen it stands in
 * for, so the number would read as the last question of a configurator its
 * visitor never opened, and the inbox line is the one place that difference
 * decides what somebody does next: a lead off the configurator is a stranger to
 * follow up, and a lead off the payment page is a build already agreed to that
 * did not go through.
 */
const STEP_NAMES = ['Business type', 'The work', 'The look', 'What it costs', 'Start the build']

function reached(step, path) {
  if (fromPaymentPage(path)) return 'The payment page'
  const name = STEP_NAMES[step]
  return name ? `Step ${step + 1} of ${STEP_COUNT}, ${name}` : `Step ${step + 1}`
}

/** Where the visit came from, in the words the inbox reads. */
function arrival(campaign) {
  const source = campaign?.utm_source
  if (!source) return 'Not tagged'
  const parts = [source, campaign.utm_medium, campaign.utm_campaign].filter(Boolean)
  return parts.join(' / ')
}

/**
 * Puts one new lead in front of a person.
 *
 * The reply address is the visitor's own, so answering the notice writes to
 * them rather than to the sending domain. That is the whole point of the
 * message: a lead worth having is one somebody can reply to from the inbox in
 * the minute they read about it.
 */
async function announce({ email, trade, step, path, campaign }) {
  if (!RESEND_API_KEY) return

  const paying = fromPaymentPage(path)

  try {
    await sendNotice(
      notice({
        label: paying ? 'Payment page' : 'Configurator',
        subject: `${email} started a build${trade ? ` — ${trade}` : ''}`,
        rows: [
          ['Address', email],
          ['Trade', trade || 'Not chosen yet'],
          ['Reached', reached(step, path)],
          ['Came from', arrival(campaign)],
        ],
        replyTo: email,
        link: { label: 'Open the leads in the console', url: `${SITE_URL}/console/leads` },
      }),
      RESEND_API_KEY
    )
  } catch (cause) {
    // The row is already written. A notice that did not leave costs the
    // knowing about it now rather than the lead.
    console.error('start-lead: the notice did not send: %s', cause.message)
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'POST only' })
  }

  const body = readBody(request)
  const email = usableEmail(body.email)
  // A half-typed address is the ordinary state of a field somebody is still
  // filling in, so it is answered as nothing to do rather than as a mistake.
  if (!email) return response.status(200).json({ ok: true })

  if (!recordWindow.allows(callerAddress(request))) {
    return response.status(429).json({ error: 'Too many at once.' })
  }

  const wired = connect()
  if (!wired) return response.status(200).json({ ok: true })

  const trade = typeof body.trade === 'string' ? body.trade : null
  const posted = Number(body.step)
  const step = Number.isFinite(posted) ? posted : 0
  const campaign = body.campaign && typeof body.campaign === 'object' ? body.campaign : null

  const lead = await recordLead(
    { email, trade, step, path: body.path, campaign, brief: body.brief },
    wired.db
  )

  // The same person, written a second time where every door's leads are read
  // together. `start_leads` keeps what the configurator knows about them - the
  // step, the brief, the follow-up it owes - and this keeps the person, so the
  // console can show them beside a lead who phoned or answered an ad.
  await keepLead(
    {
      source: fromPaymentPage(body.path) ? SOURCES.payment : SOURCES.configurator,
      ref: lead?.id,
      email,
      trade,
      campaign,
      brief: body.brief,
      path: body.path,
      step,
    },
    wired.db
  )

  if (lead?.fresh) await announce({ email, trade, step, path: body.path, campaign })

  response.setHeader('Cache-Control', 'private, no-store')
  return response.status(200).json({ ok: true })
}
