import { useCallback, useEffect, useRef, useState } from 'react'

const LEADS_PATH = '/api/leads-admin'

/**
 * Everyone who started a build, as the record holds them right now.
 *
 * One read covers the whole section. The list and the figures over it are two
 * readings of one table, and asking for them apart would mean a strip at the
 * top that could disagree with the rows underneath for as long as the second
 * request took.
 *
 * Nothing here writes, because the endpoint behind it holds no verb that
 * could. A list of addresses is a thing to read, and the one message that ever
 * goes to any of them is sent by the scheduled job rather than by a button on
 * a page.
 *
 * `refresh` is offered because the record moves while nobody is looking - a
 * lead lands whenever somebody types an address into the configurator - and a
 * reader watching for one wants to see it arrive rather than reload the
 * console.
 *
 * @param {{token: string|null, enabled: boolean}} options
 * @returns {{data: object|null, error: string|null, loading: boolean,
 *   reading: boolean, refresh: () => Promise<void>}}
 */
export function useLeadsFeed({ token, enabled }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [reading, setReading] = useState(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!token || !enabled) return
    setReading(true)
    try {
      const response = await fetch(`${LEADS_PATH}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!alive.current) return
      if (!response.ok) {
        setError(payload.error || `The leads endpoint answered ${response.status}.`)
        return
      }
      setData(payload)
      setError(null)
    } catch {
      if (alive.current) setError('The leads endpoint did not answer.')
    } finally {
      if (alive.current) setReading(false)
    }
  }, [token, enabled])

  useEffect(() => {
    load()
  }, [load])

  // The first read is the only one that leaves the page with nothing to draw.
  // A refresh after that redraws rows the reader is already looking at, and
  // blanking them to placeholders would be the page forgetting what it knows.
  return { data, error, loading: !data && !error, reading, refresh: load }
}
