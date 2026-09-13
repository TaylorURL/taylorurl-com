/**
 * Holds the outreach sender to checking an address before it writes to one.
 *
 * Outreach addresses are scraped rather than given, so a share of them cannot
 * receive mail, and each one written to is a hard bounce charged against the
 * sending domain that the newsletter and the client mail also leave from. The
 * daily cap only rises while the trailing bounce rate stays low, which makes
 * the check the thing the whole ramp rests on.
 *
 * A guard that is called by everyone who remembers to call it is not a guard,
 * so what is asserted here is that the refusal sits in front of the transport
 * rather than beside it: `deliver` is handed a mail client that records every
 * call, and a refused address has to leave that recorder untouched.
 *
 * The three verdicts are checked apart from each other because the third is
 * what keeps a real business alive. A resolver that times out says nothing
 * about a domain, and treating it as an answer would retire a working address
 * over a bad afternoon on a nameserver.
 *
 * No DNS query is made and no message is sent. Every lookup is a stub, and the
 * one case that reaches the transport reaches a fake of it.
 */

import {
  DISPOSABLE_DOMAINS,
  Undeliverable,
  checkAddress,
  domainOf,
  forgetDomains,
  mxFor,
  shapeOf,
} from '../../../lib/outreach/prospects/address.js'
import { queueFor } from '../../../lib/outreach/sending/queue.js'
import { deliver } from '../../../api/outreach/send.js'
import { installFixtureHeldDomains } from '../held-domains-fixture.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'

installFixtureHeldDomains()

/** A resolver answering with one mail server, counting how often it was asked. */
function resolves(exchange = 'mx.example.net') {
  const asked = []
  return {
    asked,
    lookup: async domain => {
      asked.push(domain)
      return [{ exchange, priority: 10 }]
    },
  }
}

/** A resolver refusing with one of the codes `node:dns` raises. */
const fails = code => async () => {
  throw Object.assign(new Error(`query failed: ${code}`), { code })
}

/** A stand-in for the domain cache, recording what was read and written. */
function cache(rows = []) {
  const held = new Map(rows.map(row => [row.domain, row]))
  const wrote = []
  return {
    held,
    wrote,
    db: {
      from: table => {
        if (table !== 'outreach_domains') throw new Error(`unexpected table ${table}`)
        return {
          select: () => ({
            eq: (_column, value) => ({
              maybeSingle: async () => ({ data: held.get(value) ?? null, error: null }),
            }),
          }),
          upsert: async row => {
            wrote.push(row)
            held.set(row.domain, row)
            return { error: null }
          },
        }
      },
    },
  }
}

/** A mail client that records what it was asked to send and sends nothing. */
function transport() {
  const sent = []
  return {
    sent,
    build: () => ({
      sendMail: async message => {
        sent.push(message)
        return { messageId: '<recorded@example.net>' }
      },
    }),
  }
}

const MESSAGE = {
  id: 'message-1',
  subject: 'A reading of your website',
  body_text: 'text',
  body_html: '<p>text</p>',
  to_address: '',
}

const FROM = { name: 'TaylorURL', address: 'hello@taylorurl.com' }

// -- the shape, which costs nothing and settles most of it -------------------

check('a malformed address is refused before anything is looked up', () => {
  for (const value of ['', 'nobody', 'no@body', 'a@b..c', 'two@@at.com', 'has space@site.com']) {
    const refusal = shapeOf(value)
    ok(refusal, `${JSON.stringify(value)} was not refused`)
    same(refusal.verdict, 'undeliverable', `${value} verdict`)
    same(refusal.reason, 'malformed', `${value} reason`)
  }
})

check('an address longer than a mail server accepts is refused', () => {
  const long = `${'a'.repeat(250)}@example.com`
  same(shapeOf(long)?.reason, 'malformed', 'over-length address')
})

check('a mailbox that reaches nobody is refused', () => {
  for (const box of ['noreply', 'no-reply', 'postmaster', 'mailer-daemon', 'bounces']) {
    same(shapeOf(`${box}@realbusiness.com`)?.reason, 'role_box', `${box} reason`)
  }
})

