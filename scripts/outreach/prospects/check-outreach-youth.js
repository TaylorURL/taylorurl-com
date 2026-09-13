/**
 * Proves the send queue's rank axis orders the leads the way it says it does,
 * and that a listing nobody has read is never mistaken for a listing with no
 * reviews.
 *
 * The rank is a number nothing stores and nothing displays. It exists for the
 * length of one sort and is gone, so an axis that puts the wrong row first
 * fails without leaving a mark: the queue is full, the send job runs, every
 * message goes out, and the only thing that changed is which businesses were
 * written to first. Nobody can see that from outside, and there is no column to
 * go back and check it against afterwards.
 *
 * The reading the axis leans on hardest is the review count, and the shape of
 * row the pipeline holds most of is the one where that count was never asked
 * for. Roughly a third of the table carries null for both `rating_count` and
 * `business_status`, because the sweep that wrote those rows did not request
 * the fields. Reading a null as zero reviews would take every row the pipeline
 * knows least about and promote it ahead of every measured site, and the
 * failure would look exactly like the ranking working - a queue filling with
 * confident young leads, every one of them a row nobody has read. That is the
 * case this file spends most of its assertions on.
 *
 *   npm run check:outreach-youth
 */
import {
  ASKED_RANK,
  ASKED_SOURCE,
  DEFAULT_RANK,
  SOCIAL_RANK,
  YOUNG_RANK,
  rankOf,
  ranksAhead,
} from '../../../lib/outreach/sending/rank.js'
import {
  YOUNG_REVIEW_CEILING,
  YOUTHS,
  isOperating,
  isYoung,
  youthOf,
} from '../../../lib/outreach/prospects/youth.js'

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
  source: 'places',
  audit_score: null,
  rating_count: 64,
  business_status: 'OPERATIONAL',
  ...over,
})

// ── The ladder ───────────────────────────────────────────────────────────

check('the four ranks are distinct and the ladder is strictly ordered', () => {
  const ladder = [ASKED_RANK, YOUNG_RANK, SOCIAL_RANK, DEFAULT_RANK]
  same(new Set(ladder).size, ladder.length, 'distinct ranks')
  for (const rank of ladder) {
    ok(Number.isInteger(rank), `a rank that is not a whole number: ${rank}`)
  }
  ok(ASKED_RANK < YOUNG_RANK, 'a business that asked does not beat a young listing')
  ok(YOUNG_RANK < SOCIAL_RANK, 'a young listing does not beat a business with no site')
  ok(SOCIAL_RANK < 0, 'a business with no site does not beat the best possible score')
  ok(DEFAULT_RANK > 100, 'an unmeasured row would sort among the sites somebody measured')
})

check('every scored site sits between the ranks that beat it and the one that does not', () => {
  // The scored band is the axis's middle, and the three negative rungs exist
  // only because they are outside it. A score landing on one of them would be a
  // measured site sorting as though it were something else entirely.
  for (const score of [0, 1, 37, 50, 89, 90, 99, 100]) {
    const rank = rankOf(row({ audit_score: score }))
    same(rank, score, `the rank of a site scoring ${score}`)
    ok(rank > SOCIAL_RANK, `a site scoring ${score} beat a business with no site`)
    ok(rank < DEFAULT_RANK, `a site scoring ${score} sorted behind an unmeasured row`)
  }
})

check('a row nothing has measured sorts past the end of the scale', () => {
  same(rankOf(row({ audit_score: null })), DEFAULT_RANK, 'null')
  same(rankOf(row({ audit_score: undefined })), DEFAULT_RANK, 'undefined')
  same(rankOf(row({ audit_score: '' })), DEFAULT_RANK, 'empty')
  same(rankOf(row({ audit_score: 'no reading' })), DEFAULT_RANK, 'text')
})

check('a row nothing is known about ranks last rather than throwing', () => {
  same(rankOf(null), DEFAULT_RANK, 'no row')
  same(rankOf(undefined), DEFAULT_RANK, 'an absent row')
  same(rankOf({}), DEFAULT_RANK, 'an empty row')
})

check('ranksAhead is true for exactly the negative ranks', () => {
  // The candidate read uses this to decide which rows must survive a limit
  // applied to an ordering they have no column in. A row it answers false for
  // that the comparator then promotes is a lead nobody reads.
  const ahead = [
    ['a business that asked', row({ source: ASKED_SOURCE })],
    ['a young listing', row({ rating_count: 2 })],
    ['a business with no site of its own', row({ site_kind: 'social' })],
  ]
  for (const [what, prospect] of ahead) {
    ok(rankOf(prospect) < 0, `${what} does not rank ahead of a score`)
    ok(ranksAhead(prospect), `ranksAhead is false for ${what}`)
  }

  const behind = [
    ['a site scoring zero', row({ audit_score: 0 })],
    ['a site scoring a hundred', row({ audit_score: 100 })],
    ['an unmeasured site', row({ audit_score: null })],
    ['no row at all', null],
  ]
  for (const [what, prospect] of behind) {
    ok(rankOf(prospect) >= 0, `${what} ranks ahead of a score`)
    ok(!ranksAhead(prospect), `ranksAhead is true for ${what}`)
  }
})

