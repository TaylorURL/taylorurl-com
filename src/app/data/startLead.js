import { campaignHeld } from './campaign.js'
import { claimLead, recordLead } from './conversion.js'

const ENDPOINT = '/api/start-lead'

/**
 * Records the address answered on the configurator's first step.
 *
 * The step asks for an address before it opens the four screens behind it, and
 * until this existed the answer went into session storage and nowhere else. A
 * visitor who answered every screen and then closed the tab left a brief with
 * nobody attached to it, and there was no way to write back and ask how it
 * went.
 *
 * Nothing here is awaited and nothing here can fail in a way the visitor sees.
 * The configurator carries on whatever this does: a refusal, a timeout and a
 * blocked request all come to the same thing, which is a lead that was not
 * recorded and a step that opened anyway. A gate that can be closed by an ad
 * blocker is not a gate.
 *
 * `keepalive` is what carries the last call. The most valuable moment to
 * record is the one where somebody types their address and leaves, and a plain
 * request started as the tab closes is cancelled with the document.
 *
 * The brief travels with every report rather than only with the payment. A
 * step number says how far somebody reached and nothing about what they
 * wanted, and the visitor worth writing back to is the one who answered four
 * screens and stopped - which is a message you can only write if you know what
 * they answered.
 *
 * The property and the ad accounts are told here too, and told once. Until
 * this line existed the configurator's first step - which is the step the ads
 * point at, and the one place on the site where an address is asked for before
 * anything is given - reported to the database and to nothing else. A campaign
 * cannot be optimised toward a conversion nobody outside this endpoint can
 * see, so the money went to whichever ad produced the cheapest visit rather
 * than to whichever ad produced somebody who answered.
 *
 * It is the address that gates the report, not the step. This runs again at
 * every screen the visitor reaches and again as the tab closes, and a
 * conversion counted once per screen would put five leads against one person.
 *
 * @param {{email: string, trade?: string|null, step?: number,
 *   brief?: Array<{label: string, value: string}>|null}} lead
 * @returns {void}
 */
export function recordStart({ email, trade = null, step = 0, brief = null }) {
  if (typeof fetch !== 'function') return

  const campaign = campaignHeld()
  if (claimLead('start', email)) {
    recordLead('start', { held: campaign, person: { email: email.trim() } })
  }

  try {
    fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim(),
        trade,
        step,
        brief,
        path: typeof location === 'undefined' ? '' : location.pathname,
        campaign,
      }),
    }).catch(() => {})
  } catch {
    // A browser refusing the request outright is one more way for this to be
    // the thing that does not happen.
  }
}
