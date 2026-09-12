/**
 * The businesses that can only be reached by picking up the phone: who is on
 * the list, what each one is worth calling, when it comes back round after a
 * call, and the order to work through them in.
 *
 * The cold email pipeline ends at an address, and roughly a fifth of what the
 * map sweep finds has no address to end at: the listing names no website at
 * all, or names a Facebook page, a Linktree or a Square booking page that
 * prints somebody else's support inbox. Those rows stop at 'unreachable' with
 * the reason written beside them, and until this module existed that was the
 * end of them - a quarter of the table sourced, enriched, ruled on, and then
 * left alone forever.
 *
 * They are not weak leads. They are the strongest ones on the table, and the
 * pipeline already says so: `opportunityBand` ranks a business with no site of
 * its own ahead of every scored one, because there is no site to argue about.
 * What stops the sender reaching them is the medium rather than the prospect.
 * Every one of them carries a phone number off the same Places search that
 * found it.
 *
 * Four questions are answered here and nothing else. Whether a row belongs on
 * a call list. What it scores, and out of what. When it is next worth ringing.
 * And where it sits in the order.
 *
 * Nothing is stored. Every reading below is taken at request time from the
 * call history, which is what `outreach_calls` is for - one row per attempt
 * rather than a state on the prospect - so retuning a number here re-dates the
 * whole list on the next read rather than needing a migration and a backfill.
 * That is the trade, and it is stated because it cuts both ways: it is also
 * why nobody can look back and see what the wait was on the day a call was
 * made.
 *
 * Strings and pure functions only. The console imports it into the browser
 * bundle beside `youth.js` and `segments.js`, and a database, a network call
 * or a date formatter here would break that bundle the way it would break
 * theirs. It returns instants and numbers; every dated sentence is composed by
 * the page, in the studio's own zone.
 */

import { isOperating } from './youth.js'
import { hostOf, platformOf } from './platforms.js'

/**
 * The stages a business is past being cold-called at.
 *
 * `unsubscribed` is a person having asked for no further contact, and that ask
 * was about hearing from this business at all rather than about email
 * specifically - reading it as an email-only preference and then ringing them
 * is the worst thing this list could do. `skipped` is a rule or a person
 * having taken the row out, and a list that quietly put those back would make
 * the Skip control on the outreach board mean nothing. `replied` is a
 * conversation already open, which is a lead to answer rather than a number to
 * dial.
 */
const PAST_CALLING = Object.freeze(['unsubscribed', 'skipped', 'replied'])

/**
 * Why a business is not on the call list, or null where it is.
 *
 * A sentence rather than a boolean, because the one thing a caller asks about
 * a business that is missing from the list is why - and a rule that can only
 * say no is a rule that gets re-litigated every time somebody notices a name
 * they expected to see.
 *
 * @param {object} prospect A row of `outreach_prospects`.
 * @returns {string|null} What keeps it off, or null if nothing does.
 */
export function uncallableReason(prospect) {
  if (!prospect) return 'there is no business here'
  if (!String(prospect.phone ?? '').trim()) return 'the listing carries no phone number'
  if (prospect.site_kind !== 'none' && prospect.site_kind !== 'social') {
    return 'the business has a site of its own, so the sender can write to it'
  }
  if (!isOperating(prospect)) return 'Google says the business is closed'
  if (PAST_CALLING.includes(prospect.stage)) {
    return prospect.stage === 'unsubscribed'
      ? 'the business asked for no further contact'
      : `the business is at the ${prospect.stage} stage`
  }
  return null
}

/** Whether a business belongs on the call list at all. */
export function isCallable(prospect) {
  return uncallableReason(prospect) === null
}

/**
 * A phone number as something a browser will dial, which is digits and a
 * leading plus.
 *
 * Google hands the number back formatted for a person - '(281) 328-7144' - and
 * a `tel:` href carrying brackets and spaces is one some dialers refuse and
 * others ring wrongly. The spelling on screen stays the readable one; only the
 * href is flattened.
 */
export function dialHref(phone) {
  const digits = String(phone ?? '').replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}

// ── What the trade says ────────────────────────────────────────────────────

/**
 * Reviews added to both sides of the ratio before the division.
 *
 * Review counts are not comparable across trades and reading them as though
 * they were is the one mistake that would make this list useless: a restaurant
 * collects reviews from every table it turns, a machine shop from the two
 * customers a year who think to leave one. So the reading is the count against
 * the middle count for that same trade.
 *
 * Unsmoothed, that reading manufactures findings out of accidents. The middles
 * on this table run from 2 to 232, and against a middle of 2 a flooring
 * contractor with four reviews reads as twice its trade - a claim as strong as
 * "ahead of everyone in its trade" built out of two reviews and a rounding.
 * Adding ten to both sides costs a genuinely busy business almost nothing at
 * the top of the scale and collapses the noise at the bottom, where nearly
 * every trade on this table lives.
 *
 * Ten is `YOUNG_REVIEW_CEILING` from youth.js, which is the line the pipeline
 * already draws for where a review count starts meaning something on its own.
 * Using the same number twice is deliberate: a claim this file makes should
 * not rest on counts the file next door has already said it does not trust.
 *
 * Measured over the 1,283 live rows, the prior takes busy from 274 to 211,
 * quiet from 243 to 107, and the lowest count that can read busy from 4 to 16.
 * A welding shop at 40 against a middle of 4 still reads busy; a barber at 200
 * against 49 still reads busy; a restaurant at 400 against 380 still reads
 * steady.
 */
export const REVIEW_PRIOR = 10

