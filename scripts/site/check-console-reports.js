#!/usr/bin/env node
/**
 * That the extension test the reporter already carries can actually reach a
 * console report.
 *
 *   npm run check:console-reports
 *
 * An extension injects its scripts into the page, so anything thrown inside one
 * arrives carrying nothing of the site in its stack, and `extensionOnly` is
 * where that is ruled the visitor's browser rather than the site's fault. It
 * reads a stack, and it is only ever as good as the stack it is handed.
 *
 * A throw and an unhandled rejection both arrive holding one. A console call
 * does not: it arrives with its arguments and nothing whatever about where it
 * came from, so for as long as the console wrappers filed without one the test
 * was handed `undefined`, answered false, and every line an extension wrote to
 * `console.error` was filed as a fault against this site. On 2026-09-10 that
 * was six tickets off a single page load on `/start` -- a userscript in one
 * visitor's browser narrating itself, in a language the site does not publish
 * in, against a page that was working.
 *
 * That is the failure worth guarding against, because of how it reads from the
 * outside: the filter was there, it was documented, it was correct, and on one
 * of the three paths into the collector it was dead code. Nothing announces a
 * filter that never fires. So this asks the question behaviourally rather than
 * by reading the source -- it runs the page's own reporter and watches what
 * reaches the collector -- and a stack that stops carrying the caller fails it
 * whatever the wrappers look like.
 *
 * Both directions are checked, and the second matters more than the first. The
 * site's own code is served from this origin and never from an extension one,
 * so a site frame survives the strip and reports exactly as it always has. A
 * change here that started swallowing the site's own console output would be
 * the reporter going quiet, which is the one failure this whole file exists to
 * make impossible.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const PAGE = readFileSync(path.join(ROOT, 'index.html'), 'utf8')

const failures = []
let checks = 0
function check(condition, complaint) {
  checks += 1
  if (!condition) failures.push(complaint)
}

const scripts = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1])
const reporter = scripts.find(source => source.includes('/report'))
if (!reporter) {
  console.error('check-console-reports: failed')
  console.error('  the page no longer carries an inline script that names the collector')
  process.exit(1)
}

/**
 * Stands the reporter up on its own and returns what it posts. Nothing here
 * offers a `Worker` or a `fetch`, so reports fall through to `sendBeacon`,
 * which is the one transport a test can read.
 */
function collector(scriptTags) {
  const posted = []
  const listeners = {}
  const sandbox = {
    JSON,
    URL,
    Error,
    Blob: class {},
    location: {
      href: 'https://www.taylorurl.com/start',
      search: '',
      origin: 'https://www.taylorurl.com',
      hostname: 'www.taylorurl.com',
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_1 like Mac OS X) Safari/604.1',
      sendBeacon(endpoint, body) {
        posted.push(JSON.parse(body))
        return true
      },
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener(type, handler) {
      ;(listeners[type] = listeners[type] || []).push(handler)
    },
    document: {
      addEventListener() {},
      // What the page has fetched from elsewhere, which is what the reporter
      // reads to say where a muted throw could have come from.
      getElementsByTagName: () => scriptTags || [],
    },
    console: { error() {}, warn() {}, trace() {}, assert() {}, log() {} },
    setTimeout() {},
    clearTimeout() {},
  }
  sandbox.window = sandbox
  sandbox.self = sandbox
  const context = vm.createContext(sandbox)
  new vm.Script(reporter, { filename: 'https://www.taylorurl.com/start' }).runInContext(context)
  return {
    posted,
    // Runs a line of script as though it had been served from `origin`, which
    // is what puts that address into the frames the reporter reads.
    from(origin, body) {
      new vm.Script(body, { filename: origin }).runInContext(context)
    },
    // Hands the page's own `error` listener an event, which is the only way to
    // ask what it does with one. Reading the source instead is how a filter
    // gets to be documented, correct and never reached.
    throws(event) {
      for (const handler of listeners.error || []) handler({ preventDefault() {}, ...event })
    },
    held() {
      return sandbox.window.__reporter.replay()
    },
  }
}

// In a browser an injected script's stack ends at its own top level. Left
// alone, the VM splices this process's frames on underneath -- a `file://`
// address no page can ever see, which would put a non-extension scheme in front
// of the test and pass this file for the wrong reason.
Error.stackTraceLimit = 2

const extension = collector()
extension.from(
  'safari-web-extension://A1B2C3/asl.js',
  "function scanListeners() { console.error('[ASL] anti-cheat listener detected') }\nscanListeners()"
)
check(
  extension.posted.length === 0,
  'a line an extension wrote to the console was filed as a fault against this site, ' +
    'so the console path is reaching the collector without a stack again'
)

