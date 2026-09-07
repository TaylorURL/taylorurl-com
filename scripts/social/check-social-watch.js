/**
 * Holds the queue watch to the states it exists to tell apart.
 *
 * The watch is the only thing standing between a queue that has stopped
 * publishing and a morning nobody notices, and every way it can be wrong is
 * itself quiet. A threshold that never trips reads like a healthy Page. A
 * throttle reported as a dropped channel sends somebody to re-authorise a
 * channel that was never disconnected. A standing absence promoted to an alarm
 * fires every day until the report is ignored, which leaves the queue exactly
 * as unwatched as before.
 *
 * So each of those is driven here from a fixture: a queue days from empty, a
 * channel that lost its authorisation overnight, a slot that came and went
 * unsent, and a Buffer that would not answer at all. The status codes are
 * checked too, because a cron invocation is read by its status long before
 * anybody opens its body.
 *
 * Nothing here reaches Buffer. `judge` touches no network by construction, the
 * two calls that would are answered by a stub, and `fetch` is replaced outright
 * so a case that forgot one fails here rather than spending an allowance.
 *
 *   npm run check:social-watch
 */
import {
  EXPECTED,
  FINDING,
  MIN_POSTS_AHEAD,
  PUBLISH_GRACE_MS,
  RUNWAY_CRITICAL_DAYS,
  RUNWAY_FLOOR_DAYS,
  SEVERITY,
  judge,
  postsCritical,
  postsFloor,
  summary,
  watch,
} from '../../lib/social/watch.js'
import { CADENCE, RATE_LIMITED, connect, coversDays } from '../../lib/social/buffer.js'

const OFFLINE = () => {
  throw new Error('a check reached the network')
}
globalThis.fetch = OFFLINE

process.env.CRON_SECRET = 'a-cron-secret'
process.env.BUFFER_API_KEY = 'a-key'

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want)
    throw new Error(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)
}

const ok = (condition, what) => {
  if (!condition) throw new Error(what)
}

const sameList = (got, want, what) => same(got.join(', '), want.join(', '), what)

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-09-15T18:00:00Z')

const at = days => new Date(NOW.getTime() + days * DAY).toISOString()

const channel = (service, extra = {}) => ({
  id: `${service}-channel`,
  name: `${service} channel`,
  service,
  cadence: CADENCE[service],
  isDisconnected: false,
  isLocked: false,
  isQueuePaused: false,
  ...extra,
})

const FACEBOOK = channel('facebook')
const INSTAGRAM = channel('instagram')
const GOOGLE = channel('googlebusiness')

/** Every service the cadence covers, which is what an ordinary reading sees. */
const LIVE = [FACEBOOK, INSTAGRAM, GOOGLE]

const post = (service, dueAt, status = 'scheduled') => ({
  id: `${service}-${dueAt}-${status}`,
  channelId: `${service}-channel`,
  status,
  dueAt,
  text: 'a post',
})

/**
 * A Facebook queue running `days` ahead, with yesterday's slot published, and
 * the other two channels running healthily beside it.
 *
 * Every other channel is in every fixture because it is in every reading: a
 * case about Facebook that hands over Facebook alone is a case where the other
 * services have no channel, and what it then measures is the absence rather
 * than the thing it was written for.
 *
 * `weeks` shortens the Business Profile alone. Instagram is held healthy
 * throughout, so a case that shortens one channel is still measuring one.
 */
const queue = (days, { last = 'sent', weeks = 3 } = {}) => {
  const all = [post('facebook', at(-1), last)]
  for (let day = 1; day <= days; day += 1) all.push(post('facebook', at(day)))
  for (let week = 1; week <= weeks; week += 1) all.push(post('googlebusiness', at(week * 7)))
  // Three weeks of Monday, Wednesday and Friday, which is what the cadence
  // fills and comfortably past the floor.
  for (let step = 1; step <= 9; step += 1) all.push(post('instagram', at(step * 2 + 1)))
  return all
}

