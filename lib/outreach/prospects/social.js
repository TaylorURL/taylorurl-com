/**
 * What has already passed between the studio and a company on Facebook, as
 * the Call List reads it.
 *
 * The owner rings a business and wants to know, before he says anything, what
 * this company has already seen from him: the comment he left on their post
 * three weeks ago, in the words it was left in, and whether they ever answered
 * it. That history is made by the Social Media Manager and lands in
 * `outreach_social_actions`, one row per action, keyed by the prospect it was
 * about.
 *
 * Two different things are read off those rows, and they are deliberately kept
 * apart.
 *
 * What is drawn. Every action on a company, latest first. A comment, a reply,
 * a message or a post is drawn with what was said, because that is the whole
 * use of it on a call; a reaction and a follow are a line each, because
 * "Liked their post" is the entire content of a like. A row whose action is
 * not one this module knows, or whose status is not, or that claims to be a
 * comment and carries no words, is not drawn at all. The table is written by
 * something on another machine, and a row this file cannot read is a row it
 * refuses rather than guesses at: an interaction drawn with nothing in it is
 * the one failure that would have the owner reading an invention down the
 * phone.
 *
 * What it is worth. Only a company's own move toward the studio - an inbound
 * row - lifts its place on the list, and only the strongest one, once. The
 * studio following a hundred Pages says nothing about which of them wants a
 * call; one of them writing back says a great deal. Three readings of what
 * that answer was worth, each a multiplier on the score in `callScore.js`:
 *
 *   purchase      × 2     they asked what a site costs, asked for a call, or
 *                         said they want to go ahead. The strongest thing the
 *                         list knows about a business before anybody rings it
 *                         - the owner has written down that they want the
 *                         thing being sold - so it is worth more than any
 *                         other single lift the score carries.
 *   conversation  × 1.5   a real exchange about their site that is not yet a
 *                         buying signal. The same weight as a company
 *                         registered with the state in the last 90 days:
 *                         something is happening now and will not be in a
 *                         month.
 *   courtesy      × 1.25  a reaction, a thank you, a follow back, an offer of
 *                         a referral. The same weight as knowing the owner's
 *                         name: a real person on the other side has
 *                         acknowledged the studio, which is worth a place but
 *                         is not interest in buying anything.
 *
 * It stays a multiplier rather than points, because that is how every other
 * lift on this list works and because of what it protects: a business that
 * cannot pay, or whose owner never answers a phone, does not climb past one
 * that can on the strength of a Facebook like. The three scores still have to
 * hold.
 *
 * Three things keep it from being farmed. Only the strongest band counts, so
 * ten likes are one courtesy and not ten. The window is 90 days, so a reply
 * from last spring stops lifting. And the lift is only ever applied to a
 * business the call list's own door already let through - this adds no way
 * onto the list, so a company that asked for no further contact, bounced, or
 * was ruled out on a call is not carried back onto it by a reaction.
 *
 * None of this is mail. `engaged.js` is about opens and replies in the inbox
 * and is untouched: a Facebook like is not a mail reply, the two are counted
 * in different places, and a business leads the list for the second and not
 * the first.
 *
 * Strings and pure functions only, since the console page imports it.
 */

/** The one platform these rows cover today. */
export const SOCIAL_PLATFORM = 'facebook'

/**
 * What can have been done, and how each reads either way round.
 *
 * `quotes` is whether the action is the kind that carries words - and so the
 * kind a row has to carry words to be drawn at all. `compact` is the other
 * side of the same fact: nothing to quote, so one line.
 */
export const SOCIAL_ACTIONS = Object.freeze(
  [
    { id: 'comment', ours: 'Commented', theirs: 'They commented', quotes: true },
    { id: 'reply', ours: 'Replied', theirs: 'They replied', quotes: true },
    { id: 'dm', ours: 'Messaged them', theirs: 'They messaged you', quotes: true },
    { id: 'group_post', ours: 'Posted in a group', theirs: 'They posted in a group', quotes: true },
    { id: 'page_post', ours: 'Posted on a Page', theirs: 'They posted on your Page', quotes: true },
    { id: 'reaction', ours: 'Reacted', theirs: 'They reacted', quotes: false },
    { id: 'follow', ours: 'Followed them', theirs: 'They followed you', quotes: false },
  ].map(action => Object.freeze({ ...action, compact: !action.quotes }))
)

