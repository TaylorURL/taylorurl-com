import { faultFromResponse } from '../../utils/faults.js'
import { campaignHeld, referrerNow } from './campaign.js'
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
  addOns = '',
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
      addOns,
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

  // An address already reported from this form inside this visit is the same
  // person pressing send twice rather than a second conversion, so it is
  // claimed once and the ad account is told once.
  if (!claimLead(form, email)) return

  recordLead(form, {
    held: campaign,
    person: { name: name.trim(), email: email.trim(), phone: phone.trim() },
  })
}
