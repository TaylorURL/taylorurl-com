import { faultFromResponse, faultMessage } from '@utils/faults'

const ENDPOINT = '/api/proposal'

const NOT_READ = 'This proposal could not be opened just now. Try again, or call (936) 391-1956.'
const NOT_OPENED = 'Checkout could not be opened just now. Try again, or call (936) 391-1956.'

/**
 * The sheet a pay link opens, as it stands now.
 *
 * Read on every visit rather than kept, because the profile behind the link is
 * one that gets edited in a chat, and a page showing the prices from an hour
 * ago is a page charging differently from the sheet.
 *
 * A key nobody saved answers null rather than throwing, because it is not a
 * fault: it is a link typed wrong or a sheet from somebody else, and the page
 * says so in its own words.
 *
 * @param {string} key The private key in the link.
 * @returns {Promise<object|null>} The sheet, or null where the key opens none.
 *   Rejects with a sentence for the reader.
 */
export async function readProposal(key) {
  let response
  try {
    response = await fetch(`${ENDPOINT}?p=${encodeURIComponent(key)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
  } catch (cause) {
    throw new Error(faultMessage(cause, NOT_READ))
  }
  if (response.status === 404) return null
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(faultFromResponse(response, payload, NOT_READ))
  return payload
}

/**
 * Opens a checkout for the sheet and the add-ons ticked, and answers with
 * where to send the browser.
 *
 * Only names go out. Every price is read off the profile at the other end, so
 * there is nothing on this side for anybody to change.
 *
 * @param {string} key
 * @param {string[]} addons The names of the add-ons ticked.
 * @returns {Promise<string>} The checkout's address.
 */
export async function payProposal(key, addons) {
  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p: key, addons }),
    })
  } catch (cause) {
    throw new Error(faultMessage(cause, NOT_OPENED))
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.url) {
    throw new Error(faultFromResponse(response, payload, NOT_OPENED))
  }
  return payload.url
}
