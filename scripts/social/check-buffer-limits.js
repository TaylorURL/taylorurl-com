/**
 * Holds the Buffer client to what it costs and to how it fails.
 *
 * Buffer counts requests against the key, so the two properties checked here
 * are the two that decide whether the queue keeps publishing. The first is
 * arithmetic: a batch has to read the wiring once rather than once per post,
 * because the wiring is two requests and a batch of fifty paying them each time
 * is a hundred and sixty requests for fifty posts, which is what emptied the
 * allowance and left reads refused for an hour afterwards.
 *
 * The third is the image. Instagram publishes no post without one, and every
 * way of losing one is quiet: `editPost` replaces a post rather than patching
 * it, so a promotion that sends an empty asset list strips the image off a
 * draft and schedules a post that fails days later on the account. Both halves
 * of that contract are checked here.
 *
 * The second is what happens once it is empty. A refusal has to be waited out
 * and asked again, inside bounds a scheduled invocation can afford, and a run
 * that cannot get back in has to end in something a person or a watcher can
 * read. Both are quiet when they break: a client spending four times the
 * requests still posts, right up to the day it does not, and a promotion that
 * gave up looks exactly like a promotion with nothing to promote.
 *
 * Nothing here reaches Buffer. Every request is answered by a stub, and the
 * pauses are recorded rather than taken, so the whole file runs in no time and
 * spends nothing.
 *
 *   npm run check:buffer-limits
 */
import { RATE_LIMITED, connect, post, promote, wiring } from '../../lib/social/buffer.js'
import { assetFor, card } from '../../lib/social/cards.js'
import { cases, check, finish, ok, same } from '../harness/checks.js'

// Replaced before the first check, so a call that forgot its stub fails here
// rather than spending the allowance this file exists to protect.
const OFFLINE = () => {
  throw new Error('a check reached the network')
}
globalThis.fetch = OFFLINE

// Read into a const when the endpoint module loads, so they are set before the
// check that drives it imports it.
process.env.CRON_SECRET = 'a-cron-secret'
process.env.BUFFER_API_KEY = 'a-key'

/** Which operation a request body carries, read the way a reader would name it. */
const OPERATIONS = [
  ['Organizations', /query Organizations/],
  ['Channels', /query Channels/],
  ['Posts', /query Posts/],
  ['Create', /mutation Create/],
  ['Edit', /mutation Edit/],
]

const operationOf = query => OPERATIONS.find(([, shape]) => shape.test(query))?.[0] ?? 'unknown'

const CHANNEL = {
  id: 'fb',
  name: 'TaylorURL',
  service: 'facebook',
  type: 'page',
  isDisconnected: false,
  isLocked: false,
  isQueuePaused: false,
}

const WRITTEN = { id: 'written', status: 'scheduled', dueAt: '2026-09-01T14:00:00.000Z' }

const ANSWERS = {
  Organizations: { account: { organizations: [{ id: 'org-1' }] } },
  Channels: { channels: [CHANNEL] },
  Posts: { posts: { edges: [] } },
  Create: { createPost: { __typename: 'PostActionSuccess', post: WRITTEN } },
  Edit: { editPost: { __typename: 'PostActionSuccess', post: WRITTEN } },
}

/**
 * What Buffer says when the allowance is spent.
 *
 * Written out rather than described because the client reads it: the refusal
 * arrives as an ordinary GraphQL error with a 200 beside it, so the wording is
 * the only thing telling it apart from a query that will never work. A reworded
 * message from Buffer puts the client back to failing on the first refusal, and
 * this is the line that would fail when that happens.
 */
const TOO_MANY = 'Too many requests from this client. Please try again later.'

const headers = map => ({ get: name => map[name.toLowerCase()] ?? null })

const answered = data => ({
  status: 200,
  ok: true,
  headers: headers({}),
  json: async () => ({ data }),
})

/**
 * A refusal, answered the way a gateway holding a key out answers one.
 *
 * The body is not JSON on purpose. Reading the status first is what keeps
 * "come back later" from arriving as a parse error, and a stub that always
 * answers JSON would let that ordering break without anything noticing.
 */
