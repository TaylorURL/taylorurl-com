import { lazy } from 'react'
import { wait } from '@lib/time/wait.js'
import { markReloaded, recentlyReloaded } from '@utils/reloadGuard'

const DEFAULT_RETRIES = 2
const DEFAULT_DELAY_MS = 350

// And one more attempt, long after the quick pair is spent.
//
// The two above are for a request that was dropped and lands on the next ask,
// and they are over inside eleven hundred milliseconds. The failures this
// actually sees last two or three seconds - an edge that has not got the new
// build yet, a phone changing networks, a proxy refusing for a moment - so a
// ladder that finishes in one second is a ladder spent entirely inside the
// outage. Measured against the built site with this chunk refused for three
// seconds and served from then on: three attempts gone by 1,534ms, the document
// reloaded at 1,628ms, three more gone by 2,951ms, and the reader left on the
// boundary's error screen from there - with the file answering every request
// from 3,000ms and nothing left to ask. That is #561.
//
// The stylesheet and the chrome were each given the same rung for the same
// reading (`vite/sheet-source.js`, `LateChrome`), and the route's own chunk was
// the one that never got it. Five seconds is past what these outages measure
// and short enough that the reader is still on the page.
const DEFAULT_WAITS = 1
const WAIT_MS = 5000

// How many retried addresses this page has already spent. Counted for the whole
// document rather than per pass, because the module map that makes a repeated
// address worthless is the document's: a second pass at the same piece, minutes
// later and on another page, numbering its attempts 1 and 2 again would ask for
// two addresses the map already holds a rejection for and send nothing for
// either. Measured against the built site with the chunk refused and then
// served, that was a renewal that reported a fresh failure without making a
// single request.
let spent = 0

// Something no address this browser has ever asked for can already contain.
//
// The count above is what made a retry address different from the built one,
// and it is not what makes it different from the last document's. It restarts
// at 0 in every document, so a pass that fails asks at the built address and
// then at retry 1, 2 and 3 - and the next document, and the one after that,
// ask at those same four.
//
// That would cost nothing if a refusal were forgotten. Every 404 under
// /assets/ is served `public, max-age=31536000, immutable`, because
// `vercel.json` matches those paths by pattern and Vercel applies a header rule
// whatever the status - so the four addresses a failed pass asks for are four
// entries the browser is told to keep for a year and never revalidate. The
// reload `ErrorBoundary` does next asks at those same four and is answered out
// of the cache with nothing sent, so it draws the error screen; and so does the
// visit after that, and the one after that, for as long as the chunk keeps its
// hash - with the file sitting there answering every request nobody is making.
// Measured against the built site with the chunk refused for 25 seconds and
// served from then on: the visit after the outage asked eight times, was
// answered from the cache eight times, reached the server zero times, and left
// the reader on the error screen. #570 was that.
//
// #561 measured its ladder against refusals served with no Cache-Control at
// all, which is why a fourth rung looked like the whole answer: every rung
// reached the server, so every rung was a real attempt. A rung is only an
// attempt if its address is one no cache holds an answer for, and one drawn
// fresh per document is.
const TOKEN = Math.random().toString(36).slice(2, 8)

// How many failed attempts a departure is allowed to take back.
//
// Bounded, because a document that leaves and returns over and over - a phone
// picked up and put down through a long page - would otherwise hand every rung
// back and never reach a verdict, and a chunk that really has gone would never
// be reported from that reader at all. Two is enough for the shape this
// actually sees, one departure under the request and one under the retry, and
// past it the ladder runs as it always did and reports if it runs out.
const FORGIVEN = 2

