import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { answerFor, NOTHING_HELD } from './feedState'

const ANALYTICS_PATH = '/api/analytics'
// A failed read is usually a redeploy or a blip a couple of seconds wide.
// Waiting a full interval to find that out leaves the console showing an error
// it no longer has, so a failure retries soon and backs off if it persists.
const RETRY_MS = [3_000, 6_000, 15_000]

/**
 * Polls one analytics view and keeps the last good payload through a failure,
 * so a blip never blanks a console that was already showing figures.
 *
 * What is held is filed under the query that produced it. A window, a site or
 * a path filter that changes asks a different question, and the answer to the
 * last one is not a partial answer to this one - so the feed reports itself as
 * loading again and hands back nothing until the new read lands. Without that
 * the console keeps the old figures on screen with `loading` false, and the
 * page draws last week's numbers as though they were this week's.
 *
 * Polling pauses while the tab is hidden and catches up the moment it comes
 * back: the live view is a five-minute window, and a background tab spending
 * requests on figures nobody is reading is the one case where "realtime" costs
 * something and returns nothing.
 *
 * @param {object} options
 * @param {string} options.token - the session's access token; no request without one
 * @param {string} options.view - `live`, `overview`, or `site`
 * @param {object} [options.params] - extra query parameters for the view
 * @param {number} options.intervalMs - how often to re-read while visible
 * @param {boolean} [options.enabled] - false holds the poll without clearing data
 * @returns {{data: object|null, error: Error|null, fetchedAt: Date|null,
 *   loading: boolean, refresh: () => Promise<boolean>, rejected: boolean}}
 */
export function useAnalyticsFeed({ token, view, params, intervalMs, enabled = true }) {
  const [held, setHeld] = useState(NOTHING_HELD)
  const [failed, setFailed] = useState(NOTHING_HELD)
  const [rejected, setRejected] = useState(false)
  const [fetchedAt, setFetchedAt] = useState(null)
  const timer = useRef(null)
  const failures = useRef(0)

  // The query string is the identity of this feed: a new site or window has to
  // restart the poll, but an object literal rebuilt on every render must not.
  const query = useMemo(() => {
    const search = new URLSearchParams({ view })
    for (const [key, value] of Object.entries(params || {})) {
      if (value === null || value === undefined || value === '') continue
      // A list is joined deliberately rather than left to String(), which does
      // the same thing by accident and would stop doing it the moment the
      // shape changed. An empty list is no scope at all and is left off.
      if (Array.isArray(value)) {
        if (value.length) search.set(key, value.join(','))
        continue
      }
      search.set(key, String(value))
    }
    return search.toString()
  }, [view, params])

  const load = useCallback(async () => {
    if (!token) return false
    try {
      const response = await fetch(`${ANALYTICS_PATH}?${query}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status === 401 || response.status === 403) {
        setRejected(true)
        setFailed({ key: query, value: new Error('This account cannot read the traffic figures.') })
        return false
      }
      if (!response.ok) throw new Error(`analytics answered ${response.status}`)
      const payload = await response.json()
      failures.current = 0
      setRejected(false)
      setHeld({ key: query, value: payload })
      setFailed(NOTHING_HELD)
      setFetchedAt(new Date())
      return true
    } catch (cause) {
      failures.current += 1
      setFailed({ key: query, value: cause })
      return false
    }
  }, [token, query])

  useEffect(() => {
    if (!token || !enabled) return undefined
    let cancelled = false
    let first = true

    const tick = async () => {
      if (cancelled) return
      // The first read always runs so the console never sits on its shell;
      // only the repeat polling waits for the tab to be visible.
      let ok = true
      if (first || document.visibilityState === 'visible') ok = await load()
      first = false
      if (cancelled) return
      const wait = ok ? intervalMs : RETRY_MS[Math.min(failures.current - 1, RETRY_MS.length - 1)]
      timer.current = window.setTimeout(tick, wait)
    }
    tick()

    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [token, enabled, intervalMs, load])

  // Both are read through the query they were filed under, so a payload or a
  // failure belonging to the previous question is invisible to the page rather
  // than mistaken for an answer to this one.
  const data = answerFor(held, query)
  const error = answerFor(failed, query)
  // A feed with no session, or one held by its caller, has not been asked
  // anything and is not waiting on an answer. Reporting it as loading leaves
  // the signed-out status board waiting on reads that will never be made.
  const asked = Boolean(token) && enabled

  return { data, error, fetchedAt, loading: asked && !data && !error, refresh: load, rejected }
}
