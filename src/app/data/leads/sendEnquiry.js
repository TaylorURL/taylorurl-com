import { faultFromResponse, faultMessage } from '../../utils/faults.js'
import { campaignHeld } from './campaign.js'
import { claimLead, recordLead } from './conversion.js'

const ENDPOINT = '/api/contact'
const FALLBACK_ERROR = "Couldn't send your message just now. Please try again."

/** Which page the inquiry was written on, where there is a page to read. */
function pathNow() {
  try {
    return typeof location === 'undefined' ? '' : location.pathname
  } catch {
    return ''
  }
}

/**
 * Where the visit came in from, where the browser names somewhere off this
 * site.
 *
 * Only a tagged link says which campaign brought somebody in, and most
 * arrivals carry no tags at all, so every one of them was reported as having
 * come from nowhere. The referrer is what the browser knows instead: a search
 * partner, a directory, a link on somebody else's page.
 *
 * It survives the whole visit rather than the first page of it, because the
 * router moves between pages without loading a document and the referrer
 * belongs to the document. A referrer naming this site is one page of a visit
 * pointing at the next, which says nothing about where the visit came from, so
 * it is dropped and the inquiry reads as direct.
 */
function referrerNow() {
  try {
    if (typeof document === 'undefined' || !document.referrer) return ''
    const from = new URL(document.referrer)
    if (typeof location !== 'undefined' && from.host === location.host) return ''
    return from.href
  } catch {
    return ''
  }
}

/**
 * Posts an inquiry to `api/contact.js`, which validates it again and delivers
 * it. Resolves on success; on any non-2xx response throws an Error carrying a
 * sentence written for the person who typed the message, for the caller to
 * surface.
 *
 * The conversion is reported from here rather than from each form, because
 * this is the one place that knows the endpoint accepted the inquiry. A form
 * that reported its own would be counting the attempt, and a fourth form added
 * later would silently count nothing at all.
 *
 * `form` says which of them was sent, so a figure can separate the inquiry
 * that came off a cold message from the one that came off the tools.
 *
 * The three fields the writer typed go with it. They are what lets a
 * conversion still be matched to the click that produced it once the browser
 * has stopped keeping the cookie that used to do the matching; the tag hashes
 * them before anything leaves the page, and this hands over what the form
 * already holds rather than reading anything more.
 */
export async function submitEnquiry({
  form,
  name,
  email,
  company = '',
  projectType = '',
  contactMethod = 'either',
  phone = '',
  message,
}) {
  const campaign = campaignHeld()
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim(),
      company: company.trim(),
      projectType,
      contactMethod,
      phone: phone.trim(),
      message: message.trim(),
      form,
      path: pathNow(),
      campaign,
      referrer: referrerNow(),
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    // The endpoint writes its refusals for readers, but a refusal that never
    // reached it does not: a rate limiter, a gateway, a deploy mid-flight all
    // answer in their own words and land in the same field. Reading the body
    // here means every form that catches this has a sentence rather than a
    // guess about which of those it was.
    throw new Error(faultFromResponse(response, payload, FALLBACK_ERROR))
  }

  // The configurator already reported this address when it was answered on the
  // first step, so the brief arriving at the end of the same visit is the same
  // conversion reaching its last screen rather than a second one. Every other
  // form is the first time this address has been heard from on it.
  if (!claimLead(form, email)) return

  recordLead(form, {
    held: campaign,
    person: { name: name.trim(), email: email.trim(), phone: phone.trim() },
  })
}

/**
 * What to show when an inquiry did not send.
 *
 * Every form on the site posts through one function and catches one thrown
 * thing, so the one door in `utils/faults` answers for all of them. The
 * fallback names the message rather than whatever failed carrying it, because
 * somebody who has just written three paragraphs wants to know whether they
 * were sent.
 */
export function enquiryErrorMessage(error) {
  return faultMessage(error, FALLBACK_ERROR)
}