// The address inside the sentence a browser throws when a module will not load.
// Chrome and Edge say "Failed to fetch dynamically imported module: <url>", and
// Firefox and Safari word it differently and sometimes name no address at all -
// which is why nothing here depends on finding one.
const MODULE_URL = /\bhttps?:\/\/[^\s'")]+\.m?js\b/i

/**
 * The same chunk, at an address the browser has no answer cached for.
 *
 * A module that failed to load is recorded as failed in the module map, and the
 * record is keyed by URL and never expires. So a second `import()` of the same
 * specifier is not a second attempt: it is the first one's rejection handed
 * back, with nothing sent and nothing waited for. That is the whole reason the
 * retry below existed for months and had never once retried anything - the
 * loop ran, three rejections came back in under a second, all three were the
 * same rejection, and a chunk that would have answered on a real second attempt
 * was given up on as if it had refused three times.
 *
 * A query string neither the map nor the HTTP cache has seen is a different key
 * in both, and so a real request. It reaches the same file, because a hashed
 * asset is served by path and the query is ignored by everything that answers
 * for one.
 *
 * The address is read out of the message and its query dropped by the pattern
 * above, so what is numbered is always the built address rather than the last
 * attempt's.
 *
 * @param {unknown} error - What the failed import threw.
 * @returns {Promise<unknown>|null} The retried import, or null if the browser
 *   named no address to retry.
 */
function refetch(error) {
  const found = MODULE_URL.exec(String((error && error.message) || ''))
  if (!found) return null
  const address = new URL(found[0])
  spent += 1
  // One parameter, not two, and the token inside its value. `settled()` in
  // index.html drops `retry` whole before a failure is filed, so both halves
  // leave together and every document still reports the one built address -
  // which is what keeps a fault deduped as one fault rather than one per
  // reader.
  address.searchParams.set('retry', `${spent}.${TOKEN}`)
  return import(/* @vite-ignore */ address.href)
}

/**
 * How many times this document has gone away, as the reporter has been counting
 * it since the head ran: `pagehide` for a dismantled or frozen document, and a
 * `visibilitychange` into hidden for a phone that was locked or switched away
 * from without firing one.
 *
 * Read off the reporter rather than counted again here, because it is the same
 * question its `fetch` wrapper already asks about every request the page makes
 * and this is the one request that is not a `fetch`. A document with no
 * reporter - a test, a build - reads as never having left, so the ladder
 * behaves exactly as it did before any of this.
 *
 * @returns {number} The departure count, or 0 where nothing is counting.
 */
function departures() {
  const reporter = typeof window === 'undefined' ? null : window.__reporter
  return reporter && typeof reporter.left === 'function' ? reporter.left() : 0
}

/**
 * Whether the document is absent at this instant - off screen, or on its way
 * out and not yet back.
 *
 * Hidden was the whole of this question until #647, and it is the narrower of
 * the two. `visibilityState` turns on a tab switch, a locked phone and most
 * navigations, and it does not turn when the renderer is simply dropped: a tab
 * closed, or a measurement client that ends its run by destroying the target
 * rather than navigating it. `pagehide` fires in every one of those, and the
 * reporter has been latching it into `leaving` since it started counting
 * departures at all.
 *
 * Reading only the narrow one is what let this be filed a fourth time. A
 * document that fired `pagehide` with its visibility still `visible` reads as
 * present, so `onScreen` below returns at once, the forgiveness is spent on
 * attempts made into a document being dismantled, and the ladder reaches its
 * end and throws in front of a reader who left before the first attempt
 * finished. Driven against this module with the chunk refusing and the
 * document departing that way, the pass filed exactly the sentence #647
 * carries - on a file that answered 200 the whole time.
 *
 * @returns {boolean} True while the document is hidden or leaving.
 */
function away() {
  const reporter = typeof window === 'undefined' ? null : window.__reporter
  if (!reporter) return false
  if (typeof reporter.away === 'function' && reporter.away()) return true
  return Boolean(typeof reporter.leaving === 'function' && reporter.leaving())
}

/**
 * Settles when the document is on screen, and immediately if it already is.
 *
 * A pass that is waiting on this is a pass holding the Suspense fallback, which
 * is the right thing to be showing a document that nobody is looking at. If the
 * document is being dismantled rather than frozen this never settles and
 * nothing is thrown, which is the point: there is no reader left to fail in
 * front of, and a rejection handed to the boundary on the way out is a reload
 * and an error screen drawn over a page that is already gone.
 *
 * @returns {Promise<void>} Resolved once the document is visible again.
 */
function onScreen() {
  if (typeof document === 'undefined' || !away()) return Promise.resolve()
  return new Promise(resolve => {
    function back() {
      if (away()) return
      document.removeEventListener('visibilitychange', back)
      window.removeEventListener('pageshow', back)
      resolve()
    }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('pageshow', back)
  })
}

/**
 * The file name of the entry this document was served with.
 *
 * Every hashed asset the page will ever ask for is named by that one script, so
 * it stands for the whole build: if it is still being served, this document's
 * manifest is still good, and if it is not, none of the addresses in it are.
 *
 * @returns {string} The entry's file name, or '' where there is no document to
 *   read it off.
 */
function entryName() {
  if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return ''
  // Two ways a document names its entry, and this site uses the second.
  //
  // A plain Vite build writes `<script type="module" src>`. The prerender here
  // does not: the boot is an inline module written into the head, so there is
  // no `src` anywhere on the page and reading only that finds nothing - which
  // is a probe that can never fire, on every document the site actually
  // serves. What the build does write for the entry is a `modulepreload`, and
  // that carries the same hashed name.
  //
  // Either one answers the question, because the name is only ever being used
  // as a token for the build: any hashed file this document was served with is
  // absent from the document of a build that replaced it.
  const tag =
    document.querySelector('script[type="module"][src]') ||
    document.querySelector('link[rel="modulepreload"][href]')
  const address = tag && (tag.src || tag.href)
  if (!address) return ''
  try {
    return new URL(address, location.href).pathname.split('/').pop() || ''
  } catch {
    return ''
  }
}

/**
 * Whether the build this document is running from has been replaced under it.
 *
 * This is the shape the ladder above cannot ride out, and the one every fix
 * before it was built on the assumption of the opposite. A hashed file belongs
 * to the deploy that wrote it, the production alias flips from one deploy to
 * the next in a single step, and the build before it stops being served at that
 * instant - not slowly, not at one edge, and not temporarily. So a document
 * served seconds before a release goes live spends the rest of its life holding
 * a manifest of file names that have been deleted, and every rung of a ladder
 * whose premise is "wait, and the file comes back" is spent on a file that
 * cannot. Measured against the report that prompted this: the document was
 * served at 10:15:09, the release went live at 10:15:21, and the chunk it then
 * asked for had been gone for nineteen seconds by the time the failure was
 * filed against its address.
 *
 * The question is asked of the document rather than of the chunk, and once:
 * does the page this site serves right now still name the entry this page is
 * running from. Asking about the chunk would only say it is absent, which is
 * what a dropped request looks like too; asking about the build says why.
 *
 * It is asked with `fetch`, which puts it through the reporter's own wrapper
 * and so under the same "was this document here for the whole of the request"
 * test every other request on the page already gets - rather than adding one
 * more teardown tell to the list beside `away`. Anything short of a clear
 * answer reads as not superseded, because a probe that failed is no evidence.
 *
 * @returns {Promise<boolean>} True only where the served document no longer
 *   names this document's entry.
 */
async function superseded() {
  const entry = entryName()
  if (!entry || typeof fetch !== 'function' || typeof location === 'undefined') return false
  try {
    const address = new URL(location.pathname, location.href)
    address.searchParams.set('build', `${spent}.${TOKEN}`)
    const answer = await fetch(address.href, { cache: 'no-store' })
    if (!answer.ok) return false
    const served = await answer.text()
    return Boolean(served) && !served.includes(entry)
  } catch {
    return false
  }
}

/**
 * The only recovery a superseded build has: a newer document.
 *
 * Nothing is thrown and nothing ever resolves. The Suspense fallback holds for
 * the moment the reload takes, which is the last thing this document will draw,
 * and because the pass never rejects there is no boundary, no error screen and
 * no failure written to the console - which is what was being collected and
 * filed as a fault against an address no build on the server still has. A
 * reader recovered by a reload met no fault, and this is the same reload the
 * boundary was going to ask for six seconds later.
 *
 * It shares the boundary's guard rather than keeping one of its own, so a chunk
 * that stays broken still costs exactly one reload and then gets a screen the
 * reader can act on.
 *
 * Which is the whole reason this throws when the guard is already spent. Holding
 * and never settling is right while a reload is on its way, because the
 * fallback is the last thing this document draws and there is a newer one
 * arriving behind it. With the reload already taken it is right about nothing:
 * no document is coming, and a promise that never settles leaves the reader on
 * the Suspense fallback for the rest of the visit with no error screen, no
 * retry and nothing to press. The screen the boundary draws is worse-looking
 * and better - it is the one they can act on.
 *
 * @param {unknown} reason - What the pass died of, thrown where no reload is
 *   left to take.
 * @returns {Promise<never>} A promise that never settles, where a reload is on
 *   its way.
 */
function renew(reason) {
  if (typeof window === 'undefined' || recentlyReloaded()) throw reason
  markReloaded()
  window.location.reload()
  return new Promise(() => {})
}

/**
 * The same chunk, asked for ahead of the press that will need it.
 *
 * A warm-up is an offer rather than a request: nothing waits on it, and a
 * reader who never presses never learns whether it arrived. So the one thing it
 * must not do is fail loudly. Written as a bare `import()` inside a handler it
 * is a promise nobody holds, and a chunk a deploy has replaced rejects it into
 * `unhandledrejection` — which the page files as a fault the reader met, over a
 * hover that cost them nothing and that they may never follow with a press.
 *
 * The press is where the same missing chunk becomes something a reader can see,
 * and it is reported from there, by the boundary that catches it.
 *
 * @param {() => Promise<unknown>} factory - The dynamic import to start now.
 */
export function warm(factory) {
  factory().catch(() => {})
}

/**
 * `React.lazy` that survives a flaky first fetch. A route's code-split chunk is
 * requested the moment the view mounts, so a transient network blip — or a chunk
 * that is momentarily unavailable at the CDN edge right after a deploy — would
 * otherwise reject the import and, with no error boundary above it, blank the
 * whole app until the user manually reloads.
 *
 * Each attempt asks for the chunk at an address carrying its own attempt number,
 * for the reason given above `refetch`: asking for the same one again is not
 * asking again. The quick pair backs off 350ms and 700ms, and a last one waits
 * `WAIT_MS` so that the ladder reaches past the outage rather than into it. If
 * every attempt fails the rejection is re-thrown so the surrounding boundary can
 * take over — by then the likely cause is a chunk that no longer exists (a
 * superseded deploy), which no address recovers and only a newer document does.
 *
 * @param {() => Promise<{ default: React.ComponentType }>} factory - Dynamic
 *   import returning a module with a default-exported component.
 * @param {{ retries?: number, delayMs?: number, waits?: number, waitMs?: number, after?: unknown }} [options] -
 *   `after` is what an earlier pass at this same piece died of, as an error or as
 *   a function returning one. Given one, the plain address is skipped: it is the
 *   address that already failed, and the module map will hand back that failure
 *   without sending anything. A function because the only caller that knows -
 *   `resolveArrival`, which asks for the landed route's chunk ahead of hydration
 *   - learns it after this map is built and before React calls the factory.
 * @returns {React.LazyExoticComponent} A lazy component with retry built in.
 */
export function lazyWithRetry(
  factory,
  {
    retries = DEFAULT_RETRIES,
    delayMs = DEFAULT_DELAY_MS,
    waits = DEFAULT_WAITS,
    waitMs = WAIT_MS,
    after = null,
  } = {}
) {
  return lazy(async () => {
    let lastError = typeof after === 'function' ? after() : after
    let forgiven = 0
    // Whether the build has already been asked about. Once per pass: the answer
    // cannot change back, and a document that is superseded is superseded for
    // every rung that is left.
    let checked = false
    // Where the document stood when this pass opened. `pagehide` and the hide
    // are counted at different moments - a dismantling document fires
    // `pagehide` before `visibilityState` turns, so the rejection can arrive in
    // the gap between them and read as a document that is still here. Once
    // either has moved, this pass is running on a document on its way out and
    // every failure in it is read that way.
    const opened = departures()
    const last = retries + waits
    for (let attempt = 0; attempt <= last; attempt++) {
      // Where the document was when this attempt started, so the failure can be
      // asked the question the reporter's `fetch` wrapper asks about every
      // other request: was the document on screen for the whole of it.
      const left = departures()
      const startedAway = away()
      try {
        // The first attempt is the factory itself, so a chunk that loads
        // normally - which is all of them, nearly all of the time - is asked
        // for exactly as it was before any of this, at the address the build
        // wrote and with the preload the build issued for it. A pass that
        // already knows this address failed starts one line down instead.
        if (attempt === 0 && !lastError) return await factory()
        const again = refetch(lastError)
        if (!again) return await factory()
        return await again
      } catch (error) {
        lastError = error
        // A request the document was not there to receive an answer to.
        //
        // `Failed to fetch dynamically imported module` is what the browser
        // throws when the fetch does not complete, and a fetch torn down with
        // the document does not complete. So a chunk that is sitting on the
        // server answering every request put to it produces the same sentence
        // as one a deploy has deleted, on a reader who lost nothing: they
        // locked the phone, switched apps or closed the tab while the route was
        // still arriving. Handing that to the boundary reloads a document that
        // is already going and files the fault under the one address the whole
        // ladder reports as - which is how a chunk that has never once been
        // missing has now been filed three times.
        //
        // Every recovery on this site reports after it has given up, and this
        // is the rung that had not been told when it had not actually tried.
        // The attempt is given back rather than spent, and the pass waits for
        // the document to be on screen before asking again - so a reader who
        // comes back to the tab gets the page, and a document that never comes
        // back throws nothing at nobody.
        if (
          forgiven < FORGIVEN &&
          (startedAway || away() || departures() !== left || departures() !== opened)
        ) {
          forgiven += 1
          attempt -= 1
          await onScreen()
          continue
        }
        // Asked once, on the first failure this document was present for,
        // because the answer decides whether the rungs that are left are worth
        // spending at all. The ladder below reaches past an outage; a build
        // that has been replaced is not an outage, and no address recovers it.
        if (!checked) {
          checked = true
          if (await superseded()) return renew(error)
        }
        // The quick pair widens; everything past it is the long wait, which is
        // the one that reaches the far side of the outage.
        if (attempt < last) await wait(attempt < retries ? delayMs * (attempt + 1) : waitMs)
      }
    }
    throw lastError
  })
}