const refused = (status, retryAfter) => ({
  status,
  ok: false,
  headers: headers(retryAfter === undefined ? {} : { 'retry-after': String(retryAfter) }),
  json: async () => {
    throw new SyntaxError('Unexpected token < in JSON')
  },
})

const errored = message => ({
  status: 200,
  ok: true,
  headers: headers({}),
  json: async () => ({ errors: [{ message }] }),
})

/** A stand-in for Buffer, recording what was asked of it and what was waited. */
function service(answer) {
  const requests = []
  const pauses = []
  return {
    requests,
    pauses,
    count: name => requests.filter(request => request.operation === name).length,
    sleep: async ms => {
      pauses.push(ms)
    },
    get: async (url, init) => {
      const body = JSON.parse(init.body)
      const operation = operationOf(body.query)
      requests.push({ operation, variables: body.variables })
      return answer(operation, requests.length)
    },
  }
}

/** Every operation answered from the canned data. */
const working = operation => answered(ANSWERS[operation])

/** The same, with named operations answered differently. */
const workingWith = overrides => operation =>
  answered(operation in overrides ? overrides[operation] : ANSWERS[operation])

const GOOGLE_CHANNEL = {
  id: 'gb',
  name: 'TaylorURL - Baytown',
  service: 'googlebusiness',
  type: 'profile',
  isDisconnected: false,
  isLocked: false,
  isQueuePaused: false,
}

/** The first `count` requests refused, and everything after them answered. */
const refuseFirst = (count, retryAfter) => (operation, index) =>
  index <= count ? refused(429, retryAfter) : working(operation)

const open = (answer, options) => {
  const stub = service(answer)
  return { stub, run: connect('a-key', { get: stub.get, sleep: stub.sleep, ...options }) }
}

/** What a call that was supposed to throw did instead. */
async function refusal(run) {
  try {
    await run()
  } catch (cause) {
    return cause
  }
  throw new Error('the call was expected to throw and did not')
}

check('a batch reads the wiring once, whatever it places', async () => {
  const { stub, run } = open(working)
  for (let index = 0; index < 3; index += 1) {
    await post(run, { text: `post ${index}`, at: '2026-09-01T14:00:00.000Z' })
  }

  same(stub.count('Organizations'), 1, 'reads of the organization')
  same(stub.count('Channels'), 1, 'reads of the channels')
  same(stub.count('Create'), 3, 'posts placed')
  // Two for the wiring and one per post. Reading it per call would be nine.
  same(stub.requests.length, 5, 'requests for three posts')
})

check('a promotion across two channels still reads the wiring once', async () => {
  // The arithmetic that decides whether a second channel costs a second read.
  // The wiring is read for the run rather than for the channel, so a channel
  // added to the account adds its own edits and nothing else. Reading it per
  // channel is what emptied the allowance the first time this queue placed a
  // batch, and with one channel connected nothing here could tell the two
  // apart.
  const drafts = [
    { id: 'fb-draft', channelId: 'fb', status: 'draft', text: 'a Page draft', dueAt: null },
    { id: 'gb-draft', channelId: 'gb', status: 'draft', text: 'a profile draft', dueAt: null },
  ]
  const { stub, run } = open(
    workingWith({
      Channels: { channels: [CHANNEL, GOOGLE_CHANNEL] },
      Posts: { posts: { edges: drafts.map(node => ({ node })) } },
    })
  )
  const moved = await promote(run)

  same(stub.count('Organizations'), 1, 'reads of the organization')
  same(stub.count('Channels'), 1, 'reads of the channels')
  same(stub.count('Posts'), 1, 'reads of the posts')
  same(stub.count('Edit'), 2, 'one draft promoted on each channel')
  same(stub.requests.length, 5, 'requests for a promotion across two channels')
  same(
    moved.promoted
      .map(entry => entry.service)
      .sort()
      .join(', '),
    'facebook, googlebusiness',
    'both channels moved'
  )
})

