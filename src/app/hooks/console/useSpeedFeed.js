import { useCallback, useEffect, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'
import { usePulse } from './usePulse'

const SPEED_PATH = '/api/site-speed'

/**
 * The two readings a site carries, asked for one request at a time.
 *
 * PageSpeed loads the page on its own hardware and regularly takes sixty to
 * ninety seconds for a single strategy. Asked for both at once - which is what
 * the endpoint does when nothing names one - the two run back to back inside a
 * single call, and a pair that are each merely slow rather than stuck add up
 * past the runtime's wall clock. The worker is killed where it stands, so
 * nothing is thrown and nothing is logged; the endpoint in front of it sees a
 * 5xx from an upstream that stopped existing and answers 502. #545 was that,
 * on a request that had been running 128 seconds, against a service whose
 * longest successful run all day was 98.
 *
 * Split, each request holds one measurement and is bounded by the endpoint's
 * own ninety-second ceiling with room to spare. Nothing else changes: the
 * figures are written per strategy at the far end either way, so two requests
 * store exactly what one did. The nightly sweep was moved to one strategy per
 * call for this reason and the console kept asking for both.
 */
const STRATEGIES = ['mobile', 'desktop']

/** How often the stored readings are read again. They move when the daily
 * sweep files, so the beat is the console's slower one. */
const PULSE_MS = 60_000

/** What a reader is told when the stored readings do not arrive. */
const NO_READ = 'The speed readings did not arrive. Try again in a moment.'

/** And when a run asked for by hand does not come back with a score. */
const NO_MEASURE = 'That measurement could not be finished. Try that site again.'

/**
 * The stored PageSpeed readings, and the way to take a new one.
 *
 * Reading is cheap and measuring is not: a measurement runs two real page loads
 * on Google's hardware and takes the better part of a minute each, which is why
 * it happens on request rather than on arrival, and why the two go as separate
 * requests. `measuring` holds the site a run is in flight for, so one row can
 * show its own wait while the rest of the table stays readable, and it holds it
 * across both.
 *
 * That difference decides where a failure goes as well. Readings that never
 * arrive leave the table with nothing in it, so they are held in `error` and
 * said where the rows would have been. A run that does not finish leaves every
 * stored figure standing and belongs to the one row whose button was pressed,
 * so it is a notice rather than a banner over a table that is still true.
 *
 * @param {{token: string|null, enabled: boolean}} options
 * @returns {{sites: Array<object>, error: string|null, loading: boolean,
 *   measuring: string|null, refresh: () => Promise<void>,
 *   measure: (siteId: string) => Promise<boolean>}}
 */
export function useSpeedFeed({ token, enabled }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [measuring, setMeasuring] = useState(null)
  const toast = useToast()
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!token || !enabled) return
    try {
      const response = await fetch(`${SPEED_PATH}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!alive.current) return
      if (!response.ok) {
        setError(faultFromResponse(response, payload, NO_READ))
        return
      }
      setData(payload)
      setError(null)
    } catch (cause) {
      if (alive.current) setError(faultMessage(cause, NO_READ))
    }
  }, [token, enabled])

  useEffect(() => {
    load()
  }, [load])

  // The readings again on a beat: the daily sweep files new figures on its
  // own schedule, and a measurement pressed in another window lands here too.
  // Held while one is running, whose answer carries the whole table itself.
  usePulse(load, {
    enabled: Boolean(token) && enabled,
    intervalMs: PULSE_MS,
    holdWhile: Boolean(measuring),
  })

  const measure = useCallback(
    async siteId => {
      if (!token) return false
      setMeasuring(siteId)
      try {
        // One strategy per request, and the row stays busy across both.
        let table = null
        for (const strategy of STRATEGIES) {
          const response = await fetch(SPEED_PATH, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ site_id: siteId, strategy }),
          })
          const payload = await response.json().catch(() => ({}))
          if (!alive.current) return false
          if (!response.ok) {
            // A run travels through a proxy to Google and back, so what comes
            // out of it is written by whichever of the three refused - which is
            // exactly the case the door is for.
            //
            // Whatever landed before it stays on screen. The reading that did
            // arrive is stored and true, and leaving the row on its old figure
            // would say the whole run was lost when half of it was.
            if (table) {
              setData(table)
              setError(null)
            }
            toast(faultFromResponse(response, payload, NO_MEASURE), 'error')
            return false
          }
          table = payload
        }
        // A run answers with the whole table, so what is on screen after one
        // is what just came back. A banner held from a read that did not land
        // would be standing over readings that have arrived.
        setData(table)
        setError(null)
        return true
      } catch (cause) {
        if (alive.current) toast(faultMessage(cause, NO_MEASURE), 'error')
        return false
      } finally {
        if (alive.current) setMeasuring(null)
      }
    },
    [token, toast]
  )

  return {
    sites: data?.sites || [],
    error,
    loading: !data && !error,
    measuring,
    refresh: load,
    measure,
  }
}
