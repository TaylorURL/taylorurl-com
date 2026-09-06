/**
 * Whether the post queue is still publishing, and what to say when it is not.
 *
 * Every way this queue stops is quiet. A channel that loses its authorisation
 * keeps its posts and publishes none of them. A queue that runs to its last
 * scheduled day empties without an event. A post that Buffer failed to send
 * leaves the Page silent for a day and reports nothing anywhere. None of those
 * raise an error, and each of them looks from the outside exactly like a week
 * with nothing to say.
 *
 * So the reading is separated from the fetching. `judge` takes the wiring and
 * the posts and answers findings, which makes every threshold and every state
 * checkable without a Buffer account; `watch` is the three requests that get
 * the material.
 *
 * The findings are kinds rather than a score, because the four states that stop
 * this queue are answered in four different places. A throttle is waited out. A
 * dropped channel is re-authorised in Buffer. A short queue is refilled by
 * writing posts. A post that failed to publish is read in Buffer's own log. A
 * single "unhealthy" flag would send a reader to all four.
 */
import { CADENCE, RATE_LIMITED, connect, coversDays, posts, wiring } from './buffer.js'
import { dayIn } from '../time/zone.js'

/** What each service the cadence covers is expected to be, and since when.
 *
 * A service with no connected channel is the one state that stays true between
 * runs. Reporting it as a fault every morning trains the report to be ignored,
 * and dropping it entirely is how a channel nobody bought stops being anybody's
 * job. So an awaited service is carried in every answer and raises nothing —
 * until `review` passes, at which point the absence needs deciding again rather
 * than renewing itself in silence.
 *
 * `standing: 'connected'` is the ordinary case: a service Buffer is expected to
 * hold a channel for, whose absence is a channel that has left the account.
 */
export const EXPECTED = {
  facebook: { standing: 'connected' },
  instagram: { standing: 'connected' },
  googlebusiness: { standing: 'connected' },
}

/** What a finding is about. Each one is answered somewhere different. */
export const FINDING = {
  throttled: 'throttled',
  dropped: 'channel-dropped',
  awaited: 'channel-awaited',
  short: 'queue-short',
  unpublished: 'post-unpublished',
  roster: 'roster-stale',
  fault: 'watch-failed',
}

/** How much of somebody's morning a finding is worth. */
export const SEVERITY = {
  // The queue was not read. Nothing in the answer is a verdict on it, and a run
  // that reports this has not reported a healthy queue.
  unknown: 'unknown',
  // Publishing has stopped, or stops within days if nothing is done.
  alarm: 'alarm',
  // A decision somebody deferred is now overdue.
  warn: 'warn',
  // Known, expected, and carried so it cannot be forgotten.
  standing: 'standing',
}

/**
 * How much publishing the queue has to hold before the shortage is the finding.
 *
 * Seven days is what it takes for a shortage to still be ordinary work when
 * somebody reads it: the watch fires daily, but a reader can be away for a
 * weekend, and refilling the queue means writing posts and landing them through
 * a pull request with CI rather than typing into Buffer. A week survives a
 * missed run, two days of nobody looking, and the round trip of the fix, and
 * still leaves days in hand.
 */
export const RUNWAY_FLOOR_DAYS = 7

/**
 * The runway at which the shortage stops being ordinary work.
 *
 * Below three days a channel goes quiet inside the time it takes to notice, so
 * a shortage this deep is read as an alarm rather than as work to get to.
 */
export const RUNWAY_CRITICAL_DAYS = 3

/**
 * The fewest posts a channel is held to whatever its cadence says.
 *
 * A channel posting twice a week covers three or four days with one post, so a
 * floor derived from days alone lets it sit one bad week from silence and call
 * that healthy. Two posts is the smallest queue that survives writing nothing
 * for a cycle.
 */
export const MIN_POSTS_AHEAD = 2

/**
 * The floors, in posts rather than in days.
 *
 * Runway was measured in days while one daily channel was the whole system,
 * where the two are the same number. They come apart the moment a channel
 * publishes on any other clock: a channel holding only next Tuesday has most of
 * a week of runway and one post, and a floor of seven days reads that as nearly
 * empty every day of the week. What refilling produces is posts, so posts are
 * what the queue is judged on, and the day figures above are what a cadence
 * converts into them.
 *
 * `everyDays` is what one post covers, which `coversDays` reads off the days
 * the cadence names rather than off a number written beside them.
 */
