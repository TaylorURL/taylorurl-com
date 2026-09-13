/**
 * The two things about the site audit that must never quietly change.
 *
 * The address guard is the one that matters. `api/site-audit` fetches whatever
 * a stranger types, so anything naming a machine inside the network the
 * function runs in has to be turned away before a request is built. A guard
 * that stops refusing looks exactly like a guard that is working, which is why
 * the list below is checked rather than trusted.
 *
 * The report is the other. Its whole value is that a site with nothing wrong
 * is told so, and a check that could not be taken is not dressed up as a
 * failure, so the fixtures cover a clean reading and an unreadable one as well
 * as a broken site.
 *
 * Neither half touches the network, so this runs anywhere.
 */
import { target } from '../../api/site-audit.js'
import { enquiryLines, reportFor } from '../../src/app/tools/lib/findings.js'
import { expect as check, finish } from '../harness/checks.js'

// Addresses that must never reach a fetch: the loopback and metadata hosts, the
// ranges that are not routed, the schemes that are not the web, and the
// spellings that exist to slip past a check reading only the obvious form.
const MUST_REFUSE = [
  'localhost',
  'http://localhost:3000',
  'https://127.0.0.1',
  'http://127.0.0.1:8080',
  '10.0.0.1',
  'http://10.1.2.3/admin',
  '172.16.5.4',
  '172.31.255.255',
  '192.168.1.1',
  '169.254.169.254',
  'http://169.254.169.254/latest/meta-data/',
  '100.64.0.1',
  '0.0.0.0',
  '[::1]',
  'http://[::1]:80',
  '[fc00::1]',
  '[fe80::1]',
  'http://[::ffff:127.0.0.1]',
  '224.0.0.1',
  '239.255.255.250',
  'file:///etc/passwd',
  'ftp://example.com',
  'gopher://example.com',
  'javascript:alert(1)',
  'router.local',
  'db.internal',
  'app.localhost',
  'thing.home.arpa',
  'nas.lan',
  'intranet',
  'http://user:pass@example.com',
  'https://example.com.',
  '',
  '   ',
  'not a url at all',
  `https://${'a'.repeat(400)}.com`,
]

const MUST_ALLOW = [
  'example.com',
  'https://www.taylorurl.com',
  'http://example.org/path?q=1',
  'sub.domain.co.uk',
  '8.8.8.8',
  'https://1.1.1.1',
]

// A reading with nothing wrong with it. The report over this must be all
// passes: one invented failure here and the tool is worth less than nothing.
const CLEAN = {
  site: { requested: 'https://example.com', host: 'example.com', https: true },
  mobile: {
    scores: { performance: 98, accessibility: 100, bestPractices: 100, seo: 100 },
    lab: { lcpMs: 1200, fcpMs: 800, tbtMs: 20, siMs: 900, cls: 0.01 },
    checks: { viewport: true, viewportSized: true, renderBlocking: true, https: true },
    imageBytes: 4096,
    field: { lcpMs: 1800, inpMs: 120, cls: 0.02 },
  },
  desktop: null,
  page: {
    title: { text: 'x', length: 40 },
    description: { text: 'x', length: 120 },
    h1Count: 1,
    imageCount: 3,
    imagesWithAlt: 3,
    ogImage: true,
    canonical: true,
    schemaTypes: ['HairSalon', 'PostalAddress'],
    schemaCarries: { address: true, telephone: true, hours: true, geo: false },
  },
  robots: { present: true, sitemapNamed: true },
  sitemap: { present: true },
  hosts: { bare: 'example.com', www: 'example.com', agree: true, reachable: true },
}

// The same site with each of the headline problems the report exists to name.
const BROKEN = {
  ...CLEAN,
  site: { requested: 'http://example.com', host: 'example.com', https: false },
  mobile: {
    ...CLEAN.mobile,
    checks: { viewport: false, viewportSized: false, renderBlocking: false, https: false },
    imageBytes: 900_000,
    field: { lcpMs: 6200, inpMs: 400, cls: 0.3 },
  },
  page: {
    title: null,
    description: null,
    h1Count: 0,
    imageCount: 4,
    imagesWithAlt: 0,
    ogImage: false,
    canonical: false,
    schemaTypes: [],
    schemaCarries: { address: false, telephone: false, hours: false, geo: false },
  },
  robots: { present: false, sitemapNamed: false },
  sitemap: { present: false },
  hosts: { bare: 'example.com', www: 'www.example.com', agree: false, reachable: true },
}

// A site Google answered for but whose own page never arrived.
const UNREADABLE = { ...CLEAN, page: null, hosts: { reachable: false } }

for (const address of MUST_REFUSE) {
  const answer = target(address)
  check(Boolean(answer.fault), `guard let through ${JSON.stringify(address)}`)
}
for (const address of MUST_ALLOW) {
  const answer = target(address)
  check(Boolean(answer.url), `guard refused the public address ${JSON.stringify(address)}`)
}

const clean = reportFor(CLEAN)
check(clean.counts.fail === 0, `clean reading reported ${clean.counts.fail} failures`)
check(clean.counts.warn === 0, `clean reading reported ${clean.counts.warn} warnings`)
check(clean.counts.unknown === 0, `clean reading reported ${clean.counts.unknown} unread`)
check(enquiryLines(clean).length === 0, 'clean reading put something in the enquiry')

const broken = reportFor(BROKEN)
check(broken.counts.fail >= 6, `broken reading reported only ${broken.counts.fail} failures`)
check(broken.findings[0].state === 'fail', 'broken reading did not open on a failure')
check(
  broken.findings[0].id === 'loading',
  `broken reading opened on ${broken.findings[0].id} rather than the slowest thing`
)
check(
  enquiryLines(broken).length === broken.counts.fail + broken.counts.warn,
  'enquiry dropped a finding'
)

const unreadable = reportFor(UNREADABLE)
check(unreadable.counts.unknown > 0, 'an unreadable page reported nothing as unread')
check(
  unreadable.findings.every(finding => finding.state !== 'fail' || finding.id === 'https'),
  'an unreadable page was reported as failing rather than unread'
)

// Every finding names a service page that exists.
const PAGES = new Set(['/services/seo', '/services/redesign', '/services/care'])
for (const finding of [...clean.findings, ...broken.findings]) {
  check(PAGES.has(finding.fixes), `${finding.id} points at ${finding.fixes}`)
}

await finish()
console.log(
  `site-audit: ${MUST_REFUSE.length} addresses refused, ${MUST_ALLOW.length} allowed, report honest on clean, broken and unreadable readings`
)
