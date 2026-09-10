#!/usr/bin/env node
/**
 * That a chunk a deploy has deleted cannot take a reader's page with it.
 *
 *   npm run check:chunk-recovery
 *
 * Every hashed file this site serves belongs to the build that wrote it, and a
 * deploy deletes the whole of the last set. So a page that was open across one
 * asks for a file that has gone -- not rarely, and not only to the unlucky:
 * anything reached by `import()` after the document was served is exposed to
 * it, which is every route, every panel the bar opens and every background that
 * mounts on a scroll. The window closes minutes later, and by the time the
 * fault is read the file that answered it is long since deleted too, so this is
 * checked against how the code is written rather than against a live asset.
 *
 * Four ways it can go wrong, and each has already happened here:
 *
 * A bare `lazy()` asks once. The module map records a failed URL forever and
 * keyed by URL, so nothing that asks for the same address again is asking
 * again; `lazyWithRetry` is what asks at an address the map has not seen.
 *
 * A bare `import()` in a handler is a promise nobody holds. A warm-up on hover
 * costs the reader nothing when it fails and they may never press, but the
 * rejection reaches `unhandledrejection` and the page files it as a fault the
 * reader met. `warm` is the one that offers rather than asks.
 *
 * A piece of chrome under no boundary of its own answers to the one above the
 * routes, which recovers a page by reloading the document. That is right for a
 * route and wrong for a corner: a search panel and a background wash both had
 * it, and both could throw away a page that had loaded -- mid-form on the sign
 * up flow -- over a file that decorates it. `QuietBoundary` is where a piece
 * that is not the page fails.
 *
 * And the boot itself, which is the import every one of those hangs off and the
 * one this sweep could not see: it is written by the prerender into the head of
 * each document rather than anywhere under `src/app`. Bare, it left a reader a
 * finished page whose controls did nothing. `bootSource` is where it is written
 * now, and the last section here runs it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootSource } from '../../vite/boot-source.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const APP = path.join(ROOT, 'src/app')

// The route map. Its chunks are the page itself, so they answer to the boundary
// above the routes and a reload is the recovery rather than the damage.
const ROUTES = 'src/app/views.js'

// Where the retry is built, and the only place `lazy` itself belongs.
const RETRY = 'src/app/utils/lazyWithRetry.js'

const failures = []
let checks = 0
let read = 0

function check(ok, complaint) {
  checks += 1
  if (!ok) failures.push(complaint)
}

// The line rules run over every line of the app, and counting each one as a
// check reports a number nobody can read. They are three rules however many
// lines they are asked about.
function sweep(ok, complaint) {
  read += 1
  if (!ok) failures.push(complaint)
}

function filesUnder(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) filesUnder(full, out)
    else if (/\.jsx?$/.test(entry)) out.push(full)
  }
  return out
}

const swept = filesUnder(APP).map(file => ({
  name: path.relative(ROOT, file),
  source: readFileSync(file, 'utf8'),
}))

// A line that is prose about one of these rather than one of them. The comments
// above `lazyWithRetry` and `warm` describe exactly what they replace, and a
// sweep that reads its own documentation as the fault it documents is a sweep
// nobody can write a comment near.
const PROSE = /^\s*(\*|\/\/|\/\*)/

for (const { name, source } of swept) {
  const lines = source.split('\n')

  lines.forEach((line, index) => {
    const where = `${name}:${index + 1}`
    if (PROSE.test(line)) return

    // `lazy` itself is what `lazyWithRetry` is built out of, so the one file
    // that is allowed to call it is the one that fixes it.
    sweep(
      name === RETRY || !/(?<![A-Za-z])lazy\(\s*(\(\)|async)/.test(line),
      `${where} asks for a chunk with a bare lazy(), which cannot ask twice — use lazyWithRetry`
    )

    // The shape that files the fault: an `import()` written straight into a
    // handler, where the press or the hover is over before it settles and there
    // is nothing left holding the rejection.
    sweep(
      !/on[A-Z][A-Za-z]*={/.test(line) || !/import\(/.test(line) || /warm\(/.test(line),
      `${where} starts an import() in a handler that nobody holds, so a deleted chunk is filed as a fault a reader met — pass it to warm()`
    )

    sweep(
      !/^\s*import\(/.test(line),
      `${where} starts an import() as a statement, so its rejection has nowhere to go — pass it to warm()`
    )
  })

  const mountsChunk = /=\s*lazyWithRetry\(/.test(source)
  if (mountsChunk && name !== ROUTES) {
    check(
      /QuietBoundary/.test(source),
      `${name} mounts a chunk with no QuietBoundary, so its failure reloads the page it decorates`
    )
  }
}

check(swept.length > 200, 'the sweep did not read the app')

// The pieces this was written for, named so that moving one somewhere without a
// boundary is a failure here rather than a fault on the site.
//
// A piece handed to `LateChrome` is covered by the boundary inside it, so naming
// that component counts the same as naming the boundary - and `LateChrome` is on
// the list itself, so the one place the delegation leads to has to hold a real
// one.
const COVERED = /QuietBoundary|LateChrome/
for (const [file, piece] of [
  ['src/app/components/chrome/Layout.jsx', 'the assistant and the section marks'],
  ['src/app/components/app-shell/LateChrome.jsx', 'everything that arrives after its page'],
  ['src/app/components/navigation/Navigation.jsx', 'the search panel'],
  ['src/app/components/reactbits/LazyBg.jsx', 'the page backgrounds'],
]) {
  const found = swept.find(entry => entry.name === file)
  check(Boolean(found), `${file} has moved, and ${piece} is what this was watching`)
  if (found) {
    check(
      file.endsWith('LateChrome.jsx')
        ? /QuietBoundary/.test(found.source)
        : COVERED.test(found.source),
      `${piece} can reload the page underneath a reader when a deploy deletes its chunk`
    )
  }
}

// The search is the only chunk on the site a reader asks for by name, and that
// makes it the only one that owes them a sentence when it will not come.
//
// Everything else behind a QuietBoundary arrives on its own, so leaving without
// a word costs nobody anything: the page looks exactly as it did a frame
// earlier. A press is the opposite. The panel opens for as long as the fetch
// takes and then closes with nothing said, and the reader is left holding a
// control that swallowed their press. `lazy` then keeps the rejection for the
// life of the document, so it is not the first press that fails but every one
// after it too, in the same frame and just as silently.
//
// Only a newer document can reach the file a deploy replaced, so the reload is
// the whole recovery -- and the reader cannot choose it if nobody tells them it
// is there.
const searching = swept.find(entry => entry.name === 'src/app/components/navigation/Navigation.jsx')
if (searching) {
  const named = /onFail={\s*([A-Za-z_$][\w$]*)\s*}/.exec(searching.source)
  check(
    Boolean(named),
    'the search panel hands its failure to an inline handler, so there is nowhere for it to say anything — give it a named one'
  )
  if (named) {
    const opens = searching.source.indexOf(`const ${named[1]} =`)
    const closes = searching.source.indexOf('\n  }', opens)
    check(
      opens !== -1 && closes !== -1 && searching.source.slice(opens, closes).includes('toast('),
      'a press on the search that cannot be answered closes the bar and says nothing, and every press after it fails the same way — the reader is never told that reloading is what brings it back'
    )
  }
}

/* ----------------------------------------------------------------------- *
 * That one lost file is one fault, however many times the page asked for it.
 * ----------------------------------------------------------------------- */

