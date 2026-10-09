/**
 * Walks the outreach catch-up through the morning it is set for and the
 * morning after, and checks it opens, lifts and closes where it says it does.
 *
 * The catch-up is a dated setting rather than a code path anybody exercises
 * by hand, so the only time its arithmetic is read in production is the
 * morning it matters. The cases below are that morning, written as the send
 * job reads it: the window at 07:05 with the catch-up set and without it, the
 * letters one run carries against SEND_PER_RUN_MAX and the day's cap, the
 * follow-ups against FOLLOW_UPS_PER_RUN and FOLLOW_UP_LIMIT, and the same
 * questions asked of the next day, when it has closed by itself.
 *
 *   node scripts/outreach/sending/check-catch-up.js
 */
import {
  catchUpOf,
  firstLettersFor,
  followUpsFor,
  owedBefore,
} from '../../../lib/outreach/sending/catch-up.js'
import {
  FOLLOW_UP_LIMIT,
  FOLLOW_UPS_PER_RUN,
  SEND_PER_RUN_MAX,
} from '../../../lib/outreach/sending/limits.js'
import { dueBy } from '../../../lib/outreach/sending/schedule.js'
import { sendWindow } from '../../../lib/outreach/sending/queue.js'
import { spacingFor } from '../../../api/outreach/send.js'
import { expect, finish, is } from '../../harness/checks.js'

const CAP = 50
const SET = {
  daily_cap: CAP,
  // 17:00 on Tuesday 6 October, 07:00 and 17:00 on Friday 9 October, Houston.
  catch_up_held_since: '2026-10-06T22:00:00Z',
  catch_up_from: '2026-10-09T12:00:00Z',
  catch_up_until: '2026-10-09T22:00:00Z',
}

const FRIDAY_0705 = new Date('2026-10-09T12:05:00Z')
const SATURDAY_0705 = new Date('2026-10-10T12:05:00Z')

/** The day's own allowance at a moment, as `firstLetters` works it out. */
const allowanceAt = (now, already = 0) =>
  Math.min(Math.max(Math.min(CAP, dueBy(CAP, now)) - already, 0), SEND_PER_RUN_MAX)

/** A queue of held first letters ahead of fresh ones, in the order `queueFor` gives. */
const HELD_FIRST = 44
const queue = [
  ...Array.from({ length: HELD_FIRST }, (_, index) => ({ id: `held-${index}` })),
  ...Array.from({ length: 30 }, (_, index) => ({ id: `fresh-${index}` })),
]

/**
 * The chain as the morning finds it: follow-ups each failure pushed past the
 * opening, follow-ups due before it that no run reached, and the day's own due
 * later on.
 */
const PUSHED = 428
const UNREACHED = 62
const LATER = 47
const chain = [
  ...Array.from({ length: UNREACHED }, (_, index) => ({
    id: `unreached-${index}`,
    step: 1,
    next_due_at: '2026-10-08T14:10:00Z',
  })),
  ...Array.from({ length: PUSHED }, (_, index) => ({
    id: `pushed-${index}`,
    step: 1,
    next_due_at: '2026-10-09T18:00:00Z',
  })),
  ...Array.from({ length: LATER }, (_, index) => ({
    id: `later-${index}`,
    step: 1,
    next_due_at: '2026-10-09T19:00:00Z',
  })),
]

/** What `heldOf` reads for that morning. */
const held = {
  firstLetters: new Set(queue.filter(row => row.id.startsWith('held')).map(row => row.id)),
  followUps: new Map(
    chain.filter(row => row.id.startsWith('pushed')).map(row => [row.id, new Set([2])])
  ),
  prospects: new Set(),
}

// ── Friday 07:05, with the catch-up set ──────────────────────────────────

const friday = catchUpOf(SET, FRIDAY_0705)
expect(friday.active, 'the catch-up is open at 07:05 on the morning it is set for')
expect(friday.today, 'the catch-up counts its day from 07:05')
expect(
  sendWindow(FRIDAY_0705, friday).open,
  'the send window is open at 07:05 with the catch-up set'
)
expect(
  !sendWindow(FRIDAY_0705).open,
  'the send window is shut at 07:05 without it, so the catch-up is what opened it'
)

// The send job derives the backlog only while the catch-up is open.
const fridayBacklog = friday.active ? held : null
const fridayAllowance = allowanceAt(FRIDAY_0705)
is('the day’s own allowance at 07:05, before the first slot', fridayAllowance, 0)
const fridayRun = firstLettersFor(queue, fridayAllowance, fridayBacklog).run
is('first letters one run carries at 07:05', fridayRun.length, HELD_FIRST)
expect(
  fridayRun.length > SEND_PER_RUN_MAX,
  `the held first letters are not cut to SEND_PER_RUN_MAX (${SEND_PER_RUN_MAX})`
)
expect(
  fridayRun.every(row => held.firstLetters.has(row.id)),
  'nothing but held letters goes before the day’s own first slot'
)

