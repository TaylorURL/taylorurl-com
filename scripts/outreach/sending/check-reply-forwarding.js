/**
 * Holds the reply reader to putting what it reads in front of a person.
 *
 * The mailbox the outreach jobs open is a machine's mailbox. Nobody signs into
 * it, so every guarantee that a reply gets answered rests on the run carrying
 * it somewhere a person looks. A run that files the reply and stops is
 * indistinguishable, from the outside, from a week with no replies in it -
 * which is the failure these cases exist to catch, because it reports success
 * the whole time it is losing work.
 *
 * Six things are asked of the carrying. It happens for every message a person
 * wrote, including the ones the pipeline cannot match to a prospect, since an
 * owner answering from their own address arrives with nothing to file it
 * against and is still a lead. It happens once for each of them: the reader
 * runs every hour over a week of mail, and a message carried without a row to
 * recognise it by is carried again on every one of those runs, which puts the
 * same reply in front of somebody who answered it the first time. It never
 * happens for a bounce, which is a machine reporting a failure the run already
 * acts on. It is aimed at the studio and answers the sender, so replying to
 * the notice reaches the business rather than the mailbox. It is allowed to
 * fail on its own: the row is the record, so a mail provider having a bad
 * morning must cost the notice and never the reply or the run.
 *
 * And it carries no robots. The mailbox is a working account, so its own
 * administrative post arrives in the same shape an unmatched lead does, and an
 * inbox that fills with DMARC reports every hour stops being read - which is
 * the thing the carrying exists to prevent rather than to cause. A prospect's
 * own reply is carried whatever it looks like, because there the pipeline
 * already knows who is writing.
 *
 * And what it carries has to be readable. A reply arrives as parts, and the
 * one a person typed is the plain part where there is one and the HTML part
 * where there is not. A message read whole is its headers and its encoded
 * parts, which is a source listing and not a reply, so a message with neither
 * part reads as nothing rather than as that.
 *
 * Nothing here opens a socket. The mailbox arrives as a list, the database
 * answers from a plan, and the mail endpoint is a function recording what it
 * was handed.
 */

import { cases, check, finish, ok, same } from '../../harness/checks.js'

process.env.OUTREACH_SMTP_USER = 'studio@example.com'
process.env.OUTREACH_SMTP_PASSWORD = 'not-a-password'
process.env.RESEND_API_KEY = 'not-a-key'
process.env.CONTACT_INBOX = 'studio-inbox@example.com'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const INBOX = 'studio-inbox@example.com'

const {
  work: watchWork,
  replyNotice,
  readableBody,
  textOfHtml,
} = await import('../../../api/outreach/watch.js')
const { ANNOTATION, WORDMARK } = await import('../../../lib/mail/identity.js')

// ── The database stand-in ────────────────────────────────────────────────

/**
 * A client that answers every query from a plan and records what was asked.
 *
 * The operation is fixed by the first mutating call in a chain rather than by
 * the last, so the `.select()` an insert takes to read its own row back leaves
 * that insert an insert.
 */
function stubDb(plan, onAsk = () => {}) {
  const asked = []
  // What each write was actually handed, beside the name of the call, so a
  // case can ask what a row says rather than only that a row was written.
  const writes = []

  const answerFor = key => plan[key] ?? { data: [], error: null, count: 0 }

  const from = table => {
    const state = { table, op: 'select', payload: null }
    const chain = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'then') {
            const key = `${state.op}:${state.table}`
            asked.push(key)
            if (state.op !== 'select') writes.push({ key, payload: state.payload })
            onAsk(key)
            const answer = answerFor(key)
            return (resolve, reject) => Promise.resolve(answer).then(resolve, reject)
          }
          return (...args) => {
            if (state.op === 'select' && ['insert', 'update', 'upsert', 'delete'].includes(prop)) {
              state.op = prop
              state.payload = args[0] ?? null
            }
            return chain
          }
        },
      }
    )
    return chain
  }

  // The client carries functions as well as tables, and a carried reply goes
  // through one on its way to the lead record. A double that models only
  // `from` answers "db.rpc is not a function" the moment one is called, which
  // reads as a fault in the pipeline rather than a gap in the double.
  const rpc = (name, args) => {
    const key = `rpc:${name}`
    asked.push(key)
    writes.push({ key, payload: args ?? null })
    onAsk(key)
    return Promise.resolve(
      plan[key] ?? { data: { ok: true, lead_id: 'l1', fresh: true }, error: null }
    )
  }

  return { db: { from, rpc }, asked, writes }
}

