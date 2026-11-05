import { useCallback, useEffect, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'
import { dayIn, instantOf } from '@lib/time/zone.js'
import {
  DAILY_CALL_GOAL,
  dialHref,
  outcomeAsksOwner,
  outcomeEnds,
} from '@lib/outreach/prospects/calls.js'
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

/** The ones waiting on their owner, the soonest the front desk said first. */
function byOwnerDue(one, two) {
  const at = row => Date.parse(row.front_desk?.at ?? '') || Infinity
  return at(one) - at(two)
}

/**
 * The Call List: the businesses that answered the mail, the call backs due
 * today, then the businesses to ring, then the ones waiting on their owner,
 * and the day's calls against its goal.
 *
 * The never-called part is read a page at a time: `loadMore` adds the next
 * page of the ranking under what is already there.
 *
 * Recording a call settles the list where it stands rather than reading it
 * again. A call takes its business off the list; a call back due today puts
 * it in the due part, and a Front Desk call whose time is later puts it at the
 * foot with the owner's name and number on it. A call that ends it - Pipeline
 * among them - takes the business off and puts it nowhere. Nothing else on the list moves,
 * so the answer is known without a round trip, and the next business is
 * already on screen when the save lands. The day's count comes back with the
 * save.
 *
 * @param {{token: string|null}} options
 */
export function useCallList({ token }) {
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
        `${CALLS_PATH}?page=${page}&t=${Date.now()}`
      )
      if (!response.ok) throw new Error(faultFromResponse(response, payload, NO_READ))
      return payload
    },
    [token]
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
          engaged: (payload.engaged ?? []).map(whole),
          due: (payload.due ?? []).map(whole),
          rows: (payload.rows ?? []).map(whole),
          waiting: (payload.waiting ?? []).map(whole),
          page: payload.page ?? 1,
          pages: payload.pages ?? 1,
          today: payload.today ?? { calls: 0, goal: DAILY_CALL_GOAL },
        })
      })
      .catch(cause => {
        if (!stop && alive.current) setError(faultMessage(cause, NO_READ))
      })
    return () => {
      stop = true
    }
  }, [token, read, alive])

  const loadMore = useCallback(async () => {
    if (!held || held.page >= held.pages) return
    setAdding(true)
    try {
      const payload = await read(held.page + 1)
      if (!alive.current) return
      setHeld(was => {
        if (!was) return was
        const seen = new Set(
          [...was.engaged, ...was.due, ...was.rows, ...was.waiting].map(row => row.id)
        )
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
          // An outcome that ends the list carries no call back the list reads:
          // Pipeline's time is the pipeline's follow-up.
          const ends = outcomeEnds(call.outcome)
          const dueToday = !ends && back && back < tomorrow()
          const frontDesk = outcomeAsksOwner(call.outcome)
          const owner = payload.owner ?? null
          const after = {
            ...business,
            ...(owner
              ? {
                  owner_name: owner.name ?? null,
                  owner_name_confirmed: Boolean(owner.name_confirmed),
                  owner_phone: owner.phone ?? null,
                  owner_phone_confirmed: Boolean(owner.phone_confirmed),
                  owner_from: owner.from ?? null,
                  owner_phone_from: owner.phone_from ?? null,
                  dial: dialHref(owner.phone || business.phone),
                }
              : {}),
            calls: [logged, ...(business.calls ?? [])],
          }
          setHeld(was => {
            if (!was) return was
            const engaged = was.engaged.filter(row => row.id !== call.id)
            const rows = was.rows.filter(row => row.id !== call.id)
            const due = was.due.filter(row => row.id !== call.id)
            const waiting = was.waiting.filter(row => row.id !== call.id)
            if (dueToday) {
              due.push({
                ...after,
                due: { kind: 'callback', at: logged.callback_at },
                engaged: null,
                front_desk: null,
              })
              due.sort((one, two) => Date.parse(one.due.at) - Date.parse(two.due.at))
            } else if (frontDesk) {
              waiting.push({
                ...after,
                due: null,
                engaged: null,
                front_desk: { at: logged.callback_at },
              })
              waiting.sort(byOwnerDue)
            }
            const today = payload.today ?? {
              ...was.today,
              calls: (was.today?.calls ?? 0) + 1,
            }
            return { ...was, engaged, rows, due, waiting, today }
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

  return {
    engaged: held?.engaged ?? [],
    due: held?.due ?? [],
    rows: held?.rows ?? [],
    waiting: held?.waiting ?? [],
    today: held?.today ?? null,
    loading: !held && !error,
    error,
    more: Boolean(held && held.page < held.pages),
    adding,
    loadMore,
    record,
    saving,
  }
}
