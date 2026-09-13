/**
 * Holds the map sweep to the whole of what a text search says, rather than the
 * top of it.
 *
 * Google orders a search by prominence, which is very nearly an ordering by how
 * good a website a business already has, so the twenty at the top are the
 * twenty this pipeline has the least use for. A sweep that read one page filed
 * those and nothing else, and every job behind it can only work on what the
 * sweep filed. The walk that fixes it is three requests where there was one, so
 * what is asserted here is both halves of that trade: that the pages are
 * actually read, and that the pairs a run takes came down to pay for them.
 *
 * The failure this exists for is the silent one. `nextPageToken` is named in
 * the field mask, and the mask governs the whole answer rather than the places
 * in it, so a mask that forgets the token is an endpoint that sends none, a
 * walk that stops on the first page, and a change that looks shipped and does
 * nothing. The stand-in below answers by the mask it is handed for exactly that
 * reason: drop the token from the mask and the paging cases here go red rather
 * than the sweep going quiet.
 *
 * Nothing here opens a socket or reaches a database. The endpoint is a script
 * of pages that enforces the API's own rule about what a token is valid
 * against, and the client is a plan of answers that records what was written.
 */

import { cases, check, finish, ok, raised, same } from '../../harness/checks.js'

process.env.GOOGLE_PLACES_API_KEY = 'a-places-key'

const { work } = await import('../../../api/outreach/source.js')

// ── The endpoint ─────────────────────────────────────────────────────────

/** A place as the search answers with it, named after the page it sits on. */
const place = (id, town = 'Baytown') => ({
  id,
  displayName: { text: id },
  formattedAddress: `1 Example Street, ${town}, TX 77520`,
  userRatingCount: 4,
})

/** A page of results, at addresses in the town the grid starts on. */
const page = (...ids) => ({ places: ids.map(id => place(id)) })

/** A page of results at addresses somewhere other than the town searched for. */
const pageIn = (town, ...ids) => ({ places: ids.map(id => place(id, town)) })

/** A page the endpoint refuses to serve. */
const refuses = (status, said) => ({ status, said })

/**
 * A Places endpoint that answers from a script of pages, one query at a time.
 *
 * Two of its rules are the ones the walk is written against and are enforced
 * rather than assumed. A token is only offered when the field mask asks for
 * one, because that is how the real endpoint behaves and how a mask that
 * forgot it would show up. And a token is only honoured against a request
 * otherwise identical to the one that produced it - same text, same page size
 * - because the real endpoint answers 400 rather than answering a different
 * search, which is the whole reason the body is built the way it is.
 */
function endpoint(script) {
  const sent = []
  const tokens = new Map()
  let issued = 0

  const get = async (url, init) => {
    const body = JSON.parse(init.body)
    const mask = init.headers['X-Goog-FieldMask'] ?? ''
    sent.push({ url, mask, ...body })

    let at = 0
    if (body.pageToken) {
      const held = tokens.get(body.pageToken)
      if (!held || held.query !== body.textQuery || held.size !== body.pageSize) {
        return { ok: false, status: 400, text: async () => 'INVALID_ARGUMENT: page token' }
      }
      at = held.at
    }

    const pages = script(body.textQuery)
    const answer = pages[at]
    if (!answer)
      return { ok: false, status: 400, text: async () => 'INVALID_ARGUMENT: past the end' }
    if (answer.status) {
      return { ok: false, status: answer.status, text: async () => answer.said ?? 'refused' }
    }

    const out = { places: answer.places }
    if (at + 1 < pages.length && mask.includes('nextPageToken')) {
      issued += 1
      const token = `token-${issued}`
      tokens.set(token, { query: body.textQuery, size: body.pageSize, at: at + 1 })
      out.nextPageToken = token
    }
    return { ok: true, json: async () => out }
  }

  return { get, sent }
}

/** The same three pages whatever is searched for. */
const everywhere = pages => () => pages

// ── The database stand-in ────────────────────────────────────────────────

/** A refusal shaped the way PostgREST reports a column that is not there. */
const NO_COLUMN = {
  data: null,
  error: { code: '42703', message: 'column "rating_count_first" does not exist' },
}

/**
 * A client that answers the four calls a sweep makes and records the writes.
 *
 * Rows upserted are held, so a second pair searching the same place id reads it
 * back as already on file - which is what the write-once first count depends
 * on and what a repeat across two pages would otherwise break.
 */
