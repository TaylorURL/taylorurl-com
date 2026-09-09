/**
 * The account a payment opens, and the record of which checkout opened it.
 *
 * Nobody signs up for this. A build is bought and the account comes with it,
 * made against the address the card was used with, because that is the address
 * the project is waiting under and any other one lands the buyer in an empty
 * console. Making it is the studio's job rather than the buyer's, so it happens
 * on the two paths a payment can be learned about and is idempotent on both:
 * the webhook, which is told every time whether or not a browser came back, and
 * the claim, which is the browser coming back and may well arrive first.
 *
 * The account is confirmed as it is made. There is nothing to confirm - Stripe
 * has just taken money from a card at that address, which is a stronger reading
 * of it than a click in an inbox - and an unconfirmed account is one the buyer
 * cannot be signed into when they land.
 *
 * It is made with no password. The buyer never chose one and has no use for one
 * that day; they arrive signed in and the console's settings is where a
 * password gets set, the same place an account that has always existed sets a
 * new one. Everything after that day is the ordinary reset link.
 */

/** What GoTrue says when the address already holds an account. */
function alreadyHeld(error) {
  if (!error) return false
  if (error.code === 'email_exists' || error.code === 'user_already_exists') return true
  return /already (been )?registered|already exists|email_exists/i.test(error.message || '')
}

/**
 * The account for a buyer, made if this address does not hold one.
 *
 * An address that already has an account is the ordinary case for a second
 * build and is not a failure - the answer says which of the two happened, and
 * both mean the account exists.
 *
 * @param {object} db A Supabase client holding the service-role key.
 * @param {{email: string, name?: string|null}} buyer
 * @returns {Promise<{made: boolean, error: Error|null}>}
 */
export async function openBuyerAccount(db, { email, name }) {
  const address = String(email || '').trim()
  if (!address) return { made: false, error: new Error('A buyer account needs an address.') }

  // Capped here rather than at each caller, so the two paths that open an
  // account cannot write the same buyer's name down at two different lengths.
  const held = String(name || '')
    .trim()
    .slice(0, 120)
  const { error } = await db.auth.admin.createUser({
    email: address,
    email_confirm: true,
    // Read by the trigger that creates the profile row, so the name is on the
    // account from its first moment rather than collected again afterwards.
    user_metadata: held ? { full_name: held } : {},
  })

  if (!error) return { made: true, error: null }
  if (alreadyHeld(error)) return { made: false, error: null }
  return { made: false, error }
}

/**
 * Which checkouts this account has already been opened with.
 *
 * Kept on the account rather than on the project because it is read at the
 * moment a session is about to be minted, which is before anything here knows a
 * project id, and because it has to answer for an account whose project row the
 * webhook has not written yet.
 */
function spentClaims(user) {
  const held = user?.app_metadata?.claimed_checkouts
  return Array.isArray(held) ? held.filter(id => typeof id === 'string') : []
}

/** Whether this checkout's key has been spent already. */
export function claimSpent(user, sessionId) {
  return spentClaims(user).includes(sessionId)
}

/**
 * How many checkouts an account remembers having been opened with.
 *
 * Only the recent ones matter: an old key is refused by its own window long
 * before it falls off the end of this list, so the list is a guard against a
 * replay within the day rather than a history of the account.
 */
const REMEMBERED = 10

/**
 * Spend this checkout's key, so a second arrival with the same URL opens
 * nothing.
 *
 * Written before the token reaches the browser rather than after it is
 * redeemed, because there is no after: the endpoint has answered and gone by
 * the time the browser redeems anything. A buyer whose redemption fails on the
 * way back therefore lands on the screen that offers a password instead, which
 * is the same place every other refusal puts them.
 *
 * @returns {Promise<Error|null>} What went wrong, where anything did.
 */
export async function spendClaim(db, user, sessionId) {
  const kept = [sessionId, ...spentClaims(user).filter(id => id !== sessionId)].slice(0, REMEMBERED)
  const { error } = await db.auth.admin.updateUserById(user.id, {
    app_metadata: { ...(user.app_metadata || {}), claimed_checkouts: kept },
  })
  return error || null
}