// ── The mail endpoint stand-in ───────────────────────────────────────────

/**
 * Stands in for Resend for the length of one run, answering how it is told to
 * and keeping what it was handed. The global is put back either way, so a case
 * that throws does not leave the next one talking to a stub it never asked
 * for.
 */
async function withMail(answer, run) {
  const sent = []
  const original = globalThis.fetch

  globalThis.fetch = async (url, options) => {
    if (String(url) !== RESEND_ENDPOINT) return original(url, options)
    sent.push(JSON.parse(options.body))
    return answer()
  }

  try {
    await run(sent)
  } finally {
    globalThis.fetch = original
  }

  return sent
}

const accepted = () => ({ ok: true, status: 200, text: async () => '{}' })
const rejected = () => ({ ok: false, status: 502, text: async () => 'the provider is unwell' })

// ── What the watch route is handed ───────────────────────────────────────

const PROSPECT = {
  id: 'p1',
  email: 'owner@example.com',
  name: 'Baytown Plumbing',
  website: 'https://baytownplumbing.com',
  stage: 'contacted',
  replied_at: null,
}

/** One inbound message, shaped the way the mailbox reader hands them over. */
const inbound = (body, over = {}) => ({
  uid: 1,
  envelope: {
    messageId: '<reply-1@example.com>',
    subject: 'Re: your website',
    from: [{ address: 'owner@example.com' }],
    to: [{ address: 'studio@example.com' }],
    date: '2026-08-29T15:00:00.000Z',
    ...(over.envelope ?? {}),
  },
  headerText: '',
  bounce: false,
  body,
  ...over,
})

/** A run of the reader over one mailbox, against a database that accepts. */
const run = (messages, plan = {}) => {
  const { db, asked, writes } = stubDb({
    'select:outreach_messages': { data: [], error: null },
    'select:outreach_prospects': { data: [PROSPECT], error: null },
    ...plan,
  })
  const counts = { examined: 0, changed: 0 }
  return { asked, writes, counts, go: () => watchWork({ db, counts, read: async () => messages }) }
}

// ── The cases ────────────────────────────────────────────────────────────

check('a notice arrives in the studio\u2019s own frame', () => {
  // A notice drawn on a bare table is the one message in the inbox that looks
  // like nobody sent it, and the mark is the whole of the difference. Read off
  // the notice a real reply produces rather than off the frame in isolation,
  // because a frame nothing reaches is a frame that proves nothing.
  const { html } = replyNotice(
    { from: 'owner@example.com', subject: 'Re: your website', body: 'hello' },
    PROSPECT
  )
  ok(html.includes(WORDMARK.src), 'the notice does not carry the wordmark')
  for (const line of ANNOTATION) {
    ok(html.includes(line), `the notice does not carry "${line}"`)
  }
})

check('a notice is handed over marked urgent', async () => {
  // Somebody is waiting on an answer at the other end of every one of these,
  // and the four spellings are what carry that through to a client rather than
  // stopping at the sending domain.
  const [sent] = await withMail(accepted, run([inbound('Sounds good, what would it cost?')]).go)
  same(sent.headers?.Importance, 'high', 'the importance header')
  same(sent.headers?.Priority, 'urgent', 'the priority header')
  same(sent.headers?.['X-Priority'], '1 (Highest)', 'the X-Priority header')
  same(sent.headers?.['X-MSMail-Priority'], 'High', 'the Outlook priority header')
})

check('a reply reaches a person and not only a row', async () => {
  const { counts, asked, go } = run([inbound('Sounds good, what would it cost?')])
  const sent = await withMail(accepted, go)

  same(sent.length, 1, 'notices handed over')
  same(counts.changed, 1, 'rows counted as changed')
  ok(asked.includes('insert:outreach_messages'), 'the reply is recorded as well as carried')
})

