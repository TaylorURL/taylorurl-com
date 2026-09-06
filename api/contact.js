/**
 * Delivery endpoint for the site's enquiry forms.
 *
 * A `mailto:` link needs a configured desktop mail client and is a dead end on
 * a phone, so the contact form and the /start page post their fields here and
 * the message is handed to Resend server-side. Delivery lands in the inbox
 * named by `CONTACT_INBOX`; the sender's own address rides on Reply-To, which
 * is what makes a reply go back to them rather than to the sending domain.
 *
 * The browser's checks are a convenience the sender can skip, so every field
 * is measured again here before anything is sent.
 *
 * A delivered enquiry also files where it came from. The campaign is recorded
 * here rather than beaconed from the page because an enquiry that reached this
 * endpoint is one the browser could reach: a reader running a content blocker
 * still writes in, and their enquiry would otherwise be the one that counts as
 * having come from nowhere. What is filed is the campaign and nothing about
 * the sender - `public.enquiry_attribution` answers which message produced an
 * enquiry, and cannot answer who sent it.
 *
 * An untagged arrival still came from somewhere, and the referrer is the only
 * thing that says where. It rides as far as the notice and no further: the
 * table answers which message produced an enquiry, and a page a visit came in
 * from is a fact about the person rather than about the campaign.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { createClient } from '@supabase/supabase-js'
import { UUID_PATTERN } from '../lib/db/fields.js'
import { questionsFor } from '../lib/enquiry/questions.js'
import { markLead } from '../lib/leads/record.js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'
import {
  INK,
  INK_FAINT,
  INK_SOFT,
  SANS,
  escapeHtml,
  eyebrowMark,
  page,
  rule,
} from '../lib/mail/frame.js'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gujgtjqqurildqurpffh.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Resend accepts a From address only on a domain verified against the account,
// so the sender is fixed here rather than taken from the submission.
const FROM = 'TaylorURL Website <website@taylorurl.com>'
const INBOX = process.env.CONTACT_INBOX || 'trenton@taylorurl.com'

const TIMEOUT_MS = 10000

// What one address may send inside one window: enough to stop a form loop or a
// script hammering the endpoint, and cheap enough to cost a legitimate sender
// nothing.
const sendWindow = callerWindow({ limit: 5, windowMs: 15 * 60 * 1000 })

// Room for a real message and nothing beyond it. A field arriving longer than
// its limit is cut rather than refused, since the length of a paste is not
// something the sender chose.
const LIMITS = {
  name: 120,
  email: 200,
  company: 160,
  projectType: 60,
  contactMethod: 20,
  phone: 40,
  message: 5000,
  form: 20,
  path: 200,
  tag: 200,
  referrer: 300,
}

// Which form was sent, and what an unrecognised value falls back to. A figure
// that separates the enquiry off a cold message from the one off the tools
// needs the set closed, so it is read against a fixed one rather than trusted.
const FORMS = new Set(['contact', 'start', 'tools'])
const DEFAULT_FORM = 'contact'

// The campaign tags a tagged arrival carries, in the spelling the column uses.
const CAMPAIGN_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']

// The shape of a message token, which is what `utm_content` holds on an
// outreach link. Anything else under that source is dropped rather than
// stored: the column is joined against outreach_messages and read in a log,
// and neither is a place to put whatever a stranger cared to put in the URL.
const TAGGED_SOURCE = 'outreach'

// What the sender may ask for, and what an unrecognised value falls back to.
// The reply channel decides how the enquiry is answered, so it is read against
// a fixed set here rather than trusted from the body.
const CONTACT_METHODS = new Set(['either', 'email', 'phone'])
const DEFAULT_CONTACT_METHOD = 'either'

export const METHOD_LABELS = {
  either: 'Either is fine',
  email: 'Email',
  phone: 'Phone call',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
 * A single-line field. Line breaks come out because these values reach the
 * subject and the Reply-To header, where a break is a way to write a header of
 * one's own.
 */
function line(value, limit) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, limit)
}

/** The message body, which keeps its paragraphs and loses its stray returns. */
function block(value, limit) {
  if (typeof value !== 'string') return ''
  return value.replace(/\r\n?/g, '\n').trim().slice(0, limit)
}

/**
 * The campaign the enquiry arrived on, as the page held it.
 *
 * `utm_source` is what decides whether there is one at all. A body carrying a
 * medium and no source says a reader came in but not from what, and filing
 * that as an attribution would put an answer against a campaign nobody ran.
 *
 * @param {object} campaign The block the page posted.
 * @returns {object|null}
 */
