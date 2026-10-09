/**
 * A one-off catch-up, for a stretch when the mailbox refused every login and
 * what it held back has to go out together once it accepts again.
 *
 * It is a dated setting rather than a constant: four columns on
 * `outreach_settings`, read by every sender that leaves from the mailbox.
 *
 *   catch_up_held_since  When the refusals began. A letter written from here
 *                        until the catch-up opens is one the refusals held back.
 *   catch_up_from        When the catch-up opens. On that day the send window
 *                        opens here rather than at OPENS.
 *   catch_up_until       When it closes, whatever is left.
 *   catch_up_stopped     Why it closed early, where a refusal closed it.
 *
 * While it is open, the held letters go without the day's cap and without the
 * per-run counts, bounded only by the run's own time budget and the spacing
 * between sends. Anything written after it opened keeps the normal pace, and
 * the held letters that went are left out of the day's count, so the backlog
 * does not spend the day's own allowance.
 *
 * It ends on its own. Past `catch_up_until` none of this reads as open and every
 * sender is back on its normal pace with nothing to undo. A refusal from the
 * mail server ends it sooner: the first send the server refuses closes the
 * catch-up for every sender, because a mailbox that has started refusing again
 * is the one thing a backlog must not keep knocking on.
 *
 * The preview pipeline on the Pi reads the same four columns and applies the
 * same rules to the preview letters it sends.
 */

import { readAll } from '../../db/rows.js'
import { dayIn } from '../../time/zone.js'

/** What every reader gets when no catch-up is set, or the one set is unreadable. */
const NONE = Object.freeze({ active: false, today: false })