/**
 * How many reviews a listing has, or null where nobody has read that.
 *
 * Google leaves the count off a listing nobody has reviewed rather than sending
 * a zero, so an absent count is two different facts. The sweep asks for the
 * count and the business status in the one request, which is what tells them
 * apart: a listing carrying a status and no count is one Google answered for
 * with no reviews on it, and a listing carrying neither is one nothing asked
 * about. The first is the least findable business on the table and reads as
 * the zero it is. The second stays unread, because promoting a row nobody has
 * read on the strength of a missing field is the failure youth.js is shaped
 * around.
 *
 * Anything present that is not plainly a number is unread too.
 *
 * @param {object} prospect A row carrying `rating_count` and `business_status`.
 * @returns {number|null}
 */
export function reviewsOf(prospect) {
  const count = prospect?.rating_count
  if (count === null || count === undefined) return prospect?.business_status ? 0 : null
  return typeof count === 'number' && Number.isFinite(count) ? count : null
}

/**
 * How a listing's review count reads against the middle count for its trade,
 * both sides smoothed by REVIEW_PRIOR.
 *
 * @param {object} prospect A row carrying `rating_count` and `business_status`.
 * @param {number|null} median The middle review count among callable
 *   businesses in the same trade, or null where the trade has too few to say.
 * @returns {number|null} The ratio, or null where either end is unread.
 */
export function pullOf(prospect, median) {
  const count = reviewsOf(prospect)
  if (count === null) return null
  if (typeof median !== 'number' || !Number.isFinite(median) || median <= 0) return null
  return (count + REVIEW_PRIOR) / (median + REVIEW_PRIOR)
}

