/**
 * Holds the 5 PM recap to the one table the studio reads it in: each chain's
 * sent count, its opens and the people who wrote back, with machines' replies
 * left out.
 *
 * The run is handed a database that filters its rows the way the real one does,
 * so a letter sent late on the day before lands in that day and not in today's,
 * and a reply is put under the chain its business was written on.
 *
 *   node scripts/outreach/sending/check-daily-report.js
 */
import { check, finish, ok, same } from '../../harness/checks.js'
import {
  chainOf,
  isAutomated,
  plainName,
  renderRecap,
  saidIn,
  tallyOf,
} from '../../../lib/outreach/daily-report.js'
import { RECAP_HOUR, work } from '../../../api/outreach/daily-report.js'

check('a letter is put on its chain by the variant it went under', () => {
  same(chainOf(null), 'Draft preview', 'no variant')
  same(chainOf('slow-site-lawsuit'), 'Lawsuit', 'a lawsuit variant')
  same(chainOf('fair-site-intro'), 'Introduction', 'an introduction variant')
})

check('a filed business name reads the way a person writes it', () => {
  same(plainName('NATIVE STRATEGIC DEVELOPMENT LLC'), 'Native Strategic Development', 'capitals')
  same(plainName('Hass Co LLC'), 'Hass Co', 'a name already in mixed case keeps its case')
})

const quoted = [
  'Absolutely no interest. Please stop.',
  '',
  'Get Outlook for iOS<https://aka.ms/o0ukef>',
  '________________________________',
  'From: TaylorURL LLC <trenton@example.com>',
  'Subject: Re: Trenton Taylor, TaylorURL',
  '',
  'Good morning,',
].join('\r\n')

check('a reply is quoted by the first paragraph its sender typed, and no more', () => {
  same(saidIn(quoted), 'Absolutely no interest. Please stop.', 'the quoted copy is left off')
  same(saidIn('No thanks\n\nCRS Mechanical LLC\nEduardo Sanchez'), 'No thanks', 'the signature too')
  same(saidIn('Delivered-To: trenton@example.com\r\nReceived: by 2002:a05'), '', 'raw headers')
})

check('a machine’s reply is told from a person’s', () => {
  const machine = [
    { subject: 'Automatic reply: Trenton Taylor, TaylorURL', body: 'Thanks for your email.' },
    { subject: 'Out of Office Re: hello', body: 'I will be out', intent: 'auto_reply' },
    {
      subject: 'Re: Trenton Taylor, TaylorURL',
      body: 'Thanks so much for reaching out. We have received your email and will get back to you.',
    },
    {
      subject: 'Re:',
      body: '##- Please type your reply above this line -##\n\nSomeone will be in touch with you soon.',
    },
  ]
  for (const reply of machine) ok(isAutomated(reply), `${reply.subject} is a machine`)
  const people = [
    { subject: 'Re: Trenton Taylor, TaylorURL', body: quoted },
    { subject: 'Re: Trenton Taylor, TaylorURL', body: "Hello. I'm in Fort Worth." },
    { subject: 'Re: Trenton Taylor, TaylorURL', body: 'No thanks', intent: 'opt_out' },
  ]
  for (const reply of people) ok(!isAutomated(reply), `${reply.body.slice(0, 20)} is a person`)
})

const opened = '2026-10-27T15:00:00Z'

