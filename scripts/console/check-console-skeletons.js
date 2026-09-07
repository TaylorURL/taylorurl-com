/**
 * Proves that no console section ever draws a figure it has not been given.
 *
 * A section that renders while its read is still out has nothing to render
 * from, and every default it falls back on is a statement: `|| 0` says nobody
 * visited, `|| []` says nothing was recorded, an aside counting an empty list
 * says the account holds no sites. All three are read as findings, and all
 * three are replaced a second later by the real ones, which is the console
 * appearing to change its mind.
 *
 * Two halves, because the fault had two causes. The rule below is the feed's:
 * what came back is filed under the query that asked for it, so a new window
 * or a new filter reports as loading again rather than handing back the last
 * answer. The scan is the section's: every list, table and counted aside has
 * to consult a loading flag before it draws.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { answerFor, NOTHING_HELD } from '../../src/app/hooks/console/feedState.js'

const HERE = dirname(fileURLToPath(import.meta.url))
// Everything a reader of the console actually looks at. Scanning the sections
// alone left the shell, the scope chooser, the account panel and the status
// board outside the net, and four of them were stating findings.
const SCANNED = [
  'src/app/views/console',
  'src/app/views/console/shell',
  'src/app/views/console/intake',
  'src/app/views/console/pages/health',
  'src/app/views/console/pages/traffic',
  'src/app/views/console/pages/email',
  'src/app/views/console/pages/studio',
  'src/app/views/status',
]

const cases = []
function check(name, run) {
  cases.push([name, run])
}

function same(got, want, what) {
  if (got !== want)
    throw new Error(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
}

/**
 * Every fault a rule found, not the first. One rule holding sixteen sections
 * that reports one of them turns a single pass into sixteen.
 */
function report(faults) {
  if (faults.length) throw new Error(faults.join('\n      '))
}

// -- the feed's rule ---------------------------------------------------------

check('a feed that has read nothing answers nothing', () => {
  same(answerFor(NOTHING_HELD, 'view=site&days=7'), null, 'first read')
})

check('a payload answers the query it was filed under', () => {
  const held = { key: 'view=site&days=7', value: { totals: { visitors: 12 } } }
  same(answerFor(held, 'view=site&days=7').totals.visitors, 12, 'same query')
})

check('a payload never answers a different query', () => {
  // The window moved from 7 days to 30. The seven-day figures are on screen and
  // are not a partial answer to the thirty-day question.
  const held = { key: 'view=site&days=7', value: { totals: { visitors: 12 } } }
  same(answerFor(held, 'view=site&days=30'), null, 'window changed')
  same(answerFor(held, 'view=site&days=7&site=abc'), null, 'site scoped')
})

check('a failure never carries across to the next query', () => {
  // A collector that was down for the last window must not leave this one
  // reporting an error it has not had, nor skip the wait for its own answer.
  const failed = { key: 'view=site&days=7', value: new Error('collector down') }
  same(answerFor(failed, 'view=site&days=30'), null, 'error is query-scoped')
})

check('loading is the absence of both, which reopens on every new query', () => {
  const held = { key: 'view=overview&days=7', value: { sites: [] } }
  const loadingFor = key => !answerFor(held, key) && !answerFor(NOTHING_HELD, key)
  same(loadingFor('view=overview&days=7'), false, 'answered')
  same(loadingFor('view=overview&days=30'), true, 'asking again')
})

// -- the sections' rule ------------------------------------------------------

const sources = SCANNED.flatMap(folder =>
  readdirSync(join(HERE, '../..', folder))
    .filter(name => name.endsWith('.jsx'))
    .map(name => ({ name, text: readFileSync(join(HERE, '../..', folder, name), 'utf8') }))
)

/**
 * The open tags of one element name, whole, with their attributes.
 *
 * A regex to the next `>` stops inside `aside={`${n} tracked`}`, so this walks
 * the tag counting the braces, quotes and template literals it passes through.
 */
function openTags(text, element) {
  const found = []
  const marker = `<${element}`
  let at = text.indexOf(marker)
  while (at !== -1) {
    const after = text[at + marker.length]
    if (after === ' ' || after === '\n' || after === '>' || after === '/') {
      let i = at + marker.length
      let depth = 0
      let quote = null
      while (i < text.length) {
        const ch = text[i]
        if (quote) {
          if (ch === '\\') i += 1
          else if (ch === quote) quote = null
        } else if (ch === '"' || ch === "'" || ch === '`') quote = ch
        else if (ch === '{') depth += 1
        else if (ch === '}') depth -= 1
        else if (ch === '>' && depth === 0) break
        i += 1
      }
      found.push(text.slice(at, i + 1))
    }
    at = text.indexOf(marker, at + 1)
  }
  return found
}

/**
 * The head reads a figure out of the payload rather than stating a word.
 *
 * A bare interpolation counts too: `${liveNow} open` states a live count as
 * plainly as `${fullCount(total)}` does, and reads "0 open" from the same
 * default.
 */
