/**
 * open — a message's own image being fetched, counted as the message being read.
 *
 * Plain SMTP reports nothing back. The mail server accepts an envelope and
 * that is the last the sender hears, so an open is inferred from the one thing
 * a reader's mail client does on its own: fetch the pictures.
 *
 * A scored message carries a capture of the business's own home page, stored
 * under the prospect's id, so that fetch identifies exactly who is reading.
 * This endpoint stands in front of the capture, records the fetch, and hands
 * the reader on to it. A message with no capture - a business whose listing
 * points only at somebody else's platform - carries a transparent square
 * instead, so the count covers every message rather than most of them.
 *
 * Like unsubscribe, this stands outside the door in lib/outreach/runtime.js: a
 * mail client carries no session and no scheduler secret. The token stands in
 * for both. It belongs to one message rather than to a prospect, it is checked
 * against the shape of a UUID before it reaches the database, and it is not the
 * unsubscribe token - a token travelling inside an image source must not be one
 * that can take somebody off a list.
 *
 * What the figure is worth, said plainly because a number trusted too far is
 * worse than none: an open is a lower bound and a noisy one. Apple's Mail
 * Privacy Protection fetches images before a person sees the message, so some
 * opens here belong to a machine. Gmail proxies the fetch and caches it, so a
 * business reading the same message on Monday and again on Thursday may be
 * counted once. A reader with images switched off is never counted at all.
 * First and last are kept beside the count for that reason: what a run of opens
 * across several days says about a business is worth more than the total.
 */

import { servedHereOr404 } from '../../lib/http/guard.js'
import { connect } from '../../lib/db/clients.js'
import { UUID_PATTERN } from '../../lib/db/fields.js'
import { shotUrl } from '../../lib/outreach/audit/shot.js'

// A transparent GIF, one pixel each way, for a message that carries no capture
// of its own. It is the smallest thing a mail client will fetch and draw.
const BLANK = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

/**
 * Records the open and says where the reader should be sent.
 *
 * The first open is kept as well as the latest, because the two answer
 * different questions: whether the message landed, and whether it is still
 * being looked at. Neither overwrites the other.
 *
 * A token that matches nothing is served the square in silence. Answering
 * differently would tell whoever tried it what a real token does.
 *
 * @returns {Promise<string|null>} The image to hand on to, or null for the blank.
 */
async function record(db, token) {
  const { data: message, error } = await db
    .from('outreach_messages')
    .select('id, prospect_id, direction, opened_at, open_count')
    .eq('track_token', token)
    .maybeSingle()
  if (error || !message || message.direction !== 'outbound') return null

  const now = new Date().toISOString()
  const written = await db
    .from('outreach_messages')
    .update({
      opened_at: message.opened_at ?? now,
      last_open_at: now,
      open_count: (message.open_count ?? 0) + 1,
    })
    .eq('id', message.id)
  if (written.error) console.error('outreach open: %s', written.error.message)

  const { data: prospect } = await db
    .from('outreach_prospects')
    .select('site_kind, website')
    .eq('id', message.prospect_id)
    .maybeSingle()

  // A business with no site of its own is never captured, so there is nothing
  // to hand the reader on to and the square is the whole answer.
  if (!prospect || prospect.site_kind === 'social' || !prospect.website) return null
  return shotUrl(db, message.prospect_id)
}

/** The one-pixel square. */
function blank(response) {
  response.setHeader('Content-Type', 'image/gif')
  response.setHeader('Content-Length', String(BLANK.length))
  response.status(200).send(BLANK)
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD')
    response.status(405).json({ error: 'GET or HEAD only' })
    return
  }

  // Every hop is told not to keep this. A cached answer is an open that
  // happened and was never counted, which is the one failure that looks exactly
  // like a message nobody read.
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  response.setHeader('Pragma', 'no-cache')
  response.setHeader('Expires', '0')

  const token = typeof request.query?.t === 'string' ? request.query.t.trim() : ''
  if (!UUID_PATTERN.test(token)) {
    blank(response)
    return
  }

  const connected = connect()
  if (!connected) {
    blank(response)
    return
  }

  let onward = null
  try {
    onward = await record(connected.db, token)
  } catch (cause) {
    console.error('outreach open: %s', cause.message)
  }

  // The capture is handed over by redirect rather than proxied through here. A
  // proxy puts a function in front of every picture in every message and pays
  // for the bytes twice; the redirect costs one small answer and leaves the
  // storage CDN to do what it is for.
  if (onward) {
    response.redirect(302, onward)
    return
  }
  blank(response)
}
