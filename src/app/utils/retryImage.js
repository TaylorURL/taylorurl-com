/**
 * A picture the page depends on, asked for again at an address no cache holds
 * an answer for.
 *
 * The route chunk got this in `lazyWithRetry` and the stylesheet got it in
 * `vite/sheet-source.js`. The mark did not, and it is the one file on this site
 * that every single page draws twice - the head of the navigation bar and the
 * foot of the page - so it is the one whose loss a reader cannot miss.
 *
 * An `<img>` that fails is finished. There is no rejection to catch and no
 * boundary above it: the browser fires one `error` event, the box stays empty,
 * and the element never asks again for the life of the document. A reader who
 * lost the request to a dropped packet reads the whole site with a hole where
 * the name goes, and a reload is the only thing that fixes it.
 *
 * Worse, and this is the half that makes it stick: `vercel.json` matches
 * `/images/(.*)` by pattern, and Vercel applies a header rule whatever the
 * status it is answering with. So an image request answered 404 or 502 comes
 * back carrying `public, max-age=31536000, immutable` - a failure the browser
 * is told to keep for a year and never revalidate. The next page view asks the
 * cache, the cache hands back the failure, nothing is sent, and the mark is
 * gone from every page of both sites until somebody clears their browser. That
 * is the same trap #570 found under `/assets/`, on a path nobody had looked at
 * because the file had never been missing.
 *
 * Which is why a rung here has to be an address the cache has no answer for.
 * Re-setting `src` to the same URL asks the cache, not the server, and on a
 * poisoned entry that is not a second attempt - it is the first one's answer
 * handed straight back. A query neither the cache nor this document has seen
 * is a real request, and it reaches the same file, because a static asset is
 * served by path and the query is ignored by everything that answers for one.
 * `vercel.json` gives a `retry` address `no-store` so the rung cannot poison
 * anything itself, and `settled()` in `index.html` strips the parameter before
 * a failure is filed, so every reader still reports the one built address and
 * the fault stays deduped as one fault.
 */

// The quick rung is for a request that was simply dropped and lands on the next
// ask. The long one is for the outages these actually see - an edge that has
// not got the new build yet, a phone changing networks, a proxy refusing for a
// moment - which run two or three seconds, far past where a ladder that
// finishes inside one second has already given up. Both numbers are the ones
// `lazyWithRetry` arrived at by measuring, and there is no reason a picture
// meets a different network than a script does.
const WAITS_MS = [350, 5000]

// How many retried addresses this document has already spent. Counted across
// the whole page rather than per element, because the cache that makes a
// repeated address worthless is the document's: the navigation mark and the
// footer mark are the same file, and a second element numbering its attempts
// from 1 again would ask at an address the first one already has an answer
// cached for.
let spent = 0

// Something no address this browser has ever asked for can already contain, so
// that a rung is a rung in the second document as well as the first. The count
// alone restarts at 0 in every document, which would send the visit after an
// outage to the same handful of addresses the failed visit taught the cache to
// refuse.
const TOKEN = Math.random().toString(36).slice(2, 8)

/**
 * How many attempts an element has left before its loss is real.
 *
 * Kept on the element rather than in React state for two reasons. Re-rendering
 * to change a `src` unmounts nothing and gains nothing, and a count in state
 * would be lost by any parent that remounts the mark. And the capture-phase
 * listener in `index.html` reads this attribute to decide whether a failure is
 * one the reader actually met: an element still holding attempts is recovering
 * and is held for the live console, and one whose ladder is spent reports, the
 * same way a stylesheet does. That listener runs before this handler, so the
 * attribute has to be on the element from the markup rather than written when
 * the first failure arrives.
 */
export const RETRY_ATTEMPTS = WAITS_MS.length

/**
 * What the markup puts on a picture the page cannot do without.
 *
 * Spread onto the element, so that the attribute the reporter reads and the
 * handler that answers for it can never be wired up one without the other.
 *
 * @returns {{ 'data-retry': string, onError: (event: { currentTarget: HTMLImageElement }) => void }}
 */
export function retryable() {
  return { 'data-retry': String(RETRY_ATTEMPTS), onError: retryImage }
}

/**
 * One rung of the ladder, run from the element's own `error` event.
 *
 * @param {{ currentTarget: HTMLImageElement }} event - The failed load.
 */
export function retryImage(event) {
  const image = event && event.currentTarget
  if (!image || typeof window === 'undefined') return

  // No attribute means the ladder is spent and this failure has already been
  // filed as one the reader met. Asking again from here would be a request
  // nothing is waiting on and nothing would report.
  const left = Number(image.getAttribute('data-retry') || 0)
  if (!(left > 0)) return

  const waitMs = WAITS_MS[WAITS_MS.length - left] ?? WAITS_MS[WAITS_MS.length - 1]

  // Removed rather than set to "0" on the last rung, because the reporter's
  // test is the attribute's presence: the element has to stop looking like
  // something that is recovering *before* the attempt that has nowhere to go
  // after it, or its failure is held and never filed and a reader who genuinely
  // lost the mark reports nothing at all.
  if (left > 1) image.setAttribute('data-retry', String(left - 1))
  else image.removeAttribute('data-retry')

  let address
  try {
    address = new URL(image.src, window.location.href)
  } catch {
    return
  }
  spent += 1
  address.searchParams.set('retry', `${spent}.${TOKEN}`)

  // Waited out rather than fired straight away. A ladder whose rungs all land
  // inside the same two-second outage is three ways of asking during the outage
  // and no way of asking after it.
  window.setTimeout(() => {
    image.src = address.href
  }, waitMs)
}