check('a plus tag does not hide a role mailbox', () => {
  same(shapeOf('noreply+leads@realbusiness.com')?.reason, 'role_box', 'tagged role box')
})

check('every box a person opens passes, and only a machine does not', () => {
  // A desk is written to: at this size of business sales@ and the owner are
  // usually the same inbox. Only a machine's box is refused on its name,
  // because nobody reads it at all.
  for (const box of ['sales', 'support', 'admin', 'newsletter', 'sales+web', 'frontdesk']) {
    same(shapeOf(`${box}@realbusiness.com`), null, `${box} should pass`)
  }
  for (const box of ['jane', 'j.smith', 'bhammack', 'info', 'hello', 'office']) {
    same(shapeOf(`${box}@realbusiness.com`), null, `${box} should pass`)
  }
  for (const box of ['noreply', 'postmaster', 'mailer-daemon']) {
    same(shapeOf(`${box}@realbusiness.com`)?.reason, 'role_box', `${box} should be refused`)
  }
})

check('a domain held off outreach is refused whatever the mailbox', () => {
  same(shapeOf('jane@readymixyard.example')?.reason, 'held_domain', 'held domain')
})

check('a throwaway mail service is refused', () => {
  for (const domain of ['mailinator.com', 'yopmail.com', 'guerrillamail.com']) {
    ok(DISPOSABLE_DOMAINS.has(domain), `${domain} is not on the list`)
    same(shapeOf(`owner@${domain}`)?.reason, 'disposable', `${domain} reason`)
  }
})

check("a booking platform's own address is refused", () => {
  same(shapeOf('info@yelp.com')?.reason, 'platform', 'platform address')
})

check('an ordinary business address passes the shape', () => {
  for (const value of ['owner@harbourplumbing.example', 'Jane.Doe@Some-Shop.example']) {
    same(shapeOf(value), null, `${value} should pass`)
  }
})

check('the domain is read off the address as it is stored', () => {
  same(domainOf('  Owner@Harbour-Plumbing.EXAMPLE '), 'harbour-plumbing.example', 'domain')
})

// -- the mail server, which is the one question that costs a round trip ------

check('a domain with a mail server is deliverable', async () => {
  const dns = resolves()
  same((await mxFor('harbourplumbing.example', dns.lookup)).verdict, 'deliverable', 'verdict')
})

check('a domain answering with no mail server is refused', async () => {
  const empty = await mxFor('harbourplumbing.example', async () => [])
  same(empty.verdict, 'undeliverable', 'empty record verdict')
  same(empty.reason, 'no_mx', 'empty record reason')

  const blank = await mxFor('harbourplumbing.example', async () => [
    { exchange: '  ', priority: 0 },
  ])
  same(blank.reason, 'no_mx', 'blank exchange reason')

  const none = await mxFor('harbourplumbing.example', fails('ENODATA'))
  same(none.reason, 'no_mx', 'ENODATA reason')
})

check('a domain that does not exist is refused', async () => {
  const gone = await mxFor('nosuchbusiness.invalid', fails('ENOTFOUND'))
  same(gone.verdict, 'undeliverable', 'NXDOMAIN verdict')
  same(gone.reason, 'no_domain', 'NXDOMAIN reason')
})

check('a resolver that did not answer settles nothing', async () => {
  for (const code of ['ETIMEOUT', 'ESERVFAIL', 'ECONNREFUSED', 'EREFUSED']) {
    const unsettled = await mxFor('harbourplumbing.example', fails(code))
    same(unsettled.verdict, 'unknown', `${code} verdict`)
    same(unsettled.reason, 'dns_unavailable', `${code} reason`)
  }
})

// -- the cache, so a domain is resolved once rather than once per address ----

check('two addresses at one domain cost one lookup', async () => {
  forgetDomains()
  const dns = resolves()
  const store = cache()
  await checkAddress(store.db, 'owner@harbourplumbing.example', { resolveMx: dns.lookup })
  await checkAddress(store.db, 'service@harbourplumbing.example', { resolveMx: dns.lookup })
  same(dns.asked.length, 1, 'lookups')
})