/** The middle value of a list of numbers, or null where there is none. */
export function medianOf(values) {
  const sorted = values.filter(value => Number.isFinite(value)).sort((one, two) => one - two)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * Trades holding fewer callable businesses than this have no middle worth
 * taking.
 *
 * A median over three rows is one of those rows, and dividing the other two by
 * it produces a ratio that says more about which row landed in the middle than
 * about the trade. Under the floor every business in the trade reads `unread`,
 * which is the honest answer and keeps them on the list rather than ranking
 * them on a number nobody should trust.
 */
export const TRADE_FLOOR = 8

/** The readings a listing's trade can come to, busiest first. */
export const PULLS = Object.freeze(['busy', 'steady', 'quiet', 'unread'])

/** Where a listing stops being ordinary for its trade and starts being busy. */
export const BUSY_FLOOR = 1.75
/** Where a listing stops being ordinary and starts reading as unfound. */
export const QUIET_CEILING = 0.5

/**
 * The review count at which a listing crosses a band boundary in its trade.
 *
 * The bands are cut on the smoothed ratio, so the count that reaches a
 * boundary is not the boundary times the middle. Written here rather than
 * worked out at each call site, because two places deriving it separately is
 * two chances to forget the prior - and the checks assert the constants
 * through this rather than through a number somebody measured once.
 */
export function countAtBand(boundary, median) {
  return boundary * (median + REVIEW_PRIOR) - REVIEW_PRIOR
}

/**
 * How the listing reads for its trade: `busy`, `steady`, `quiet`, or `unread`.
 *
 * The count against the trade is the closest thing on the row to where the
 * business ranks when somebody searches its trade in its town, because the
 * search the sweep runs orders its answer by prominence and reviews are most of
 * what prominence is for a business with no site. So `quiet` is the strongest
 * lead on the list: a business that has traded for years and collected a tenth
 * of what its neighbours collected is a business nobody can find, which is the
 * entire thing being sold. `busy` is the weakest, and not because it is a bad
 * business - it is already being found, and its owner says so on the phone.
 */
export function pullBand(prospect, median) {
  const pull = pullOf(prospect, median)
  if (pull === null) return 'unread'
  if (pull >= BUSY_FLOOR) return 'busy'
  if (pull <= QUIET_CEILING) return 'quiet'
  return 'steady'
}

// ── What the business has instead of a site ────────────────────────────────

/**
 * Platform hosts grouped by what listing one actually says about the business.
 *
 * The pipeline's own list in platforms.js answers one question - is this the
 * business's own site - and for that question every entry is the same. On the
 * phone they are not the same at all, and the difference is the opening
 * sentence.
 *
 * A business on Booksy, Vagaro, Square or Toast already pays somebody a
 * monthly for software and already takes bookings or orders online. It has the
 * budget line and the operational need, and the call is about owning the thing
 * it already depends on. A business with a Facebook page has decided it needs
 * somewhere to be found and settled for a page it does not own. A business
 * with nothing at all is the cleanest pitch and the longest conversation,
 * because it opens by establishing that a website is worth having. And a
 * profile on Yelp, the BBB, HAR or Yellow Pages is not a decision the business
 * made - somebody else listed it - so it says nothing about them either way.
 */
const BOOKING_HOSTS = Object.freeze([
  'booksy.com',
  'vagaro.com',
  'styleseat.com',
  'schedulicity.com',
  'fresha.com',
  'setmore.com',
  'squareup.com',
  'square.site',
  'acuityscheduling.com',
  'calendly.com',
  'mindbodyonline.com',
  'clover.com',
  'toasttab.com',
  'opentable.com',
  'doordash.com',
  'ubereats.com',
  'grubhub.com',
  'slicelife.com',
  'myshopify.com',
])

/** Directories somebody else listed the business in. */
const PORTAL_HOSTS = Object.freeze([
  'yelp.com',
  'angi.com',
  'angieslist.com',
  'thumbtack.com',
  'bbb.org',
  'yellowpages.com',
  'har.com',
  'business.site',
  'sites.google.com',
])

/**
 * What the business has instead of a site: `booking`, `social`, `portal`, or
 * `none`.
 *
 * @param {object} prospect A row carrying `site_kind` and `website`.
 */
export function presenceOf(prospect) {
  if (prospect?.site_kind === 'none') return 'none'
  const root = platformOf(hostOf(prospect?.website))
  if (!root) return 'none'
  if (BOOKING_HOSTS.includes(root)) return 'booking'
  if (PORTAL_HOSTS.includes(root)) return 'portal'
  return 'social'
}

// ── What a call comes to ───────────────────────────────────────────────────

/**
 * What a call came to. The order is the order a call goes wrong in, and the
 * three that end a business's place on the list are last.
 *
 * `ends` marks an outcome after which the business comes off the list: one has
 * said no, and the other has said yes, and ringing either again is the list
 * failing at the only job it has. Everything else leaves the row on it.
 *
 * `keeps` marks an outcome that expects a time to ring back. The console asks
 * for one where it is set and takes the call without one, because the caller
 * who is told to try again next week has nothing to type and a form that will
 * not save until they invent a time gets a made-up one or a different outcome
 * altogether. What a call back cannot carry is no time at all - that is a
 * promise nothing will ever surface again - so a call back nobody timed is
 * filed at CALLBACK_DEFAULT_HOURS.
 *
 * `track` is the group the outcome belongs to, which is what turns eight
 * buttons into four decisions on screen.
 *
 * `asks` and `interest` are the two halves of one question: was there anybody
 * on the other end who wanted this. `interest` is the outcome answering for
 * itself, and three of them can - a booking and a named time to ring back are
 * a yes, and Not Interested is the word itself. `asks` marks the two where the
 * outcome cannot answer and the caller is offered the question, because Spoke
 * To Owner covers both halves of the only conversation that matters: the owner
 * who asked what it would cost and the owner who said no thanks and hung up.
 * An outcome carrying neither reached nobody who could have wanted anything,
 * so there is nothing to ask and nothing to record.
 */
export const CALL_OUTCOMES = Object.freeze([
  { id: 'no_answer', label: 'No Answer', tone: 'plain', track: 'unanswered', key: '1' },
  { id: 'voicemail', label: 'Left Voicemail', tone: 'plain', track: 'unanswered', key: '2' },
  { id: 'gatekeeper', label: 'Gatekeeper', tone: 'plain', track: 'held', asks: true, key: '3' },
  { id: 'spoke', label: 'Spoke To Owner', tone: 'accent', track: 'reached', asks: true, key: '4' },
  {
    id: 'callback',
    label: 'Call Back',
    tone: 'accent',
    track: 'reached',
    keeps: true,
    interest: true,
    key: '5',
  },
  {
    id: 'booked',
    label: 'Booked',
    tone: 'good',
    track: 'off',
    ends: true,
    interest: true,
    key: '6',
  },
  {
    id: 'not_interested',
    label: 'Not Interested',
    tone: 'bad',
    track: 'off',
    ends: true,
    interest: false,
    key: '7',
  },
  { id: 'wrong_number', label: 'Wrong Number', tone: 'bad', track: 'off', ends: true, key: '8' },
  // A business that should never have been on the list: closed, a chain, out
  // of the area, or not the kind of business this is for. Filed rather than
  // skipped, so the list learns and nobody is handed it again.
  { id: 'bad_lead', label: 'Bad Lead', tone: 'bad', track: 'off', ends: true, key: '9' },
])

/**
 * The four things a call can come to, said the way a person would say them.
 *
 * This is the user's own "follow up, sale, no answer" mapped onto the eight
 * ids the column already accepts, and it exists so the outcome control reads
 * as four decisions rather than eight buttons. It groups and nothing else - no
 * rule anywhere reads a track.
 */
export const TRACKS = Object.freeze([
  { id: 'unanswered', label: 'Nobody Answered' },
  { id: 'held', label: 'Held At The Desk' },
  { id: 'reached', label: 'Reached Them' },
  { id: 'off', label: 'Off The List' },
])

/** Every outcome the column will accept, which is what a write is checked against. */
export const OUTCOME_IDS = Object.freeze(CALL_OUTCOMES.map(outcome => outcome.id))

/** One outcome by its id, or null where the id is not one. */
export function outcomeOf(id) {
  return CALL_OUTCOMES.find(outcome => outcome.id === id) ?? null
}

/** Whether an outcome takes the business off the list for good. */
export function outcomeEnds(id) {
  return Boolean(outcomeOf(id)?.ends)
}

/** Whether an outcome is one that carries a time to ring back. */
export function outcomeTakesCallback(id) {
  return Boolean(outcomeOf(id)?.keeps)
}

/** The outcomes in one track, in the order they are offered. */
export function outcomesInTrack(track) {
  return CALL_OUTCOMES.filter(outcome => outcome.track === track)
}

/** Whether this outcome leaves the interest for the caller to answer. */
export function outcomeAsksInterest(id) {
  return Boolean(outcomeOf(id)?.asks)
}

/**
 * Whether the call found somebody who wanted this: true, false, or null where
 * nobody who could have wanted it was reached.
 *
 * Null is the third answer rather than a missing one, and it is the reason this
 * is not a plain boolean. A number that rang out is not a business that said
 * no, and a column storing it as one would read back as eight thousand
 * refusals nobody ever heard.
 *
 * @param {string} outcome What the call came to.
 * @param {boolean|null} [answered] What the caller said, where the outcome asks.
 */
export function interestIn(outcome, answered = null) {
  const held = outcomeOf(outcome)
  if (!held) return null
  if (!held.asks) return held.interest ?? null
  return typeof answered === 'boolean' ? answered : null
}

/**
 * Whether a call belongs in front of the studio as a lead.
 *
 * The one rule, named once and read by the endpoint that writes the lead and
 * by the check that holds it. Two halves, and both have to hold: the call
 * reached somebody who could have wanted this, and nothing said they did not.
 * A cold prospect is not a lead - eight thousand names off a map are a list to
 * work, and a number that rang out says nothing about any of them.
 *
 * The interest answer only ever takes a business out. It is the caller's to
 * give and not the form's to demand, so a conversation nobody answered for
 * still arrives as a lead: the reading that costs a second of somebody's
 * attention is the cheaper one, against a lead nobody knew they had.
 */
export function callMakesLead(outcome, answered = null) {
  const held = outcomeOf(outcome)
  if (!held) return false
  const reached = Boolean(held.asks) || typeof held.interest === 'boolean'
  return reached && interestIn(outcome, answered) !== false
}

// ── When it comes back round ───────────────────────────────────────────────

/** The three outcomes where the phone did not reach somebody who decides. */
const NOT_THROUGH = Object.freeze(['no_answer', 'voicemail', 'gatekeeper'])

/**
 * The wait by run of unanswered attempts, one-based, the last rung repeating.
 *
 * A day, three days, a week, a fortnight, a month. The gap lengthens because a
 * number that has not answered three times is worth less than a number nobody
 * has tried, and a flat gap spends every afternoon re-dialling the same forty
 * dead numbers.
 *
 * There is no retirement rung and there deliberately is not one. The top rung
 * repeats, so a number nobody answers is dialled roughly six times over two
 * months and then once a month after that, which is cheap. A business leaves
 * this list because a person recorded an outcome that ends it, never because a
 * counter ran out - a counter that retires a business is a decision nobody
 * made and nobody can see.
 *
 * These five numbers are reasoned rather than measured. Nobody has data on
 * whether a second attempt at a day converts better than one at two days, and
 * because the wait is derived rather than stamped, changing one of them
 * re-dates every resting business on the list at once.
 */
export const ATTEMPT_HOURS = Object.freeze([24, 72, 168, 336, 720])

/**
 * What each outcome is worth on its own, whatever the run says.
 *
 * `no_answer` a day, because nobody being there is a fact about one moment and
 * a day is the shortest gap that guarantees a different day's staffing.
 * `voicemail` three days, because a message is now on their machine and
 * ringing before they have played it is a second cold call rather than a
 * follow-up. `gatekeeper` two days, because a receptionist saying he is out on
 * a job means the number is live, and one day lands on the same shift and
 * usually the same person. `spoke` a week, because the owner heard it and did
 * not book and did not refuse, and anything sooner is chasing.
 *
 * `callback` is not here, and that absence is load-bearing. A named time is a
 * promise rather than a rest, and a rest that competed with it would swallow
 * it: a caller told at ten in the morning to ring back at four would find the
 * business resting until tomorrow, which is the list overruling the only
 * person on it who knows anything.
 */
export const OUTCOME_FLOOR_HOURS = Object.freeze({
  no_answer: 24,
  voicemail: 72,
  gatekeeper: 48,
  spoke: 168,
})

/** The floor under a named time that has already gone past. */
export const PASSED_PROMISE_HOURS = 24

/**
 * How far out a call back lands when nobody named a time.
 *
 * A time somebody actually gave is the whole point and beats this outright.
 * This is for the other half of them: the owner who says try me tomorrow, the
 * one who says catch me later in the week, the one who says anything at all
 * except a clock. A day is the shortest gap that reaches a different shift,
 * and it keeps the business at the head of the list rather than down the
 * ladder with the numbers that rang out.
 */
export const CALLBACK_DEFAULT_HOURS = 24

/**
 * A length out from now, as an instant.
 *
 * @param {number} hours
 * @param {Date} [now]
 * @returns {Date}
 */
export function callbackIn(hours, now = new Date()) {
  return new Date(now.getTime() + hours * 3_600_000)
}

/** That default as an instant, from now or from a moment handed in. */
export function defaultCallbackAt(now = new Date()) {
  return callbackIn(CALLBACK_DEFAULT_HOURS, now)
}

/**
 * The lengths a caller can set a call back for, as one press each.
 *
 * They are the ladder above rather than a set chosen on the screen that draws
 * them, so a time a caller picks and a time the list would have come back on its
 * own are the same five intervals. Anything finer is precision nothing
 * downstream reads: the business comes back on the list that morning either way.
 *
 * The labels are how the length is said rather than how it is counted. Nobody
 * ringing back in 336 hours thinks of it that way.
 */
export const CALLBACK_LENGTHS = Object.freeze(
  [
    { hours: ATTEMPT_HOURS[0], label: 'Tomorrow' },
    { hours: ATTEMPT_HOURS[1], label: 'Three Days' },
    { hours: ATTEMPT_HOURS[2], label: 'Next Week' },
    { hours: ATTEMPT_HOURS[3], label: 'Two Weeks' },
    { hours: ATTEMPT_HOURS[4], label: 'A Month' },
  ].map(Object.freeze)
)

/**
 * One call, in the shape the endpoint takes it.
 *
 * Written here rather than at the screen that fills it in, because every field
 * on it is decided by a rule that already lives in this file. The endpoint
 * refuses a time on an outcome that ends the list and an interest on an outcome
 * that settles its own, and a screen composing the body by hand is a screen that
 * has to remember both - which is a call a representative places, files, and
 * loses to a refusal they cannot read.
 *
 * `id` is the business rather than `prospect_id`, because that is the key the
 * endpoint reads. The column is `prospect_id` and the body is not the column.
 *
 * @param {{id: string, outcome: string, hours?: number|null,
 *   interested?: boolean|null, note?: string}} answered What the caller pressed.
 * @returns {{id: string, outcome: string, note: string|null,
 *   callback_at: string|null, interested: boolean|null}}
 */
export function callBody({ id, outcome, hours = null, interested = null, note = '' }) {
  const text = String(note ?? '').trim()
  return {
    id,
    outcome,
    note: text || null,
    // Only an outcome that keeps the business names a time. One that ends the
    // list carrying a time is refused, and rightly: a business that is off the
    // list does not come back to one.
    callback_at: outcomeTakesCallback(outcome) && hours ? callbackIn(hours).toISOString() : null,
    // And only an outcome that leaves the question open carries an answer to it.
    // Booked marked not interested is a form disagreeing with the button it was
    // submitted under.
    interested: outcomeAsksInterest(outcome) ? interested : null,
  }
}

/**
 * How long past the time it named a promise still leads the list.
 *
 * A time somebody named three weeks ago that has been chased twice is spent,
 * and the business becomes ordinary work rather than standing at the head of
 * the list forever.
 */
export const PROMISE_KEEPS_DAYS = 14

/**
 * A number off a column that may be absent, or null.
 *
 * `Number(null)` is nought and `Number('')` is nought, so a plain coercion
 * turns two kinds of absence into a reading. Everything comparing a figure
 * against a floor reads through this instead.
 */
function figure(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** An instant from whatever the row is carrying, or null. */
function instant(value) {
  if (!value) return null
  const when = value instanceof Date ? value : new Date(value)
  return Number.isNaN(when.getTime()) ? null : when
}

/**
 * The run of consecutive attempts at the head of the history that reached
 * nobody who decides.
 *
 * Keyed on the run rather than on how many calls the business has taken, and
 * that is the whole of it: a business somebody has legitimately spoken to five
 * times must not land on the thirty-day rung. `spoke` and `callback` reset the
 * run to nothing, because reaching a person is the opposite of the evidence
 * this counts.
 *
 * @param {object} row A prospect carrying `calls`, newest first.
 */
export function triesRun(row) {
  let run = 0
  for (const call of row?.calls ?? []) {
    if (!NOT_THROUGH.includes(call?.outcome)) break
    run += 1
  }
  return run
}

/** What the run would be if this outcome were recorded now. */
export function runAfter(row, outcome) {
  return NOT_THROUGH.includes(outcome) ? triesRun(row) + 1 : 0
}

/**
 * The hours a business waits after a call, or null where the outcome ends it.
 *
 * Null means exactly one thing - the business is off the list - and never
 * doubles as "this outcome carries its own time". A `callback` returns null
 * too, because what decides its return is the time somebody named rather than
 * any number here.
 */
export function waitHoursFor(outcome, run) {
  if (!outcomeOf(outcome) || outcomeEnds(outcome) || outcome === 'callback') return null
  const floor = OUTCOME_FLOOR_HOURS[outcome] ?? 0
  if (!NOT_THROUGH.includes(outcome)) return floor
  const rung = ATTEMPT_HOURS[Math.min(Math.max(run, 1), ATTEMPT_HOURS.length) - 1]
  return Math.max(rung, floor)
}

/** The wait this business would take if the outcome were recorded now. */
export function waitAfter(row, outcome) {
  return waitHoursFor(outcome, runAfter(row, outcome))
}

/**
 * The time somebody named for this business, where that promise is still worth
 * something.
 *
 * The newest call carrying a `callback_at` wins, and where the history carries
 * none the row's own column is read - which is the shape a fixture builds and
 * the shape the endpoint hands over. A time more than PROMISE_KEEPS_DAYS past
 * is spent and comes back null.
 *
 * @returns {Date|null}
 */
export function promiseOf(row, now = new Date()) {
  const named = (row?.calls ?? []).find(call => call?.callback_at)?.callback_at ?? row?.callback_at
  const when = instant(named)
  if (!when) return null
  const spentAfter = now.getTime() - PROMISE_KEEPS_DAYS * 86_400_000
  return when.getTime() < spentAfter ? null : when
}

/**
 * When this business is next worth ringing, or null where it is off the list.
 *
 * A promise still ahead is the answer outright, and a rest never competes with
 * one. That is not a preference, it is the only reading that keeps the feature
 * honest: a caller told at ten in the morning to ring back at four records
 * `callback` and a time, and any arithmetic that let the day's rest win would
 * bury the appointment until tomorrow.
 *
 * Where the promise has gone past, it stops deciding and the rest of whatever
 * was actually recorded takes over - so a business promised Friday and then
 * rung Wednesday to a no-answer waits out Wednesday's day rather than
 * returning to the head of the list every Friday forever. That last part is a
 * bug this replaced: the endpoint used to lift the newest call that NAMED a
 * time rather than the newest call, so a stale promise led the list
 * permanently and nothing could clear it.
 *
 * @returns {Date|null}
 */
export function readyAt(row, now = new Date()) {
  const last = row?.calls?.[0] ?? null
  if (!last) return now
  if (outcomeEnds(last.outcome)) return null

  const promise = promiseOf(row, now)
  if (promise && promise.getTime() > now.getTime()) return promise

  const called = instant(last.called_at)
  if (!called) return now

  // A named time that has gone past still buys a short rest, so a caller who
  // misses one by an hour is not handed the same number back the same minute.
  const hours =
    last.outcome === 'callback'
      ? PASSED_PROMISE_HOURS
      : (waitHoursFor(last.outcome, triesRun(row)) ?? 0)
  const rest = new Date(called.getTime() + hours * 3_600_000)
  return promise && promise.getTime() > rest.getTime() ? promise : rest
}

/** The places a business can sit, and whether each is work to do now. */
export const PLACES = Object.freeze([
  { id: 'fresh', label: 'Not Called', tone: 'warn', calls: true },
  { id: 'due', label: 'Due Back', tone: 'accent', calls: true },
  { id: 'ready', label: 'Ready', tone: 'plain', calls: true },
  { id: 'promised', label: 'Callback', tone: 'plain', calls: false },
  { id: 'resting', label: 'Resting', tone: 'plain', calls: false },
  { id: 'booked', label: 'Booked', tone: 'good', calls: false },
  { id: 'closed', label: 'Closed', tone: 'bad', calls: false },
])

/** One place by its id, or null. */
export function placeOf(id) {
  return PLACES.find(place => place.id === id) ?? null
}

/**
 * Where a business sits right now.
 *
 * Resolved in this order, and the order is the argument: a business with no
 * calls has nothing to wait out; one whose last outcome ended it is finished
 * whatever else is true; a wait still running is either a promise somebody
 * named or a rest the ladder set, and those are told apart only by which of
 * the two produced the time; a promise already past is due; and anything left
 * is ready.
 *
 * @returns {'fresh'|'due'|'ready'|'resting'|'promised'|'booked'|'closed'}
 */
export function callPlace(row, now = new Date()) {
  const last = row?.calls?.[0] ?? null
  if (!last) return 'fresh'
  if (outcomeEnds(last.outcome)) return last.outcome === 'booked' ? 'booked' : 'closed'

  const ready = readyAt(row, now)
  const promise = promiseOf(row, now)
  if (ready && ready.getTime() > now.getTime()) {
    return promise && promise.getTime() === ready.getTime() ? 'promised' : 'resting'
  }
  if (promise) return 'due'
  return 'ready'
}

/**
 * Whether a place is work to do now.
 *
 * This is the whole of the suppression the user asked for: a row this answers
 * false for is not in the working list at all, rather than sitting lower down
 * it. A business rung this morning used to still be on the first page this
 * afternoon, merely further down, which is what made the list unworkable.
 */
export function placeCalls(place) {
  return Boolean(placeOf(place)?.calls)
}

// ── Whose business it is ─────────────────────────────────────────────

/**
 * A business belongs to whoever first rang it, and goes on belonging to them
 * until somebody hands it over.
 *
 * This is a different fact from the one the presence board carries and the two
 * are easy to run together. Presence is who has a number up to their ear this
 * minute, it lasts as long as the beats do, and it exists so two people do not
 * dial the same business at once. Assignment lasts, and it exists because the
 * second call to a business is a conversation with somebody who remembers the
 * first: the caller knows what was said, what was promised and who they asked
 * for, and none of that is in the note.
 *
 * A call does not take a business off whoever already holds it. Somebody
 * covering one call while a colleague is out has covered one call, and moving
 * the relationship on the strength of it is the failure this is here to stop -
 * so the claim is only ever made on a business nobody holds, and every other
 * change of hands is somebody deciding, in front of the record, to make it.
 */
export const ASSIGNED_ANY = 'all'
export const ASSIGNED_MINE = 'mine'
export const ASSIGNED_NOBODY = 'nobody'

/** The two answers that are about a person without naming one. */
export const ASSIGNED_STANDINGS = Object.freeze([ASSIGNED_MINE, ASSIGNED_NOBODY])

/** Who holds a business, or null where nobody does. */
export function ownerOf(row) {
  const held = typeof row?.assigned_to === 'string' ? row.assigned_to.trim() : ''
  return held || null
}

/**
 * Who holds it, unless that is the person asking.
 *
 * A caller's own business is the work in front of them rather than a note
 * about somebody else, and every screen that draws an owner draws those two
 * differently.
 */
export function ownedByOther(row, userId) {
  const owner = ownerOf(row)
  return owner && owner !== userId ? owner : null
}

/**
 * Whether recording a call now would take the business.
 *
 * Only an unheld one. The whole point of the rule is that the first caller
 * keeps it, so a business that already has somebody is left exactly as it is
 * however many other people ring it.
 */
export function callTakesOwner(row) {
  return ownerOf(row) === null
}

/** Whether a business answers to a filter on who holds it. */
export function matchesAssigned(row, assigned, userId = null) {
  const want = typeof assigned === 'string' ? assigned.trim() : ''
  if (!want || want === ASSIGNED_ANY) return true
  const owner = ownerOf(row)
  if (want === ASSIGNED_NOBODY) return owner === null
  if (want === ASSIGNED_MINE) return Boolean(userId) && owner === userId
  return owner === want
}

/**
 * Whether a business survives the controls the console is set to.
 *
 * A row whose place is `due` survives everything but the search, and that is
 * the rule this function exists to hold. A promise is the one appointment on
 * the page - somebody named that time themselves - so a score floor or a town
 * filter quietly hiding one would make the two most useful things on the page
 * cancel each other out. A search is the exception to the exception, because a
 * search is somebody looking for one particular business rather than narrowing
 * the work in front of them.
 *
 * @param {object} row A drawn row carrying `place`, `pull` and `score`.
 * @param {{state?: string|null, pull?: string|null, minScore?: number|null,
 *   town?: string|null, trade?: string|null, search?: string|null}} controls
 */
export function matchesControls(row, controls = {}) {
  const { state = null, pull = null, minScore = null, town = null, trade = null } = controls
  const needle = controls.search ? String(controls.search).toLowerCase() : null
  if (needle) {
    const hay = `${row?.name ?? ''} ${row?.town ?? ''} ${row?.phone ?? ''}`.toLowerCase()
    if (!hay.includes(needle)) return false
  }
  // Read before the promise exemption below, and with the search rather than
  // with the filters, because whose business it is is not a narrowing of the
  // work in front of somebody - it is which work is in front of them. A
  // colleague's business that has come due is a call for that colleague to
  // make, so surfacing it here under `mine` would hand it to the wrong person
  // in the name of never hiding a promise.
  if (!matchesAssigned(row, controls.assigned, controls.you)) return false
  if (row?.place === 'due') return true
  if (state === 'due' && row?.place !== 'due') return false
  if (state === 'fresh' && row?.place !== 'fresh') return false
  if (state === 'rung' && row?.place !== 'ready') return false
  if (pull && row?.pull !== pull) return false
  if (minScore !== null && minScore !== undefined && (row?.score ?? 0) < minScore) return false
  if (town && row?.town !== town) return false
  if (trade && row?.trade !== trade) return false
  return true
}

// ── What it is worth calling ───────────────────────────────────────────────

/**
 * Every number the score is built from, in one frozen object.
 *
 * The scorecard on screen, the chips in the row and the checks all read this
 * rather than restating a weight, so the page cannot claim one arithmetic
 * while the module runs another.
 *
 * The two largest terms both measure how hard the business is to find, and
 * both lead with the businesses Google is hiding. The list used to run the
 * other way - busy listings first, booking platforms first, on the grounds that
 * a business with money in the till and a software bill already paid could
 * afford a site - and the first two hundred and fifty businesses it put in
 * front of a caller all read busy for their trade. Those are the owners who
 * tell a caller they do not need anything, and they are right: Google already
 * sends them the work.
 *
 * So `trade` runs from `quiet` down to `busy`, with `unread` below everything
 * it can measure and above the one reading that says the business is found. And
 * `presence` runs from nothing at all down to a booking platform, whose own
 * marketplace is a search that already puts the business in front of
 * customers. A busy listing with every other advantage still sits under a quiet
 * one with none, before anybody has rung either.
 *
 * The positives can reach 110 and the score stops at 100, which is deliberate
 * rather than sloppy: a business that is invisible in its trade, in a trade the
 * studio has work in, with nothing online at all, and has already been spoken
 * to is off the top of any scale worth drawing, and clamping says so more
 * honestly than rescaling every other row to make room for it.
 *
 * `proof` is the one weight held down on purpose. Work of ours in the caller's
 * trade is the strongest opener this studio has, and it is also a fact
 * about us rather than about them - the portfolio covers a dozen trades, which
 * is over half this list, so at a quarter of the scale it would rank the
 * studio's own history rather than the businesses. Twenty is enough to break a
 * tie and surface a trade match without deciding the page.
 */
export const SCORE_WEIGHTS = Object.freeze({
  trade: Object.freeze({ quiet: 50, steady: 25, unread: 15, busy: 0 }),
  proof: Object.freeze({ trade: 20, town: 10, none: 0 }),
  presence: Object.freeze({ none: 25, social: 15, portal: 10, booking: 5 }),
  reached: Object.freeze({ points: 15 }),
  reputation: Object.freeze({ under: -12, floorCount: 20, floorRating: 4 }),
  attempts: Object.freeze({ each: -8, floor: -24 }),
})

/** The ceiling the score is drawn against, fixed rather than the page maximum. */
export const SCORE_PEAK = 100

/** How the trade reading reads in a chip. */
const TRADE_CHIP = Object.freeze({
  busy: 'Busy For Its Trade',
  steady: 'Middling For Its Trade',
  quiet: 'Findable By Nobody',
  unread: 'Its Trade Is Unread',
})

/** How what it has instead of a site reads in a chip. */
const PRESENCE_CHIP = Object.freeze({
  booking: 'Already Pays For Software',
  social: 'A Page It Does Not Own',
  none: 'Nothing At All',
  portal: 'Somebody Else Listed It',
})

/**
 * Whether somebody has heard the pitch and not said no.
 *
 * A `spoke` or a `gatekeeper` anywhere in the history counts, because both
 * mean a live number and a person on the end of it. An ending outcome after
 * one cancels it, but an ending outcome takes the business off the list
 * anyway, so in practice this fires on exactly the businesses that are warm
 * and still open.
 */
function hasReached(calls) {
  for (const call of calls ?? []) {
    if (outcomeEnds(call?.outcome)) return false
    if (call?.outcome === 'spoke' || call?.outcome === 'gatekeeper') return true
  }
  return false
}

/**
 * What a business is worth calling, out of a hundred, and why.
 *
 * The decomposition is the return value rather than something the page works
 * out again, so the chips in the row, the scorecard in the panel and the
 * checks all read one object and cannot drift into three arithmetics.
 *
 * What is deliberately NOT a term:
 *
 * What a job in that trade is worth. A hand-typed map of trades to dollar
 * bands cannot carry a quarter of a number the page claims a person can check;
 * it is wrong for every row in a trade at once if it is wrong at all, and
 * nothing on this table could validate it until there are booked calls, of
 * which there are none. The trade filter is the honest version of that.
 *
 * Reviews gained since the listing was filed. `rating_count > rating_count_first`
 * is true on none of the rows carrying both, because the column was backfilled
 * with the current count and no sweep has moved a row since. A term reading it
 * would award every business on the list the same nothing, which is a term
 * that looks like it is working and is not. It is worth about +8 for a listing
 * that has added reviews, and it is worth building when
 * `rating_count > rating_count_first` clears roughly two hundred rows.
 *
 * A good rating. Of the rated rows on this table, a third sit at exactly five
 * stars over a handful of reviews, so a positive rating term would put a few
 * hundred near-empty listings at the top of the page. Rating only ever
 * subtracts here, and only as a finding.
 *
 * @param {object} prospect A row of `outreach_prospects`.
 * @param {{median: number|null, proof: string|null, calls: object[]}} reading
 * @returns {{score: number, raw: number, terms: object[]}}
 */
export function scoreOf(prospect, { median = null, proof = null, calls = [] } = {}) {
  const terms = []

  const band = pullBand(prospect, median)
  terms.push({
    id: 'trade',
    label: 'How its trade reads',
    chip: TRADE_CHIP[band],
    reading: band,
    points: SCORE_WEIGHTS.trade[band] ?? 0,
  })

  const proofKey = proof === 'trade' || proof === 'town' ? proof : 'none'
  terms.push({
    id: 'proof',
    label: 'Work of ours to name',
    chip:
      proofKey === 'trade'
        ? 'Work In Its Trade'
        : proofKey === 'town'
          ? 'Work In Its Town'
          : 'Nothing To Name',
    reading: proofKey,
    points: SCORE_WEIGHTS.proof[proofKey],
  })

  const presence = presenceOf(prospect)
  terms.push({
    id: 'presence',
    label: 'What it has instead of a site',
    chip: PRESENCE_CHIP[presence],
    reading: presence,
    points: SCORE_WEIGHTS.presence[presence] ?? 0,
  })

  const reached = hasReached(calls)
  terms.push({
    id: 'reached',
    label: 'Somebody has heard it',
    chip: reached ? 'Heard It, Did Not Say No' : 'Never Reached',
    reading: reached ? 'reached' : 'cold',
    points: reached ? SCORE_WEIGHTS.reached.points : 0,
  })

  // A rating and a count both arrive as JSON and either can be a string off a
  // numeric column, so both are read through `figure` before either is
  // compared. It exists because `Number(null)` is nought rather than NaN, and
  // a coercion straight to Number would read every unrated listing as one
  // rated zero - firing this subtraction on the third of the table Google
  // never answered for, and inventing a reputation problem out of an absent
  // field.
  const rating = figure(prospect?.rating)
  const ratingCount = figure(prospect?.rating_count)
  const rated = rating !== null && ratingCount !== null
  const under =
    rated &&
    rating < SCORE_WEIGHTS.reputation.floorRating &&
    ratingCount >= SCORE_WEIGHTS.reputation.floorCount
  terms.push({
    id: 'reputation',
    label: 'What its customers say',
    chip: under ? 'Poorly Rated' : rated ? 'Nothing Against It' : 'Unrated',
    reading: under ? 'under' : rated ? 'sound' : 'unread',
    points: under ? SCORE_WEIGHTS.reputation.under : 0,
  })

  // Only the rings that reached nobody at all. A gatekeeper answered the
  // phone, which is progress rather than a failed try, and it is already
  // counted the other way by the reached term.
  const unanswered = (calls ?? []).filter(
    call => call?.outcome === 'no_answer' || call?.outcome === 'voicemail'
  ).length
  const attemptPoints = Math.max(
    unanswered * SCORE_WEIGHTS.attempts.each,
    SCORE_WEIGHTS.attempts.floor
  )
  terms.push({
    id: 'attempts',
    label: 'Rings nobody picked up',
    chip: unanswered === 1 ? 'Rung Once' : `Rung ${unanswered} Times`,
    reading: String(unanswered),
    points: attemptPoints,
  })

  const raw = terms.reduce((sum, term) => sum + term.points, 0)
  return { score: Math.min(SCORE_PEAK, Math.max(0, raw)), raw, terms }
}

/** The terms worth putting in a row, which is the two best and every penalty. */
export function tellingTerms(terms) {
  const positives = (terms ?? [])
    .filter(term => term.points > 0)
    .sort((a, b) => b.points - a.points)
  const negatives = (terms ?? []).filter(term => term.points < 0)
  return [...positives.slice(0, 2), ...negatives]
}

// ── The order to work it in ────────────────────────────────────────────────

/**
 * Where a business falls in the order, lowest first.
 *
 * Three bands and the enders, and the order between them is a working day
 * rather than a ranking of quality.
 *
 * A promise that has come due leads everything, because somebody named that
 * time themselves and it is the one appointment on the page. Then everything
 * there is to call, best score first - fresh and ready together, in one band,
 * which is the change that makes the score mean anything. Then the businesses
 * waiting out a gap, soonest back first, which are not in the working list at
 * all. Then the ones a person finished with.
 *
 * The never-called wall is gone deliberately. It used to hold a busy welding
 * shop rung once on Tuesday below an unread notary nobody had tried, and it
 * stranded every ready row a thousand places down where paging would not reach
 * it for months. The attempts term carries that difference now, at eight
 * points a ring rather than as an absolute band.
 *
 * @param {object} row A prospect carrying `place`, `score` and `ready_at`.
 * @param {Date} [now]
 * @returns {number} Lower sorts first.
 */
export function callRank(row, now = new Date()) {
  const place = row?.place ?? callPlace(row, now)
  if (place === 'booked' || place === 'closed') return 5000
  if (place === 'due') return (instant(row?.ready_at) ?? now).getTime() / 1e12
  if (place === 'resting' || place === 'promised') {
    return 3000 + (instant(row?.ready_at) ?? now).getTime() / 1e12
  }
  return 1000 + (SCORE_PEAK - (row?.score ?? 0))
}

/**
 * How two businesses level on rank are separated.
 *
 * The least findable first, read against its own trade rather than on the raw
 * count, because the bands are wide and a listing with three reviews where its
 * trade has forty is further down the search than one with thirty. A listing
 * that could not be read sits behind every one that could. Then the oldest
 * listing, which has been waiting longest; then the id, so the order is total
 * and a page boundary cannot show one business twice or none.
 */
export function byCallOrder(now = new Date()) {
  return (one, two) => {
    const rank = callRank(one, now) - callRank(two, now)
    if (rank) return rank
    const found = (one.pull_ratio ?? Infinity) - (two.pull_ratio ?? Infinity)
    if (found) return found
    const filed = String(one.created_at ?? '').localeCompare(String(two.created_at ?? ''))
    if (filed) return filed
    return String(one.id ?? '').localeCompare(String(two.id ?? ''))
  }
}

// ── Why a business is on the list at all ───────────────────────────────────

/**
 * Why this business is on the call list, as a sentence.
 *
 * The row already carries the answer and has never shown it: `skip_reason` is
 * the enrichment job's own words for why it gave up - 'no website listed', or
 * 'the facebook.com profile links no address' - and it was written into a
 * column nobody reads. The user's first question about this page was why these
 * people are here, and the answer has been in the payload the whole time.
 *
 * @returns {string} A sentence in the studio's own register, never empty.
 */
export function whyListed(prospect) {
  const presence = presenceOf(prospect)
  if (presence === 'none') {
    return 'Their Google listing names no website at all, so the sender had nowhere to look for an address.'
  }
  if (presence === 'portal') {
    return 'Their Google listing points at a directory somebody else put them in, which prints its own address rather than theirs.'
  }
  if (presence === 'booking') {
    return 'Their Google listing points at a booking page they pay for and do not own, which prints the platform’s support address rather than theirs.'
  }
  return 'Their Google listing points at a page on somebody else’s platform, which prints no address of their own.'
}
