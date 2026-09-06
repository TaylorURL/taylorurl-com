/**
 * Reads the post queue on a schedule and refuses to report a quiet success.
 *
 * `api/social-queue.js` keeps the queue moving and says how it went. This one
 * does nothing at all to the queue and only says what state it is in, which is
 * why they are separate: a promotion with nothing to promote and a queue that
 * has stopped publishing both end in a 200 from that endpoint, and the second
 * one is the day the Page went silent.
 *
 * The status code carries the verdict, because a cron invocation is read by its
 * status long before anybody opens its body. 200 is a queue that is publishing.
 * 503 is a queue that is not, or is days from not being — the thing this watches
 * is unavailable, whatever this function did. 429 is Buffer refusing the read,
 * which is neither. 500 is this endpoint itself failing, which is the only one
 * of the four that is about the code here.
 *
 * Vercel signs a cron invocation with CRON_SECRET, which is the only caller this
 * accepts. The Buffer key is BUFFER_API_KEY, as it is for the queue endpoint: a
 * function has no vault to read one from.
 */
import { ownsSchedules } from '../lib/site/current.js'
import { servedHereOr404 } from '../lib/http/guard.js'
import { isScheduler } from '../lib/http/scheduler.js'
import { connect } from '../lib/social/buffer.js'
import { FINDING, SEVERITY, watch } from '../lib/social/watch.js'

const BUFFER_API_KEY = process.env.BUFFER_API_KEY || ''

/**
 * How long the platform gives this run, and what of it may go on waiting.
 *
 * Three requests and no writes, so the work itself is seconds. The budget is a
 * third of the duration because a run killed part way through a pause reports
 * nothing at all, and a watch that reports nothing is the state it exists to
 * make impossible.
 */
export const config = { maxDuration: 60 }
const RETRY_BUDGET_MS = 20_000

/** How many findings of each kind, so a reader can count without parsing. */
function tally(findings) {
  const counts = Object.fromEntries(Object.values(FINDING).map(kind => [kind, 0]))
  for (const item of findings) counts[item.kind] = (counts[item.kind] ?? 0) + 1
  return counts
}

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

  try {
    const run = connect(BUFFER_API_KEY, { budgetMs: RETRY_BUDGET_MS })
    const answer = await watch(run)

    const body = {
      ok: answer.read && !answer.needsAttention,
      // False whenever Buffer would not answer. Nothing else in the body is a
      // verdict on the queue while this is false.
      read: answer.read,
      at: answer.at,
      findings: answer.findings,
      kinds: tally(answer.findings),
      channels: answer.channels,
      absent: answer.absent,
      needsAttention: answer.needsAttention,
    }

    if (!answer.read) {
      const throttle = answer.findings.find(item => item.kind === FINDING.throttled)
      if (throttle?.retryAfterMs) {
        response.setHeader('Retry-After', String(Math.ceil(throttle.retryAfterMs / 1000)))
      }
      response.status(429).json(body)
      return
    }

    // A standing finding is a state somebody already decided about, so it is
    // carried in the body and does not change the code. Anything else does:
    // this endpoint exists so that a queue which has stopped cannot answer with
    // the same status as one that is publishing.
    response.status(answer.needsAttention ? 503 : 200).json(body)
  } catch (cause) {
    // Never a throttle. `watch` answers one as a finding and rethrows
    // everything else, so what arrives here is the watch itself failing - a key
    // that is wrong, a query Buffer refused on its content, a network that is
    // not there. Reported as its own kind, because sending somebody to wait out
    // a rate limit that is not happening is how a broken watch stays broken.
    console.error('social watch: %s', cause.message)
    response.status(500).json({
      ok: false,
      read: false,
      error: cause.message,
      code: cause.code ?? null,
      findings: [
        {
          kind: FINDING.fault,
          severity: SEVERITY.unknown,
          service: null,
          detail: `the queue could not be read: ${cause.message}`,
        },
      ],
      needsAttention: true,
    })
  }
}
