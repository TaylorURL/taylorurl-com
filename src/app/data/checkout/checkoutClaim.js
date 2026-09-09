const ENDPOINT = '/api/checkout-claim'

/**
 * What one finished checkout knows about its buyer, and the way into the
 * account it opened.
 *
 * The three fields describe who paid and are what the screen names back. The
 * token is the way in, and it comes back only when the key carried in the
 * return address earns one - a key already spent, a checkout from last month,
 * or a service that could not be reached all answer with the buyer and no
 * token, which is the screen offering a password instead of a console.
 *
 * Every failure answers null rather than throwing. The only caller is a screen
 * somebody reaches straight off a payment, and it has a way to carry on with
 * nothing; an error about our plumbing in front of somebody who has just paid
 * is the one thing it must not do.
 *
 * @param {string|null|undefined} sessionId Stripe's id, as it comes back in
 *   the return address.
 * @param {string|null|undefined} claim The one-use key, from the same address.
 * @returns {Promise<{email: string|null, name: string|null, business: string|null,
 *   token: string|null, type: string|null}|null>}
 */
export async function claimCheckout(sessionId, claim) {
  if (!sessionId) return null
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: sessionId, claim: claim || '' }),
    })
    if (!response.ok) return null
    const payload = await response.json().catch(() => null)
    if (!payload) return null
    const held = value => (typeof value === 'string' && value ? value : null)
    return {
      email: held(payload.email),
      name: held(payload.name),
      business: held(payload.business),
      token: held(payload.token),
      type: held(payload.type),
    }
  } catch {
    return null
  }
}
