/**
 * The address one paid checkout was made with, and nothing else about it.
 *
 * A build is attached to the account whose email matches the one the payment
 * carried. That match is exact, so a buyer who pays from a personal address
 * and signs up from a work one lands in a console with no build in it, and
 * until now had no way of finding out why. The signup screen fills the address
 * in from here, which turns the commonest way to lose a paid build into a
 * field somebody would have to deliberately overwrite.
 *
 * What comes back is what the screen fills in and nothing else: the address,
 * the name on the card, and the business the checkout was opened for. The
 * session also holds the amount, the card's country, the customer id and the
 * payment intent, none of which that screen has any use for, and all of which
 * would then be readable by anybody holding the id. A session id is not a
 * secret - it rides back in the address bar, gets copied into support threads
 * and sits in browser history - so this answers as though it were public,
 * because it is.
 *
 * The three it does answer with are held to that same standard. They are the
 * buyer's own name, address and business, they are what that buyer is about to
 * type into the form this feeds, and none of them is a credential or reveals
 * anything about the purchase. What is deliberately still absent is every
 * figure: what a build sold for is nobody's business but ours and the buyer's,
 * and a quoted price readable from a URL is a quoted price a second prospect
 * can read.
 *
 * An unpaid session answers as though it did not exist. Opening a checkout
 * costs nothing and abandoning one is normal, so the id of an abandoned
 * session is easy to come by and must not read back an address.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'

const STRIPE_ENDPOINT = 'https://api.stripe.com/v1/checkout/sessions'
const SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''

const TIMEOUT_MS = 10000

// Stripe's own ids for a checkout session. Tested before the id is put in a
// URL so a crafted value cannot reach for another of Stripe's endpoints by
// carrying a slash.
const SESSION_ID = /^cs_[A-Za-z0-9_]{10,255}$/

// What one caller may ask in a window. A buyer arriving from Stripe asks once,
// and a second tab or a refresh asks a handful of times; anything past this is
// somebody working through ids rather than reading their own receipt. Counted
// by connection rather than by session id, since the id is the thing being
// guessed.
const lookupWindow = callerWindow({ limit: 20, windowMs: 10 * 60 * 1000 })

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed.' })
  }
  if (!SECRET_KEY) return response.status(503).json({ error: 'Not available right now.' })

  const id = typeof request.query?.session === 'string' ? request.query.session.trim() : ''
  if (!SESSION_ID.test(id)) return response.status(400).json({ error: 'Which checkout?' })

  if (!lookupWindow.allows(callerAddress(request))) {
    return response.status(429).json({ error: 'Too many attempts. Try again shortly.' })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const read = await fetch(`${STRIPE_ENDPOINT}/${id}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${SECRET_KEY}` },
    })
    const session = await read.json()

    // A refusal from Stripe and a session that was never paid are the same
    // answer on purpose: neither says whether the id was real.
    if (!read.ok || session?.payment_status !== 'paid') {
      return response.status(404).json({ error: 'No paid checkout under that reference.' })
    }

    // Capped rather than passed through. These are drawn on a screen and put
    // into form fields, and a length nobody chose is a length that decides the
    // layout for us.
    const held = value =>
      typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : null

    response.setHeader('Cache-Control', 'no-store')
    return response.status(200).json({
      email: session?.customer_details?.email || session?.customer_email || null,
      name: held(session?.customer_details?.name),
      business: held(session?.metadata?.business_name),
    })
  } catch (error) {
    console.error(
      `checkout-session: ${error?.name === 'AbortError' ? 'Stripe timed out' : 'Stripe unreachable'}`
    )
    return response.status(502).json({ error: 'That could not be read.' })
  } finally {
    clearTimeout(timer)
  }
}