/**
 * A roster with a service still awaited.
 *
 * Every service the cadence covers now has a channel, so the awaited state has
 * nothing live to stand on. It is still the state the next channel arrives
 * through, so the cases below drive it from here rather than from whatever
 * `EXPECTED` happens to say this month.
 */
const AWAITING = {
  facebook: { standing: 'connected' },
  instagram: { standing: 'connected' },
  googlebusiness: {
    standing: 'awaited',
    since: '2026-08-29',
    review: '2026-11-30',
    reason: "Buffer's plan holds one channel and the Facebook Page has it",
  },
}

const only = (findings, kind) => findings.filter(item => item.kind === kind)
const kinds = findings => findings.map(item => item.kind).sort()

/** Every case's findings, gathered so the shape can be held across all of them. */
const everyFinding = []
const record = answer => {
  everyFinding.push(...answer.findings)
  return answer
}

// ---------------------------------------------------------------------------
// The four states, told apart
// ---------------------------------------------------------------------------

check('a queue publishing daily with runway raises nothing', () => {
  const answer = record(judge({ channels: LIVE, posts: queue(21), now: NOW }))
  sameList(kinds(answer.findings), [], 'kinds')
  same(answer.channels[0].daysOfRunway, 21, 'runway')
})

check('a weekly channel is judged on posts in hand rather than on days', () => {
  const answer = record(judge({ channels: LIVE, posts: queue(21, { weeks: 2 }), now: NOW }))
  same(only(answer.findings, FINDING.short).length, 0, 'two posts in hand is not short')

  // One post, and it goes out tomorrow. Counted in days that is a channel one
  // day from silence and it reads as an alarm; counted in posts it is a channel
  // with a week to write the next one, which is what it is.
  const thin = record(
    judge({
      channels: LIVE,
      posts: [...queue(21, { weeks: 0 }), post('googlebusiness', at(1))],
      now: NOW,
    })
  )
  const short = only(thin.findings, FINDING.short)
  same(short.length, 1, 'one short finding')
  same(short[0].service, 'googlebusiness', 'and it is the weekly channel')
  same(short[0].severity, SEVERITY.warn, 'a post in hand warns rather than alarms')
  same(short[0].floor, 2, 'held to two posts rather than to seven days')
  same(short[0].daysOfRunway, 1, 'though it is one day from its last post')

  const empty = record(judge({ channels: LIVE, posts: queue(21, { weeks: 0 }), now: NOW }))
  const none = only(empty.findings, FINDING.short)
  same(none.length, 1, 'an empty queue is short')
  same(none[0].severity, SEVERITY.alarm, 'and a queue with nothing in it alarms')
})

check('a queue under the floor is short, and says how short', () => {
  const answer = record(judge({ channels: LIVE, posts: queue(5), now: NOW }))
  const short = only(answer.findings, FINDING.short)
  same(short.length, 1, 'one short finding')
  same(short[0].severity, SEVERITY.warn, 'a queue inside the floor warns')
  same(short[0].floor, RUNWAY_FLOOR_DAYS, 'the floor is named')
  ok(short[0].detail.includes('5 more days'), `the days are named: ${short[0].detail}`)
})

check('a queue under the critical figure alarms rather than warns', () => {
  const answer = record(judge({ channels: LIVE, posts: queue(2), now: NOW }))
  const short = only(answer.findings, FINDING.short)
  same(short.length, 1, 'one short finding')
  same(short[0].severity, SEVERITY.alarm, 'a queue about to empty alarms')
})