check('the notice goes to the studio and answers the business', async () => {
  const { go } = run([inbound('Interested, call me Tuesday')])
  const [notice] = await withMail(accepted, go)

  same(notice.to.length, 1, 'recipients on the notice')
  same(notice.to[0], INBOX, 'where the notice was addressed')
  same(notice.reply_to, 'owner@example.com', 'the address an answer would reach')
  ok(notice.subject.includes('Baytown Plumbing'), 'the business is named in the subject')
  ok(notice.text.includes('Interested, call me Tuesday'), 'the message itself is carried')
})

/** A message from somebody the pipeline holds no prospect for. */
const stranger = () =>
  inbound('This is Dave from the plumbing place, ring me', {
    envelope: {
      messageId: '<reply-2@example.com>',
      subject: 'website',
      from: [{ address: 'dave@somewhere-else.example.com' }],
      to: [{ address: 'studio@example.com' }],
      date: '2026-08-29T15:00:00.000Z',
    },
  })

check('a message no prospect carries is still put in front of somebody', async () => {
  const { writes, go } = run([stranger()])
  const [notice] = await withMail(accepted, go)

  same(notice.reply_to, 'dave@somewhere-else.example.com', 'the address an answer would reach')
  same(notice.to[0], INBOX, 'where the notice was addressed')

  const stored = writes.find(write => write.key === 'insert:outreach_messages')?.payload ?? {}
  same(stored.prospect_id, null, 'the prospect on a row that has none')
  same(stored.provider_id, '<reply-2@example.com>', 'the id a later run would know it by')
  same(stored.from_address, 'dave@somewhere-else.example.com', 'the address on the row')
})

check('an unmatched message is carried once rather than once an hour', async () => {
  // The row is what a later run recognises a message by, and a carried message
  // with no row is a message the next run finds again. The reader runs every
  // hour over a week of mail, so one missing row is the same notice about the
  // same reply in the inbox every hour for a week - which is what this holds
  // the second run to not doing.
  const { writes, go } = run([stranger()])
  const sent = await withMail(accepted, async () => {
    await go()
    const filed = writes.find(write => write.key === 'insert:outreach_messages')?.payload ?? {}
    // The second run reads the mailbox unchanged and the table as the first
    // run left it.
    const { go: again } = run([stranger()], {
      'select:outreach_messages': { data: [{ provider_id: filed.provider_id }], error: null },
    })
    await again()
  })

  same(sent.length, 1, 'notices handed over across two runs over the same mailbox')
})

check('a refused notice leaves an unmatched message to the next run', async () => {
  // Nothing else is written for one of these, so the row means the notice went
  // and nothing else. Written over a refusal it would be the one message the
  // mailbox holds that nobody is ever told about.
  const { asked, go } = run([stranger()])
  const sent = await withMail(rejected, go)

  same(sent.length, 1, 'attempts made')
  ok(
    !asked.includes('insert:outreach_messages'),
    'a message nobody was told about was recorded as handled'
  )
})

check('a bounce is acted on rather than forwarded', async () => {
  const report = inbound('Final-Recipient: rfc822; owner@example.com\nStatus: 5.1.1\n', {
    bounce: true,
    envelope: {
      messageId: '<bounce-1@example.com>',
      subject: 'Delivery Status Notification (Failure)',
      from: [{ address: 'mailer-daemon@example.com' }],
      to: [{ address: 'studio@example.com' }],
      date: '2026-08-29T15:00:00.000Z',
    },
  })

  const { go } = run([report])
  const sent = await withMail(accepted, go)

  same(sent.length, 0, 'notices handed over for a machine reporting a failure')
})

/** An unmatched message from one address, with headers of its own. */
const unmatched = (address, headerText = '') =>
  inbound('Automatic post, nobody typed this', {
    headerText,
    envelope: {
      messageId: `<auto-${address}@example.com>`,
      subject: 'Report Domain: baytownwebdevelopment.com',
      from: [{ address }],
      to: [{ address: 'studio@example.com' }],
      date: '2026-08-29T15:00:00.000Z',
    },
  })