const COUNTS =
  /\.length|fullCount\(|compactCount\(|percent\(|\bcount\b|\$\{\s*(liveNow|total|matching|outstanding|sessions|visitors|pageviews)\b/

/**
 * The body of the component one tag sits in.
 *
 * A card handed its data as a prop is drawn by whoever already waited for it,
 * and has no read of its own to wait on. What tells the two apart is whether
 * the component around the tag holds a loading flag at all.
 */
function enclosing(text, at) {
  const before = text.lastIndexOf('\nfunction ', at)
  const exported = text.lastIndexOf('\nexport default function ', at)
  const start = Math.max(before, exported)
  if (start === -1) return text
  const next = text.indexOf('\nfunction ', at)
  const nextExported = text.indexOf('\nexport default function ', at)
  const ends = [next, nextExported].filter(index => index !== -1)
  return text.slice(start, ends.length ? Math.min(...ends) : text.length)
}

/** A figure the code states rather than reads: a cap, a page size, a limit. */
const STATED = /^[A-Z][A-Z0-9_]*$/

/**
 * `scoped` is the window's own row for the site in scope, so it goes missing
 * for the length of every window change. `scopeName` and `siteId` outlive it
 * and are what a section asking which site it answers for is meant to read.
 */
const WINDOWED_SCOPE = /\bscoped\b/

check('every ranked list is told whether its rows have landed', () => {
  // A list with no rows draws "nothing recorded", which is a finding. Before
  // the read lands there is no finding to state.
  const faults = []
  for (const { name, text } of sources) {
    for (const tag of openTags(text, 'RankedList')) {
      if (!/\bloading=\{/.test(tag)) {
        faults.push(`${name}: a RankedList draws without a loading prop`)
      }
    }
  }
  report(faults)
})

check('every table body holds placeholder rows', () => {
  // An empty tbody under live column headings is a table saying the query came
  // back with nothing in it.
  const faults = []
  for (const { name, text } of sources) {
    const bodies = text.split('<tbody').slice(1)
    for (const body of bodies) {
      const inner = body.slice(0, body.indexOf('</tbody>'))
      if (!inner.includes('SkeletonRows')) {
        faults.push(`${name}: a table body draws rows with no SkeletonRows branch`)
      }
    }
  }
  report(faults)
})

check('every counted aside waits for the count', () => {
  // "0 tracked" over a loading table is the card stating the account is empty.
  const faults = []
  for (const { name, text } of sources) {
    for (const tag of [...openTags(text, 'Panel'), ...openTags(text, 'SidePanel')]) {
      const aside = tag.match(/aside=\{([\s\S]*?)\}\s*(?:\n|[a-zA-Z]|\/?>)/)
      if (!aside) continue
      // A limit the code carries is not a figure the feed answers for.
      const counted = aside[1].replace(/\b\w+\(([^)]*)\)/g, (whole, argument) =>
        STATED.test(argument.trim()) ? '' : whole
      )
      if (!COUNTS.test(counted)) continue
      if (/\bloading=\{/.test(tag)) continue
      // Some heads weigh a second condition beside the flag - a feed that is
      // down as well as one that has not answered - and state their own wait.
      if (/\bloading\b/.test(aside[1])) continue
      if (!/\bloading\b/.test(enclosing(text, text.indexOf(tag)))) continue
      faults.push(
        `${name}: a Panel states a counted aside with no loading prop -> ${aside[1].trim().slice(0, 60)}`
      )
    }
  }
  report(faults)
})

check('every section that reads the console reads its loading flag too', () => {
  // A section can only draw from `detail`, `sites`, `totals` or the live feed
  // once one of those reads has answered, so it has to hold the flag saying
  // whether it has.
  // Only the sections that take figures out of the context. A section reading
  // it for the scope alone has no figure of its own to wait for.
  const FIGURES = /\b(detail|totals|sites|liveSites|liveNow|liveForSite|overview)\b/
  const faults = []
  for (const { name, text } of sources) {
    const taken = text.match(/const \{([^}]*)\} = useConsole\(\)/)
    if (!taken || !FIGURES.test(taken[1])) continue
    // Either the shell's flag, or the feed the section reads for itself.
    if (!/\bloading\b/.test(text)) {
      faults.push(`${name}: takes figures out of the console context without a loading flag`)
    }
  }
  report(faults)
})

check('no section decides which site it is answering for from the window', () => {
  // `scoped` is a row of the window's figures. Branching on it makes a scoped
  // section fall through to its account-wide reading every time the window
  // moves, which is how the status board silently widened to the portfolio.
  const faults = []
  for (const { name, text } of sources) {
    const taken = text.match(/const \{([^}]*)\} = useConsole\(\)/)
    if (!taken || !WINDOWED_SCOPE.test(taken[1])) continue
    // Reading a figure off the row is what it is for. Choosing a branch is not.
    const branching = /\bscoped\s*\?/.test(text) || /if \(scoped\)/.test(text)
    if (branching && !/\b(siteId|scopeName)\b/.test(taken[1])) {
      faults.push(`${name}: branches on the window's own row instead of the scope`)
    }
  }
  report(faults)
})

let failed = 0
for (const [name, run] of cases) {
  try {
    run()
    console.log(`  ok  ${name}`)
  } catch (cause) {
    failed += 1
    console.error(`FAIL  ${name}\n      ${cause.message}`)
  }
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
if (failed) process.exit(1)