check('a queue at the floor exactly is not short', () => {
  // The boundary is where a threshold quietly stops being one, and a queue a
  // day either side of it has to read differently.
  const answer = record(judge({ channels: LIVE, posts: queue(RUNWAY_FLOOR_DAYS), now: NOW }))
  same(answer.channels[0].daysOfRunway, RUNWAY_FLOOR_DAYS, 'runway at the floor')
  same(only(answer.findings, FINDING.short).length, 0, 'nothing short at the floor')
  const under = judge({
    channels: LIVE,
    posts: queue(RUNWAY_FLOOR_DAYS - 1),
    now: NOW,
  })
  same(only(under.findings, FINDING.short).length, 1, 'short a day under it')
})

check('a channel that lost its authorisation is a dropped channel, not a short queue', () => {
  const answer = record(
    judge({
      channels: [channel('facebook', { isDisconnected: true }), INSTAGRAM, GOOGLE],
      posts: queue(21),
      now: NOW,
    })
  )
  const dropped = only(answer.findings, FINDING.dropped)
  same(dropped.length, 1, 'one dropped finding')
  same(dropped[0].severity, SEVERITY.alarm, 'severity')
  same(dropped[0].service, 'facebook', 'service')
  // The queue is three weeks deep, which is exactly why the runway figure is
  // not the thing that catches this.
  same(only(answer.findings, FINDING.short).length, 0, 'a full queue is not also short')
})

check('a locked channel and a paused queue are dropped channels too', () => {
  const locked = record(
    judge({
      channels: [channel('facebook', { isLocked: true }), INSTAGRAM, GOOGLE],
      posts: queue(21),
      now: NOW,
    })
  )
  same(only(locked.findings, FINDING.dropped).length, 1, 'a locked channel drops')

  const paused = record(
    judge({
      channels: [channel('facebook', { isQueuePaused: true }), INSTAGRAM, GOOGLE],
      posts: queue(21),
      now: NOW,
    })
  )
  const dropped = only(paused.findings, FINDING.dropped)
  same(dropped.length, 1, 'a paused queue drops')
  ok(dropped[0].detail.includes('paused'), 'the paused queue says so')
})

check('a service expected connected with no channel at all is a dropped channel', () => {
  same(EXPECTED.facebook.standing, 'connected', 'facebook is expected connected')
  const answer = record(judge({ channels: [INSTAGRAM, GOOGLE], posts: [], now: NOW }))
  const dropped = only(answer.findings, FINDING.dropped)
  same(dropped.length, 1, 'one dropped finding')
  same(dropped[0].service, 'facebook', 'the absent service is named')
})

check('a slot that came and went unsent is a post that did not publish', () => {
  const answer = record(
    judge({ channels: LIVE, posts: queue(21, { last: 'scheduled' }), now: NOW })
  )
  const missed = only(answer.findings, FINDING.unpublished)
  same(missed.length, 1, 'one unpublished finding')
  same(missed[0].severity, SEVERITY.alarm, 'severity')
  same(missed[0].status, 'scheduled', 'the state Buffer left it in')
  ok(missed[0].dueAt === at(-1), 'the slot it missed is named')
})

check('a slot Buffer reported as failed is the same finding, read differently', () => {
  for (const status of ['error', 'failed']) {
    const answer = record(judge({ channels: LIVE, posts: queue(21, { last: status }), now: NOW }))
    const missed = only(answer.findings, FINDING.unpublished)
    same(missed.length, 1, `one unpublished finding for ${status}`)
    ok(missed[0].detail.includes(status), `the reported state is carried: ${missed[0].detail}`)
  }
})

check('a slot inside the grace is not yet a post that failed', () => {
  // Buffer publishes on its own clock, so a post a few minutes late is a post,
  // and reporting one as missed every morning is the noise that gets a watch
  // switched off.
  const recent = new Date(NOW.getTime() - PUBLISH_GRACE_MS / 2).toISOString()
  const answer = record(
    judge({
      channels: LIVE,
      posts: [post('facebook', recent), post('facebook', at(21))],
      now: NOW,
    })
  )
  same(only(answer.findings, FINDING.unpublished).length, 0, 'nothing missed inside the grace')

  const older = new Date(NOW.getTime() - PUBLISH_GRACE_MS * 2).toISOString()
  const after = judge({
    channels: LIVE,
    posts: [post('facebook', older), post('facebook', at(21))],
    now: NOW,
  })
  same(only(after.findings, FINDING.unpublished).length, 1, 'missed once the grace is spent')
})

