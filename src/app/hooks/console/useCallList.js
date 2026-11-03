import { useCallback, useEffect, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'
import { dayIn, instantOf } from '@lib/time/zone.js'
import { readEndpoint, writeEndpoint } from './endpoint'
import { useAlive } from './useAlive'

const CALLS_PATH = '/api/calls-admin'

/** What the owner is told when the list does not load. */
const NO_READ = 'The call list could not be read. Try again in a moment.'

/** And when a call does not get written down. */
const NO_RECORD = 'That call could not be saved. Try it again.'

/**
 * A business with the two lists the page reads always present, so a row from
 * an answer that left one off draws as having none rather than throwing.
 */
function whole(row) {
  return { ...row, reasons: row?.reasons ?? [], calls: row?.calls ?? [] }
}

/** The first instant of tomorrow in the studio's zone, where "due today" ends. */
function tomorrow() {
  const [year, month, day] = dayIn(new Date()).split('-').map(Number)
  return instantOf(new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10))
}

/**
 * The Call List: the call backs due today, then the businesses to ring.
 *
 * One view at a time, and the best-leads view a page at a time: `loadMore`
 * adds the next page of the ranking under what is already there.
 *
 * Recording a call settles the list where it stands rather than reading it
 * again. A call takes its business off the list - the only thing that brings
 * one back is a call back, which is due today or not - and nothing else on the
 * list moves, so the answer is known without a round trip, and the next
 * business is already on screen when the save lands.
 *
 * @param {{token: string|null, view: string}} options
 */
export function useCallList({ token, view }) {
  const [held, setHeld] = useState(null)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const alive = useAlive()

  const read = useCallback(
    async page => {
      const { response, payload } = await readEndpoint(
        token,
        `${CALLS_PATH}?view=${encodeURIComponent(view)}&page=${page}&t=${Date.now()}`
      )
      if (!response.ok) throw new Error(faultFromResponse(response, payload, NO_READ))
      return payload
    },
    [token, view]
  )

  useEffect(() => {
    if (!token) return undefined
    let stop = false
    setHeld(null)
    setError(null)
    read(1)
      .then(payload => {
        if (stop || !alive.current) return
        setHeld({
          view,
          due: (payload.due ?? []).map(whole),
          rows: (payload.rows ?? []).map(whole),
          page: payload.page ?? 1,
          pages: payload.pages ?? 1,
        })
      })
      .catch(cause => {
        if (!stop && alive.current) setError(faultMessage(cause, NO_READ))
      })
    return () => {
      stop = true
    }
  }, [token, view, read, alive])

  const loadMore = useCallback(async () => {
    if (!held || held.page >= held.pages) return
    setAdding(true)
    try {
      const payload = await read(held.page + 1)
      if (!alive.current) return
      setHeld(was => {
        if (!was) return was
        const seen = new Set([...was.due, ...was.rows].map(row => row.id))
        return {
          ...was,
          rows: [...was.rows, ...(payload.rows ?? []).filter(row => !seen.has(row.id)).map(whole)],
          page: payload.page ?? was.page + 1,
          pages: payload.pages ?? was.pages,
        }
      })
    } catch (cause) {
      if (alive.current) toast(faultMessage(cause, NO_READ), 'error')
    } finally {
      if (alive.current) setAdding(false)
    }
  }, [held, read, toast, alive])

  const record = useCallback(
    async (call, business) => {
      if (!token) return null
      setSaving(true)
      try {
        const { response, payload } = await writeEndpoint(token, CALLS_PATH, call)
        if (!response.ok) {
          if (alive.current) toast(faultFromResponse(response, payload, NO_RECORD), 'error')
          return null
        }
        if (alive.current) {
          const logged = {
            id: payload.call,
            outcome: call.outcome,
            note: call.note,
            callback_at: payload.callback_at ?? null,
            called_at: payload.called_at ?? new Date().toISOString(),
          }
          const back = logged.callback_at ? new Date(logged.callback_at) : null
          const dueToday = back && back < tomorrow()
          setHeld(was => {
            if (!was) return was
            const rows = was.rows.filter(row => row.id !== call.id)
            const due = was.due.filter(row => row.id !== call.id)
            if (dueToday) {
              due.push({
                ...business,
                due: { kind: 'callback', at: logged.callback_at },
                calls: [logged, ...(business.calls ?? [])],
              })
              due.sort((one, two) => Date.parse(one.due.at) - Date.parse(two.due.at))
            }
            return { ...was, rows, due }
          })
        }
        return payload
      } catch (cause) {
        if (alive.current) toast(faultMessage(cause, NO_RECORD), 'error')
        return null
      } finally {
        if (alive.current) setSaving(false)
      }
    },
    [token, toast, alive]
  )

  const current = held?.view === view ? held : null
  return {
    due: current?.due ?? [],
    rows: current?.rows ?? [],
    loading: !current && !error,
    error,
    more: Boolean(current && current.page < current.pages),
    adding,
    loadMore,
    record,
    saving,
  }
}