for (const address of [
  'noreply-dmarc-support@google.com',
  'sc-noreply@google.com',
  'workspace-noreply@google.com',
  'dmarcreport@microsoft.com',
  'billing@google.com',
  'do-not-reply@example.com',
  'mailer-daemon@example.net',
]) {
  check(`${address} names itself a machine and is not carried`, async () => {
    const { go } = run([unmatched(address)])
    const sent = await withMail(accepted, go)
    same(sent.length, 0, 'notices handed over')
  })
}

for (const header of [
  'Auto-Submitted: auto-replied',
  'Precedence: bulk',
  'List-Id: <workspace.google.com>',
  'List-Unsubscribe: <https://example.com/x>',
  'Feedback-ID: 1:2:3:mail',
  'X-Auto-Response-Suppress: All',
]) {
  check(`a sender declaring "${header.split(':')[0]}" is not carried`, async () => {
    const { go } = run([unmatched('workspace@google.com', `${header}\r\n`)])
    const sent = await withMail(accepted, go)
    same(sent.length, 0, 'notices handed over')
  })
}

check('an unmatched message a person typed is still carried', async () => {
  const { go } = run([
    inbound('Dave here from the plumbing place, give me a ring', {
      envelope: {
        messageId: '<dave@example.com>',
        subject: 'website',
        from: [{ address: 'dave@somewhere-else.example.com' }],
        to: [{ address: 'studio@example.com' }],
        date: '2026-08-29T15:00:00.000Z',
      },
    }),
  ])
  const sent = await withMail(accepted, go)
  same(sent.length, 1, 'notices handed over')
})

check('a prospect is carried even when their mail looks automated', async () => {
  // The pipeline knows who is writing here, so the shape of the mail decides
  // nothing: a business whose server stamps Precedence on everything it sends
  // must not be the business whose reply is dropped.
  const { go } = run([inbound('yes, interested', { headerText: 'Precedence: bulk\r\n' })])
  const sent = await withMail(accepted, go)
  same(sent.length, 1, 'notices handed over')
})

check('an opt-out is carried too, since somebody wrote it', async () => {
  const { go } = run([inbound('please unsubscribe me')])
  const sent = await withMail(accepted, go)

  same(sent.length, 1, 'notices handed over')
})

check('a refused notice costs the notice and not the reply', async () => {
  const { counts, asked, go } = run([inbound('yes please')])
  const sent = await withMail(rejected, go)

  same(sent.length, 1, 'attempts made')
  same(counts.changed, 1, 'rows counted as changed')
  ok(
    asked.includes('insert:outreach_messages'),
    'the reply is recorded even though the mail failed'
  )
})

check('the notice is handed over only once the reply is stored', async () => {
  // A notice sent before the row is a reply that can be answered and then
  // lost, so the order is asserted rather than assumed from the source.
  const order = []
  const { db } = stubDb(
    {
      'select:outreach_messages': { data: [], error: null },
      'select:outreach_prospects': { data: [PROSPECT], error: null },
    },
    key => order.push(key)
  )

  const counts = { examined: 0, changed: 0 }
  const original = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    if (String(url) !== RESEND_ENDPOINT) return original(url, options)
    order.push('notice')
    return accepted()
  }
  try {
    await watchWork({ db, counts, read: async () => [inbound('go on then')] })
  } finally {
    globalThis.fetch = original
  }

  const notice = order.indexOf('notice')
  const stored = order.indexOf('insert:outreach_messages')
  ok(notice !== -1, 'a notice was handed over')
  ok(stored !== -1, 'the reply was stored')
  ok(stored < notice, 'the reply is stored before the notice goes')
})

