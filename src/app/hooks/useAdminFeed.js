import { useCallback, useEffect, useRef, useState } from 'react'

const ADMIN_PATH = '/api/console-admin'

/**
 * The admin console's accounts and sites, and the four changes that can be
 * made to them.
 *
 * One read covers both, because the two are only useful together: an account
 * is read beside the sites it can open, and a site beside the people who can
 * open it. Each change re-reads rather than patching what is on screen, since
 * a grant moves rows on both sides of that document and a local edit would
 * have to guess at the other half.
 *
 * `acting` is the key of the row a change is in flight for, so one button can
 * show its own progress without the whole table going quiet.
 *
 * @param {{token: string|null, enabled: boolean}} options
 * @returns {{data: object|null, error: string|null, loading: boolean,
 *   acting: string|null, refresh: () => Promise<void>,
 *   act: (body: object, key: string) => Promise<boolean>}}
 */
export function useAdminFeed({ token, enabled }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [acting, setActing] = useState(null)
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
      const response = await fetch(`${ADMIN_PATH}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!alive.current) return
      if (!response.ok) {
        setError(payload.error || `The admin endpoint answered ${response.status}.`)
        return
      }
      setData(payload)
      setError(null)
    } catch {
      if (alive.current) setError('The admin endpoint did not answer.')
    }
  }, [token, enabled])

  useEffect(() => {
    load()
  }, [load])

  const act = useCallback(
    async (body, key) => {
      if (!token) return false
      setActing(key)
      setError(null)
      try {
        const response = await fetch(ADMIN_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (alive.current) setError(payload.error || 'That change did not go through.')
          return false
        }
        await load()
        return true
      } catch {
        if (alive.current) setError('That change did not reach the server.')
        return false
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, load]
  )

  return { data, error, loading: !data && !error, acting, refresh: load, act }
}