check('a key on its own still places a post', async () => {
  const stub = service(working)
  globalThis.fetch = stub.get
  try {
    const written = await post('a-key', { text: 'one', at: '2026-09-01T14:00:00.000Z' })
    same(written.service, 'facebook', 'the service posted to')
    same(stub.requests.length, 3, 'requests for one post from a bare key')
  } finally {
    globalThis.fetch = OFFLINE
  }
})

check('a refused request is waited out and asked again', async () => {
  const { stub, run } = open(refuseFirst(2))
  const read = await wiring(run)

  same(read.organizationId, 'org-1', 'the organization read after two refusals')
  same(stub.requests.length, 4, 'requests made getting past two refusals')
  same(stub.pauses.length, 2, 'pauses taken')
  same(stub.pauses[0], 2000, 'the first pause')
  same(stub.pauses[1], 4000, 'the second pause, doubled')
})

check('Retry-After decides the pause where Buffer sends one', async () => {
  const { stub, run } = open(refuseFirst(1, 7))
  await wiring(run)

  same(stub.pauses.length, 1, 'pauses taken')
  same(stub.pauses[0], 7000, "the pause Buffer asked for rather than the ladder's")
})

check('Retry-After is read as a date as well as a count of seconds', async () => {
  const at = new Date(Date.now() + 5000).toUTCString()
  const { stub, run } = open(refuseFirst(1, at))
  await wiring(run)

  same(stub.pauses.length, 1, 'pauses taken')
  ok(
    stub.pauses[0] > 3000 && stub.pauses[0] <= 5000,
    `an HTTP-date Retry-After was read as ${stub.pauses[0]}ms`
  )
})

check('the refusal Buffer actually sends is read as one', async () => {
  const { stub, run } = open((operation, index) =>
    index === 1 ? errored(TOO_MANY) : working(operation)
  )
  await wiring(run)

  same(stub.pauses.length, 1, 'pauses taken')
  same(stub.pauses[0], 2000, 'the pause after a throttle reported in an error')
  same(stub.requests.length, 3, 'requests made getting past it')
})

// Everything that is not a throttle has to keep failing on the first answer.
// A refusal read too widely is worse than one read too narrowly: a lapsed
// authorisation would sit in a backoff loop for the length of the budget and
// then report a rate limit, sending whoever reads it to wait out an allowance
// that was never the problem.
for (const [what, message] of [
  ['a query the schema will not take', 'Cannot query field "nope" on type "Query"'],
  ['an authorisation that has lapsed', 'Unauthorized'],
  ['a plan limit already reached', 'LimitReachedError: channel limit reached'],
]) {
  check(`${what} is not asked again`, async () => {
    const { stub, run } = open(() => errored(message))
    const cause = await refusal(() => wiring(run))

    same(stub.requests.length, 1, 'requests made against an answer that cannot change')
    same(stub.pauses.length, 0, 'pauses taken')
    same(cause.code, undefined, 'the code on an ordinary failure')
    same(cause.message, message, 'the reason given')
  })
}

check('a key that stays limited gives up loudly', async () => {
  const { stub, run } = open(refuseFirst(Infinity))
  const cause = await refusal(() => wiring(run))

  same(cause.code, RATE_LIMITED, 'the code a watcher reads the give-up by')
  same(cause.attempts, 4, 'attempts made')
  same(cause.waitedMs, 14000, 'milliseconds waited')
  same(stub.requests.length, 4, 'requests made before giving up')
  ok(cause.message.includes('rate limiting'), `the reason given: ${cause.message}`)
})

check('a wait longer than the budget is never started', async () => {
  // Ten minutes asked for, twenty seconds allowed. Sleeping through it would
  // hand the platform an invocation to kill, and a killed invocation reports
  // nothing at all.
  const { stub, run } = open(refuseFirst(Infinity, 600), { budgetMs: 20_000 })
  const cause = await refusal(() => wiring(run))

  same(stub.pauses.length, 0, 'pauses taken against a wait that does not fit')
  same(stub.requests.length, 1, 'requests made')
  same(cause.attempts, 1, 'attempts made')
  same(cause.retryAfterMs, 600000, 'what Buffer asked for, carried on the refusal')
})

