/**
 * Walks the daily cap's ramp through every decision it can reach.
 *
 * The ramp moves how much cold mail leaves the domain, on its own, every
 * morning, and it moves it while nobody is watching. That is the point of it
 * and it is also the reason it is the piece of the pipeline least able to
 * afford being wrong: a step taken on a reading it should have refused ends
 * with the sending address burned, and there is no undo for a burned address.
 *
 * So each branch is walked rather than read. `decide` is arithmetic over a
 * settings row, a bounce record and a date, all three of which are handed to it
 * - it reads no clock and no database of its own - so a whole ramp can be run
 * here in a few milliseconds and the ones that matter are the refusals.
 *
 *   npm run check:outreach-ramp
 */
import {
  BOUNCE_ROLLS_BACK_OVER,
  BOUNCE_STEPS_UNDER,
  DAILY_CAP_MAX,
  RAMP_MIN_SENDS,
} from '../lib/outreach/limits.js'
import { decide, RAMP_CEILING, stepTo } from '../lib/outreach/ramp.js'
import { BOUNCE_DAYS } from '../lib/outreach/bounces.js'
import { localDay } from '../lib/outreach/schedule.js'

const NOW = new Date('2026-08-29T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000

/** The local date `back` days before the moment every case is decided at. */
const dayBack = back => localDay(new Date(NOW.getTime() - back * DAY_MS)).date

/**
 * A bounce record shaped the way lib/outreach/bounces.js hands one over.
 *
 * The sends are spread evenly across the closed days and today is given its
 * own row, so a case can put sending on the one day the ramp is supposed to
 * ignore and see it ignored.
 *
 * @param {{sent: number, bounced: number, today?: number}} totals
 */
function record({ sent, bounced, today = 0 }) {
  const closed = BOUNCE_DAYS - 1
  const days = []
  for (let back = closed; back >= 1; back -= 1) {
    const place = closed - back
    const share = Math.floor(sent / closed) + (place < sent % closed ? 1 : 0)
    const hit = Math.floor(bounced / closed) + (place < bounced % closed ? 1 : 0)
    days.push({ date: dayBack(back), sent: share, bounced: hit })
  }
  days.push({ date: dayBack(0), sent: today, bounced: 0 })
  return { days, window_days: BOUNCE_DAYS }
}

/** A settings row with the ramp on, clear of a halt, and sending open. */
function state(over = {}) {
  return {
    cap: 12,
    floor: 12,
    steppedOn: null,
    haltedAt: null,
    sending: true,
    enabled: true,
    now: NOW,
    ...over,
  }
}

let failed = 0

/** Records a mismatch against the run's exit code and names what was wanted. */
function expect(label, got, want) {
  if (got === want) return
  failed += 1
  console.error(`${label}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)
}

// A clean window steps, and it steps by a share of where it is rather than by
// a fixed number, so the pace is the same at the bottom of the range and the
// top.
{
  const clean = record({ sent: 200, bounced: 1 })
  const at = decide({ ...state({ cap: 12, floor: 12 }), record: clean })
  expect('clean 0.5% steps', at.action, 'step')
  expect('clean 0.5% steps to 15', at.cap, 15)
  expect('a step records the level it left as proved', at.floor, 12)

  const higher = decide({ ...state({ cap: 16, floor: 12 }), record: clean })
  expect('the step grows with the cap', higher.cap - 16 > at.cap - 12, true)
}

// Between the two thresholds nothing happens, and nothing is meant to.
for (const rate of [BOUNCE_STEPS_UNDER, 3, BOUNCE_ROLLS_BACK_OVER]) {
  const at = decide({
    ...state(),
    record: record({ sent: 1000, bounced: Math.round((rate / 100) * 1000) }),
  })
  expect(`${rate}% holds`, at.action, 'hold')
  expect(`${rate}% leaves the cap alone`, at.cap, 12)
  expect(`${rate}% does not halt`, at.halt, false)
}

// Past the rollback threshold the cap returns to the last level a clean day was
// read at, and the climb stops rather than resuming tomorrow.
{
  const bad = record({ sent: 200, bounced: 20 })
  const at = decide({ ...state({ cap: 19, floor: 15 }), record: bad })
  expect('10% rolls back', at.action, 'roll-back')
  expect('10% rolls back to the proved level', at.cap, 15)
  expect('10% halts the climb', at.halt, true)

  // A halt is what stops it starting again on its own, so the next morning has
  // to hold on the record rather than on the rate.
  const after = decide({
    ...state({ cap: 15, floor: 15, haltedAt: '2026-08-29T12:00:00.000Z' }),
    record: record({ sent: 200, bounced: 0 }),
  })
  expect('a halted ramp holds on a clean window', after.action, 'hold')
  expect('a halted ramp leaves the cap alone', after.cap, 15)

  // Never upward. A cap someone dropped by hand is not raised by a rollback.
  const under = decide({ ...state({ cap: 8, floor: 15 }), record: bad })
  expect('a rollback never raises the cap', under.cap, 8)
  expect('a rollback below the floor still halts', under.halt, true)
}

// The trap the live data sets: no bounces at all, across too little sending for
// that to mean anything. A step here would be reading an absence of evidence as
// evidence.
for (const sent of [0, 13, RAMP_MIN_SENDS - 1]) {
  const at = decide({ ...state(), record: record({ sent, bounced: 0 }) })
  expect(`${sent} clean sends does not step`, at.action, 'hold')
  expect(`${sent} clean sends leaves the cap alone`, at.cap, 12)
}
{
  const at = decide({ ...state(), record: record({ sent: RAMP_MIN_SENDS, bounced: 0 }) })
  expect(`${RAMP_MIN_SENDS} clean sends steps`, at.action, 'step')
}

// A breach is answered whatever the sample. Thin data is a reason not to climb
// and never a reason to sit at a cap a bounce has just been read at.
{
  const at = decide({ ...state({ cap: 15, floor: 12 }), record: record({ sent: 10, bounced: 1 }) })
  expect('a breach on thin data still rolls back', at.action, 'roll-back')
  expect('a breach on thin data returns to the floor', at.cap, 12)
}

// Today is never read, whatever hour the job is started at. A run fired by hand
// at noon has to reach the same answer as the scheduled one before dawn.
{
  const partial = record({ sent: 0, bounced: 0, today: 200 })
  const at = decide({ ...state(), record: partial })
  expect("today's sending is not evidence", at.action, 'hold')
  expect('today is left out of the count', at.reading.sent, 0)
}

// One step a day, so every level gets a full day of sending before the next is
// considered. The job runs before the window opens, which is what makes the
// date the whole of the day.
{
  const clean = record({ sent: 200, bounced: 0 })
  const at = decide({ ...state({ steppedOn: dayBack(0) }), record: clean })
  expect('a second step today is refused', at.action, 'hold')
  const tomorrow = decide({ ...state({ steppedOn: dayBack(1) }), record: clean })
  expect('a step yesterday does not block today', tomorrow.action, 'step')
}

// Neither ceiling can be stepped past, and the walk to the top has to actually
// arrive rather than stalling one short of it.
{
  const clean = record({ sent: 500, bounced: 0 })
  for (let cap = 0; cap <= DAILY_CAP_MAX; cap += 1) {
    const next = stepTo(cap)
    if (next > RAMP_CEILING) {
      failed += 1
      console.error(`cap ${cap} steps to ${next}, past the ${RAMP_CEILING} ceiling`)
    }
    if (next > DAILY_CAP_MAX) {
      failed += 1
      console.error(`cap ${cap} steps to ${next}, past the column's ${DAILY_CAP_MAX}`)
    }
    // A cap already past the ceiling was put there by hand and is left there:
    // the ramp declines to climb, and declining to climb is not a licence to
    // overrule the person who set it. So what must never happen is the ramp
    // raising one, rather than one being high.
    const at = decide({ ...state({ cap, floor: cap }), record: clean })
    if (at.cap > cap && at.cap > RAMP_CEILING) {
      failed += 1
      console.error(`a clean window raised cap ${cap} to ${at.cap}, past the ceiling`)
    }
    if (cap >= RAMP_CEILING && (at.action !== 'hold' || at.cap !== cap)) {
      failed += 1
      console.error(`cap ${cap} is at or past the ceiling and did not hold where it was`)
    }
  }

  let cap = 1
  let steps = 0
  while (cap < RAMP_CEILING && steps < 100) {
    cap = stepTo(cap)
    steps += 1
  }
  expect('the ramp reaches its ceiling', cap, RAMP_CEILING)
}