check('a mailbox that fills defers the rest rather than filing them unannounced', async () => {
  // The cap is on notices, but the row is what stops a later run reading a
  // message again. A run that recorded past the cap would file replies no
  // notice ever followed and no run would ever read them a second time, so
  // the pass stops at the cap and the mailbox still holds the rest.
  const many = Array.from({ length: 40 }, (_, at) =>
    inbound(`message ${at}`, {
      uid: at + 1,
      envelope: {
        messageId: `<reply-${at}@example.com>`,
        subject: 'Re: your website',
        from: [{ address: `owner${at}@example.com` }],
        to: [{ address: 'studio@example.com' }],
        date: '2026-08-29T15:00:00.000Z',
      },
    })
  )
  const prospects = {
    'select:outreach_prospects': {
      data: many.map((message, at) => ({
        ...PROSPECT,
        id: `p${at}`,
        email: `owner${at}@example.com`,
      })),
      error: null,
    },
  }

  const { counts, go } = run(many, prospects)
  const sent = await withMail(accepted, go)

  same(sent.length, 25, 'notices handed over')
  same(counts.changed, 25, 'replies recorded')
  ok(counts.changed <= sent.length, 'a reply was recorded that no notice followed')

  // The fifteen it stopped short of are still in the mailbox and still
  // unrecorded, so the next run reads them with a full budget and carries them.
  const carried = many.slice(0, 25).map(message => ({
    provider_id: message.envelope.messageId,
  }))
  const { counts: after, go: again } = run(many, {
    ...prospects,
    'select:outreach_messages': { data: carried, error: null },
  })
  const rest = await withMail(accepted, again)

  same(rest.length, 15, 'notices handed over by the next run')
  same(after.changed, 15, 'replies recorded by the next run')
})

check('a deployment with no mail key records the reply and sends nothing', async () => {
  const held = process.env.RESEND_API_KEY
  delete process.env.RESEND_API_KEY
  try {
    // A fresh instance, because the key is read once when the route loads.
    const { work: keyless } = await import('../../../api/outreach/watch.js?keyless=1')
    const { db, asked } = stubDb({
      'select:outreach_messages': { data: [], error: null },
      'select:outreach_prospects': { data: [PROSPECT], error: null },
    })
    const counts = { examined: 0, changed: 0 }
    const sent = await withMail(accepted, () =>
      keyless({ db, counts, read: async () => [inbound('hello')] })
    )

    same(sent.length, 0, 'notices handed over')
    same(counts.changed, 1, 'rows counted as changed')
    ok(asked.includes('insert:outreach_messages'), 'the reply is still recorded')
  } finally {
    process.env.RESEND_API_KEY = held
  }
})

// ── The body a message is read into ──────────────────────────────────────

/** A mailbox that answers each part by name, recording which were asked for. */
const partsOf = parts => {
  const asked = []
  return {
    asked,
    fetch: async part => {
      asked.push(part)
      return parts[part] ?? ''
    },
  }
}

const ALTERNATIVE = {
  type: 'multipart/alternative',
  childNodes: [
    { part: '1', type: 'text/plain' },
    { part: '2', type: 'text/html' },
  ],
}

check('a reply with a plain part is read from it and the HTML part is left alone', async () => {
  const parts = partsOf({ 1: 'go on then\n', 2: '<p>go on then</p>' })
  const body = await readableBody(ALTERNATIVE, parts.fetch)

  same(body, 'go on then\n', 'the body')
  same(parts.asked.join(','), '1', 'parts asked for')
})

check('a reply with only an HTML part is read as the words on it', async () => {
  const parts = partsOf({
    1:
      '<html><head><style>p{color:red}</style><title>Re: your website</title></head>' +
      '<body><div dir="ltr">Please stop contacting me</div><div><br></div>' +
      '<div>I have run my own reports &amp; they don&#8217;t match</div></body></html>',
  })
  const body = await readableBody({ part: '1', type: 'text/html' }, parts.fetch)

  same(
    body,
    'Please stop contacting me\n\nI have run my own reports & they don’t match',
    'the body'
  )
})

check('a reply with an empty plain part falls back to the HTML one', async () => {
  const parts = partsOf({ 1: '  \n', 2: '<p>hello</p>' })
  const body = await readableBody(ALTERNATIVE, parts.fetch)

  same(body, 'hello', 'the body')
})

check('a message with no text part reads as nothing rather than as its source', async () => {
  const parts = partsOf({ 1: 'JVBERi0xLjQK' })
  const body = await readableBody({ part: '1', type: 'application/pdf' }, parts.fetch)

  same(body, '', 'the body')
  same(parts.asked.length, 0, 'parts asked for')
})