export function campaignFrom(campaign) {
  if (!campaign || typeof campaign !== 'object') return null
  const source = line(campaign.utm_source, LIMITS.tag)
  if (!source) return null

  const found = {}
  for (const field of CAMPAIGN_FIELDS) found[field] = line(campaign[field], LIMITS.tag)
  found.utm_source = source
  if (source === TAGGED_SOURCE && !UUID_PATTERN.test(found.utm_content)) found.utm_content = ''
  return found
}

/**
 * The page the visit came in from, where the browser named one off this site.
 *
 * It is a value a stranger can put anything in and it is read by a person, so
 * it is taken only in the one shape a referrer has and reported as text rather
 * than as a link: a notice about a stranger is not a notice that hands the
 * reader their address to click.
 *
 * @param {*} value What the page posted.
 * @returns {string} The address, or empty where there is nothing to report.
 */
export function referrerFrom(value) {
  const held = line(value, LIMITS.referrer)
  return /^https?:\/\/\S+$/.test(held) ? held : ''
}

/**
 * Where the enquiry came from, in the words the inbox reads.
 *
 * A tagged arrival names its campaign. An untagged one names the page the
 * visit came in from, which is the whole of what a browser can say about it:
 * a search partner, a directory, somebody else's link. Reading the tags alone
 * filed every one of those as Direct, so a real source counted as no source
 * and the enquiries off it counted for nothing.
 *
 * @param {object} enquiry The delivered enquiry.
 * @returns {string}
 */
export function describeArrival({ campaign, referrer } = {}) {
  if (campaign) {
    const route = [campaign.utm_source, campaign.utm_medium, campaign.utm_campaign]
      .filter(Boolean)
      .join(' / ')
    return campaign.utm_content ? `${route} - tag ${campaign.utm_content}` : route
  }
  return referrer || 'Direct'
}

/** The first rule the submission breaks, in the words the sender reads. */
function faultIn(enquiry) {
  if (enquiry.name.length < 2) return 'Enter your name.'
  if (!EMAIL_PATTERN.test(enquiry.email)) return 'That email address does not look right.'
  if (enquiry.message.length < 10) return 'Tell me what you need, in a sentence or two.'
  if (enquiry.contactMethod === 'phone' && enquiry.phone.length < 7) {
    return 'Add a phone number if you want a call back.'
  }
  return null
}

/** What one field of a form is worth reading back as. */
function answerTo(enquiry, field) {
  if (field === 'contactMethod') return METHOD_LABELS[enquiry.contactMethod]
  return enquiry[field] || 'Not given'
}

/**
 * The short answers, each under the question that produced it, in the order
 * the form asked them.
 *
 * The labels are the form's own questions rather than a second set kept here,
 * so a field reworded on the page is reworded in the inbox by the same edit.
 * A question the form never asked has no row: a business name on a tool's
 * form is not something the sender withheld, it is something nobody put to
 * them, and 'Not given' against it would read as though they had.
 *
 * Where the enquiry came from is not a question anybody answered, so it goes
 * last, after everything that was.
 *
 * @param {object} enquiry The delivered enquiry.
 * @returns {Array<[string, string]>} Label and value, in reading order.
 */
function readings(enquiry) {
  const rows = []
  for (const [field, question] of Object.entries(questionsFor(enquiry.form))) {
    if (field === 'message') continue
    rows.push([question, answerTo(enquiry, field)])
  }
  rows.push(['Came from', describeArrival(enquiry)])
  return rows
}

/**
 * A label with the punctuation the plain half needs to read as a sentence. The
 * laid-out half sets the label in its own column and needs none of it, but a
 * question already ending in a question mark takes no colon after it.
 */
function said(label) {
  return label.endsWith('?') ? label : `${label}:`
}

export function textBody(enquiry) {
  const asked = questionsFor(enquiry.form)
  return [
    ...readings(enquiry).map(([label, value]) => `${said(label)} ${value}`),
    '',
    said(asked.message),
    enquiry.message,
  ].join('\n')
}

export function htmlBody(enquiry) {
  const asked = questionsFor(enquiry.form)
  const rows = readings(enquiry)
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:6px 20px 6px 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${INK_FAINT};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;font-family:${SANS};font-size:15px;line-height:1.5;color:${INK};vertical-align:top;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('')

  // The written answer carries its question the same way the rows above do,
  // set in the label's own size and colour, so the block below it is read as
  // an answer to something rather than as a message from nowhere.
  const content = `
    <tr><td style="padding:28px 32px 0 32px;">${eyebrowMark('New Enquiry')}</td></tr>
    <tr><td style="padding:16px 32px 0 32px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
    </td></tr>
    <tr><td style="padding:20px 32px 0 32px;">${rule()}</td></tr>
    <tr><td style="padding:20px 32px 0 32px;font-family:${SANS};font-size:13px;line-height:1.5;color:${INK_FAINT};">${escapeHtml(asked.message)}</td></tr>
    <tr><td style="padding:6px 32px 32px 32px;font-family:${SANS};font-size:15px;line-height:1.7;color:${INK_SOFT};white-space:pre-wrap;">${escapeHtml(enquiry.message)}</td></tr>`

  return page({
    title: 'New enquiry',
    preheader: `${enquiry.name} — ${enquiry.company || 'no business given'}`,
    content,
  })
}

