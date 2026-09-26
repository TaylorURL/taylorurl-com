#!/usr/bin/env node
/**
 * That every score the site shows is one the portfolio actually holds, and that
 * every page which quotes a score still reads it rather than spelling it out.
 *
 *   npm run check:portfolio-scores
 *
 * A PageSpeed figure is the one claim on this site a reader can settle in
 * thirty seconds, which is the whole reason it is quoted: a stranger is invited
 * to run the same free report and get the same band back. That only holds while
 * the number on the page is the number in `@data/portfolio`, and three separate
 * things had come apart from it.
 *
 * The portfolio index promised, in the description search engines quote, that
 * every entry "shows the Google PageSpeed score it measured", and no row drew
 * one — the figures lived only on the case study behind the row.
 *
 * The front door printed the measurement date raw, so a card whose whole point
 * was that the number is checkable ended a sentence with `2026-08-27`.
 *
 * And the average was a literal in three places — the front door, the about
 * page, and the FAQ — with the client count a fourth beside it. Re-measuring
 * one site moves an average nobody remembers is written down, and the pages go
 * on quoting a figure that no set of numbers on the site adds up to. Nothing
 * failed, and nothing would have.
 *
 * So this checks the three layers that keep those from coming back. The stored
 * figures are a shape a score can be: whole numbers inside the range Google
 * reports, a run count the study can state, and a date that has happened. The
 * derived figures are recomputed here from the entries rather than trusted. And
 * the pages that show either are read as source: each must reach for the data,
 * none may spell an average out, and a stored date may only reach a reader
 * through the formatter.
 *
 * What this cannot check is whether the stored figures still match the live
 * sites — that needs the PageSpeed API and a key, and it is what
 * `npm run audit:portfolio` is for. This checks the site against itself.
 */
import { cases, check, finish } from '../harness/checks.js'
import { read } from '../harness/files.js'

const { PORTFOLIO_PROJECTS, CLIENT_PROJECTS, PORTFOLIO_AVERAGES, formatMeasuredDate } =
  await import('../../src/app/data/portfolio.js')

/* ------------------------------------------------------------------------ *
 * 1. The stored figures are a shape a PageSpeed score can be.
 * ------------------------------------------------------------------------ */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const whole = value => Number.isInteger(value)
const scored = value => whole(value) && value >= 0 && value <= 100

// Midnight tomorrow, so a figure measured today is not read as being from the
// future by a run that happens to start before the clock the date was written
// against.
const TOMORROW = new Date()
TOMORROW.setUTCHours(0, 0, 0, 0)
TOMORROW.setUTCDate(TOMORROW.getUTCDate() + 1)

const STALE_DAYS = 180
const stale = []

for (const project of PORTFOLIO_PROJECTS) {
  const said = project.slug
  const pagespeed = project.pagespeed

  check(`${said} carries a pagespeed block`, pagespeed && typeof pagespeed === 'object')
  if (!pagespeed || typeof pagespeed !== 'object') continue

  check(`${said} mobile is a score out of 100`, scored(pagespeed.mobile))
  check(`${said} desktop is a score out of 100`, scored(pagespeed.desktop))
  check(`${said} states how many runs the figures are the median of`, whole(pagespeed.runs))
  check(`${said} took more than one run, which a median needs`, pagespeed.runs >= 3)

  const measured = String(pagespeed.measured ?? '')
  check(`${said} dates its measurement as YYYY-MM-DD`, ISO_DATE.test(measured))
  if (!ISO_DATE.test(measured)) continue

  // Round-tripping the date is what catches a real-looking day that is not one:
  // `2026-02-30` passes the pattern and lands in March.
  const taken = new Date(`${measured}T00:00:00Z`)
  check(`${said} names a day that exists`, taken.toISOString().slice(0, 10) === measured)
  check(`${said} was measured on a day that has happened`, taken < TOMORROW)

  const age = Math.floor((TOMORROW - taken) / 86_400_000)
  if (age > STALE_DAYS) stale.push(`${said} (${age} days)`)
}

check(
  'every entry states which kind of work it is',
  PORTFOLIO_PROJECTS.every(project => project.kind === 'client' || project.kind === 'product')
)