// Everything above makes the page ask again, and asking again on this site
// means asking at a new address: the browser files a rejection against a URL
// and hands the same one back forever, so a retry that repeats the address
// sends nothing. `lazyWithRetry` numbers a `retry` query for a chunk and the
// capture frames do the same for a portfolio shot.
//
// That number counts the retried addresses the whole document has spent, so it
// differs on every attempt, differs again on the pass after them, and never
// repeats. What collects these groups them by what the message says, so left in
// the message it makes every attempt at one file a brand new fault: nothing
// dedupes, nothing accumulates a recurrence, and a file that has been failing
// for a week is filed every time as though it had never happened before. One
// refused capture on the home page was six reports under three separate names.
//
// So the reporter takes its own marker off before filing, and the rest of the
// address stands. Checked as behaviour rather than as wording: the function is
// lifted out of the page and run against the strings that were really filed.
const PAGE = readFileSync(path.join(ROOT, 'index.html'), 'utf8')

function lift(name) {
  const opens = PAGE.indexOf(`function ${name}(`)
  if (opens === -1) return null
  let depth = 0
  for (let at = PAGE.indexOf('{', opens); at < PAGE.length; at += 1) {
    if (PAGE[at] === '{') depth += 1
    else if (PAGE[at] === '}') {
      depth -= 1
      if (depth === 0) return PAGE.slice(opens, at + 1)
    }
  }
  return null
}

