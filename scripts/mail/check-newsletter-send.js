/**
 * Holds a newsletter issue to the four things that decide whether it may go
 * out at all: a way off the list, a writer who said it was finished, a
 * recipient who asked for it, and copy for every side of the list the run is
 * about to reach. And to the one thing no issue carries: a postal address.
 *
 * Every one of them fails silently if it is wrong. A recipient whose row
 * carries no `unsub_token` produces a message with no link in the footer and no
 * RFC 8058 headers on it. A draft sent by a stray press of a button reads as a
 * finished issue to everyone who receives it. A recipient selected on standing
 * rather than on consent is a business that was written to once and never asked
 * for anything. And an issue whose copy is all written for one side posts the
 * other a masthead, a title and a footer with nothing between them.
 *
 * So what is asserted is that each is a refusal rather than an omission: the
 * unsubscribe link is refused in front of the transport, and a recipient
 * refused there has to leave the recorder untouched. A draft and an issue
 * already sent are both refused before the first claim is written. And the
 * audience is selected on the human act behind a row rather than on the status
 * on it, since the cold outreach sender writes a status and a consent stamp for
 * every business it mails.
 *
 * Which side sees which block is asserted across both parts of a message rather
 * than one. A block carrying no marker reaches everybody, a marked one reaches
 * its side alone, and the laid-out half and the plain half of one copy hold the
 * same blocks: a filter in one renderer and not the other is a message
 * contradicting itself, and a case that reads only the HTML never sees it. An
 * issue with nothing to say to a side the run holds recipients for stops the
 * whole run, since the half that went out cannot be recalled.
 *
 * The postal address is asserted the other way round. Both parts of a message
 * are read for the mail box the studio used to sign off with, a run is driven
 * with no address configured anywhere and has to send anyway, and the renderers
 * are called with a `senderAddress` a stale caller might still pass to prove it
 * reaches neither part. A sender that started refusing again, or a footer that
 * started printing an address again, fails here.
 *
 * The scheduled door is held to the same standard from the other end. It is the
 * only caller of the run that no person watches, so what it refuses and what it
 * selects are the whole of whether an issue with a date on it goes out on that
 * date or goes out to the wrong list a month later. The secret is asserted as a
 * refusal, the narrowing is asserted against the partial index it was written
 * for, and a run the endpoint turned away is asserted to reach the answer rather
 * than a quiet 200 nobody reads.
 *
 * No message is sent and no database is reached. The provider is a recorder,
 * the database is a stand-in that answers the calls the send makes, and the one
 * case that reaches neither proves it by handing them a fetch that raises.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  ASKED_SOURCES,
  CLIENT,
  PROSPECT,
  RECIPIENT_COLUMNS,
  audienceOf,
  selectRecipients,
} from '../../lib/mail/audience.js'
import { DRAFT, READY, SENT, blocksFor, hasContentFor, sendRefusal } from '../../lib/mail/issues.js'
import { renderIssueEmail, renderIssueHtml, renderIssueText } from '../../lib/mail/emailTemplate.js'
import { cases, check, finish, ok, same } from '../harness/checks.js'

// Placeholders for the credentials the endpoints read at load. Neither of the
// first two opens anything: the provider is a recorder in every case that
// reaches one, and the database is never built.
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'service-role-key-for-the-cases'
process.env.RESEND_API_KEY ||= 'resend-key-for-the-cases'

// The scheduler's secret, set outright rather than defaulted. It is the whole
// of the scheduled door, so a case proving what that door refuses has to know
// the secret it is refusing against; inheriting a real one from the shell would
// leave those cases asserting nothing on the machine that has it set.
const CRON_SECRET = 'a-cron-secret'
process.env.CRON_SECRET = CRON_SECRET

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

/** The environment variable no sender reads. The cases hold the name to prove it. */
const POSTAL_ADDRESS_VAR = 'OUTREACH_POSTAL_ADDRESS'

/**
 * The mail box no message states. It is here so the cases can look for it, and
 * the fragments beside it are what a footer built from a differently formatted
 * copy of the same box would print.
 */
const ADDRESS = 'TaylorURL LLC, 3120 Southwest Fwy Ste 101, PMB #841258, Houston, TX 77098-4520'
const ADDRESS_FRAGMENTS = ['3120 Southwest Fwy', 'PMB #841258', 'Houston, TX', '77098']

const ISSUE = {
  id: 'issue-1',
  slug: 'first-light',
  title: 'First light',
  preheader: 'What went out this month.',
  body: [{ type: 'paragraph', text: 'A line of copy.' }],
}
const SUBSCRIBER = {
  id: 'sub-1',
  email: 'reader@example.com',
  unsub_token: '11111111-2222-4333-8444-555555555555',
}