check('a draft sitting past a date is not a post that failed to publish', () => {
  const answer = record(
    judge({
      channels: LIVE,
      posts: [
        post('facebook', at(-3), 'draft'),
        post('facebook', at(-1), 'sent'),
        post('facebook', at(21)),
      ],
      now: NOW,
    })
  )
  same(
    only(answer.findings, FINDING.unpublished).length,
    0,
    'a draft carries no promise about a day'
  )
})

check('a channel that has never had a slot is not a channel that stopped', () => {
  const answer = record(judge({ channels: LIVE, posts: [post('facebook', at(21))], now: NOW }))
  same(
    only(answer.findings, FINDING.unpublished).length,
    0,
    'nothing missed with nothing behind it'
  )
  same(answer.channels[0].lastSlot, null, 'no last slot')
})

// ---------------------------------------------------------------------------
// The absence that is expected, and the day it stops being
// ---------------------------------------------------------------------------

check('every service the cadence covers is expected to hold a channel', () => {
  // The state the account is actually in. Both services are bought and
  // connected, so either one going missing is a channel that left rather than
  // one that never arrived, and that is what the case below asks for.
  for (const service of Object.keys(CADENCE)) {
    same(EXPECTED[service].standing, 'connected', `${service} is expected connected`)
  }
  const answer = record(judge({ channels: LIVE, posts: queue(21), now: NOW }))
  same(answer.findings.length, 0, 'an ordinary morning raises nothing at all')
})

check('a service that is expected connected and missing is a dropped channel', () => {
  const answer = record(judge({ channels: [FACEBOOK, INSTAGRAM], posts: queue(21), now: NOW }))
  const dropped = only(answer.findings, FINDING.dropped)
  same(dropped.length, 1, 'one dropped finding')
  same(dropped[0].service, 'googlebusiness', 'the absent service is named')
  same(dropped[0].severity, SEVERITY.alarm, 'a channel that left is an alarm')
})

check('the awaited service is carried in every answer and raises nothing', () => {
  same(AWAITING.googlebusiness.standing, 'awaited', 'googlebusiness is awaited')
  const answer = record(
    judge({ channels: [FACEBOOK, INSTAGRAM], posts: queue(21), now: NOW, roster: AWAITING })
  )
  const awaited = only(answer.findings, FINDING.awaited)
  same(awaited.length, 1, 'always carried')
  same(awaited[0].severity, SEVERITY.standing, 'and never an alarm')
  same(answer.needsAttention ?? false, false, 'judge itself makes no verdict')
  ok(!awaited[0].detail.includes('undefined'), 'the reason reads as a sentence')
})

check('a standing absence does not make a run need attention', () => {
  const answer = judge({
    channels: [FACEBOOK, INSTAGRAM],
    posts: queue(21),
    now: NOW,
    roster: AWAITING,
  })
  const loud = answer.findings.filter(
    item => item.severity === SEVERITY.alarm || item.severity === SEVERITY.warn
  )
  same(loud.length, 0, 'nothing loud on an ordinary morning')
})

check('past its review date the absence needs deciding again', () => {
  const later = new Date(`${AWAITING.googlebusiness.review}T18:00:00Z`)
  const answer = record(
    judge({
      channels: [FACEBOOK, INSTAGRAM],
      posts: [post('facebook', later.toISOString())],
      now: later,
      roster: AWAITING,
    })
  )
  const awaited = only(answer.findings, FINDING.awaited)
  same(awaited.length, 1, 'one awaited finding')
  same(awaited[0].severity, SEVERITY.warn, 'the standing expires rather than renewing itself')
  ok(awaited[0].detail.includes(AWAITING.googlebusiness.review), 'the date is named')
})

