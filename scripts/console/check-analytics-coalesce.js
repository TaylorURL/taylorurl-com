/**
 * Proves the analytics proxy answers the same poll once.
 *
 * Every console page carries the frame's three traffic feeds, and the overview
 * question costs the database seconds to answer. So the polls that arrive on
 * top of each other - a second tab, a retry landing beside a success, a feed
 * mounted twice - have to become one read of the collector rather than one
 * each, and the hold that does it has to be per session or one account's
 * figures would reach another.
 *
 *   node scripts/console/check-analytics-coalesce.js
 */
import { coalesced } from '../../lib/http/coalesce.js'
import { cases, check, finish, ok, same } from '../harness/checks.js'

/** A clock the cases move by hand. */
function clock(at = 0) {
  const held = { at }
  return { now: () => held.at, tick: by => (held.at += by) }
}

/** A read that counts its calls and lands when it is told to. */
function counted(answer = 'figures') {
  const calls = []
  const read = (...args) => {
    const pending = {}
    pending.promise = new Promise((resolve, reject) => {
      pending.land = () => resolve(typeof answer === 'function' ? answer(...args) : answer)
      pending.refuse = cause => reject(cause)
    })
    calls.push({ args, ...pending })
    return pending.promise
  }
  return { read, calls }
}

check('polls arriving together are one read of the collector', async () => {
  const { read, calls } = counted()
  const time = clock()
  const ask = coalesced(3000, read, time)

  const first = ask('session-a\noverview')
  const second = ask('session-a\noverview')
  const third = ask('session-a\noverview')
  same(calls.length, 1, 'reads of the collector for three simultaneous polls')

  calls[0].land()
  same(await first, 'figures', 'what the first poll was handed')
  same(await second, 'figures', 'what the second poll was handed')
  same(await third, 'figures', 'what the third poll was handed')
})

check('a landed answer is reused inside the hold and read again after it', async () => {
  const { read, calls } = counted()
  const time = clock()
  const ask = coalesced(3000, read, time)

  const first = ask('session-a\noverview')
  calls[0].land()
  await first

  time.tick(2999)
  await ask('session-a\noverview')
  same(calls.length, 1, 'reads after a poll inside the hold')

  time.tick(2)
  const after = ask('session-a\noverview')
  same(calls.length, 2, 'reads after a poll past the hold')
  calls[1].land()
  await after
})

check('the hold is shorter than the fastest poll the frame makes', async () => {
  const source = await import('node:fs').then(fs =>
    fs.readFileSync(new URL('../../api/analytics.js', import.meta.url), 'utf8')
  )
  const held = Number(/const HELD_MS = (\d+)/.exec(source)?.[1])
  const frame = await import('node:fs').then(fs =>
    fs.readFileSync(
      new URL('../../src/app/views/console/ConsoleFrame.jsx', import.meta.url),
      'utf8'
    )
  )
  const polls = [...frame.matchAll(/const \w+_POLL_MS = ([\d_]+)/g)].map(found =>
    Number(found[1].replaceAll('_', ''))
  )
  ok(polls.length >= 3, 'the frame still declares its three poll intervals')
  ok(Number.isInteger(held) && held > 0, 'the proxy still names how long it holds an answer')
  ok(
    held < Math.min(...polls),
    `a hold of ${held}ms would outlast the ${Math.min(...polls)}ms poll it serves`
  )
})

check(
  'the live view is never handed an answer from before the signal that asked for it',
  async () => {
    const source = await import('node:fs').then(fs =>
      fs.readFileSync(new URL('../../api/analytics.js', import.meta.url), 'utf8')
    )
    same(Number(/const LIVE_HELD_MS = (\d+)/.exec(source)?.[1]), 0, 'the live hold')
    ok(
      /view === 'live' \? liveCollector : collector/.test(source),
      'the live view is not read through its own zero hold'
    )
  }
)

check('two sessions asking the same question are two reads', async () => {
  const { read, calls } = counted()
  const time = clock()
  const ask = coalesced(3000, read, time)

  const mine = ask('session-a\noverview', 'a')
  const theirs = ask('session-b\noverview', 'b')
  same(calls.length, 2, 'reads of the collector for two sessions')
  same(calls[0].args[0], 'a', 'what the first session asked with')
  same(calls[1].args[0], 'b', 'what the second session asked with')
  calls[0].land()
  calls[1].land()
  await Promise.all([mine, theirs])
})

check('a different view is a different question', async () => {
  const { read, calls } = counted()
  const time = clock()
  const ask = coalesced(3000, read, time)

  const overview = ask('session-a\noverview')
  const live = ask('session-a\nlive')
  same(calls.length, 2, 'reads of the collector for two views')
  calls[0].land()
  calls[1].land()
  await Promise.all([overview, live])
})

check('a failure is let go of rather than held', async () => {
  const { read, calls } = counted()
  const time = clock()
  const ask = coalesced(3000, read, time)

  const first = ask('session-a\noverview')
  calls[0].refuse(new Error('the collector did not answer'))
  await first.then(
    () => ok(false, 'a refused read should reach its caller as a refusal'),
    cause => same(cause.message, 'the collector did not answer', 'what the caller was told')
  )

  const again = ask('session-a\noverview')
  same(calls.length, 2, 'reads after a failure inside the hold')
  calls[1].land()
  same(await again, 'figures', 'what the next poll was handed')
})

check('a refusal is shared by whoever was waiting on it', async () => {
  const { read, calls } = counted()
  const time = clock()
  const ask = coalesced(3000, read, time)

  const first = ask('session-a\noverview')
  const second = ask('session-a\noverview')
  same(calls.length, 1, 'reads of the collector for two simultaneous polls')
  calls[0].refuse(new Error('no answer'))
  const faults = await Promise.allSettled([first, second])
  same(faults[0].status, 'rejected', 'what the first poll got')
  same(faults[1].status, 'rejected', 'what the second poll got')
})

check('nothing is kept for a session that has stopped asking', async () => {
  const { read, calls } = counted()
  const time = clock()
  const ask = coalesced(3000, read, time)

  for (let n = 0; n < 50; n += 1) {
    const one = ask(`session-${n}\noverview`)
    calls[n].land()
    await one
    time.tick(4000)
  }
  // The sweep runs on the way in, so the entry for the session now asking is
  // the only one that can still be held.
  const last = ask('session-50\noverview')
  calls[50].land()
  await last
  same(calls.length, 51, 'reads made across fifty-one separate sessions')
})

check('a hold of zero still shares the reads in flight together', async () => {
  const { read, calls } = counted()
  const time = clock()
  const ask = coalesced(0, read, time)

  const first = ask('session-a\noverview')
  const second = ask('session-a\noverview')
  same(calls.length, 1, 'reads of the collector for two simultaneous polls')
  calls[0].land()
  await Promise.all([first, second])

  const after = ask('session-a\noverview')
  same(calls.length, 2, 'reads once the first had landed')
  calls[1].land()
  await after
})

await finish()

console.log(`analytics coalesce: all ${cases.length} cases pass`)
