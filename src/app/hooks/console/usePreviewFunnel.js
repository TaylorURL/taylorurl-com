import { useCallback, useEffect, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { readEndpoint } from './endpoint'
import { useAlive } from './useAlive'
import { usePulse } from './usePulse'

const FUNNEL_PATH = '/api/previews-admin'

/**
 * How often the funnel is read again. An open or a visit lands whenever a
 * business gets round to its mail, and the read walks every preview ever
 * sent, so the beat is a slow one.
 */
const PULSE_MS = 5 * 60_000

/** What the owner is told when the funnel does not load. */
const NO_READ = 'The preview results could not be read. Try again in a moment.'

/**
 * The preview funnel the Call List carries: of the preview sites sent, how
 * many were opened by a person, how many businesses came to look, and how
 * many wrote back, by layout and by week (api/previews-admin.js).
 *
 * Nothing here writes; the endpoint behind it cannot.
 *
 * @param {{token: string|null}} options
 * @returns {{data: object|null, error: string|null, loading: boolean}}
 */
export function usePreviewFunnel({ token }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const alive = useAlive()

  const load = useCallback(async () => {
    if (!token) return false
    try {
      const { response, payload } = await readEndpoint(token, `${FUNNEL_PATH}?t=${Date.now()}`)
      if (!alive.current) return false
      if (!response.ok) {
        setError(faultFromResponse(response, payload, NO_READ))
        return false
      }
      setData(payload)
      setError(null)
      return true
    } catch (cause) {
      if (alive.current) setError(faultMessage(cause, NO_READ))
      return false
    }
  }, [token, alive])

  useEffect(() => {
    load()
  }, [load])

  usePulse(load, { enabled: Boolean(token), intervalMs: PULSE_MS })

  // Only the first read leaves the page with nothing to draw; a beat after it
  // redraws figures already on screen rather than blanking them.
  return { data, error, loading: !data && !error }
}
