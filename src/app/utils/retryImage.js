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
 * back carrying the caching that path declares - a failure the browser is told
 * to keep. The next page view asks the store, the store hands back the failure,
 * nothing is sent, and the picture is gone from every page until the entry
 * expires. That is the same trap #570 found under `/assets/`, on a path nobody
 * had looked at because the file had never been missing.
 *
 * Nothing can vary that header by status, so the length of the entry is the
 * whole of what is under anyone's control here. `/images/` held a year of
 * `immutable` until #750, which on an unhashed path was wrong on its own terms
 * - a replaced photograph never reached a returning reader either - and it is
 * what turned one lost request into a cover that opened empty for a year. It
 * now carries the same day of caching with a month of background revalidation
 * that every other image on the site has, so a stored failure is asked about
 * again inside a day rather than outliving the reader's interest in the page.
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
//
// Exported, because the capture frames in `DevicePreview` climb a ladder of
// their own - they have a screenshot service past the end of theirs and a count
// shared across the page - and a second set of numbers is a second answer to a
// question that has already been measured. Theirs were 350ms then 700ms, chosen
// before these were, and 1.05 seconds is inside every outage this list exists to
// outlast: a frame spent all three of its asks before the stall that took the
// first one had finished, filed a fault against a file that was present and
// answering throughout, and handed the reader somebody else's render of the site
// instead of the thirty kilobytes this one serves. #737 was that, on a phone
// capture on a case study page.
export const RETRY_WAITS_MS = [350, 5000]
const WAITS_MS = RETRY_WAITS_MS

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
  return { 'data-retry': String(RETRY_ATTEMPTS), onError: retryImage, onLoad: restoreImage }
}

/**
 * The budget handed back to a picture that is now on the screen.
 *
 * The ladder only ever counted down. An element that lost its first ask and got
 * the picture on the next one kept the reduced count for the life of the
 * document, so the following failure had one rung where the first had two, and
 * the one after that had none and was filed - a reader who had already been
 * recovered once was closer to a reported fault than a reader who had never
 * failed at all.
 *
 * That is not a corner. `vercel.json` cannot vary a header by status, so a
 * failed image answer is stored under the built address with the caching the
 * path carries, and until it expires every later mount of that picture is
 * answered from the store with the failure - instantly, with nothing reaching
 * the server. So the first rung of every one of those mounts is spent before any
 * request is made, and the reader has a single real ask left between a blink of
 * their connection and a filed fault. The nav covers meet this before anything
 * else on the site does, because they are drawn on a pointer crossing a trigger
 * and a reader crosses the bar many times in a visit.
 *
 * A picture that has drawn is the proof the address answers, so the count goes
 * back to full: what the attribute means is how many attempts are left before
 * the loss is real, and from a drawn picture that is all of them.
 *
 * @param {{ currentTarget: HTMLImageElement }} event - The load that landed.
 */
export function restoreImage(event) {
  const image = event && event.currentTarget
  if (!image || !image.naturalWidth) return
  if (image.getAttribute('data-retry') === String(RETRY_ATTEMPTS)) return
  image.setAttribute('data-retry', String(RETRY_ATTEMPTS))
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

  spent += 1
  const token = `${spent}.${TOKEN}`

  const address = retried(image.src, token)
  if (!address) return

  // A picture choosing between cuts does not use `src` at all. Width descriptors
  // in `srcset` leave the attribute out of the running entirely, so moving it
  // alone asks for nothing: the browser re-runs its selection over the same
  // candidates, the cache hands back the answer it gave the first time, and the
  // rung is spent on a request that was never made. The set is what the browser
  // chooses from, so the set is what the marker has to reach. The process shots
  // on the home page are the pictures here that carry one, and they are the
  // reason this is written.
  const cuts = image.getAttribute('srcset')
  const retriedCuts = cuts ? retriedSet(cuts, token) : ''

  // Waited out rather than fired straight away. A ladder whose rungs all land
  // inside the same two-second outage is three ways of asking during the outage
  // and no way of asking after it.
  window.setTimeout(() => {
    // Dropped rather than left standing when none of it parses, so that `src`
    // governs and the rung is a real request either way. A wider cut than the
    // reader needs is a picture they can see; a set the marker never reached is
    // the first failure handed straight back.
    if (cuts) {
      if (retriedCuts) image.setAttribute('srcset', retriedCuts)
      else image.removeAttribute('srcset')
    }
    image.src = address
  }, waitMs)
}

/**
 * One address carrying this rung's marker, or null where it is not an address.
 *
 * @param {string} value
 * @param {string} token
 */
function retried(value, token) {
  if (!value) return null
  try {
    const address = new URL(value, window.location.href)
    address.searchParams.set('retry', token)
    return address.href
  } catch {
    return null
  }
}

/**
 * Every cut of a `srcset`, each carrying the marker and keeping the descriptor
 * the markup wrote for it. The descriptor is what the browser picks by, so a set
 * that lost them is a set it cannot choose from.
 *
 * @param {string} value
 * @param {string} token
 */
function retriedSet(value, token) {
  return value
    .split(',')
    .map(cut => {
      const parts = cut.trim().split(/\s+/)
      const address = retried(parts[0], token)
      return address ? [address].concat(parts.slice(1)).join(' ') : null
    })
    .filter(Boolean)
    .join(', ')
}

/**
 * A picture put back on the screen, asking again at its own address.
 *
 * The ladder is spent once and then it is finished, and for most of the
 * pictures that carry it that is the whole story: the mark, the hero and the
 * process shots are drawn for as long as the page is, so an element that lost
 * its last rung is an element whose reader lost the picture and was told so.
 *
 * A nav cover is not drawn for as long as the page is. It is drawn when a
 * pointer crosses its group's trigger, and the sheet keeps the last group it
 * showed mounted after it closes, so the element outlives the open that spent
 * its ladder by the whole of the rest of the visit. What that left was a cover
 * standing blank with a spent `retry` address on it and no budget: the reader
 * opened that menu again, and again, and nothing was asked for and nothing was
 * drawn, long after the file had gone back to answering. #731 gave the covers
 * the ladder and proved a cover recovers from one dropped ask; what it never
 * reached was the second open of a cover whose ladder had already run out, and
 * that is the state this answers.
 *
 * So an open hands the picture its budget back and puts it back on its own
 * address, which is a real request at the file rather than a re-ask of a dead
 * rung. A picture that has drawn is left alone - its address is answering and
 * the built one may be a stored failure, so moving it back would blank a cover
 * that is on the screen.
 *
 * @param {HTMLImageElement | null | undefined} image - The picture being shown again.
 * @param {string} address - The address the markup draws it from.
 */
export function refreshImage(image, address) {
  if (!image || !address) return
  if (image.naturalWidth) return
  image.setAttribute('data-retry', String(RETRY_ATTEMPTS))
  if (image.getAttribute('src') === address) return
  image.src = address
}
