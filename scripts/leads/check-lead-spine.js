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

const ADMIN = 'api/leads-admin.js'
const CONSOLE = 'src/app/views/console/pages/studio/LeadsPage.jsx'

/**
 * Which file writes each door, and the name it passes doing it.
 *
 * Named here rather than discovered, because a door whose write was deleted
 * would simply stop being discovered and the check would pass over it. Every
 * source in `SOURCES` has to appear in this table, which is asserted below, so
 * adding a door to the constant without wiring it fails here.
 */
const DOORS = [
  ['configurator', 'api/start-lead.js', 'SOURCES.configurator'],
  ['payment', 'api/start-lead.js', 'SOURCES.payment'],
  ['contact', 'api/contact.js', 'SOURCES.contact'],
  ['tools', 'api/contact.js', 'SOURCES.tools'],
  ['speed-check', 'api/speed-check.js', 'SOURCES.speedCheck'],
  ['ad', 'api/ad-lead.js', 'SOURCES.ad'],
  ['outreach-reply', 'api/outreach/watch.js', 'SOURCES.outreachReply'],
  ['call', 'api/calls-admin.js', 'SOURCES.call'],
]

check('every door the constant names is one this file accounts for', () => {
  // The point of asserting this rather than deriving the list: a door added to
  // `SOURCES` and never wired writes nothing, and nothing is exactly what a
  // derived list would find and pass over.
  const wired = new Set(DOORS.map(([source]) => source))
  for (const source of Object.values(SOURCES)) {
    same(
      wired.has(source),
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
  for (const source of Object.values(SOURCES)) {
    same(page.includes(`'${source}'`), true, `the console has no name for the "${source}" door`)
  }
})

check('a moment is stamped by whoever watches it happen', () => {
  const watchers = [
    ['api/contact.js', 'enquired'],
    ['api/checkout.js', 'checkout'],
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

await finish()

console.log(
  `lead spine: all ${cases.length} cases pass; ${Object.keys(SOURCES).length} doors write to ${SPINE}, ` +
    `the console reads it, and the studio's own address is not a lead`
)
