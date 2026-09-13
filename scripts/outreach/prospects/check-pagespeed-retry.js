/**
 * Holds a PageSpeed report to the difference between a site that cannot be read
 * and a service that failed to read it.
 *
 * Lighthouse answers 500 saying something went wrong often enough that a single
 * answer is not a reading: the address that failed one report scores normally on
 * the next, seconds later. Every caller here turns a throw into a verdict a
 * stranger reads about their own site, so the retry is asserted rather than
 * assumed, along with the two bounds that keep it from costing more than it is
 * worth: a refusal that would repeat is never paid for twice, and a second
 * report is only ever started inside the time the caller lent.
 */
import {
  PSI_RETRY_FLOOR_MS,
  PSI_RETRY_PAUSE_MS,
  measure,
} from '../../../lib/outreach/audit/pagespeed.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'

const contains = (got, want, what) => {
  if (!String(got).includes(want)) throw new Error(`${what}: ${want} missing from ${got}`)
}

const SITE = 'https://example.com/'

/** Room for a second report, and then some. */
const ROOM = PSI_RETRY_PAUSE_MS + PSI_RETRY_FLOOR_MS + 10_000

/** Less room than a second report needs. */
const NO_ROOM = PSI_RETRY_PAUSE_MS + PSI_RETRY_FLOOR_MS - 1000

/** What the API answers with when Lighthouse fell over on its own side. */
const brokeDown = (body = 'Lighthouse returned error: Something went wrong.') => ({
  ok: false,
  status: 500,
  text: async () => body,
})

/** What it answers with when the request itself is the problem. */
const refused = (status, body) => ({ ok: false, status, text: async () => body })

/** A report that came back. */
const report = () => ({
  ok: true,
  status: 200,
  json: async () => ({ lighthouseResult: { categories: { performance: { score: 0.67 } } } }),
})

/** What a call raised, or null when it did not. */
async function raised(run) {
  try {
    await run()
    return null
  } catch (cause) {
    return cause
  }
}

check('a report Google failed on its own side is taken again', async () => {
  const asked = []
  const answered = await measure(SITE, {
    budgetMs: ROOM,
    timeoutMs: 5000,
    get: async url => {
      asked.push(url.searchParams.get('url'))
      return asked.length === 1 ? brokeDown() : report()
    },
  })
  same(asked.length, 2, 'reports asked for')
  same(asked[1], SITE, 'the address the second report measured')
  same(answered.lighthouseResult.categories.performance.score, 0.67, 'the reading returned')
})

check('a report that answers is not taken twice', async () => {
  let asked = 0
  await measure(SITE, {
    budgetMs: ROOM,
    timeoutMs: 5000,
    get: async () => {
      asked += 1
      return report()
    },
  })
  same(asked, 1, 'reports asked for')
})

check('a refusal that would repeat is raised on the first answer', async () => {
  for (const status of [400, 403, 429]) {
    let asked = 0
    const fault = await raised(() =>
      measure(SITE, {
        budgetMs: ROOM,
        timeoutMs: 5000,
        get: async () => {
          asked += 1
          return refused(status, 'Quota exceeded')
        },
      })
    )
    same(asked, 1, `reports asked for after ${status}`)
    contains(fault?.message, `pagespeed answered ${status}`, 'the fault raised')
    contains(fault?.message, 'Quota exceeded', 'what the API said')
  }
})

check('a budget with no room for a second report raises the first fault', async () => {
  let asked = 0
  const started = Date.now()
  const fault = await raised(() =>
    measure(SITE, {
      budgetMs: NO_ROOM,
      timeoutMs: 5000,
      get: async () => {
        asked += 1
        return brokeDown()
      },
    })
  )
  same(asked, 1, 'reports asked for')
  contains(fault?.message, 'pagespeed answered 500', 'the fault raised')
  ok(Date.now() - started < PSI_RETRY_PAUSE_MS, 'a pause was spent with nothing behind it')
})

check('the key is stripped from a fault before it is raised', async () => {
  const fault = await raised(() =>
    measure(SITE, {
      key: 'AIzaSyNotARealKey',
      budgetMs: NO_ROOM,
      timeoutMs: 5000,
      get: async () => brokeDown('the key AIzaSyNotARealKey is not allowed'),
    })
  )
  contains(fault?.message, '[redacted]', 'the fault raised')
  ok(!fault.message.includes('AIzaSyNotARealKey'), 'the key survived into the fault')
})

check('a report is bounded by what is left of the budget', async () => {
  const started = Date.now()
  // A service that never answers, against a budget an order of magnitude under
  // the bound one report is normally given. The signal ending the request is the
  // only thing that can end this, and it has to fire at the budget rather than
  // at the figure a report is normally allowed.
  const fault = await raised(() =>
    measure(SITE, {
      budgetMs: 200,
      timeoutMs: 30_000,
      get: (url, init) =>
        new Promise((resolve, reject) => {
          const answer = setTimeout(() => resolve(report()), 20_000)
          init.signal.addEventListener('abort', () => {
            clearTimeout(answer)
            reject(Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }))
          })
        }),
    })
  )
  ok(fault !== null, 'the request was never stopped')
  ok(Date.now() - started < 5000, 'the signal did not fire at the budget it was given')
})

await finish()

console.log(`pagespeed retry: ${cases.length} checks passed`)
