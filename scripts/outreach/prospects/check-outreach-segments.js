/**
 * Proves that every prospect the table can hold reads as exactly one segment,
 * and that the reading agrees with the two readings it is built from.
 *
 * The segment is the word the message picker and the console both key on, and
 * it is worked out rather than stored, so the failure it can have is silent: a
 * shape of row that answers with a word nothing recognises, or with one word on
 * the page and another in the sender. Neither throws. The case that matters
 * most is a business with no site of its own that carries a score anyway,
 * because a score taken on a platform page is a fact about the platform, and
 * that business has to read as having no site whatever number sits beside it.
 *
 *   npm run check:outreach-segments
 */
import { SEGMENTS, segmentOf } from '../../../lib/outreach/segments.js'
import { hasNoSiteOfItsOwn, opportunityBand } from '../../../src/app/utils/outreachOpportunity.js'

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: got ${got}, wanted ${want}`)
}

const ok = (condition, what) => {
  if (!condition) throw new Error(what)
}

/** A row the way the table and the send queue both carry one. */
const row = over => ({
  id: 'p1',
  name: 'Baytown Plumbing',
  website: 'https://baytownplumbing.com',
  site_kind: 'own',
  audit_score: null,
  ...over,
})

// ── The five words ───────────────────────────────────────────────────────

check('the segments are five distinct words, named once', () => {
  same(SEGMENTS.length, 5, 'segments')
  same(new Set(SEGMENTS).size, SEGMENTS.length, 'distinct segments')
  ok(Object.isFrozen(SEGMENTS), 'the list can be added to at runtime')
  for (const segment of SEGMENTS) {
    ok(typeof segment === 'string' && segment.length, `a segment that is not a word: ${segment}`)
  }
})

// ── A site of the business's own, read by its score ──────────────────────

for (const [score, want] of [
  [0, 'slow-site'],
  [1, 'slow-site'],
  [49, 'slow-site'],
  [50, 'fair-site'],
  [70, 'fair-site'],
  [89, 'fair-site'],
  [90, 'sound-site'],
  [100, 'sound-site'],
]) {
  check(`a site scoring ${score} is ${want}`, () => {
    same(segmentOf(row({ audit_score: score })), want, `the segment at ${score}`)
  })
}

check('a score arriving as text is read as the number it holds', () => {
  same(segmentOf(row({ audit_score: '45' })), 'slow-site', 'the segment')
  same(segmentOf(row({ audit_score: '92' })), 'sound-site', 'the segment')
})

check('a score off the scale is held to the scale', () => {
  same(segmentOf(row({ audit_score: -5 })), 'slow-site', 'a score under zero')
  same(segmentOf(row({ audit_score: 150 })), 'sound-site', 'a score over a hundred')
})

check('a site nothing has measured is unmeasured', () => {
  same(segmentOf(row({ audit_score: null })), 'unmeasured', 'null')
  same(segmentOf(row({ audit_score: undefined })), 'unmeasured', 'undefined')
  same(segmentOf(row({ audit_score: '' })), 'unmeasured', 'empty')
  same(segmentOf(row({ audit_score: 'no reading' })), 'unmeasured', 'text')
})

check('a listing with no website at all is no-site rather than unmeasured', () => {
  // The enricher looked for a site under every name this business would have
  // registered one under and found none, which is the strongest thing the
  // table can say about a lead. Reading it as unmeasured files the whole pitch
  // as a row nobody has got round to yet.
  same(segmentOf(row({ website: null, site_kind: 'none' })), 'no-site', 'nothing listed')
  same(
    segmentOf(row({ website: null, site_kind: 'none', audit_score: 88 })),
    'no-site',
    'a figure left on the row from a site it used to have'
  )
})

check('a row nobody has read yet is not filed as a business with no site', () => {
  // The kind is the job's verdict, and an empty column is the absence of one.
  // Reading it as a finding would put every listing waiting on its first read
  // at the front of the queue as the strongest lead on the table.
  same(segmentOf(row({ website: null, site_kind: null })), 'unmeasured', 'no kind, no site')
  same(segmentOf(row({ website: null, site_kind: undefined })), 'unmeasured', 'an absent kind')
})

check('a row nothing is known about is unmeasured rather than an error', () => {
  same(segmentOf({}), 'unmeasured', 'an empty row')
  same(segmentOf(null), 'unmeasured', 'no row')
  same(segmentOf(undefined), 'unmeasured', 'an absent row')
})

// ── No site of its own wins over any score ───────────────────────────────

for (const score of [null, 0, 30, 49, 50, 89, 90, 100, '15']) {
  check(`a platform profile scoring ${score} is still no-site`, () => {
    const prospect = row({
      website: 'https://www.facebook.com/baytownplumbing',
      site_kind: 'social',
      audit_score: score,
    })
    same(segmentOf(prospect), 'no-site', 'the segment')
  })
}

check('a row written before site_kind existed is read by the host it listed', () => {
  same(
    segmentOf(
      row({ site_kind: null, website: 'https://m.facebook.com/somebody', audit_score: 20 })
    ),
    'no-site',
    'a platform host'
  )
  same(
    segmentOf(row({ site_kind: null, website: 'https://baytownplumbing.com', audit_score: 20 })),
    'slow-site',
    'a host of its own'
  )
})

check('site_kind answers ahead of the host where both are present', () => {
  // The enrichment job's own reading of the listing is what the column holds,
  // and it outranks a second reading of the address taken here.
  same(
    segmentOf(row({ site_kind: 'own', website: 'https://www.facebook.com/x', audit_score: 20 })),
    'slow-site',
    'own, at a platform host'
  )
  same(
    segmentOf(
      row({ site_kind: 'social', website: 'https://baytownplumbing.com', audit_score: 20 })
    ),
    'no-site',
    'social, at its own host'
  )
})

// ── One answer, over every shape a row can take ──────────────────────────

/** The segment the two readings say a row is in, worked out the long way. */
const BY_BAND = { strong: 'slow-site', fair: 'fair-site', weak: 'sound-site', none: 'unmeasured' }
const expected = prospect =>
  hasNoSiteOfItsOwn(prospect) ? 'no-site' : BY_BAND[opportunityBand(prospect)]

check('every shape of row reads as exactly one of the five, and as the two readings agree', () => {
  const kinds = [undefined, null, 'own', 'social', 'none']
  const sites = [
    undefined,
    null,
    '',
    'https://baytownplumbing.com',
    'baytownplumbing.com/contact',
    'https://www.facebook.com/baytownplumbing',
    'https://linktr.ee/somebody',
    'not a website',
  ]
  const scores = [undefined, null, '', 0, 1, 49, 50, 89, 90, 100, -1, 101, '45', 'x', NaN]

  const reached = new Set()
  let shapes = 0
  for (const site_kind of kinds) {
    for (const website of sites) {
      for (const audit_score of scores) {
        const prospect = { site_kind, website, audit_score }
        const got = segmentOf(prospect)
        shapes += 1
        ok(SEGMENTS.includes(got), `${JSON.stringify(prospect)} read as ${got}`)
        same(got, expected(prospect), `the segment of ${JSON.stringify(prospect)}`)
        reached.add(got)
      }
    }
  }

  ok(shapes > 500, `only ${shapes} shapes were walked`)
  for (const segment of SEGMENTS) {
    ok(reached.has(segment), `no shape of row reads as ${segment}`)
  }
})

// ── Run them ────────────────────────────────────────────────────────────

const failures = []
for (const [name, run] of cases) {
  try {
    await run()
  } catch (cause) {
    failures.push(`${name}: ${cause.message}`)
  }
}

if (failures.length) {
  for (const failure of failures) console.error(failure)
  console.error(`\n${failures.length} of ${cases.length} outreach segment checks failed`)
  process.exit(1)
}

console.log(`outreach segments: ${cases.length} checks passed`)
