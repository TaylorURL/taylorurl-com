/**
 * Proves that nothing typed on the way to a card is lost, and that the message
 * to somebody who did not use one reaches them while they are still at the desk.
 *
 * Both halves fail silently, which is why they are read here rather than
 * trusted. A page that records nothing still takes payments perfectly: the
 * buyers who go through are unaffected, and the only sign anything is wrong is
 * an absence - the people who typed a name and a number and then stopped, who
 * were never in the console to be missed. And a follow-up whose wait says one
 * hour still sends, on whatever cadence the schedule happens to fire at, so a
 * job left on a daily cron delivers "an hour later" some time tomorrow and
 * every run reports success on the way.
 *
 * The wait and the schedule are checked together for that reason. Neither is
 * wrong on its own and the two of them are the delivery time, so this is the
 * only place the real figure exists. A daily cron and a quarter-hourly one
 * differ by one character in the minute field and by twenty-three hours in what
 * arrives, which is why the field is expanded here rather than eyeballed.
 *
 *   npm run check:lead-capture
 */

import {
  PAYMENT_PATH,
  PAY_STEP,
  START_PATH,
  STEP_COUNT,
  fromPaymentPage,
} from '../../lib/leads/paths.js'
import { cases, check, finish, same } from '../harness/checks.js'
import { read } from '../harness/files.js'

const PAYMENT = 'src/app/views/start/Payment.jsx'
const START = 'src/app/views/start/Start.jsx'
const JOB = 'api/start-followup.js'
const CONSOLE = 'src/app/views/console/pages/studio/LeadsPage.jsx'

/** The longest a lead can wait between becoming due and a run reaching it. */
function longestGapMinutes(schedule) {
  const [minute, hour, day, month, weekday] = schedule.trim().split(/\s+/)
  for (const [field, name] of [
    [day, 'day'],
    [month, 'month'],
    [weekday, 'weekday'],
  ]) {
    if (field !== '*')
      throw new Error(`the ${name} field is "${field}"; this reads a daily cadence`)
  }

  const expand = (field, span) => {
    if (field === '*') return [...Array(span).keys()]
    const every = field.match(/^\*\/(\d+)$/)
    if (every) {
      const step = Number(every[1])
      return [...Array(span).keys()].filter(at => at % step === 0)
    }
    if (/^\d+(,\d+)*$/.test(field))
      return field
        .split(',')
        .map(Number)
        .sort((a, b) => a - b)
    throw new Error(`the cron field "${field}" is a shape this check cannot read`)
  }

  const hours = expand(hour, 24)
  const minutes = expand(minute, 60)
  const firings = hours.flatMap(at => minutes.map(past => at * 60 + past)).sort((a, b) => a - b)
  if (!firings.length) throw new Error('the schedule fires never')

  let longest = 0
  for (let at = 0; at < firings.length; at += 1) {
    // The last firing of the day is followed by the first of the next one.
    const next = at + 1 < firings.length ? firings[at + 1] : firings[0] + 24 * 60
    longest = Math.max(longest, next - firings[at])
  }
  return longest
}

/** What the source says a named constant is, read as a number. */
function constantIn(path, name) {
  const found = read(path).match(new RegExp(`const ${name} = (\\d+)`))
  if (!found) throw new Error(`${path} no longer names ${name}`)
  return Number(found[1])
}

