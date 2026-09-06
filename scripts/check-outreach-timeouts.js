/**
 * Holds the two outbound calls on the outreach hot path to their bounds.
 *
 * Both reach a stranger's server from inside a job the platform kills at a
 * fixed duration, and a request with nothing to stop it holds that invocation
 * open until the kill takes the rest of the run's queue with it. A signal that
 * was never attached looks exactly like one that was until the day something
 * stalls, so the attachment is asserted rather than assumed, along with the two
 * behaviours that depend on it: a candidate that gives up leaves the search
 * running, and a capture stops asking once the budget it was lent is spent.
 */
import { findSite } from '../lib/outreach/site-search.js'
import { ensureShot } from '../lib/outreach/shot.js'

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: got ${got}, wanted ${want}`)
}

const ok = (condition, what) => {
  if (!condition) throw new Error(what)
}

const PROSPECT = { name: 'Baytown Plumbing', town: 'Baytown', phone: '281-555-0134' }

/** The refusal a signal raises when its time runs out. */
const timedOut = () =>
  Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' })

/** A stand-in for the storage half of a Supabase client, recording what it stored. */
function storage() {
  const stored = []
  return {
    stored,
    db: {
      storage: {
        from: () => ({
          list: async () => ({ data: [] }),
          upload: async (path, bytes) => {
            stored.push({ path, bytes })
            return { error: null }
          },
          getPublicUrl: path => ({ data: { publicUrl: `https://cdn.example/${path}` } }),
        }),
      },
    },
  }
}

/** What the service answers with before it has rendered a URL it has not seen. */
const holding = () => ({
  ok: true,
  headers: { get: () => 'image/gif' },
  arrayBuffer: async () => new Uint8Array([71, 73, 70]).buffer,
})

const capture = () => ({
  ok: true,
  headers: { get: () => 'image/png' },
  arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
})

check('findSite gives every candidate a signal', async () => {
  const inits = []
  await findSite(PROSPECT, async (url, init) => {
    inits.push(init)
    throw new Error('did not answer')
  })
  same(inits.length, 6, 'candidates tried')
  for (const init of inits) {
    ok(init?.signal instanceof AbortSignal, 'a candidate was fetched with no signal')
    same(init.redirect, 'follow', 'redirect handling')
  }
})

check('a candidate that times out does not end the search', async () => {
  let asked = 0
  const site = await findSite(PROSPECT, async url => {
    asked += 1
    if (asked < 6) throw timedOut()
    return { ok: true, url, text: async () => '<p>Baytown Plumbing, 281-555-0134</p>' }
  })
  same(asked, 6, 'candidates tried')
  same(site, 'https://plumbing.org', 'the site found')
})

check('ensureShot gives its request a signal', async () => {
  const { db, stored } = storage()
  const inits = []
  const url = await ensureShot(
    db,
    { id: 'p1', website: 'https://example.com' },
    {
      budgetMs: 100,
      get: async (target, init) => {
        inits.push({ target, init })
        return capture()
      },
    }
  )
  same(inits.length, 1, 'requests made')
  ok(inits[0].init?.signal instanceof AbortSignal, 'the capture was fetched with no signal')
  ok(inits[0].target.endsWith('https://example.com'), 'the URL asked for')
  same(stored.length, 1, 'captures stored')
  same(url, 'https://cdn.example/p1.png', 'the URL returned')
})

check('a spent budget stops ensureShot rather than the platform', async () => {
  const { db } = storage()
  let asked = 0
  const started = Date.now()
  const url = await ensureShot(
    db,
    { id: 'p2', website: 'https://example.com' },
    {
      budgetMs: 100,
      get: async () => {
        asked += 1
        return holding()
      },
    }
  )
  same(asked, 1, 'requests made once the budget is spent')
  same(url, null, 'the answer with no capture')
  ok(Date.now() - started < 1000, 'a spent budget was paid for with a pause')
})

check('a budget with room left retries the holding image', async () => {
  const { db } = storage()
  let asked = 0
  const url = await ensureShot(
    db,
    { id: 'p3', website: 'https://example.com' },
    {
      budgetMs: 6000,
      get: async () => {
        asked += 1
        return holding()
      },
    }
  )
  same(asked, 2, 'requests made inside a budget holding one pause')
  same(url, null, 'the answer with no capture')
})

check('the signal is sized to the budget, not to the service', async () => {
  const { db } = storage()
  const started = Date.now()
  // A request nobody answers, against a budget an order of magnitude under both
  // the per-request bound and the pause between attempts. The signal firing is
  // the only thing that can end this, and it has to fire at the budget rather
  // than at the figure the service is normally given.
  const aborted = await ensureShot(
    db,
    { id: 'p4', website: 'https://example.com' },
    {
      budgetMs: 150,
      get: (target, init) =>
        new Promise((resolve, reject) => {
          const answer = setTimeout(() => resolve(capture()), 5000)
          init.signal.addEventListener('abort', () => {
            clearTimeout(answer)
            reject(timedOut())
          })
        }),
    }
  )
  same(aborted, null, 'the answer when the signal fired')
  ok(Date.now() - started < 2000, 'the signal did not fire at the budget it was given')
})

const failures = []
for (const [name, run] of cases) {
  try {
    await run()
  } catch (cause) {
    failures.push(`${name}: ${cause.message}`)
  }
}

if (failures.length) {
  for (const failure of failures) console.error(failure)
  console.error(`\n${failures.length} of ${cases.length} outreach timeout checks failed`)
  process.exit(1)
}

console.log(`outreach timeouts: ${cases.length} checks passed`)
