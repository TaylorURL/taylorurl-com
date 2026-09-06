/**
 * Drives the notifications endpoint the way a client project's deployment
 * does, and holds it to what a caller is promised.
 *
 * `check-notify.js` beside this one asks whether the pieces are right: the
 * sheet a client's message is drawn on, the ladder that decides who is woken,
 * and the two functions the endpoint is assembled from. It reaches those
 * functions directly, which is the only way to look at them and also the reason
 * it can say nothing about the door. Everything that decides whether an alert
 * arrives lives between the request and the answer - the size ceiling, the
 * window in front of the credential, the credential itself, the burst, the
 * day's ceiling, the claim, the transport, the status code - and none of it is
 * exercised by calling `deliver` with a project already in hand.
 *
 * So this runs the handler. A request goes in as headers and a body, an answer
 * comes out as a status and a payload, and the two things behind it are stood
 * in for at the wire rather than replaced: the database answers as PostgREST
 * does, over the URLs and the `Prefer` and `Content-Range` headers that
 * `@supabase/supabase-js` actually builds, and the provider is a recorder. That
 * matters more than it sounds. A filter written the wrong way round, a claim
 * whose retake never matches, a count read off the wrong header - each of them
 * is a query that a stubbed client would answer politely and a database would
 * not, and each of them is a notification that quietly stops arriving.
 *
 * The eight questions a caller's own integration rests on:
 *
 * A good post reaches somebody. A credential that is missing, wrong, or real
 * but naming another project is refused, in one sentence, without the database
 * being asked. The same key posted twice reaches somebody once. A body past the
 * ceiling is refused before anything is read. The ceilings engage and say how
 * long to wait for. A transport that fails is reported to the caller as a
 * failure and left retryable, rather than being answered 200 and forgotten. A
 * claim that nobody was left to finish is taken back rather than answered
 * `duplicate` for the rest of time. And a post with nobody to reach is a
 * failure the caller is told about on every pass, not once - the key stays
 * retakeable, so seeding the seat it was waiting on is what sends it.
 *
 * Nothing here opens a socket and nothing here sends a message. Every request
 * this file makes goes to one of the two stand-ins, and a request to anywhere
 * else is recorded as a fault and fails the run - which is what makes the
 * absence of a real send a property of the file rather than a promise about it.
 * Every address below is the studio's own mailbox.
 *
 * npm run check:notify-door
 */

/* ── The world the endpoint runs in ─────────────────────────────────────── */

// Read once at load by the modules under test, so they are set before the
// endpoint is imported. Neither key opens anything: the database URL resolves
// to nowhere and every request to it is answered from memory.
const SUPABASE_URL = 'http://notify.test'
process.env.SUPABASE_URL = SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = 'a-service-key-for-the-cases'
process.env.SUPABASE_ANON_KEY = 'an-anon-key-for-the-cases'
process.env.RESEND_API_KEY = 'a-resend-key-for-the-cases'
process.env.CRON_SECRET = 'a-cron-secret-for-the-cases'

const { createHash } = await import('node:crypto')
const { CAPS } = await import('../lib/mail/notify.js')

const REST = `${SUPABASE_URL}/rest/v1/`
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/** The studio's own mailbox. No other address appears in this file. */
const SEAT = 'trenton@taylorurl.com'
const SECOND_SEAT = 'trenton+second@taylorurl.com'
const OTHER_TENANT_SEAT = 'trenton+other@taylorurl.com'

let failures = 0
const check = (ok, said) => {
  if (!ok) {
    failures += 1
    console.error(`  FAIL ${said}`)
  }
}

/* ── The database, as PostgREST answers ─────────────────────────────────── */

const digestOf = value => createHash('sha256').update(value).digest('hex')

/** How a value compares in a column that does not care about case. */
const same = (held, value) =>
  typeof held === 'string' && typeof value === 'string'
    ? held.toLowerCase() === value.toLowerCase()
    : held === value

/**
 * One `column.operator.value` clause, as it arrives in a query string.
 *
 * Only the operators this endpoint actually builds are understood. An operator
 * it starts using and this does not is a fault rather than a row that quietly
 * fails to match, because a filter nobody applied is the shape of bug where one
 * project reads another project's rows.
 */