export const postsFloor = everyDays =>
  Math.max(MIN_POSTS_AHEAD, Math.ceil(RUNWAY_FLOOR_DAYS / everyDays))

export const postsCritical = everyDays => Math.max(1, Math.ceil(RUNWAY_CRITICAL_DAYS / everyDays))

/**
 * How long after its slot a post may still be unsent before that is the finding.
 *
 * Buffer publishes on its own clock and a slot is a time it aims at rather than
 * one it guarantees. Two hours is well past any ordinary lateness and well
 * inside a day, so a post that never went is caught on the morning after its
 * slot rather than the morning after that.
 */
export const PUBLISH_GRACE_MS = 2 * 60 * 60 * 1000

const DAY = 24 * 60 * 60 * 1000

/** Statuses Buffer gives a post it tried to publish and could not. */
const FAILED = new Set(['error', 'failed'])

/** How many whole days stand between a moment and the last post booked after it. */
function runwayDays(lastDue, now) {
  if (!lastDue) return 0
  return Math.max(Math.floor((new Date(lastDue).getTime() - now.getTime()) / DAY), 0)
}

/**
 * The last slot on a channel that has already come and gone, and what became
 * of it.
 *
 * Drafts are left out. A draft carries no promise about a day — promoting is
 * what gives it one — so a draft sitting past a date Buffer happened to stamp
 * on it is not a post that failed to publish, and counting it as one would
 * report a fault every time the queue held written work.
 */
function lastSlot(mine, now) {
  const by = new Date(now.getTime() - PUBLISH_GRACE_MS).toISOString()
  const past = mine
    .filter(post => post.dueAt && post.dueAt <= by && post.status !== 'draft')
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  return past[past.length - 1] ?? null
}

/**
 * What one channel holds, and whether its last slot actually published.
 *
 * @param {object} channel A channel as `wiring` returns it.
 * @param {object[]} all Every post Buffer holds for the organization.
 * @param {Date} now The moment the reading is taken at.
 */
export function readChannel(channel, all, now) {
  const mine = all.filter(post => post.channelId === channel.id)
  const nowIso = now.toISOString()
  const scheduled = mine.filter(post => post.status === 'scheduled' && post.dueAt)
  const ahead = scheduled
    .filter(post => post.dueAt > nowIso)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const slot = lastSlot(mine, now)

  return {
    id: channel.id,
    name: channel.name,
    service: channel.service,
    // How many days one post covers here, carried so the runway floor can be
    // read against the clock this channel keeps rather than a daily one.
    everyDays: coversDays(channel.cadence ?? CADENCE[channel.service] ?? {}),
    connected: !channel.isDisconnected && !channel.isLocked,
    disconnected: Boolean(channel.isDisconnected),
    locked: Boolean(channel.isLocked),
    queuePaused: Boolean(channel.isQueuePaused),
    sent: mine.filter(post => post.status === 'sent').length,
    drafts: mine.filter(post => post.status === 'draft').length,
    scheduled: scheduled.length,
    failed: mine.filter(post => FAILED.has(post.status)).length,
    postsAhead: ahead.length,
    nextDue: ahead[0]?.dueAt ?? null,
    lastDue: ahead.length ? ahead[ahead.length - 1].dueAt : null,
    daysOfRunway: runwayDays(ahead.length ? ahead[ahead.length - 1].dueAt : null, now),
    // The slot that has already passed, and the state Buffer left it in. Null
    // on a channel that has never had one, which is a new channel rather than
    // a channel that stopped.
    lastSlot: slot ? { id: slot.id, dueAt: slot.dueAt, status: slot.status } : null,
  }
}

const finding = (kind, severity, service, detail) => ({ kind, severity, service, ...detail })

/** Whether a channel's last slot published, and what to say when it did not. */
function slotFinding(read) {
  if (!read.lastSlot) return null
  const { status, dueAt, id } = read.lastSlot
  if (status === 'sent') return null

  const late = FAILED.has(status)
    ? `Buffer reported it as ${status}`
    : `it is still marked ${status}`
  return finding(FINDING.unpublished, SEVERITY.alarm, read.service, {
    postId: id,
    dueAt,
    status,
    detail:
      `the ${read.service} slot due at ${dueAt} did not publish: ${late}. ` +
      'That is a day the Page said nothing.',
  })
}

