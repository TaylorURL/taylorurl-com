/**
 * The one-use key a buyer carries back from Stripe.
 *
 * A payment opens an account, and the buyer is signed into it the moment they
 * land back on the site. Something in that redirect has to prove they are the
 * person who just paid, and the obvious candidate is the wrong one: the
 * checkout session id is not a secret. It rides back in the address bar, gets
 * copied into support threads and sits in browser history, and
 * `api/checkout-claim.js` answers an address to anyone holding it on purpose.
 * A session id that also minted a signed-in session would turn every one of
 * those places into a way into somebody's console.
 *
 * So the key is minted here, when the checkout is opened, and it is a secret
 * from the start. The buyer's redirect carries the token; Stripe carries only
 * its hash, on the session's own metadata, where nothing but our secret key can
 * read it. Holding the session id proves nothing. Holding the token proves the
 * holder was handed the redirect that completing this checkout produced.
 *
 * Three things keep the token from outliving that moment: it is spent on first
 * use, it expires with the window below, and the screen it lands on takes it
 * out of the address bar as soon as it has been read.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** The query key the token rides back under. */
const CLAIM_PARAM = 'claim'

/**
 * How long a key is good for, counted from the checkout being opened.
 *
 * The buyer normally spends it seconds after paying, so this is not the
 * ordinary case - it is the tab closed on the Stripe page and reopened from
 * history that evening. A day is long enough for that and short enough that a
 * URL found in history a month later opens nothing. Past it the account is
 * still theirs and still waiting; what they use is the password reset every
 * other account uses.
 */
const CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000

/** A key, and the hash of it that goes to Stripe. */
export function mintClaim() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashClaim(token) }
}

/** The hash a token is recognised by. */
function hashClaim(token) {
  return createHash('sha256')
    .update(String(token || ''))
    .digest('hex')
}

/**
 * Whether an offered token is the one this checkout was opened with.
 *
 * Compared as fixed-width digests rather than as the tokens themselves, so a
 * near miss and a wild guess take the same time to refuse.
 *
 * @param {string} held The hash written on the Stripe session.
 * @param {string} offered The token presented by the browser.
 */
export function claimHolds(held, offered) {
  if (typeof held !== 'string' || held.length !== 64) return false
  if (typeof offered !== 'string' || !offered) return false
  const wanted = Buffer.from(held, 'utf8')
  const got = Buffer.from(hashClaim(offered), 'utf8')
  return got.length === wanted.length && timingSafeEqual(got, wanted)
}

/** Whether a checkout is still inside the window its key is good for. */
export function withinClaimWindow(createdSeconds, now = Date.now()) {
  const opened = Number(createdSeconds)
  if (!Number.isFinite(opened)) return false
  return now - opened * 1000 <= CLAIM_WINDOW_MS
}

/**
 * Where a paid checkout returns to, with the key on it.
 *
 * Both endpoints that open a checkout use this, so a buyer handed a link by
 * hand lands exactly where a buyer off the pricing page lands. Stripe fills the
 * session template in on the way back.
 */
export function claimReturnUrl(siteUrl, token) {
  return `${siteUrl}/welcome?session_id={CHECKOUT_SESSION_ID}&${CLAIM_PARAM}=${token}`
}
