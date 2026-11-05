/**
 * The businesses that answered the mail, which the Call List rings first: one
 * that opened what the studio sent more than once, followed the link to its
 * preview site, or wrote back.
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
 * A visit to the preview site is a person far more surely than an open. The
 * page's tracker waits for a few seconds on screen before it files a visit
 * (/api/preview-events, `preview_sessions`), and a visit from a mail
 * scanner's network or an automated browser is dropped before it reaches the
 * table. What gets past both is a link checker on a network nobody has named
 * yet, and it comes the moment the letter lands: on the live table on
 * 2026-11-05 the three visits that were not a person began 8, 28 and 32
 * seconds after a send, and the earliest person came ten minutes after one.
 * So a visit begun inside two minutes of any letter to the business is the
 * machine's, and every other one counts.
 *
 * A business on its preview site opened the mail and followed the link, so
 * one visit is enough to put it on the list, and what it did there orders it:
 * every visit, every minute, every page past the first, how far down it read,
 * what it clicked, and above all a tap on Make It Yours (`SITE_POINTS`). The
 * replies still lead; under them, and among them, the more a business did on
 * its site the higher it sits, and a business that only opened comes after
 * every one that looked.
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

/** How long after a send a visit to the preview site is a link checker's, not a person's. */
export const SITE_MACHINE_WINDOW_MS = 2 * 60 * 1000

/**
 * What each thing a person does on the preview site is worth to the order.
 * A scroll is worth its point for reading the page to the foot, and part of
 * one for part of the way. The buttons are the business's own Call, Email
 * and booking buttons, tried out on its new site.
 */
export const SITE_POINTS = {
  visit: 2,
  minute: 1,
  page: 1,
  scroll: 1,
  click: 0.5,
  button: 2,
  claim: 20,
  submit: 5,
}

/** Minutes of one visit past which the tab was left open rather than read. */
export const VISIT_MINUTES_MAX = 10

/** The button along the top of every preview that asks for the site. */
export const CLAIM_LABEL = 'Make It Yours'

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

/** A count off a row, as a whole number not below nothing. */
const whole = value => Math.max(0, Math.round(Number(value) || 0))

/**
 * The test a visit's start is put to: true where it began inside two minutes
 * of a letter to the business, which is a link checker rather than a person.
 * The Call List and the preview funnel (lib/outreach/funnel.js) both ask it,
 * so the two never disagree about who has been on a site.
 *
 * @param {Array<string|null>} sends When each letter to the business went.
 * @returns {(began: number) => boolean}
 */
export function tooSoonAfter(sends = []) {
  const sent = sends.map(instant).filter(Number.isFinite)
  return began => sent.some(one => began >= one && began - one <= SITE_MACHINE_WINDOW_MS)
}

/**
 * How long one visit was on screen, in milliseconds: what the page said, or,
 * where the visit has not ended yet and the page has not said, the time
 * between its first and its latest batch.
 */
export function visitMs(session) {
  const began = instant(session?.started_at)
  const seen = instant(session?.last_seen_at)
  return (
    whole(session?.active_ms) ||
    (Number.isFinite(seen) && Number.isFinite(began) ? Math.max(0, seen - began) : 0)
  )
}

/**
 * What a person did on the business's preview site, read across its visits,
 * or null where no person has been on it.
 *
 * A visit's time is the time the page says it was on screen, and where the
 * visit has not ended yet, so the page has not said, the time between its
 * first and its latest batch.
 *
 * @param {Array<{started_at: string, last_seen_at?: string|null, pages?: number,
 *   active_ms?: number, max_scroll?: number, clicks?: number, calls?: number,
 *   emails?: number, ctas?: number, form_submits?: number, claims?: number}>} sessions
 *   Rows of `preview_sessions`, each with `claims`, its taps on Make It Yours.
 * @param {Array<string|null>} sends When each letter to the business went.
 * @returns {{visits: number, minutes: number, pages: number, scroll: number,
 *   clicks: number, buttons: number, claimed: boolean, submitted: boolean,
 *   last_visit_at: string, points: number}|null} `clicks` are the ones on
 *   anything but a button, which `buttons` and `claimed` say apart.
 */