const instantOf = value => {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * The catch-up as the settings hold it, read at one moment.
 *
 * `active` is the stretch the lifted limits apply in. `today` is the whole of
 * the day it opened on, from the moment it opened: the held letters that went
 * are kept out of that day's count even once it has closed, so a catch-up
 * ended early by a refusal does not leave the day's own letters short.
 *
 * @param {object} settings The `outreach_settings` row.
 * @param {Date} [now]
 * @returns {{active: boolean, today: boolean, from?: string, until?: string, heldSince?: string}}
 */
export function catchUpOf(settings, now = new Date()) {
  const from = instantOf(settings?.catch_up_from)
  const until = instantOf(settings?.catch_up_until)
  const since = instantOf(settings?.catch_up_held_since)
  if (from === null || until === null || since === null || since >= from) return NONE
  const moment = now.getTime()
  return {
    active: moment >= from && moment < until,
    today: moment >= from && dayIn(new Date(from)) === dayIn(now),
    from: new Date(from).toISOString(),
    until: new Date(until).toISOString(),
    heldSince: new Date(since).toISOString(),
  }
}

/**
 * The letters the refusals held back, as the prospects they were for.
 *
 * A letter is held when its row was written between `heldSince` and the moment
 * the catch-up opened. Every send in that stretch failed, so a row from it is
 * either a failed attempt or a draft the unspent cap let a run write, and both
 * are letters that would have gone had the mailbox taken them. The step on the
 * row says which letter it was: 1 is a first letter, 2 and on are follow-ups,
 * and none is a preview letter, which is also held while its site was
 * registered before the catch-up opened and had not gone by then.
 *
 * @param {object} db A service-role client.
 * @param {{from: string, heldSince: string}} catchUp
 * @returns {Promise<{firstLetters: Set<string>, followUps: Map<string, Set<number>>, prospects: Set<string>}>}
 */
export async function heldOf(db, catchUp) {
  const [messages, previews] = await Promise.all([
    readAll(() =>
      db
        .from('outreach_messages')
        .select('prospect_id, step', { count: 'exact' })
        .eq('direction', 'outbound')
        .gte('created_at', catchUp.heldSince)
        .lt('created_at', catchUp.from)
        .order('id')
    ),
    readAll(() =>
      db
        .from('preview_sites')
        .select('prospect_id')
        .not('prospect_id', 'is', null)
        .lt('created_at', catchUp.from)
        .or(`sent_at.is.null,sent_at.gte.${catchUp.from}`)
        .order('id')
    ),
  ])

  const firstLetters = new Set()
  const followUps = new Map()
  const prospects = new Set()
  for (const row of messages.rows) {
    if (!row.prospect_id) continue
    prospects.add(row.prospect_id)
    if (row.step === 1) firstLetters.add(row.prospect_id)
    else if (row.step >= 2) {
      if (!followUps.has(row.prospect_id)) followUps.set(row.prospect_id, new Set())
      followUps.get(row.prospect_id).add(row.step)
    }
  }
  for (const row of previews.rows) prospects.add(row.prospect_id)
  return { firstLetters, followUps, prospects }
}

/**
 * Whether a business on the chain is owed a follow-up the refusals held back.
 *
 * Two ways in. A follow-up that came due before the catch-up opened is one the
 * mailbox should already have carried, whether or not a run reached it. And a
 * follow-up attempted during the refusals had its due date pushed a day on by
 * each failure, so it can read as due later than it was; the failed row for the
 * very step the business is owed is what says it was held.
 *
 * @param {{id: string, step?: number|null, next_due_at?: string|null}} prospect
 * @param {{followUps: Map<string, Set<number>>}} held
 * @param {{from: string}} catchUp
 * @returns {boolean}
 */
export function owedBefore(prospect, held, catchUp) {
  if (!prospect?.next_due_at) return false
  if (Date.parse(prospect.next_due_at) < Date.parse(catchUp.from)) return true
  return held.followUps.get(prospect.id)?.has((prospect.step ?? 1) + 1) ?? false
}

/**
 * The first letters one run carries: every held letter still in the queue,
 * then the day's own allowance out of what is left.
 *
 * With no catch-up open `backlog` is null and this is the head of the queue
 * cut to the allowance, as a run has always taken it.
 *
 * @param {object[]} queue What `queueFor` answered, in order.
 * @param {number} allowance The day's own letters this run may carry.
 * @param {{firstLetters: Set<string>}|null} backlog The held letters, while open.
 * @returns {{back: object[], run: object[]}}
 */
export function firstLettersFor(queue, allowance, backlog) {
  const back = backlog ? queue.filter(prospect => backlog.firstLetters.has(prospect.id)) : []
  const fresh = backlog ? queue.filter(prospect => !backlog.firstLetters.has(prospect.id)) : queue
  return { back, run: back.concat(fresh.slice(0, Math.max(allowance, 0))) }
}

/**
 * The follow-ups one run works through while a catch-up is open: every held
 * one first, then the day's own that have come due, to the normal read limit.
 *
 * @param {object[]} chain Businesses on the chain, longest waiting first.
 * @param {{followUps: Map<string, Set<number>>}} backlog
 * @param {{from: string}} catchUp
 * @param {Date} now
 * @param {number} limit The normal read limit for the day's own.
 * @returns {{back: object[], rest: object[]}}
 */
export function followUpsFor(chain, backlog, catchUp, now, limit) {
  const back = chain.filter(prospect => owedBefore(prospect, backlog, catchUp))
  const owed = new Set(back.map(prospect => prospect.id))
  const rest = chain
    .filter(prospect => !owed.has(prospect.id))
    .filter(prospect => Date.parse(prospect.next_due_at) <= now.getTime())
    .slice(0, limit)
  return { back, rest }
}

/**
 * Closes the catch-up now, with the reason.
 *
 * Called on the first send the mail server refuses while the catch-up is open.
 * It only ever brings the end forward, so two senders refused in the same
 * minute leave the earlier moment and the first reason standing.
 *
 * @param {object} db A service-role client.
 * @param {string} reason What the server said.
 * @param {Date} [now]
 */
export async function endCatchUp(db, reason, now = new Date()) {
  const at = now.toISOString()
  const { error } = await db
    .from('outreach_settings')
    .update({
      catch_up_until: at,
      catch_up_stopped: `${at}: ${String(reason ?? 'the mail server refused a send')}`.slice(
        0,
        500
      ),
    })
    .eq('id', 1)
    .gt('catch_up_until', at)
  if (error) console.error('outreach catch-up: could not close it: %s', error.message)
}