check(
  'the quoted copy under an HTML reply comes out marked, so it is not read as the reply',
  () => {
    const text = textOfHtml(
      '<div>go on then</div><div><br></div>' +
        '<blockquote type="cite">On Sep 2, 2026, at 12:17 PM, Trenton wrote:<br><br>' +
        '<table><tr><td>Lowest Mark</td><td>Performance</td></tr></table>' +
        '<p>If you would rather not hear from me, reply and say unsubscribe.</p></blockquote>'
    )

    same(
      text,
      [
        'go on then',
        '',
        '> On Sep 2, 2026, at 12:17 PM, Trenton wrote:',
        '>',
        '> Lowest Mark Performance',
        '>',
        '> If you would rather not hear from me, reply and say unsubscribe.',
      ].join('\n'),
      'the text'
    )
  }
)

check('an HTML-only reply that quotes the opt-out offer is not itself an opt-out', async () => {
  const html =
    '<div>Yes please, send me the list</div>' +
    '<blockquote type="cite">On Sep 2, 2026, Trenton wrote:<br>' +
    '<p>If you would rather not hear from me, reply and say unsubscribe.</p></blockquote>'
  const body = await readableBody({ part: '1', type: 'text/html' }, async () => html)
  const { go, asked } = run([inbound(body)])
  await withMail(accepted, go)

  ok(asked.includes('insert:outreach_messages'), 'the reply is recorded')
  ok(!asked.includes('upsert:suppression'), 'nobody is suppressed for quoting the footer')
})

// ── The machines that answer on arrival ──────────────────────────────────

/**
 * An inbound message under a subject of its own.
 *
 * `inbound` spreads its overrides over the whole message, so an `envelope`
 * handed to it replaces the built one rather than joining it, and a message
 * with no `from` is one the reader cannot match to anybody. This carries the
 * rest of the envelope through with the subject.
 */
const underSubject = (subject, body) =>
  inbound(body, {
    envelope: {
      messageId: '<reply-1@example.com>',
      subject,
      from: [{ address: 'owner@example.com' }],
      to: [{ address: 'studio@example.com' }],
      date: '2026-08-29T15:00:00.000Z',
    },
  })

check('an auto-responder does not move the business to replied', async () => {
  // The one reply this pipeline has ever recorded was a mailbox thanking the
  // sender for choosing it, counted as the thing every letter is written to
  // earn. A machine answering on arrival says nothing about whether anybody
  // read the letter, so the standing does not move and the chain runs on.
  const { go, asked, writes } = run([
    underSubject(
      'Baytown Plumbing scores 31 out of 100 on mobile',
      'Thank you for choosing Kindred Pest Control!\n\n(979) 436-8023'
    ),
  ])
  await withMail(accepted, go)

  ok(asked.includes('insert:outreach_messages'), 'the answer is recorded')
  ok(!asked.includes('update:outreach_prospects'), 'a machine moved the standing')
  const stored = writes.find(write => write.key === 'insert:outreach_messages')?.payload ?? {}
  same(stored.intent, 'auto_reply', 'what the stored row says the answer was')
  ok(stored.intent_phrase, 'the row carries no phrase for why it was read as one')
})

check('a person answering under Re: is a reply whatever the words are', async () => {
  const { go, asked } = run([inbound('Thanks for reaching out. Send the list over.')])
  await withMail(accepted, go)
  ok(asked.includes('update:outreach_prospects'), 'a person did not move the standing')
})

check('an out of office is read as a machine', async () => {
  const { go, asked } = run([
    underSubject('Automatic reply: your site on a phone', 'I am out of the office until Monday.'),
  ])
  await withMail(accepted, go)
  ok(!asked.includes('update:outreach_prospects'), 'an out of office moved the standing')
})

check('a person who says stop under an automatic subject is still heard', async () => {
  // The opt-out reading runs in front of this one, so the one case where the
  // two disagree is settled the safe way round.
  const { go, asked } = run([underSubject('Automatic reply', 'Please remove me from your list.')])
  await withMail(accepted, go)
  ok(asked.includes('upsert:suppression'), 'somebody who asked to stop was not suppressed')
})