function stubDb({ onFile = [], firsts = true } = {}) {
  const held = new Set(onFile)
  const upserts = []
  const cursors = []

  const prospects = () => {
    const state = { op: 'select', column: null, ids: [], rows: [] }
    const chain = {
      select(column) {
        state.column = column
        return chain
      },
      limit() {
        return chain
      },
      in(column, ids) {
        state.ids = ids
        return chain
      },
      upsert(rows) {
        state.op = 'upsert'
        state.rows = rows
        return chain
      },
      then(resolve) {
        if (state.op === 'upsert') {
          upserts.push(state.rows)
          for (const row of state.rows) held.add(row.place_id)
          return resolve({ error: null })
        }
        if (state.column === 'rating_count_first') {
          return resolve(firsts ? { data: [], error: null } : NO_COLUMN)
        }
        return resolve({
          data: state.ids.filter(id => held.has(id)).map(id => ({ place_id: id })),
          error: null,
        })
      },
    }
    return chain
  }

  const settings = () => {
    const state = { patch: null }
    const chain = {
      update(patch) {
        state.patch = patch
        return chain
      },
      eq() {
        return chain
      },
      then(resolve) {
        cursors.push(state.patch.source_cursor)
        return resolve({ error: null })
      },
    }
    return chain
  }

  const from = table => (table === 'outreach_settings' ? settings() : prospects())
  return { db: { from }, upserts, cursors }
}

/** A grid wide enough that a run never reaches the end of it. */
const SETTINGS = {
  sourcing_enabled: true,
  towns: ['Baytown', 'Highlands', 'Mont Belvieu', 'Dayton', 'Crosby', 'La Porte', 'Deer Park'],
  trades: ['plumber', 'roofer', 'electrician', 'landscaper'],
  source_cursor: 0,
}

/**
 * A clock that reads the same until it is asked once too often.
 *
 * The searches here answer the instant they are called, so a sweep against a
 * script has no wall clock to run out of and every case below sees the whole
 * slice. This is how the one case that is about the clock gets a slow morning:
 * the run's first read is when it began, and the reads after `after` of them
 * are a run that has been going long enough to stop taking pairs.
 */
const slowAfter = after => {
  let read = 0
  return () => (read++ < after ? 0 : 10 * 60 * 1000)
}

/** One sweep, against a scripted endpoint and a stand-in client. */
async function sweep(script, { settings = SETTINGS, clock, ...plan } = {}) {
  const { get, sent } = endpoint(script)
  const { db, upserts, cursors } = stubDb(plan)
  const counts = { examined: 0, changed: 0 }
  const held = globalThis.fetch
  globalThis.fetch = get
  try {
    const detail = await work({ db, settings, counts, ...(clock ? { clock } : {}) })
    return { detail, sent, upserts, cursors, counts }
  } finally {
    globalThis.fetch = held
  }
}

/** Every row that reached the table in a sweep. */
const filed = upserts => upserts.flat()

// ── The walk ─────────────────────────────────────────────────────────────

check('the field mask asks for the token, without which there are no pages', async () => {
  const { sent } = await sweep(everywhere([page('a1'), page('b1')]))

  for (const request of sent) {
    ok(
      request.mask.includes('nextPageToken'),
      `a search asked for places alone, so Google would send no token: ${request.mask}`
    )
  }
})

check('a search is read to the end of what the endpoint serves', async () => {
  const { sent, counts, upserts } = await sweep(
    everywhere([page('a1', 'a2'), page('b1', 'b2'), page('c1', 'c2')])
  )

  const first = sent.filter(request => request.textQuery === 'plumber in Baytown TX')
  same(first.length, 3, 'requests made for the first pair')
  same(counts.examined, 6 * 6, 'businesses examined across the run')
  const ids = filed(upserts).map(row => row.place_id)
  for (const id of ['a1', 'b1', 'c1']) {
    ok(ids.includes(id), `${id} was searched for and never filed`)
  }
})

check('a fourth page is never asked for, because there is no fourth page', async () => {
  // The script here would hand out a token forever. The walk stops at three
  // whatever the endpoint offers, which is the shape of the answer rather than
  // a budget: a text search says sixty results and no more.
  const forever = () => [page('a1'), page('b1'), page('c1'), page('d1'), page('e1')]
  const { sent, upserts } = await sweep(forever)

  const first = sent.filter(request => request.textQuery === 'plumber in Baytown TX')
  same(first.length, 3, 'requests made for the first pair')
  ok(
    !filed(upserts).some(row => row.place_id === 'd1'),
    'a fourth page was read, which the endpoint does not serve'
  )
})