/** The ids of those, which are the values the column takes. */
export const SOCIAL_ACTION_IDS = Object.freeze(SOCIAL_ACTIONS.map(action => action.id))

/** The two ways a row can point. */
export const SOCIAL_DIRECTIONS = Object.freeze(['outbound', 'inbound'])

/**
 * How far an action got.
 *
 * `confirmed` is drawn with no word for it, because that is the ordinary case
 * and a badge on every row says nothing. The other three are said outright: a
 * comment sitting in a group's approval queue has not been seen by anybody,
 * and the owner has to know that before he mentions it.
 */
export const SOCIAL_STATUSES = Object.freeze([
  Object.freeze({ id: 'confirmed', label: null, done: true }),
  Object.freeze({ id: 'pending', label: 'Pending a group admin', done: false }),
  Object.freeze({ id: 'attempted', label: 'Attempted, result unknown', done: false }),
  Object.freeze({ id: 'failed', label: 'Did not go through', done: false }),
])

/** The ids of those, which are the values the column takes. */
export const SOCIAL_STATUS_IDS = Object.freeze(SOCIAL_STATUSES.map(status => status.id))

/** What a company's own move was worth, strongest first. */
export const SOCIAL_INTERESTS = Object.freeze([
  Object.freeze({ id: 'purchase', boost: 2, rank: 3 }),
  Object.freeze({ id: 'conversation', boost: 1.5, rank: 2 }),
  Object.freeze({ id: 'courtesy', boost: 1.25, rank: 1 }),
])

/** The ids of those, which are the values the column takes. */
export const SOCIAL_INTEREST_IDS = Object.freeze(SOCIAL_INTERESTS.map(interest => interest.id))

/**
 * What an inbound row with no band on it is read as.
 *
 * The lowest, never the highest. A reading nobody took is not evidence that
 * somebody wants to buy a website.
 */
export const SOCIAL_INTEREST_FLOOR = 'courtesy'

/** How long a company's own move still lifts its place on the list. */
export const SOCIAL_LOOKBACK_DAYS = 90

/** How much of one action's words a card draws. */
export const SOCIAL_TEXT_SHOWN = 1200

/** How many actions one business's history draws, latest first. */
export const SOCIAL_SHOWN_PER_BUSINESS = 25

/**
 * How well it is known that a Facebook Page is this company's.
 *
 * Only `verified` is the console saying "this is them". A link read off a
 * company's own website is evidence of a link: a site can point at a former
 * name, at somebody's personal profile, or at the agency that built it.
 */
export const PAGE_VERIFICATIONS = Object.freeze([
  Object.freeze({
    id: 'verified',
    rank: 4,
    confirmed: true,
    words: 'Page checked against the company',
  }),
  Object.freeze({
    id: 'source_linked',
    rank: 3,
    confirmed: false,
    words: 'From their own website, not yet checked',
  }),
  Object.freeze({
    id: 'hold',
    rank: 2,
    confirmed: false,
    words: 'On hold, the Page may not be them',
  }),
  Object.freeze({
    id: 'rejected',
    rank: 1,
    confirmed: false,
    words: 'Checked and it is somebody else',
  }),
])

/** The ids of those, which are the values the column takes. */
export const PAGE_VERIFICATION_IDS = Object.freeze(PAGE_VERIFICATIONS.map(one => one.id))

/** An instant read as a number, or NaN. */
const instant = value => Date.parse(value ?? '')

/** One action kind, by id. */
export function actionOf(id) {
  return SOCIAL_ACTIONS.find(action => action.id === id) ?? null
}

/** One status, by id. */
export function statusOf(id) {
  return SOCIAL_STATUSES.find(status => status.id === id) ?? null
}

/** One interest band, by id. */
export function interestOf(id) {
  return SOCIAL_INTERESTS.find(interest => interest.id === id) ?? null
}

/** One Page verification standing, by id. */
export function verificationOf(id) {
  return PAGE_VERIFICATIONS.find(one => one.id === id) ?? null
}

