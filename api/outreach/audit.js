/**
 * Measures how a prospect's website performs on a phone.
 *
 * What it does: takes a batch of prospects at stage 'enriched' and runs each
 * one's site through the PageSpeed Insights API on the mobile strategy. One
 * report scores four categories, and asking for all four costs the same single
 * request as asking for one. Each comes back as a fraction and is stored as a
 * whole number out of 100, next to the headline metrics and the largest savings
 * the report names.
 *
 * Performance is the figure the outreach message is about and the one the
 * console, the send order and the opportunity bands are built on, so it keeps
 * the audit_score column to itself. Accessibility, best practices and SEO take
 * columns beside it. All four are stored whatever they say; which of them a
 * message shows is the message's own decision.
 *
 * A prospect whose listed website is a platform profile is never measured, and
 * the queue passes over it rather than taking it and putting it back. A
 * reading of a Facebook page is a reading of Facebook, and the number it
 * returns says nothing about the business the message would go to. Those rows
 * leave stage 'enriched' by being sent to, not by being measured.
 *
 * A measurement that fails leaves the row where it is and raises its
 * audit_attempts, and the queue takes the least-attempted rows first, so a
 * site that was down for a minute is tried again from the back of the line
 * rather than the front. After ATTEMPT_LIMIT refusals the row stops at
 * 'unreachable' with the count in skip_reason. Without both halves of that,
 * five permanently broken sites at the head of the queue hold up every
 * prospect behind them for good.
 *
 * A reading goes stale. The score is what the message is about and what a
 * reader can check against their own site in a minute, so a row still waiting
 * at 'audited' is measured again once its reading is STALE_AFTER_DAYS old. It
 * is measured on whatever the run has left after the businesses waiting on
 * their first reading have been taken, since a row with no number cannot be
 * written to at all and a row with an old one can. It stays at 'audited'
 * throughout, so nothing leaves the send queue to be refreshed, and a
 * re-measure that fails keeps the number the row already had rather than
 * walking a measured business back to 'unreachable'.
 *
 * Rows past 'audited' are left alone. Their score is no longer a measurement
 * of a site; it is the figure a message quoted, and rewriting it would leave
 * the table disagreeing with what the business was actually sent.
 *
 * What it reads: GOOGLE_PAGESPEED_API_KEY, `outreach_prospects` at stage
 * 'enriched' that carry a site of their own, and those at 'audited' whose
 * reading has gone stale.
 *
 * What it writes: the same rows. A reading sets audit_score, the three category
 * scores beside it, audit_at, a trimmed audit_raw, a cleared audit_attempts and
 * stage 'audited'. A category the report answers nothing for is left null
 * rather than written as a zero, since absent and nought are different
 * readings.
 *
 * What stops it: an empty queue or a missing API key. A slow report does not,
 * since only a few are measured at a time and each carries its own timeout.
 */

import { servedHereOr404 } from '../../lib/http/guard.js'
import { mapWithLimit, runJob } from '../../lib/outreach/runtime.js'
import { measure, reading } from '../../lib/outreach/pagespeed.js'

const API_KEY = process.env.GOOGLE_PAGESPEED_API_KEY || ''

/**
 * Prospects one run measures.
 *
 * Every business with a site of its own passes through here on its way to the
 * send queue, so this is a ceiling on the day's sending as much as the cap is.
 * Five a run at twice an hour is two hundred and forty a day, which was ample
 * while the enricher handed over fifty; it is not once the enricher is sized to
 * feed a full day, and a stage that measures fewer businesses than reach it
 * simply moves where the queue runs dry rather than fixing it.
 *
 * The stale re-measures share the run, taking only what the businesses waiting
 * on a first reading leave behind, so the room has to cover both to refresh
 * anything at all on a busy day.
 *
 * Exported so a check that has to fill a run builds its batch from the run's
 * own size rather than from a number written twice.
 */
export const BATCH = 12
/**
 * Reports running at once, which is well inside the API's per-minute allowance.
 *
 * A report is a minute of waiting on Google at the outside, so what the run
 * spends is how many of those sit end to end rather than how many it asks for:
 * a batch this wide is three deep, which is three of the five minutes the job
 * is given. Four at a time asks the API for a handful of reports a minute,
 * against an allowance in the hundreds.
 */
const CONCURRENCY = 4
/** Refusals a site is given before it stops being asked. */
const ATTEMPT_LIMIT = 3

/**
 * Days a reading stands before the site is measured again.
 *
 * The number is what the message quotes, and it is a claim about the reader's
 * own site that the reader can check in the time it takes to run the test
 * themselves. A month is long enough that re-measuring costs almost nothing
 * against a table this size, and short enough that a business which has since
 * had its site rebuilt is not written to about a figure that stopped being
 * true weeks ago.
 */
const STALE_AFTER_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export const config = { maxDuration: 300 }

/**
 * What a row becomes when a report on it fails.
 *
 * The count is what the queue orders by, so raising it moves the row behind
 * everything with a fairer claim on the next run. A site that refuses often
 * enough stops being asked, since the alternative is a handful of dead sites
 * holding the front of the queue against everything behind them.
 *
 * A re-measure is not held to that. The row already carries a reading, and a
 * business measured in August is not out of reach because its site was slow to
 * answer in September: it keeps the number it had and its place in the send
 * queue. The count still rises, and the stale queue passes over a row that has
 * reached the limit, so a site that has genuinely gone stops being asked
 * without ever being walked back to 'unreachable' on the strength of a second
 * reading that never came.
 */
