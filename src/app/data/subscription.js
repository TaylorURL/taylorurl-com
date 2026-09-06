const FUNCTIONS_URL = 'https://gujgtjqqurildqurpffh.supabase.co/functions/v1'
const PUBLISHABLE_KEY = 'sb_publishable_qn4ZWB2n95HGMJm0L58I0w_ClE_Qu4M'
const FALLBACK_ERROR = 'That link could not be used just now. Please try again.'

/**
 * Posts to one of the subscription edge functions. Resolves to `{ already }`,
 * which is true when what was asked for had already been done; on any non-2xx
 * response throws an Error carrying the server's message.
 */
async function post(slug, body) {
  const response = await fetch(`${FUNCTIONS_URL}/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || FALLBACK_ERROR)
  return { already: Boolean(payload?.already) }
}

/** Turns a pending signup into a subscription. */
export function confirmSubscription(token) {
  return post('confirm-subscription', { token })
}

/** Takes the address a link names off the list and onto suppression. */
export function unsubscribeToken(token) {
  return post('unsubscribe', { token })
}

/**
 * Takes a typed address off the list and onto suppression.
 *
 * The answer never says whether anything held the address, so `already` comes
 * back false however much there was to do.
 */
export function unsubscribeAddress(email) {
  return post('unsubscribe', { email })
}

/**
 * Turns a caught error into a message safe to show: the server's own text when
 * it's short enough to trust, otherwise a generic fallback.
 */
export function subscriptionErrorMessage(error) {
  return error?.message?.length && error.message.length < 200 ? error.message : FALLBACK_ERROR
}
