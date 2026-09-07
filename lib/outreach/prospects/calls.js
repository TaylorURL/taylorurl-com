/**
 * The businesses that can only be reached by picking up the phone, and the
 * order to work through them in.
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
 * So this file answers three questions and nothing else. Whether a row belongs
 * on a call list. How much trade its listing proves, which is what decides the
 * order. And what a call to it came to.
 *
 * Strings and pure functions only. The console imports it into the browser
 * bundle beside `youth.js` and `segments.js`, and a database or network
 * dependency here would break that bundle the way it would break theirs.
 */

import { isOperating } from './youth.js'

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

/**
 * How much trade a listing proves, measured against its own trade rather than
 * against every trade at once.
 *
 * Review counts are not comparable across trades and reading them as though
 * they were is the one mistake that would make this list useless. A restaurant
 * collects reviews from every table it turns; a machine shop collects them from
 * the two customers a year who think to leave one. Ranking the raw count puts
 * sixty restaurants at the top and buries a welding shop that has quietly
 * outperformed every welding shop in the county - and the welding shop is the
 * better call, because it can afford the work and nobody else has thought to
 * ring it.
 *
 * So the reading is the count over the middle count for that trade. One is an
 * ordinary business of its kind, three is one of the busiest in the county, and
 * a fifth is a listing nobody has found. That number is comparable across
 * trades in a way the count itself never is.
 *
 * @param {object} prospect A row carrying `rating_count`.
 * @param {number|null} median The middle review count among callable
 *   businesses in the same trade, or null where the trade has too few to say.
 * @returns {number|null} The ratio, or null where either end is unread.
 */
export function pullOf(prospect, median) {
  const count = prospect?.rating_count
  if (typeof count !== 'number' || !Number.isFinite(count)) return null
  if (typeof median !== 'number' || !Number.isFinite(median) || median <= 0) return null
  return count / median
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
 * How the listing reads for its trade: `busy`, `steady`, `quiet`, or `unread`.
 *
 * `quiet` is not a weak lead and must not be read as one. A business that has
 * traded for years and collected a tenth of what its neighbours collected is a
 * business nobody can find, which is the entire thing being sold. It sorts
 * below `busy` because a busy business has money in the till this month, not
 * because a quiet one is a bad call.
 */
export function pullBand(prospect, median) {
  const pull = pullOf(prospect, median)
  if (pull === null) return 'unread'
  if (pull >= BUSY_FLOOR) return 'busy'
  if (pull <= QUIET_CEILING) return 'quiet'
  return 'steady'
}

/**
 * What a call came to. The order is the order a call goes wrong in, and the
 * two that end a business's place on the list are last.
 *
 * `ends` marks an outcome after which the business comes off the list: one has
 * said no, and the other has said yes, and ringing either again is the list
 * failing at the only job it has. Everything else leaves the row on it.
 *
 * `keeps` marks an outcome that expects a callback time. The console asks for
 * one where it is set and the endpoint refuses the write without it, because a
 * callback with no time on it is a promise nothing will ever surface again.
 */
export const CALL_OUTCOMES = Object.freeze([
  { id: 'no_answer', label: 'No Answer', tone: 'plain' },
  { id: 'voicemail', label: 'Left Voicemail', tone: 'plain' },
  { id: 'gatekeeper', label: 'Gatekeeper', tone: 'plain' },
  { id: 'spoke', label: 'Spoke To Owner', tone: 'accent' },
  { id: 'callback', label: 'Call Back', tone: 'accent', keeps: true },
  { id: 'not_interested', label: 'Not Interested', tone: 'bad', ends: true },
  { id: 'wrong_number', label: 'Wrong Number', tone: 'bad', ends: true },
  { id: 'booked', label: 'Booked', tone: 'good', ends: true },
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

/** Whether an outcome is one that has to name a time to ring back. */
export function outcomeNeedsCallback(id) {
  return Boolean(outcomeOf(id)?.keeps)
}

/**
 * Where a business falls in the order to work the list in, lowest first.
 *
 * Four groups, and the order between them is the order a working day runs in
 * rather than a ranking of quality.
 *
 * A callback that has come due leads everything, because somebody named that
 * time themselves and it is the one appointment on the page. Then the numbers
 * nobody has tried, busiest of their trade first, which is the cold work.
 * Then the ones tried and not yet reached, oldest attempt first, so a number
 * rung this morning is not rung again this afternoon. A business that has said
 * no or said yes is off the list entirely and never reaches this.
 *
 * @param {object} row A prospect carrying `calls` - its call history, newest
 *   first - and `pullBand`, the reading taken for its trade.
 * @param {Date} [now] The moment the list is being read at.
 * @returns {number} Lower sorts first.
 */
export function callRank(row, now = new Date()) {
  const last = row?.calls?.[0] ?? null
  const due = row?.callback_at ? new Date(row.callback_at) : null

  if (due && due <= now) return 0
  if (!last) return 1000 + PULLS.indexOf(row?.pull ?? 'unread')
  if (due) return 3000 + due.getTime() / 1e12
  return 2000 + new Date(last.called_at).getTime() / 1e12
}
