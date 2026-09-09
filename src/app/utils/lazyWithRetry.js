import { lazy } from 'react'

const DEFAULT_RETRIES = 2
const DEFAULT_DELAY_MS = 350

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

// How many retried addresses this page has already spent. Counted for the whole
// document rather than per pass, because the module map that makes a repeated
// address worthless is the document's: a second pass at the same piece, minutes
// later and on another page, numbering its attempts 1 and 2 again would ask for
// two addresses the map already holds a rejection for and send nothing for
// either. Measured against the built site with the chunk refused and then
// served, that was a renewal that reported a fresh failure without making a
// single request.
let spent = 0

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
 * A query string the map has not seen is a different key and a real request. It
 * reaches the same file, because a hashed asset is served by path and the
 * query is ignored by everything that answers for one.
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
  address.searchParams.set('retry', String(spent))
  return import(/* @vite-ignore */ address.href)
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
 * asking again. Between attempts we wait a short, widening delay. If every
 * attempt fails the rejection is re-thrown so the surrounding boundary can take
 * over — by then the likely cause is a chunk that no longer exists (a superseded
 * deploy), which no address recovers.
 *
 * @param {() => Promise<{ default: React.ComponentType }>} factory - Dynamic
 *   import returning a module with a default-exported component.
 * @param {{ retries?: number, delayMs?: number, after?: unknown }} [options] -
 *   `after` is what an earlier pass at this same piece died of. Given one, the
 *   plain address is skipped: it is the address that already failed, and the
 *   module map will hand back that failure without sending anything.
 * @returns {React.LazyExoticComponent} A lazy component with retry built in.
 */
export function lazyWithRetry(
  factory,
  { retries = DEFAULT_RETRIES, delayMs = DEFAULT_DELAY_MS, after = null } = {}
) {
  return lazy(async () => {
    let lastError = after
    for (let attempt = 0; attempt <= retries; attempt++) {
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
        if (attempt < retries) await wait(delayMs * (attempt + 1))
      }
    }
    throw lastError
  })
}
