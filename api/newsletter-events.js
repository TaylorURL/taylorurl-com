/**
 * newsletter-events — what Resend reports back about a message after it left.
 *
 * The send itself learns one thing: that Resend accepted the message. Every
 * fact worth having after that - whether it was delivered, whether it was
 * opened, whether a link was followed, whether the address bounced, whether
 * somebody marked it as spam - arrives here, minutes or days later, on a
 * webhook. Each event names the message by Resend's own id, which is why the
 * send stores that id: without it an event names a message nothing can find.
 *
 * A bounce and a complaint are the two that matter beyond a figure. Both
 * suppress the address, which holds it off every list rather than only this
 * one, and a complaint also marks the subscriber, because somebody who called
 * a letter spam is not a lapsed reader to be won back.
 *
 * Two doors, and one of them is enough. A shared secret on the URL is the one
 * this codebase already uses for the scheduler, and a Svix signature over the
 * exact bytes of the body is the one Resend offers. Either satisfies the
 * endpoint; neither is optional in the sense that a request carrying neither
 * is refused.
 *
 * Every event is written idempotently. A webhook is delivered at least once,
 * so a repeated delivery must not move a count: the first timestamp is kept
 * where it stands, and a repeat of an event already recorded for that message
 * is answered without writing.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gujgtjqqurildqurpffh.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const SHARED_SECRET = process.env.NEWSLETTER_WEBHOOK_SECRET || ''
const SIGNING_SECRET = process.env.RESEND_WEBHOOK_SECRET || ''

// The body is read as bytes rather than as an object, because a signature is
// over what was sent and not over what a parser made of it.
export const config = { api: { bodyParser: false } }

/** Two strings compared without the comparison itself saying how far it got. */
function same(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Whether the signature Resend sent matches the body that arrived.
 *
 * Svix signs `id.timestamp.body` with the secret that follows `whsec_`, base64
 * decoded, and sends one or more candidate signatures because a secret can be
 * rotated with both live. Any one of them matching is a match.
 */
export function signed(headers, body, secret = SIGNING_SECRET) {
  if (!secret || !body) return false
  const id = headers['svix-id']
  const stamp = headers['svix-timestamp']
  const offered = headers['svix-signature']
  if (!id || !stamp || !offered) return false

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${stamp}.${body}`).digest('base64')
  return String(offered)
    .split(' ')
    .some(entry => {
      const [version, value] = entry.split(',')
      return version === 'v1' && value && same(value, expected)
    })
}

/** The raw bytes of the request, read straight off the stream. */
async function rawBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * The message the event is about.
 *
 * Not every message Resend sends has a row here: a signup confirmation goes out
 * through the same account and belongs to no issue. Such an event still carries
 * an address, which is enough to suppress a bounce or a complaint, so a missing
 * row is a narrower answer rather than a refusal.
 */
async function sendFor(db, providerId) {
  if (!providerId) return null
  const { data, error } = await db
    .from('newsletter_sends')
    .select(
      'id, subscriber_id, opened_at, open_count, clicked_at, click_count, ' +
        'delivered_at, bounced_at, complained_at'
    )
    .eq('provider_id', providerId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Holds an address off every list, keeping whatever reason it already carries. */
async function suppress(db, email, reason, note) {
  if (!email) return
  const { error } = await db
    .from('suppression')
    .upsert({ email, reason, note }, { onConflict: 'email', ignoreDuplicates: true })
  if (error) console.error('newsletter-events suppress: %s', error.message)
}

/**
 * What one event changes.
 *
 * A first timestamp is written once and never moved, since what it answers is
 * when a thing first happened. The latest one and the count move on every
 * event, which is what separates a message glanced at from one returned to.
 */
export async function apply(db, event) {
  const type = String(event?.type || '')
  const data = event?.data || {}
  const at = event?.created_at ? new Date(event.created_at).toISOString() : new Date().toISOString()
  const email = String(data.to?.[0] || data.email || '').toLowerCase() || null

  const message = await sendFor(db, data.email_id)
  const patch = {}

  if (type === 'email.delivered') {
    if (message?.delivered_at) return 'repeat'
    patch.delivered_at = at
  } else if (type === 'email.opened') {
    patch.opened_at = message?.opened_at ?? at
    patch.last_open_at = at
    patch.open_count = (message?.open_count ?? 0) + 1
  } else if (type === 'email.clicked') {
    patch.clicked_at = message?.clicked_at ?? at
    patch.last_click_at = at
    patch.click_count = (message?.click_count ?? 0) + 1
  } else if (type === 'email.bounced') {
    patch.bounced_at = message?.bounced_at ?? at
    await markSubscriber(db, email, {
      status: 'bounced',
      last_bounce_at: at,
      bump: 'bounce_count',
    })
    await suppress(db, email, 'bounced', `newsletter: ${data.bounce?.subType || 'bounce'}`)
  } else if (type === 'email.complained') {
    patch.complained_at = message?.complained_at ?? at
    await markSubscriber(db, email, { status: 'complained', complained_at: at })
    await suppress(db, email, 'complained', 'newsletter: marked as spam')
  } else {
    // email.sent and email.delivery_delayed say nothing the send row does not
    // already hold, and an event this endpoint does not know is not a fault.
    return 'ignored'
  }

  if (!message) return 'unmatched'
  const { error } = await db.from('newsletter_sends').update(patch).eq('id', message.id)
  if (error) throw new Error(error.message)
  return 'recorded'
}

/**
 * Moves the subscriber the event is about.
 *
 * An address that already unsubscribed or complained keeps that standing: both
 * are a person's own decision, and a later bounce is a fact about a mailbox
 * rather than a reason to overwrite one.
 */
async function markSubscriber(db, email, { status, last_bounce_at, complained_at, bump }) {
  if (!email) return
  const { data: person, error } = await db
    .from('subscribers')
    .select('id, status, bounce_count')
    .eq('email', email)
    .maybeSingle()
  if (error || !person) return
  if (person.status === 'unsubscribed' || person.status === 'complained') return

  const patch = { status }
  if (last_bounce_at) patch.last_bounce_at = last_bounce_at
  if (complained_at) patch.complained_at = complained_at
  if (bump === 'bounce_count') patch.bounce_count = (person.bounce_count ?? 0) + 1

  const written = await db.from('subscribers').update(patch).eq('id', person.id)
  if (written.error) console.error('newsletter-events subscriber: %s', written.error.message)
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'POST only' })
    return
  }
  response.setHeader('Cache-Control', 'private, no-store')

  if (!SERVICE_KEY) {
    response.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set' })
    return
  }

  const body = await rawBody(request)
  const key = typeof request.query?.key === 'string' ? request.query.key : ''
  const bySecret = Boolean(SHARED_SECRET) && same(key, SHARED_SECRET)
  if (!bySecret && !signed(request.headers, body)) {
    response.status(401).json({ error: 'not authorized' })
    return
  }

  let event = null
  try {
    event = JSON.parse(body)
  } catch {
    response.status(400).json({ error: 'body is not JSON' })
    return
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
    global: {
      fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(8000) }),
    },
  })

  try {
    const outcome = await apply(db, event)
    response.status(200).json({ ok: true, outcome })
  } catch (cause) {
    console.error('newsletter-events: %s', cause.message)
    // A 500 is what makes Resend try again, which is what a transient database
    // fault deserves. An event that simply matched nothing answers 200 above.
    response.status(500).json({ error: 'the event was not recorded' })
  }
}