const site = collector()
site.from(
  'https://www.taylorurl.com/assets/index-abcd1234.js',
  "function loadPanel() { console.error('a real failure in the site') }\nloadPanel()"
)
check(
  site.posted.length === 1,
  'the site wrote to the console and nothing was filed, so the reporter has gone quiet ' +
    'on its own code'
)
check(
  /assets\/index-abcd1234\.js/.test((site.posted[0] || {}).stack || ''),
  'a console report reached the collector without the frame it came from, so whoever reads ' +
    'it cannot tell which file wrote it'
)

// `console.assert` files through the same door and was the same dead end.
const asserted = collector()
asserted.from(
  'safari-web-extension://A1B2C3/asl.js',
  "function guard() { console.assert(false, 'extension assertion') }\nguard()"
)
check(
  asserted.posted.length === 0,
  'a failed assertion inside an extension was filed against this site, so `console.assert` ' +
    'still reports without a stack'
)

/* ----------------------------------------------------------------------- *
 * The throw the browser refuses to describe.
 * ----------------------------------------------------------------------- */

// A script from another origin, fetched without `crossorigin`, is muted when it
// throws: "Script error.", no file, no line, no error object. There is nothing
// in it to act on and there never will be, so it is held for a live console
// rather than filed as a fault. #524 was one of these -- `/start`, opened from
// an ad inside an Android in-app browser, reporting those two words and nothing
// else.
const TAG_SCRIPTS = [
  { src: 'https://www.googletagmanager.com/gtag/js?id=G-TEST', crossOrigin: 'anonymous' },
  { src: 'https://connect.facebook.net/en_US/fbevents.js', crossOrigin: null },
  { src: 'https://www.taylorurl.com/assets/index-abcd1234.js', crossOrigin: 'anonymous' },
]
const MUTED = { message: 'Script error.', filename: '', lineno: 0, colno: 0, error: null }

const opaque = collector(TAG_SCRIPTS)
opaque.throws(MUTED)
check(
  opaque.posted.length === 0,
  'a throw the browser refused to describe was filed as a fault, so the queue is carrying a ' +
    'ticket whose message is two words and cannot ever carry more'
)
const heldOpaque = opaque.held().filter(entry => entry.kind === 'opaque')
check(
  heldOpaque.length === 1,
  'a muted throw was dropped rather than held, so a live console can no longer see that ' +
    'anything threw at all'
)
// The one script on the page that can still mute, named. Google's tag and the
// site's own bundle both carry the attribute and so report in full.
check(
  /connect\.facebook\.net/.test((heldOpaque[0] || {}).message || ''),
  'a muted throw was held without naming what the page fetched without CORS, which is the ' +
    'only lead there is on one'
)
check(
  !/googletagmanager|taylorurl\.com/.test((heldOpaque[0] || {}).message || ''),
  'a script fetched with `crossorigin` was named as a suspect in a muted throw, so the ' +
    'reporter is no longer reading the attribute that rules it out'
)

// And the direction that matters more. `muted` decides what never reaches the
// collector, so an over-broad one is the reporter going silent on real faults --
// the same failure this file already guards the console path against. An error
// carrying a file is the site's and stays filed, whatever else is true of it.
const real = collector(TAG_SCRIPTS)
real.throws({
  message: 'Uncaught TypeError: e.plan is undefined',
  filename: 'https://www.taylorurl.com/assets/index-abcd1234.js',
  lineno: 412,
  colno: 9,
  error: { stack: 'TypeError: e.plan is undefined\n  at https://www.taylorurl.com/assets/x.js:1' },
})
check(
  real.posted.length === 1,
  'an uncaught error naming its own file was not filed, so `muted` has widened onto the ' +
    'site’s own faults and the reporter has gone quiet on them'
)

// A muted throw with no candidate on the page is an extension or an in-app
// browser injecting one. Still not the site's, still held, and the empty list
// is the finding rather than a gap in it.
const injected = collector([])
injected.throws(MUTED)
check(
  injected.posted.length === 0 && injected.held().some(entry => entry.kind === 'opaque'),
  'a muted throw with nothing on the page to explain it was filed against the site, so an ' +
    'injected script is being reported as this site breaking'
)

if (failures.length) {
  console.error('check-console-reports: failed')
  for (const failure of failures) console.error(`  ${failure}`)
  console.error('  a line an extension wrote is the browser talking; only the site answers here')
  process.exit(1)
}

console.log(
  `check-console-reports: ${checks} checks hold — the console path files with the frames it ` +
    'came from, an extension writing to it is ruled the browser rather than the site, a throw ' +
    'the browser refused to describe is held rather than filed, and the output the site writes ' +
    'itself still reports'
)
