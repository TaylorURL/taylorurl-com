/**
 * The businesses that can only be reached by picking up the phone: who may be
 * rung at all, what a call can come to, and what each outcome does next.
 *
 * The cold email pipeline ends at an address, and roughly a fifth of what the
 * map sweep finds has no address to end at: the listing names no website at
 * all, or names a Facebook page, a Linktree or a Square booking page that
 * prints somebody else's support inbox. Those rows stop at 'unreachable', and
 * every one of them carries the phone number off the same Places search that
 * found it. The call list is how they are reached.
 *
 * The order the list is worked in is scored in `callScore.js` and the list's
 * own quality rules live in `callList.js`. This file holds the rules both the
 * endpoint and the console page read: who must never be rung, what a listing's
 * reviews say against its trade, the outcomes, and the day's goal.
 *
 * Strings and pure functions only. The console imports it into the browser
 * bundle, so a database, a network call or a date formatter here would break
 * that bundle. It returns instants and numbers; every dated sentence is
 * composed by the page, in the studio's own zone.
 */

import { isOperating } from './youth.js'
import { callOwed } from '../sending/desk-step.js'
import { BOOKING_HOSTS, PORTAL_HOSTS, hostOf, platformOf } from './platforms.js'

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
export const PAST_CALLING = Object.freeze(['unsubscribed', 'skipped', 'replied'])

/**
 * What `outreach_prospects.source` says on a row the new-business pipeline
 * mirrored there: `MIRROR_SOURCE` in lib/new-business/mirror.js, spelled out
 * here because that file reads the state's filings and this one is bundled
 * into the browser. The call list check holds the two to the same word.
 */
export const NEW_BUSINESS_SOURCE = 'new-business'

/** Whether a row is a company the new-business pipeline found off the state's filings. */
export function isNewBusiness(prospect) {
  return prospect?.source === NEW_BUSINESS_SOURCE
}

/**
 * Why a business is not on the call list, or null where it is.
 *
 * A sentence rather than a boolean, because the one thing anybody asks about a
 * business missing from the list is why.
 *
 * @param {object} prospect A row of `outreach_prospects`.
 * @returns {string|null} What keeps it off, or null if nothing does.
 */
