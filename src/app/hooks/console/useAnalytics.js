import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { answerFor, NOTHING_HELD } from './feedState'
import { usePoll } from './usePulse'

const ANALYTICS_PATH = '/api/analytics'

/** What a reader is told when a read does not land. */
const NO_FIGURES = 'The traffic figures could not be read. Try again in a moment.'

/** And when the account is signed in but has not been given the figures. */
const REFUSED = 'This account cannot read the traffic figures.'

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
 * @returns {{data: object|null, error: string|null, fetchedAt: Date|null,
 *   loading: boolean, refresh: () => Promise<boolean>, rejected: boolean}}
 */
export function useAnalyticsFeed({ token, view, params, intervalMs, enabled = true }) {
  const [held, setHeld] = useState(NOTHING_HELD)
  const [failed, setFailed] = useState(NOTHING_HELD)
  const [rejected, setRejected] = useState(false)
  const [fetchedAt, setFetchedAt] = useState(null)
  const failures = useRef(0)
  // The newest read this feed has sent, and the means of calling it off. A read
  // is filed only if it is still the newest when it lands, and a new one aborts
  // the one before - so a slow answer to the last window, arriving after the
  // answer to this one, can never put the feed back to waiting or file itself
  // over the figures on screen.
  const latest = useRef(0)
  const inFlight = useRef(null)

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
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    const id = ++latest.current
    const superseded = () => id !== latest.current
    try {
      const response = await fetch(`${ANALYTICS_PATH}?${query}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      if (superseded()) return true
      if (response.status === 401 || response.status === 403) {
        setRejected(true)
        setFailed({ key: query, value: REFUSED })
        return false
      }
      if (!response.ok) {
        // Thrown rather than returned so the one catch below files it, and
        // written out here because this is the only point the response and its
        // body are both in hand. What a poll catches after that is whatever
        // the browser said, which goes through the same door again.
        const payload = await response.json().catch(() => ({}))
        throw new Error(faultFromResponse(response, payload, NO_FIGURES))
      }
      const payload = await response.json()
      if (superseded()) return true
      failures.current = 0
      setRejected(false)
      setHeld({ key: query, value: payload })
      setFailed(NOTHING_HELD)
      setFetchedAt(new Date())
      return true
    } catch (cause) {
      // A read called off by a newer one, or overtaken while it was out, is not
      // a failure of this feed: the newer read is the one that answers.
      if (superseded()) return true
      failures.current += 1
      setFailed({ key: query, value: faultMessage(cause, NO_FIGURES) })
      return false
    }
  }, [token, query])

  // Nothing is left reading, or filing what it read, for a page that has gone.
  useEffect(
    () => () => {
      latest.current += 1
      inFlight.current?.abort()
    },
    []
  )

  usePoll(load, { enabled: Boolean(token) && enabled, intervalMs, failures })

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
