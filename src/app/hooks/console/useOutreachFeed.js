import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'
import { answerFor, NOTHING_HELD } from './feedState'

const OUTREACH_PATH = '/api/outreach-admin'
const JOB_PATH = '/api/outreach'

/** What a reader is told when one of the four reads does not land. */
const NO_BOARD = 'The outreach board could not be read. Try again in a moment.'
const NO_PROSPECT = 'That prospect could not be opened. Try again in a moment.'
const NO_QUEUE = 'The mail queue could not be read. Try again in a moment.'
const NO_PREVIEW = 'That message could not be laid out. Try again in a moment.'

/** And when a change does not take, or a job does not get going. */
const NO_CHANGE = 'That change could not be saved. Try it again.'
const NO_RUN = 'That job could not be run. Try it again.'

// How often the board is re-read while a job is in flight. A job opens its run
// row before it starts work, so a read taken during one carries the open row
// and the table shows the job as running rather than as it stood before.
const RUN_POLL_MS = 4000

/**
 * The outreach board, one prospect's profile, the changes that can be made to
 * either, one variant rendered as it would be sent, and the jobs run by hand.
 *
 * The board is one read: the stage counts, the day's sending, the settings,
 * every job's recent runs, and the page of prospects the filter selects. They
 * are read together because they are looked at together, and a count read
 * separately from the rows under it can disagree with them.
 *
 * The filter and the page are part of that read rather than applied to what
 * came back, because the endpoint answers with one page and a filter applied
 * afterwards would search only inside it.
 *
 * A profile is a second read, made when a prospect is opened and dropped when
 * it is closed. Message bodies are the bulk of it and no board needs them.
 *
 * The mail queue is a third. It is not part of the board because it does not
 * move with the board: paging the table re-reads the board, and working out
 * who the send job writes to next costs three reads and the same sort the
 * sender does. It is re-read when something changes and while a job is in
 * flight, which is when the queue actually moves.
 *
 * Every change re-reads. Skipping a prospect moves two stage counts and can
 * take the row out of the current filter, so patching what is on screen would
 * mean recomputing figures the page does not hold.
 *
 * A job is run against its own route rather than the board's. Each of the five
 * takes the same session this hook already holds, opens its run row, and
 * answers with what it did, which can take a minute; the board is re-read on a
 * short interval for as long as any of them is in flight, so the row moves
 * from running to finished on its own.
 *
 * `acting` is the key of the control a change is in flight for, and `running`
 * is the jobs started here and not yet answered, so one switch and one job show
 * their own progress without the rest of the page going quiet.
 *
 * A preview is a fourth read, made only when asked for. It answers with the
 * message and the business it was rendered for, or with the sentence saying
 * why it could not be, and it is held by whoever asked rather than here: the
 * board does not move when a message is looked at.
 *
 * All four reads keep their failures where they were asked for, because a
 * panel with nothing in it has to say why and a notice that faded after eight
 * seconds would leave it saying nothing. A change and a job are the other way
 * round: both leave the board on screen standing, so they are notices, which
 * also stops a job's refusal being wiped by the re-read that follows it.
 *
 * @param {{token: string|null, enabled: boolean, openId: string|null,
 *   filters: {stage: string, town: string, trade: string, band: string,
 *     sort: string, search: string, page: number}}} options
 * @returns {{data: object|null, error: string|null, loading: boolean,
 *   profile: object|null, profileError: string|null, profileLoading: boolean,
 *   mail: object|null, mailError: string|null, mailLoading: boolean,
 *   acting: string|null, running: string[], refresh: () => Promise<void>,
 *   act: (body: object, key: string) => Promise<object|null>,
 *   run: (job: string) => Promise<object|null>,
 *   preview: (variant: string) => Promise<object>}}
 */