export function siteActivity(sessions = [], sends = []) {
  const machine = tooSoonAfter(sends)
  const site = {
    visits: 0,
    minutes: 0,
    pages: 0,
    scroll: 0,
    clicks: 0,
    buttons: 0,
    claims: 0,
    submits: 0,
    last: null,
    points: 0,
  }
  for (const session of sessions) {
    const began = instant(session?.started_at)
    if (!Number.isFinite(began) || machine(began)) continue
    const minutes = visitMs(session) / 60_000
    const pages = Math.max(1, whole(session.pages))
    const scroll = Math.min(100, whole(session.max_scroll))
    const clicks = whole(session.clicks)
    const claims = whole(session.claims)
    const buttons =
      whole(session.calls) + whole(session.emails) + Math.max(0, whole(session.ctas) - claims)
    const submits = whole(session.form_submits)

    site.visits += 1
    site.minutes += minutes
    site.pages += pages
    site.scroll = Math.max(site.scroll, scroll)
    site.clicks += clicks
    site.buttons += buttons
    site.claims += claims
    site.submits += submits
    site.last = later(site.last, session.last_seen_at ?? session.started_at)
    site.points +=
      SITE_POINTS.visit +
      SITE_POINTS.minute * Math.min(minutes, VISIT_MINUTES_MAX) +
      SITE_POINTS.page * (pages - 1) +
      (SITE_POINTS.scroll * scroll) / 100 +
      SITE_POINTS.click * clicks +
      SITE_POINTS.button * buttons +
      SITE_POINTS.claim * claims +
      SITE_POINTS.submit * submits
  }
  if (!site.visits) return null
  return {
    visits: site.visits,
    minutes: Math.round(site.minutes * 10) / 10,
    pages: site.pages,
    scroll: site.scroll,
    clicks: Math.max(0, site.clicks - site.buttons - site.claims),
    buttons: site.buttons,
    claimed: site.claims > 0,
    submitted: site.submits > 0,
    last_visit_at: site.last,
    points: Math.round(site.points * 10) / 10,
  }
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
 * `at` is the latest of the reasons - the reply, the last time a person
 * opened something, or the last time one was on the preview site - and a call
 * made after it has dealt with them.
 *
 * @param {{messages?: object[], repliedAt?: string|null, reply?: string|null,
 *   site?: object|null}} mail Its outbound messages, when it wrote back and
 *   what it said, where it did, and what it did on its preview site
 *   (`siteActivity`).
 * @returns {{opens: number, last_open_at: string|null, replied_at: string|null,
 *   reply: string|null, site: object|null, at: string}|null}
 */
export function engagementOf({ messages = [], repliedAt = null, reply = null, site = null } = {}) {
  let opens = 0
  let lastOpen = null
  for (const message of messages) {
    const counted = personOpens(message)
    if (!counted) continue
    opens += counted
    lastOpen = later(lastOpen, message.last_open_at ?? message.opened_at ?? null)
  }
  const opened = opens >= OPENS_TO_CALL
  const visited = site?.visits > 0 ? site : null
  if (!repliedAt && !opened && !visited) return null
  return {
    opens,
    last_open_at: opened ? lastOpen : null,
    replied_at: repliedAt ?? null,
    reply: repliedAt ? excerpt(reply) : null,
    site: visited,
    at: later(later(repliedAt ?? null, opened ? lastOpen : null), visited?.last_visit_at ?? null),
  }
}

/**
 * Replies first; then, within the replies and under them, the more a business
 * did on its preview site the higher it sits, so a business that only opened
 * comes after every one that looked; and the most recent first after that.
 */
export function byEngagement(one, two) {
  const a = one?.engaged ?? one
  const b = two?.engaged ?? two
  if (Boolean(a?.replied_at) !== Boolean(b?.replied_at)) return a?.replied_at ? -1 : 1
  const looked = (b?.site?.points ?? 0) - (a?.site?.points ?? 0)
  if (looked) return looked
  return instant(b?.at) - instant(a?.at)
}

/** Words joined the way a person lists them: "a", "a and b", "a, b and c". */
function listed(parts) {
  if (parts.length < 2) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/** A count said as a person says it: "once" is a visit, otherwise "3 times". */
const times = count => (count === 1 ? '' : ` ${count} times`)

/**
 * What the list says about it, before the date the page adds: "Replied to your
 * email", "Opened your emails 4 times", "Opened your email and visited the
 * preview site 2 times", or any of them together.
 *
 * A business on its preview site followed the link in a letter, so it opened
 * that letter, whether or not its mail let the picture load.
 */
export function engagedWords(engaged) {
  if (!engaged) return null
  const parts = []
  const site = engaged.site?.visits > 0 ? engaged.site : null
  const opened = engaged.opens >= OPENS_TO_CALL
  if (engaged.replied_at) parts.push(opened || site ? 'replied' : 'replied to your email')
  if (opened) parts.push(`opened your emails ${engaged.opens} times`)
  else if (site && !engaged.replied_at) parts.push('opened your email')
  if (site) parts.push(`visited the preview site${times(site.visits)}`)
  if (!parts.length) return null
  const said = listed(parts)
  return said[0].toUpperCase() + said.slice(1)
}

/** Minutes said as a person says them: "under a minute", "1 min", "12 min". */
function minutesSaid(minutes) {
  if (!(minutes >= 1)) return 'under a minute'
  return `${Math.round(minutes)} min`
}

/**
 * What a business did on its preview site, in a line: "2 visits, 4 min in
 * all · 3 pages · read 75% of the way down · 2 clicks · tapped a button ·
 * tapped Make It Yours".
 * Null where nobody has been on it.
 */
export function siteWords(site) {
  if (!site?.visits) return null
  const said = [
    site.visits === 1
      ? `1 visit, ${minutesSaid(site.minutes)}`
      : `${site.visits} visits, ${minutesSaid(site.minutes)} in all`,
  ]
  if (site.pages > site.visits) said.push(`${site.pages} pages`)
  if (site.scroll >= 100) said.push('read to the bottom')
  else if (site.scroll > 0) said.push(`read ${site.scroll}% of the way down`)
  if (site.clicks) said.push(site.clicks === 1 ? '1 click' : `${site.clicks} clicks`)
  if (site.buttons)
    said.push(site.buttons === 1 ? 'tapped a button' : `tapped ${site.buttons} buttons`)
  if (site.submitted) said.push('filled in the form')
  if (site.claimed) said.push(`tapped ${CLAIM_LABEL}`)
  return said.join(' · ')
}
