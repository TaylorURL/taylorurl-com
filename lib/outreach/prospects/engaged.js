/**
 * The businesses that answered the mail, which the Call List rings first: one
 * that opened what the studio sent more than once, or wrote back.
 *
 * An open is the picture in a message being fetched (api/outreach/open.js),
 * and most first fetches are not a person. A mail system's scanner or a
 * provider's image proxy fetches a message's pictures the moment it lands. On
 * the live table on 2026-11-04, 109 of the 142 opened messages were first
 * fetched within a minute of the send, and 110 were never fetched again after
 * the first ten minutes. So a fetch that close to the
 * send is the machine's and is not counted, and what is left is somebody
 * coming back to the message: a run of opens hours or days after it went out.
 * Only the first and the latest fetch of each message are kept beside the
 * count, so the reading is per message: a message whose latest fetch was
 * still inside the window was only ever read by machines; one whose first was
 * inside it and latest was not lost one fetch to the machine; one first
 * fetched after it is all person.
 *
 * A reply is a person by the time it is a reply - the mailbox reader takes out
 * the opt-outs and the auto-responders - but its reader does not know every
 * auto-responder's wording, and the ones it missed are the replies on the
 * table. `looksAutomatic` is the second look, held to the call list: a
 * business is only rung first for a reply a person typed.
 *
 * Strings and pure functions only, since the console page imports it.
 */

/** How long after a send a fetch of the message's picture is the mail system's, not a person's. */
export const MACHINE_WINDOW_MS = 10 * 60 * 1000

/** Opens by a person, across every message to a business, that put it at the top. */
export const OPENS_TO_CALL = 2

/** How far back an open still says a business is worth ringing first. */
export const OPEN_LOOKBACK_DAYS = 30

/** How much of a reply the card draws. */
export const REPLY_SHOWN = 400

/**
 * What an auto-responder says that a person writing back does not: the
 * after-hours notices, the "we have received your email", the help desks.
 * Any one of these is enough.
 */
const AUTOMATIC = [
  /\byou(?:'|’)?ve reached\b|\byou have reached\b/i,
  /\bafter[- ]hours\b/i,
  /\bwe(?: have|(?:'|’)ve) received your (?:e-?mail|message|inquiry|request)\b/i,
  /\bthank you for choosing\b/i,
  /\btype your reply above this line\b/i,
  /\bout of (?:the )?office\b/i,
  /\bthis (?:mailbox|inbox|address) is (?:not monitored|unattended)\b/i,
  /\bdo not reply to this (?:e-?mail|message)\b/i,
  /\bthis is an automated\b/i,
]

/**
 * What an auto-responder says that a person might also say. "Thanks for
 * reaching out" opens plenty of real answers, so these count only in pairs.
 */
const AUTOMATIC_TOGETHER = [
  /\bthank(?:s| you) (?:so much )?for (?:contacting|reaching out)\b/i,
  /\b(?:get back to you|respond to you|reply to you) (?:as soon as possible|shortly|within)\b/i,
  /\b(?:during|outside(?: of)?|normal|regular) business hours\b/i,
]

/** Whether a reply reads as a machine's rather than a person's. */
export function looksAutomatic(subject, body) {
  const text = `${subject ?? ''}\n${body ?? ''}`
  if (AUTOMATIC.some(pattern => pattern.test(text))) return true
  return AUTOMATIC_TOGETHER.filter(pattern => pattern.test(text)).length >= 2
}

/** An instant read as a number, or NaN. */
const instant = value => Date.parse(value ?? '')

/**
 * How many times a person opened one message, out of the fetches counted on it.
 *
 * @param {{sent_at?: string|null, opened_at?: string|null, last_open_at?: string|null,
 *   open_count?: number|null}} message A row of `outreach_messages`.
 */
export function personOpens(message) {
  const count = Math.max(0, Math.round(Number(message?.open_count) || 0))
  if (!count) return 0
  const sent = instant(message?.sent_at)
  if (!Number.isFinite(sent)) return count
  const early = at => Number.isFinite(at) && at - sent <= MACHINE_WINDOW_MS
  if (early(instant(message?.last_open_at ?? message?.opened_at))) return 0
  if (early(instant(message?.opened_at))) return Math.max(1, count - 1)
  return count
}

/** The later of two instants, either of which may be missing. */
function later(one, two) {
  if (!one) return two ?? null
  if (!two) return one
  return instant(two) > instant(one) ? two : one
}

/** A reply's own words, cut to what the card draws. */
function excerpt(text) {
  const said = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!said) return null
  return said.length > REPLY_SHOWN ? `${said.slice(0, REPLY_SHOWN - 1).trimEnd()}…` : said
}

/**
 * What a business's mail says about it, or null where nothing says to ring it
 * first.
 *
 * `at` is the latest of the reasons - the reply, or the last time a person
 * opened something - and a call made after it has dealt with them.
 *
 * @param {{messages?: object[], repliedAt?: string|null, reply?: string|null}} mail
 *   Its outbound messages, and when it wrote back and what it said, where it did.
 * @returns {{opens: number, last_open_at: string|null, replied_at: string|null,
 *   reply: string|null, at: string}|null}
 */
export function engagementOf({ messages = [], repliedAt = null, reply = null } = {}) {
  let opens = 0
  let lastOpen = null
  for (const message of messages) {
    const counted = personOpens(message)
    if (!counted) continue
    opens += counted
    lastOpen = later(lastOpen, message.last_open_at ?? message.opened_at ?? null)
  }
  const opened = opens >= OPENS_TO_CALL
  if (!repliedAt && !opened) return null
  return {
    opens,
    last_open_at: opened ? lastOpen : null,
    replied_at: repliedAt ?? null,
    reply: repliedAt ? excerpt(reply) : null,
    at: later(repliedAt ?? null, opened ? lastOpen : null),
  }
}

/** Replies first, the newest first; then the openers, the most recent first. */
export function byEngagement(one, two) {
  const a = one?.engaged ?? one
  const b = two?.engaged ?? two
  if (Boolean(a?.replied_at) !== Boolean(b?.replied_at)) return a?.replied_at ? -1 : 1
  return instant(b?.at) - instant(a?.at)
}

/**
 * What the list says about it, before the date the page adds: "Replied to your
 * email", "Opened your emails 4 times", or both.
 */
export function engagedWords(engaged) {
  if (!engaged) return null
  const opened = engaged.opens >= OPENS_TO_CALL ? `opened your emails ${engaged.opens} times` : null
  if (engaged.replied_at) return opened ? `Replied and ${opened}` : 'Replied to your email'
  return opened ? opened[0].toUpperCase() + opened.slice(1) : null
}
