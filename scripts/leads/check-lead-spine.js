/**
 * Proves that every door the studio takes a lead through writes it somewhere a
 * person will look.
 *
 * This is the failure the check exists for, and it is the quietest one the site
 * can have. A door that records nothing still works perfectly. The contact form
 * still sends its message, the speed check still returns its reading, the ad
 * still fires. Nobody meets an error and no figure goes red. The only sign is
 * an absence - a lead who was never in the console to be missed - and an
 * absence is exactly what nobody notices.
 *
 * It went unnoticed for months. Seven of the eight doors kept their own record
 * or none, the console drew the one that did, and the leads that mattered most
 * were worked out of an inbox until somebody thought to look. A consultant with
 * an expired payment link and four people who filled in an ad form sat for days
 * with the section built to show them showing nothing.
 *
 * So the rule is read here rather than trusted: every door named in `SOURCES`
 * is written by something, and the console reads the table they all write to.
 * A new door added without a write is a lead that vanishes, and the point of
 * this file is that it costs a failing check rather than a customer.
 *
 *   npm run check:lead-spine
 */

import { MOMENTS, SOURCES, SPINE, ownAddress, phoneDigits } from '../../lib/leads/spine.js'
import { callMakesLead } from '../../lib/outreach/prospects/calls.js'
import { cases, check, finish, same } from '../harness/checks.js'
import { read } from '../harness/files.js'
import { bounceReport, inbound } from '../outreach/inbound-fixture.js'

const ADMIN = 'api/leads-admin.js'
const CONSOLE = 'src/app/views/console/pages/inbox/InboxPage.jsx'

// The watcher reads its mailbox credentials as it loads. A run here reads a
// list rather than a mailbox and hands no notice over, so the key is empty.
process.env.OUTREACH_SMTP_USER = 'studio@example.com'
process.env.OUTREACH_SMTP_PASSWORD = 'not-a-password'
process.env.RESEND_API_KEY = ''
const { work: watch } = await import('../../api/outreach/watch.js')

/**
 * Which file writes each door, and the name it passes doing it.
 *
 * Named here rather than discovered, because a door whose write was deleted
 * would simply stop being discovered and the check would pass over it. Every
 * source in `SOURCES` has to appear in this table, which is asserted below, so
 * adding a door to the constant without wiring it fails here.
 */
const DOORS = [
  ['contact', 'api/contact.js', 'SOURCES.contact'],
  ['tools', 'api/contact.js', 'SOURCES.tools'],
  ['speed-check', 'api/speed-check.js', 'SOURCES.speedCheck'],
  ['ad', 'api/ad-lead.js', 'SOURCES.ad'],
  ['outreach-reply', 'api/outreach/watch.js', 'SOURCES.outreachReply'],
  ['call', 'api/calls-admin.js', 'SOURCES.call'],
]

/**
 * The sources no door writes any more, which the console still has to name.
 *
 * The column's check constraint holds every spelling a row was ever written
 * with, and the rows written under these two are still in the table and still
 * worked. A source dropped from `SOURCES` would be a filter the console cannot
 * offer and a lead nobody can find, so they stay named and stay unwritten.
 */
const CLOSED = new Set(['configurator', 'payment'])

check('every door the constant names is one this file accounts for', () => {
  // The point of asserting this rather than deriving the list: a door added to
  // `SOURCES` and never wired writes nothing, and nothing is exactly what a
  // derived list would find and pass over.
  const wired = new Set(DOORS.map(([source]) => source))
  for (const source of Object.values(SOURCES)) {
    same(
      wired.has(source) || CLOSED.has(source),
      true,
      `the door "${source}" is named in SOURCES but nothing here writes it`
    )
  }
})

for (const [source, file, constant] of DOORS) {
  check(`the ${source} door writes a lead`, () => {
    const text = read(file)
    same(text.includes('keepLead'), true, `${file} does not call keepLead`)
    same(text.includes(constant), true, `${file} does not name ${constant}`)
  })
}

check('the console reads the table every door writes to', () => {
  const admin = read(ADMIN)
  same(admin.includes("from '../lib/leads/spine.js'"), true, `${ADMIN} does not read the spine`)
  same(admin.includes(`.from(SPINE)`), true, `${ADMIN} does not select from the spine`)
  same(SPINE, 'leads', 'the spine is the leads table')
})

check('the console names every door it can be shown', () => {
  const page = read(CONSOLE)
  // Calls are logged by whoever made them and are the Call List's; the
  // endpoint keeps them out of the Inbox, so the Inbox has nothing to name.
  const shown = Object.values(SOURCES).filter(source => source !== SOURCES.call)
  for (const source of shown) {
    same(page.includes(`'${source}'`), true, `the console has no name for the "${source}" door`)
  }
})

/**
 * One pass of the inbox watcher over `messages`, against a database that
 * answers every read with the one prospect written to and records what was
 * asked of it. Whether `lead_record` was called is whether the message became
 * a row in the Inbox.
 */