function matches(row, column, expression) {
  if (expression.startsWith('not.')) return !matches(row, column, expression.slice(4))
  const at = expression.indexOf('.')
  const operator = at === -1 ? expression : expression.slice(0, at)
  const value = at === -1 ? '' : expression.slice(at + 1)

  if (operator === 'eq') return same(String(row[column] ?? ''), value)
  if (operator === 'is') return value === 'null' ? row[column] == null : Boolean(row[column])
  if (operator === 'in') {
    return value
      .replace(/^\(|\)$/g, '')
      .split(',')
      .some(one => same(String(row[column] ?? ''), one.replace(/^"|"$/g, '')))
  }
  if (operator === 'gte') return String(row[column] ?? '') >= value
  if (operator === 'lt') return String(row[column] ?? '') < value
  throw new Error(`the endpoint used an operator these cases do not know: ${operator}`)
}

/** An `or=(clause,clause)` group, which is how a claim is taken back. */
function matchesAny(row, group) {
  return group
    .replace(/^\(|\)$/g, '')
    .split(',')
    .some(clause => {
      const at = clause.indexOf('.')
      return matches(row, clause.slice(0, at), clause.slice(at + 1))
    })
}

/** Whether a row passes every filter on the query string. */
function selects(row, parameters) {
  for (const [key, value] of parameters) {
    if (['select', 'order', 'limit', 'offset', 'columns'].includes(key)) continue
    if (key === 'or') {
      if (!matchesAny(row, value)) return false
      continue
    }
    if (!matches(row, key, value)) return false
  }
  return true
}

/**
 * The tables one case runs against, and what was asked of them.
 *
 * A case builds a world, points the stand-in at it, and reads the rows back
 * afterwards - so what the endpoint wrote is checked against the table rather
 * than against what the answer claimed.
 */
function world({ projects = [], recipients = [], deliveries = [], suppression = [] } = {}) {
  return {
    tables: {
      notify_projects: projects,
      notify_recipients: recipients,
      notify_deliveries: deliveries,
      suppression,
    },
    // The pair the ledger is unique on, which is the whole of the idempotency.
    // A stand-in that accepted the second claim would let a double send pass
    // every case below.
    unique: { notify_deliveries: ['project_id', 'idempotency_key'] },
    asked: [],
    missing: [],
  }
}

let live = world()

/** Everything asked of a host neither stand-in answers for. */
const stray = []

/** The messages the provider was handed, in order. */
let handed = []

/** Which handovers the provider refuses, by the address they are aimed at. */
let refuses = new Set()

