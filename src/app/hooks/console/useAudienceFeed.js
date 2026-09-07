import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'
import { answerFor, NOTHING_HELD } from './feedState'

const AUDIENCE_PATH = '/api/audience-admin'

/** What a reader is told when the read behind the table does not land. */
const NO_READ = 'The mailing list could not be read. Try again in a moment.'

/** And when one of the three changes does not take. */
const NO_CHANGE = 'That change could not be saved. Try it again.'

/**
 * The mailing list, and the three changes that can be made to it.
 *
 * The filter is part of the read rather than something applied to what came
 * back, because the endpoint answers with the most recent rows and a filter
 * applied afterwards would search only inside those. The counts above the
 * table come from the same read and cover the whole list either way.
 *
 * Every change re-reads. An add moves one status count and a removal moves
 * two, and both change what the current filter selects, so patching the rows
 * on screen would mean recomputing the summary from figures the page does not
 * hold.
 *
 * `acting` is the key of the row or the form a change is in flight for, so one
 * control shows its own progress without the table going quiet.
 *
 * The two failures go to different places. A read that does not land leaves
 * nothing to draw, so it is held in `error` and stands where the rows would
 * have been until a read gets through; a notice that faded after eight seconds
 * would leave an empty table explaining itself to nobody. A change that does
 * not take leaves every row on screen exactly as it was, so it is a notice
 * instead, beside the control that was pressed. `error` belongs to the read
 * alone for that reason.
 *
 * @param {{token: string|null, enabled: boolean,
 *   filters: {status: string, segment: string, search: string, page: number}}} options
 * @returns {{data: object|null, error: string|null, loading: boolean,
 *   acting: string|null, refresh: () => Promise<void>,
 *   act: (body: object, key: string) => Promise<object|null>}}
 */
export function useAudienceFeed({ token, enabled, filters }) {
  const [held, setHeld] = useState(NOTHING_HELD)
  const [failed, setFailed] = useState(NOTHING_HELD)
  const [acting, setActing] = useState(null)
  const toast = useToast()
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // The query string is the identity of this read: a new filter is a new
  // request, but an object literal rebuilt on every render must not be.
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
      const response = await fetch(`${AUDIENCE_PATH}?${query}&t=${Date.now()}`, {
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

  const act = useCallback(
    async (body, key) => {
      if (!token) return null
      setActing(key)
      try {
        const response = await fetch(AUDIENCE_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (alive.current) toast(faultFromResponse(response, payload, NO_CHANGE), 'error')
          return null
        }
        await load()
        return payload
      } catch (cause) {
        if (alive.current) toast(faultMessage(cause, NO_CHANGE), 'error')
        return null
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, load, toast]
  )

  // Filed under the filter that asked for it: a new status, segment, search or
  // page is a different question, and the rows on screen are not its answer.
  const data = answerFor(held, query)
  const error = answerFor(failed, query)
  // The last answer that landed, whichever question it answered.
  //
  // The controls describing the question - the filter's own option lists, the
  // pager's count of pages - are not figures the read answers for, and they go
  // through the same re-read as the rows. Deriving them from `data` empties the
  // dropdown of the very option that was just picked, and unmounts the pager
  // the moment Next is pressed. They read this instead; everything stating a
  // figure still reads `data` and waits.
  const retained = held.value

  return {
    data,
    retained,
    error,
    loading: !data && !error,
    acting,
    refresh: load,
    act,
  }
}