/** Whether a channel is short of runway, and how short. */
function runwayFinding(read) {
  const floor = postsFloor(read.everyDays)
  if (read.postsAhead >= floor) return null
  const critical = read.postsAhead < postsCritical(read.everyDays)
  return finding(FINDING.short, critical ? SEVERITY.alarm : SEVERITY.warn, read.service, {
    postsAhead: read.postsAhead,
    daysOfRunway: read.daysOfRunway,
    floor,
    lastDue: read.lastDue,
    detail:
      `the ${read.service} queue runs ${read.daysOfRunway} more ` +
      `${read.daysOfRunway === 1 ? 'day' : 'days'} on ${read.postsAhead} ` +
      `${read.postsAhead === 1 ? 'post' : 'posts'}, under the ${floor} ` +
      'it takes to write and land more before the channel goes quiet',
  })
}

/** What a service with no connected channel means, given what was expected. */
function absenceFinding(service, now, roster) {
  const expected = roster[service]
  if (!expected || expected.standing === 'connected') {
    return finding(FINDING.dropped, SEVERITY.alarm, service, {
      detail:
        `Buffer holds no ${service} channel, and one is expected. A channel that ` +
        'left the account publishes nothing and empties no queue, so the queue ' +
        'reads as calm while the service is silent.',
    })
  }

  // The review date is a day somebody wrote down at a desk in Texas, so the day
  // it is compared against is the one at that desk. Taken off a UTC clock, an
  // evening run reaches the date before the date arrives.
  const due = expected.review && dayIn(now) >= expected.review
  return finding(FINDING.awaited, due ? SEVERITY.warn : SEVERITY.standing, service, {
    since: expected.since ?? null,
    review: expected.review ?? null,
    detail: due
      ? `${service} has had no channel since ${expected.since}, and ${expected.review} ` +
        'was the date to decide again. Connect it, or move the date in EXPECTED and ' +
        'say why.'
      : `${service} has no channel: ${expected.reason}. Expected, and reviewed on ` +
        `${expected.review}.`,
  })
}

/**
 * Every finding the reading supports, and the channels it was taken from.
 *
 * Nothing here reaches Buffer, so every threshold and every state below can be
 * driven from a fixture: a queue three days from empty, a channel that dropped
 * its authorisation overnight, a slot that came and went unsent.
 *
 * @param {object} options
 * @param {object[]} options.channels Connected channels, as `wiring` returns them.
 * @param {object[]} options.posts Every post Buffer holds for the organization.
 * @param {Date} [options.now] The moment the reading is taken at.
 * @param {object} [options.roster] What each service is expected to be. Taken
 *   from `EXPECTED` in ordinary use, and passed in so the awaited state stays
 *   exercisable once every service the cadence covers is connected.
 * @returns {{findings: object[], channels: object[], read: boolean}}
 */
export function judge({ channels, posts: all = [], now = new Date(), roster = EXPECTED }) {
  const read = channels.map(channel => readChannel(channel, all, now))
  const findings = []

  for (const service of Object.keys(CADENCE)) {
    const channel = read.find(candidate => candidate.service === service)

    if (!channel) {
      findings.push(absenceFinding(service, now, roster))
      continue
    }

    // A channel Buffer holds but will not publish through is the state the
    // absence check cannot see: the posts are all still there and every count
    // in the answer reads normally.
    if (!channel.connected) {
      const why = channel.disconnected ? 'lost its authorisation' : 'is locked'
      findings.push(
        finding(FINDING.dropped, SEVERITY.alarm, service, {
          detail:
            `the ${service} channel ${why}. It holds ${channel.scheduled} scheduled ` +
            'posts and will publish none of them.',
        })
      )
    }

    // A queue Buffer is holding rather than publishing empties on the calendar
    // and not at all on the Page, so the runway reads healthy the whole time.
    if (channel.queuePaused) {
      findings.push(
        finding(FINDING.dropped, SEVERITY.alarm, service, {
          detail: `the ${service} queue is paused in Buffer, so nothing in it goes out`,
        })
      )
    }

    // A service the roster still calls awaited, that Buffer now holds a channel
    // for. Good news and a stale file, and saying so is what stops the next
    // absence being read against a roster nobody updated.
    if (roster[service]?.standing === 'awaited') {
      findings.push(
        finding(FINDING.roster, SEVERITY.warn, service, {
          detail:
            `Buffer now holds a ${service} channel, and EXPECTED in ` +
            'lib/social/watch.js still calls it awaited. Move it to connected, ' +
            'so a later absence reads as a channel that dropped.',
        })
      )
    }

    const slot = slotFinding(channel)
    if (slot) findings.push(slot)

    // Only asked of a channel that can publish. A dropped channel has already
    // been reported, and a runway figure for one is a count of posts nothing
    // will send.
    if (channel.connected && !channel.queuePaused) {
      const runway = runwayFinding(channel)
      if (runway) findings.push(runway)
    }
  }

  return { findings, channels: read, read: true }
}

