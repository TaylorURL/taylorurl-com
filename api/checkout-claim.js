/**
 * Where a paid checkout becomes a signed-in buyer.
 *
 * Nobody signs up for this site. A build is bought, the account comes with it,
 * and the browser coming back from Stripe is handed the way into it - so the
 * screen after a payment asks for nothing and the console is already open by
 * the time the buyer has read the first line of it.
 *
 * Two different things are answered here, and they are held to two different
 * standards.
 *
 * The first is who paid: the address, the name on the card and the business the
 * checkout was opened for. That is answered to anyone presenting the id of a
 * paid session, because the id is not a secret - it rides back in the address
 * bar, gets copied into support threads and sits in browser history - and the
 * three fields are the buyer's own, are what the screen names back to them, and
 * say nothing about the purchase. Every figure is deliberately absent: what a
 * build sold for is nobody's business but ours and the buyer's, and a quoted
 * price readable from a URL is a quoted price a second prospect can read. An
 * unpaid session answers as though it did not exist, since opening a checkout
 * costs nothing and abandoning one is normal.
 *
 * The second is a session on the account, and that is answered only to the one
 * browser the redirect went to. What proves it is the key minted when the
 * checkout was opened: the token went out in the success address and nothing
 * but its hash was left on the Stripe session, so the session id alone opens
 * nothing. The key is spent on first use and expires with its window, and the
 * screen takes it out of the address bar as soon as it has been read.
 *
 * A refusal of the second is not a refusal of the first. Everything that can go
 * wrong here - a key already spent, a window gone by, Supabase unreachable -
 * happens to somebody who has just paid, and the screen has to be able to name
 * the address their build is waiting under whichever way it went.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'
import { connect } from '../lib/db/clients.js'
import { openBuyerAccount, claimSpent, spendClaim } from '../lib/auth/buyer.js'
import { claimHolds, withinClaimWindow } from '../lib/stripe/claim.js'
import { buyerEmail, readSession } from '../lib/stripe/session.js'

const SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''

// Stripe's own ids for a checkout session. Tested before the id is put in a
// URL so a crafted value cannot reach for another of Stripe's endpoints by
// carrying a slash.
const SESSION_ID = /^cs_[A-Za-z0-9_]{10,255}$/

// What one caller may ask in a window. A buyer arriving from Stripe asks once,
// and a second tab or a refresh asks a handful of times; anything past this is
// somebody working through ids rather than reading their own receipt. Counted
// by connection rather than by session id, since the id is the thing being
// guessed.
const claimWindow = callerWindow({ limit: 20, windowMs: 10 * 60 * 1000 })

// Capped rather than passed through. These are drawn on a screen, and a length
// nobody chose is a length that decides the layout for us.
const held = value =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : null

/**
 * One paid session, or null.
 *
 * A refusal from Stripe and a session that was never paid come back the same
 * way on purpose: neither says whether the id was real.
 */
async function paidSession(id) {
  const { answer: read, session } = await readSession(id, SECRET_KEY)
  if (!read.ok || session?.payment_status !== 'paid') return null
  return session
}

/**
 * A way into the account that paid, where the key presented earns one.
 *
 * The token is minted before the account is asked whether this key has been
 * spent, because minting is what hands back the account to ask. A key that has
 * been spent therefore mints a token that is discarded here and never leaves
 * the function, which costs a replay one wasted round trip and costs a buyer
 * nothing.
 *
 * @returns {Promise<{token: string, type: string}|null>}
 */
async function wayIn(db, session, email) {
  const opened = await openBuyerAccount(db, { email, name: held(session?.customer_details?.name) })
  if (opened.error) {
    console.error('checkout-claim: the account was not opened', opened.error.message)
    return null
  }

  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data?.properties?.hashed_token || !data?.user) {
    console.error('checkout-claim: no way in was minted', error?.message || 'nothing came back')
    return null
  }

  if (claimSpent(data.user, session.id)) return null

  const spent = await spendClaim(db, data.user, session.id)
  if (spent) {
    // A key that could not be marked spent is a key that would work twice, and
    // a second sign-in from a URL in somebody's history is the whole thing this
    // guards. Refusing costs the buyer a password reset; not refusing costs
    // them the account.
    console.error('checkout-claim: the key was not spent', spent.message)
    return null
  }

  return {
    token: data.properties.hashed_token,
    type: data.properties.verification_type || 'magiclink',
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed.' })
  }
  if (!SECRET_KEY) return response.status(503).json({ error: 'Not available right now.' })

  const payload = request.body || {}
  const id = typeof payload.session === 'string' ? payload.session.trim() : ''
  if (!SESSION_ID.test(id)) return response.status(400).json({ error: 'Which checkout?' })

  if (!claimWindow.allows(callerAddress(request))) {
    return response.status(429).json({ error: 'Too many attempts. Try again shortly.' })
  }

  let session
  try {
    session = await paidSession(id)
  } catch (error) {
    console.error(
      `checkout-claim: ${error?.name === 'AbortError' ? 'Stripe timed out' : 'Stripe unreachable'}`
    )
    return response.status(502).json({ error: 'That could not be read.' })
  }

  if (!session)
    return response.status(404).json({ error: 'No paid checkout under that reference.' })

  const email = buyerEmail(session)
  if (!email) {
    console.error('checkout-claim: a paid session carried no address')
    return response.status(404).json({ error: 'No paid checkout under that reference.' })
  }

  const buyer = {
    email,
    name: held(session?.customer_details?.name),
    business: held(session?.metadata?.business_name),
  }

  response.setHeader('Cache-Control', 'no-store')

  // The two cheap guards first, so a replayed URL is refused without an account
  // being touched at all.
  const offered = typeof payload.claim === 'string' ? payload.claim.trim() : ''
  const earned =
    claimHolds(session?.metadata?.claim, offered) && withinClaimWindow(session?.created)
  if (!earned) return response.status(200).json(buyer)

  const connected = connect()
  if (!connected) {
    console.error('checkout-claim: no database keys, nobody was signed in')
    return response.status(200).json(buyer)
  }

  const way = await wayIn(connected.db, session, email)
  return response.status(200).json(way ? { ...buyer, ...way } : buyer)
}