check('a day is tallied by chain, with replies under the chain they came back on', () => {
  const tally = tallyOf({
    outreach: [
      { variant_id: null, opened_at: opened },
      { variant_id: null, opened_at: null },
      { variant_id: 'fair-site-intro', opened_at: opened },
      { variant_id: 'slow-site-lawsuit', opened_at: null },
    ],
    newBusiness: [{}, {}],
    failed: [{ name: 'NATIVE STRATEGIC DEVELOPMENT LLC', error: 'Timeout' }],
    replies: [
      { chain: 'Introduction', name: 'Santa Fe Title Company', subject: 'Re: hi', body: quoted },
      { chain: 'Introduction', name: 'Bot Co', subject: 'Automatic reply: hi', body: 'Thanks' },
      { chain: 'Lawsuit', name: 'Opt Co', subject: 'Re: hi', body: 'No thanks', intent: 'opt_out' },
      { chain: 'Other', from: 'owner@example.com', subject: 'Re: hi', body: 'Call me' },
    ],
  })
  same(
    JSON.stringify(tally.chains.map(one => [one.chain, one.sent, one.opens, one.replies.length])),
    JSON.stringify([
      ['Draft preview', 2, '1', 0],
      ['Introduction', 1, '1', 1],
      ['Lawsuit', 1, '0', 1],
      ['New business', 2, 'not tracked', 0],
      ['Other', '–', '–', 1],
    ]),
    'chains'
  )
  same(tally.chains[3].note, '1 failed on a timeout: Native Strategic Development', 'failure')
  same(tally.chains[1].replies[0].said, 'Absolutely no interest. Please stop.', 'what was said')
  ok(tally.chains[2].replies[0].optOut, 'an opt-out is marked')
  same(tally.chains[4].replies[0].name, 'owner@example.com', 'an unnamed reply shows its address')
  same(`${tally.total}/${tally.replies}`, '6/3', 'total sent / people who replied')
})

check('a chain that sent nothing shows a dash for its opens, and no Other row', () => {
  const tally = tallyOf({})
  same(tally.chains[1].opens, '–', 'introduction opens')
  same(tally.chains.length, 4, 'the four chains only')
  same(tally.total, 0, 'total')
})

check('the recap is one table, headed by the day', () => {
  const tally = tallyOf({
    replies: [
      { chain: 'Introduction', name: 'Santa Fe Title Company', subject: 'Re: hi', body: quoted },
    ],
  })
  const recap = renderRecap('2026-10-09', tally)
  same(recap.subject, 'Outreach recap for Friday, Oct 9: 0 sent, 1 reply', 'subject')
  same((recap.html.match(/<th\b/g) ?? []).length, 4, 'one header row of four columns')
  ok(recap.html.includes('Santa Fe Title Company'), 'the reply is in the HTML half')
  ok(recap.text.includes('Introduction reply from Santa Fe Title Company'), 'and the plain half')
})

/** A table that filters its rows by the calls a query makes. */
function tableOf(rows) {
  const filters = []
  const query = {
    select: () => query,
    eq: (column, value) => (filters.push(row => row[column] === value), query),
    in: (column, values) => (filters.push(row => values.includes(row[column])), query),
    not: (column, operator, value) => (filters.push(row => row[column] !== value), query),
    gte: (column, value) => (filters.push(row => row[column] >= value), query),
    lt: (column, value) => (filters.push(row => row[column] < value), query),
    order: () => query,
    range: () => Promise.resolve(answer()),
    then: (resolve, reject) => Promise.resolve(answer()).then(resolve, reject),
  }
  const answer = () => {
    const data = rows.filter(row => filters.every(keep => keep(row)))
    return { data, error: null, count: data.length }
  }
  return query
}