/* ------------------------------------------------------------------------ *
 * 1b. Every figure belongs to the entry holding it.
 *
 * Everything above is a question about the shape of a number, and a wrong
 * number in the right shape passes all of it. On 2026-09-26 a rewrite that
 * located a figure by matching the `pagespeed` text rather than by the entry's
 * own span wrote SETX Football's fresh mobile 97 onto Faded Barber Shop and
 * left SETX Football on its stale 99. Both blocks were well-formed scores,
 * every surface still read from the data, the average came out plausible, and
 * this file reported "136 checks hold across 13 entries". A prospect was one
 * deploy away from a score on a public page that had never been measured
 * against that site.
 *
 * The precondition is not a thing that happened once. `develop` holds two pairs
 * of entries with byte-identical `pagespeed` lines today - Impressiva Printing
 * with SETX Football, Dylan Jordan Real Estate with Hollingshead Harbor - and
 * they are legitimate readings that happened to agree, which is why refusing an
 * identical line is not the gate. It would red-line a correct tree and block
 * every release until somebody changed a measurement.
 *
 * So the figure is corroborated against a measurement of the entry's own url.
 * The daily routine has always re-read each entry back against its own scratch
 * record after writing - that step is what caught the mis-write - and the record
 * lived in a scratch directory on the machine that took the readings, where no
 * run of this check could reach it. It is now committed beside the figures, and
 * the routine writes it in the same run that rewrites them.
 *
 * Two medians and not the run count. `runs` is the count the study states and
 * the routine leaves it alone across a re-measure, so a confirmed reading whose
 * five runs of record sit in the record against a stored 3 is a correct tree -
 * deluxfitbyangie.com is one today. The medians are what a reader sees and what
 * a mis-write swaps, and they are what this holds to.
 *
 * And the record's date may run ahead of the stored one, because the routine
 * advances `measured` only when a figure moved. It may never run behind: a
 * figure dated later than any measurement of that url is a figure from
 * somewhere else.
 * ------------------------------------------------------------------------ */

const PROVENANCE = 'src/app/data/portfolio-provenance.json'
const provenance = JSON.parse(read(PROVENANCE))

/**
 * What a set of entries cannot account for against a set of measurements.
 *
 * Written as a function over both rather than as a loop over the real data, so
 * the scenario this exists for can be driven through the same code below rather
 * than described in a comment beside it.
 *
 * @param {Array<object>} projects - Portfolio entries, each with `url`, `slug`
 *   and `pagespeed`.
 * @param {{readings: Record<string, object>}} record - Measurements keyed by the
 *   url they were taken against.
 * @returns {string[]} One complaint per entry that cannot be accounted for.
 */
function unaccounted(projects, record) {
  const complaints = []
  for (const project of projects) {
    const reading = record.readings && record.readings[project.url]
    if (!reading) {
      complaints.push(`${project.slug} has no measurement recorded against ${project.url}`)
      continue
    }
    const figures = project.pagespeed || {}
    if (figures.mobile !== reading.mobile) {
      complaints.push(
        `${project.slug} shows mobile ${figures.mobile} and ${project.url} measured ${reading.mobile}`
      )
    }
    if (figures.desktop !== reading.desktop) {
      complaints.push(
        `${project.slug} shows desktop ${figures.desktop} and ${project.url} measured ${reading.desktop}`
      )
    }
    if (String(figures.measured) > String(reading.measured)) {
      complaints.push(
        `${project.slug} is dated ${figures.measured} and the last measurement of ${project.url} is ${reading.measured}`
      )
    }
  }
  return complaints
}

const orphaned = Object.keys(provenance.readings || {}).filter(
  url => !PORTFOLIO_PROJECTS.some(project => project.url === url)
)

check(
  'every entry has a measurement recorded against its own url',
  PORTFOLIO_PROJECTS.every(project => Boolean((provenance.readings || {})[project.url]))
)
const unaccountedFor = unaccounted(PORTFOLIO_PROJECTS, provenance)
check(
  `every stored figure is one measured against that entry's own url${
    unaccountedFor.length ? ` — ${unaccountedFor.join('; ')}` : ''
  }`,
  unaccountedFor.length === 0
)
check(
  `the record holds no url the portfolio has dropped${
    orphaned.length ? ` — ${orphaned.join(', ')}` : ''
  }`,
  orphaned.length === 0
)
check('the record says which run wrote it', ISO_DATE.test(String(provenance.measured ?? '')))

