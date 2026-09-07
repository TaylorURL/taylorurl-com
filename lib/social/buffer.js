/**
 * The client post queue, as Buffer holds it.
 *
 * Buffer owns the publishing and this owns the cadence. Two callers share it:
 * `scripts/social/social.js`, which a person or the daily routine runs by hand, and
 * `api/social-queue.js`, which Vercel's scheduler runs whether or not anything
 * else did.
 *
 * The key is never resolved here. A Vercel function has an environment variable
 * and no vault; a workstation has a vault and usually no variable. Each caller
 * supplies the key it can reach, so neither has to carry the other's way of
 * finding one.
 *
 * Buffer counts requests against the key, so everything below is written to
 * spend as few as it can and to survive being refused. `connect` is what makes
 * both true: the wiring is read once for a run rather than once per post, and
 * the patience for waiting out a refusal is the run's to spend rather than each
 * request's.
 */
import { localDay } from '../outreach/sending/schedule.js'
import { instantOf } from '../time/zone.js'

const ENDPOINT = 'https://api.buffer.com'

/** Where a post's call-to-action button sends the reader, and where cards are served from. */
export const SITE = 'https://www.taylorurl.com'

/**
 * Which services this queue schedules, and how often each one publishes.
 *
 * Buffer keeps a posting schedule of its own against every channel, but only
 * `addToQueue` posts are placed by it and the API exposes no mutation that
 * writes it — it reads back through `postingSchedule` and is otherwise a
 * setting in the web app. So every post this queue places carries an explicit
 * due date instead, and the cadence below is the one that decides them. It is
 * readable, testable and the same wherever the queue runs from.
 *
 * A service absent from here is a service the queue leaves alone, even when
 * Buffer has it connected.
 */
export const CADENCE = {
  facebook: {
    weekdays: null,
    metadata: { facebook: { type: 'post' } },
    maxLength: 63206,
  },
  instagram: {
    // Three a week, spaced so no two land on consecutive days. Instagram ranks
    // a profile on what an account's own followers do with its posts rather
    // than on how many it publishes, so a fourth post in a week mostly divides
    // the same attention rather than reaching further. Monday, Wednesday and
    // Friday keeps a fortnight of runway inside six posts and leaves the
    // weekend, which a local trade audience spends somewhere other than here.
    weekdays: [1, 3, 5],
    metadata: {
      instagram: {
        type: 'post',
        // Non-null in Buffer's schema, and the difference between a post and a
        // file that reached the account and appeared nowhere.
        shouldShareToFeed: true,
      },
    },
    // Instagram truncates a caption at 125 characters behind a "more" and
    // refuses one past 2,200 outright. The refusal is what is enforced here;
    // where the caption stops being read is a matter for whoever writes it.
    maxLength: 2200,
    // Instagram publishes no post without media. A caption on its own is
    // accepted by Buffer, sits in the queue looking scheduled, and fails at the
    // moment it is due — which is a day the account said nothing and a failure
    // nobody was watching for. So the queue refuses it at the point of writing
    // instead, where a person is still standing there.
    requiresImage: true,
    // An article announcement is a headline and an address, and a caption
    // carries no clickable address on Instagram — a reader met by one has been
    // handed a URL to retype. So an article does not announce here, and the
    // channel publishes the card rotation instead. Declared rather than left to
    // a missing template, so `check:article-posts` can go on refusing a service
    // that meant to announce and has nothing written for it.
    announces: false,
  },
  googlebusiness: {
    // A Business Profile shows the newest post beside the listing and files the
    // rest behind it, so posting daily buries a day's work under the next one
    // without reaching anybody new. Posts do not move local ranking either, so
    // the frequency is bought for engagement alone and a seventh post in a week
    // mostly changes which post a searcher sees rather than how many see one.
    //
    // Tuesday and Friday is the step that keeps a post in the read position
    // most of the week without spending posts on nobody: a post is pushed down
    // by the next one after about a week, so one a week leaves the profile
    // reading stale by the end of it, and the two named days keep the gap to
    // three days and four rather than letting both land together.
    weekdays: [2, 5],
    // `detailsWhatsNew` carries the call to action, and Buffer refuses an edit
    // that sets the type without it: a draft is written with no service
    // metadata at all, so promoting one is a change of type, and that is the
    // request the refusal lands on. Creating a post names the type once and is
    // unaffected, which is why the queue could still place posts directly while
    // every promotion failed.
    //
    // The button is what the post is read for. A what's-new post with a
    // call-to-action is clicked about twice as often as the same post without
    // one, and `link` is where the button goes: Google drops a button it has no
    // destination for, so the two are written together or neither is.
    metadata: {
      google: {
        type: 'whats_new',
        detailsWhatsNew: { button: 'learn_more', link: `${SITE}/contact` },
      },
    },
    // A Business Profile refuses a longer post, and it refuses it when the post
    // is due rather than when it is written, so the length is settled here.
    maxLength: 1500,
  },
}

