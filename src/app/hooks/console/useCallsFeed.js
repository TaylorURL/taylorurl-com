import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'
import { answerFor, NOTHING_HELD } from './feedState'

const CALLS_PATH = '/api/calls-admin'

/** What a reader is told when the read behind the section does not land. */
const NO_READ = 'The call list could not be read. Try again in a moment.'

/** And when a call does not get written down. */
const NO_RECORD = 'That call could not be recorded. Try it again.'

/**
 * The businesses to ring, and the record of what each call came to.
 *
 * One read covers the section. The list, the figures over it and the two
 * filter lists under them are readings of one set taken at one moment, and
 * asking for them apart would leave a strip that can disagree with the rows it
 * sits over for as long as the second request takes.
 *
 * The filter and the page belong to that read rather than being applied to
 * what came back. The endpoint ranks the whole callable set - a business's
 * place is its review count against the middle count for its own trade, which
 * is not a figure a page of rows can produce - and hands back one page of the
 * result. Narrowing what arrived would be searching inside a page.
 *
 * Recording a call re-reads rather than patching the row on screen. A call
 * moves the business's place in the order, can take it off the list entirely,
 * and moves three of the five figures above it, so patching would mean
 * recomputing a ranking the page does not hold.
 *
 * The two failures go to different places. A read that does not land leaves
 * the section with nothing to draw, so it is held in `error` and stands where
 * the rows would have been; a notice that faded after eight seconds would
 * leave an empty list explaining itself to nobody. A call that does not get
 * written down leaves the list as it was and the answers still in the form, so
 * it is a notice in the bottom-right corner of the screen rather than a banner
 * over rows that are still right. `error` belongs to the read alone for that
 * reason.
 *
 * @param {{token: string|null, enabled: boolean,
 *   filters: {view: string, state: string, pull: string, min_score: string,
 *     town: string, trade: string, sort: string, search: string,
 *     take: number, page: number}}} options
 * @returns {{data: object|null, retained: object|null, error: string|null,
 *   loading: boolean, saving: boolean, refresh: () => Promise<void>,
 *   record: (call: object) => Promise<object|null>}}
 */
export function useCallsFeed({ token, enabled, filters }) {
  const [held, setHeld] = useState(NOTHING_HELD)
  const [failed, setFailed] = useState(NOTHING_HELD)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // The query string is the identity of this read. An object literal rebuilt
  // on every render is not.
  const query = useMemo(() => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(filters || {})) {
      if (value) search.set(key, String(value))
    }
    return search.toString()
  }, [filters])

  const load = useCallback(async () => {
    if (!token || !enabled) return
    try {
      const response = await fetch(`${CALLS_PATH}?${query}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!alive.current) return
      if (!response.ok) {
        setFailed({ key: query, value: faultFromResponse(response, payload, NO_READ) })
        return
      }
      setHeld({ key: query, value: payload })
      setFailed(NOTHING_HELD)
    } catch (cause) {
      if (alive.current) setFailed({ key: query, value: faultMessage(cause, NO_READ) })
    }
  }, [token, enabled, query])

  useEffect(() => {
    load()
  }, [load])

  const record = useCallback(
    async call => {
      if (!token) return null
      setSaving(true)
      try {
        const response = await fetch(CALLS_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(call),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (alive.current) toast(faultFromResponse(response, payload, NO_RECORD), 'error')
          return null
        }
        await load()
        return payload
      } catch (cause) {
        if (alive.current) toast(faultMessage(cause, NO_RECORD), 'error')
        return null
      } finally {
        if (alive.current) setSaving(false)
      }
    },
    [token, load, toast]
  )

  // Filed under the filter that asked for it: a new town, trade or page is a
  // different question, and the list on screen is not its answer.
  const data = answerFor(held, query)
  const error = answerFor(failed, query)

  // The last answer that landed, whichever question it answered. The controls
  // describing the question - the town and trade lists, the pager's count of
  // pages - are not figures the read answers for, and deriving them from
  // `data` would empty the dropdown of the option just picked and unmount the
  // pager the moment Next is pressed.
  const retained = held.value

  return { data, retained, error, loading: !data && !error, saving, refresh: load, record }
}
