/**
 * Holds the scanner check a preview view passes before it is counted.
 *
 * A mail provider opening the link in a letter looks, to the page, exactly like
 * a reader: a real Chrome, on screen for as long as the page waits. Salazar Law
 * Firm's preview was "viewed" eight seconds after its letter went, from Google's
 * network in Los Angeles. What tells the two apart is the network, so the
 * address lookup and the verdict on it are what this holds - against answers
 * shaped like the resolver's, with no network of its own.
 *
 *   node scripts/outreach/previews/check-preview-view.js
 */

import { cases, check, finish, ok, same } from '../../harness/checks.js'

const { originName, networkOf, scannerOf, automatedAgent, judgeVisit } =
  await import('../../../lib/outreach/scanners.js')
const { cleanView } = await import('../../../api/preview-view.js')

/** A resolver that knows the records in `table`, by name. */
const resolver = table => async url => {
  const name = new URL(url).searchParams.get('name')
  const data = table[name]
  return {
    ok: true,
    json: async () => (data ? { Answer: [{ name, type: 16, data: `"${data}"` }] } : { Status: 3 }),
  }
}

const SALAZAR = {
  '10.138.22.136.origin.asn.cymru.com': '36040 | 136.22.138.0/24 | US | arin | 2017-08-29',
  'AS36040.asn.cymru.com': '36040 | US | arin | 2005-08-03 | YOUTUBE - Google LLC, US',
}

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'

check('an IPv4 address is asked for under its reversed name', () => {
  same(originName('136.22.138.10'), '10.138.22.136.origin.asn.cymru.com', 'v4 name')
  same(originName('::ffff:136.22.138.10'), '10.138.22.136.origin.asn.cymru.com', 'mapped v4')
  same(originName('300.1.1.1'), null, 'not an address')
})

check('an IPv6 address is asked for nibble by nibble, its gap filled', () => {
  const name = originName('2605:59c8:478a:5c08:1d39:66e7:e49e:fa0f')
  ok(name.endsWith('.origin6.asn.cymru.com'), 'v6 zone')
  same(name.split('.').length, 32 + 4, 'thirty-two nibbles')
  same(name.slice(0, 8), 'f.0.a.f.', 'last group first')
  same(originName('2001:db8::1').startsWith('1.0.0.0.0.0.0.0.'), true, 'gap filled with zeros')
  same(originName('not-an-address'), null, 'nonsense')
})

check("the Salazar visit's network is Google's, and a scanner's", async () => {
  const network = await networkOf('136.22.138.10', resolver(SALAZAR))
  same(network.asn, 36040, 'AS number')
  same(network.owner, 'YOUTUBE - Google LLC, US', 'owner')
  ok(scannerOf(network), 'Google was not taken for a scanner')
})

check('a home or phone network is not a scanner', () => {
  same(scannerOf({ asn: 7922, owner: 'COMCAST-7922, US' }), null, 'Comcast')
  same(scannerOf({ asn: 21928, owner: 'T-MOBILE-AS21928, US' }), null, 'T-Mobile')
  same(scannerOf({ asn: 16591, owner: 'GOOGLE-FIBER, US' }), null, 'Google Fiber is a home ISP')
  same(scannerOf(null), null, 'no lookup')
})

check('a security vendor is a scanner by name when its number is not listed', () => {
  ok(scannerOf({ asn: 999999, owner: 'PROOFPOINT-ASN-US-WEST, US' }), 'Proofpoint')
  ok(scannerOf({ asn: 999998, owner: 'MIMECAST, GB' }), 'Mimecast')
  ok(scannerOf({ asn: 8075, owner: null }), 'Microsoft by number')
})

check('a lookup that fails leaves the visit to its agent and timing', async () => {
  const failing = async () => {
    throw new Error('offline')
  }
  const visit = await judgeVisit('136.22.138.10', CHROME, failing)
  same(visit.scanner, null, 'no scanner without an answer')
  same(visit.asn, null, 'no number')
  same(visit.automated, false, 'Chrome is a browser')
})

check('an agent that names itself is automated, and a browser is not', () => {
  ok(
    automatedAgent('Mozilla/5.0 ... Chrome/136.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse'),
    'Lighthouse'
  )
  ok(automatedAgent(''), 'no agent at all')
  ok(automatedAgent('python-requests/2.31'), 'a script')
  same(automatedAgent(CHROME), false, 'Chrome')
})

check('the view endpoint takes a slug and a template and nothing else', () => {
  same(
    JSON.stringify(cleanView({ slug: 'thesalazarlawfirm', template: 'professional', x: 1 })),
    '{"slug":"thesalazarlawfirm","template":"professional"}',
    'only the two fields'
  )
  same(cleanView({ slug: 'Bad Slug', template: 'professional' }), null, 'bad slug')
  same(cleanView(null), null, 'no body')
})

await finish()

console.log(`preview view: ${cases.length} checks passed`)