check("the budget is the run's and not each request's", async () => {
  // Three seconds of patience for the whole run. One pause of two fits, the
  // four-second one behind it does not, and the second call gets what is left
  // rather than a fresh three.
  const { stub, run } = open(refuseFirst(Infinity), { budgetMs: 3000 })

  const first = await refusal(() => wiring(run))
  same(first.attempts, 2, 'attempts on the first call')
  same(first.waitedMs, 2000, 'milliseconds waited by the first call')

  const second = await refusal(() => wiring(run))
  same(second.attempts, 1, 'attempts on the second call, against what is left')
  same(second.waitedMs, 2000, 'milliseconds waited across the run')
  same(stub.pauses.length, 1, 'pauses taken across the run')
  same(stub.requests.length, 3, 'requests made across the run')
})

check('a promotion stopped partway says what it moved', async () => {
  const drafts = ['d1', 'd2'].map(id => ({
    id,
    status: 'draft',
    dueAt: null,
    text: `draft ${id}`,
    channelId: CHANNEL.id,
  }))

  let edits = 0
  const { run } = open(operation => {
    if (operation === 'Posts') {
      return answered({ posts: { edges: drafts.map(node => ({ node })) } })
    }
    if (operation === 'Edit') {
      edits += 1
      return edits === 1 ? working('Edit') : refused(429)
    }
    return working(operation)
  })

  const cause = await refusal(() => promote(run, { now: new Date('2026-08-29T18:00:00Z') }))
  same(cause.code, RATE_LIMITED, 'the code on a promotion that could not finish')
  same(cause.promoted.length, 1, 'drafts moved before the refusal')
  same(cause.promoted[0].service, 'facebook', 'the service the moved draft belongs to')
  ok(Array.isArray(cause.skipped), 'the refusal carries no record of what was skipped')
})

// The client names every pause it takes on the way to giving up, which is what
// a run in production is read by and what a run of these checks would drown in.
console.error = () => {}

/** A stand-in for the response half of a Vercel handler, recording what it sent. */
function answering() {
  const sent = { status: null, body: null, headers: {} }
  const self = {
    sent,
    setHeader: (name, value) => {
      sent.headers[name] = value
    },
    status: code => {
      sent.status = code
      return self
    },
    json: body => {
      sent.body = body
      return self
    },
  }
  return self
}

const scheduled = { headers: { authorization: 'Bearer a-cron-secret' } }

// The endpoint is the reason the rest of this file exists. It runs on a cron
// nobody watches, where a queue that has stopped publishing reads exactly like
// a queue with nothing to publish. Both answers are driven here, because what
// separates them is only ever what a watcher can read off them.
check('the scheduled endpoint answers a rate limit loudly', async () => {
  // Ten minutes asked for against a twenty second budget, so the run gives up
  // on the first refusal and the check does not sit through the ladder.
  const stub = service(() => refused(429, 600))
  globalThis.fetch = stub.get
  try {
    const { default: handler } = await import('../../api/social-queue.js')
    const response = answering()
    await handler(scheduled, response)

    same(response.sent.status, 429, 'the status a rate-limited run answers with')
    same(response.sent.headers['Retry-After'], '600', 'the Retry-After passed on to the caller')
    same(response.sent.body.ok, false, 'ok on a run that could not finish')
    same(response.sent.body.code, RATE_LIMITED, 'the code a watcher reads')
    same(response.sent.body.rateLimited, true, 'the run is named as rate limited')
    same(response.sent.body.needsAttention, true, 'the field a watcher reads is set')
    ok(Array.isArray(response.sent.body.promoted), 'what was moved before the refusal')
  } finally {
    globalThis.fetch = OFFLINE
  }
})

