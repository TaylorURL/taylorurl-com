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
 * Five ways it can go wrong, and each has already happened here:
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
 *
 * The fifth is not an import at all, which is how it kept its exemption while
 * the other four were being closed one at a time. The stylesheet is a hashed
 * file asked for exactly like the rest, and it had no retry, no boundary and no
 * reload: Beasties leaves it deferred behind an `onload`, so a sheet that never
 * arrives never switches on and nothing anywhere says so. #528 was that.
 * `sheetSource` is the recovery and `sheetRecovery` is what attaches it, and
 * the section after the boot runs both.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootSource } from '../../vite/boot-source.js'
import { SHEET_HANDLER, sheetRecovery, sheetSource } from '../../vite/sheet-source.js'

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
// what the page does with each of the failures rather than which words the boot
// spells them with.
//
// A `SyntaxError` off the entry is two of them. The engine is asked which, by
// being handed the syntax the bundle is built out of, so `Function` is swapped
// out here the same way the loader is: refusing it is a browser from before the
// syntax, and compiling it is a browser this site targets holding a build that
// is broken for everybody.
const boot = bootSource('/assets/index-TEST0000.js')

async function runBoot(answers, { session = {}, online = true, understands = true } = {}) {
  const asked = []
  const shown = []
  let reloads = 0
  const stub = {
    loader: address => {
      asked.push(address)
      const answer = answers[Math.min(asked.length - 1, answers.length - 1)]
      return answer ? Promise.reject(answer) : Promise.resolve({})
    },
    Function: source => {
      if (!understands) throw new SyntaxError('Unexpected token ?')
      return globalThis.Function(source)
    },
    document: {
      createElement: () => ({ style: {}, textContent: '', setAttribute() {} }),
      body: { appendChild: node => shown.push(node) },
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
  return { asked, reloads, session, shown }
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

await new Promise(resolve => setTimeout(resolve, 0))
const before = filed.length

// The client #525 and #532 both came from: an engine years older than `?.`,
// under a current browser's user-agent string it plainly was not.
const old = await runBoot([unparsable()], { understands: false })
check(
  old.asked.length === 1,
  'a bundle the engine cannot parse is asked for again, which parses no better and costs the reader the download twice over'
)
check(
  old.reloads === 0,
  'a bundle the engine cannot parse reloads the document, and that reload can never be the last one'
)
check(
  old.shown.length === 1,
  'a reader whose browser cannot run any build of this site is left on a document that answers nothing they press, and never told why'
)
check(
  old.shown.length === 1 && /too old/.test(old.shown[0].textContent),
  'the notice for a browser that cannot run the page does not say that is what happened'
)
await new Promise(resolve => setTimeout(resolve, 0))
check(
  filed.length === before,
  'a browser the site has never supported is filed as a fault against the site, under a fresh fingerprint on every visit because the message is what groups them'
)

// The same error off an engine that understands the syntax perfectly well,
// which is a build that shipped broken and is refused by every reader on the
// site. Nothing about that is the reader's browser and it has to be loud.
const broken = await runBoot([unparsable()])
check(
  broken.shown.length === 0,
  'a build that shipped broken syntax tells every reader their browser is out of date'
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

/* ----------------------------------------------------------------------- *
 * The sheet, which had no recovery of any kind.
 * ----------------------------------------------------------------------- */

// Every hashed file above has something behind it and the stylesheet had
// nothing. Beasties writes the rules a route's markup needs into the head and
// leaves the sheet on `media="print"` with an `onload` that switches it on, so
// a sheet that does not arrive never switches, is never asked for again, and
// reports a failure the page then does nothing about. #528 was that.
//
// What it costs is hidden on the route the inlined subset was computed for -
// that markup is dressed by definition. The reader pays for it on the next
// route, which is rendered against the previous one's subset, and on every
// panel and dialog after that.
//
// Run rather than read, same as the boot: the recovery is an attribute the
// browser calls, so the attribute is read back off the element and called.
function sheetAttempts() {
  const inserted = []
  const timers = []
  const removed = []
  let reloads = 0
  const head = {
    insertBefore(node) {
      inserted.push(node)
      node.parentNode = head
    },
    removeChild(node) {
      removed.push(node)
    },
  }
  const element = () => ({
    rel: '',
    media: '',
    href: '',
    crossOrigin: '',
    parentNode: head,
    written: {},
    getAttribute(name) {
      return name in this.written ? this.written[name] : null
    },
    setAttribute(name, value) {
      this.written[name] = String(value)
    },
    removeAttribute(name) {
      delete this.written[name]
    },
  })
  const stub = {
    document: { createElement: element },
    setTimeout: (run, wait) => timers.push({ run, wait }),
    Number,
    location: {
      reload: () => {
        reloads += 1
      },
    },
    window: {},
  }
  const names = Object.keys(stub)
  new Function(...names, sheetSource())(...names.map(name => stub[name]))

  const first = element()
  first.rel = 'stylesheet'
  first.media = 'print'
  first.crossOrigin = 'anonymous'
  first.href = 'https://www.taylorurl.com/assets/index-TEST0000.css'

  const asked = []
  let link = first
  let attempt = 0
  // The sheet never lands, so this runs until the recovery itself gives up.
  for (let guard = 0; guard < 8; guard += 1) {
    stub.window[SHEET_HANDLER](link, attempt)
    const timer = timers.shift()
    if (!timer) break
    timer.run()
    const next = inserted[inserted.length - 1]
    if (!next || next === link) break
    asked.push({
      href: next.href,
      media: next.media,
      rel: next.rel,
      crossOrigin: next.crossOrigin,
      onload: next.getAttribute('onload'),
      wait: timer.wait,
    })
    const said = String(next.getAttribute('onerror') || '').match(
      new RegExp(SHEET_HANDLER + '\\(this,(\\d+)\\)')
    )
    if (!said) break
    link = next
    attempt = Number(said[1])
  }
  return { asked, reloads, removed, served: first }
}

const sheet = sheetAttempts()
check(
  sheet.asked.length === 2,
  `a sheet that did not arrive is asked for ${sheet.asked.length} more times rather than 2, so the reader keeps the inlined subset for the life of the page`
)
check(
  sheet.asked.every(ask => ask.href.includes('retry=')),
  'the sheet is asked again at the address that just failed, which is one the browser already has an answer for'
)
check(
  new Set(sheet.asked.map(ask => ask.href)).size === sheet.asked.length,
  'two attempts at the sheet share an address, so the second of them sends nothing'
)
check(
  sheet.asked.every(ask => ask.media === 'print'),
  'a retried sheet is asked for on a media query that matches, so it holds the paint the inlining exists to release'
)
check(
  sheet.asked.every(ask => /media\s*=\s*'all'/.test(ask.onload || '')),
  'a retried sheet that lands is never switched on, so the recovery fetches a file and applies none of it'
)
check(
  sheet.asked.every(ask => ask.rel === 'stylesheet' && ask.crossOrigin === 'anonymous'),
  'a retried sheet drops the attributes the first one carried, so it is fetched as something other than the sheet it replaces'
)
check(
  sheet.asked.every((ask, index) => ask.wait === 350 * (index + 1)),
  'the attempts at the sheet do not back off, so a server under load is asked three times in a moment'
)
check(
  sheet.reloads === 0,
  'a sheet that did not arrive reloads the document, which races the reload the boot already does for the deploy that deleted it'
)
// Rollup's preload helper appends a stylesheet it cannot already find at that
// exact href. Take the served sheet out and it puts a second copy of the
// address that just failed back, which fails again and rejects the chunk
// import that asked for it - a sheet failing becomes a route failing.
check(
  !sheet.removed.includes(sheet.served),
  'the sheet the document was served with is taken out of the head, so the bundle appends its own copy of the address that just failed and the chunk that asked for it rejects'
)
check(
  sheet.served.getAttribute('onerror') === null,
  'the served sheet is left holding the handler that already fired, so a second error on it starts the attempts over'
)
check(
  sheet.removed.length === sheet.asked.length - 1,
  'the attempts pile up in the head rather than each replacing the last'
)

// And the wiring, which is the half that can be correct and never reached. A
// recovery nothing calls is the failure this file exists to make impossible.
const BEASTIES_SHEET =
  '<link rel="stylesheet" crossorigin href="/assets/index-TEST0000.css" media="print" onload="this.media=\'all\'">'
const wired = sheetRecovery(
  `<head><style>a{}</style>${BEASTIES_SHEET}<noscript>${'<link rel="stylesheet" crossorigin href="/assets/index-TEST0000.css">'}</noscript></head>`
)
check(
  new RegExp(`onerror="${SHEET_HANDLER}\\(this,0\\)"`).test(wired),
  'the sheet Beasties defers is written without a catch, so the recovery below it is never called'
)
check(
  wired.indexOf(`window.${SHEET_HANDLER}=`) < wired.indexOf(`onerror="${SHEET_HANDLER}`),
  'the handler is declared after the link that names it, so an early failure is a ReferenceError rather than a retry'
)
check(
  (wired.match(/onerror=/g) || []).length === 1,
  'the copy of the sheet inside <noscript> was given a catch too, which no script could ever run'
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
    'without the page, and a sheet that did not arrive is asked for again rather than left ' +
    'as the styling for the rest of the visit'
)