async function watched(messages) {
  const prospect = {
    id: '6b7b58ea-441a-4d2d-874a-8783944f26b1',
    email: 'owner@example.com',
    name: 'Baytown Plumbing',
    website: 'https://baytownplumbing.com',
    stage: 'contacted',
    replied_at: null,
  }
  const asked = []
  const from = table => {
    const state = { op: 'select' }
    const chain = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === 'then') {
            asked.push(`${state.op}:${table}`)
            const answer =
              state.op === 'select' && table === 'outreach_prospects'
                ? { data: [prospect], error: null }
                : { data: [], error: null, count: 0 }
            return (resolve, reject) => Promise.resolve(answer).then(resolve, reject)
          }
          return () => {
            if (state.op === 'select' && ['insert', 'update', 'upsert', 'delete'].includes(prop)) {
              state.op = prop
            }
            return chain
          }
        },
      }
    )
    return chain
  }
  const rpc = name => {
    asked.push(`rpc:${name}`)
    return Promise.resolve({ data: { ok: true, lead_id: 'l1', fresh: true }, error: null })
  }
  await watch({
    db: { from, rpc },
    counts: { examined: 0, changed: 0 },
    read: async () => messages,
  })
  return asked.includes('rpc:lead_record')
}

/** A message under a subject of its own, from the prospect written to. */
const under = (subject, body) =>
  inbound(body, {
    envelope: {
      messageId: '<reply-1@example.com>',
      subject,
      from: [{ address: 'owner@example.com' }],
      to: [{ address: 'studio@example.com' }],
      date: '2026-08-29T15:00:00.000Z',
    },
  })

check('a person writing back to a letter is a row in the Inbox', async () => {
  // Cold letters, new-business letters and preview letters all reach this the
  // same way: the watcher matches the reply to the prospect the letter went to
  // and files it through the outreach-reply door.
  same(await watched([inbound('Hello. I am in Fort Worth.')]), true, 'a person did not reach it')
})

check('a machine, an opt-out and a bounce never reach the Inbox', async () => {
  // The Inbox draws the spine and nothing else, so what the watcher keeps out
  // of the spine is what keeps them off the Inbox.
  same(
    await watched([under('Automatic reply: your website', 'I am out of the office until Monday.')]),
    false,
    'an out of office reached it'
  )
  same(
    await watched([
      under(
        'Your site scores 31 out of 100 on mobile',
        'Thank you for choosing Kindred Pest Control!'
      ),
    ]),
    false,
    'an auto-responder reached it'
  )
  same(await watched([inbound('Please remove me from your list.')]), false, 'an opt-out reached it')
  same(await watched([bounceReport()]), false, 'a bounce reached it')
})

check('the Inbox reads only the doors the spine names, and its replies from one', () => {
  const page = read(CONSOLE)
  same(
    page.includes(`const REPLY_DOOR = '${SOURCES.outreachReply}'`),
    true,
    'the Inbox does not split its replies from its enquiries on the outreach-reply door'
  )
})

check('a moment is stamped by whoever watches it happen', () => {
  const watchers = [
    ['api/contact.js', 'enquired'],
    ['api/stripe-webhook.js', 'bought'],
  ]
  for (const [file, moment] of watchers) {
    const text = read(file)
    same(Boolean(MOMENTS[moment]), true, `"${moment}" is not a moment a lead can reach`)
    same(text.includes(`markSpineLead('${moment}'`), true, `${file} does not stamp ${moment}`)
  }
})

check('the studio does not appear in its own lead list', () => {
  // Somebody typing their own address into their own form is testing it, and a
  // list that is mostly the person reading it is a list that stops being read.
  same(ownAddress('someone@taylorurl.com'), true, 'the studio address is the studio')
  same(ownAddress('someone@baytownwebdevelopment.com'), true, 'the sending domain is the studio')
  same(ownAddress('mail.taylorurl.com'), false, 'a domain without an address is not one')
  same(ownAddress('someone@example.com'), false, 'a stranger is not the studio')
  // The dot in front of the domain is what stops this being ours. Without it
  // any name ending in our own would read as the studio, and the studio would
  // stop seeing leads at every one of them.
  same(ownAddress('someone@taylorurl.com.example'), false, 'a domain that merely ends alike')
})

check('the call door only writes the calls that reached somebody', () => {
  // The door that is not a form. Seven of the eight are somebody filling
  // something in, so arriving at all is the whole of the qualification; the
  // eighth is a caller working eight thousand cold names, where a number that
  // rang out is not a lead and the caller's own no is what takes a business
  // back out of the list.
  const text = read('api/calls-admin.js')
  same(
    text.includes('callMakesLead('),
    true,
    'the call door writes a lead without reading the rule'
  )
  const gate = text.indexOf('callMakesLead(')
  const write = text.indexOf('source: SOURCES.call')
  same(gate < write, true, 'the call door writes the lead before it reads the rule')
  // The rule is one function in one place, so the console and the endpoint
  // cannot come to two answers about the same call. All three ways a
  // conversation comes back are read here, because the middle one - the caller
  // who never got to ask - is the one a yes-only gate loses.
  same(
    callMakesLead('spoke', true) && callMakesLead('spoke') && !callMakesLead('spoke', false),
    true,
    'the rule the call door reads does not read all three ways a call comes back'
  )
})