/**
 * How many days one post on a channel covers, which is what the floors read.
 *
 * Derived from the days a post may land on rather than written beside them, so
 * a cadence cannot say it publishes twice a week and be judged as though it
 * published once. A channel naming no days publishes every day and covers one.
 *
 * @param {object} cadence One entry from `CADENCE`.
 * @returns {number} Days per post, which is fractional on most weekly steps.
 */
export const coversDays = cadence => (cadence.weekdays ? 7 / cadence.weekdays.length : 1)

/** The days of the week, as the cadence numbers them and a reader says them. */
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * A cadence as a reader of the answer would say it, not as the search reads it.
 *
 * @param {object} cadence One entry from `CADENCE`.
 * @returns {string} `daily`, or the days named in the order they come round.
 */
export function cadenceInWords(cadence) {
  if (!cadence.weekdays) return 'daily'
  const named = [...cadence.weekdays].sort((a, b) => a - b).map(day => WEEKDAY_NAMES[day])
  return named.length === 1
    ? `${named[0]}s`
    : `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`
}

/**
 * The hour, on the clock in Baytown, that every slot is placed at.
 *
 * Nine in the morning is when a local business audience is on a phone and not
 * yet at work. Held in local time rather than UTC because the zone moves twice
 * a year and a fixed UTC hour publishes at eight all winter.
 */
export const SLOT_HOUR = 9

/** The queue never runs more than this far ahead, so a backlog stays legible. */
export const HORIZON_DAYS = 30

/**
 * How many times one request is made before the run stops asking.
 *
 * Both this and the budget below hold at once, and the tighter one wins.
 * Attempts alone say nothing about how long they take, and a wall clock alone
 * would let a single unlucky request spend the whole run's patience on itself.
 */
const ATTEMPTS = 4

/** The first pause between attempts, doubled for each one after it. */
const FIRST_BACKOFF_MS = 2_000

/**
 * How long a run may spend waiting, counted across every request it makes.
 *
 * The pool belongs to the run rather than to the request, which is the whole
 * point of it. A per-request bound bounds one request and says nothing about
 * fifty, so a batch could be refused fifty times and wait out every one of
 * them. `api/social-queue.js` runs inside a duration the platform enforces and
 * would be killed partway through rather than answering, which is the silence
 * this file exists to stop. Drawn down as the pauses are taken, a caller can be
 * told exactly how much a run is allowed to add to its own length.
 */
const DEFAULT_BUDGET_MS = 30_000

/**
 * The code a caller, a routine or a monitor reads a rate-limited give-up by.
 *
 * Carried on the thrown error along with what was tried and for how long, so
 * the state can be told from an ordinary failure without reading the wording.
 */
export const RATE_LIMITED = 'buffer-rate-limited'

/** Statuses that refuse a request for its timing rather than for its content. */
const THROTTLED_STATUS = new Set([429, 503])