check('a reading already on file is used instead of a lookup', async () => {
  forgetDomains()
  const dns = resolves()
  const store = cache([
    {
      domain: 'harbourplumbing.example',
      verdict: 'undeliverable',
      reason: 'no_mx',
      checked_at: new Date().toISOString(),
    },
  ])
  const answer = await checkAddress(store.db, 'owner@harbourplumbing.example', {
    resolveMx: dns.lookup,
  })
  same(answer.verdict, 'undeliverable', 'verdict')
  same(answer.reason, 'no_mx', 'reason')
  same(dns.asked.length, 0, 'lookups')
})

check('a fresh reading is filed for the next invocation', async () => {
  forgetDomains()
  const dns = resolves()
  const store = cache()
  await checkAddress(store.db, 'owner@harbourplumbing.example', { resolveMx: dns.lookup })
  same(store.wrote.length, 1, 'rows written')
  same(store.wrote[0].domain, 'harbourplumbing.example', 'domain written')
  same(store.wrote[0].verdict, 'deliverable', 'verdict written')
})

check('a stale unsettled reading is taken again', async () => {
  forgetDomains()
  const dns = resolves()
  const store = cache([
    {
      domain: 'harbourplumbing.example',
      verdict: 'unknown',
      reason: 'dns_unavailable',
      checked_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
  ])
  const answer = await checkAddress(store.db, 'owner@harbourplumbing.example', {
    resolveMx: dns.lookup,
  })
  same(answer.verdict, 'deliverable', 'verdict')
  same(dns.asked.length, 1, 'lookups')
})

check('a settled reading stands, and a shape refusal never reaches the cache', async () => {
  forgetDomains()
  const dns = resolves()
  const store = cache([
    {
      domain: 'harbourplumbing.example',
      verdict: 'deliverable',
      reason: null,
      checked_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ])
  same(
    (await checkAddress(store.db, 'owner@harbourplumbing.example', { resolveMx: dns.lookup }))
      .verdict,
    'deliverable',
    'settled verdict'
  )
  same(dns.asked.length, 0, 'lookups for the settled domain')

  const refused = await checkAddress(store.db, 'noreply@harbourplumbing.example', {
    resolveMx: dns.lookup,
  })
  same(refused.reason, 'role_box', 'role box reason')
  same(store.wrote.length, 0, 'rows written for a shape refusal')
})

// -- the transport, which is where the guard has to be to be one -------------

check('the transport is never reached for a mailbox that reaches nobody', async () => {
  forgetDomains()
  const mail = transport()
  let raised = null
  try {
    await deliver(
      null,
      { ...MESSAGE, to_address: 'noreply@harbourplumbing.example' },
      FROM,
      '',
      mail.build
    )
  } catch (cause) {
    raised = cause
  }
  ok(raised instanceof Undeliverable, 'the send was not refused')
  same(raised.reason, 'role_box', 'refusal reason')
  same(mail.sent.length, 0, 'messages handed to the transport')
})

check('the transport is never reached for a domain with no mail server', async () => {
  forgetDomains()
  const store = cache()
  // The reading is taken through the same module the sender checks against, so
  // the answer is already held by the time the send asks for it.
  await checkAddress(store.db, 'owner@harbourplumbing.example', { resolveMx: async () => [] })

  const mail = transport()
  let raised = null
  try {
    await deliver(
      store.db,
      { ...MESSAGE, to_address: 'owner@harbourplumbing.example' },
      FROM,
      '',
      mail.build
    )
  } catch (cause) {
    raised = cause
  }
  ok(raised instanceof Undeliverable, 'the send was not refused')
  same(raised.verdict, 'undeliverable', 'refusal verdict')
  same(raised.reason, 'no_mx', 'refusal reason')
  same(mail.sent.length, 0, 'messages handed to the transport')
})

check('the transport is never reached for a reading that could not be settled', async () => {
  forgetDomains()
  const store = cache()
  await checkAddress(store.db, 'owner@harbourplumbing.example', { resolveMx: fails('ETIMEOUT') })

  const mail = transport()
  let raised = null
  try {
    await deliver(
      store.db,
      { ...MESSAGE, to_address: 'owner@harbourplumbing.example' },
      FROM,
      '',
      mail.build
    )
  } catch (cause) {
    raised = cause
  }
  ok(raised instanceof Undeliverable, 'the send was not refused')
  same(raised.verdict, 'unknown', 'refusal verdict')
  same(mail.sent.length, 0, 'messages handed to the transport')
})

check('a verified address reaches the transport, with both halves', async () => {
  forgetDomains()
  const store = cache()
  await checkAddress(store.db, 'owner@harbourplumbing.example', { resolveMx: resolves().lookup })

  const mail = transport()
  const id = await deliver(
    store.db,
    { ...MESSAGE, to_address: 'owner@harbourplumbing.example' },
    FROM,
    'https://www.taylorurl.com/api/outreach/unsubscribe?token=x',
    mail.build
  )
  same(mail.sent.length, 1, 'messages handed to the transport')
  same(mail.sent[0].to, 'owner@harbourplumbing.example', 'recipient')
  same(mail.sent[0].text, 'text', 'text half')
  same(mail.sent[0].html, '<p>text</p>', 'html half')
  ok(mail.sent[0].headers['List-Unsubscribe'], 'the unsubscribe header went with it')
  same(id, '<recorded@example.net>', 'provider id')
})

// -- the queue, which is what the console shows as about to go out ----------

check('the queue drops an address the sender would refuse', () => {
  const rows = [
    { id: 'a', email: 'owner@harbourplumbing.example', stage: 'audited', audit_score: 20 },
    { id: 'b', email: 'noreply@harbourplumbing.example', stage: 'audited', audit_score: 10 },
    { id: 'c', email: 'owner@mailinator.com', stage: 'audited', audit_score: 5 },
    { id: 'd', email: 'not an address', stage: 'audited', audit_score: 1 },
    { id: 'e', email: 'info@yelp.com', stage: 'audited', audit_score: 2 },
    { id: 'f', email: 'sales@harbourplumbing.example', stage: 'audited', audit_score: 3 },
    { id: 'g', email: 'owner@readymixyard.example', stage: 'audited', audit_score: 4 },
    { id: 'h', email: 'info@harbourplumbing.example', stage: 'audited', audit_score: 6 },
  ]
  const queue = queueFor({
    candidates: rows,
    held: new Set(),
    messages: new Map(),
    sending: true,
  })
  // The open inbox, the desk and the person's own box all stay. The machine,
  // the throwaway, the malformed, the platform and the held domain all go.
  // Order is the audit score, worst-loading site first.
  same(queue.map(row => row.id).join(','), 'f,h,a', 'rows left in the queue')
})

check('an address already written to is not written to again', () => {
  // Two listings of one business share a mailbox, and neither row knows about
  // the other: each carries its own stage and its own contacted_at, so each
  // reads as somebody who has never heard from the studio. The address is what
  // has to remember, which is what `written` carries.
  const rows = [
    { id: 'branch-a', email: 'connect@branchtitle.example', stage: 'audited', audit_score: 20 },
    { id: 'branch-b', email: 'connect@branchtitle.example', stage: 'audited', audit_score: 30 },
    { id: 'fresh', email: 'owner@harbourplumbing.example', stage: 'audited', audit_score: 40 },
  ]
  const queue = queueFor({
    candidates: rows,
    held: new Set(),
    written: new Set(['connect@branchtitle.example']),
    messages: new Map(),
    sending: true,
  })
  same(queue.map(row => row.id).join(','), 'fresh', 'a written address was queued again')
})

check('two listings sharing a mailbox get one letter between them', () => {
  // The half that holds inside one batch. Both rows are new, so nothing in the
  // database says the address has been used; only the dedupe stops the second.
  const rows = [
    { id: 'branch-a', email: 'connect@branchtitle.example', stage: 'audited', audit_score: 20 },
    { id: 'branch-b', email: 'connect@branchtitle.example', stage: 'audited', audit_score: 30 },
  ]
  const queue = queueFor({
    candidates: rows,
    held: new Set(),
    written: new Set(),
    messages: new Map(),
    sending: true,
  })
  same(queue.length, 1, 'one mailbox took two letters in a single run')
  same(queue[0].id, 'branch-a', 'the row that survived is not the one that sorted first')
})

await finish()

console.log(`address verification: ${cases.length} checks passed`)
