/**
 * The text line: whether a preview may go by text now, and the handover to
 * Twilio when it may.
 *
 * A business the studio holds a phone number for and no address is sent its
 * preview by text, from one toll-free number behind one Twilio messaging
 * service. That line is nothing like the cold mailbox. It answers to Twilio and
 * the carriers rather than to Gmail, it is paced by a cap of its own, and none
 * of the mailbox's figures can see it: a text is never a row of
 * `outreach_messages`, so the mailbox ceiling, the ramp and the ten-letter limit
 * never count one. Texts are filed in `outreach_texts` instead.
 *
 * Four things must all hold before a text leaves, and every sender reads them
 * through `textLineOf` rather than on its own:
 *
 *   The keys        TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN on the deployment.
 *   The service     `text_service_sid` on `outreach_settings`, which the Pi's
 *                   twilio-texting routine files once Twilio sells it a number.
 *   The switches    `sending_enabled`, which holds every outreach sender, and
 *                   `texting_enabled`, with `texting_starts_at` passed. The
 *                   routine sets both once Twilio has verified the number, and
 *                   emails the owner the start first, so the first text never
 *                   reaches anybody before the owner knows when it will.
 *   The hours       9:00 to 17:00 Central, Monday to Friday. A text is read
 *                   the moment it lands, so it keeps working hours narrower than
 *                   the mailbox's.
 *
 * OUTREACH_SEND_ARMED is read too, as every outreach sender reads it, so a
 * preview deployment never reaches a phone.
 *
 * Twilio's own STOP handling sits in front of all of this: a number that has
 * texted STOP to the line is refused by Twilio whatever is sent to it. It is
 * mirrored in `text_suppression` by api/outreach/texts.js all the same, so a
 * number is closed here before Twilio has to refuse it.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { clockIn, dayIn, instantOf } from '../../time/zone.js'

const API = 'https://api.twilio.com/2010-04-01'
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || ''
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''
const ARMED = process.env.OUTREACH_SEND_ARMED === 'true'

/** Where Twilio reports on every text and hands over every reply. */
export const TEXT_HOOK = 'https://www.taylorurl.com/api/outreach/texts'

// The hours a text may leave, in minutes from midnight Central. Nine rather
// than the mailbox's eight: a letter waits in an inbox, a text buzzes a phone.
export const TEXT_OPENS = 9 * 60
export const TEXT_CLOSES = 17 * 60

// No text leaves on a weekend, here as for the mailbox.
const CLOSED_DAYS = new Set(['Sat', 'Sun'])

const TIMEOUT_MS = 20_000

/**
 * A US number written one way, `+1` and ten digits, or null when it is not one.
 * Every comparison of numbers in the texting path goes through this, so the
 * listing's "(281) 555-0100" and Twilio's "+12815550100" are the same business.
 *
 * @param {unknown} raw
 * @returns {string|null}
 */
export function usPhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length === 10 && /^[2-9]/.test(digits)) return `+1${digits}`
  if (digits.length === 11 && /^1[2-9]/.test(digits)) return `+${digits}`
  return null
}

/**
 * Whether a text may leave at this moment by the clock alone.
 *
 * @param {Date} [now]
 * @returns {boolean}
 */
export function inTextHours(now = new Date()) {
  const clock = clockIn(now)
  if (!clock || CLOSED_DAYS.has(clock.weekday)) return false
  return clock.minutes >= TEXT_OPENS && clock.minutes < TEXT_CLOSES
}

/**
 * When the Central day `now` falls in began, as an instant, which is the day
 * the text cap is counted over.
 *
 * @param {Date} [now]
 * @returns {Date}
 */
export function textDayStart(now = new Date()) {
  return instantOf(dayIn(now))
}

/**
 * Whether the line may carry a text now, and why not when it may not.
 *
 * @param {object} settings The `outreach_settings` row.
 * @param {Date} [now]
 * @returns {{open: boolean, reason?: string, service?: string}}
 */