// The 2026-09-26 mis-write, driven rather than described.
//
// Two entries holding byte-identical figures, one of them quoting the other's
// measurement. Every check above this section passes on it - both are scores,
// both are dated, both are shaped exactly as a figure should be - which is the
// whole complaint. This is the case that has to fail.
const SWAPPED = [
  {
    slug: 'faded-barber-shop',
    url: 'https://faded-barbershop.com',
    pagespeed: { mobile: 97, desktop: 100, runs: 3, measured: '2026-09-26' },
  },
  {
    slug: 'setx-football',
    url: 'https://www.setxfootball.org',
    pagespeed: { mobile: 97, desktop: 100, runs: 3, measured: '2026-09-26' },
  },
]
const FIXTURE = {
  measured: '2026-09-26',
  readings: {
    'https://faded-barbershop.com': { mobile: 99, desktop: 100, measured: '2026-09-26' },
    'https://www.setxfootball.org': { mobile: 97, desktop: 100, measured: '2026-09-26' },
  },
}
const caught = unaccounted(SWAPPED, FIXTURE)
check(
  "a figure quoting another row's measurement is refused even where both rows are well-formed",
  caught.length === 1 && caught[0].includes('faded-barber-shop') && caught[0].includes('mobile 97')
)
check(
  'the row that was not mis-written is left alone',
  !caught.some(complaint => complaint.includes('setx-football'))
)
check(
  'a figure dated later than any measurement of its own url is refused',
  unaccounted(
    [
      {
        slug: 'ahead',
        url: 'https://example.com',
        pagespeed: { mobile: 99, desktop: 100, measured: '2026-09-27' },
      },
    ],
    {
      measured: '2026-09-26',
      readings: {
        'https://example.com': { mobile: 99, desktop: 100, measured: '2026-09-26' },
      },
    }
  ).length === 1
)
check(
  'an entry with no measurement against its url is refused rather than skipped',
  unaccounted(
    [
      {
        slug: 'unmeasured',
        url: 'https://nowhere.example',
        pagespeed: { mobile: 99, desktop: 100, measured: '2026-09-26' },
      },
    ],
    { measured: '2026-09-26', readings: {} }
  ).length === 1
)
// And a correct tree still passes, which is the half that keeps this from being
// a gate nobody can land under: two entries agreeing on every figure is a
// coincidence rather than a fault, and `develop` holds two such pairs today.
check(
  'two entries that genuinely measured the same are not refused for agreeing',
  unaccounted(
    [
      {
        slug: 'one',
        url: 'https://one.example',
        pagespeed: { mobile: 97, desktop: 100, measured: '2026-09-26' },
      },
      {
        slug: 'two',
        url: 'https://two.example',
        pagespeed: { mobile: 97, desktop: 100, measured: '2026-09-26' },
      },
    ],
    {
      measured: '2026-09-26',
      readings: {
        'https://one.example': { mobile: 97, desktop: 100, measured: '2026-09-26' },
        'https://two.example': { mobile: 97, desktop: 100, measured: '2026-09-26' },
      },
    }
  ).length === 0
)

/* ------------------------------------------------------------------------ *
 * 2. The derived figures are the ones the entries add up to.
 * ------------------------------------------------------------------------ */

const mean = strategy =>
  Math.round(
    CLIENT_PROJECTS.reduce((sum, project) => sum + project.pagespeed[strategy], 0) /
      CLIENT_PROJECTS.length
  )

check('there is client work to average over', CLIENT_PROJECTS.length > 0)
check(
  'the client sites are the entries built for someone else',
  CLIENT_PROJECTS.length === PORTFOLIO_PROJECTS.filter(p => p.kind === 'client').length
)
check(
  'the mobile average is the one the client sites make',
  PORTFOLIO_AVERAGES.mobile === mean('mobile')
)
check(
  'the desktop average is the one the client sites make',
  PORTFOLIO_AVERAGES.desktop === mean('desktop')
)