check('a channel arriving for an awaited service says the roster is stale', () => {
  const answer = record(judge({ channels: LIVE, posts: queue(21), now: NOW, roster: AWAITING }))
  const stale = only(answer.findings, FINDING.roster)
  same(stale.length, 1, 'one roster finding')
  same(stale[0].severity, SEVERITY.warn, 'severity')
  same(only(answer.findings, FINDING.awaited).length, 0, 'and no absence, because it is present')
})

// ---------------------------------------------------------------------------
// Buffer refusing to answer is not a verdict on the queue
// ---------------------------------------------------------------------------

/** A transport answering each request from a script, counting what it spent. */
function transport(answers) {
  const spent = []
  const get = async (_url, options) => {
    const { query } = JSON.parse(options.body)
    spent.push(query)
    const next = answers.shift()
    if (!next) throw new Error(`no answer left for request ${spent.length}`)
    return next
  }
  return { get, spent }
}

const json = data => ({
  status: 200,
  ok: true,
  headers: { get: () => null },
  json: async () => ({ data }),
})

const refused = retryAfter => ({
  status: 429,
  ok: false,
  headers: { get: name => (name === 'retry-after' && retryAfter ? String(retryAfter) : null) },
  json: async () => ({}),
})

/**
 * The same queue, timed against the clock rather than against a fixed moment.
 *
 * `judge` is handed the moment it reads at, so a fixture can sit anywhere. The
 * endpoint reads at the moment it runs, so a fixture built around a fixed date
 * drifts into the future and answers every question with a queue weeks deep -
 * which is how a case checking for a short queue passed while asserting
 * nothing.
 */
const live = days => new Date(Date.now() + days * DAY).toISOString()

const liveQueue = (days, { last = 'sent', weeks = 3 } = {}) => {
  const all = [{ ...post('facebook', live(-1), last) }]
  for (let day = 1; day <= days; day += 1) all.push(post('facebook', live(day)))
  for (let week = 1; week <= weeks; week += 1) all.push(post('googlebusiness', live(week * 7)))
  for (let step = 1; step <= 9; step += 1) all.push(post('instagram', live(step * 2 + 1)))
  return all
}

const answersFor = (channels, all = liveQueue(21)) => [
  json({ account: { organizations: [{ id: 'org' }] } }),
  json({ channels }),
  json({ posts: { edges: all.map(node => ({ node })) } }),
]

check('a whole reading costs three requests', () => {
  // The wiring is two of them and the posts are the third. A fourth would mean
  // the run read the wiring twice, which is what emptied the allowance the
  // first time this queue was asked to place a batch.
  const { get, spent } = transport(answersFor(LIVE, queue(21)))
  return watch(connect('a-key', { get }), { now: NOW }).then(answer => {
    same(spent.length, 3, 'requests spent')
    same(answer.read, true, 'read')
    same(answer.needsAttention, false, 'an ordinary morning')
  })
})

check('a rate limit comes back as one throttled finding and no verdict', async () => {
  const { get, spent } = transport([refused(90), refused(90), refused(90), refused(90)])
  const run = connect('a-key', { get, sleep: async () => {}, budgetMs: 1_000_000 })
  const answer = record(await watch(run, { now: NOW }))

  same(answer.read, false, 'the queue was not read')
  same(answer.unread, true, 'and says so')
  sameList(kinds(answer.findings), [FINDING.throttled], 'one finding, and it is the throttle')
  same(answer.findings[0].severity, SEVERITY.unknown, 'a throttle is not a verdict')
  same(answer.needsAttention, false, 'and is not somebody to wake up')
  same(answer.findings[0].code, RATE_LIMITED, 'the code is carried')
  ok(answer.findings[0].retryAfterMs === 90_000, 'what Buffer asked for is carried')
  ok(spent.length > 1, 'the refusal was waited out before it was given up on')
  // The whole point of the distinction: nothing about a throttle says a channel
  // is disconnected, and a watch that says so sends somebody to Buffer to fix
  // a channel that was never broken.
  same(only(answer.findings, FINDING.dropped).length, 0, 'a throttle is not a dropped channel')
  same(only(answer.findings, FINDING.short).length, 0, 'a throttle is not a short queue')
})