check('a page with nothing behind it is the last request made', async () => {
  const { sent } = await sweep(everywhere([page('a1')]))

  const first = sent.filter(request => request.textQuery === 'plumber in Baytown TX')
  same(first.length, 1, 'requests made for a pair the endpoint answered in one page')
  same(first[0].pageToken, undefined, 'a token was sent on the first request')
})

check('a paged request is the same search with a token added', async () => {
  const { sent } = await sweep(everywhere([page('a1'), page('b1'), page('c1')]))

  const first = sent.filter(request => request.textQuery === 'plumber in Baytown TX')
  same(first.length, 3, 'requests made for the first pair')
  // The stand-in refuses a token whose request differs anywhere else, the way
  // the endpoint does, so a drifting text or page size shows up as a 400 and a
  // pair that stopped at one page rather than as a quietly different search.
  for (const request of first) {
    same(request.textQuery, 'plumber in Baytown TX', 'the text a paged request carried')
    same(request.pageSize, 20, 'the page size a paged request carried')
  }
  same(first[1].pageToken, 'token-1', 'the token the second request carried')
  same(first[2].pageToken, 'token-2', 'the token the third request carried')
})

check('a listing that comes back on two pages is filed once', async () => {
  // Ranks shift between requests, so the same business can appear on page one
  // and again on page two. Filed twice it would be both the row the table says
  // is new and the row it says is already there.
  const script = query =>
    query === 'plumber in Baytown TX' ? [page('a1', 'a2'), page('a2', 'b1')] : [page()]
  const { upserts, counts } = await sweep(script)

  const ids = filed(upserts).map(row => row.place_id)
  same(ids.length, new Set(ids).size, `a place was filed twice: ${ids.join(', ')}`)
  same(counts.examined, 3, 'businesses examined across the run')
})

// ── A page that fails ────────────────────────────────────────────────────

check('a pair whose first page fails is the failure it always was', async () => {
  const script = query =>
    query === 'plumber in Baytown TX'
      ? [refuses(429, 'RESOURCE_EXHAUSTED')]
      : [pageIn('Highlands', 'a1'), pageIn('Highlands', 'b1')]
  const { detail, upserts } = await sweep(script)

  same(detail.failed, 1, 'pairs recorded as failed')
  same(detail.searched, 5, 'pairs recorded as searched')
  ok(detail.failures[0].includes('plumber in Baytown'), `the failure named: ${detail.failures[0]}`)
  ok(
    !filed(upserts).some(row => row.town === 'Baytown'),
    'a pair whose search went nowhere filed rows anyway'
  )
})

check('a pair whose second page fails files the page it has', async () => {
  const script = query =>
    query === 'plumber in Baytown TX'
      ? [page('a1', 'a2'), refuses(503, 'UNAVAILABLE'), page('c1')]
      : [page('x1')]
  const { detail, upserts } = await sweep(script)

  // The query itself answered, so the pair is not a failure and the twenty it
  // did return are worth more than the nothing a stricter reading would file.
  same(detail.failed, 0, 'pairs recorded as failed')
  const ids = filed(upserts).map(row => row.place_id)
  for (const id of ['a1', 'a2']) ok(ids.includes(id), `${id} was answered and not filed`)
  ok(!ids.includes('c1'), 'the walk carried on past a page the endpoint refused')
})

check('a run where every search failed is a failed run', async () => {
  const fault = await raised(() => sweep(everywhere([refuses(403, 'PERMISSION_DENIED')])))

  ok(fault, 'a run whose every pair went nowhere reported itself as a sweep')
  ok(fault.message.includes('places answered 403'), `the fault raised: ${fault.message}`)
})

check('what the API said is carried without the key it was asked with', async () => {
  const script = () => [refuses(400, 'key a-places-key is not authorised')]
  const fault = await raised(() => sweep(script))

  ok(!fault.message.includes('a-places-key'), `the fault carried the key: ${fault.message}`)
  ok(fault.message.includes('[redacted]'), `the fault raised: ${fault.message}`)
})

// ── What the pages cost the slice ────────────────────────────────────────

check('a run takes six pairs, which is what pays for their pages', async () => {
  const { detail, cursors } = await sweep(everywhere([page('a1'), page('b1'), page('c1')]))

  // Six pairs at three pages is eighteen searches, which is where the pairs a
  // run takes and the pages a search reads meet. Twelve pairs at three pages
  // is a run that outlives its minute.
  same(detail.searched, 6, 'pairs searched in a run')
  same(cursors[0], 6, 'where the next run picks the grid up')
})