/** Whether a set of findings is something somebody has to act on. */
export const needsAttention = findings =>
  findings.some(item => item.severity === SEVERITY.alarm || item.severity === SEVERITY.warn)

/** Whether a set of findings says the queue could not be read at all. */
export const unread = findings => findings.some(item => item.severity === SEVERITY.unknown)

/**
 * The queue, read from Buffer and judged.
 *
 * Three requests: the organization, the channels, and the posts. The run is
 * opened once and handed to both calls, so the wiring is read for the run
 * rather than for each of them.
 *
 * A rate limit is answered rather than thrown. Buffer refusing a read for its
 * timing says nothing whatever about whether a channel is connected or a queue
 * is full, and a watch that reports a throttle as a fault sends somebody to
 * re-authorise a channel that was never disconnected. It comes back as one
 * `throttled` finding at `unknown`, which is not a verdict and is not a clean
 * bill either. Every other failure throws, because a watch that cannot say why
 * it failed has to be read by a person and not swallowed into a field.
 *
 * @param {string|object} key A Buffer public API key, or a run from `connect`.
 * @param {object} [options]
 * @param {Date} [options.now] The moment the reading is taken at.
 * @param {number} [options.budgetMs] What the run may spend waiting out refusals.
 */
export async function watch(key, { now = new Date(), budgetMs } = {}) {
  const run = connect(key, budgetMs === undefined ? {} : { budgetMs })

  let material
  try {
    const { organizationId, channels, absent } = await wiring(run)
    material = { channels, absent, posts: await posts(run, organizationId) }
  } catch (cause) {
    if (cause.code !== RATE_LIMITED) throw cause
    return {
      read: false,
      at: now.toISOString(),
      channels: [],
      absent: [],
      findings: [
        finding(FINDING.throttled, SEVERITY.unknown, null, {
          code: cause.code,
          attempts: cause.attempts ?? null,
          waitedMs: cause.waitedMs ?? null,
          retryAfterMs: cause.retryAfterMs ?? null,
          detail:
            `Buffer would not answer: ${cause.message}. The queue was not read, so ` +
            'nothing here says a channel is connected or a queue is full.',
        }),
      ],
      needsAttention: false,
      unread: true,
    }
  }

  const judged = judge({ channels: material.channels, posts: material.posts, now })
  return {
    read: true,
    at: now.toISOString(),
    channels: judged.channels,
    absent: material.absent,
    findings: judged.findings,
    needsAttention: needsAttention(judged.findings),
    unread: false,
  }
}

/** One finding as a line, for a terminal or a routine's report. */
export const line = item =>
  `${item.severity.toUpperCase()} ${item.kind}${item.service ? ` (${item.service})` : ''}: ${item.detail}`

/**
 * The answer as a person would read it aloud, worst first.
 *
 * A run that found nothing says so in as many words. A watch whose quiet answer
 * is an empty string is one nobody can tell from a watch that did not run.
 */
export function summary(answer) {
  if (!answer.read) return answer.findings.map(line).join('\n')

  const order = [SEVERITY.alarm, SEVERITY.warn, SEVERITY.standing]
  const sorted = [...answer.findings].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity)
  )
  const queues = answer.channels
    .map(channel => `${channel.service} ${channel.daysOfRunway}d`)
    .join(', ')

  if (!sorted.length) return `social queue holds: ${queues}`
  return [`social queue holds: ${queues}`, ...sorted.map(line)].join('\n')
}