/** Whether an action is one of the two drawn as a single line. */
export function isCompactAction(id) {
  return actionOf(id)?.compact === true
}

/** Text as a card draws it: one block of it, cut to what a card holds. */
function said(text) {
  const words = String(text ?? '').trim()
  if (!words) return null
  return words.length > SOCIAL_TEXT_SHOWN
    ? `${words.slice(0, SOCIAL_TEXT_SHOWN - 1).trimEnd()}…`
    : words
}

/**
 * One row as the page draws it, or null where the row is not a reading of
 * anything.
 *
 * The three refusals are the whole guard against drawing an invention: an
 * action this file does not know, a status it does not know, and a comment
 * with no comment in it.
 *
 * @param {object} row A row of `outreach_social_actions`.
 */
export function socialActionOf(row) {
  const action = actionOf(row?.action_type)
  const status = statusOf(row?.status)
  const at = instant(row?.acted_at)
  if (!action || !status || !Number.isFinite(at)) return null
  const exact = said(row?.exact_text)
  const text = exact ?? said(row?.summary)
  if (action.quotes && !text) return null
  const inbound = row?.direction === 'inbound'
  return {
    id: row.id ?? null,
    action_type: action.id,
    direction: inbound ? 'inbound' : 'outbound',
    status: status.id,
    interest: inbound ? (interestOf(row?.interest)?.id ?? null) : null,
    acted_at: row.acted_at,
    text,
    exact: Boolean(exact),
    reaction_kind: said(row?.reaction_kind),
    source_url: row?.source_url ?? null,
    page_url: row?.page_url ?? null,
    group_name: row?.group_name ?? null,
    notes: said(row?.notes),
  }
}

/** What one drawn action is called, which depends on which way it went. */
export function actionWords(action) {
  const known = actionOf(action?.action_type)
  if (!known) return null
  const label = action?.direction === 'inbound' ? known.theirs : known.ours
  return action?.reaction_kind ? `${label} ${action.reaction_kind}` : label
}

/** What is said about a status, or null for the one that needs nothing said. */
export function statusWords(action) {
  return statusOf(action?.status)?.label ?? null
}

/**
 * The strongest thing a company has done toward the studio lately, or null.
 *
 * Confirmed rows only - an inbound action is something that was observed, so
 * anything else is not a reading of it - and inside the window. The strongest
 * band wins and is counted once, which is what stops a run of likes adding up
 * to a conversation.
 *
 * @param {object[]} rows Rows of `outreach_social_actions` for one business.
 * @param {Date} [now]
 * @returns {{interest: string, boost: number, at: string, action_type: string, actions: number}|null}
 */
export function engageBackOf(rows = [], now = new Date()) {
  const since = now.getTime() - SOCIAL_LOOKBACK_DAYS * 86_400_000
  let best = null
  let counted = 0
  for (const row of rows) {
    if (row?.direction !== 'inbound' || row?.status !== 'confirmed') continue
    if (!actionOf(row?.action_type)) continue
    const at = instant(row?.acted_at)
    if (!Number.isFinite(at) || at < since) continue
    counted += 1
    const band = interestOf(row?.interest) ?? interestOf(SOCIAL_INTEREST_FLOOR)
    const better =
      !best || band.rank > best.band.rank || (band.rank === best.band.rank && at > instant(best.at))
    if (better) best = { band, at: row.acted_at, action_type: row.action_type }
  }
  if (!best) return null
  return {
    interest: best.band.id,
    boost: best.band.boost,
    at: best.at,
    action_type: best.action_type,
    actions: counted,
  }
}

/**
 * What a company's own move multiplies its score by, or 1 where it has not
 * made one.
 *
 * @param {{engaged_back?: object|null}} row A business carrying what
 *   `engageBackOf` answered.
 */
export function socialBoost(row) {
  const band = interestOf(row?.engaged_back?.interest)
  return band ? band.boost : 1
}

/**
 * Why a company's place on the list was lifted, in the words somebody would
 * use for it, or null where it was not.
 *
 * The band is what is said rather than the multiplier, because a number on a
 * card is not a reason.
 */
