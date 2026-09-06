/**
 * The moment an inquiry is actually sent, reported to Google Analytics, to the
 * Google Ads account, and to the Meta Pixel.
 *
 * The property counts arrivals on its own. What a campaign decision rests on
 * is the step after the arrival - which towns, trades and openers produce
 * somebody who writes in - and only the form can report that.
 *
 * It fires on the answer from the endpoint rather than on the submit event: a
 * form that was refused for a missing field is not a lead, and counting the
 * attempt would put a conversion against every visitor who mistyped an
 * address.
 *
 * The campaign travels with Google's event rather than being left to the
 * property's own attribution. Google credits a conversion to the session's
 * campaign, and the session's campaign is read off the address the reader is
 * on - which by the time a form is filled in is an untagged page of the site.
 * Sending the held tags as parameters is what keeps the answer attached to the
 * message that produced it.
 *
 * The ad account is told separately, and it is told less. A property reads an
 * event by its name and files the parameters beside it; an ad account reads
 * `send_to`, which names one action in one account, and counts the call. So
 * the two are separate calls rather than one event with two destinations -
 * `leadEventParams` then still means exactly what its docstring says, and the
 * account is never handed six campaign fields it has no column for.
 *
 * The pixel needs neither. Meta credits a conversion through the click
 * identifier its own ads leave on the visitor, so it is told the form and
 * nothing else.
 */

import { SITE } from '../../../lib/site/current.js'
import { campaignHeld } from './campaign.js'

/**
 * The event name Google is told. `generate_lead` is one of Google's own
 * recommended events, which is what lets the property mark it as a key event
 * without a custom definition being registered first.
 */
export const LEAD_EVENT = 'generate_lead'

/**
 * The event name the property is told when the number is tapped.
 *
 * Its own event rather than the lead event, because the two are different
 * claims. `generate_lead` fires on an answer from the endpoint - somebody's
 * message is in the inbox. A tap on the number is a reach for the phone, and
 * whether it connected is a thing only the phone knows.
 */
export const CALL_EVENT = 'phone_call_click'

/**
 * The event name the ad account is told, for all three actions.
 *
 * `conversion` is not one of the property's events and is not meant to be. The
 * account reads `send_to`, which names the action; the event name beside it is
 * the fixed word Google's own snippets use and carries no meaning of its own.
 */
export const ADS_EVENT = 'conversion'

/**
 * The event name the pixel is told. `Lead` is one of Meta's standard events,
 * which is what lets an ad campaign be optimised for it without a custom
 * conversion being defined first.
 */
export const PIXEL_LEAD_EVENT = 'Lead'

/** The event name the pixel is told when the number is tapped. */
export const PIXEL_CALL_EVENT = 'Contact'

/**
 * Where the addresses already reported are remembered, for the length of one
 * visit.
 *
 * The session rather than the tab's memory alone, because the configurator
 * reports on a timer and again as the document goes, and a visitor who leaves
 * and comes back inside the same session would otherwise arrive as a second
 * lead. It is deliberately not the local store: a person who comes back next
 * week is worth counting again.
 */
const REPORTED_KEY = 'taylorurl:leads-reported'

/**
 * The addresses reported by this page, for a browser that refuses the session
 * store. Safari with cookies blocked throws on the first read rather than
 * answering empty, and a conversion that is counted twice is a better failure
 * than a page that stops on the way to counting it once.
 */
const reportedHere = new Set()

/** The session store, where there is one that can actually be read. */
function sessionStore() {
  try {
    const store = globalThis.sessionStorage
    store.getItem(REPORTED_KEY)
    return store
  } catch {
    return null
  }
}

/**
 * Whether this form's lead for this address still needs reporting, claiming it
 * in the same call so the next asker is told no.
 *
 * The configurator asks for an address on its first step and then reports
 * again at every screen behind it, and the brief it ends on submits under the
 * same address a second time. All of that is one person deciding once, so it
 * is one conversion, and the account is told at the earliest moment it can be
 * told rather than at the last.
 *
 * Keyed on the form as well as the address, because somebody who fills in the
 * configurator and later writes from the contact page has done two separate
 * things and both are worth counting.
 *
 * @param {string} form Which form is asking: `contact`, `start`, `tools` or `checkout`.
 * @param {string} email The address it holds.
 * @param {{store?: Storage|null, here?: Set<string>}} [where]
 * @returns {boolean} Whether this call is the one that should report.
 */
export function claimLead(form, email, { store = sessionStore(), here = reportedHere } = {}) {
  const address = String(email || '')
    .trim()
    .toLowerCase()
  if (!address) return false
  const key = `${form}:${address}`

  if (here.has(key)) return false
  if (!store) {
    here.add(key)
    return true
  }

  try {
    const held = JSON.parse(store.getItem(REPORTED_KEY) || '[]')
    const claimed = Array.isArray(held) ? held : []
    if (claimed.includes(key)) return false
    store.setItem(REPORTED_KEY, JSON.stringify([...claimed, key]))
    return true
  } catch {
    // A store that answered once and refused the write is the private-window
    // case again, and the page's own memory carries the rest of the visit.
    here.add(key)
    return true
  }
}

/** The held campaign, keyed as Google's own campaign fields are named. */
function campaignParams(held) {
  return {
    campaign_source: held?.utm_source || '',
    campaign_medium: held?.utm_medium || '',
    campaign_name: held?.utm_campaign || '',
    campaign_term: held?.utm_term || '',
    campaign_content: held?.utm_content || '',
  }
}

