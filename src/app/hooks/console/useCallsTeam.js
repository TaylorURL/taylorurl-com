import { useCallback, useEffect, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'
import { readEndpoint, writeEndpoint } from './endpoint'
import { answerFor, NOTHING_HELD, queryOf } from './feedState'
import { useAlive } from './useAlive'

const TEAM_PATH = '/api/calls-team'

/** What a reader is told when the board behind the section does not land. */
const NO_READ = 'The team could not be read. Try again in a moment.'

/** And when a shift somebody set does not get stored. */
const NO_SAVE = 'Those goals could not be saved. Try it again.'

/**
 * How often the board re-reads itself while somebody is looking at it.
 *
 * The same half minute the call list next door takes, and for the same reason:
 * the figures on this board move when somebody finishes a call, which is a
 * pace measured in minutes rather than seconds. Who is on a phone right now is
 * the one fact here that moves faster, and it is already answered by the desk
 * beat, which runs three times a minute against one small row.
 */
const LIVE_MS = 30_000

/**
 * Everybody on the phones, and what each of them has come to.
 *
 * One read covers the whole Team section - the totals strip, the chart under
 * it and the staff list under that are three readings of one set taken at one
 * moment, and asking for them apart would leave a strip that can disagree with
 * the rows beneath it for as long as the second request took.
 *
 * The span is part of the question rather than something applied to what came
 * back. The window decides which calls are read at all, so a payload taken for
 * thirty days is not a narrower answer to "today" - it is a different one, and
 * filing it under the span that asked for it is what makes the section report
 * itself as loading again when the span changes rather than redrawing last
 * month's figures under a label saying Today.
 *
 * Setting somebody's shift re-reads rather than patching the row on screen.
 * The figures beside a goal are drawn against it - the tracks, the "of 40", and
 * whether a row reads as behind - so a goal changed in place would leave three
 * derived readings on screen that no longer follow from anything, until the
 * next poll quietly corrected them.
 *
 * The two failures go to different places, as they do in the list feed. A read
 * that does not land leaves the section with nothing to draw, so it is held in
 * `error` and stands where the rows would have been. A shift that does not save
 * leaves the board as it was and the figures still in the editor, so it is a
 * notice in the corner rather than a banner over rows that are still right.
 *
 * @param {{token: string|null, enabled: boolean, days: number}} options
 * @returns {{data: object|null, error: string|null, loading: boolean, saving: boolean,
 *   setGoals: (userId: string, goals: object) => Promise<boolean>}}
 */
export function useCallsTeam({ token, enabled, days }) {
  const [held, setHeld] = useState(NOTHING_HELD)
  const [failed, setFailed] = useState(NOTHING_HELD)
  const [saving, setSaving] = useState(false)
  const toast = useToast()
  const alive = useAlive()

  const query = queryOf({ days })

  const load = useCallback(async () => {
    if (!token || !enabled) return
    try {
      const { response, payload } = await readEndpoint(
        token,
        `${TEAM_PATH}?${query}&t=${Date.now()}`
      )
      if (!alive.current) return
      // An answer without a roster in it is not an answer, whatever the status
      // said: a page served in the endpoint's place parses to nothing, and a
      // board drawn from nothing is a board that throws on its first chart.
      if (!response.ok || !Array.isArray(payload?.people)) {
        setFailed({ key: query, value: faultFromResponse(response, payload, NO_READ) })
        return
      }
      setHeld({ key: query, value: payload })
      setFailed(NOTHING_HELD)
    } catch (cause) {
      if (alive.current) setFailed({ key: query, value: faultMessage(cause, NO_READ) })
    }
  }, [token, enabled, query, alive])

  useEffect(() => {
    load()
  }, [load])

  // And again, on its own, for as long as somebody is looking. A hidden tab
  // reads nothing and catches up the moment it comes back: this board is a
  // screen somebody glances at between calls, and one left open behind six
  // other tabs is not somebody watching the desk.
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

  const setGoals = useCallback(
    async (userId, goals) => {
      if (!token) return false
      setSaving(true)
      try {
        const { response, payload } = await writeEndpoint(token, TEAM_PATH, {
          user_id: userId,
          goals,
        })
        if (!response.ok) {
          if (alive.current) toast(faultFromResponse(response, payload, NO_SAVE), 'error')
          return false
        }
        // Waited for, unlike the list's own writes. The editor closes on a
        // true, and closing it over figures the board has not caught up with
        // would show somebody the shift they just replaced.
        await load()
        return true
      } catch (cause) {
        if (alive.current) toast(faultMessage(cause, NO_SAVE), 'error')
        return false
      } finally {
        if (alive.current) setSaving(false)
      }
    },
    [token, load, toast, alive]
  )

  // Filed under the span that asked for it: a different window is a different
  // question, and the board on screen is not its answer.
  const data = answerFor(held, query)
  const error = answerFor(failed, query)

  return {
    data,
    error,
    loading: !data && !error,
    saving,
    setGoals,
  }
}