export function socialReason(engagedBack) {
  const interest = engagedBack?.interest
  if (!interestOf(interest)) return null
  if (interest === 'purchase') return 'Asked about a website on Facebook'
  if (interest === 'conversation') return 'Wrote back about their site on Facebook'
  if (engagedBack.action_type === 'follow') return 'Followed you back on Facebook'
  if (engagedBack.action_type === 'reaction') return 'Reacted to your post on Facebook'
  return 'Answered you on Facebook'
}

/** Latest first, which is the order the history is read in. */
export function byActedAt(one, two) {
  return instant(two?.acted_at) - instant(one?.acted_at)
}

/**
 * The Page standing best known for a company, of however many are on file.
 *
 * Best rather than newest: a Page somebody checked stays the answer after a
 * second link off the website is filed beside it, and the newest reading only
 * decides between two of equal standing.
 */
export function bestPageOf(pages = []) {
  let best = null
  let bestRank = 0
  let bestAt = 0
  for (const page of pages) {
    const standing = verificationOf(page?.verification)
    if (!standing || !String(page?.page_url ?? '').trim()) continue
    const read = instant(page?.verified_at ?? page?.created_at)
    const at = Number.isFinite(read) ? read : 0
    if (best && (standing.rank < bestRank || (standing.rank === bestRank && at <= bestAt))) continue
    bestRank = standing.rank
    bestAt = at
    best = {
      url: page.page_url,
      page_id: page.page_id ?? null,
      page_name: page.page_name ?? null,
      verification: standing.id,
      confirmed: standing.confirmed,
      verified_at: page.verified_at ?? null,
      found_at_url: page.found_at_url ?? null,
      notes: said(page.notes),
    }
  }
  return best
}

/** How many of each kind of action a history holds. */
function countsOf(actions) {
  const counts = {}
  for (const action of actions) counts[action.action_type] = (counts[action.action_type] ?? 0) + 1
  return counts
}

/**
 * One business's Facebook history as the Call List draws it, or null where
 * there is nothing on file at all.
 *
 * A company with a Page on file and no actions yet is not nothing: the link is
 * worth having beside the number, and the standing beside it says how far it
 * can be trusted. A company with neither draws nothing, which is what the page
 * does with a null.
 *
 * @param {{actions?: object[], pages?: object[], now?: Date}} held
 */
export function socialHistoryOf({ actions = [], pages = [], now = new Date() } = {}) {
  const drawn = actions
    .map(socialActionOf)
    .filter(Boolean)
    .sort(byActedAt)
    .slice(0, SOCIAL_SHOWN_PER_BUSINESS)
  const page = bestPageOf(pages)
  if (!drawn.length && !page) return null
  return {
    page,
    actions: drawn,
    counts: countsOf(drawn),
    latest_at: drawn[0]?.acted_at ?? null,
    engaged_back: engageBackOf(actions, now),
  }
}

/** A count and its noun, singular where it is one. */
function many(count, one, more) {
  return `${count} ${count === 1 ? one : more}`
}

/** Several things said in a row, with an "and" before the last. */
function listed(parts) {
  if (parts.length < 2) return parts[0] ?? null
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * What a business's Facebook history comes to in a few words, before the date
 * the page adds: "2 comments and a like", "a follow".
 *
 * @param {{actions?: object[]}|null} social
 */
export function socialWords(social) {
  const actions = social?.actions ?? []
  if (!actions.length) return null
  const counts = countsOf(actions)
  const posts = (counts.group_post ?? 0) + (counts.page_post ?? 0)
  const parts = []
  if (counts.comment) parts.push(many(counts.comment, 'comment', 'comments'))
  if (counts.reply) parts.push(many(counts.reply, 'reply', 'replies'))
  if (counts.dm) parts.push(many(counts.dm, 'message', 'messages'))
  if (posts) parts.push(many(posts, 'post', 'posts'))
  if (counts.reaction) parts.push(many(counts.reaction, 'reaction', 'reactions'))
  if (counts.follow) parts.push(counts.follow === 1 ? 'a follow' : `${counts.follow} follows`)
  return listed(parts)
}