const settling = lift('settled')
check(
  Boolean(settling),
  'the reporter no longer settles an address before filing it, so every retry files a fault of its own'
)

if (settling) {
  const settled = new Function('location', `${settling}; return settled`)({
    origin: 'https://www.taylorurl.com',
    href: 'https://www.taylorurl.com/pricing',
  })

  // Every one of these is a real filed message, copied off the ticket it made.
  for (const [said, want] of [
    [
      'TypeError: Failed to fetch dynamically imported module: https://www.taylorurl.com/assets/Pricing-CCU2B7e4.js?retry=4',
      'TypeError: Failed to fetch dynamically imported module: https://www.taylorurl.com/assets/Pricing-CCU2B7e4.js',
    ],
    [
      'TypeError: Failed to fetch dynamically imported module: https://www.taylorurl.com/assets/Aurora-DFW4dklT.js?retry=2',
      'TypeError: Failed to fetch dynamically imported module: https://www.taylorurl.com/assets/Aurora-DFW4dklT.js',
    ],
    [
      'Failed to load img: https://www.taylorurl.com/portfolio/baytowngokarts-com-desktop.webp?retry=3',
      'Failed to load img: https://www.taylorurl.com/portfolio/baytowngokarts-com-desktop.webp',
    ],
    // The first attempt already asks at the address the build wrote, and it has
    // to come through unchanged - it is the report every later one now joins.
    [
      'Failed to load img: https://www.taylorurl.com/portfolio/baytowngokarts-com-desktop.webp',
      'Failed to load img: https://www.taylorurl.com/portfolio/baytowngokarts-com-desktop.webp',
    ],
  ]) {
    check(
      settled(said) === want,
      `a filed report still carries an attempt number: ${settled(said)}`
    )
  }

  // The marker is the only thing that comes off. A query the site put there for
  // its own reasons is part of which file failed.
  check(
    settled('Failed to load img: https://www.taylorurl.com/a.webp?w=640&retry=2') ===
      'Failed to load img: https://www.taylorurl.com/a.webp?w=640',
    'settling an address takes the rest of its query with it'
  )

  // Somebody else's `retry` is somebody else's parameter. The capture frames
  // fall through to a screenshot service on their last rung, and rewriting that
  // service's address would file it under one it was never asked at.
  check(
    settled('No answer from https://image.thum.io/get/width/1280/x?retry=1') ===
      'No answer from https://image.thum.io/get/width/1280/x?retry=1',
    "settling reaches an address that is not this site's"
  )

  check(
    settled('Assertion failed: retry=2 was never sent') ===
      'Assertion failed: retry=2 was never sent',
    'settling rewrites text that is not an address'
  )
}