export function afterFailure(prospect) {
  const attempts = (prospect.audit_attempts ?? 0) + 1
  if (prospect.again || attempts < ATTEMPT_LIMIT) return { audit_attempts: attempts }
  return {
    stage: 'unreachable',
    audit_attempts: attempts,
    skip_reason: `the site did not measure in ${attempts} attempts`,
  }
}

/** The columns a measurement needs, whether it is the row's first or its next. */
const QUEUE_COLUMNS = 'id, website, site_kind, audit_attempts'

/** Prospects waiting on their first reading, longest waiting first. */
async function firstReadings(db, room) {
  const { data, error } = await db
    .from('outreach_prospects')
    .select(QUEUE_COLUMNS)
    .eq('stage', 'enriched')
    .or('site_kind.is.null,site_kind.neq.social')
    .order('audit_attempts', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(room)
  if (error) throw new Error(error.message)
  return data
}

/**
 * Prospects whose reading has gone stale, oldest reading first.
 *
 * A row is only re-measured while it stands at 'audited', which is to say
 * while it is still waiting to be written to. Past that the score is not a
 * measurement any more, it is the number a message quoted, and measuring it
 * again would rewrite the record of what the business was actually told.
 *
 * A row that has spent its attempts is passed over rather than measured and
 * failed again, which is what keeps a handful of dead sites from taking the
 * spare capacity of every run for good.
 */
async function staleReadings(db, room, now) {
  const { data, error } = await db
    .from('outreach_prospects')
    .select(QUEUE_COLUMNS)
    .eq('stage', 'audited')
    .not('website', 'is', null)
    .lt('audit_at', new Date(now.getTime() - STALE_AFTER_DAYS * DAY_MS).toISOString())
    .lt('audit_attempts', ATTEMPT_LIMIT)
    .or('site_kind.is.null,site_kind.neq.social')
    .order('audit_at', { ascending: true })
    .limit(room)
  if (error) throw new Error(error.message)
  return data.map(row => ({ ...row, again: true }))
}

export async function work({ db, counts }) {
  if (!API_KEY) throw new Error('GOOGLE_PAGESPEED_API_KEY is not set')

  const now = new Date()

  // A business waiting on its first reading is why this job exists, and a
  // re-measure only ever spends what that half of the run left behind. A
  // backlog of new prospects is a run that refreshes nothing, which is the
  // right way round: the row with no number at all cannot be written to, and
  // the row with an old one can.
  const waiting = await firstReadings(db, BATCH)
  const stale = waiting.length < BATCH ? await staleReadings(db, BATCH - waiting.length, now) : []
  const queue = [...waiting, ...stale]
  if (!queue.length) return { queue: 0, again: 0 }

  const failures = []
  const outcomes = await mapWithLimit(queue, CONCURRENCY, async prospect => {
    counts.examined += 1

    // An enriched prospect has a website of its own by construction, since
    // that is where its address was read from. A row that reached here without
    // one has nothing left to measure, so it stops rather than circling the
    // queue.
    //
    // A re-measure is never in this position, since the stale queue asks for a
    // website before it takes the row, and it is left alone rather than sharing
    // that outcome anyway: a business measured once is not one to walk back to
    // 'unreachable' over a column this run did not read.
    if (!prospect.website) {
      if (prospect.again) return null
      return {
        id: prospect.id,
        update: { stage: 'unreachable', site_kind: 'none', skip_reason: 'no website to measure' },
      }
    }

    try {
      const { scores, raw } = reading(await measure(prospect.website))
      return {
        id: prospect.id,
        again: prospect.again,
        update: {
          stage: 'audited',
          ...scores,
          // A reading that came back settles the count. Without this a row
          // that failed twice and answered on the third would carry those two
          // refusals into every later cycle and be given a single attempt from
          // then on.
          audit_attempts: 0,
          audit_at: new Date().toISOString(),
          audit_raw: raw,
        },
      }
    } catch (cause) {
      failures.push(`${prospect.website}: ${cause.message}`)
      return { id: prospect.id, again: prospect.again, update: afterFailure(prospect) }
    }
  })

  let dropped = 0
  let refreshed = 0
  for (const outcome of outcomes) {
    if (!outcome) continue
    let write = db.from('outreach_prospects').update(outcome.update).eq('id', outcome.id)
    // The send job reads 'audited' rows, so a row being re-measured is in both
    // queues at once and can be claimed while its report is still running.
    // Holding the write to the stage it was read at leaves the message and the
    // number it quotes saying the same thing.
    if (outcome.again) write = write.eq('stage', 'audited')
    const written = await write.select('id')
    if (written.error) throw new Error(written.error.message)
    if (!written.data.length) continue
    counts.changed += 1
    if (outcome.update.stage === 'unreachable') dropped += 1
    if (outcome.again) refreshed += 1
  }

  return {
    queue: queue.length,
    again: stale.length,
    refreshed,
    failed: failures.length,
    dropped,
    ...(failures.length ? { failures: failures.slice(0, 3) } : {}),
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runJob({ request, response, job: 'audit', work })
}