// Neither switch being open is a reason to hold rather than a reason to fail.
// Sending that is closed adds nothing to the record, so there is nothing to
// climb on.
for (const shut of [{ enabled: false }, { sending: false }]) {
  const at = decide({ ...state(shut), record: record({ sent: 500, bounced: 0 }) })
  expect(`${Object.keys(shut)[0]} false holds`, at.action, 'hold')
  expect(`${Object.keys(shut)[0]} false leaves the cap alone`, at.cap, 12)
}

// A Sunday is a closed day neither switch says anything about. Nothing leaves on
// one, so nothing is added to the record, and a step taken that morning puts the
// cap at a level no clean day has been read at. Monday, seeing a date it has not
// stepped on, would then step again on top of it: two levels between Saturday
// and Monday, on one week's evidence.
{
  const clean = record({ sent: 500, bounced: 0 })
  const sunday = decide({ ...state({ now: new Date('2026-08-30T12:00:00Z') }), record: clean })
  expect('a Sunday holds', sunday.action, 'hold')
  expect('a Sunday leaves the cap alone', sunday.cap, 12)

  const monday = decide({ ...state({ now: new Date('2026-08-31T12:00:00Z') }), record: clean })
  expect('the Monday after steps', monday.action, 'step')
}

// Every decision says what it did. A ramp that moves silently is as bad as one
// that stalls silently, and the note is the only place a hold is ever recorded.
{
  const cases = [
    state(),
    state({ enabled: false }),
    state({ haltedAt: NOW.toISOString() }),
    state({ cap: RAMP_CEILING }),
  ]
  for (const each of cases) {
    const at = decide({ ...each, record: record({ sent: 200, bounced: 0 }) })
    if (!at.note || at.note.length < 20) {
      failed += 1
      console.error(`a ${at.action} came back with no note`)
    }
    if (at.reading.sent === undefined || at.reading.cap_before === undefined) {
      failed += 1
      console.error(`a ${at.action} came back with no reading`)
    }
  }
}

if (failed) {
  console.error(`\n${failed} ramp decision(s) are wrong`)
  process.exit(1)
}
console.log(
  `the ramp steps under ${BOUNCE_STEPS_UNDER}%, holds to ${BOUNCE_ROLLS_BACK_OVER}%, rolls back\n` +
    `  over it, refuses a window under ${RAMP_MIN_SENDS} sends, ignores today and holds through\n` +
    `  a Sunday, steps once a day, and cannot pass ${RAMP_CEILING} on its own or ${DAILY_CAP_MAX} at all`
)