export function uncallableReason(prospect) {
  if (!prospect) return 'there is no business here'
  if (!String(prospect.phone ?? '').trim()) return 'the listing carries no phone number'
  // A business with a site of its own is written to rather than rung, because
  // there is an address to write to and a letter costs nobody's afternoon.
  //
  // Unless a chain has asked for the call. The broken-site chain rings on its
  // middle step: the owner of a site that has stopped working may not be
  // reading the inbox the letter went to. `call_due_at` is the chain saying so.
  //
  // And never for a new company. It is weeks old, the founder is the one who
  // answers, and a letter to a site put up last month is the least likely to
  // be read; so a new business with a number is on the list whatever its site,
  // whether or not it has been written to.
  if (
    prospect.site_kind !== 'none' &&
    prospect.site_kind !== 'social' &&
    !isNewBusiness(prospect) &&
    !callOwed(prospect)
  ) {
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
 * a `tel:` href carrying brackets and spaces is one some dialers refuse. The
 * spelling on screen stays the readable one; only the href is flattened.
 */
export function dialHref(phone) {
  const digits = String(phone ?? '').replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}

// ── What the trade says ────────────────────────────────────────────────────

/**
 * Reviews added to both sides of the ratio before the division.
 *
 * Review counts are not comparable across trades: a restaurant collects
 * reviews from every table it turns, a machine shop from the two customers a
 * year who think to leave one. So the reading is the count against the middle
 * count for that same trade, and adding ten to both sides keeps a trade whose
 * middle is two from turning four reviews into "twice its trade".
 *
 * The same ten the database ranking uses, so the page and the order agree.
 */
const REVIEW_PRIOR = 10

/** Where a listing stops being ordinary for its trade and starts being busy. */
const BUSY_FLOOR = 1.75
/** Where a listing stops being ordinary and starts reading as unfound. */
const QUIET_CEILING = 0.5

/**
 * How many reviews a listing has, or null where nobody has read that.
 *
 * Google leaves the count off a listing nobody has reviewed rather than sending
 * a zero, so an absent count is two different facts. The sweep asks for the
 * count and the business status in the one request: a listing carrying a
 * status and no count is one Google answered for with no reviews on it, and a
 * listing carrying neither is one nothing asked about.
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
 * @param {number|null} median The middle review count for the same trade, or
 *   null where the trade has too few listings to say.
 * @returns {number|null} The ratio, or null where either end is unread.
 */
export function pullOf(prospect, median) {
  const count = reviewsOf(prospect)
  if (count === null) return null
  if (typeof median !== 'number' || !Number.isFinite(median) || median <= 0) return null
  return (count + REVIEW_PRIOR) / (median + REVIEW_PRIOR)
}

/**
 * How the listing reads for its trade: `busy`, `steady`, `quiet`, or `unread`.
 *
 * `quiet` is a business that has traded for years and collected a fraction of
 * what its neighbours collected - a business nobody can find, which is the
 * thing being sold. `busy` is already being found.
 */
export function pullBand(prospect, median) {
  const pull = pullOf(prospect, median)
  if (pull === null) return 'unread'
  if (pull >= BUSY_FLOOR) return 'busy'
  if (pull <= QUIET_CEILING) return 'quiet'
  return 'steady'
}

/**
 * What the business has instead of a site: `booking`, `social`, `portal`, or
 * `none`.
 *
 * On the phone these are different openings. A business on Booksy or Square
 * already pays somebody a monthly for software; one with a Facebook page has
 * settled for a page it does not own; one with nothing at all is the cleanest
 * pitch; and a profile on Yelp or the BBB is somebody else's listing of them.
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
 * What a call came to.
 *
 * `offered` marks the seven results the Call List offers, in the order they
 * are drawn. The other three are still read, because calls placed before the
 * list was rebuilt carry them and the column's check constraint still allows
 * them, but nothing records them any more.
 *
 * `ends` marks an outcome after which the business comes off the list for
 * good. `keeps` marks the ones that carry a time to ring back. `asks` and
 * `interest` are the two halves of whether anybody on the other end wanted
 * this: `interest` is the outcome answering for itself, and `asks` marks the
 * conversations where it cannot - Owner Answered covers both the owner who
 * asked what it costs and the owner who said no thanks.
 *
 * `pickedUp` marks a call somebody at the business answered, which is what the
 * list's measured readings count (see `callScore.js`). `frontDesk` marks the
 * one where that somebody was not the owner: Front Desk asks who the owner is,
 * when they are in and a number that reaches them, and books the call back for
 * that time. Nobody who could buy was on the line, so it is not a lead and it
 * says nothing about interest.
 *
 * Owner Answered and Front Desk are stored as `spoke` and `gatekeeper`, the
 * words the column was built with, so every call already on the record reads
 * under its new name.
 */
export const CALL_OUTCOMES = Object.freeze(
  [
    { id: 'spoke', label: 'Owner Answered', asks: true, pickedUp: true, offered: true },
    {
      id: 'gatekeeper',
      label: 'Front Desk',
      keeps: true,
      pickedUp: true,
      frontDesk: true,
      offered: true,
    },
    { id: 'no_answer', label: 'No Answer', offered: true },
    { id: 'voicemail', label: 'Voicemail', offered: true },
    {
      id: 'callback',
      label: 'Call Back',
      keeps: true,
      interest: true,
      pickedUp: true,
      offered: true,
    },
    {
      id: 'not_interested',
      label: 'Not Interested',
      ends: true,
      interest: false,
      pickedUp: true,
      offered: true,
    },
    { id: 'wrong_number', label: 'Bad Number', ends: true, offered: true },
    // Recorded by the old call desk and still on the record.
    { id: 'audit_booked', label: 'Audit Booked', keeps: true, interest: true, pickedUp: true },
    { id: 'booked', label: 'Booked', ends: true, interest: true, pickedUp: true },
    { id: 'bad_lead', label: 'Bad Lead', ends: true },
  ].map(Object.freeze)
)

/** The stored value of Front Desk. */
export const FRONT_DESK = 'gatekeeper'

/** Every outcome the column will accept. */
export const OUTCOME_IDS = Object.freeze(CALL_OUTCOMES.map(outcome => outcome.id))

/** The outcomes a call can be recorded with now, in the order they are drawn. */
export const OFFERED_OUTCOMES = Object.freeze(
  CALL_OUTCOMES.filter(outcome => outcome.offered).map(outcome => outcome.id)
)

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

/** Whether an outcome is the one that asks after the owner: a name and a number. */
export function outcomeAsksOwner(id) {
  return Boolean(outcomeOf(id)?.frontDesk)
}

/**
 * Whether the call found somebody who wanted this: true, false, or null where
 * nobody who could have wanted it was reached.
 *
 * Null is the third answer rather than a missing one. A number that rang out is
 * not a business that said no.
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
 * Two halves, and both have to hold: the call reached somebody who could have
 * wanted this, and nothing said they did not. The interest answer only ever
 * takes a business out, so a conversation nobody answered for still arrives as
 * a lead.
 */
export function callMakesLead(outcome, answered = null) {
  const held = outcomeOf(outcome)
  if (!held) return false
  const reached = Boolean(held.asks) || typeof held.interest === 'boolean'
  return reached && interestIn(outcome, answered) !== false
}

// ── When it comes back ─────────────────────────────────────────────────────

/**
 * How far out a call back lands when nobody named a time: a day, the shortest
 * gap that reaches a different shift at the business.
 */
export const CALLBACK_DEFAULT_HOURS = 24

/** A length out from now, as an instant. */
export function callbackIn(hours, now = new Date()) {
  return new Date(now.getTime() + hours * 3_600_000)
}

/** Where an untimed call back lands. */
export function defaultCallbackAt(now = new Date()) {
  return callbackIn(CALLBACK_DEFAULT_HOURS, now)
}

/**
 * The lengths a call back can be set for in one press. Anything else is typed
 * as a date and time.
 */
export const CALLBACK_LENGTHS = Object.freeze(
  [
    { hours: 2, label: 'In Two Hours' },
    { hours: 24, label: 'Tomorrow' },
    { hours: 72, label: 'In Three Days' },
    { hours: 168, label: 'Next Week' },
    { hours: 336, label: 'In Two Weeks' },
  ].map(Object.freeze)
)

/**
 * One call, in the shape the endpoint takes it.
 *
 * Call Back and Front Desk carry a time - a length from now, or an instant
 * typed in - and an outcome that ends the list never does: a business that is
 * off the list does not come back to one. Front Desk alone carries the owner's
 * name and a number that reaches them, where the front desk gave either.
 *
 * @param {{id: string, outcome: string, hours?: number|null, at?: string|null,
 *   note?: string, ownerName?: string, ownerPhone?: string}} answered What was pressed.
 * @returns {{id: string, outcome: string, note: string|null, callback_at: string|null,
 *   owner_name?: string|null, owner_phone?: string|null}}
 */
export function callBody({
  id,
  outcome,
  hours = null,
  at = null,
  note = '',
  ownerName = '',
  ownerPhone = '',
}) {
  const text = String(note ?? '').trim()
  const keeps = outcomeTakesCallback(outcome)
  const when = keeps && at ? new Date(at) : keeps && hours ? callbackIn(hours) : null
  const body = {
    id,
    outcome,
    note: text || null,
    callback_at: when && !Number.isNaN(when.getTime()) ? when.toISOString() : null,
  }
  if (outcomeAsksOwner(outcome)) {
    body.owner_name = String(ownerName ?? '').trim() || null
    body.owner_phone = String(ownerPhone ?? '').trim() || null
  }
  return body
}

// ── The day ────────────────────────────────────────────────────────────────

/** Calls the owner means to make in one day, the studio's day in Central. */
export const DAILY_CALL_GOAL = 50

/**
 * The day so far against the goal, in words: "12 of 50 calls today".
 *
 * @param {number} made Calls recorded today.
 * @param {number} [goal]
 */
export function dayLine(made, goal = DAILY_CALL_GOAL) {
  const count = Math.max(0, Math.round(Number(made) || 0))
  return `${count} of ${goal} ${goal === 1 ? 'call' : 'calls'} today`
}

/**
 * How far along the day is, 0 to 100, for the bar under that line. It stops
 * at the end of the bar: a fifty-first call is still a full day.
 */
export function dayShare(made, goal = DAILY_CALL_GOAL) {
  if (!goal) return 0
  return Math.min(100, Math.max(0, (Number(made) || 0) / goal) * 100)
}

/**
 * The number to ring with the person it should reach and how sure that is:
 * "(281) 487-0264 · Mike Dorsett · Owner’s cell · confirmed", or the number
 * alone where nobody's name is on file.
 *
 * @param {string|null} phone The number as it is written.
 * @param {string|null} [name] The owner's name.
 * @param {string|null} [label] What `ownerLabel` says about the owner.
 */
export function numberLine(phone, name, label = null) {
  return [phone, name, label]
    .map(part => String(part ?? '').trim())
    .filter(Boolean)
    .join(' · ')
}

/**
 * What is known about the owner, said beside the owner's name: "Owner’s cell
 * · confirmed" or "Owner’s cell · unconfirmed" where there is a number for
 * the owner - which is the number the list dials - and "Owner’s name ·
 * confirmed" where there is only a name, and two sources agree on it.
 * Nothing where neither applies. A value is confirmed when two independent
 * sources agree on it.
 *
 * @param {{owner_phone?: string|null, owner_phone_confirmed?: boolean,
 *   owner_name?: string|null, owner_name_confirmed?: boolean}} row As the
 *   endpoint draws it: `owner_phone` is only ever a number for the owner other
 *   than the listing's own.
 * @returns {string|null}
 */
export function ownerLabel(row) {
  if (String(row?.owner_phone ?? '').trim()) {
    return `Owner’s cell · ${row.owner_phone_confirmed === true ? 'confirmed' : 'unconfirmed'}`
  }
  if (String(row?.owner_name ?? '').trim() && row?.owner_name_confirmed === true) {
    return 'Owner’s name · confirmed'
  }
  return null
}

/**
 * The three scores a business is ranked by, in words: "Owner 80 · Need 90 ·
 * Budget 60". What each one reads is in `callScore.js`.
 *
 * @param {{owner: number, need: number, budget: number}|null} score
 * @returns {string|null}
 */
export function scoreWords(score) {
  if (!score) return null
  return `Owner ${score.owner} · Need ${score.need} · Budget ${score.budget}`
}