check('the payment page records what is typed before the card is reached', () => {
  const page = read(PAYMENT)
  same(
    page.includes("import { recordStart } from '@data/leads/startLead'"),
    true,
    'it holds a recorder'
  )
  same(
    /recordStart\(\{ email: values\.email, step: PAY_STEP, brief: briefOf\(values\)/.test(page),
    true,
    'the settle reports the address, the screen and the answers'
  )
})

check('a build agreed in a conversation is recorded and not counted', () => {
  const page = read(PAYMENT)
  // The conversion belongs to the step the ads point at. A lead reported from
  // an address read out across a table is one the property counts and no
  // campaign produced, and the spend is decided on that figure.
  const reports = page.match(/recordStart\(\{[^}]*\}\)/g) || []
  same(reports.length, 2, 'the settle and the flush are the only two reports')
  for (const report of reports) {
    same(report.includes('counted: false'), true, `"${report}" stays out of the count`)
  }

  // And the configurator's own report still counts, which is the half of this
  // that a flag defaulting the wrong way would break silently.
  const recorder = read('src/app/data/leads/startLead.js')
  same(recorder.includes('counted = true'), true, 'counting is what a caller gets by default')
  same(
    recorder.includes("if (counted && claimLead('start', email))"),
    true,
    'and the flag is what the conversion is gated on'
  )
  // The property name, not the word: Start.jsx says "counted" in prose about
  // its own steps, and a check reading for that passes on the wrong thing.
  same(/\bcounted:/.test(read(START)), false, 'the configurator does not opt out of it')
})

check('the payment page reports again as the document goes', () => {
  const page = read(PAYMENT)
  // The lead this exists for types three answers and closes the tab, and their
  // report is still sitting in a timer when the document is torn down.
  same(page.includes("window.addEventListener('pagehide', flush)"), true, 'a flush is wired')
  same(
    /const flush = \(\) => \{[\s\S]*?recordStart\(\{ email: held\.email/.test(page),
    true,
    'and the flush is what reports'
  )
})

check('the rows recorded are the rows the payment carries', () => {
  const page = read(PAYMENT)
  // One list, reached twice. Two copies is how a lead ends up saying something
  // the project that comes out of the same form does not.
  same((page.match(/briefOf\(/g) || []).length >= 3, true, 'briefOf is reached more than once')
  same(page.includes('brief: briefOf(values),'), true, 'the checkout sends it')
  for (const label of ['Full Name', 'Phone']) {
    const written = page.match(new RegExp(`'${label}'`, 'g')) || []
    same(written.length, 1, `${label} is written down once`)
  }
})

check('the configurator records the three fields on its payment screen', () => {
  const start = read(START)
  same(start.includes('const payAnswers = ['), true, 'the payment screen answers are gathered')
  for (const label of ['Business Name', 'Current Website', 'Payment Email']) {
    same(start.includes(`label: '${label}'`), true, `${label} is recorded`)
  }
  // Reported, not merely gathered. A list built and never put in what travels
  // is the same as no list.
  same(
    start.includes('brief: [...summary, ...payAnswers],'),
    true,
    'they travel with what is reported'
  )
  // And a change to one has to be able to reach the endpoint. The mark is what
  // a report is checked against, so a field outside it is a field the tab
  // closing reports and nothing else ever does.
  same(start.includes('held.typed'), true, 'a change to them is a report worth sending')
})

check('a lead is written to an hour after it is left', () => {
  same(constantIn(JOB, 'WAIT_HOURS'), 1, 'the wait')
  // The far end is the backstop and the first-run guard, and it is a different
  // decision. Asserting it here is what stops the two being collapsed.
  same(constantIn(JOB, 'STALE_HOURS'), 96, 'the window the wait sits inside')
})

check('the schedule fires often enough that an hour means an hour', () => {
  const crons = JSON.parse(read('vercel.json')).crons || []
  const job = crons.find(entry => entry.path === '/api/start-followup')
  if (!job) throw new Error('nothing schedules the follow-up')

  const gap = longestGapMinutes(job.schedule)
  const worst = constantIn(JOB, 'WAIT_HOURS') * 60 + gap

  // A lead becomes due an hour after it is recorded and waits for the next run.
  // Ninety minutes is the point past which "an hour later" stops being true of
  // the message that actually arrives.
  same(
    worst <= 90,
    true,
    `the longest a lead waits is ${worst} minutes: an hour due plus ${gap} minutes to the next run`
  )
})

check('a lead left on the payment page is sent back to it', () => {
  const job = read(JOB)
  same(
    job.includes('return fromPaymentPage(path) ? PAYMENT_PATH : START_PATH'),
    true,
    'where they pick it back up is where they left'
  )
  // The column has to be read for that question to have an answer, and the
  // failure is quiet: an unselected column is undefined, which reads as the
  // configurator and sends everybody to /start.
  same(
    job.includes("select('id, email, trade, step, path, unsub_token, created_at')"),
    true,
    'the path is among the columns the run reads'
  )
})

check('the payment page is told apart from the configurator, however the path was written', () => {
  for (const written of [
    PAYMENT_PATH,
    '/payment/',
    '/Payment',
    '/payment?utm_source=card',
    ' /payment ',
  ]) {
    same(fromPaymentPage(written), true, `"${written}" is the payment page`)
  }
  for (const written of [START_PATH, '/', '/payments', '/console/payments', '', null, undefined]) {
    same(fromPaymentPage(written), false, `"${written}" is not the payment page`)
  }
})

check('the screen the payment page reports at is the last one every list names', () => {
  same(PAY_STEP, STEP_COUNT - 1, 'the payment screen is the last of them')

  // Three files name the screens for three readers - the inbox, the console and
  // the follow-up - and a sixth screen added to the configurator would leave
  // PAY_STEP pointing at the second to last in all of them, silently.
  const lists = [
    ['api/start-lead.js', /const STEP_NAMES = \[([\s\S]*?)\]/],
    [CONSOLE, /const STEPS = \[([\s\S]*?)\]/],
    ['lib/leads/message.js', /const STEPS = \[([\s\S]*?)\]/],
  ]
  for (const [path, pattern] of lists) {
    const found = read(path).match(pattern)
    if (!found) throw new Error(`${path} no longer names the screens`)
    const named = found[1].split(',').filter(part => part.trim()).length
    same(named, STEP_COUNT, `${path} names ${STEP_COUNT} screens`)
  }
})

check('the console reads a payment lead as a page rather than as a step', () => {
  const page = read(CONSOLE)
  same(
    page.includes("if (fromPaymentPage(lead.path)) return 'Payment page'"),
    true,
    'the reading is taken from the path'
  )
})

await finish()

const schedule = (JSON.parse(read('vercel.json')).crons || []).find(
  entry => entry.path === '/api/start-followup'
)
console.log(
  `lead capture: all ${cases.length} cases pass; a lead is written to ${constantIn(JOB, 'WAIT_HOURS')} hour after it is left, ` +
    `at worst ${constantIn(JOB, 'WAIT_HOURS') * 60 + longestGapMinutes(schedule.schedule)} minutes`
)
