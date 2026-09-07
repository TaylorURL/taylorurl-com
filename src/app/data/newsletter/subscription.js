import { faultMessage } from '../../utils/faults.js'

const FUNCTIONS_URL = 'https://gujgtjqqurildqurpffh.supabase.co/functions/v1'
const PUBLISHABLE_KEY = 'sb_publishable_qn4ZWB2n95HGMJm0L58I0w_ClE_Qu4M'
// Two of the three ways in are a link followed out of an email and one is an
// address typed into a form, so there is no one noun for what did not work.
// Each entry point names its own, and the shared one is the last resort for a
// caller that named nothing.
const FROM_LINK = 'That link could not be used just now. Try it again.'
const FALLBACK_ERROR = 'That did not go through just now. Try it again.'

/**
 * Posts to one of the subscription edge functions. Resolves to `{ already }`,
 * which is true when what was asked for had already been done; on any non-2xx
 * response throws an Error carrying a sentence written for whoever followed the
 * link.
 */
async function post(slug, body, fallback = FALLBACK_ERROR) {
  const response = await fetch(`${FUNCTIONS_URL}/${slug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)
  // Read here rather than handed on, because what comes back is only sometimes
  // the function's own words: a gateway, a rate limiter or a project asleep
  // answers in its own, and all of them land in the same field. Two of the
  // three ways in are a link followed out of an email, where there is no form
  // in front of the reader to be told to correct, so the sentence they get has
  // to stand on its own.
  //
  // Read out of the body and not the status beside it. Everyone who reaches
  // these three pages is an address on a mailing list rather than somebody
  // holding an account, so a sentence chosen for a refusal on its status --
  // sign in again, this account is not allowed -- names a step they have no way
  // to take. One of the three ways in is a person leaving, and nobody is held
  // on a list by a sentence they cannot act on.
  if (!response.ok) throw new Error(faultMessage(payload, fallback))
  return { already: Boolean(payload?.already) }
}

/** Turns a pending signup into a subscription. */
export function confirmSubscription(token) {
  return post('confirm-subscription', { token }, FROM_LINK)
}

/** Takes the address a link names off the list and onto suppression. */
export function unsubscribeToken(token) {
  return post('unsubscribe', { token }, FROM_LINK)
}

/**
 * Takes a typed address off the list and onto suppression.
 *
 * The answer never says whether anything held the address, so `already` comes
 * back false however much there was to do.
 */
export function unsubscribeAddress(email) {
  return post(
    'unsubscribe',
    { email },
    'That address could not be taken off the list. Try it again.'
  )
}