const tables = {
  outreach_messages: [
    // 6:30pm Central on Monday: Monday's, not Tuesday's.
    { variant_id: null, opened_at: opened, sent_at: '2026-10-26T23:30:00.000Z' },
    { variant_id: 'slow-site-lawsuit', opened_at: null, sent_at: '2026-10-27T13:10:00.000Z' },
    { variant_id: null, opened_at: null, sent_at: '2026-10-27T17:05:00.000Z', prospect_id: 'p1' },
    {
      variant_id: 'fair-site-intro',
      opened_at: null,
      sent_at: '2026-10-20T14:00:00.000Z',
      prospect_id: 'p2',
    },
  ]
    .map(row => ({ direction: 'outbound', status: 'sent', ...row }))
    .concat([
      {
        direction: 'inbound',
        status: 'received',
        prospect_id: 'p2',
        subject: 'Re: Trenton Taylor, TaylorURL',
        body_text: quoted,
        intent: null,
        sent_at: '2026-10-27T19:00:00.000Z',
        outreach_prospects: { name: 'Santa Fe Title Company' },
      },
      {
        direction: 'inbound',
        status: 'received',
        prospect_id: 'p1',
        subject: 'Automatic reply: Trenton Taylor, TaylorURL',
        body_text: 'Out of the office',
        intent: 'auto_reply',
        sent_at: '2026-10-27T19:05:00.000Z',
        outreach_prospects: { name: 'Bot Co' },
      },
      {
        direction: 'inbound',
        status: 'received',
        prospect_id: null,
        from_address: 'owner@newco.example.com',
        subject: 'Re: Trenton Taylor, TaylorURL',
        body_text: 'Yes, call me tomorrow.',
        intent: null,
        sent_at: '2026-10-27T20:00:00.000Z',
        outreach_prospects: null,
      },
    ]),
  new_business_messages: [
    { status: 'sent', lead_id: 'a', sent_at: '2026-10-27T13:03:00.000Z' },
    { status: 'failed', lead_id: 'b', error: 'Timeout', created_at: '2026-10-27T14:04:00.000Z' },
    { status: 'failed', lead_id: 'a', error: 'Timeout', created_at: '2026-10-27T12:59:00.000Z' },
  ].map(row => ({ new_business_leads: { name: `LEAD ${row.lead_id.toUpperCase()} LLC` }, ...row })),
  preview_sites: [{ prospect_id: 'p1', sent_at: '2026-10-27T17:05:00.000Z' }],
  new_business_leads: [{ prospect_id: null, email: 'owner@newco.example.com', name: 'NEWCO LLC' }],
}

const db = { from: name => tableOf(tables[name] ?? []) }

check('at five the run sends one recap of the day, replies under their chains', async () => {
  const sent = []
  const counts = { examined: 0, changed: 0 }
  await work(
    { db, counts, now: new Date('2026-10-27T22:00:00.000Z') },
    async (recap, key, envelope) => {
      sent.push({ recap, envelope })
      return 'id'
    }
  )
  same(sent.length, 1, 'one letter')
  same(sent[0].envelope.urgent, false, 'not marked urgent')
  const { recap } = sent[0]
  same(recap.subject, 'Outreach recap for Tuesday, Oct 27: 3 sent, 2 replies', 'subject')
  ok(
    /Draft preview\s+1\s+0\s+0/.test(recap.text),
    "today's preview letter; Monday's is not today's"
  )
  ok(/Introduction\s+0\s+–\s+1/.test(recap.text), 'the reply to an older intro letter')
  ok(/New business\s+1\s+not tracked\s+1/.test(recap.text), 'a new business owner writing in')
  ok(recap.text.includes('(+1 failed') === false, 'the failure note is not in the sent column')
  ok(recap.text.includes('1 failed on a timeout: Lead B'), 'only the failure never put right')
  ok(!recap.text.includes('Bot Co'), 'the auto-reply is left out')
  ok(recap.text.includes('Santa Fe Title Company: “Absolutely no interest. Please stop.”'), 'said')
  same(counts.changed, 1, 'changed')
})

check('outside the five o’clock hour the run sends nothing', async () => {
  const sent = []
  for (const at of ['2026-10-27T23:00:00.000Z', '2026-12-01T22:00:00.000Z']) {
    const answer = await work({ db, counts: {}, now: new Date(at) }, async recap =>
      sent.push(recap)
    )
    ok(answer.note.includes('not five'), `${at} says why`)
  }
  same(sent.length, 0, 'nothing sent')
  same(RECAP_HOUR, 17, 'five in the afternoon')
})

check('in winter the later of the two runs is the one that sends', async () => {
  const sent = []
  await work({ db, counts: {}, now: new Date('2026-12-01T23:00:00.000Z') }, async recap =>
    sent.push(recap)
  )
  same(sent.length, 1, 'one letter at five, standard time')
})

finish({ hint: 'api/outreach/daily-report.js' })
