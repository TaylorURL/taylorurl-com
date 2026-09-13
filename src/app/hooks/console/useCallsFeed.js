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
 * How often the list re-reads itself while somebody is looking at it.
 *
 * The list is one queue with more than one person on it, so a page held still
 * is a page that quietly stops being true: a business somebody else rang four
 * minutes ago is still sitting at the top of it, offered. Thirty seconds is
 * slower than the desk beat next door on purpose - this read ranks every
 * callable business against the middle of its own trade and reads the whole
 * calls table to do it, and the answer moves far more slowly than who is on a
 * phone right now.
 */
const LIVE_MS = 30_000

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
 * The read repeats on its own while somebody is watching, because the list is
 * one queue with more than one caller on it: a business somebody else rang four
 * minutes ago is otherwise still at the top of this console, offered. What that
 * costs is a full re-rank every half minute, which is why it is half a minute
 * and not five seconds - who is on a phone right now is answered by the desk
 * feed next door, which is one small row and is polled far faster.
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
 *     town: string, trade: string, assigned: string, sort: string,
 *     search: string, take: number, page: number}}} options
 * @returns {{data: object|null, error: string|null, loading: boolean, saving: boolean,
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

  // And again, on its own, for as long as somebody is looking. A hidden tab
  // re-reads nothing and catches up the moment it comes back: the list is
  // worked at a desk with the console in front of the caller, and a background
  // tab re-ranking fifteen hundred businesses nobody is reading is the one case
  // where being live costs something and returns nothing.
  useEffect(() => {
    if (!token || !enabled) return undefined
    const tick = () => {
      if (document.visibilityState === 'visible') load()
    }
    const timer = setInterval(tick, LIVE_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [token, enabled, load])

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

  return {
    data,
    error,
    loading: !data && !error,
    saving,
    record,
  }
}
