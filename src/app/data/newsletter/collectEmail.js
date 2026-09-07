const ENDPOINT = 'https://gujgtjqqurildqurpffh.supabase.co/functions/v1/collect-email'
const PUBLISHABLE_KEY = 'sb_publishable_qn4ZWB2n95HGMJm0L58I0w_ClE_Qu4M'
const FALLBACK_ERROR = "Couldn't sign you up just now. Please try again."

/**
 * Posts a signup to the Supabase `collect-email` edge function. Resolves on
 * success; on any non-2xx response throws an Error carrying the server's
 * message (or a generic fallback) for the caller to surface.
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
    const fault = new Error(payload?.error || FALLBACK_ERROR)
    fault.status = response.status
    throw fault
  }
}

/**
 * Turns a caught signup error into a user-safe message: the server's own text
 * when it's short enough to trust, otherwise a generic fallback.
 */
export function signupErrorMessage(error) {
  return error?.message?.length && error.message.length < 200 ? error.message : FALLBACK_ERROR
}
