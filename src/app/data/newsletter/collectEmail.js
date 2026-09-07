import { faultMessage } from '../../utils/faults.js'

const ENDPOINT = 'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/collect-email'
const PUBLISHABLE_KEY = 'sb_publishable_qn4ZWB2n95HGMJm0L58I0w_ClE_Qu4M'
const FALLBACK_ERROR = "Couldn't sign you up just now. Please try again."

/**
 * Posts a signup to the `collect-email` edge function. Resolves on success; on
 * any non-2xx response throws an Error carrying a sentence written for the
 * person who typed the address, for the caller to surface.
 *
 * The status rides on the error alongside the message, because one refusal is a
 * dead end rather than something to try again: an address held on `suppression`
 * answers 403 and will answer 403 to every later attempt, so a form that offers
 * the way back needs to tell that refusal from the rest without reading the
 * sentence and guessing.
 */
export async function submitEmailSignup({ name = '', email, source }) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ name: name.trim(), email: email.trim(), source }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    // Read out of the body alone, without the status behind it. The status here
    // is a signal and not a sentence: a 403 is an address held off every list,
    // and the words written for a request refused on its status are words about
    // an account being told no, which is not what a box at the foot of a page
    // has. The form reads the status below for that, and reads it as a fact
    // rather than as something to say.
    const fault = new Error(faultMessage(payload, FALLBACK_ERROR))
    fault.status = response.status
    throw fault
  }
}

/**
 * What to show when a signup did not go on the list.
 *
 * The one door in `utils/faults` answers for all of it, and the fallback names
 * the signup rather than whatever failed underneath it.
 */
export function signupErrorMessage(error) {
  return faultMessage(error, FALLBACK_ERROR)
}