export function useOutreachFeed({ token, enabled, filters, openId }) {
  const [held, setHeld] = useState(NOTHING_HELD)
  const [failed, setFailed] = useState(NOTHING_HELD)
  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState(null)
  const [mail, setMail] = useState(null)
  const [mailError, setMailError] = useState(null)
  const [acting, setActing] = useState(null)
  const [running, setRunning] = useState([])
  const toast = useToast()
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // The query string is the identity of this read: a new filter or a new page
  // is a new request, but an object literal rebuilt on every render is not.
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
      const response = await fetch(`${OUTREACH_PATH}?${query}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!alive.current) return
      if (!response.ok) {
        setFailed({ key: query, value: faultFromResponse(response, payload, NO_BOARD) })
        return
      }
      setHeld({ key: query, value: payload })
      setFailed(NOTHING_HELD)
    } catch (cause) {
      if (alive.current) setFailed({ key: query, value: faultMessage(cause, NO_BOARD) })
    }
  }, [token, enabled, query])

  useEffect(() => {
    load()
  }, [load])

  const loadProfile = useCallback(async () => {
    if (!token || !enabled || !openId) return
    try {
      const response = await fetch(
        `${OUTREACH_PATH}?view=prospect&id=${encodeURIComponent(openId)}&t=${Date.now()}`,
        { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
      )
      const payload = await response.json().catch(() => ({}))
      if (!alive.current) return
      if (!response.ok) {
        setProfileError(faultFromResponse(response, payload, NO_PROSPECT))
        return
      }
      setProfile(payload)
      setProfileError(null)
    } catch (cause) {
      if (alive.current) setProfileError(faultMessage(cause, NO_PROSPECT))
    }
  }, [token, enabled, openId])

  useEffect(() => {
    // Closing a prospect clears what was read for it, so opening the next one
    // shows its placeholder rather than the last one's messages.
    setProfile(null)
    setProfileError(null)
    loadProfile()
  }, [loadProfile])

  const loadMail = useCallback(async () => {
    if (!token || !enabled) return
    try {
      const response = await fetch(`${OUTREACH_PATH}?view=mail&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!alive.current) return
      if (!response.ok) {
        setMailError(faultFromResponse(response, payload, NO_QUEUE))
        return
      }
      setMail(payload)
      setMailError(null)
    } catch (cause) {
      if (alive.current) setMailError(faultMessage(cause, NO_QUEUE))
    }
  }, [token, enabled])

  useEffect(() => {
    loadMail()
  }, [loadMail])

  const act = useCallback(
    async (body, key) => {
      if (!token) return null
      setActing(key)
      try {
        const response = await fetch(OUTREACH_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          if (alive.current) toast(faultFromResponse(response, payload, NO_CHANGE), 'error')
          return null
        }
        await Promise.all([load(), loadProfile(), loadMail()])
        return payload
      } catch (cause) {
        if (alive.current) toast(faultMessage(cause, NO_CHANGE), 'error')
        return null
      } finally {
        if (alive.current) setActing(null)
      }
    },
    [token, load, loadProfile, loadMail, toast]
  )

  const run = useCallback(
    async job => {
      if (!token) return null
      setRunning(current => (current.includes(job) ? current : [...current, job]))
      try {
        const response = await fetch(`${JOB_PATH}/${job}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok && alive.current) {
          toast(faultFromResponse(response, payload, NO_RUN), 'error')
        }
        return response.ok ? payload : null
      } catch (cause) {
        if (alive.current) toast(faultMessage(cause, NO_RUN), 'error')
        return null
      } finally {
        if (alive.current) setRunning(current => current.filter(name => name !== job))
        await Promise.all([load(), loadMail()])
      }
    },
    [token, load, loadMail, toast]
  )

  const preview = useCallback(
    async variant => {
      if (!token) return { error: 'Sign in to render a preview.' }
      try {
        const response = await fetch(
          `${OUTREACH_PATH}?view=preview&variant=${encodeURIComponent(variant)}&t=${Date.now()}`,
          { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
        )
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) return { error: faultFromResponse(response, payload, NO_PREVIEW) }
        return payload
      } catch (cause) {
        return { error: faultMessage(cause, NO_PREVIEW) }
      }
    },
    [token]
  )

  // The identity of the list changes on every start and finish, so the count
  // is what the interval hangs on: a second job starting joins a poll that is
  // already running rather than restarting it.
  const busy = running.length > 0
  useEffect(() => {
    if (!busy) return undefined
    const timer = setInterval(() => {
      load()
      loadMail()
    }, RUN_POLL_MS)
    return () => clearInterval(timer)
  }, [busy, load, loadMail])

  // Filed under the filter that asked for it: a new stage, town, sort or page
  // is a different question, and the board on screen is not its answer.
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
    profile,
    profileError,
    profileLoading: Boolean(openId) && !profile && !profileError,
    mail,
    mailError,
    mailLoading: !mail && !mailError,
    acting,
    running,
    refresh: load,
    act,
    run,
    preview,
  }
}