// Later that morning the day's own letters join at their own pace, behind the
// held ones, and the cap they are paced by is untouched by the backlog.
const tenOClock = new Date('2026-10-09T15:05:00Z')
const tenRun = firstLettersFor(queue, allowanceAt(tenOClock), fridayBacklog).run
expect(
  tenRun.length - HELD_FIRST <= SEND_PER_RUN_MAX,
  'the day’s own first letters stay within SEND_PER_RUN_MAX beside the backlog'
)
expect(
  tenRun.slice(0, HELD_FIRST).every(row => held.firstLetters.has(row.id)),
  'the held first letters go ahead of the day’s own'
)

const { back, rest } = followUpsFor(chain, held, friday, FRIDAY_0705, FOLLOW_UP_LIMIT)
is('held follow-ups at 07:05', back.length, PUSHED + UNREACHED)
expect(
  back.length > FOLLOW_UPS_PER_RUN && back.length > FOLLOW_UP_LIMIT,
  `the held follow-ups are not cut to FOLLOW_UPS_PER_RUN (${FOLLOW_UPS_PER_RUN}) or FOLLOW_UP_LIMIT (${FOLLOW_UP_LIMIT})`
)
is('the day’s own follow-ups due at 07:05', rest.length, 0)
expect(
  !back.some(row => row.id.startsWith('later')),
  'a follow-up due later on Friday that no refusal touched is not part of the backlog'
)
is('a backlog run spaces its sends at the floor', spacingFor(back.length), 3_000)

// A follow-up that went is owed the next step, which no failed row names.
expect(
  !owedBefore({ id: 'pushed-0', step: 2, next_due_at: '2026-10-23T12:10:00Z' }, held, friday),
  'a held follow-up that went is not held again'
)

// ── Friday's other edges ─────────────────────────────────────────────────

const beforeSeven = catchUpOf(SET, new Date('2026-10-09T11:55:00Z'))
expect(!beforeSeven.active, 'the catch-up is shut at 06:55')
expect(!sendWindow(new Date('2026-10-09T11:55:00Z'), beforeSeven).open, 'nothing goes at 06:55')

const atFive = new Date('2026-10-09T22:00:00Z')
expect(!catchUpOf(SET, atFive).active, 'the catch-up is shut at 17:00, when it was set to end')
expect(!sendWindow(atFive, catchUpOf(SET, atFive)).open, 'the window shuts at 17:00 as usual')

const refused = { ...SET, catch_up_until: '2026-10-09T12:30:00Z' }
const afterRefusal = catchUpOf(refused, new Date('2026-10-09T13:00:00Z'))
expect(!afterRefusal.active, 'a catch-up a refusal ended is shut from that moment')
expect(afterRefusal.today, 'its held letters stay out of that day’s cap after it ends')

expect(!catchUpOf({}, FRIDAY_0705).active, 'no catch-up set is no catch-up')
expect(
  !catchUpOf({ ...SET, catch_up_held_since: SET.catch_up_from }, FRIDAY_0705).active,
  'a catch-up with nothing held before it is no catch-up'
)

// ── Saturday 07:05, the day after ────────────────────────────────────────

const saturday = catchUpOf(SET, SATURDAY_0705)
expect(!saturday.active, 'the catch-up is shut on the morning after')
expect(!saturday.today, 'the morning after is not the catch-up’s day')
expect(!sendWindow(SATURDAY_0705, saturday).open, 'the send window is shut at 07:05 on Saturday')

const saturdayBacklog = saturday.active ? held : null
expect(saturdayBacklog === null, 'the send job reads no backlog on Saturday')
const saturdayTen = new Date('2026-10-10T15:05:00Z')
const saturdayRun = firstLettersFor(queue, allowanceAt(saturdayTen), saturdayBacklog).run
expect(
  saturdayRun.length <= SEND_PER_RUN_MAX,
  `a Saturday run is back within SEND_PER_RUN_MAX (${SEND_PER_RUN_MAX})`
)
is(
  'a Saturday run is the head of the queue cut to the allowance',
  saturdayRun.map(row => row.id).join(),
  queue
    .slice(0, allowanceAt(saturdayTen))
    .map(row => row.id)
    .join()
)

await finish()
console.log(
  'the catch-up opens the window at 07:00 on its morning, carries every held first letter\n' +
    '  and follow-up past the per-run limits and the cap while the day’s own keep their pace,\n' +
    '  ends at its set time or at a refusal, and leaves the next morning at the normal pace'
)