function answer(status, payload, headers = {}) {
  return new Response(payload === null ? null : JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

/** How PostgREST states a total, which is where a count is read from. */
const range = total => (total ? `0-${total - 1}/${total}` : `*/0`)

function database(url, request) {
  const table = url.pathname.slice('/rest/v1/'.length).split('/')[0]
  live.asked.push(`${request.method} ${table}`)

  if (live.missing.includes(table)) {
    return answer(404, {
      code: 'PGRST205',
      message: `Could not find the table 'public.${table}' in the schema cache`,
    })
  }

  const rows = live.tables[table] || (live.tables[table] = [])
  const parameters = [...url.searchParams.entries()]
  const wanted = () => rows.filter(row => selects(row, parameters))
  const returning = url.searchParams.has('select')

  if (request.method === 'POST') {
    const posted = JSON.parse(request.body)
    const unique = live.unique[table]
    if (unique && rows.some(row => unique.every(column => same(row[column], posted[column])))) {
      return answer(409, {
        code: '23505',
        message: `duplicate key value violates unique constraint "${table}_key"`,
        details: null,
        hint: null,
      })
    }
    const now = new Date().toISOString()
    const held = {
      id: `${table}-${rows.length + 1}`,
      sent_at: null,
      failed_at: null,
      error: null,
      delivered: 0,
      provider_ids: [],
      claimed_at: now,
      created_at: now,
      ...posted,
    }
    rows.push(held)
    return answer(201, returning ? [held] : null)
  }

  if (request.method === 'PATCH') {
    const patch = JSON.parse(request.body)
    const hit = wanted()
    for (const row of hit) Object.assign(row, patch)
    return answer(200, returning ? hit : null)
  }

  const hit = wanted()
  const counting = String(request.headers.prefer || '').includes('count=exact')
  const headers = counting ? { 'Content-Range': range(hit.length) } : {}
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
  return answer(200, hit, headers)
}

/**
 * Stands in for Resend, keeping what it was handed rather than sending it.
 *
 * A handover aimed at an address in `refuses` comes back the way the provider
 * refuses one, which is what a partial delivery and a run that reached nobody
 * are both built out of.
 */
function provider(request) {
  const body = JSON.parse(request.body)
  handed.push({ body, headers: request.headers })
  if (body.to.some(address => refuses.has(String(address).toLowerCase()))) {
    return new Response('the provider refused it', { status: 422 })
  }
  return answer(200, { id: `provider-${handed.length}` })
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url)
  const headers = {}
  const raw = init.headers ?? (typeof input === 'object' ? input.headers : null)
  if (raw && typeof raw.forEach === 'function') raw.forEach((value, key) => (headers[key] = value))
  else Object.assign(headers, raw || {})
  const request = { method: init.method || 'GET', headers, body: init.body }

  if (url.href.startsWith(REST)) return database(url, request)
  if (url.href === RESEND_ENDPOINT) return provider(request)

  stray.push(url.href)
  throw new Error(`nothing should be asking ${url.href}`)
}

/* ── The tenants ────────────────────────────────────────────────────────── */

const SECRETS = {
  desk: 'a-desk-secret-for-the-cases',
  shop: 'a-shop-secret-for-the-cases',
  burst: 'a-burst-secret-for-the-cases',
  capped: 'a-capped-secret-for-the-cases',
  paused: 'a-paused-secret-for-the-cases',
}

/**
 * A project as its row stands, at whatever ceilings the case needs.
 *
 * The two ceilings are named per project rather than shared, because the
 * endpoint holds one burst window per slug for the life of the process: a case
 * about a ceiling and a case about anything else cannot be the same tenant
 * without one of them spending the other's allowance.
 */
function project(slug, extra = {}) {
  return {
    id: `project-${slug}`,
    slug,
    name: `Example ${slug[0].toUpperCase()}${slug.slice(1)}`,
    secret_sha256: digestOf(SECRETS[slug]),
    from_name: `Example ${slug[0].toUpperCase()}${slug.slice(1)}`,
    from_address: 'notifications@taylorurl.com',
    reply_to: null,
    accent: '#4b45d4',
    mark_url: '/site-icons/example.com.png',
    mark_ground: 'light',
    site_url: 'https://www.example.com',
    link_label: 'Open The Desk',
    footer_line: 'Example Desk',
    burst_limit: 500,
    daily_limit: 500,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

function seat(slug, email, extra = {}) {
  return {
    id: `seat-${slug}-${email}`,
    project_id: `project-${slug}`,
    email,
    name: null,
    min_severity: 'info',
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

const SETUP = {
  subject: 'A+ short setup on US30',
  severity: 'urgent',
  lines: [
    ['Instrument', 'US30'],
    ['Side', 'SELL'],
  ],
  body: 'Bearish order block swept the high and closed back inside.',
  link: { url: 'https://www.example.com/app/signals' },
  idempotency_key: 'signal:9f3c1d20-4a77-4a1e-9a8e-6d2b0c5f1e33',
}

/* ── The door ───────────────────────────────────────────────────────────── */

const handler = (await import('../api/notify.js')).default

/**
 * One request, answered.
 *
 * The body is handed over as the platform hands one over - parsed, with the
 * length it arrived under stated - so the size ceiling is measured against the
 * same figure production measures it against.
 */
async function call({ method = 'POST', secret, slug, body, headers = {}, address = '1.1.1.1' }) {
  const sent = {
    ...(secret === undefined ? {} : { authorization: `Bearer ${secret}` }),
    ...(slug === undefined ? {} : { 'x-notify-project': slug }),
    ...(body === undefined ? {} : { 'content-length': String(Buffer.byteLength(body)) }),
    'x-forwarded-for': address,
    ...headers,
  }

  const answered = { status: 0, body: null, headers: {} }
  const response = {
    setHeader: (name, value) => (answered.headers[String(name).toLowerCase()] = value),
    status(code) {
      answered.status = code
      return response
    },
    json(payload) {
      answered.body = payload
      return response
    },
  }

  // Several of these are refusals the endpoint is right to log, and a passing
  // run should read as a passing run.
  const said = console.error
  console.error = () => {}
  try {
    await handler({ method, headers: sent, body: body === undefined ? '' : body }, response)
  } finally {
    console.error = said
  }
  return answered
}

/** One posted notification, as a caller would put it on the wire. */
const post = (secret, slug, notification, extra = {}) =>
  call({ secret, slug, body: JSON.stringify(notification), ...extra })

/** Points the stand-in at a fresh world and forgets what the provider held. */
function open(built) {
  live = built
  handed = []
  refuses = new Set()
  return live
}

/* ── A good post reaches somebody ───────────────────────────────────────── */

{
  const state = open(
    world({
      projects: [project('desk')],
      recipients: [seat('desk', SEAT), seat('desk', SECOND_SEAT)],
    })
  )

  const answered = await post(SECRETS.desk, 'desk', SETUP)
  check(answered.status === 200, 'an ordinary notification did not answer 200')
  check(answered.body.delivered === 2, 'both seats were not reached')
  check(answered.body.recipients === 2, 'the seats were miscounted')
  check(answered.body.failed === 0, 'a delivery that worked reported a failure')
  check(answered.body.duplicate === false, 'a first send was reported as a duplicate')
  check(answered.body.project === 'desk', 'the answer did not name the project')
  check(answered.body.severity === 'urgent', 'the answer did not carry the severity back')
  check(
    answered.headers['cache-control'] === 'private, no-store',
    "an answer carrying a project's own record was left cacheable"
  )

  check(handed.length === 2, 'the provider was handed the wrong number of messages')
  check(
    handed.every(one => one.body.to.length === 1),
    'seats were handed over in one shared to and can see each other'
  )
  check(
    handed
      .map(one => one.body.to[0])
      .sort()
      .join() === [SEAT, SECOND_SEAT].sort().join(),
    'the message did not reach the seats on the project'
  )
  check(
    handed.every(one => one.body.from === 'Example Desk <notifications@taylorurl.com>'),
    'the message did not leave as the project'
  )
  check(
    handed.every(
      one => one.body.html.includes('#4b45d4') && one.body.html.includes('Example Desk')
    ),
    "the message did not carry the project's own identity"
  )

  const [ledger] = state.tables.notify_deliveries
  check(ledger && ledger.sent_at, 'a sent notification was not stamped sent')
  check(ledger && ledger.delivered === 2, 'the ledger did not record who was reached')
  check(ledger && ledger.provider_ids.length === 2, "the provider's own ids were discarded")
  check(ledger && ledger.error === null, 'a clean delivery recorded a fault')
  check(answered.body.id === ledger.id, 'the answer named an id the ledger does not hold')
}

/* ── A credential that is missing, wrong, or not this project's ─────────── */

{
  const state = open(
    world({
      projects: [project('desk'), project('shop')],
      recipients: [seat('desk', SEAT), seat('shop', OTHER_TENANT_SEAT)],
    })
  )

  const none = await call({ method: 'POST', slug: 'desk', body: JSON.stringify(SETUP) })
  check(none.status === 401, 'a call carrying no credential was not refused')

  const wrong = await post('nothing-like-a-secret', 'desk', SETUP)
  check(wrong.status === 401, 'an unrecognised secret was not refused')

  const unnamed = await post(SECRETS.desk, undefined, SETUP)
  check(unnamed.status === 401, 'a call naming no project was allowed')

  const other = await post(SECRETS.desk, 'shop', SETUP)
  check(other.status === 401, "a project's own secret was allowed to name another project")

  const said = new Set([none.body.error, wrong.body.error, unnamed.body.error, other.body.error])
  check(said.size === 1, 'the refusals are worded differently and say which projects exist')

  check(handed.length === 0, 'a refused call still sent a message')
  check(state.tables.notify_deliveries.length === 0, 'a refused call wrote a ledger row')
  check(
    !state.asked.some(one => one.endsWith('notify_recipients')),
    "a refused call read somebody's recipients"
  )
  check(
    !state.asked.length || state.asked.every(one => one.endsWith('notify_projects')),
    'a refused call reached past the credential check'
  )
}

{
  // The studio's own scheduler is the one caller that may speak for a project
  // it holds no secret for, and the header is what selects one on that path.
  // It is also the only way to post as a second tenant while the first is
  // standing there, which is what makes this the case that would notice a send
  // reading every recipient rather than the project's own.
  const state = open(
    world({
      projects: [project('desk'), project('shop')],
      recipients: [seat('desk', SEAT), seat('shop', OTHER_TENANT_SEAT)],
    })
  )

  const answered = await post(process.env.CRON_SECRET, 'shop', SETUP)
  check(answered.status === 200, 'the studio could not post for a project')
  check(answered.body.project === 'shop', 'the studio posted as the wrong project')
  check(handed.length === 1, "a project's notification reached more seats than it has")
  check(
    handed[0].body.to[0] === OTHER_TENANT_SEAT,
    "one project's notification reached another project's seat"
  )
  check(
    state.tables.notify_deliveries[0].project_id === 'project-shop',
    'the delivery was recorded against the wrong project'
  )
}

/* ── The same key twice reaches somebody once ───────────────────────────── */

{
  const state = open(world({ projects: [project('desk')], recipients: [seat('desk', SEAT)] }))

  const first = await post(SECRETS.desk, 'desk', SETUP)
  const again = await post(SECRETS.desk, 'desk', SETUP)

  check(first.body.delivered === 1, 'the first post of a key reached nobody')
  check(again.status === 200, 'a retry of a sent key did not answer 200')
  check(again.body.duplicate === true, 'a retry of a sent key was not reported as a duplicate')
  check(again.body.delivered === 0, 'a retry of a sent key sent something')
  check(
    again.body.id === first.body.id,
    'a retry was answered with a different id, so the two read as two notifications'
  )
  check(handed.length === 1, 'a retry of a sent key was handed to the provider a second time')
  check(state.tables.notify_deliveries.length === 1, 'a retry of a sent key wrote a second row')

  // A second notification under a key of its own still goes, so the refusal
  // above is the key rather than the project having been silenced by its first.
  const next = await post(SECRETS.desk, 'desk', { ...SETUP, idempotency_key: 'signal:second' })
  check(next.body.delivered === 1, 'a second notification under its own key reached nobody')
  check(handed.length === 2, 'a second notification was not handed over')
}

/* ── A body past the ceiling ────────────────────────────────────────────── */

{
  const state = open(world({ projects: [project('desk')], recipients: [seat('desk', SEAT)] }))

  const stated = await call({
    secret: SECRETS.desk,
    slug: 'desk',
    body: JSON.stringify(SETUP),
    headers: { 'content-length': String(CAPS.request + 1) },
  })
  check(stated.status === 413, 'a body stating a length past the ceiling was not refused')

  // No stated length, so the ceiling has to be measured off what arrived. A
  // caller that omits the header is the case a ceiling read only off the header
  // would let straight through.
  const measured = await call({
    secret: SECRETS.desk,
    slug: 'desk',
    body: JSON.stringify({ ...SETUP, body: 'x'.repeat(CAPS.request) }),
    headers: { 'content-length': undefined },
  })
  check(measured.status === 413, 'a body past the ceiling stating no length was not refused')

  check(state.asked.length === 0, 'a body past the ceiling was read against the database')
  check(handed.length === 0, 'a body past the ceiling still sent a message')
}

/* ── What a caller may post, refused at the door ────────────────────────── */

{
  const state = open(world({ projects: [project('desk')], recipients: [seat('desk', SEAT)] }))

  const refused = {
    'no subject': { ...SETUP, subject: '   ' },
    'neither lines nor body': { subject: 'A setup' },
    'an unknown severity': { ...SETUP, severity: 'loud' },
    'a link that is not https': { ...SETUP, link: { url: 'http://www.example.com' } },
    'a malformed idempotency key': { ...SETUP, idempotency_key: 'not a key' },
  }
  for (const [what, body] of Object.entries(refused)) {
    const answered = await post(SECRETS.desk, 'desk', body)
    check(answered.status === 400, `${what} was accepted`)
    check(Boolean(answered.body.error), `${what} was refused without saying why`)
  }

  const notJson = await call({ secret: SECRETS.desk, slug: 'desk', body: 'not json at all' })
  check(notJson.status === 400, 'a body that is not JSON was not refused')

  check(handed.length === 0, 'a malformed notification still sent a message')
  check(state.tables.notify_deliveries.length === 0, 'a malformed notification wrote a ledger row')
}

/* ── The ceilings ───────────────────────────────────────────────────────── */

{
  // The project's own burst, which is the one a caller doing its job meets.
  const state = open(
    world({ projects: [project('burst', { burst_limit: 3 })], recipients: [seat('burst', SEAT)] })
  )

  for (let at = 0; at < 3; at += 1) {
    const allowed = await post(SECRETS.burst, 'burst', { ...SETUP, idempotency_key: `burst:${at}` })
    check(allowed.status === 200, `a notification inside the burst was refused at ${at}`)
  }
  const refused = await post(SECRETS.burst, 'burst', { ...SETUP, idempotency_key: 'burst:over' })
  check(refused.status === 429, 'the burst ceiling did not hold')
  check(refused.headers['retry-after'] === '600', 'the burst ceiling did not say how long to wait')
  check(handed.length === 3, 'a notification past the burst ceiling was still sent')
  check(state.tables.notify_deliveries.length === 3, 'a refused notification wrote a ledger row')
}

{
  // The day's ceiling, which is counted in the table and holds across every
  // instance rather than only the one that answered.
  const day = new Date().toISOString()
  const state = open(
    world({
      projects: [project('capped', { daily_limit: 2 })],
      recipients: [seat('capped', SEAT)],
      deliveries: [0, 1].map(at => ({
        id: `already-${at}`,
        project_id: 'project-capped',
        idempotency_key: `already:${at}`,
        severity: 'info',
        subject: 'Already sent',
        sent_at: day,
        created_at: day,
        claimed_at: day,
      })),
    })
  )

  const refused = await post(SECRETS.capped, 'capped', SETUP)
  check(refused.status === 429, 'the daily ceiling did not hold')
  check(
    refused.headers['retry-after'] === '86400',
    'the daily ceiling did not say how long to wait'
  )
  check(handed.length === 0, 'a notification past the daily ceiling was still sent')
  check(state.tables.notify_deliveries.length === 2, 'a refused notification wrote a ledger row')
}

{
  // The window in front of the credential. It is what stops an address holding
  // nothing at all from driving a lookup per request, so the case that matters
  // is that it refuses before the database is asked anything.
  const state = open(world({ projects: [project('desk')] }))
  const flood = '203.0.113.7'

  let refused = null
  for (let at = 0; at < 700 && !refused; at += 1) {
    const answered = await call({ method: 'POST', body: '{}', address: flood })
    if (answered.status === 429) refused = answered
    else if (answered.status !== 401) {
      check(false, `an anonymous call answered ${answered.status} rather than 401`)
      break
    }
  }
  check(Boolean(refused), 'an address with no credential was never throttled')
  check(
    refused && refused.headers['retry-after'] === '600',
    'the door did not say how long to wait'
  )
  check(state.asked.length === 0, 'an anonymous flood was read against the database')
}

{
  // The same flood with a new `X-Forwarded-For` on every request. That header
  // is a list the caller writes the front of, so keying the window on it would
  // hand an anonymous caller a fresh allowance per value they invent and the
  // door would never close. The platform's own header is the one it cannot
  // write, and it is what the window counts.
  const state = open(world({ projects: [project('desk')] }))

  let refused = null
  for (let at = 0; at < 700 && !refused; at += 1) {
    const answered = await call({
      method: 'POST',
      body: '{}',
      address: `198.51.100.${at % 256}`,
      headers: { 'x-vercel-forwarded-for': '203.0.113.9' },
    })
    if (answered.status === 429) refused = answered
    else if (answered.status !== 401) {
      check(false, `a rotating anonymous call answered ${answered.status} rather than 401`)
      break
    }
  }
  check(Boolean(refused), 'rotating a forwarded-for header bought an unmetered allowance')
  check(state.asked.length === 0, 'a rotating anonymous flood was read against the database')
}

/* ── A transport that fails is reported as a failure ────────────────────── */

{
  const state = open(world({ projects: [project('desk')], recipients: [seat('desk', SEAT)] }))
  refuses = new Set([SEAT])

  const failed = await post(SECRETS.desk, 'desk', SETUP)
  check(failed.status === 502, 'a run that reached nobody did not answer 502')
  check(Boolean(failed.body.error), 'a failed run said nothing about it')
  check(failed.body.delivered === undefined, 'a failed run reported a delivery')

  const [ledger] = state.tables.notify_deliveries
  check(ledger.failed_at && !ledger.sent_at, 'a failed run did not mark its claim failed')
  check(Boolean(ledger.error), 'a failed run kept no reason')

  // The claim carries the failure rather than being deleted, which is what
  // lets the same key be posted again and picked up.
  refuses = new Set()
  const retried = await post(SECRETS.desk, 'desk', SETUP)
  check(retried.status === 200, 'the same key could not be retried after a failure')
  check(retried.body.delivered === 1, 'a retried notification reached nobody')
  check(state.tables.notify_deliveries.length === 1, 'a retry wrote a second ledger row')
  check(state.tables.notify_deliveries[0].sent_at, 'a retaken claim was not stamped sent')
}

/* ── A notification with nobody to reach ────────────────────────────────── */

{
  // The state every one of these deployments passes through: the credential is
  // set on the client's side before the first seat is seeded, so the earliest
  // notifications arrive with an empty list. It is also the state a project
  // falls back into whenever its last seat is paused or lands on the studio's
  // suppression list.
  //
  // Answering that with a stamped-sent row made the second post of the same key
  // a duplicate, and a duplicate is the one answer a caller may read as
  // delivered - so a notification nobody received was reported honestly once
  // and recorded as told forever after. Reaching nobody is a failure and is
  // stamped as one, which keeps the key retakeable and keeps the answer true.
  const state = open(world({ projects: [project('desk')], recipients: [] }))

  const first = await post(SECRETS.desk, 'desk', SETUP)
  check(first.status === 200, 'a post with nobody to reach did not answer 200')
  check(first.body.delivered === 0, 'a post with nobody to reach claimed a delivery')
  check(Boolean(first.body.reason), 'a post with nobody to reach did not say so')
  check(handed.length === 0, 'a post with nobody to reach still handed something over')

  const [ledger] = state.tables.notify_deliveries
  check(!ledger.sent_at, 'a post reaching nobody was stamped sent')
  check(Boolean(ledger.failed_at && ledger.error), 'a post reaching nobody kept no failure')

  const again = await post(SECRETS.desk, 'desk', SETUP)
  check(again.body.duplicate !== true, 'a second post reaching nobody was answered as delivered')
  check(again.body.delivered === 0, 'a second post reaching nobody claimed a delivery')
  check(Boolean(again.body.reason), 'a second post reaching nobody stopped saying so')
  check(handed.length === 0, 'a second post reaching nobody handed something over')

  // Seeding the seat is what the caller has been waiting for, and the key it
  // has been posting all along is the one that carries the notification.
  state.tables.notify_recipients.push(seat('desk', SEAT))
  const seeded = await post(SECRETS.desk, 'desk', SETUP)
  check(seeded.body.delivered === 1, 'seeding a seat did not let the held key go out')
  check(handed.length === 1, 'seeding a seat did not reach the provider')
  check(
    state.tables.notify_deliveries.length === 1,
    'three posts of one key wrote more than one row'
  )
  check(
    state.tables.notify_deliveries[0].sent_at,
    'the post that reached somebody was not stamped sent'
  )
}

{
  // One address refused must not take the rest of a client's team with it, and
  // the answer has to say the delivery was partial rather than clean.
  const state = open(
    world({
      projects: [project('desk')],
      recipients: [seat('desk', SEAT), seat('desk', SECOND_SEAT)],
    })
  )
  refuses = new Set([SECOND_SEAT])

  const partial = await post(SECRETS.desk, 'desk', SETUP)
  check(partial.status === 200, 'a partial delivery did not answer 200')
  check(partial.body.delivered === 1, 'a partial delivery did not report who was reached')
  check(partial.body.failed === 1, 'a partial delivery did not report the address that was not')
  check(partial.body.recipients === 2, 'a partial delivery miscounted the seats')

  const [ledger] = state.tables.notify_deliveries
  check(ledger.sent_at && !ledger.failed_at, 'a partial delivery was recorded as a failure')
  check(Boolean(ledger.error), 'a partial delivery kept no reason for the half that failed')
}

/* ── A claim nobody was left to finish ──────────────────────────────────── */

{
  // A run that dies between writing its claim and stamping the row leaves one
  // behind that reads exactly like a send in flight. Without a horizon on it,
  // every retry of that key is answered `duplicate` for the rest of time - the
  // caller is told its notification went out and nothing ever left.
  const abandoned = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const state = open(
    world({
      projects: [project('desk')],
      recipients: [seat('desk', SEAT)],
      deliveries: [
        {
          id: 'orphan',
          project_id: 'project-desk',
          idempotency_key: SETUP.idempotency_key,
          severity: 'urgent',
          subject: SETUP.subject,
          recipients: 1,
          delivered: 0,
          provider_ids: [],
          sent_at: null,
          failed_at: null,
          error: null,
          claimed_at: abandoned,
          created_at: abandoned,
        },
      ],
    })
  )

  const retaken = await post(SECRETS.desk, 'desk', SETUP)
  check(retaken.status === 200, 'a claim nobody finished could not be taken back')
  check(retaken.body.duplicate === false, 'a claim nobody finished was answered as a duplicate')
  check(retaken.body.delivered === 1, 'a claim nobody finished reached nobody on the retry')
  check(state.tables.notify_deliveries.length === 1, 'taking a claim back wrote a second row')
  check(state.tables.notify_deliveries[0].sent_at, 'a retaken claim was not stamped sent')
}

{
  // The other side of the horizon: a send that really is in flight is left
  // alone, so two runs racing the same key still reach a recipient once.
  const state = open(
    world({
      projects: [project('desk')],
      recipients: [seat('desk', SEAT)],
      deliveries: [
        {
          id: 'in-flight',
          project_id: 'project-desk',
          idempotency_key: SETUP.idempotency_key,
          severity: 'urgent',
          subject: SETUP.subject,
          recipients: 1,
          sent_at: null,
          failed_at: null,
          claimed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ],
    })
  )

  const held = await post(SECRETS.desk, 'desk', SETUP)
  check(held.body.duplicate === true, 'a send in flight was taken off the run holding it')
  check(handed.length === 0, 'a send in flight was sent a second time alongside it')
  check(state.tables.notify_deliveries.length === 1, 'a send in flight wrote a second row')
}

/* ── A project that is not sending ──────────────────────────────────────── */

{
  const state = open(
    world({ projects: [project('paused', { active: false })], recipients: [seat('paused', SEAT)] })
  )

  const refused = await post(SECRETS.paused, 'paused', SETUP)
  check(refused.status === 403, 'a project that is not sending was allowed to send')
  check(handed.length === 0, 'a project that is not sending still sent a message')
  check(state.tables.notify_deliveries.length === 0, 'a refused project wrote a ledger row')

  // Its own record still answers, because proving a credential is the one call
  // whose whole purpose is to reach nobody.
  const record = await call({ method: 'GET', secret: SECRETS.paused, slug: 'paused' })
  check(record.status === 200, 'a paused project could not read its own record')
  check(record.body.active === false, 'a paused project was told it was sending')
}

/* ── A project's own record ─────────────────────────────────────────────── */

{
  const day = new Date().toISOString()
  open(
    world({
      projects: [project('desk')],
      recipients: [seat('desk', SEAT), seat('desk', SECOND_SEAT, { active: false })],
      deliveries: [
        {
          id: 'earlier',
          project_id: 'project-desk',
          idempotency_key: 'earlier',
          severity: 'info',
          subject: 'Earlier',
          sent_at: day,
          created_at: day,
          claimed_at: day,
        },
      ],
    })
  )

  const record = await call({ method: 'GET', secret: SECRETS.desk, slug: 'desk' })
  check(record.status === 200, 'a project could not read its own record')
  check(record.body.project === 'desk', 'the record did not name the project')
  check(record.body.active === true, 'the record did not say whether the project is sending')
  check(record.body.recipients === 1, 'the record counted a paused seat as a seat')
  check(record.body.sent_24h === 1, "the record did not say what the day's ceiling has counted")
  check(
    record.body.from === 'Example Desk <notifications@taylorurl.com>',
    'the record hid the sender'
  )
  check(handed.length === 0, 'proving a credential sent a message')

  // Counts rather than addresses. These rows hold one client's contact details
  // and the credential that reads them belongs to a machine.
  const said = JSON.stringify(record.body)
  check(!said.includes('@taylorurl.com"'), 'a record handed out an address')
  check(!said.includes(SEAT), "a record handed out a client's own seat")
  check(!said.includes(digestOf(SECRETS.desk)), 'a record handed back the credential digest')

  const other = await call({ method: 'GET', secret: SECRETS.desk, slug: 'shop' })
  check(other.status === 401, "a project read another project's record")
}

/* ── The methods, and a deployment ahead of its migration ───────────────── */

{
  open(world({ projects: [project('desk')] }))

  const wrongMethod = await call({ method: 'DELETE', secret: SECRETS.desk, slug: 'desk' })
  check(wrongMethod.status === 405, 'a method the endpoint does not take was not refused')
  check(wrongMethod.headers.allow === 'GET, POST', 'a 405 did not name the methods it takes')
  check(
    wrongMethod.headers['cache-control'] === 'private, no-store',
    'a refusal was left cacheable'
  )
}

{
  const state = open(world({ projects: [project('desk')], recipients: [seat('desk', SEAT)] }))
  state.missing = ['notify_projects', 'notify_recipients', 'notify_deliveries']

  const answered = await post(SECRETS.desk, 'desk', SETUP)
  check(answered.status === 503, 'a deployment ahead of its migration did not say so')
  check(handed.length === 0, 'a deployment with no tables still sent a message')
}

/* ── Nothing left this file ─────────────────────────────────────────────── */

check(stray.length === 0, `something was asked of ${stray.join(', ')}`)

if (failures) {
  console.error(`notify-door: ${failures} checks failed`)
  process.exit(1)
}

console.log(
  'notify-door: the endpoint answers a good post by reaching every seat on the project one ' +
    'handover at a time, refuses a missing, unknown or borrowed credential in one sentence ' +
    'without reading a recipient, sends a repeated key once, refuses a body past the ceiling ' +
    'before it reads one, holds the burst, the day and the door itself and says how long each ' +
    'waits, reports a transport failure as a failure and leaves the key retryable, reports a ' +
    'partial delivery as partial, keeps a post that reached nobody retakeable so seeding the ' +
    'seat sends it, takes back a claim nobody was left to finish while leaving one in flight ' +
    'alone, and answers a credential check with counts rather than addresses'
)