check('a failure that is not a rate limit is not swallowed into a finding', async () => {
  const broken = {
    status: 200,
    ok: true,
    headers: { get: () => null },
    json: async () => ({ errors: [{ message: 'this key is not valid' }] }),
  }
  const { get } = transport([broken])
  let thrown = null
  await watch(connect('a-key', { get }), { now: NOW }).catch(cause => {
    thrown = cause
  })
  ok(thrown, 'a real fault reaches the caller')
  ok(thrown.code !== RATE_LIMITED, 'and is not dressed up as a throttle')
})

// ---------------------------------------------------------------------------
// The status a cron invocation is read by
// ---------------------------------------------------------------------------

function recorder() {
  const out = { code: null, body: null, headers: {} }
  return {
    out,
    status(code) {
      out.code = code
      return this
    },
    json(body) {
      out.body = body
      return this
    },
    setHeader(name, value) {
      out.headers[name.toLowerCase()] = value
    },
  }
}

const signed = { headers: { authorization: 'Bearer a-cron-secret' } }

async function endpoint(get, request = signed) {
  const { default: handler } = await import('../../api/social-watch.js')
  const response = recorder()
  const held = globalThis.fetch
  globalThis.fetch = get ?? OFFLINE
  try {
    await handler(request, response)
  } finally {
    globalThis.fetch = held
  }
  return response.out
}

check('an unsigned call is refused before anything is read', async () => {
  const out = await endpoint(null, { headers: {} })
  same(out.code, 401, 'status')
})

check('a queue that is publishing answers 200', async () => {
  const { get } = transport(answersFor(LIVE))
  const out = await endpoint(get)
  same(out.code, 200, 'status')
  same(out.body.ok, true, 'ok')
  same(out.body.needsAttention, false, 'nothing to act on')
  same(out.body.kinds[FINDING.dropped], 0, 'and both channels answered for')
})

check('a dropped channel answers 503 rather than a quiet 200', async () => {
  const { get } = transport(
    answersFor([channel('facebook', { isDisconnected: true }), INSTAGRAM, GOOGLE])
  )
  const out = await endpoint(get)
  same(out.code, 503, 'status')
  same(out.body.ok, false, 'ok')
  same(out.body.kinds[FINDING.dropped], 1, 'and the kind says which of the four it is')
})

check('a short queue answers 503 too, and says it is short rather than dropped', async () => {
  const { get } = transport(answersFor(LIVE, liveQueue(2)))
  const out = await endpoint(get)
  same(out.code, 503, 'status')
  same(out.body.kinds[FINDING.short], 1, 'short')
  same(out.body.kinds[FINDING.dropped], 0, 'and not dropped')
})

check('a throttle answers 429 with Retry-After, not 503 and not 200', async () => {
  const { get } = transport([refused(45), refused(45), refused(45), refused(45)])
  const out = await endpoint(get)
  same(out.code, 429, 'status')
  same(out.body.read, false, 'nothing in the body is a verdict')
  same(out.headers['retry-after'], '45', 'Retry-After')
  same(out.body.kinds[FINDING.dropped], 0, 'and no channel is accused')
})

check('the watch itself failing answers 500 and reads as its own kind', async () => {
  const { get } = transport([
    {
      status: 200,
      ok: true,
      headers: { get: () => null },
      json: async () => ({ errors: [{ message: 'this key is not valid' }] }),
    },
  ])
  const out = await endpoint(get)
  same(out.code, 500, 'status')
  same(out.body.needsAttention, true, 'a broken watch is somebody to wake up')
  same(out.body.findings[0].kind, FINDING.fault, 'and reads as a fault, not a throttle')
})