check('one person written two ways is one lead', () => {
  // The whole of the phone dedupe. A caller reads a number off a screen and an
  // ad platform hands over an E.164 string, and the two have to land on one row
  // or a callback opens a second lead beside the one it was answering.
  same(phoneDigits('+18327755485'), '8327755485', 'an E.164 number')
  same(phoneDigits('(832) 775-5485'), '8327755485', 'the same number as a person writes it')
  same(phoneDigits('832-775-5485'), '8327755485', 'the same number with dashes')
  same(phoneDigits('5485'), null, 'too few digits to be a number')
  same(phoneDigits(null), null, 'nothing is not a number')
})

// -- The Inbox holds people, and what they wrote ------------------------------

const { enquiryText, inInbox, ownWords } = await import('../../api/leads-admin.js')
const { isAutomated } = await import('../../lib/outreach/daily-report.js')

// Each shaped on a reply the live mailbox has actually held, with the names
// changed. The watcher let every one of the machines through as a person.
const MACHINES = [
  {
    subject: 'Re: Trenton Taylor - TaylorURL',
    body:
      "You have reached Example Pest Control after hours!\r\n\r\nWe've received your email and " +
      "we'll be back in the office during our normal\r\nbusiness hours from Monday through Friday.",
  },
  {
    subject: 'Re: Trenton Taylor, TaylorURL',
    body:
      'Thanks so much for reaching out. We have received your email and will get back to you as ' +
      'soon as possible. During business hours, that is usually within a couple of hours.',
  },
  {
    subject: 'Re:',
    body:
      '##- Please type your reply above this line -##\r\n\r\nThanks for reaching out to us for ' +
      'some help. Someone will be in touch with you soon.\r\n\r\nHere is a summary of your request #3201820:',
  },
  {
    subject: 'Example Pest Control scores 39 out of 100 on mobile',
    body: 'Example Pest Control\r\n\r\nThank you for choosing Example Pest Control!\r\n\r\n(555) 010-0000',
  },
]
const PERSON = {
  subject: 'Re: Trenton Taylor, TaylorURL',
  body:
    'Absolutely no interest. Please stop.\r\n\r\nGet Outlook for iOS<https://aka.ms/o0ukef>\r\n' +
    '________________________________\r\nFrom: TaylorURL LLC <studio@example.com>\r\n' +
    'Sent: Friday, 09 October 2026 06:22:12\r\nSubject: Re: Trenton Taylor, TaylorURL\r\n\r\nGood morning,',
}

check('an automated reply is never read as somebody writing', () => {
  for (const reply of MACHINES) {
    same(isAutomated({ intent: null, ...reply }), true, `"${reply.body.slice(0, 40)}" is a machine`)
  }
  same(isAutomated({ intent: null, ...PERSON }), false, 'a person telling us to stop is a person')
})

check('the Inbox shows what a person typed, without the letter they quoted', () => {
  same(ownWords(PERSON.body), 'Absolutely no interest. Please stop.', 'their own words')
  same(ownWords(''), null, 'nothing typed is nothing to show')
})

check('an enquiry with no note shows the answers it gave', () => {
  const brief = [
    { label: 'Business Type', value: 'Electrical' },
    { label: 'How It Should Feel', value: 'Not chosen' },
    { label: 'Sites to Look At', value: 'None given' },
    { label: 'Tools in Use', value: 'None checked' },
  ]
  same(enquiryText({ note: null, brief }), 'Business Type: Electrical', 'the answered question')
  same(enquiryText({ note: 'Need a site', brief }), 'Need a site', 'a note comes first')
  same(enquiryText({ note: null, brief: [brief[1]] }), null, 'nothing answered is nothing to show')
})

check('only people who wrote are in the Inbox', () => {
  const reply = id => ({ source: SOURCES.outreachReply, source_ref: id, note: 'excerpt' })
  const A = '00000000-0000-4000-8000-00000000000a'
  const B = '00000000-0000-4000-8000-00000000000b'
  const C = '00000000-0000-4000-8000-00000000000c'
  const words = { said: new Map([[A, { text: 'Hello' }]]), heard: new Set([A, B]) }
  same(inInbox(reply(A), words), true, 'a reply a person wrote')
  same(inInbox(reply(B), words), false, 'a business only a machine answered for')
  same(
    inInbox({ ...reply(C), note: MACHINES[1].body }, words),
    false,
    'an old reply with no mail on file, whose excerpt is a receipt'
  )
  same(
    inInbox({ ...reply(C), note: 'Call me Tuesday' }, words),
    true,
    'an old reply a person wrote'
  )
  same(inInbox({ source: SOURCES.contact, note: 'Need a site' }, words), true, 'a contact form')
  same(inInbox({ source: SOURCES.call, note: 'Left a voicemail' }, words), false, 'a call log')
})

await finish()

console.log(
  `lead spine: all ${cases.length} cases pass; ${DOORS.length} doors write to ${SPINE}, ` +
    `the console reads it, and the studio's own address is not a lead`
)