check('the pairs a run takes and the pages it reads are eighteen searches', async () => {
  const { sent } = await sweep(everywhere([page('a1'), page('b1'), page('c1')]))

  same(sent.length, 18, 'searches made in one run')
})

check('the cursor is where a run stops rather than where it started', async () => {
  const { detail, cursors } = await sweep(everywhere([page('a1')]), {
    settings: { ...SETTINGS, source_cursor: 26 },
  })

  same(detail.pairs, 28, 'pairs in the grid')
  same(detail.offset, 26, 'where the run picked the grid up')
  same(cursors[0], 4, 'where the next run picks it up, wrapped past the end')
})

check('a run that runs out of window still moves the cursor over what it swept', async () => {
  // The stall the walk would otherwise settle into. advance() is the last
  // thing a run does, so a run killed at its ceiling files rows and moves the
  // cursor nowhere, and the next run takes the same slice, meets the same slow
  // pairs and dies in the same place - forever, on a cron every two hours.
  const { detail, cursors } = await sweep(everywhere([page('a1')]), { clock: slowAfter(1) })

  same(detail.searched, 1, 'pairs searched before the run gave up taking more')
  same(detail.left, 5, 'pairs handed back to the next run')
  same(cursors[0], 1, 'the cursor moved over the pairs the run actually swept')
})

check('a pair is filed under the town its address names, not the one searched for', async () => {
  // Google does not bound a text search to the town in it, and reading all
  // three pages is what brings the far ones in: the shops behind the first
  // twenty are in the towns either side. The town is read back to the reader
  // in the letter, so a shop in west Houston filed under Baytown is told a
  // studio built a site near it in a town it does not trade in.
  const script = query =>
    query === 'plumber in Baytown TX' ? [page('near'), pageIn('Houston', 'far')] : [page()]
  const { upserts } = await sweep(script)

  const rows = filed(upserts)
  same(rows.find(row => row.place_id === 'near')?.town, 'Baytown', 'a shop in the town searched')
  same(rows.find(row => row.place_id === 'far')?.town, 'Houston', 'a shop two towns over')
})

check('a listing whose address names no town keeps the town that was searched', async () => {
  // The search's own claim is the best there is where the address gives
  // nothing, and 'Texas City' is a town rather than a state, which is why the
  // state is read anchored at both ends.
  const script = query =>
    query === 'plumber in Baytown TX'
      ? [{ places: [{ id: 'bare', displayName: { text: 'bare' } }, place('here', 'Texas City')] }]
      : [page()]
  const { upserts } = await sweep(script)

  const rows = filed(upserts)
  same(rows.find(row => row.place_id === 'bare')?.town, 'Baytown', 'a listing with no address')
  same(
    rows.find(row => row.place_id === 'here')?.town,
    'Texas City',
    'a town named after the state'
  )
})

check('a run that failed everywhere leaves the cursor where it was', async () => {
  const { cursors } = await sweep(everywhere([refuses(500, 'INTERNAL')])).catch(() => ({
    cursors: [],
  }))

  same(cursors.length, 0, 'cursor writes made by a run that searched nothing')
})

// ── The count a business was filed at ────────────────────────────────────

check('a business first seen on the third page is stamped like any other', async () => {
  const { upserts } = await sweep(everywhere([page('a1'), page('b1'), page('c1')]))

  // This is the point of the walk from the other end: the businesses ranked
  // behind the first twenty are the ones this pipeline wants, and they are
  // filed with the reading they were filed at like anybody else.
  const stamped = filed(upserts).filter(row => 'rating_count_first' in row)
  const ids = stamped.map(row => row.place_id)
  ok(ids.includes('c1'), `a third-page business was filed without its first count: ${ids}`)
  same(
    stamped.find(row => row.place_id === 'c1').rating_count_first,
    4,
    'the count it was filed at'
  )
})

check('a business already on file is not stamped a second time', async () => {
  const { upserts } = await sweep(everywhere([page('a1'), page('b1')]), { onFile: ['b1'] })

  const again = filed(upserts).filter(row => row.place_id === 'b1')
  for (const row of again) {
    ok(!('rating_count_first' in row), 'a business already on file had its first count rewritten')
  }
})

check('a database without the first-count column is still swept', async () => {
  const { detail, upserts } = await sweep(everywhere([page('a1'), page('b1')]), { firsts: false })

  same(detail.searched, 6, 'pairs searched')
  for (const row of filed(upserts)) {
    ok(!('rating_count_first' in row), 'a column that is not there was written to')
  }
})

// ── Run them ────────────────────────────────────────────────────────────

await finish()

console.log(`outreach source pages: ${cases.length} checks passed`)