/** A throttle Buffer reports in a GraphQL error instead of in a status. */
const THROTTLED_MESSAGE = /rate.?limit|too many requests|throttl/i

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * One run's worth of access to Buffer: the key, the wiring, and the patience.
 *
 * Every function here takes either a key or one of these, and handing one of
 * these back unchanged is how that works. A bare key still costs what it always
 * did, so a single call stays a single call; a caller placing many posts opens
 * one of these first and the whole batch reads the wiring once and shares one
 * budget for waiting out refusals.
 *
 * @param {string|object} key A Buffer public API key, or a run already open.
 * @param {object} [options]
 * @param {number} [options.budgetMs] What the run may spend waiting out refusals.
 * @param {typeof fetch} [options.get] The request to make. The checks supply their own.
 * @param {(ms: number) => Promise<void>} [options.sleep] The pause to take.
 * @returns {object} The run to hand to everything else in this file.
 */
export function connect(key, { budgetMs = DEFAULT_BUDGET_MS, get = fetch, sleep = wait } = {}) {
  if (key && typeof key === 'object') return key
  if (!key) throw new Error('no Buffer key was supplied')
  return { key, get, sleep, left: budgetMs, waited: 0, read: null }
}

/**
 * When Buffer asked to be called back, in milliseconds from now.
 *
 * `Retry-After` carries either a count of seconds or an HTTP date, and which of
 * the two arrives is the service's choice rather than the caller's. A header
 * that is absent or unreadable answers null, which puts the request back on the
 * doubling ladder.
 */
function retryAfterMs(headers, now) {
  const raw = headers?.get?.('retry-after')
  if (!raw) return null

  const seconds = Number(raw)
  if (Number.isFinite(seconds)) return Math.max(seconds * 1000, 0)

  const at = Date.parse(raw)
  return Number.isFinite(at) ? Math.max(at - now, 0) : null
}

/**
 * One request, read for which of the three answers it came back as.
 *
 * A refusal is settled from the status before the body is touched. A throttled
 * request is not always answered in JSON - a gateway holding the key out
 * answers in HTML - and parsing first turns "come back later" into a syntax
 * error, which reads as a broken client rather than as a busy service.
 */