check('a machine\u2019s answer is filed and not carried', async () => {
  const { go, asked, writes } = run([
    underSubject(
      'Baytown Plumbing scores 31 out of 100 on mobile',
      'Out of the office until Monday.'
    ),
  ])
  const sent = await withMail(accepted, go)

  same(sent.length, 0, 'notices handed over')
  ok(asked.includes('insert:outreach_messages'), 'the answer is not recorded either')
  const stored = writes.find(write => write.key === 'insert:outreach_messages')?.payload ?? {}
  same(stored.intent, 'auto_reply', 'what the stored row says the answer was')
})

// ── The desks that answer under Re: ───────────────────────────────────

/**
 * The receipt a ticket desk sends the moment a letter reaches it.
 *
 * This is the real one, off a letter written to a directory listing whose
 * contact address turned out to be a help desk. It arrives under "Re:" like a
 * person's answer, from an ordinary help box, with no header declaring itself,
 * and the words in it are a ticket number and a promise that somebody will
 * read it one day. Read as a reply it ends the chain, moves the business to
 * answered, puts a notice nobody can act on in the inbox and puts the same
 * line in the morning report.
 */
const DESK_RECEIPT = [
  '##- Please type your reply above this line -##',
  '',
  'Thanks for reaching out to us for some help with MapQuest.com. Give us a bit',
  'to see how to help. Someone will be in touch with you soon.',
  '',
  'Regards,',
  'Your MapQuest Help Team',
  '',
  "Here's a summary of your request #3201820:",
  '--------------------------------',
  'This email is a service from MapQuest Consumer Support. [W6Z946-4NX5R]',
].join('\n')

check('a ticket desk answering under Re: is read as a machine', async () => {
  const { go, asked, writes } = run([underSubject('Re:', DESK_RECEIPT)])
  await withMail(accepted, go)

  ok(!asked.includes('update:outreach_prospects'), 'a ticket receipt moved the standing')
  const stored = writes.find(write => write.key === 'insert:outreach_messages')?.payload ?? {}
  same(stored.intent, 'auto_reply', 'what the stored row says the answer was')
  ok(stored.intent_phrase, 'the row carries no phrase for why it was read as one')
})

check('a ticket desk receipt is not carried into the inbox', async () => {
  const { go } = run([underSubject('Re:', DESK_RECEIPT)])
  const sent = await withMail(accepted, go)
  same(sent.length, 0, 'notices handed over')
})

check('an unmatched ticket desk receipt is not carried either', async () => {
  // Nothing to file it against changes what happens to the row, not what the
  // message is. A help desk writing from help@ passes both the older readings.
  const { go } = run([
    inbound(DESK_RECEIPT, {
      envelope: {
        messageId: '<desk-1@example.com>',
        subject: 'Re:',
        from: [{ address: 'help@mapquest.example.com' }],
        to: [{ address: 'studio@example.com' }],
        date: '2026-08-29T15:00:00.000Z',
      },
    }),
  ])
  const sent = await withMail(accepted, go)
  same(sent.length, 0, 'notices handed over')
})

check('an agent writing through the same desk is carried', async () => {
  // The delimiter and the footer ride on an agent's own answer too, so the
  // furniture cannot be the whole test. What the desk's receipt has and this
  // has not is that it says nothing but that it arrived.
  const agent = [
    '##- Please type your reply above this line -##',
    '',
    'We looked at the site and the slow part is the photo gallery on the front',
    'page. Call me Tuesday and we can go through it.',
    '',
    'This email is a service from MapQuest Consumer Support. [W6Z946-4NX5R]',
  ].join('\n')

  const { go, asked } = run([underSubject('Re: your website', agent)])
  const sent = await withMail(accepted, go)

  same(sent.length, 1, 'notices handed over')
  ok(asked.includes('update:outreach_prospects'), 'a person did not move the standing')
})

check('a person who says stop through a desk is still heard', async () => {
  // The opt-out reading runs in front of the desk reading too.
  const { go, asked } = run([
    underSubject(
      'Re:',
      `##- Please type your reply above this line -##\n\nPlease remove me from your list.`
    ),
  ])
  await withMail(accepted, go)
  ok(asked.includes('upsert:suppression'), 'somebody who asked to stop was not suppressed')
})

const passed = await finish({ listed: true })
console.log(`\n${passed}/${cases.length} passed`)
