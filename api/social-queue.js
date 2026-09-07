/**
 * Keeps the client post queue moving, on Vercel's schedule rather than anyone's.
 *
 * The daily routine writes the posts, and it can only do that on a day it runs.
 * A run that fails, or that stands its own post down because the day was
 * already taken, leaves a draft that publishes to nobody — so the queue drifts
 * toward full of written work and empty of scheduled work, and nothing about
 * that state announces itself.
 *
 * This endpoint is the half that does not depend on the routine. It promotes
 * whatever drafts are waiting into the slots nothing holds, on every channel it
 * schedules, and reports the runway it left behind. It writes nothing else and
 * it never publishes: every post it touches was already written and already
 * approved as a draft.
 *
 * Vercel signs a cron invocation with CRON_SECRET, which is the only caller
 * this accepts. The Buffer key is BUFFER_API_KEY here — a function has no vault
 * to read one from, unlike `scripts/social/social.js`.
 *
 * Buffer refuses every request once its allowance is spent, reads included, so
 * the run is opened with a fixed share of its own invocation to spend waiting
 * one out. Past that it answers 429 rather than throwing away the reason: a
 * promotion that gave up and a promotion with nothing to promote are the same
 * quiet 200 otherwise, which is the whole thing this endpoint guards against.
 */
import { ownsSchedules } from '../lib/site/current.js'
import { servedHereOr404 } from '../lib/http/guard.js'
import { isScheduler } from '../lib/http/scheduler.js'
import {
  CADENCE,
  RATE_LIMITED,
  connect,
  coversDays,
  promote,
  status,
} from '../lib/social/buffer.js'
import { postsCritical } from '../lib/social/watch.js'

const BUFFER_API_KEY = process.env.BUFFER_API_KEY || ''

/**
 * Which channels hold too little to keep publishing while more are written.
 *
 * Asked of each channel against its own cadence rather than of the account
 * against one figure. A daily channel and a twice-weekly one covering the same
 * span of days hold a week of posts and two, so a single threshold over both
 * either reports the slower channel as empty most of the time or lets the daily
 * one run down to nothing before it says so.
 */
const runningDryOn = channels =>
  channels
    .filter(
      channel => channel.postsAhead < postsCritical(coversDays(CADENCE[channel.service] ?? {}))
    )
    .map(channel => channel.service)

/**
 * How long the platform gives this run, and what of it may go on waiting.
 *
 * The duration is declared rather than inherited because the budget below has
 * to be smaller than it, and a default that moves underneath a figure chosen
 * against it is a bound that quietly stops being one. The queue promotes a
 * handful of drafts and reads the result, so the requests themselves are the
 * small half of a minute and the waiting is capped at a third of it.
 */
export const config = { maxDuration: 60 }
const RETRY_BUDGET_MS = 20_000

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  // Both projects register all nine crons, because vercel.json is read before
  // any build runs. This is what decides which deployment acts on them. A 204
  // rather than an error: the schedule fired correctly, there was simply
  // nothing here to do.
  if (!ownsSchedules()) return response.status(204).end()

  if (!isScheduler(request.headers.authorization)) {
    response.status(401).json({ error: 'not authorized' })
    return
  }
  if (!BUFFER_API_KEY) {
    response.status(500).json({ error: 'BUFFER_API_KEY is not set' })
    return
  }

  // One run for both halves: the wiring is read once for the promotion and the
  // reading after it, and the waiting either does is spent from the same pool.
  const run = connect(BUFFER_API_KEY, { budgetMs: RETRY_BUDGET_MS })

  try {
    const moved = await promote(run)
    const after = await status(run)
    const dry = runningDryOn(after.channels)

    response.status(200).json({
      ok: true,
      promoted: moved.promoted.map(post => ({
        id: post.id,
        service: post.service,
        dueAt: post.dueAt,
      })),
      skipped: moved.skipped,
      channels: after.channels,
      // A service the cadence covers that Buffer has nothing connected for, and
      // a channel whose authorisation has lapsed. Either one publishes nothing
      // while leaving a queue that reads as calm.
      absent: after.absent,
      disconnected: after.disconnected,
      drafts: after.drafts,
      scheduled: after.scheduled,
      daysOfRunway: after.daysOfRunway,
      failed: after.failed,
      failedIds: after.failedIds,
      // Things a person would want to be told rather than have to notice.
      runningDry: dry.length > 0,
      // Which of them, because the account-wide runway figure above is the
      // quietest channel's and names none.
      runningDryOn: dry,
      needsAttention:
        after.failed > 0 ||
        dry.length > 0 ||
        after.absent.length > 0 ||
        after.disconnected.length > 0,
      nextDue: after.nextDue,
      lastDue: after.lastDue,
    })
  } catch (cause) {
    // A run that could not finish answers in the same fields as one that
    // finished badly. This endpoint exists because a queue that has stopped
    // publishing reads exactly like a queue with nothing to do, and an error
    // body carrying nothing but a sentence puts the reader back in that
    // position: `needsAttention` is the field a watcher reads, so a failure
    // sets it rather than leaving it undefined.
    const limited = cause.code === RATE_LIMITED
    console.error('social queue: %s', cause.message)

    // The status is the half a monitor can read without parsing anything. 429
    // says the work is still there to be done and the next run will find it;
    // 500 says something is wrong with the queue itself.
    if (limited && cause.retryAfterMs) {
      response.setHeader('Retry-After', String(Math.ceil(cause.retryAfterMs / 1000)))
    }
    response.status(limited ? 429 : 500).json({
      ok: false,
      error: cause.message,
      code: cause.code ?? null,
      rateLimited: limited,
      needsAttention: true,
      attempts: cause.attempts ?? null,
      waitedMs: cause.waitedMs ?? null,
      retryAfterMs: cause.retryAfterMs ?? null,
      // What the run had already moved before it was stopped. Promoting reads
      // the queue back every time, so the next run repeats none of it.
      promoted: (cause.promoted ?? []).map(post => ({
        id: post.id,
        service: post.service,
        dueAt: post.dueAt,
      })),
      skipped: cause.skipped ?? [],
    })
  }
}
