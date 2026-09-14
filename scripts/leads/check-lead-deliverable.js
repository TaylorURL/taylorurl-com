/**
 * Proves that nothing the console sends reaches an address that cannot receive
 * mail.
 *
 * The failure this is aimed at costs the sending domain. A test address typed
 * into a form is recorded like any other lead, and somebody in the console
 * answers it. At a domain reserved for documentation there is no mailbox and
 * never has been, so the message is a hard bounce on the same domain the
 * newsletter and the outreach pipeline send from - and bounces are what stop
 * real mail arriving. `api/leads-admin.js` refuses the send before it reaches
 * Resend, and this is the predicate that refusal rests on.
 *
 * The predicate is the sort of thing that reads as obviously right and is
 * quietly wrong at the edges - a subdomain of a reserved name, a real domain
 * whose name merely ends in one of them - so every edge is written out.
 *
 *   node scripts/leads/check-lead-deliverable.js
 */

import { deliverable } from '../../lib/leads/record.js'
import { cases, check, finish, same } from '../harness/checks.js'
import { read } from '../harness/files.js'

// Every reserved name, at the second level and as a bare top-level domain,
// plus a subdomain of each - RFC 2606 and RFC 6761 reserve the names and
// everything under them.
const RESERVED = [
  'someone@example.com',
  'someone@example.net',
  'someone@example.org',
  'someone@mail.example.com',
  'someone@deep.mail.example.org',
  'someone@anything.test',
  'someone@anything.invalid',
  'someone@anything.localhost',
  'someone@anything.example',
  'someone@test',
  'someone@invalid',
  'someone@localhost',
  'probe.one@example.com',
  'SOMEONE@EXAMPLE.COM',
  '  someone@example.com  ',
]

// Addresses that merely resemble a reserved name and belong to real people.
// A guard that reads only the tail of a domain refuses all of these, which is
// worse than the hole it was closing: it silently drops paying leads.
const REAL = [
  'trenton@taylorurl.com',
  'someone@notexample.com',
  'someone@example.company',
  'someone@examples.com',
  'someone@my-example.com',
  'someone@contest.co.uk',
  'someone@testing.com',
  'someone@invalidation.org',
  'someone@localhost.com',
  'someone@baytowngokarts.com',
]

check('every reserved domain is refused', () => {
  for (const address of RESERVED) {
    same(deliverable(address), false, `${address} is undeliverable`)
  }
})

check('a real address that merely looks reserved is kept', () => {
  for (const address of REAL) {
    same(deliverable(address), true, `${address} is deliverable`)
  }
})

check('an address that is not usable at all is not deliverable either', () => {
  for (const value of ['', '   ', 'not-an-address', 'a@b', null, undefined, 42, {}, []]) {
    same(deliverable(value), false, `${JSON.stringify(value)} is undeliverable`)
  }
})

check('the console refuses the send rather than discovering it at Resend', () => {
  const endpoint = read('api/leads-admin.js')

  same(
    endpoint.includes('deliverable'),
    true,
    'the endpoint asks whether an address can be reached'
  )

  // The refusal has to stand before the letter is handed over, or the bounce is
  // what answers the question and the domain has already paid for it.
  const before = endpoint.slice(0, endpoint.indexOf('const letter = leadLetter('))
  same(before.includes('!deliverable(address)'), true, 'the guard stands before the letter')
})

await finish()

console.log(
  `lead deliverable: all ${cases.length} cases pass; ${RESERVED.length} reserved addresses are refused before anything is sent and ${REAL.length} real ones that resemble them are kept`
)
