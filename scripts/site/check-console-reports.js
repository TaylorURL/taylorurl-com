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
function collector() {
  const posted = []
  const sandbox = {
    JSON,
    URL,
    Error,
    Blob: class {},
    location: {
      href: 'https://www.taylorurl.com/start',
      search: '',
      origin: 'https://www.taylorurl.com',
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_1 like Mac OS X) Safari/604.1',
      sendBeacon(endpoint, body) {
        posted.push(JSON.parse(body))
        return true
      },
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener() {},
    document: { addEventListener() {} },
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

if (failures.length) {
  console.error('check-console-reports: failed')
  for (const failure of failures) console.error(`  ${failure}`)
  console.error('  a line an extension wrote is the browser talking; only the site answers here')
  process.exit(1)
}

console.log(
  `check-console-reports: ${checks} checks hold — the console path files with the frames it ` +
    'came from, an extension writing to it is ruled the browser rather than the site, and ' +
    'the output the site writes itself still reports'
)