async function ask(run, query, variables) {
  const response = await run.get(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${run.key}` },
    body: JSON.stringify({ query, variables }),
  })
  const asked = retryAfterMs(response.headers, Date.now())

  if (THROTTLED_STATUS.has(response.status)) {
    return {
      ok: false,
      limited: true,
      asked,
      message: `Buffer refused the request with ${response.status}`,
    }
  }

  let body
  try {
    body = await response.json()
  } catch {
    return { ok: false, limited: false, message: `Buffer answered ${response.status} with no JSON` }
  }

  if (body.errors?.length) {
    const message = body.errors.map(error => error.message).join('; ')
    return { ok: false, limited: THROTTLED_MESSAGE.test(message), asked, message }
  }
  if (!response.ok)
    return { ok: false, limited: false, message: `Buffer answered ${response.status}` }
  return { ok: true, data: body.data }
}

/**
 * A request, waited out and asked again for as long as the run can afford it.
 *
 * Only a refusal about timing is taken again. A malformed query, an
 * authorisation that has lapsed and a plan limit reached are answers that will
 * be the same however long the run waits, and retrying them spends the patience
 * a real throttle needs.
 *
 * Where Buffer names its own figure that figure is taken, because a doubling
 * ladder landing short of it is a request refused again for the same reason.
 * Where it names one longer than the run has left, the run stops there instead
 * of starting a pause it cannot finish: an invocation killed mid-wait reports
 * nothing at all, and every bound here exists so that a refusal ends in
 * something a person can read.
 *
 * @throws {Error} Carrying `code === RATE_LIMITED`, the attempts made and the
 *   milliseconds waited, once either bound is spent.
 */
async function gql(run, query, variables) {
  let pause = FIRST_BACKOFF_MS
  let refusal = null
  let attempt = 0

  while (attempt < ATTEMPTS) {
    attempt += 1
    const answer = await ask(run, query, variables)
    if (answer.ok) return answer.data
    if (!answer.limited) throw new Error(answer.message)
    refusal = answer

    // The pause is only taken when there is both an attempt left to spend it on
    // and room in the budget to finish it.
    if (attempt === ATTEMPTS) break
    const want = answer.asked ?? pause
    if (want > run.left) break

    console.error(
      'buffer: %s; waiting %dms before attempt %d of %d',
      answer.message,
      want,
      attempt + 1,
      ATTEMPTS
    )
    await run.sleep(want)
    run.left -= want
    run.waited += want
    pause *= 2
  }

  const named = refusal.asked === null ? '' : `; Buffer asked for ${refusal.asked}ms`
  throw Object.assign(
    new Error(
      `Buffer is rate limiting this key: ${refusal.message} after ${attempt} ` +
        `attempts and ${run.waited}ms of waiting${named}`
    ),
    {
      code: RATE_LIMITED,
      attempts: attempt,
      waitedMs: run.waited,
      retryAfterMs: refusal.asked ?? null,
    }
  )
}

const ORGANIZATIONS = `query Organizations { account { organizations { id } } }`

const CHANNELS = `
  query Channels($input: ChannelsInput!) {
    channels(input: $input) {
      id
      name
      service
      type
      isDisconnected
      isLocked
      isQueuePaused
    }
  }
`

// The assets come back because promoting has to put them back. `editPost`
// replaces a post rather than patching it, so a promotion that sent the empty
// list every post used to carry would strip the image off an Instagram draft
// and schedule a post that cannot publish.
const POSTS = `
  query Posts($input: PostsInput!) {
    posts(input: $input, first: 100) {
      edges {
        node {
          id
          status
          dueAt
          text
          channelId
          assets {
            type
            source
            thumbnail
            ... on ImageAsset { image { altText } }
          }
        }
      }
    }
  }
`

const CREATE = `
  mutation Create($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess { post { id status dueAt } }
      ... on InvalidInputError { message }
      ... on LimitReachedError { message }
      ... on UnauthorizedError { message }
      ... on UnexpectedError { message }
    }
  }
`

const EDIT = `
  mutation Edit($input: EditPostInput!) {
    editPost(input: $input) {
      __typename
      ... on PostActionSuccess { post { id status dueAt } }
      ... on InvalidInputError { message }
      ... on LimitReachedError { message }
      ... on UnauthorizedError { message }
      ... on UnexpectedError { message }
    }
  }
`

function unwrap(result, what) {
  if (result.__typename !== 'PostActionSuccess') {
    throw new Error(`${what}: ${result.__typename}: ${result.message}`)
  }
  return result.post
}

/**
 * A post's assets as read back, in the shape an edit takes them in.
 *
 * Buffer answers an asset and accepts an `AssetInput`, and the two are not the
 * same object: what comes back is `source` under a type name, and what goes in
 * is `url` under a variant key. Anything but an image is dropped rather than
 * guessed at — the queue places images and nothing else, so an asset of another
 * kind on one of its posts was put there by hand in the web app, and carrying a
 * shape this has never built is how a promotion fails on the one post somebody
 * cared enough to edit.
 *
 * @param {object[]} assets What `POSTS` returned on the post.
 * @returns {object[]} `AssetInput` entries, in the order they were held.
 */
export function assetsAsInput(assets) {
  return (assets ?? [])
    .filter(asset => asset.type === 'image' && asset.source)
    .map(asset => ({
      image: {
        url: asset.source,
        ...(asset.thumbnail ? { thumbnailUrl: asset.thumbnail } : {}),
        metadata: { altText: asset.image?.altText ?? '' },
      },
    }))
}

const DAY = 24 * 60 * 60 * 1000

/**
 * The instant `SLOT_HOUR` happens at on the local day a moment falls in.
 *
 * @param {Date} moment Any instant inside the wanted local day.
 * @returns {Date} When the slot on that day begins.
 */
function slotAt(moment) {
  const { date } = localDay(moment)
  return instantOf(date, `${String(SLOT_HOUR).padStart(2, '0')}:00:00`)
}

/**
 * The next slots on a cadence that no scheduled post already holds.
 *
 * Today is skipped deliberately. A slot earlier than now cannot be filled, and
 * one later today competes with whatever the day already has in front of a
 * reader; the queue is a running order rather than a way to catch up.
 *
 * @param {object} cadence One entry from `CADENCE`.
 * @param {object[]} scheduled The channel's own scheduled posts.
 * @param {number} count How many slots are wanted.
 * @param {Date} [now] The moment the search starts from.
 * @returns {string[]} ISO timestamps, ascending.
 */
export function freeSlots(cadence, scheduled, count, now = new Date()) {
  const taken = new Set(
    scheduled.filter(post => post.dueAt).map(post => localDay(new Date(post.dueAt)).date)
  )
  const slots = []

  for (let offset = 1; offset <= HORIZON_DAYS && slots.length < count; offset += 1) {
    const slot = slotAt(new Date(now.getTime() + offset * DAY))
    const date = localDay(slot).date
    // Counted on the calendar in Baytown rather than in elapsed hours. The two
    // days either side of a daylight saving change are 23 and 25 hours long,
    // and a cadence measured in hours drops one of them.
    const midnight = new Date(`${date}T00:00:00Z`)

    // A cadence that names its days is the whole of the spacing rule: every
    // other day is passed over, and each date is offered once, so two slots
    // cannot land closer together than the named days sit. A cadence naming no
    // days publishes every day and passes over nothing.
    if (cadence.weekdays && !cadence.weekdays.includes(midnight.getUTCDay())) continue
    if (taken.has(date)) continue

    slots.push(slot.toISOString())
  }
  return slots
}

/**
 * The organization, and every connected channel the queue knows a cadence for.
 *
 * `absent` names the services `CADENCE` covers that Buffer has nothing connected
 * for. A channel that was never connected and a channel that dropped its
 * authorisation both leave the same silence in the queue, so both are reported
 * rather than inferred from an empty result.
 */
export async function wiring(key) {
  const run = connect(key)
  // Read once for the run, and shared by everything it does afterwards. Two
  // requests per call for an answer that cannot change while a batch is being
  // placed is what spent the allowance the first time this was asked to queue
  // one. A rejection is not kept, so a run refused here can be asked again
  // rather than carrying the refusal for the rest of its life.
  run.read ??= readWiring(run).catch(cause => {
    run.read = null
    throw cause
  })
  return run.read
}

async function readWiring(run) {
  const account = await gql(run, ORGANIZATIONS)
  const organizationId = account.account.organizations[0]?.id
  if (!organizationId) throw new Error('no organization on this Buffer account')

  const { channels } = await gql(run, CHANNELS, { input: { organizationId } })
  const managed = channels
    .filter(channel => CADENCE[channel.service])
    .map(channel => ({ ...channel, cadence: CADENCE[channel.service] }))
  const absent = Object.keys(CADENCE).filter(
    service => !managed.some(channel => channel.service === service)
  )

  if (!managed.length) {
    throw new Error(`no channel this queue schedules is connected: ${absent.join(', ')}`)
  }
  return { organizationId, channels: managed, absent }
}

/** Every post Buffer holds for the organization, whatever its state or channel. */
export async function posts(key, organizationId) {
  const { posts: page } = await gql(connect(key), POSTS, { input: { organizationId } })
  return page.edges.map(edge => edge.node)
}

/** How many whole days stand between a moment and the last post booked after it. */
function runwayDays(lastDue, now) {
  if (!lastDue) return 0
  return Math.max(Math.floor((new Date(lastDue).getTime() - now.getTime()) / DAY), 0)
}

/** What the queue holds on one channel. */
function readChannel(channel, all, now) {
  const mine = all.filter(post => post.channelId === channel.id)
  const scheduled = mine
    .filter(post => post.status === 'scheduled' && post.dueAt)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const drafts = mine.filter(post => post.status === 'draft')
  const failed = mine.filter(post => post.status === 'error' || post.status === 'failed')
  const ahead = scheduled.filter(post => post.dueAt > now.toISOString())
  const lastDue = ahead.length ? ahead[ahead.length - 1].dueAt : null

  return {
    name: channel.name,
    service: channel.service,
    // Every day, or the days it names: the cadence as a reader of the answer
    // would say it, rather than as the slot search consumes it.
    cadence: cadenceInWords(channel.cadence),
    connected: !channel.isDisconnected && !channel.isLocked,
    queuePaused: Boolean(channel.isQueuePaused),
    sent: mine.filter(post => post.status === 'sent').length,
    drafts: drafts.length,
    draftIds: drafts.map(post => post.id),
    scheduled: scheduled.length,
    failed: failed.length,
    failedIds: failed.map(post => post.id),
    postsAhead: ahead.length,
    daysOfRunway: runwayDays(lastDue, now),
    nextDue: ahead[0]?.dueAt ?? null,
    lastDue,
  }
}

/**
 * What the queue holds, per channel and rolled up.
 *
 * The roll-up takes the worst of the channels rather than their total, because
 * a queue is only as alive as its quietest channel: one going dry while another
 * runs a month ahead is a channel that has stopped publishing, and a sum hides
 * exactly that.
 */
export async function status(key, now = new Date()) {
  const run = connect(key)
  const { organizationId, channels, absent } = await wiring(run)
  const all = await posts(run, organizationId)
  const read = channels.map(channel => readChannel(channel, all, now))

  const total = field => read.reduce((sum, channel) => sum + channel[field], 0)
  const scheduled = read.filter(channel => channel.lastDue)

  return {
    channels: read,
    absent,
    disconnected: read.filter(channel => !channel.connected).map(channel => channel.service),
    sent: total('sent'),
    drafts: total('drafts'),
    draftIds: read.flatMap(channel => channel.draftIds),
    scheduled: total('scheduled'),
    failed: total('failed'),
    failedIds: read.flatMap(channel => channel.failedIds),
    daysOfRunway: read.length ? Math.min(...read.map(channel => channel.daysOfRunway)) : 0,
    nextDue: scheduled.map(channel => channel.nextDue).sort()[0] ?? null,
    lastDue:
      scheduled
        .map(channel => channel.lastDue)
        .sort()
        .pop() ?? null,
  }
}

/**
 * One post onto a channel already resolved, at a time or held back as a draft.
 *
 * Separate from `post` because a caller that has already read the wiring - to
 * work out which day the post belongs on, say - would otherwise read it again
 * to place each post it decided on.
 */
export async function place(key, { channelId, text, metadata, assets = [], at, draft }) {
  const input = {
    channelId,
    text,
    assets,
    metadata,
    mode: draft ? 'addToQueue' : 'customScheduled',
    schedulingType: 'automatic',
    needsApproval: false,
    saveToDraft: Boolean(draft),
  }
  if (!draft) input.dueAt = at
  const data = await gql(connect(key), CREATE, { input })
  return unwrap(data.createPost, 'create')
}

/**
 * One post onto a channel named by its service, at a time or as a draft.
 *
 * A caller placing several should open a run with `connect` and hand that over
 * instead of the key. The wiring naming the channel is then read once for all
 * of them rather than once each, which is the difference between a batch of
 * fifty costing fifty-two requests and costing a hundred and sixty.
 */
export async function post(key, { text, at, draft, assets = [], service = 'facebook' }) {
  const run = connect(key)
  const { channels } = await wiring(run)
  const channel = channels.find(candidate => candidate.service === service)
  if (!channel) throw new Error(`no ${service} channel connected to this Buffer account`)

  if (channel.cadence.requiresImage && !assets.length) {
    throw new Error(
      `${service} publishes no post without an image, so this one would fail when due`
    )
  }
  if (channel.cadence.maxLength && text.length > channel.cadence.maxLength) {
    throw new Error(
      `${service} refuses a post past ${channel.cadence.maxLength} characters, and this is ${text.length}`
    )
  }

  const written = await place(run, {
    channelId: channel.id,
    text,
    metadata: channel.cadence.metadata,
    assets,
    at,
    draft,
  })
  return { ...written, service: channel.service }
}

/**
 * Moves each channel's drafts into the free slots ahead of them, oldest first.
 *
 * A draft is content already written and approved that publishes to nobody
 * while it sits, which is the state the queue drifts into whenever a day was
 * already taken. Promoting is idempotent: it reads what is scheduled, fills
 * only slots nothing holds, and does nothing at all where there is no draft or
 * no gap. Channels are worked independently, so one with an empty queue does
 * not stop another being filled.
 *
 * Every request a run makes shares one wiring read and one budget for waiting
 * out a refusal, so a channel with a dozen drafts cannot spend a dozen times
 * the patience the caller allowed for. A run that is refused for good throws,
 * carrying what it had already moved: the search reads the queue back every
 * time, so a repeat moves nothing twice, and a report that cannot say how far
 * it got reads as though it got nowhere.
 *
 * @param {string|object} key A Buffer public API key, or a run from `connect`.
 * @param {object} [options]
 * @param {number} [options.limit] The most slots to fill per channel per run.
 * @param {Date} [options.now] The moment the slot search starts from.
 */
export async function promote(key, { limit = 5, now = new Date() } = {}) {
  const run = connect(key)
  const { organizationId, channels } = await wiring(run)
  const all = await posts(run, organizationId)

  const promoted = []
  const skipped = []

  try {
    for (const channel of channels) {
      const mine = all.filter(candidate => candidate.channelId === channel.id)
      const drafts = mine.filter(candidate => candidate.status === 'draft')
      if (!drafts.length) {
        skipped.push({ service: channel.service, reason: 'no drafts waiting' })
        continue
      }

      const scheduled = mine.filter(candidate => candidate.status === 'scheduled')
      const slots = freeSlots(channel.cadence, scheduled, Math.min(limit, drafts.length), now)
      if (!slots.length) {
        skipped.push({ service: channel.service, reason: 'no free slot inside the horizon' })
        continue
      }

      // The slot is taken when a draft is actually placed on it rather than
      // handed out by position. A draft stood down for having no image would
      // otherwise take its slot down with it, and the day it was holding would
      // sit empty behind a promotion that reported itself as done.
      let next = 0
      for (const draft of drafts) {
        if (next >= slots.length) break
        const assets = assetsAsInput(draft.assets)

        // A channel that publishes nothing without media, and a draft that has
        // none, is a post that would be scheduled here and fail when it came
        // due. Left as a draft it is still written work somebody can put an
        // image on; promoted it is a booked day the account spends saying
        // nothing. So it is stood down and named, and the channel's other
        // drafts go on being promoted around it.
        if (channel.cadence.requiresImage && !assets.length) {
          skipped.push({
            service: channel.service,
            reason: `a draft carries no image, which ${channel.service} will not publish`,
            id: draft.id,
          })
          continue
        }

        const data = await gql(run, EDIT, {
          input: {
            id: draft.id,
            text: draft.text,
            assets,
            metadata: channel.cadence.metadata,
            dueAt: slots[next],
            mode: 'customScheduled',
            schedulingType: 'automatic',
            saveToDraft: false,
          },
        })
        next += 1
        promoted.push({ ...unwrap(data.editPost, 'promote'), service: channel.service })
      }
    }
  } catch (cause) {
    throw Object.assign(cause, { promoted, skipped })
  }

  return { promoted, skipped }
}