// A studio product left in the average would make the studio its own referee,
// and the sentences quoting it all say "the client sites".
check(
  'a studio product is left out of the client average',
  !CLIENT_PROJECTS.some(project => project.kind === 'product')
)

check('a stored date renders as prose', formatMeasuredDate('2026-08-27') === 'August 27, 2026')

/* ------------------------------------------------------------------------ *
 * 3. The pages that show a score still read it.
 * ------------------------------------------------------------------------ */

// Each surface, and what its source has to reach for. `reads` is a figure taken
// off an entry, `derives` an export it must not do the arithmetic of itself.
const SURFACES = [
  {
    file: 'src/app/views/portfolio/Portfolio.jsx',
    what: 'the portfolio index row',
    reads: ['pagespeed.mobile', 'pagespeed.desktop', 'pagespeed.runs', 'pagespeed.measured'],
    derives: ['CLIENT_PROJECTS'],
  },
  {
    file: 'src/app/views/portfolio/CaseStudy.jsx',
    what: 'the case study',
    reads: ['pagespeed.mobile', 'pagespeed.desktop', 'pagespeed.runs', 'pagespeed.measured'],
    derives: [],
  },
  {
    file: 'src/app/views/home/CapabilitiesSection.jsx',
    what: "the front door's score card",
    reads: ['pagespeed.mobile', 'pagespeed.desktop', 'pagespeed.measured'],
    derives: ['PORTFOLIO_AVERAGES'],
  },
  {
    file: 'src/app/data/pages/about.js',
    what: "the about page's figures",
    reads: [],
    derives: ['PORTFOLIO_AVERAGES', 'CLIENT_PROJECTS'],
  },
  {
    file: 'src/app/views/company/Faq.jsx',
    what: 'the FAQ answer on platforms',
    reads: [],
    derives: ['PORTFOLIO_AVERAGES'],
  },
]

// An average written as a word rather than read from the data. This is the
// exact sentence that was in three files, in the two shapes it was written in.
const SPELLED_AVERAGE = /averages?\s+\d+\s+on\s+(mobile|desktop)/i

// A stored date reaching a reader without going through the formatter. The
// window is the call and its opening bracket, which is all that can sit between
// the two when the date is being rendered rather than compared.
const RAW_DATE = /(?<!formatMeasuredDate\((?:[\w.]{0,40}))pagespeed\.measured/

for (const surface of SURFACES) {
  const source = read(surface.file)

  for (const field of surface.reads) {
    check(`${surface.what} draws ${field}`, source.includes(field))
  }
  for (const name of surface.derives) {
    check(`${surface.what} reads ${name} rather than its own arithmetic`, source.includes(name))
  }

  check(`${surface.what} does not spell an average out`, !SPELLED_AVERAGE.test(source))

  for (const line of source.split('\n')) {
    if (!line.includes('pagespeed.measured')) continue
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) continue
    check(
      `${surface.what} renders its measurement date through formatMeasuredDate`,
      !RAW_DATE.test(line)
    )
  }
}

// The portfolio index's description is what a search result quotes, and it
// promises the row shows a score. It is a promise the page has to keep.
{
  const source = read('src/app/views/portfolio/Portfolio.jsx')
  const promises = /description="[^"]*PageSpeed score[^"]*"/.test(source)
  check(
    'the portfolio index shows the score its own description promises',
    !promises || (source.includes('pagespeed.mobile') && source.includes('pagespeed.desktop'))
  )
}

/* ------------------------------------------------------------------------ */

await finish({ hint: 'the figures live in src/app/data/portfolio.js' })

if (stale.length) {
  console.warn(
    `check-portfolio-scores: measured over ${STALE_DAYS} days ago, re-run PageSpeed for ${stale.join(', ')}`
  )
}

console.log(
  `check-portfolio-scores: ${cases.length} checks hold across ${PORTFOLIO_PROJECTS.length} entries — ` +
    `every stored figure is a score measured against that entry's own url, the client sites ` +
    `average ${PORTFOLIO_AVERAGES.mobile} mobile and ${PORTFOLIO_AVERAGES.desktop} desktop, and ` +
    `all ${SURFACES.length} surfaces that quote a score read it from the data`
)
