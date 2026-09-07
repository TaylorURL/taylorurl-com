import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { answerFor, NOTHING_HELD } from './feedState'

const AUDIENCE_PATH = '/api/audience-admin'

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
        setFailed({
          key: query,
          value: payload.error || `The audience endpoint answered ${response.status}.`,
        })
        return
      }
      setHeld({ key: query, value: payload })
      setFailed(NOTHING_HELD)
    } catch {
      if (alive.current) setFailed({ key: query, value: 'The audience endpoint did not answer.' })
    }
  }, [token, enabled, query])

  useEffect(() => {
    load()
  }, [load])

  const act = useCallback(
    async (body, key) => {
      if (!token) return null
      setActing(key)
      setFailed(NOTHING_HELD)
      try {
        const response = await fetch(AUDIENCE_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (alive.current) {
            setFailed({ key: query, value: payload.error || 'That change did not go through.' })
          }
          return null
        }
        await load()
        return payload
      } catch {
        if (alive.current) {
          setFailed({ key: query, value: 'That change did not reach the server.' })
        }
        return null
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, load, query]
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