// ── A count nobody read is not a count of zero ───────────────────────────

check('a listing with no review count reads unread, never young', () => {
  // Roughly a third of the live table carries null for both rating_count and
  // business_status, because the sweep that wrote those rows never asked
  // Google for the fields. Reading one as zero reviews would promote every
  // row the pipeline knows least about to the front of the send queue, and
  // the queue would look healthier for it.
  for (const count of [null, undefined, '', 'four', {}, [], NaN, Infinity]) {
    const unread = row({ rating_count: count, business_status: null })
    same(youthOf(unread), 'unread', `a count of ${JSON.stringify(count) ?? String(count)}`)
    ok(!isYoung(unread), `a count of ${String(count)} read as young`)
    same(rankOf(unread), DEFAULT_RANK, `the rank of a row with a count of ${String(count)}`)
    ok(!ranksAhead(unread), `a row nobody has read was promoted ahead of every scored site`)
  }
})

check('a listing with no count is unread whatever else is true of it', () => {
  // The count is the only reading of age there is, so nothing else on the row
  // is allowed to stand in for it.
  same(youthOf(row({ rating_count: null, rating: 4.8 })), 'unread', 'a star rating with no count')
  same(youthOf(row({ rating_count: null, audit_score: 12 })), 'unread', 'a measured site')
  same(youthOf(row({ rating_count: null, site_kind: 'social' })), 'unread', 'a platform profile')
})

check('a count of zero is a reading and is kept apart from no reading at all', () => {
  same(youthOf(row({ rating_count: 0 })), 'young', 'a listing Google answered zero for')
  ok(isYoung(row({ rating_count: 0 })), 'a listing with no reviews is not young')
  same(youthOf(row({ rating_count: null })), 'unread', 'a listing nobody asked about')
})

// ── Where the ceiling falls ──────────────────────────────────────────────

check('the ceiling is exclusive, so the last young count is one under it', () => {
  const under = YOUNG_REVIEW_CEILING - 1
  same(youthOf(row({ rating_count: under })), 'young', `a count of ${under}`)
  same(
    youthOf(row({ rating_count: YOUNG_REVIEW_CEILING })),
    'established',
    'a count at the ceiling'
  )
  same(
    youthOf(row({ rating_count: YOUNG_REVIEW_CEILING + 1 })),
    'established',
    'a count over the ceiling'
  )
})

check('a count arriving as text is read as the number it holds', () => {
  same(youthOf(row({ rating_count: '3' })), 'young', 'three, as text')
  same(youthOf(row({ rating_count: '340' })), 'established', 'three hundred and forty, as text')
})

check('the three readings are distinct words, named once', () => {
  same(YOUTHS.length, 3, 'readings')
  same(new Set(YOUTHS).size, YOUTHS.length, 'distinct readings')
  ok(Object.isFrozen(YOUTHS), 'the list can be added to at runtime')
})

// ── A business that has shut its doors ───────────────────────────────────

for (const status of ['CLOSED_PERMANENTLY', 'CLOSED_TEMPORARILY']) {
  check(`a listing marked ${status} is neither operating nor young`, () => {
    // A shop that shut this month is not a shop that opened this month, and
    // its review count says nothing either way. Promoting it on a low count
    // would put the ranking's strongest argument behind the row least likely
    // to answer.
    const shut = row({ business_status: status, rating_count: 3 })
    ok(!isOperating(shut), `${status} read as trading`)
    ok(!isYoung(shut), `${status} with three reviews read as young`)
    same(youthOf(shut), 'established', `the reading of a ${status} listing`)
    ok(rankOf(shut) >= 0, `a ${status} listing ranked ahead of every measured site`)
  })
}

check('a listing with no status is treated as trading rather than as shut', () => {
  // The field being absent means the sweep did not ask for it. Reading that as
  // a closure would quietly drop every row an older sweep wrote.
  ok(isOperating(row({ business_status: null })), 'a null status read as closed')
  ok(isOperating(row({ business_status: undefined })), 'an absent status read as closed')
  ok(isOperating({}), 'a row with nothing on it read as closed')
  ok(isOperating(undefined), 'no row at all read as closed')
  ok(
    isOperating(row({ business_status: 'CLOSED_FOR_LUNCH' })),
    'a status nobody uses read as closed'
  )
  same(youthOf(row({ rating_count: 4, business_status: null })), 'young', 'a young unstatused row')
})

// ── Which lead goes first ────────────────────────────────────────────────

check('a business that asked outranks everything else on the table', () => {
  const asked = row({ source: ASKED_SOURCE })
  const young = row({ rating_count: 1 })
  const social = row({ site_kind: 'social' })
  const worst = row({ audit_score: 0 })
  for (const [what, other] of [
    ['a young listing', young],
    ['a business with no site', social],
    ['the worst-scoring site on the table', worst],
  ]) {
    ok(rankOf(asked) < rankOf(other), `a business that asked sorts behind ${what}`)
  }
  same(rankOf(asked), ASKED_RANK, 'the rank of a business that asked')
})

