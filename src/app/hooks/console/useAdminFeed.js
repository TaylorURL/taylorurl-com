import { useCallback, useEffect, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'
import { usePulse } from './usePulse'

const ADMIN_PATH = '/api/console-admin'

/** How often the document is read again: accounts sign up and sites land
 * without this screen hearing about either. */
const PULSE_MS = 30_000

/** What a reader is told when the read behind the whole section does not land. */
const NO_READ = 'The accounts and sites could not be read. Try again in a moment.'

/** And when one of the four changes does not take. */
const NO_CHANGE = 'That change could not be saved. Try it again.'

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
 * The two failures go to different places on purpose. A read that does not
 * land leaves the page with nothing to draw, so it is held in `error` and the
 * section says so where the table would have been - a notice that faded after
 * eight seconds would leave a blank panel explaining itself to nobody. A
 * change that does not take leaves the table exactly as it was, so it is a
 * notice in the bottom-right corner of the screen rather than a banner over
 * rows that are still right.
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
      const response = await fetch(`${ADMIN_PATH}?t=${Date.now()}`, {
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

  // The same read again on a beat, held off while a change is in flight so
  // the beat cannot race the re-read the change itself ends on.
  usePulse(load, {
    enabled: Boolean(token) && enabled,
    intervalMs: PULSE_MS,
    holdWhile: Boolean(acting),
  })

  const act = useCallback(
    async (body, key) => {
      if (!token) return false
      setActing(key)
      try {
        const response = await fetch(ADMIN_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (alive.current) toast(faultFromResponse(response, payload, NO_CHANGE), 'error')
          return false
        }
        await load()
        return true
      } catch (cause) {
        if (alive.current) toast(faultMessage(cause, NO_CHANGE), 'error')
        return false
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, load, toast]
  )

  return { data, error, loading: !data && !error, acting, refresh: load, act }
}
