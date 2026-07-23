import { lazy } from 'react'

const DEFAULT_RETRIES = 2
const DEFAULT_DELAY_MS = 350

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * `React.lazy` that survives a flaky first fetch. A route's code-split chunk is
 * requested the moment the view mounts, so a transient network blip — or a chunk
 * that is momentarily unavailable at the CDN edge right after a deploy — would
 * otherwise reject the import and, with no error boundary above it, blank the
 * whole app until the user manually reloads.
 *
 * Each attempt re-invokes the import factory (the browser retries the network
 * request); between attempts we wait a short, widening delay. If every attempt
 * fails the rejection is re-thrown so the surrounding ErrorBoundary can take
 * over — by then a genuinely missing chunk (e.g. a superseded deploy) is the
 * likely cause, and a single hard reload fetches the current asset manifest.
 *
 * @param {() => Promise<{ default: React.ComponentType }>} factory - Dynamic
 *   import returning a module with a default-exported component.
 * @param {{ retries?: number, delayMs?: number }} [options]
 * @returns {React.LazyExoticComponent} A lazy component with retry built in.
 */
export function lazyWithRetry(factory, { retries = DEFAULT_RETRIES, delayMs = DEFAULT_DELAY_MS } = {}) {
  return lazy(async () => {
    let lastError
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory()
      } catch (error) {
        lastError = error
        if (attempt < retries) await wait(delayMs * (attempt + 1))
      }
    }
    throw lastError
  })
}