// Held raw and filed settled. Whoever reads the live console is asking which
// attempt this was, and that is precisely the detail the collector has to lose
// to see two attempts as one fault - so the raw message reaches `hold` first.
const reporting = PAGE.slice(PAGE.indexOf('function report('), PAGE.indexOf('function flatten('))
check(
  /hold\(kind, message, stack\)/.test(reporting),
  'the live console is now shown the settled message, so it can no longer say which attempt failed'
)
check(
  /message: settled\(/.test(reporting) && /stack: settled\(/.test(reporting),
  'a report is filed without settling its message and stack, so the attempt number is what it is grouped by'
)

/* ----------------------------------------------------------------------- *
 * The import that is the whole application.
 * ----------------------------------------------------------------------- */

// Everything above sweeps `src/app`, and the most exposed `import()` on this
// site is not in it. The prerendered document boots the bundle from an inline
// module in its head, and for as long as that was written bare it was the one
// rule here that nothing enforced - a rejection nobody held, over the file
// every other chunk on the site hangs off. What a reader got was a finished
// document whose controls did nothing, with no notice and no way back.
//
// Run rather than read, with the loader swapped out, because what matters is
// what the page does with each of the three failures rather than which words
// the boot spells them with.
const boot = bootSource('/assets/index-TEST0000.js')

async function runBoot(answers, { session = {}, online = true } = {}) {
  const asked = []
  let reloads = 0
  const stub = {
    loader: address => {
      asked.push(address)
      const answer = answers[Math.min(asked.length - 1, answers.length - 1)]
      return answer ? Promise.reject(answer) : Promise.resolve({})
    },
    requestAnimationFrame: run => run(),
    setTimeout: run => run(),
    sessionStorage: {
      getItem: key => (key in session ? session[key] : null),
      setItem: (key, value) => {
        session[key] = String(value)
      },
      removeItem: key => {
        delete session[key]
      },
    },
    location: {
      reload: () => {
        reloads += 1
      },
    },
    navigator: { onLine: online },
  }
  const names = Object.keys(stub)
  new Function(...names, boot.replace(/\bimport\(/g, 'loader('))(...names.map(name => stub[name]))
  // A macrotask boundary, which is where every microtask the chain is made of
  // has finished: the wait between attempts is a stub that runs at once, so
  // nothing here is left in a real timer.
  await new Promise(resolve => setTimeout(resolve, 0))
  return { asked, reloads, session }
}

const filed = []
const collect = reason => filed.push(reason)
process.on('unhandledRejection', collect)

const refused = () => new TypeError('Failed to fetch dynamically imported module')
// A token every browser this site targets has understood since 2020, arriving
// off a client years older than the syntax. This is #525, and it is the one
// failure a second address and a fresh document both answer identically.
const unparsable = () => new SyntaxError('Unexpected token ?')

const straight = await runBoot([null])
check(straight.asked.length === 1, 'a bundle that answers first time is asked for more than once')
check(straight.reloads === 0, 'a bundle that answered reloads the document underneath the reader')

const flaky = await runBoot([refused(), refused(), null])
check(flaky.asked.length === 3, 'a fetch that did not land is given up on rather than asked again')
check(
  new Set(flaky.asked).size === 3,
  'the boot asks again at an address the module map already holds a rejection for, so it sends nothing'
)
check(
  flaky.asked.slice(1).every(address => address.includes('retry=')),
  'the boot asks again without the marker the reporter strips, so every attempt files a fault of its own'
)
check(flaky.reloads === 0, 'a bundle that arrived on a later attempt still reloads the document')

const deleted = await runBoot([refused()])
check(
  deleted.reloads === 1,
  'a chunk a deploy has deleted leaves the reader on a document that does nothing when it is pressed'
)
const again = await runBoot([refused()], { session: deleted.session })
check(
  again.reloads === 0,
  'a document that comes back identical is reloaded again, which is a loop rather than a recovery'
)
const offline = await runBoot([refused()], { online: false })
check(
  offline.reloads === 0,
  "a reader the browser knows is offline has a readable page swapped for the browser's network page"
)

const old = await runBoot([unparsable()])
check(
  old.asked.length === 1,
  'a bundle the engine cannot parse is asked for again, which parses no better and costs the reader the download twice over'
)
check(
  old.reloads === 0,
  'a bundle the engine cannot parse reloads the document, and that reload can never be the last one'
)

await new Promise(resolve => setTimeout(resolve, 0))
process.off('unhandledRejection', collect)

check(
  filed.length === 3,
  `a boot that never started was swallowed rather than reported: ${filed.length} of 3 reached the reporter`
)
check(
  filed.every(reason => /could not start/.test(String(reason && reason.message))),
  'a boot that never started is filed as whatever the engine happened to say rather than as the page not starting'
)
check(
  filed.some(reason => /Unexpected token/.test(String(reason && reason.message))),
  'the report drops what the engine said, which is the only account of why the bundle would not run'
)

if (failures.length) {
  console.error('check-chunk-recovery: failed')
  for (const failure of failures) console.error(`  ${failure}`)
  console.error('  a chunk that has gone is the deploy working; the page it was on carries on')
  process.exit(1)
}

console.log(
  `check-chunk-recovery: ${checks} checks hold and ${read} lines across ${swept.length} files ` +
    'ask for every chunk through the retry, hold every warm-up, and fail a piece of chrome ' +
    'without the page'
)