/**
 * Hands the enquiry to Resend. The key travels in the request header and is
 * scrubbed out of anything the endpoint says back, so a refusal that quotes
 * the credential reaches neither the log nor the sender. The refusal itself is
 * logged rather than returned: an upstream message names account details that
 * belong on this side of the request.
 */
async function deliver(enquiry, key) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const upstream = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [INBOX],
        reply_to: enquiry.email,
        subject: `Website enquiry from ${enquiry.name} (${METHOD_LABELS[enquiry.contactMethod]})`,
        text: textBody(enquiry),
        html: htmlBody(enquiry),
      }),
    })

    if (!upstream.ok) {
      const said = await upstream.text().catch(() => '')
      const detail = said.replaceAll(key, '[redacted]').slice(0, 300)
      throw new Error(`resend returned ${upstream.status} ${detail}`.trim())
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Files where a delivered enquiry came from.
 *
 * The enquiry is already in the inbox by the time this runs, so a refused
 * write costs a figure rather than a lead and is logged instead of raised. A
 * deployment holding no service key files nothing at all, which is the state
 * a preview build runs in.
 *
 * @param {object} enquiry The delivered enquiry.
 * @param {object|null} [db] A service-role client, or null to build one.
 * @returns {Promise<boolean>} Whether a row was written.
 */
export async function recordAttribution(enquiry, db = connect()) {
  if (!db) return false
  const { error } = await db.from('enquiry_attribution').insert({
    form: enquiry.form,
    path: enquiry.path || null,
    ...(enquiry.campaign || {}),
  })
  if (error) {
    console.error('contact: the enquiry was delivered but not filed: %s', error.message)
    return false
  }
  return true
}

/** A service-role client, where the deployment carries the key for one. */
function connect() {
  if (!SERVICE_KEY) return null
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Which stage failed, in the words the log uses. */
function describe(error) {
  if (error && error.name === 'AbortError') return 'resend timed out'
  if (error && error.message) return error.message
  return 'resend unreachable'
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'POST only' })
    return
  }

  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.error('contact: RESEND_API_KEY is not set')
    response.status(503).json({ error: 'The contact form is not available right now.' })
    return
  }

  const body = readBody(request)
  const enquiry = {
    name: line(body.name, LIMITS.name),
    email: line(body.email, LIMITS.email),
    company: line(body.company, LIMITS.company),
    projectType: line(body.projectType, LIMITS.projectType),
    contactMethod: CONTACT_METHODS.has(body.contactMethod)
      ? body.contactMethod
      : DEFAULT_CONTACT_METHOD,
    phone: line(body.phone, LIMITS.phone),
    message: block(body.message, LIMITS.message),
    form: FORMS.has(body.form) ? body.form : DEFAULT_FORM,
    path: line(body.path, LIMITS.path),
    campaign: campaignFrom(body.campaign),
    referrer: referrerFrom(body.referrer),
  }

  // Measured before the window is spent, so a mistyped address costs the
  // sender a correction rather than one of their five attempts.
  const fault = faultIn(enquiry)
  if (fault) {
    response.status(400).json({ error: fault })
    return
  }

  if (!sendWindow.allows(callerAddress(request))) {
    response.setHeader('Retry-After', String(sendWindow.windowMs / 1000))
    response.status(429).json({ error: 'Too many messages from this connection. Try again later.' })
    return
  }

  try {
    await deliver(enquiry, key)
  } catch (error) {
    console.error('contact: %s', describe(error))
    response.status(502).json({ error: 'The message could not be sent. Please try again.' })
    return
  }

  // After delivery, so a database that is refusing writes costs the figure
  // rather than the enquiry.
  await recordAttribution(enquiry)

  // The configurator's own form is sent by somebody who answered its first
  // step, so the enquiry and the lead are the same person and the row should
  // say so. Nothing else on the site can tell them apart afterwards: the
  // attribution row deliberately holds no address.
  if (enquiry.form === 'start') await markLead('enquired', enquiry.email)

  response.setHeader('Cache-Control', 'private, no-store')
  response.status(200).json({ ok: true })
}