/** The parameters Google's event carries, keyed as the campaign fields are named. */
export function leadEventParams(form, held) {
  return { form, ...campaignParams(held) }
}

/** The same, for a tap on the number, which names a place rather than a form. */
export function callEventParams(where, held) {
  return { where, ...campaignParams(held) }
}

/**
 * Which action in the ad account a form's conversion belongs to.
 *
 * The checkout is its own action because it is a different claim: an inquiry is
 * somebody asking, and a checkout is somebody at the payment page for a build.
 * The other three forms are all the same claim and share one.
 *
 * Returns null on a site with no ad account, which is what keeps the studio's
 * account from being told about a second site's forms.
 *
 * @param {string} form
 * @param {object} [site]
 */
export function adsSendTo(form, site = SITE) {
  return (form === 'checkout' ? site.adsCheckoutSendTo : site.adsLeadSendTo) || null
}

/**
 * A phone number in the one shape Google reads, or null.
 *
 * E.164, which means a country code. Ten digits are a US number and get one;
 * eleven beginning with a 1 already have theirs. Anything else is refused
 * rather than guessed at - a malformed number does not fail loudly, it just
 * matches nobody, and a field that is absent is easier to notice than a field
 * that is wrong.
 *
 * @param {string} value
 * @returns {string|null}
 */
export function e164(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

/**
 * What the ad account is told about who converted, for enhanced conversions.
 *
 * Google's tag normalises and hashes these itself, so they are handed over
 * plain. That is what keeps this function synchronous, and it has to be:
 * hashing in the page means `crypto.subtle`, which is a promise, which would
 * put an await between the checkout's report and the document unload on the
 * next line of `startCheckout`.
 *
 * Only fields a form actually holds are sent. No form on this site collects a
 * street, a city or a postcode, so the address carries names and nothing else,
 * and a checkout - which knows an email and a business, not a person - carries
 * no address at all. A field that cannot be filled honestly is left out.
 *
 * @param {{name?: string, email?: string, phone?: string}} person
 * @returns {object|null}
 */
export function identityOf(person) {
  if (!person?.email) return null
  const identity = { email: String(person.email).trim().toLowerCase() }

  const phone = e164(person.phone)
  if (phone) identity.phone_number = phone

  const parts = String(person.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length > 1) {
    identity.address = { first_name: parts[0], last_name: parts[parts.length - 1] }
  }

  return identity
}

/**
 * Reports one delivered inquiry.
 *
 * `gtag` and `fbq` are declared by the snippet in the page head and are absent
 * while the page is being rendered at build time, or wherever the snippet was
 * kept from running. A missing one costs this event on that side and nothing
 * else, so each is read at the moment of use rather than depended on.
 *
 * @param {string} form Which form was sent: `contact`, `start`, `tools` or `checkout`.
 * @param {{held?: object|null, person?: object|null, tag?: Function|null,
 *   pixel?: Function|null, site?: object}} [where]
 * @returns {object|null} What Google was told, or null when neither tag was there.
 */
export function recordLead(
  form,
  {
    held = campaignHeld(),
    person = null,
    tag = globalThis.gtag,
    pixel = globalThis.fbq,
    site = SITE,
  } = {}
) {
  const toGoogle = typeof tag === 'function'
  const toMeta = typeof pixel === 'function'
  if (!toGoogle && !toMeta) return null
  const params = leadEventParams(form, held)
  if (toGoogle) {
    tag('event', LEAD_EVENT, params)
    const sendTo = adsSendTo(form, site)
    if (sendTo) {
      const identity = identityOf(person)
      if (identity) tag('set', 'user_data', identity)
      tag('event', ADS_EVENT, { send_to: sendTo })
    }
  }
  if (toMeta) pixel('track', PIXEL_LEAD_EVENT, { content_name: form })
  return params
}

/**
 * Reports one tap on the number.
 *
 * The campaign travels with it for the same reason it travels with the lead:
 * by the time somebody has read enough to pick up the phone they are on an
 * untagged page, and the property would otherwise credit the arrival to
 * nothing.
 *
 * @param {string} where Which number was tapped: `nav`, `footer`, `contact` or `chat`.
 * @param {{held?: object|null, tag?: Function|null, pixel?: Function|null,
 *   site?: object}} [into]
 * @returns {boolean} Whether either tag was there to be told.
 */
export function recordCall(
  where,
  { held = campaignHeld(), tag = globalThis.gtag, pixel = globalThis.fbq, site = SITE } = {}
) {
  const toGoogle = typeof tag === 'function'
  const toMeta = typeof pixel === 'function'
  if (!toGoogle && !toMeta) return false
  if (toGoogle) {
    tag('event', CALL_EVENT, callEventParams(where, held))
    if (site.adsCallSendTo) tag('event', ADS_EVENT, { send_to: site.adsCallSendTo })
  }
  if (toMeta) pixel('track', PIXEL_CALL_EVENT, { content_name: where })
  return true
}

/**
 * Reports one navigation to the pixel.
 *
 * Google needs no such call: its data stream counts browser history changes,
 * which every navigation on a client-side router produces. The pixel counts the
 * page it was loaded on and nothing after it, so the layout reports each page
 * after the first through this.
 *
 * @param {{pixel?: Function|null}} [where]
 * @returns {boolean} Whether the pixel was there to be told.
 */
export function recordPageView({ pixel = globalThis.fbq } = {}) {
  if (typeof pixel !== 'function') return false
  pixel('track', 'PageView')
  return true
}
