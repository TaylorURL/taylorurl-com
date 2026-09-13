import { useCallback, useEffect, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { readEndpoint } from './endpoint'
import { useAlive } from './useAlive'
import { usePulse } from './usePulse'

const PAYMENTS_PATH = '/api/payments-admin'

/** How often the account is read again. The record moves without the page
 * doing anything - a card is charged, an invoice is paid - and the read
 * behind it walks Stripe, so the beat is the console's slower one. */
const PULSE_MS = 60_000

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
 * The record moves without the page doing anything - a card is charged, an
 * invoice is paid - so it is read again on a beat, and a reader who has just
 * taken a payment sees it land rather than reloading the console.
 *
 * @param {{token: string|null, enabled: boolean}} options
 * @returns {{data: object|null, error: string|null, loading: boolean}}
 */
export function usePaymentsFeed({ token, enabled }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const alive = useAlive()

  const load = useCallback(async () => {
    if (!token || !enabled) return false
    try {
      const { response, payload } = await readEndpoint(token, `${PAYMENTS_PATH}?t=${Date.now()}`)
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
  }, [token, enabled, alive])

  useEffect(() => {
    load()
  }, [load])

  usePulse(load, { enabled: Boolean(token) && enabled, intervalMs: PULSE_MS })

  // The first read is the only one that leaves the page with nothing to draw.
  // A beat after that redraws figures the reader is already looking at, and
  // blanking them to placeholders would be the page forgetting what it knows.
  return { data, error, loading: !data && !error }
}
