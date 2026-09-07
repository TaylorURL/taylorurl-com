import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { answerFor, NOTHING_HELD } from './feedState'

const CALLS_PATH = '/api/calls-admin'

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
 * @param {{token: string|null, enabled: boolean,
 *   filters: {town: string, trade: string, pull: string, search: string, page: number}}} options
 * @returns {{data: object|null, retained: object|null, error: string|null,
 *   loading: boolean, saving: boolean, refresh: () => Promise<void>,
 *   record: (call: object) => Promise<object|null>}}
 */
export function useCallsFeed({ token, enabled, filters }) {
  const [held, setHeld] = useState(NOTHING_HELD)
  const [failed, setFailed] = useState(NOTHING_HELD)
  const [saving, setSaving] = useState(false)
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
        setFailed({
          key: query,
          value: payload.error || `The call list answered ${response.status}.`,
        })
        return
      }
      setHeld({ key: query, value: payload })
      setFailed(NOTHING_HELD)
    } catch {
      if (alive.current) setFailed({ key: query, value: 'The call list did not answer.' })
    }
  }, [token, enabled, query])

  useEffect(() => {
    load()
  }, [load])

  const record = useCallback(
    async call => {
      if (!token) return null
      setSaving(true)
      setFailed(NOTHING_HELD)
      try {
        const response = await fetch(CALLS_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(call),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (alive.current) {
            setFailed({ key: query, value: payload.error || 'That call was not recorded.' })
          }
          return null
        }
        await load()
        return payload
      } catch {
        if (alive.current) {
          setFailed({ key: query, value: 'That call did not reach the server.' })
        }
        return null
      } finally {
        if (alive.current) setSaving(false)
      }
    },
    [token, load, query]
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
