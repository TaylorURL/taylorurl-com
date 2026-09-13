/**
 * A lead off a paid ad form, posted here by whatever is watching the ad
 * platform.
 *
 * Meta hands an instant-form lead to a spreadsheet and to whatever script is
 * watching that spreadsheet, and until this existed the script's whole output
 * was an email. The best leads this business gets - a person who read an ad
 * about websites, opened a form and typed their own phone number into it -
 * lived in one inbox and in no record at all. Four of them sat unanswered
 * while the console showed nothing to answer.
 *
 * So the script posts here as well as sending its mail. The endpoint is the
 * narrowest thing that can accept one: a shared secret, one lead per call, and
 * an answer that says nothing about what is already stored.
 *
 * Idempotent by the person rather than by the call. The script may retry, and
 * a platform may deliver the same lead twice; both land on the same row,
 * because a lead is a person and the merge behind this is keyed on how to
 * reach them.
 */

import { timingSafeEqual } from 'node:crypto'
import { servedHereOr404 } from '../lib/http/guard.js'
import { readBody } from '../lib/http/body.js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'
import { connect } from '../lib/db/clients.js'
import { notice, sendNotice } from '../lib/mail/notice.js'
import { SOURCES, keepLead } from '../lib/leads/spine.js'

const AD_LEAD_SECRET = process.env.AD_LEAD_SECRET || ''
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const SITE_URL = process.env.SITE_URL || 'https://www.taylorurl.com'

// A form fires when somebody fills it in, so the honest rate is low and the
// room above it is for a script catching up after an outage rather than for
// ordinary traffic.
const postWindow = callerWindow({ limit: 60, windowMs: 10 * 60 * 1000 })

/** One sentence, whether the header was missing or simply wrong. */
const UNAUTHORIZED = 'That secret does not open this door.'

/**
 * Whether the caller presented the secret this deployment holds.
 *
 * Compared byte by byte in constant time. A plain `===` on a secret answers
 * faster the earlier it differs, which is enough to read one character at a
 * time out of a door that will take as many guesses as the rate limit allows.
 *
 * @param {object} request
 * @returns {boolean}
 */
function invited(request) {
  if (!AD_LEAD_SECRET) return false
  const header = request.headers.authorization || ''
  if (!header.startsWith('Bearer ')) return false

  const presented = Buffer.from(header.slice(7).trim())
  const held = Buffer.from(AD_LEAD_SECRET)
  // Lengths are compared first because timingSafeEqual throws on a mismatch,
  // and the length of a secret is not the part worth hiding.
  if (presented.length !== held.length) return false
  return timingSafeEqual(presented, held)
}

/**
 * What the ad platform called this lead's fields, read into what we call them.
 *
 * Meta's own field names travel with the form rather than with the platform,
 * so a form rebuilt next month answers `full_name` where this one answered
 * `name`. Each is read against the handful of spellings that actually turn up
 * rather than against one, so a renamed field costs a column instead of a lead.
 */
function fieldFrom(body, names) {
  for (const name of names) {
    const value = body?.[name]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

/**
 * Puts one new ad lead in front of a person.
 *
 * The same shape the configurator's own notice uses, so the inbox reads one
 * kind of message about a lead however the lead arrived. The reply address is
 * theirs, because the whole value of a message about a lead is being able to
 * answer it from the inbox in the minute it is read.
 */
async function announce({ name, email, phone, form, campaign }) {
  if (!RESEND_API_KEY) return
  try {
    await sendNotice(
      notice({
        label: 'Paid ad',
        subject: `${name || email || phone} asked for a quote`,
        rows: [
          ['Name', name || 'Not given'],
          ['Address', email || 'Not given'],
          ['Phone', phone || 'Not given'],
          ['Form', form || 'Not given'],
          ['Campaign', campaign || 'Not given'],
        ],
        replyTo: email || undefined,
        link: { label: 'Open the leads in the console', url: `${SITE_URL}/console/leads` },
      }),
      RESEND_API_KEY
    )
  } catch (cause) {
    // The row is written by the time this runs. A notice that did not leave
    // costs the knowing about it now rather than the lead.
    console.error('ad-lead: the notice did not send: %s', cause.message)
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'POST only' })
  }

  if (!postWindow.allows(callerAddress(request))) {
    return response.status(429).json({ error: 'Too many at once.' })
  }
  if (!invited(request)) return response.status(401).json({ error: UNAUTHORIZED })

  const wired = connect()
  if (!wired) return response.status(503).json({ error: 'The database is not configured here.' })

  const body = readBody(request)
  const name = fieldFrom(body, ['name', 'full_name', 'fullName'])
  const email = fieldFrom(body, ['email', 'email_address'])
  const phone = fieldFrom(body, ['phone', 'phone_number', 'phoneNumber'])
  const form = fieldFrom(body, ['form', 'form_name', 'formName'])
  const campaign = fieldFrom(body, ['campaign', 'campaign_name', 'campaignName'])
  const platform = fieldFrom(body, ['platform', 'source']) || 'facebook'

  // A lead with neither an address nor a number is a form somebody opened and
  // abandoned. It is answered as nothing to do rather than as a mistake,
  // because the script posting it did nothing wrong.
  if (!email && !phone) return response.status(200).json({ ok: true })

  const lead = await keepLead(
    {
      source: SOURCES.ad,
      ref: fieldFrom(body, ['id', 'lead_id', 'leadId']),
      email,
      name,
      phone,
      business: fieldFrom(body, ['business', 'company', 'business_name']),
      trade: fieldFrom(body, ['trade', 'industry', 'business_type']),
      note: fieldFrom(body, ['message', 'note', 'comments']),
      campaign: {
        utm_source: platform,
        utm_medium: 'paid',
        utm_campaign: campaign,
        utm_content: form,
      },
    },
    wired.db
  )

  // Only the first time. A platform that delivers the same lead twice must not
  // put it in front of a person twice, or the second copy teaches them to skim
  // the first.
  if (lead?.fresh) await announce({ name, email, phone, form, campaign })

  response.setHeader('Cache-Control', 'private, no-store')
  return response.status(200).json({ ok: true })
}
