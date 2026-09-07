import { useCallback, useEffect, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'

const PAYMENTS_PATH = '/api/payments-admin'

/** What a reader is told when the one read behind the section does not land. */
const NO_READ = 'The payments could not be read. Try again in a moment.'

/**
 * Every client's billing, as Stripe holds it right now.
 *
 * One read covers the whole section. The clients, their payments and the
 * totals over both are three readings of one account, and asking for them
 * apart would mean a page whose figures at the top could disagree with the
 * rows under them for as long as the second request took.
 *
 * Nothing here writes, because the endpoint behind it cannot. This is the one
 * console feed with no `act`, and the absence is the point: money is changed in
 * Stripe, by a person, on purpose.
 *
 * `refresh` is offered because the record moves without the page doing
 * anything - a card is charged, an invoice is paid - and a reader who has just
 * taken a payment wants to see it land rather than reload the console.
 *
 * @param {{token: string|null, enabled: boolean}} options
 * @returns {{data: object|null, error: string|null, loading: boolean,
 *   reading: boolean, refresh: () => Promise<void>}}
 */
export function usePaymentsFeed({ token, enabled }) {
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
      const response = await fetch(`${PAYMENTS_PATH}?t=${Date.now()}`, {
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
    } finally {
      if (alive.current) setReading(false)
    }
  }, [token, enabled])

  useEffect(() => {
    load()
  }, [load])

  // The first read is the only one that leaves the page with nothing to draw.
  // A refresh after that redraws figures the reader is already looking at, and
  // blanking them to placeholders would be the page forgetting what it knows.
  return { data, error, loading: !data && !error, reading, refresh: load }
}
