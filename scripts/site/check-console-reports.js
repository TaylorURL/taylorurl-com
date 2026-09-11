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
 * offers a `Worker`, and the `fetch` it does offer never answers on its own, so
 * reports fall through to `sendBeacon`, which is the one transport a test can
 * read.
 */
function collector(scriptTags, siteTags) {
  const posted = []
  const listeners = {}
  const watching = {}
  // Requests the page has asked for and the network has not yet done anything
  // about. Held open deliberately: the fault this file guards against is
  // decided by what happens to the document while a request is in flight, so a
  // test has to be able to leave one there.
  const inFlight = []
  const sandbox = {
    Promise,
    TypeError,
    fetch(address) {
      let settle
      let fail
      const answer = new Promise((resolve, reject) => {
        settle = resolve
        fail = reject
      })
      inFlight.push({ address, settle, fail })
      return answer
    },
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
      visibilityState: 'visible',
      addEventListener(type, handler) {
        ;(watching[type] = watching[type] || []).push(handler)
      },
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
  // What the block above this one in the page recorded itself as having
  // written. Left off, this is a page whose tags never got that far.
  if (siteTags) sandbox.__siteTags = siteTags
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
    // The other door into the collector, and the one a boot that never started
    // comes through.
    rejects(reason) {
      for (const handler of listeners.unhandledrejection || [])
        handler({ preventDefault() {}, reason })
    },
    held() {
      return sandbox.window.__reporter.replay()
    },
    /* The document going away and coming back, in the two shapes a phone does
     * it in. Backgrounding hides the tab and may never fire `pagehide`;
     * freezing the page into the back/forward cache fires both. */
    hidden() {
      sandbox.document.visibilityState = 'hidden'
      for (const handler of watching.visibilitychange || []) handler({})
    },
    shown() {
      sandbox.document.visibilityState = 'visible'
      for (const handler of watching.visibilitychange || []) handler({})
    },
    frozen() {
      sandbox.document.visibilityState = 'hidden'
      for (const handler of watching.visibilitychange || []) handler({})
      for (const handler of listeners.pagehide || []) handler({})
    },
    thawed() {
      sandbox.document.visibilityState = 'visible'
      for (const handler of listeners.pageshow || []) handler({})
      for (const handler of watching.visibilitychange || []) handler({})
    },
    /**
     * Asks for something through the page's own wrapped `fetch` and hands back
     * the two ways the network can end it. Nothing is decided at the asking:
     * a test hides the document, restores it, and only then fails the request,
     * because that is the order the fault happens in on a phone.
     */
    asks(address) {
      const answer = sandbox.window.fetch(address)
      // The wrapper rethrows what it was handed, which is the site's own code
      // catching it in a browser and this process's unhandled rejection here.
      answer.catch(() => {})
      const request = inFlight[inFlight.length - 1]
      const drain = () => new Promise(resolve => setImmediate(resolve))
      return {
        loses() {
          request.fail(new TypeError('Load failed'))
          return drain()
        },
        answers(status) {
          request.settle({ status })
          return drain()
        },
      }
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

/* ----------------------------------------------------------------------- *
 * The stack that carries no sentence.
 * ----------------------------------------------------------------------- */

// `stack` is not the same property on both engines. V8 heads it with
// `name: message` and puts the frames underneath, so filing the stack files the
// sentence too. WebKit writes the frames alone, so filing the stack on every
// Safari and every iPhone files an address and no account of what happened at
// it -- and the ticket title is drawn from the message.
//
// #529 was one of these: an unhandled rejection off Applebot whose entire
// reported content was `@https://taylor.website/services:101:32`, over the
// Error below. The boot builds that sentence deliberately, to say which of its
// three failures this was and to repeat what the engine said, and all of it was
// dropped on the way to the queue.
//
// It reads correct from a desk, which is the reason it stood: the same fault
// off Chrome arrives complete, so the reporter looks right on the machine
// anybody would check it on and is empty on half the traffic.
const WEBKIT_FRAME = '@https://www.taylorurl.com/start:101:32'
const webkit = collector()
webkit.rejects({
  name: 'Error',
  message: 'The page could not start: TypeError: Failed to fetch dynamically imported module',
  stack: WEBKIT_FRAME,
})
check(
  webkit.posted.length === 1,
  'an unhandled rejection was not filed at all, so the reporter has gone quiet on the one path ' +
    'a boot that never started reports through'
)
check(
  /could not start/.test((webkit.posted[0] || {}).message || ''),
  'a rejection off WebKit was filed with its frames and without its message, so the ticket ' +
    'names a line and cannot say what went wrong at it'
)
check(
  ((webkit.posted[0] || {}).stack || '').includes(WEBKIT_FRAME),
  'a rejection was filed without the frame it came from, so nobody reading it can open the line'
)

// And the engine that already said it. V8 puts the message at the head of the
// stack itself, so a head added there regardless would file it twice over.
const chrome = collector()
chrome.rejects(new Error('The page could not start: TypeError: Failed to fetch'))
check(
  (String((chrome.posted[0] || {}).message || '').match(/could not start/g) || []).length === 1,
  'a rejection off V8 is filed with its message twice, because a head was put back on a stack ' +
    'that already carried one'
)

// A thrown value with a stack and nothing else on it is most of what arrives
// from a minified bundle, and it still reports exactly as it did.
const bare = collector()
bare.rejects({ stack: 'TypeError: e.plan is undefined\n  at https://www.taylorurl.com/a.js:1' })
check(
  /e\.plan is undefined/.test((bare.posted[0] || {}).message || ''),
  'a rejection carrying only a stack stopped reporting what that stack said'
)

/* ----------------------------------------------------------------------- *
 * The loader host that serves two different things.
 * ----------------------------------------------------------------------- */

// The page writes one script tag to `googletagmanager.com`, for its own
// account. Google's library then loads a second container off the same host for
// every other account configured on the page, at an address carrying the `cx`
// and `gtm` chain parameters the page never writes. Blocked, that second one
// arrives here looking exactly like the site's own loader failing -- same host,
// same path -- and #549 was one of them, filed off `/unsubscribe` against a
// site that was working.
const SITE_TAGS = [
  'https://www.googletagmanager.com/gtag/js?id=G-TEST',
  'https://connect.facebook.net/en_US/fbevents.js',
]
function scriptFailure(address) {
  return {
    target: {
      tagName: 'SCRIPT',
      src: address,
      hasAttribute: () => false,
      getAttribute: () => null,
    },
  }
}

const chained = collector(TAG_SCRIPTS, SITE_TAGS)
chained.throws(
  scriptFailure('https://www.googletagmanager.com/gtag/js?id=AW-1841574&cx=c&gtm=4e69')
)
check(
  chained.posted.length === 0,
  'a container Google loaded off its own host was filed as a site fault, so a blocked ad tag ' +
    'is opening tickets against a site nobody can fix them on'
)
check(
  chained.held().some(entry => entry.kind === 'beacon'),
  'a chained tag was dropped rather than held, so the live console can no longer see that the ' +
    'vendor traffic is failing at all'
)

// The tag the site writes itself is the site's own wiring, and it still
// reports - but not from here. One failure read on its own cannot tell a
// library that stopped being served from a reader who refuses the host, so this
// listener holds it and the block that wrote the tag decides, once it knows
// what became of the other one. The two checks below are that verdict.
const ours = collector(TAG_SCRIPTS, SITE_TAGS)
ours.throws(scriptFailure('https://www.googletagmanager.com/gtag/js?id=G-TEST'))
check(
  ours.posted.length === 0,
  'the site’s own tag was filed the moment it failed, so the reader who blocks the host is ' +
    'opening a ticket again before anything has looked at what the other vendor did'
)
check(
  ours.held().some(entry => entry.kind === 'tag'),
  'the site’s own tag failed and was dropped rather than held, so a live console can no longer ' +
    'see that the page’s own wiring is failing at all'
)

// And with no list to answer from there is no answer, so the loud reading
// stands. A page whose tag block never ran reports the host exactly as it did
// before any of this.
const unknown = collector(TAG_SCRIPTS)
unknown.throws(
  scriptFailure('https://www.googletagmanager.com/gtag/js?id=AW-1841574&cx=c&gtm=4e69')
)
check(
  unknown.posted.length === 1,
  'a page that recorded no tags of its own went quiet on a loader host anyway, so the filter ' +
    'is guessing where it has nothing to compare against'
)

/* ----------------------------------------------------------------------- *
 * Which of the two things a failed tag was.
 * ----------------------------------------------------------------------- */

// The verdict itself, asked of the block that actually writes the tags. Reading
// the reporter alone would only ever show these failures being held, which is
// half the rule and the harmless half -- a change that stopped filing the real
// absence would pass every check above this line while the site quietly lost
// the one report on this host that was ever worth having.
const loader = scripts.find(source => source.includes('__siteTags = []'))
if (!loader) {
  console.error('check-console-reports: failed')
  console.error('  the page no longer carries the block that writes its tags')
  process.exit(1)
}

/**
 * Stands the tag block up, fetches its tags, and hands back a way to answer
 * each one. Nothing here is a browser: `document.head` collects the script
 * elements the block appends, and answering one runs the handler the block hung
 * on it.
 */
function tagLoader() {
  const filed = []
  const appended = []
  const listeners = {}
  const sandbox = {
    Date,
    URL,
    setTimeout() {},
    addEventListener(type, handler) {
      ;(listeners[type] = listeners[type] || []).push(handler)
    },
    removeEventListener() {},
    location: { search: '' },
    document: {
      createElement() {
        const node = { async: false, src: '', crossOrigin: null, on: {} }
        node.addEventListener = (type, handler) => {
          node.on[type] = handler
        }
        return node
      },
      head: { appendChild: node => appended.push(node) },
    },
  }
  sandbox.window = sandbox
  // The reporter block runs after this one in the page and is long since up by
  // the time a tag settles, so the door it opens is here from the start.
  sandbox.__reporter = {
    file(kind, message) {
      filed.push({ kind, message })
    },
  }
  const context = vm.createContext(sandbox)
  new vm.Script(loader, { filename: 'https://www.taylorurl.com/start' }).runInContext(context)
  // A reader's first touch is what fetches them on a page carrying no click
  // identifier, and a scroll counts, so this is the ordinary arrival.
  for (const handler of listeners.pointerdown || []) handler({})
  const settled = new Set()
  return {
    filed,
    written: sandbox.__siteTags,
    fetched: appended.map(node => node.src),
    // The oldest ask to that host nobody has answered yet. A tag refused for
    // its CORS mode is asked for a second time, so a host can have two requests
    // outstanding and answering the first one again would say nothing about the
    // one actually in flight.
    answer(host, arrived) {
      const node = appended.find(each => each.src.includes(host) && !settled.has(each))
      if (!node) throw new Error(`the page wrote no unanswered tag to ${host}`)
      settled.add(node)
      node.on[arrived ? 'load' : 'error']({})
      return node
    },
    // The second ask, which exists only where the first was refused. A change
    // that stops asking twice leaves nothing here to answer, and that has to
    // reach the check describing it rather than throw out of the suite three
    // checks earlier.
    again(host, arrived) {
      const node = appended.find(each => each.src.includes(host) && !settled.has(each))
      if (!node) return false
      settled.add(node)
      node.on[arrived ? 'load' : 'error']({})
      return true
    },
    asks(host) {
      return appended.filter(each => each.src.includes(host))
    },
  }
}

// The rule below reads one tag's failure against the other's answer, so it has
// nothing to read at all on a page that writes one tag. A future that drops the
// pixel has to decide what this host reports on its own before it goes.
const wrote = tagLoader()
check(
  wrote.fetched.length === 2 && wrote.written.length === 2,
  'the page no longer fetches two tags from two vendors, so one failure has nothing to be read ' +
    'against and every reader running a blocker files a ticket again'
)

// Both vendors refused in the same instant. Nothing this site does reaches
// Google's CDN and Meta's at once, so this is the reader's blocker or the
// reader's connection, and it is the shape #558 arrived in nine times.
const blocked = tagLoader()
blocked.answer('googletagmanager.com', false)
blocked.again('googletagmanager.com', false)
blocked.answer('connect.facebook.net', false)
check(
  blocked.filed.length === 0,
  'both vendors failed together and a ticket was filed anyway, so every reader running a content ' +
    'blocker is opening one against a site nobody can fix it on'
)

// One gone while the other arrived. That is a real absence on a connection that
// was working, and it is the report this host is worth having.
const missing = tagLoader()
missing.answer('connect.facebook.net', true)
missing.answer('googletagmanager.com', false)
missing.again('googletagmanager.com', false)
check(
  missing.filed.length === 1 &&
    missing.filed[0].kind === 'resource' &&
    missing.filed[0].message.includes('googletagmanager.com'),
  'the analytics tag stopped arriving on a connection that was otherwise fine and nothing was ' +
    'filed, so the site has gone silent on its own wiring instead of quieter'
)
// Worded as the reporter's own resource branch words it. The collector groups
// by the message, so a wording of its own here files one fault under two names
// and starts its history over on every deploy.
check(
  missing.filed[0] &&
    missing.filed[0].message ===
      'Failed to load script: https://www.googletagmanager.com/gtag/js?id=%SITE_GA_ID%',
  'the loader files a failed tag in words the reporter does not use, so the same fault arrives at ' +
    'the collector under a second name and neither one ever counts a recurrence'
)

// The other direction, which is the same rule and the tag that pays for the ad
// account rather than the property.
const noPixel = tagLoader()
noPixel.answer('googletagmanager.com', true)
noPixel.answer('connect.facebook.net', false)
check(
  noPixel.filed.length === 1 && noPixel.filed[0].message.includes('connect.facebook.net'),
  'the pixel stopped arriving while Google’s tag loaded and nothing was filed, so an audience ' +
    'nobody is reaching reads exactly like an audience nobody clicked'
)

// A verdict is never reached on one answer. Until the second tag has said
// something, the first one failing means nothing either way.
const waiting = tagLoader()
waiting.answer('googletagmanager.com', false)
waiting.again('googletagmanager.com', false)
check(
  waiting.filed.length === 0,
  'a failed tag was filed before the other had answered, so the rule is decided on the half of ' +
    'the evidence that cannot decide it'
)

/* ----------------------------------------------------------------------- *
 * The half a blocker takes and the half it leaves.
 * ----------------------------------------------------------------------- */

// #563, and the reason #558's rule did not hold. Only Google's tag is asked for
// in CORS mode, so anything answering on a vendor's behalf - a blocker's stub, a
// proxy notice, an antivirus re-signing the reply - is refused on that tag and
// loads on Meta's. One down, one arrived: the rule above reads that as a real
// absence, and this reader files it on every visit.
//
// The second ask is what separates a refused CORS mode from a missing library,
// and a tag that arrives on it is a tag this reader gets to keep.
const substituted = tagLoader()
substituted.answer('googletagmanager.com', false)
substituted.again('googletagmanager.com', true)
substituted.answer('connect.facebook.net', true)
check(
  substituted.filed.length === 0,
  'the analytics tag was refused for its CORS mode, arrived on the plain ask and was filed anyway, ' +
    'so a reader whose proxy or blocker answers for one vendor opens a ticket every time they visit'
)

// And it has to be a different request, or it is the same refusal twice and the
// tag stays lost on exactly the readers this is for.
const asks = substituted.asks('googletagmanager.com')
check(
  asks.length === 2 && asks[0].crossOrigin === 'anonymous' && asks[1].crossOrigin === null,
  'the tag is asked for a second time in the same CORS mode that was just refused, so the ask ' +
    'cannot tell a refused mode from a missing library and recovers nobody'
)

// Meta's tag is not asked for in CORS mode, so it has nothing to fall back to
// and must not be fetched twice.
const pixelOnce = tagLoader()
pixelOnce.answer('connect.facebook.net', false)
check(
  pixelOnce.asks('connect.facebook.net').length === 1,
  'the pixel is fetched a second time after it fails, so a tag that was never asked for in CORS ' +
    'mode pays for a retry that can only repeat its own failure'
)

// The library genuinely gone still reports, which is the whole reason this host
// was ever left reportable. Neither ask arrives, and the pixel does.
const reallyGone = tagLoader()
reallyGone.answer('connect.facebook.net', true)
reallyGone.answer('googletagmanager.com', false)
reallyGone.again('googletagmanager.com', false)
check(
  reallyGone.filed.length === 1 &&
    reallyGone.filed[0].message ===
      'Failed to load script: https://www.googletagmanager.com/gtag/js?id=%SITE_GA_ID%',
  'the analytics tag failed on both asks while the pixel arrived and nothing was filed, so the ' +
    'second ask has silenced the one report on this host that was ever worth having'
)

/* ----------------------------------------------------------------------- *
 * The request the phone took away.
 * ----------------------------------------------------------------------- */

// A request still in flight when the document is taken off the screen is torn
// down by the system, and WebKit words that as a plain `TypeError: Load
// failed` -- the same sentence an endpoint that will not answer produces. The
// difference is not in the error, it is in where the document was while the
// request was outstanding, and that has to be read across the life of the
// request rather than at the end of it: a frozen page runs no handlers, so the
// rejection lands on the way back, once everything on screen says the reader
// never went anywhere.
//
// The call desk is where this concentrates, because it is the one feed on the
// site that deliberately keeps working while the tab is hidden -- a caller who
// tabs away to look up an address is still on the phone, so the console goes on
// saying it holds the number. Every other feed stops when the tab does. That is
// why one endpoint out of all of them kept being filed as unreachable while it
// answered every request actually put to it: #455, #457 and #553 are all this.
const DESK = '/api/calls-desk'

// First the direction that matters most, and the reason none of the rest may
// be written as a mute. A request asked for on screen, answered on screen and
// failing there has a reader in front of it who just watched it fail.
const watched = collector()
await watched.asks(DESK).loses()
check(
  watched.posted.length === 1,
  'a request that failed while the reader was looking at the page was not filed, so the ' +
    'reporter has gone quiet on the failures somebody is actually sitting in front of'
)
check(
  /Load failed fetching \/api\/calls-desk/.test((watched.posted[0] || {}).message || ''),
  'a failed request was filed without saying what failed or where, which is the whole content ' +
    'of a network report'
)

// The page frozen into the back/forward cache and brought back. `pagehide`
// fired, `pageshow` put the flag down again, and only then was the failure
// delivered -- the exact sequence that let this fault back through after it
// was fixed.
const cached = collector()
const acrossFreeze = cached.asks(DESK)
cached.frozen()
cached.thawed()
await acrossFreeze.loses()
check(
  cached.posted.length === 0,
  'a request the browser tore down while the page was frozen was filed as an endpoint failing, ' +
    'because the leaving flag was read after `pageshow` had already put it back down'
)
check(
  cached.held().some(entry => entry.kind === 'aborted'),
  'a request cancelled by leaving was dropped rather than held, so a live console can no longer ' +
    'see that it went at all'
)

// And the same teardown without the event that used to be the whole test.
// Locking an iPhone or switching apps hides the document and lets the system
// suspend the web view under it; nothing is frozen and nothing is unloaded, so
// `pagehide` never fires.
const backgrounded = collector()
const acrossHide = backgrounded.asks(DESK)
backgrounded.hidden()
backgrounded.shown()
await acrossHide.loses()
check(
  backgrounded.posted.length === 0,
  'a request killed by the phone suspending a hidden tab was filed as a fault, so every reader ' +
    'who locks their screen mid-call opens a ticket against an endpoint that is answering'
)

// A request the page asked for while it was already away, which is what the
// desk's beat does for as long as it is holding a number.
const away = collector()
away.hidden()
const whileAway = away.asks(DESK)
await whileAway.loses()
check(
  away.posted.length === 0,
  'a request issued while the document was off screen was filed as a fault, so a console left ' +
    'holding a number reports one every time the phone sleeps'
)

// The direction that keeps the guard honest. An endpoint that answers badly
// has answered: the document was there to receive it, whatever it did in
// between, and a 500 is the site breaking in a way no teardown explains.
const answered = collector()
const acrossTrip = answered.asks(DESK)
answered.frozen()
answered.thawed()
await acrossTrip.answers(500)
check(
  answered.posted.length === 1,
  'a server error was swallowed because the reader had switched tabs while it was being made, ' +
    'so the guard has widened off transport failures and onto the site’s own faults'
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