check('the scheduled endpoint still answers an ordinary run', async () => {
  const stub = service(working)
  globalThis.fetch = stub.get
  try {
    const { default: handler } = await import('../../api/social-queue.js')
    const response = answering()
    await handler(scheduled, response)

    same(response.sent.status, 200, 'the status an ordinary run answers with')
    same(response.sent.body.ok, true, 'ok on a run that finished')
    same(response.sent.body.rateLimited, undefined, 'a finished run is not named as limited')
    // Two for the wiring, one to read the queue, and the reading afterwards
    // shares all three rather than taking them again.
    same(stub.requests.length, 4, 'requests for a promotion and the reading after it')
  } finally {
    globalThis.fetch = OFFLINE
  }
})

const INSTAGRAM_CHANNEL = {
  id: 'ig',
  name: 'taylorwebdev',
  service: 'instagram',
  type: 'business',
  isDisconnected: false,
  isLocked: false,
  isQueuePaused: false,
}

/** A card as Buffer answers it back, which is not the shape it was sent in. */
const heldAsset = chosen => ({
  type: 'image',
  source: assetFor(chosen).image.url,
  thumbnail: assetFor(chosen).image.url,
  image: { altText: chosen.alt },
})

check('promoting an Instagram draft keeps the image it was written with', async () => {
  // `editPost` replaces the post. The empty list every promotion used to send
  // was harmless while both channels published text, and is the whole post on
  // a channel that publishes nothing without media: the draft would be
  // scheduled, would report a healthy runway, and would fail on the day.
  const chosen = card('trades')
  const drafts = [
    {
      id: 'ig-draft',
      channelId: 'ig',
      status: 'draft',
      text: 'a caption',
      dueAt: null,
      assets: [heldAsset(chosen)],
    },
  ]
  const { stub, run } = open(
    workingWith({
      Channels: { channels: [INSTAGRAM_CHANNEL] },
      Posts: { posts: { edges: drafts.map(node => ({ node })) } },
    })
  )
  await promote(run)

  const edit = stub.requests.find(request => request.operation === 'Edit')
  ok(edit, 'the draft was promoted')
  same(edit.variables.input.assets.length, 1, 'assets carried onto the scheduled post')
  same(edit.variables.input.assets[0].image.url, assetFor(chosen).image.url, 'the same card')
  same(edit.variables.input.assets[0].image.metadata.altText, chosen.alt, 'and its alt text')
})

check('an Instagram draft with no image is stood down, and does not take a slot', async () => {
  // The slot matters as much as the refusal. Handing slots out by position
  // would let the draft that was stood down take its day down with it, and the
  // day would sit empty behind a promotion reporting itself as finished.
  const chosen = card('process')
  const drafts = [
    { id: 'bare', channelId: 'ig', status: 'draft', text: 'no image', dueAt: null, assets: [] },
    {
      id: 'whole',
      channelId: 'ig',
      status: 'draft',
      text: 'an image',
      dueAt: null,
      assets: [heldAsset(chosen)],
    },
  ]
  const { stub, run } = open(
    workingWith({
      Channels: { channels: [INSTAGRAM_CHANNEL] },
      Posts: { posts: { edges: drafts.map(node => ({ node })) } },
    })
  )
  const moved = await promote(run)

  same(stub.count('Edit'), 1, 'only the draft that can publish was promoted')
  const edit = stub.requests.find(request => request.operation === 'Edit')
  same(edit.variables.input.id, 'whole', 'and it is the one with the image')
  same(moved.skipped.length, 1, 'the bare draft is reported rather than dropped quietly')
  same(moved.skipped[0].id, 'bare', 'and named')
})

check('a caption with no image is refused before it reaches Buffer', async () => {
  const { stub, run } = open(workingWith({ Channels: { channels: [INSTAGRAM_CHANNEL] } }))
  const cause = await refusal(() =>
    post(run, { text: 'a caption', draft: true, service: 'instagram' })
  )

  ok(/without an image/.test(cause.message), `the reason is named: ${cause.message}`)
  same(stub.count('Create'), 0, 'and nothing was placed')
})

await finish()

console.log(`buffer limits: ${cases.length} checks passed`)
