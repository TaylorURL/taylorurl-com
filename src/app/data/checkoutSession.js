const ENDPOINT = '/api/checkout-session'

/**
 * What one finished checkout knows about its buyer, or null.
 *
 * Every failure answers null rather than throwing. The only caller fills a form
 * in with this, and a field that stays empty is a field somebody types into -
 * which is exactly what they would have done anyway. A buyer who has just paid
 * should never meet an error about a lookup they did not ask for.
 *
 * @param {string|null|undefined} sessionId Stripe's id, as it comes back in
 *   the success address.
 * @returns {Promise<{email: string|null, name: string|null, business: string|null}|null>}
 */
export async function paidBuyer(sessionId) {
  if (!sessionId) return null
  try {
    const response = await fetch(`${ENDPOINT}?session=${encodeURIComponent(sessionId)}`, {
      cache: 'no-store',
    })
    if (!response.ok) return null
    const payload = await response.json().catch(() => null)
    if (!payload) return null
    const held = value => (typeof value === 'string' && value ? value : null)
    return {
      email: held(payload.email),
      name: held(payload.name),
      business: held(payload.business),
    }
  } catch {
    return null
  }
}
