import { useCallback, useEffect, useRef, useState } from 'react'

const SPEED_PATH = '/api/site-speed'

/**
 * The stored PageSpeed readings, and the way to take a new one.
 *
 * Reading is cheap and measuring is not: a measurement runs two real page loads
 * on Google's hardware and takes the better part of a minute, which is why it
 * happens on request rather than on arrival. `measuring` holds the site a run
 * is in flight for, so one row can show its own wait while the rest of the
 * table stays readable.
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
        setError(payload.error || `The readings answered ${response.status}.`)
        return
      }
      setData(payload)
      setError(null)
    } catch {
      if (alive.current) setError('The readings did not arrive.')
    }
  }, [token, enabled])

  useEffect(() => {
    load()
  }, [load])

  const measure = useCallback(
    async siteId => {
      if (!token) return false
      setMeasuring(siteId)
      setError(null)
      try {
        const response = await fetch(SPEED_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ site_id: siteId }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!alive.current) return false
        if (!response.ok) {
          setError(payload.error || 'The measurement did not finish.')
          return false
        }
        setData(payload)
        return true
      } catch {
        if (alive.current) setError('The measurement did not finish.')
        return false
      } finally {
        if (alive.current) setMeasuring(null)
      }
    },
    [token]
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
