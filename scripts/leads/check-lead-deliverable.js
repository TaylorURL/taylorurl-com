/**
 * Proves that the follow-up never writes to an address that cannot receive
 * mail, and never spends a Stripe code finding out.
 *
 * The failure this is aimed at costs money and costs the sending domain. A
 * test address typed into the configurator is recorded like any other lead,
 * and a day later the follow-up cuts a live single-use promotion code against
 * the real coupon and posts a message to it. At a domain reserved for
 * documentation there is no mailbox and never has been, so the message is a
 * hard bounce on the same domain the newsletter and the outreach pipeline send
 * from - and bounces are what stop real mail arriving.
 *
 * The guard is in the selection rather than at send time, and that placement is
 * half of what is being checked here. `chase` reaches Stripe before it reaches
 * the mailbox, so a guard standing there refuses only after a code exists, and
 * a lead returning without a stamp is offered again on the next run: four days
 * of codes and bounces for one address that was never a person.
 *
 * The rest is the predicate itself, which is the sort of thing that reads as
 * obviously right and is quietly wrong at the edges - a subdomain of a reserved
 * name, a real domain whose name merely ends in one of them.
 *
 *   node scripts/leads/check-lead-deliverable.js
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deliverable } from '../../lib/leads/record.js'
import { cases, check, finish, same } from '../harness/checks.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = path => readFileSync(join(HERE, '../..', path), 'utf8')

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

check('the follow-up filters its selection rather than its sending', () => {
  const job = read('api/start-followup.js')

  same(job.includes('deliverable'), true, 'the job asks whether an address can be reached')

  // The predicate has to be applied where the leads are chosen. Between `due`
  // and `chase` is the line the Stripe call sits on, so which side it falls on
  // is the difference between a code that is never cut and one that is cut and
  // wasted.
  const selection = job.slice(
    job.indexOf('async function due'),
    job.indexOf('async function chase')
  )
  same(selection.includes('deliverable'), true, 'the filter is inside the selection')

  // `chase` alone, not everything after it: the handler below reports the
  // skipped count and would otherwise match on its own name.
  const sending = job.slice(
    job.indexOf('async function chase'),
    job.indexOf('export default async function handler')
  )
  same(sending.includes('deliverable'), false, 'and not left to the send, after Stripe')
})

check('a refused address cannot take a real lead’s place in the run', () => {
  const job = read('api/start-followup.js')
  // More rows are read than a run will send, so rows dropped by the filter come
  // out of the surplus rather than out of the ceiling.
  same(job.includes('.limit(PER_RUN * 2)'), true, 'more rows are read than are sent')
  same(job.includes('.slice(0, PER_RUN)'), true, 'and the ceiling is applied after the filter')
})

check('the run reports what it passed over', () => {
  const job = read('api/start-followup.js')
  // A guard nobody can see working is a guard nobody notices has stopped.
  same(job.includes('undeliverable: skipped'), true, 'the count is in the answer')
})

await finish()

console.log(
  `lead deliverable: all ${cases.length} cases pass; ${RESERVED.length} reserved addresses are refused before a code is cut and ${REAL.length} real ones that resemble them are kept`
)
