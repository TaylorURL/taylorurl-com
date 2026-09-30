#!/usr/bin/env node
/**
 * The new-business pipeline's rules, read without the network: how a register
 * row becomes a lead, how a name becomes a domain, how a daily domain list is
 * read and matched, what proves a page is the company's, when a company is
 * looked for, what the email says, and what the mirror row on
 * outreach_prospects is written as.
 */

import { deflateRawSync } from 'node:zlib'
import {
  byLabel,
  daysBetween,
  listUrl,
  matchesFor,
  unzipOne,
} from '../../lib/new-business/domains.js'
import { displayName, leadOf, nameWords, readFrom, slugOf } from '../../lib/new-business/filings.js'
import {
  candidatesFor,
  checkLead,
  nextCheckAt,
  pageIsTheirs,
  phoneIn,
} from '../../lib/new-business/sites.js'
import {
  composeFor,
  paragraphsFor,
  unsubscribeUrlFor,
  whenFormed,
} from '../../lib/new-business/email.js'
import { contactedRow, phoneOnlyRow, PHONE_ONLY_REASON } from '../../lib/new-business/mirror.js'
import { uncallableReason } from '../../lib/outreach/prospects/calls.js'
import { installFixtureHeldDomains } from '../outreach/held-domains-fixture.js'
import { cases, check, finish, ok, same } from '../harness/checks.js'

/** Two values the same when written out, for the lists and records `same` compares by identity. */
const alike = (got, want, what) => same(JSON.stringify(got), JSON.stringify(want), what)

installFixtureHeldDomains()

