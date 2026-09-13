import { useCallback, useEffect, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { readEndpoint } from './endpoint'
import { useAlive } from './useAlive'
import { usePulse } from './usePulse'

const SERVER_FEED_PATH = '/api/server-feed'

// The server rebuilds its own reading every half minute, and half of what it
// carries - a load average, a temperature, when a timer fires next - is only
// true for the minute it was taken in. A slower beat would leave the page
// quietly describing a moment that has passed.
const PULSE_MS = 20_000

/** What a reader is told when the read does not land at all. */
const UNREACHABLE = 'The server could not be reached. This page keeps trying.'

/**
 * What the Sunday Server says about itself, read again on a beat.
 *
 * One question with one answer, so there is nothing here to file a payload
 * under: the feed asks the same thing every time and what comes back is always
 * the answer to it. That is why this is a plain triple rather than the
 * query-keyed shape the windowed sections use.
 *
 * The last good reading is kept through a failed read. Every figure on this
 * page is a measurement of a machine that may have gone away, and blanking the
 * page the moment one read fails would turn a two-second blip in a home
 * connection into a page saying the server is gone. So the reading stays up,
 * `fetchedAt` says how old it is, and the page says out loud that it is not
 * current.
 *
 * `stale` is the difference that matters and it is not the same question as
 * `error`. A read can land perfectly on a feed the machine stopped rebuilding
 * an hour ago - the process serving it is one of the things that can die - so
 * the age of the reading is checked rather than the success of the request.
 *
 * @param {{token: string|null, enabled: boolean}} options
 * @returns {{server: object|null, error: string|null, fetchedAt: Date|null,
 *   loading: boolean, refresh: () => Promise<boolean>}}
 */
export function useServerFeed({ token, enabled }) {
  const [server, setServer] = useState(null)
  const [error, setError] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const alive = useAlive()

  const load = useCallback(async () => {
    if (!token) return false
    try {
      const { response, payload } = await readEndpoint(token, `${SERVER_FEED_PATH}?t=${Date.now()}`)
      if (!response.ok) throw new Error(faultFromResponse(response, payload, UNREACHABLE))
      // A body with no routines in it is not a thinner answer, it is a
      // different endpoint answering - a relay's own error page, most likely -
      // and drawing it would put an empty table under live headings.
      if (!Array.isArray(payload.routines)) throw new Error(UNREACHABLE)
      if (!alive.current) return true
      setServer(payload)
      setError(null)
      setFetchedAt(new Date())
      return true
    } catch (cause) {
      if (alive.current) setError(faultMessage(cause, UNREACHABLE))
      return false
    }
  }, [token, alive])

  useEffect(() => {
    if (!enabled || !token) return
    load()
  }, [enabled, token, load])

  usePulse(load, { enabled: Boolean(enabled && token), intervalMs: PULSE_MS })

  return { server, error, fetchedAt, loading: !server && !error, refresh: load }
}
