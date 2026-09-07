import { useCallback, useEffect, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'

const SPEED_PATH = '/api/site-speed'

/** What a reader is told when the stored readings do not arrive. */
const NO_READ = 'The speed readings did not arrive. Try again in a moment.'

/** And when a run asked for by hand does not come back with a score. */
const NO_MEASURE = 'That measurement could not be finished. Try that site again.'

/**
 * The stored PageSpeed readings, and the way to take a new one.
 *
 * Reading is cheap and measuring is not: a measurement runs two real page loads
 * on Google's hardware and takes the better part of a minute, which is why it
 * happens on request rather than on arrival. `measuring` holds the site a run
 * is in flight for, so one row can show its own wait while the rest of the
 * table stays readable.
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

  const measure = useCallback(
    async siteId => {
      if (!token) return false
      setMeasuring(siteId)
      try {
        const response = await fetch(SPEED_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ site_id: siteId }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!alive.current) return false
        if (!response.ok) {
          // A run travels through a proxy to Google and back, so what comes
          // out of it is written by whichever of the three refused - which is
          // exactly the case the door is for.
          toast(faultFromResponse(response, payload, NO_MEASURE), 'error')
          return false
        }
        // A run answers with the whole table, so what is on screen after one
        // is what just came back. A banner held from a read that did not land
        // would be standing over readings that have arrived.
        setData(payload)
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
