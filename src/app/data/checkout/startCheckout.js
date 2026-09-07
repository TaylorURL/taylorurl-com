import { campaignHeld } from '../leads/campaign.js'
import { recordLead } from '../leads/conversion.js'

const ENDPOINT = '/api/checkout'
const FALLBACK_ERROR = "Couldn't open checkout just now. Please try again."

/**
 * One cookie this browser holds, or an empty string where it holds none.
 *
 * The pixel writes `_fbp` on any visitor and `_fbc` on one who arrived on a
 * Meta ad, and both are first-party cookies on this domain, so they are read
 * here rather than asked of the pixel. A page rendered at build time has no
 * document at all, which is why reaching for one is what is guarded.
 *
 * @param {string} name
 * @returns {string}
 */
function cookie(name) {
  try {
    if (typeof document === 'undefined') return ''
    const held = String(document.cookie || '')
      .split(';')
      .map(part => part.trim())
      .find(part => part.startsWith(`${name}=`))
    return held ? decodeURIComponent(held.slice(name.length + 1)) : ''
  } catch {
    return ''
  }
}

/**
 * Opens a Stripe checkout for a build and hands back the page to send the
 * buyer to.
 *
 * The redirect is left to the caller rather than done here, because a function
 * that navigates is a function that cannot be tested and cannot be called from
 * anywhere that wanted the URL for another reason.
 *
 * The conversion is reported from here for the same reason the inquiry reports
 * its own from `sendEnquiry`: this is the one place that knows Stripe accepted
 * the request. It counts the checkout being opened rather than the payment
 * landing, which the webhook is what sees; a buyer who reaches Stripe and
 * closes the tab is a funnel that worked and a sale that did not.
 *
 * The brief travels with the payment because this is the last moment it exists.
 * The configurator holds its answers in session storage, which the redirect to
 * Stripe and back through a new tab is under no obligation to survive, and the
 * enquiry path has always sent the same rows. A buyer who pays should not be
 * the one whose answers are lost.
 *
 * The agreement travels with it for a different reason: the endpoint refuses a
 * checkout that does not carry one. A tick on a form is a thing a browser can
 * be talked out of, so what makes it a condition of the sale is the server
 * asking for it, and what makes it a record is the time being written on the
 * session Stripe opens.
 *
 * The click identifier and the pixel's cookies travel for a third reason. The
 * sale itself happens after the browser is gone, so the only report of it comes
 * from the webhook, and an ad account credits a reported conversion through the
 * identifier it wrote on the click that produced it. Sent from here they reach
 * the Stripe session and are still there when the money lands; left here they
 * are gone the moment the buyer is redirected, and the ad that sold a build is
 * a click the account never counts.
 *
 * @param {{email: string, businessName?: string, website?: string,
 *   brief?: Array<{label: string, value: string}>, termsAccepted?: boolean}} details
 * @returns {Promise<string>} Stripe's own hosted page.
 */
export async function openCheckout({
  email,
  businessName = '',
  website = '',
  brief = [],
  termsAccepted = false,
}) {
  const campaign = campaignHeld()
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      business_name: businessName.trim(),
      website: website.trim(),
      brief,
      terms_accepted: termsAccepted === true,
      campaign,
      fbp: cookie('_fbp'),
      fbc: cookie('_fbc'),
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error || FALLBACK_ERROR)
  }

  recordLead('checkout', { held: campaign, person: { email: email.trim() } })
  return payload.url
}

/**
 * Turns a caught checkout error into a user-safe message: the server's own text
 * where it is short enough to trust, otherwise a generic fallback.
 */
export function checkoutErrorMessage(error) {
  return error?.message?.length && error.message.length < 200 ? error.message : FALLBACK_ERROR
}