check('a young listing outranks a business with no site, which outranks every score', () => {
  const young = row({ rating_count: 5 })
  const social = row({ site_kind: 'social', rating_count: 300 })
  same(rankOf(young), YOUNG_RANK, 'the rank of a young listing')
  same(rankOf(social), SOCIAL_RANK, 'the rank of a business with no site')
  ok(rankOf(young) < rankOf(social), 'a young listing sorts behind a business with no site')
  for (const score of [0, 45, 100, null]) {
    ok(
      rankOf(social) < rankOf(row({ audit_score: score })),
      `a scored site at ${score} sorts first`
    )
  }
})

check('a speed-check row ranks as asked whatever its score says', () => {
  // The reading came in with the row, so an asked lead almost always carries a
  // score. Falling through to it would drop the one business on the table that
  // named its own problem into the middle of the measured ones.
  for (const score of [0, 30, 90, 100, null, '55']) {
    same(
      rankOf(row({ source: ASKED_SOURCE, audit_score: score })),
      ASKED_RANK,
      `an asked row scoring ${score}`
    )
  }
})

check('a speed-check row ranks as asked whatever its listing says', () => {
  const shapes = [
    ['an established listing', { rating_count: 800 }],
    ['a listing nobody has read', { rating_count: null, business_status: null }],
    ['a listing marked closed', { business_status: 'CLOSED_PERMANENTLY' }],
    ['a platform profile', { site_kind: 'social' }],
  ]
  for (const [what, over] of shapes) {
    same(rankOf(row({ source: ASKED_SOURCE, ...over })), ASKED_RANK, `an asked row on ${what}`)
  }
})

check(
  'a young listing on a platform profile ranks as young, which is the stronger of the two',
  () => {
    // Both are true of the row and the ladder reads the strongest first, so this
    // is the answer rather than an accident of ordering.
    same(rankOf(row({ site_kind: 'social', rating_count: 2 })), YOUNG_RANK, 'the rank')
  }
)

// ── One rank, over every shape a row can take ────────────────────────────

check('every shape of row reads as one of the three, and ranks on the rung it earns', () => {
  const sources = [undefined, null, 'places', ASKED_SOURCE, 'hand']
  const kinds = [undefined, null, 'own', 'social', 'none']
  const scores = [undefined, null, '', 0, 49, 90, 100, -5, 150, '45', 'x', NaN]
  const counts = [undefined, null, '', 0, 1, 9, 10, 11, 400, '3', 'x', -2, NaN]
  const statuses = [undefined, null, 'OPERATIONAL', 'CLOSED_PERMANENTLY', 'CLOSED_TEMPORARILY']

  const reached = new Set()
  const ranks = new Set()
  let shapes = 0
  for (const source of sources) {
    for (const site_kind of kinds) {
      for (const audit_score of scores) {
        for (const rating_count of counts) {
          for (const business_status of statuses) {
            const prospect = { source, site_kind, audit_score, rating_count, business_status }
            const named = JSON.stringify(prospect)
            const youth = youthOf(prospect)
            const rank = rankOf(prospect)
            shapes += 1

            ok(YOUTHS.includes(youth), `${named} read as ${youth}`)
            ok(Number.isFinite(rank), `${named} ranked ${rank}`)
            same(ranksAhead(prospect), rank < 0, `ranksAhead disagrees with the rank of ${named}`)
            ok(
              rank <= 100 || rank === DEFAULT_RANK,
              `${named} ranked ${rank}, which is neither a score nor a rung`
            )

            if (source === ASKED_SOURCE)
              same(rank, ASKED_RANK, `an asked row ranked wrong: ${named}`)
            else if (youth === 'young') same(rank, YOUNG_RANK, `a young row ranked wrong: ${named}`)
            else if (site_kind === 'social')
              same(rank, SOCIAL_RANK, `a platform row ranked wrong: ${named}`)

            if (youth === 'unread' && source !== ASKED_SOURCE) {
              ok(rank !== YOUNG_RANK, `a row nobody has read ranked as young: ${named}`)
            }
            if (!isOperating(prospect)) {
              ok(youth !== 'young', `a closed listing read as young: ${named}`)
            }

            reached.add(youth)
            ranks.add(rank)
          }
        }
      }
    }
  }

  ok(shapes > 3000, `only ${shapes} shapes were walked`)
  for (const youth of YOUTHS) {
    ok(reached.has(youth), `no shape of row reads as ${youth}`)
  }
  for (const rank of [ASKED_RANK, YOUNG_RANK, SOCIAL_RANK, DEFAULT_RANK]) {
    ok(ranks.has(rank), `no shape of row lands on ${rank}`)
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
  console.error(`\n${failures.length} of ${cases.length} outreach youth checks failed`)
  process.exit(1)
}

console.log(`outreach youth: ${cases.length} checks passed`)