export function textLineOf(settings, now = new Date()) {
  if (!ARMED) return { open: false, reason: 'OUTREACH_SEND_ARMED is off' }
  if (!ACCOUNT_SID || !AUTH_TOKEN) {
    return { open: false, reason: 'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is not set' }
  }
  if (!settings?.text_service_sid) return { open: false, reason: 'no Twilio number is set up yet' }
  if (!settings.sending_enabled) return { open: false, reason: 'outreach sending is switched off' }
  if (!settings.texting_enabled) return { open: false, reason: 'texting is switched off' }
  const starts = settings.texting_starts_at ? Date.parse(settings.texting_starts_at) : NaN
  if (!Number.isFinite(starts)) return { open: false, reason: 'no start is set for the texts' }
  if (starts > now.getTime()) {
    return { open: false, reason: `the texts start ${new Date(starts).toISOString()}` }
  }
  if (!inTextHours(now)) return { open: false, reason: 'outside the hours a text may leave' }
  return { open: true, service: settings.text_service_sid }
}

/**
 * How many texts the line has sent today, Central.
 *
 * @param {object} db A service-role client.
 * @param {Date} [now]
 * @returns {Promise<number>}
 */
export async function textsSentToday(db, now = new Date()) {
  const { count, error } = await db
    .from('outreach_texts')
    .select('id', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .not('sent_at', 'is', null)
    .gte('sent_at', textDayStart(now).toISOString())
  if (error) throw new Error(error.message)
  return count ?? 0
}

/** Twilio's refusal of one text, with its code so the caller can tell which. */
export class TextRefused extends Error {
  constructor(status, code, message) {
    super(`twilio answered ${status}${code ? ` (${code})` : ''}: ${message}`)
    this.status = status
    this.code = code
  }
}

// Twilio's codes for a number that will never take a text from this line: one
// that is not a mobile number, one that is not a valid number at all, and one
// that has texted STOP. Anything else is about the moment, not the number.
const NUMBER_CODES = new Set([21211, 21214, 21612, 21614, 21610])

/** Whether a refusal is about the number rather than about the line. */
export const refusesNumber = cause => cause instanceof TextRefused && NUMBER_CODES.has(cause.code)

/**
 * Hands one text to Twilio.
 *
 * The status callback rides on every message rather than only on the service,
 * so a text sent before the service's own hook was set is still reported.
 *
 * @param {{to: string, body: string, mediaUrl?: string|null, service: string}} text
 * @returns {Promise<string>} Twilio's id for the message.
 */
export async function sendText({ to, body, mediaUrl = null, service }) {
  const form = new URLSearchParams({
    To: to,
    Body: body,
    MessagingServiceSid: service,
    StatusCallback: TEXT_HOOK,
  })
  if (mediaUrl) form.append('MediaUrl', mediaUrl)
  const answer = await fetch(`${API}/Accounts/${ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      Authorization: `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })
  const said = await answer.json().catch(() => ({}))
  if (!answer.ok) {
    throw new TextRefused(
      answer.status,
      said?.code ?? null,
      String(said?.message ?? '').slice(0, 300)
    )
  }
  return said.sid
}

/**
 * Whether a request is Twilio's own, by the signature it carries.
 *
 * Twilio signs the full URL it called followed by every posted field, sorted
 * by name, each name written straight against its value, with HMAC-SHA1 under
 * the account's auth token, and sends it base64 in X-Twilio-Signature.
 *
 * @param {string} url The URL as Twilio called it, query string included.
 * @param {Record<string, string>} params The posted fields.
 * @param {string} signature The X-Twilio-Signature header.
 * @param {string} [token] The auth token; the deployment's own by default.
 * @returns {boolean}
 */
export function signedByTwilio(url, params, signature, token = AUTH_TOKEN) {
  if (!token || typeof signature !== 'string' || !signature) return false
  const payload = Object.keys(params)
    .sort()
    .reduce((written, name) => written + name + params[name], url)
  const expected = createHmac('sha1', token).update(payload, 'utf8').digest()
  const given = Buffer.from(signature, 'base64')
  return given.length === expected.length && timingSafeEqual(given, expected)
}