// ---------------------------------------------------------------------------
// What holds across every finding above
// ---------------------------------------------------------------------------

check('the thresholds are ordered and the kinds are distinct', () => {
  ok(RUNWAY_FLOOR_DAYS > RUNWAY_CRITICAL_DAYS, 'the floor stands above the critical figure')
  const values = Object.values(FINDING)
  same(new Set(values).size, values.length, 'no two kinds share a name')
  for (const service of Object.keys(CADENCE)) {
    ok(EXPECTED[service], `${service} is in the cadence and has no expected standing`)
  }
  // The awaited entries are read out of both rosters, so the rule holds on the
  // live one whenever it carries such an entry and on the fixture the rest of
  // the time. A roster with none would otherwise take this rule with it.
  for (const roster of [EXPECTED, AWAITING]) {
    for (const [service, expected] of Object.entries(roster)) {
      ok(CADENCE[service], `${service} has an expected standing and is in no cadence`)
      if (expected.standing !== 'awaited') continue
      ok(expected.since && expected.review, `${service} is awaited with no dates`)
      ok(expected.review > expected.since, `${service} is reviewed before it was recorded`)
    }
  }

  // Every service is held to at least one whole cycle of its own cadence, and
  // the alarm always sits under the warning rather than on top of it.
  for (const [service, cadence] of Object.entries(CADENCE)) {
    const covers = coversDays(cadence)
    ok(postsFloor(covers) >= MIN_POSTS_AHEAD, `${service} is floored under the minimum`)
    ok(postsCritical(covers) <= postsFloor(covers), `${service} alarms before it warns`)
  }
})

check('every finding raised anywhere above carries a kind, a severity and a sentence', () => {
  ok(everyFinding.length > 10, `only ${everyFinding.length} findings were raised`)
  for (const item of everyFinding) {
    ok(Object.values(FINDING).includes(item.kind), `unknown kind ${item.kind}`)
    ok(Object.values(SEVERITY).includes(item.severity), `unknown severity ${item.severity}`)
    ok(typeof item.detail === 'string' && item.detail.length > 40, `no sentence on ${item.kind}`)
    ok(!/undefined|null|NaN/.test(item.detail), `${item.kind} reads: ${item.detail}`)
  }
})

check('the summary names the queue whether or not it found anything', () => {
  const clear = summary({
    read: true,
    findings: [],
    channels: [{ service: 'facebook', daysOfRunway: 20 }],
  })
  ok(clear.includes('facebook 20d'), `a quiet answer still says the queue: ${clear}`)
  ok(clear.length > 0, 'and is never an empty string')

  const loud = summary(judge({ channels: LIVE, posts: queue(1), now: NOW }))
  ok(loud.includes('ALARM'), `a queue about to empty reads loudly: ${loud}`)
})

// ---------------------------------------------------------------------------

let failed = 0
for (const [name, run] of cases) {
  try {
    await run()
  } catch (cause) {
    console.error(`FAIL ${name}\n     ${cause.message}`)
    failed += 1
  }
}

if (failed) {
  console.error(`\n${failed} social watch ${failed === 1 ? 'check' : 'checks'} failed`)
  process.exit(1)
}

console.log(
  `social watch holds ${cases.length} checks: runway floor ${RUNWAY_FLOOR_DAYS} days at ` +
    `${postsFloor(coversDays(CADENCE.facebook))} posts daily and ` +
    `${postsFloor(coversDays(CADENCE.googlebusiness))} twice weekly, critical at ` +
    `${RUNWAY_CRITICAL_DAYS}, publish grace ${PUBLISH_GRACE_MS / 60000} minutes`
)