/** A zip holding one file, the way the daily list is published. */
function zipOf(name, text, method = 8) {
  const raw = Buffer.from(text)
  const data = method === 8 ? deflateRawSync(raw) : raw
  const file = Buffer.from(name)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(8, 6) // sizes follow the data, as a streamed zip writes them
  local.writeUInt16LE(method, 8)
  local.writeUInt16LE(file.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(method, 10)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(raw.length, 24)
  central.writeUInt16LE(file.length, 28)
  central.writeUInt32LE(0, 42)
  const localPart = Buffer.concat([local, file, data])
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(central.length + file.length, 12)
  end.writeUInt32LE(localPart.length, 16)
  return Buffer.concat([localPart, central, file, end])
}

const LEAD = {
  name: "STINKY'S COOKIES, L.L.C.",
  slug: 'stinkyscookies',
  city: 'BAYTOWN',
  state: 'TX',
  zip: '77520',
  formed_on: '2026-09-15',
  candidates: [],
}

check('a register row becomes a lead with its slug', () => {
  const lead = leadOf({
    taxpayer_number: '32100000001',
    taxpayer_name: 'MADE BY CREATORS LLC',
    taxpayer_address: '5900 BALCONES DR STE 100',
    taxpayer_city: 'AUSTIN',
    taxpayer_state: 'TX',
    taxpayer_zip: '78731',
    taxpayer_organizational_type: 'CL',
    sos_charter_date: '2026-09-15T00:00:00.000',
    secretary_of_state_sos_or_coa_file_number: '0805000000',
  })
  same(lead.slug, 'madebycreators', 'slug')
  same(lead.formed_on, '2026-09-15', 'formed on')
  same(lead.state, 'TX', 'state')
  same(leadOf({ taxpayer_name: 'NO NUMBER LLC' }), null, 'a row with no number')
})

check('every company is kept, wherever it is based', () => {
  ok(
    leadOf({ taxpayer_number: '1', taxpayer_name: 'ACME HOLDINGS LLC', taxpayer_state: 'CA' }),
    'a holding company in another state'
  )
})

check('a name loses its legal suffix and punctuation', () => {
  alike(nameWords("STINKY'S COOKIES, L.L.C."), ['stinkys', 'cookies'], 'words')
  same(slugOf('T&J MOBILE RV SERVICE LLC'), 'tjmobilervservice', 'ampersand')
  same(slugOf('ABC LLC'), null, 'too short to be anybody')
})

check('a name reads as a person would write it', () => {
  same(displayName('MADE BY CREATORS LLC'), 'Made by Creators', 'small words')
  same(displayName("STINKY'S COOKIES, L.L.C."), "Stinky's Cookies", 'apostrophe and dotted suffix')
  same(displayName('C4K DIGITAL LLC'), 'C4K Digital', 'initialism with a digit')
  same(displayName('TBL CYBER, INC.'), 'TBL Cyber', 'initialism with no vowel')
})

check('a run reads back past its cursor, and the first reaches three weeks', () => {
  same(readFrom('2026-09-20'), '2026-09-13', 'a week behind the cursor')
  same(readFrom(null, new Date('2026-09-30T12:00:00Z')), '2026-09-09', 'first run')
})

check('the daily list is found at the date written in base64', () => {
  ok(listUrl('2026-09-28').includes('/MjAyNi0wOS0yOC56aXA=/nrd'), listUrl('2026-09-28'))
})

check('a streamed zip is read through its central directory', () => {
  const text = 'jetlino.com\nstinkyscookies.com\n'
  same(unzipOne(zipOf('domain-names.txt', text)), text, 'deflated')
  same(unzipOne(zipOf('domain-names.txt', text, 0)), text, 'stored')
})

check('a list keys registrable names by the label a name runs into', () => {
  const labels = byLabel(
    'stinkyscookies.com\nstinky-scookies.net\nshop.stinkyscookies.com\nfibercanvas.co.uk\nstinkyscookiestx.com\n'
  )
  alike(
    matchesFor('stinkyscookies', labels),
    ['stinkyscookies.com', 'stinky-scookies.net', 'stinkyscookiestx.com'],
    'matches'
  )
  alike(matchesFor('fibercanvas', labels), ['fibercanvas.co.uk'], 'two-part country suffix')
  alike(matchesFor(null, labels), [], 'no slug')
})

check('days run inclusive', () => {
  alike(daysBetween('2026-09-28', '2026-09-30'), ['2026-09-28', '2026-09-29', '2026-09-30'], 'days')
})

check('matched domains are tried before guesses, and a guess is not tried twice', () => {
  const tried = candidatesFor({ ...LEAD, candidates: ['stinkyscookies.com'] })
  alike(tried[0], { domain: 'stinkyscookies.com', matched: true }, 'matched first')
  same(tried.filter(entry => entry.domain === 'stinkyscookies.com').length, 1, 'no second try')
  alike(
    tried.map(entry => entry.domain).slice(1),
    ['stinkyscookies.net', 'stinkyscookies.co'],
    'guesses'
  )
})

const filler = ' '.repeat(10) + 'Fresh cookies baked every morning. '.repeat(10)

check('a matched domain needs the name on the page', () => {
  ok(pageIsTheirs(`<h1>Stinkys Cookies</h1>${filler}`, LEAD, true), 'name on a new domain')
  ok(!pageIsTheirs(`<h1>Cookies</h1>${filler}`, LEAD, true), 'half the name')
  ok(
    !pageIsTheirs(`<h1>Stinkys Cookies</h1> This domain is for sale ${filler}`, LEAD, true),
    'parked'
  )
  ok(!pageIsTheirs('<h1>Stinkys Cookies</h1>', LEAD, true), 'an empty page')
})

check('a guessed domain needs the place as well as the name', () => {
  ok(!pageIsTheirs(`<h1>Stinkys Cookies</h1>${filler}`, LEAD, false), 'name alone')
  ok(pageIsTheirs(`<h1>Stinkys Cookies</h1> Baytown ${filler}`, LEAD, false), 'name and town')
  ok(pageIsTheirs(`<h1>Stinkys Cookies</h1> 77520 ${filler}`, LEAD, false), 'name and zip')
})

check('a phone number is read off a tel link or the page text', () => {
  same(phoneIn('<a href="tel:+12813447144">Call</a>'), '(281) 344-7144', 'tel link')
  same(phoneIn('<p>Call 281.344.7144 today</p>'), '(281) 344-7144', 'printed')
  same(phoneIn('<p>No number</p>'), null, 'none')
  same(phoneIn('<a href="tel:9999999999">Call</a>'), null, 'placeholder')
  same(phoneIn('<a href="tel:2992537785">Call</a>'), null, 'an area code nobody holds')
  same(phoneIn('<a href="tel:7135551234">Call</a>'), null, 'a 555 number')
})

check('a check finds the site, the address on it and the phone', async () => {
  const home = `<html><h1>Stinkys Cookies</h1><a href="mailto:jane@stinkyscookies.example">Email</a><a href="tel:2813447144">Call</a>${filler}</html>`
  const get = async url => {
    if (String(url).startsWith('https://stinkyscookies.example')) {
      return {
        ok: true,
        url: 'https://stinkyscookies.example/',
        text: async () => home,
        headers: new Headers({ 'content-type': 'text/html' }),
      }
    }
    throw new Error('no such host')
  }
  const found = await checkLead({ ...LEAD, candidates: ['stinkyscookies.example'] }, get)
  same(found.website, 'https://stinkyscookies.example/', 'site')
  same(found.found_by, 'new-domain', 'found by')
  same(found.email, 'jane@stinkyscookies.example', 'email')
  same(found.phone, '(281) 344-7144', 'phone')
})

check('a check that finds nothing says so', async () => {
  const found = await checkLead(LEAD, async () => {
    throw new Error('no such host')
  })
  same(found.website, null, 'no site')
  same(found.email, null, 'no email')
})

check('a company is looked for at 1, 3, 6 and 10 weeks, then not again', () => {
  const formed = '2026-09-01'
  same(nextCheckAt(formed, new Date('2026-09-02T00:00:00Z')).slice(0, 10), '2026-09-08', 'week one')
  same(
    nextCheckAt(formed, new Date('2026-09-10T00:00:00Z')).slice(0, 10),
    '2026-09-22',
    'week three'
  )
  same(nextCheckAt(formed, new Date('2026-10-20T00:00:00Z')).slice(0, 10), '2026-11-10', 'week ten')
  same(nextCheckAt(formed, new Date('2026-11-20T00:00:00Z')), null, 'past the last')
})

check('the email says when the company was registered', () => {
  const at = new Date('2026-09-30T15:00:00Z')
  same(whenFormed('2026-09-15', at), 'this month', 'this month')
  same(whenFormed('2026-08-20', at), 'last month', 'last month')
  same(whenFormed('2026-07-20', at), 'in July', 'by name')
})

check('the email names the company and its site, and carries its own way off the list', () => {
  const lead = {
    ...LEAD,
    email: 'Jane@StinkysCookies.example',
    website: 'https://www.stinkyscookies.com/',
    unsub_token: '00000000-0000-4000-8000-000000000001',
  }
  const at = new Date('2026-09-30T15:00:00Z')
  const [opening, , offer] = paragraphsFor(lead, at)
  ok(opening.startsWith("I saw Stinky's Cookies was registered in Texas this month."), opening)
  ok(offer.includes('stinkyscookies.com'), offer)
  const message = composeFor(lead, at)
  same(message.to_address, 'jane@stinkyscookies.example', 'lowercased address')
  ok(message.body_text.includes(unsubscribeUrlFor(lead.unsub_token)), 'unsubscribe in the text')
  ok(message.body_html.includes('/api/new-business/unsubscribe?token='), 'unsubscribe in the html')
  ok(!message.body_html.includes('/api/outreach/open'), 'no tracking pixel')
})

check(
  'a phone-only company lands on the call list, and nothing outreach runs will write to it',
  () => {
    const row = phoneOnlyRow({ ...LEAD, taxpayer_number: '1', phone: '(281) 344-7144' })
    same(uncallableReason(row), null, 'callable')
    same(row.stage, 'unreachable', 'stage')
    same(row.email, null, 'no address')
    same(row.skip_reason, PHONE_ONLY_REASON, 'a reason the retry does not read')
    same(row.town, 'Baytown', 'town as written')
  }
)

check('a company written to is mirrored with nothing due', () => {
  const row = contactedRow(
    { ...LEAD, taxpayer_number: '1', email: 'jane@stinkyscookies.example' },
    '2026-09-30T15:00:00Z'
  )
  same(row.stage, 'contacted', 'stage')
  same(row.next_due_at, null, 'no follow-up')
  same(row.source, 'new-business', 'source')
  same(row.source_ref, '1', 'source ref')
})

await finish()
console.log(`new business: all ${cases.length} cases pass`)