/** Runs `act` and returns the message it raised, or null when it did not. */
const raised = async act => {
  try {
    await act()
    return null
  } catch (cause) {
    return cause.message
  }
}

let instance = 0

/**
 * The send endpoint, loaded fresh. A distinct specifier is what makes two cases
 * two modules rather than one held between them.
 */
async function loadSender() {
  instance += 1
  return import(`../../api/newsletter-send.js?case=${instance}`)
}

/** A provider that keeps what it was handed and answers with an id. */
function recorder(answer = { id: 're_recorded' }) {
  const sent = []
  return {
    sent,
    fetch: async (url, options) => {
      sent.push({ url, message: JSON.parse(options.body) })
      return new Response(JSON.stringify(answer), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  }
}

/**
 * Runs `act` with the endpoint's own logging held back, so a case that exercises
 * a refusal does not print one alongside the run's result.
 */
const quietly = async act => {
  const held = console.error
  console.error = () => {}
  try {
    return await act()
  } finally {
    console.error = held
  }
}

/** Swaps the global fetch for the length of one case and puts it back after. */
async function withFetch(stub, run) {
  const held = globalThis.fetch
  globalThis.fetch = stub
  try {
    return await run()
  } finally {
    globalThis.fetch = held
  }
}

/**
 * A database answering the calls one delivery makes, keeping every write.
 * What a send row holds afterwards is the whole record of what happened to a
 * recipient, so the patch is what these cases read.
 */
function sends() {
  const writes = []
  const filtered = call => {
    const link = {
      eq(column, value) {
        call.filters[column] = value
        return link
      },
      then(resolve) {
        return Promise.resolve({ data: [], error: null }).then(resolve)
      },
    }
    return link
  }
  return {
    writes,
    db: {
      from(table) {
        return {
          insert(row) {
            writes.push({ table, kind: 'insert', row })
            return { then: resolve => Promise.resolve({ error: null }).then(resolve) }
          },
          update(patch) {
            const call = { table, kind: 'update', patch, filters: {} }
            writes.push(call)
            return filtered(call)
          },
        }
      },
    },
  }
}

/**
 * A stand-in for the project, answering every call one whole run makes and
 * keeping every write.
 *
 * A run reads four tables and writes two, so a case asserting that nothing was
 * claimed needs all six answered rather than the one table `sends` covers.
 * Only the writes are kept: a read is how the run finds its work, and a case
 * counting reads would fail the day a query gained a column.
 */
function project({ issue = null, subscribers = [], suppression = [], sendRows = [] } = {}) {
  const writes = []
  const held = {
    newsletter_issues: () => (issue ? [issue] : []),
    subscribers: () => subscribers,
    suppression: () => suppression,
    newsletter_sends: () => sendRows,
  }

  // A query that takes every narrowing the run applies and answers with the
  // rows either way. What the narrowing actually selects on is asserted
  // against the audience module, where it is one call rather than a chain.
  const query = rows => {
    const answer = { data: rows, error: null, count: rows.length }
    const chain = {
      select: () => chain,
      eq: () => chain,
      not: () => chain,
      or: () => chain,
      is: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      single: async () => ({ data: rows[0] ?? null, error: null }),
      range: async (from, to) => ({ data: rows.slice(from, to + 1), error: null }),
      then: (resolve, reject) => Promise.resolve(answer).then(resolve, reject),
    }
    return chain
  }

  return {
    writes,
    db: {
      from(table) {
        return {
          select: () => query(held[table]?.() ?? []),
          insert(row) {
            writes.push({ table, kind: 'insert', row })
            return query([])
          },
          update(patch) {
            writes.push({ table, kind: 'update', patch })
            return query([])
          },
        }
      },
    },
  }
}

/**
 * A response an endpoint can answer into, and the answer it keeps: the status,
 * the body, and each header under the name the endpoint set it by.
 */
function answering() {
  const answer = { status: 0, body: null, headers: {} }
  const response = {
    setHeader(name, value) {
      answer.headers[name] = value
      return response
    },
    status(code) {
      answer.status = code
      return response
    },
    json(payload) {
      answer.body = payload
      return response
    },
  }
  return { answer, response }
}

/** A request and a response the endpoint can answer into. */
function exchange(body = { slug: ISSUE.slug }) {
  return {
    ...answering(),
    request: { method: 'POST', headers: { authorization: 'Bearer a-session-token' }, body },
  }
}

const patchFor = writes => writes.find(write => write.kind === 'update')?.patch

/** Every fragment of the mail box, held out of one part of one message. */
function statesNoAddress(part, where) {
  const said = String(part)
  ok(!said.includes(ADDRESS), `the whole address is absent from ${where}`)
  for (const fragment of ADDRESS_FRAGMENTS) {
    ok(!said.includes(fragment), `"${fragment}" is absent from ${where}`)
  }
}

check('the laid-out footer states no address', () => {
  statesNoAddress(renderIssueHtml({ issue: ISSUE, unsubscribe: null }), 'the laid-out part')
})

check('the plaintext footer states none either', () => {
  statesNoAddress(renderIssueText({ issue: ISSUE, unsubscribe: null }), 'the plaintext part')
})

check('the footer still names the studio', () => {
  ok(
    renderIssueHtml({ issue: ISSUE, unsubscribe: null }).includes('TaylorURL LLC'),
    'the laid-out footer names the sender'
  )
  ok(
    renderIssueText({ issue: ISSUE, unsubscribe: null }).includes('TaylorURL LLC'),
    'the plaintext footer names the sender'
  )
})

check('the laid-out part renders when no address is passed', () => {
  ok(renderIssueHtml({ issue: ISSUE, unsubscribe: null }).length > 0, 'the HTML was built')
})

check('the plaintext part renders when no address is passed', () => {
  ok(renderIssueText({ issue: ISSUE, unsubscribe: null }).length > 0, 'the text was built')
})

check('an address a stale caller still passes reaches neither part', () => {
  statesNoAddress(
    renderIssueHtml({ issue: ISSUE, unsubscribe: null, senderAddress: ADDRESS }),
    'the laid-out part'
  )
  statesNoAddress(
    renderIssueText({ issue: ISSUE, unsubscribe: null, senderAddress: ADDRESS }),
    'the plaintext part'
  )
})

check('a subscriber copy is composed without one and links out of the list', () => {
  const { html, text, unsubscribeUrl } = renderIssueEmail({
    issue: ISSUE,
    subscriber: SUBSCRIBER,
    unsubscribeEndpoint: 'https://www.taylorurl.com/unsubscribe',
  })
  same(
    unsubscribeUrl,
    `https://www.taylorurl.com/unsubscribe?token=${SUBSCRIBER.unsub_token}`,
    'the link carries the token'
  )
  statesNoAddress(html, 'the laid-out part')
  statesNoAddress(text, 'the plaintext part')
  ok(html.includes(`href="${unsubscribeUrl}"`), 'the footer link is clickable')
  ok(text.includes(`Unsubscribe: ${unsubscribeUrl}`), 'the plaintext part carries the same link')
})

check('a delivery goes out with no address configured', async () => {
  delete process.env[POSTAL_ADDRESS_VAR]
  const sender = await loadSender()
  const provider = recorder()
  const store = sends()
  const outcome = await withFetch(provider.fetch, () => sender.deliver(store.db, ISSUE, SUBSCRIBER))
  same(outcome, 'sent', 'outcome')
  same(provider.sent.length, 1, 'messages handed over')
  statesNoAddress(provider.sent[0].message.html, 'the laid-out part')
  statesNoAddress(provider.sent[0].message.text, 'the plaintext part')
  same(patchFor(store.writes)?.provider_id, 're_recorded', "the provider's id was kept")
})

check('a delivery ignores the variable a deployment has not cleared yet', async () => {
  process.env[POSTAL_ADDRESS_VAR] = ADDRESS
  const sender = await loadSender()
  const provider = recorder()
  const store = sends()
  delete process.env[POSTAL_ADDRESS_VAR]
  const outcome = await withFetch(provider.fetch, () => sender.deliver(store.db, ISSUE, SUBSCRIBER))
  same(outcome, 'sent', 'outcome')
  statesNoAddress(provider.sent[0].message.html, 'the laid-out part')
  statesNoAddress(provider.sent[0].message.text, 'the plaintext part')
})

check('the endpoint answers a request with no address configured', async () => {
  delete process.env[POSTAL_ADDRESS_VAR]
  const sender = await loadSender()
  const { request, response, answer } = exchange()
  const reached = []
  await quietly(() =>
    withFetch(
      async url => {
        reached.push(String(url))
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
      },
      () => sender.default(request, response)
    )
  )
  ok(reached.length > 0, 'the run got as far as the network')
  ok(answer.status !== 503, `the status the endpoint gave: ${answer.status}`)
  ok(
    !String(answer.body?.error ?? '').includes('postal'),
    `the reason the endpoint gave: ${answer.body?.error}`
  )
})

check('no sender reads the variable or refuses over it', () => {
  for (const file of [
    'api/newsletter-send.js',
    'api/outreach/send.js',
    'lib/outreach/message.js',
  ]) {
    const source = readFileSync(join(ROOT, file), 'utf8')
    ok(!source.includes(POSTAL_ADDRESS_VAR), `${file} does not read the variable`)
    ok(!/postal/i.test(source), `${file} says nothing about a postal address`)
  }
})

check('both RFC 8058 headers go out with a message', async () => {
  const sender = await loadSender()
  const provider = recorder()
  const link = `https://example.supabase.co/functions/v1/unsubscribe?token=${SUBSCRIBER.unsub_token}`
  await withFetch(provider.fetch, () =>
    sender.sendOne({
      to: SUBSCRIBER.email,
      subject: ISSUE.title,
      html: '<p>x</p>',
      text: 'x',
      unsubscribe: link,
      tag: ISSUE.slug,
    })
  )
  same(provider.sent.length, 1, 'messages handed over')
  const headers = provider.sent[0].message.headers
  same(headers['List-Unsubscribe'], `<${link}>`, 'List-Unsubscribe')
  same(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click', 'List-Unsubscribe-Post')
})

check('a message with no unsubscribe link never reaches the provider', async () => {
  const sender = await loadSender()
  const provider = recorder()
  const message = await withFetch(provider.fetch, () =>
    raised(() =>
      sender.sendOne({
        to: SUBSCRIBER.email,
        subject: ISSUE.title,
        html: '<p>x</p>',
        text: 'x',
        unsubscribe: null,
        tag: ISSUE.slug,
      })
    )
  )
  ok(message?.includes('unsubscribe'), `the refusal says why: ${message}`)
  same(provider.sent.length, 0, 'messages handed over')
})

check('a subscriber with no token is recorded rather than mailed', async () => {
  const sender = await loadSender()
  const provider = recorder()
  const store = sends()
  const outcome = await quietly(() =>
    withFetch(provider.fetch, () =>
      sender.deliver(store.db, ISSUE, { ...SUBSCRIBER, unsub_token: null })
    )
  )
  same(outcome, 'failed', 'outcome')
  same(provider.sent.length, 0, 'messages handed over')
  const patch = patchFor(store.writes)
  ok(patch?.failed_at, 'the claim carries the failure')
  ok(String(patch?.error).includes('unsubscribe'), `the reason is kept: ${patch?.error}`)
})

// ── Who an issue may reach ───────────────────────────────────────────────

/**
 * A query that answers nothing and keeps every narrowing made to it, so what
 * the audience selects on can be read without a database.
 */
function probe() {
  const applied = { table: null, columns: null, eq: {}, not: [], or: [] }
  const chain = {
    from(table) {
      applied.table = table
      return chain
    },
    select(columns) {
      applied.columns = columns
      return chain
    },
    eq(column, value) {
      applied.eq[column] = value
      return chain
    },
    not(column, operator, value) {
      applied.not.push([column, operator, value])
      return chain
    },
    or(filter) {
      applied.or.push(filter)
      return chain
    },
  }
  return { applied, db: chain }
}

check('the audience is read off the mailing list', () => {
  const { applied, db } = probe()
  selectRecipients(db)
  same(applied.table, 'subscribers', 'table')
  same(applied.columns, RECIPIENT_COLUMNS, 'columns')
})

check('the audience narrows on standing, on consent, and on a human act', () => {
  const { applied, db } = probe()
  selectRecipients(db)
  same(applied.eq.status, 'subscribed', 'standing')
  same(applied.not.length, 1, 'columns required to carry something')
  same(applied.not[0][0], 'consent_at', 'the column a stamp has to be on')
  same(applied.not[0][1], 'is', 'the test made against it')
  same(applied.not[0][2], null, 'what it must not be')
  same(applied.or.length, 1, 'groups of alternatives')
  ok(applied.or[0].includes('confirmed_at.not.is.null'), `a confirmation counts: ${applied.or[0]}`)
  for (const source of ASKED_SOURCES) {
    ok(applied.or[0].includes(source), `${source} counts: ${applied.or[0]}`)
  }
  for (const source of ['outreach', 'import', 'legacy']) {
    ok(!applied.or[0].includes(source), `${source} does not count on its own: ${applied.or[0]}`)
  }
})

// ── Whether an issue may go out at all ───────────────────────────────────

check('a draft is refused, and the refusal says what to do about it', () => {
  const refusal = sendRefusal({ status: DRAFT, slug: 'first-light' })
  same(refusal?.status, 409, 'status')
  ok(/ready/i.test(refusal.error), `the refusal names the fix: ${refusal.error}`)
})

check('an issue already sent is refused as a different thing entirely', () => {
  const refusal = sendRefusal({ status: SENT, slug: 'first-light' })
  same(refusal?.status, 409, 'status')
  ok(/already/i.test(refusal.error), `the refusal says it has gone: ${refusal.error}`)
})

check('an issue marked ready opens the run', () => {
  same(sendRefusal({ status: READY, slug: 'first-light' }), null, 'refusal')
})

check('a run against a draft claims nobody', async () => {
  const sender = await loadSender()
  const provider = recorder()
  const store = project({ issue: { ...ISSUE, status: DRAFT }, subscribers: [SUBSCRIBER] })
  const answer = await withFetch(provider.fetch, () => sender.run(store.db, { issueId: ISSUE.id }))
  same(answer.status, 409, 'status')
  same(provider.sent.length, 0, 'messages handed over')
  same(store.writes.length, 0, 'rows written')
})

check('a run against an issue already sent claims nobody either', async () => {
  const sender = await loadSender()
  const provider = recorder()
  const store = project({ issue: { ...ISSUE, status: SENT }, subscribers: [SUBSCRIBER] })
  const answer = await withFetch(provider.fetch, () => sender.run(store.db, { issueId: ISSUE.id }))
  same(answer.status, 409, 'status')
  ok(/already/i.test(answer.body?.error), `the reason is kept: ${answer.body?.error}`)
  same(store.writes.length, 0, 'rows written')
})

check('a ready issue reaches the list and closes itself', async () => {
  const sender = await loadSender()
  const provider = recorder()
  const store = project({ issue: { ...ISSUE, status: READY }, subscribers: [SUBSCRIBER] })
  const answer = await withFetch(provider.fetch, () => sender.run(store.db, { issueId: ISSUE.id }))
  same(answer.status, 200, 'status')
  same(answer.body?.sent, 1, 'messages sent')
  same(answer.body?.status, SENT, 'the status the issue now holds')
  same(provider.sent[0]?.message.to[0], SUBSCRIBER.email, 'who it went to')
  const closing = store.writes.find(
    write => write.table === 'newsletter_issues' && write.kind === 'update'
  )
  same(closing?.patch.status, SENT, 'the issue was closed')
})

check('a recipient already sent this issue is left alone on a second run', async () => {
  const sender = await loadSender()
  const provider = recorder()
  const store = project({
    issue: { ...ISSUE, status: READY },
    subscribers: [SUBSCRIBER],
    sendRows: [{ subscriber_id: SUBSCRIBER.id, sent_at: '2026-09-01T13:00:00Z', failed_at: null }],
  })
  const answer = await withFetch(provider.fetch, () => sender.run(store.db, { issueId: ISSUE.id }))
  same(answer.status, 200, 'status')
  same(answer.body?.recipients, 0, 'recipients still owed a copy')
  same(provider.sent.length, 0, 'messages handed over')
})

check('a suppressed address is skipped however it reads on the list', async () => {
  const sender = await loadSender()
  const provider = recorder()
  const store = project({
    issue: { ...ISSUE, status: READY },
    subscribers: [SUBSCRIBER],
    suppression: [{ email: SUBSCRIBER.email.toUpperCase() }],
  })
  const answer = await withFetch(provider.fetch, () => sender.run(store.db, { issueId: ISSUE.id }))
  same(answer.body?.recipients, 0, 'recipients')
  same(provider.sent.length, 0, 'messages handed over')
})

// ── What each side of the list is shown ──────────────────────────────────

/** A reader on each side, shaped as one comes off the mailing list. */
const CLIENT_READER = {
  id: 'sub-client',
  email: 'client@example.com',
  unsub_token: '22222222-3333-4444-8555-666666666666',
  source: 'client',
}
const PROSPECT_READER = {
  id: 'sub-prospect',
  email: 'prospect@example.com',
  unsub_token: '33333333-4444-4555-8666-777777777777',
  source: 'signup',
}

/**
 * A body carrying a block for everybody, a block for each side, and a rule.
 *
 * Every block says a phrase no other block says, so what a rendered part holds
 * can be read back off it by looking for those phrases. A case that matched a
 * whole document instead would pass on two parts that agree about the phrases
 * and disagree about which blocks carry them.
 */
const MIXED = [
  { type: 'paragraph', text: 'the shared opening' },
  { type: 'heading', text: 'the client heading', level: 2, audience: CLIENT },
  { type: 'paragraph', text: 'the prospect line', audience: PROSPECT },
  { type: 'list', items: ['the client item'], audience: CLIENT },
  {
    type: 'button',
    text: 'the prospect button',
    href: 'https://www.taylorurl.com/work',
    audience: PROSPECT,
  },
  { type: 'divider' },
  { type: 'paragraph', text: 'the shared closing' },
]

/** An issue whose every content block is written for clients. */
const CLIENT_ONLY = [
  { type: 'divider' },
  { type: 'paragraph', text: 'the client only line', audience: CLIENT },
]

/** The phrase one block puts into a rendered part, or null where it draws none. */
const phraseOf = block => (block.type === 'list' ? block.items[0] : block.text) || null

const PHRASES = MIXED.map(phraseOf).filter(Boolean)

/**
 * The phrases one rendered part carries, in the body's own order.
 *
 * Read case-insensitively because the plaintext renderer sets a heading in
 * capitals, which is a difference in how a block is drawn rather than in
 * whether it is there.
 */
const phrasesIn = part => {
  const said = String(part).toLowerCase()
  return PHRASES.filter(phrase => said.includes(phrase))
}

/** Both parts of one side's copy of a body. */
const partsFor = (body, audience) => {
  const issue = { ...ISSUE, body }
  return {
    html: renderIssueHtml({ issue, unsubscribe: null, audience }).toLowerCase(),
    text: renderIssueText({ issue, unsubscribe: null, audience }).toLowerCase(),
  }
}

check('a block carrying no marker reaches both sides in both parts', () => {
  for (const side of [CLIENT, PROSPECT]) {
    const { html, text } = partsFor(MIXED, side)
    for (const phrase of ['the shared opening', 'the shared closing']) {
      ok(html.includes(phrase), `the laid-out ${side} copy carries "${phrase}"`)
      ok(text.includes(phrase), `the plaintext ${side} copy carries "${phrase}"`)
    }
  }
})

check('a marked block reaches its own side and no other, in both parts', () => {
  const client = partsFor(MIXED, CLIENT)
  const prospect = partsFor(MIXED, PROSPECT)
  const held = [
    [client, prospect, ['the client heading', 'the client item'], CLIENT],
    [prospect, client, ['the prospect line', 'the prospect button'], PROSPECT],
  ]
  for (const [own, other, phrases, side] of held) {
    for (const phrase of phrases) {
      ok(own.html.includes(phrase), `the laid-out ${side} copy carries "${phrase}"`)
      ok(own.text.includes(phrase), `the plaintext ${side} copy carries "${phrase}"`)
      ok(!other.html.includes(phrase), `the other laid-out copy withholds "${phrase}"`)
      ok(!other.text.includes(phrase), `the other plaintext copy withholds "${phrase}"`)
    }
  }
})

check('both parts of one copy carry the same blocks', () => {
  for (const side of [CLIENT, PROSPECT]) {
    const { html, text } = partsFor(MIXED, side)
    const laidOut = phrasesIn(html).join(' | ')
    const plain = phrasesIn(text).join(' | ')
    // The two parts against each other first, which is the fault a filter
    // applied in one renderer and not the other leaves. Then both against the
    // one function that decides it, so two parts that agree by ignoring the
    // marker are a failure rather than a pass.
    same(plain, laidOut, `both parts of the ${side} copy`)
    same(
      laidOut,
      blocksFor(MIXED, side).map(phraseOf).filter(Boolean).join(' | '),
      `the blocks the ${side} side is shown`
    )
  }
})

check('the side a reader is on is read off the source their row carries', () => {
  same(audienceOf({ source: 'client' }), CLIENT, 'a client off the roster')
  same(audienceOf({ source: 'console' }), CLIENT, 'added by hand')
  same(audienceOf({ source: 'outreach' }), PROSPECT, 'a row the cold sender left behind')
  // A confirmation says somebody wants to hear from the studio. It does not say
  // the studio runs anything of theirs, and client copy offers to change a site
  // that is already live.
  same(
    audienceOf({ source: 'signup', confirmed_at: '2026-08-29T00:00:00Z' }),
    PROSPECT,
    'somebody who confirmed for themselves'
  )
})

check('a side is owed something said rather than a rule', () => {
  ok(hasContentFor(MIXED, CLIENT), 'a mixed body speaks to the client side')
  ok(hasContentFor(CLIENT_ONLY, CLIENT), 'a client-only body speaks to the side it is written for')
  ok(!hasContentFor(CLIENT_ONLY, PROSPECT), 'and leaves the other side a rule and nothing else')
  ok(!hasContentFor([{ type: 'divider' }, { type: 'divider' }]), 'a body of rules says nothing')
})

check('an issue with nothing to say to one side it reaches sends nobody anything', async () => {
  const sender = await loadSender()
  const provider = recorder()
  const store = project({
    issue: { ...ISSUE, status: READY, body: CLIENT_ONLY },
    subscribers: [CLIENT_READER, PROSPECT_READER],
  })
  const answer = await withFetch(provider.fetch, () => sender.run(store.db, { issueId: ISSUE.id }))
  same(answer.status, 409, 'status')
  ok(
    /prospect/i.test(answer.body?.error),
    `the refusal names the empty side: ${answer.body?.error}`
  )
  same(provider.sent.length, 0, 'messages handed over')
  same(
    store.writes.filter(write => write.table === 'newsletter_sends').length,
    0,
    'recipients claimed'
  )
  same(store.writes.length, 0, 'rows written')
})

check('the same issue goes out on a night only its own side is owed a copy', async () => {
  const sender = await loadSender()
  const provider = recorder()
  const store = project({
    issue: { ...ISSUE, status: READY, body: CLIENT_ONLY },
    subscribers: [CLIENT_READER],
  })
  const answer = await withFetch(provider.fetch, () => sender.run(store.db, { issueId: ISSUE.id }))
  same(answer.status, 200, 'status')
  same(answer.body?.sent, 1, 'messages sent')
  same(provider.sent[0]?.message.to[0], CLIENT_READER.email, 'who it went to')
  const message = provider.sent[0]?.message
  ok(message?.html.includes('the client only line'), 'the laid-out part carries the client block')
  ok(message?.text.includes('the client only line'), 'the plaintext part carries it too')
})

check('an issue nothing is marked in draws exactly as it drew before', () => {
  const plain = [
    { type: 'heading', text: 'A heading', level: 2 },
    { type: 'paragraph', text: 'A line of copy.' },
    { type: 'divider' },
    { type: 'button', text: 'Read it', href: 'https://www.taylorurl.com/work' },
  ]
  const whole = partsFor(plain, null)
  for (const side of [CLIENT, PROSPECT]) {
    const drawn = partsFor(plain, side)
    same(drawn.html, whole.html, `the laid-out ${side} copy`)
    same(drawn.text, whole.text, `the plaintext ${side} copy`)
  }
})

check('a marker naming no side is drawn for nobody', () => {
  const body = [{ type: 'paragraph', text: 'the orphaned line', audience: 'partners' }]
  for (const side of [CLIENT, PROSPECT]) {
    const { html, text } = partsFor(body, side)
    ok(!html.includes('the orphaned line'), `the laid-out ${side} copy withholds it`)
    ok(!text.includes('the orphaned line'), `the plaintext ${side} copy withholds it`)
  }
})

check('a subscriber copy is composed for the side that row is on', () => {
  const compose = subscriber =>
    renderIssueEmail({
      issue: { ...ISSUE, body: MIXED },
      subscriber,
      unsubscribeEndpoint: 'https://www.taylorurl.com/unsubscribe',
    })
  const client = compose(CLIENT_READER)
  const prospect = compose(PROSPECT_READER)
  same(client.audience, CLIENT, 'the side read off a client row')
  same(prospect.audience, PROSPECT, 'the side read off an outreach row')
  ok(client.html.includes('the client heading'), 'the client copy carries the client block')
  ok(!prospect.html.includes('the client heading'), 'the prospect copy withholds it')
  ok(!client.text.includes('the prospect line'), 'and the client copy withholds the prospect block')
})

// ── The schedule that sends an issue on its date ─────────────────────────

/** The scheduled door, loaded fresh, so no two cases share one module. */
async function loadDue() {
  instance += 1
  return import(`../../api/newsletter-due.js?case=${instance}`)
}

/** An invocation as Vercel makes one, and the response it answers into. */
function firing({ method = 'GET', authorization = `Bearer ${CRON_SECRET}` } = {}) {
  return { ...answering(), request: { method, headers: { authorization } } }
}

/**
 * The project as PostgREST answers it, keeping every request either way.
 *
 * The scheduled door builds its own client out of the endpoint's credentials,
 * so there is no database object to hand it. The transport is the seam instead:
 * every read and write leaves as one request, and answering them by URL is what
 * lets a case say which issues were due and what became of them.
 */
function postgrest({ due = [], issue = null } = {}) {
  const requests = []
  const rows = payload =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  return {
    requests,
    fetch: async (url, options = {}) => {
      const target = String(url)
      const method = options.method || 'GET'
      requests.push({
        url: target,
        method,
        patch: options.body ? JSON.parse(options.body) : null,
      })
      if (method !== 'GET') return rows([])
      if (!target.includes('/newsletter_issues')) return rows([])
      // The run reads the one issue it was named by id; the schedule reads
      // whatever is due. Nothing else asks this table for anything.
      return rows(target.includes('id=eq.') ? (issue ? [issue] : []) : due)
    },
  }
}

/** Runs the scheduled door against a stand-in project and keeps both sides. */
async function fire(project, options) {
  const due = await loadDue()
  const wire = postgrest(project)
  const { request, response, answer } = firing(options)
  await quietly(() => withFetch(wire.fetch, () => due.default(request, response)))
  return { answer, requests: wire.requests }
}

const DUE_ISSUE = {
  ...ISSUE,
  status: READY,
  scheduled_for: '2026-09-01T13:00:00Z',
  published_at: null,
}

check('an invocation carrying no secret reaches nothing', async () => {
  const { answer, requests } = await fire({}, { authorization: '' })
  same(answer.status, 401, 'status')
  same(requests.length, 0, 'requests the run made')
})

check('an invocation carrying the wrong secret reaches nothing either', async () => {
  const { answer, requests } = await fire({}, { authorization: 'Bearer not-the-secret' })
  same(answer.status, 401, 'status')
  same(requests.length, 0, 'requests the run made')
})

check('a method the scheduler never uses is refused', async () => {
  const { answer, requests } = await fire({}, { method: 'DELETE' })
  same(answer.status, 405, 'status')
  same(answer.headers.Allow, 'GET, POST', 'what the endpoint allows')
  same(requests.length, 0, 'requests the run made')
})

check('the schedule reads exactly what the partial index covers', async () => {
  // Every narrowing here is half of `newsletter_issues_due_idx`'s predicate.
  // The null test is redundant against the comparison beside it and is what the
  // planner reaches for the index on, so dropping it turns a monthly lookup
  // into a scan of every issue ever written.
  const { answer, requests } = await fire({})
  const read = requests.find(sent => sent.url.includes('/newsletter_issues'))?.url
  ok(read, 'the run read the issues')
  ok(read.includes(`status=eq.${READY}`), `narrowed on the ready status: ${read}`)
  ok(read.includes('scheduled_for=not.is.null'), `narrowed on carrying a date: ${read}`)
  ok(read.includes('scheduled_for=lte.'), `narrowed on the date having passed: ${read}`)
  ok(read.includes('order=scheduled_for.asc'), `oldest first: ${read}`)
  same(answer.status, 200, 'status')
  same(answer.body.due, 0, 'issues due')
})

check('an issue whose date has passed is run to the end', async () => {
  const { answer, requests } = await fire({ due: [DUE_ISSUE], issue: DUE_ISSUE })
  same(answer.status, 200, 'status')
  same(answer.body.due, 1, 'issues due')
  same(answer.body.ran.length, 1, 'issues run')
  same(answer.body.ran[0].issue, DUE_ISSUE.slug, 'the issue that was run')
  same(answer.body.ran[0].status, SENT, 'where the issue was left')
  const closed = requests.find(sent => sent.method === 'PATCH')
  same(closed?.patch?.status, SENT, 'the write that closes the issue')
})

check('an issue the run turns away is reported rather than swallowed', async () => {
  // A draft cannot reach the due read, but it can reach the run: the two are
  // separate queries and the second is the one that decides. A refusal answered
  // as a quiet 200 is a month of silence before anybody looks.
  const { answer, requests } = await fire({
    due: [DUE_ISSUE],
    issue: { ...DUE_ISSUE, status: DRAFT },
  })
  same(answer.status, 200, 'status')
  same(answer.body.ran.length, 0, 'issues run')
  same(answer.body.refused.length, 1, 'issues turned away')
  same(answer.body.refused[0].issue, DUE_ISSUE.slug, 'the issue turned away')
  ok(
    /ready/i.test(answer.body.refused[0].error),
    `the reason is kept: ${answer.body.refused[0].error}`
  )
  same(answer.body.needsAttention, true, 'whether a person is told')
  same(
    requests.filter(sent => sent.method === 'PATCH').length,
    0,
    'writes made against a refused issue'
  )
})

check('a run with nothing due says so without asking for attention', async () => {
  const { answer } = await fire({})
  same(answer.body.due, 0, 'issues due')
  same(answer.body.unreached, 0, 'issues left for the next firing')
  same(answer.body.needsAttention, false, 'whether a person is told')
})

// The newsletter was taken off the site: no signup form, no archive, and no
// page that mentions it. What is left here is the send path, which nothing now
// feeds and nothing now calls, and the schedule that used to call it is gone -
// so this asserts the absence rather than the schedule. A cron that mails a
// list is the one part of a retired product that can still act on its own.
check('no schedule fires the send path any more', () => {
  const registered = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')).crons || []
  ok(
    !registered.some(entry => entry.path === '/api/newsletter-due'),
    `a schedule still names the endpoint: ${registered.map(entry => entry.path).join(', ')}`
  )
})

await finish()

console.log(`newsletter send: all ${cases.length} cases pass`)
