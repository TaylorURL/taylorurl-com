import { useCallback, useEffect, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { readEndpoint, writeEndpoint } from './endpoint'
import { answerFor, NOTHING_HELD } from './feedState'
import { useAlive } from './useAlive'

/**
 * The one address a brief is read and written at.
 *
 * A read is `?project=<id>` and a write is a POST carrying an action, which is
 * the shape `api/projects.js` already answers in. What comes back either way is
 * the stored row under `brief`, and it is the row rather than an
 * acknowledgement because the figure is clamped and raised on the way in and
 * submitting stamps a time: what the browser sent and what the record now
 * holds are not the same thing.
 */
const ONBOARDING_PATH = '/api/onboarding'

/**
 * How long a client stops typing before what they wrote goes up.
 *
 * Long enough that a paragraph is a handful of requests rather than four
 * hundred, short enough that somebody who writes a line and walks away has
 * already had it saved. Every other point a thought ends - the step changing,
 * the control being pressed, the tab going away - writes at once rather than
 * waiting this out, so the delay is only ever paid mid-sentence.
 */
const IDLE_MS = 800

/**
 * Where a preview's brief is kept, under the prefix every preview record
 * shares.
 *
 * The prefix is what leaving a preview sweeps, so a record written here is
 * cleared by a control that does not have to know this file exists. Session
 * storage rather than local: a preview belongs to the tab and the sitting that
 * opened it, and the next one has to start where a client starts rather than
 * halfway through the last rehearsal.
 */
const PREVIEW_KEY = 'taylorurl_console_preview_brief'

/**
 * The step a brief nobody has answered opens on.
 *
 * The column's own default, repeated here so a first render has somewhere to
 * be. Which steps there are and what order they come in is the flow's list;
 * this holds the name it is handed and never reads that list.
 */
const FIRST_STEP = 'welcome'

/**
 * What a client is told when a change did not reach the record.
 *
 * These two are the whole of what a failed write says here, and nothing the
 * far end sends is allowed to stand in their place. Both of them know the one
 * thing that actually settles the question a client is asking - the words are
 * still in the box, still going up on the next change - and no endpoint can
 * know that, so however well it words its refusal it is answering a smaller
 * question. The write paths below hold these rather than reading anything out
 * of the response.
 */
const NOT_SAVED =
  'That answer was not saved. Nothing you typed is lost, and it goes up again on the next change.'

/** And when the brief itself did not go over. */
const NOT_SENT =
  'The answers were not sent. Everything you typed is still saved, so try again in a moment.'

/** A read is the other way round, and this is where one that failed lands. */
const NOT_READ = 'Your brief could not be read.'

/** The browser's own store, where there is one. */
function store() {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    // A browser set to block site data throws on the accessor itself rather
    // than answering empty, so reaching it is what has to be guarded.
    return null
  }
}

/**
 * A record in the shape the console holds one, whatever it was read out of.
 *
 * Every field is read back through its own shape rather than trusted, because
 * what arrives is either a row from a table that outlives this file or an
 * entry written by whichever version of this page last wrote one. Anything
 * half understood restores as an unanswered brief, which is where a client
 * starts anyway.
 */
function recordOf({ answers, step, percent, submittedAt }) {
  return {
    answers: answers && typeof answers === 'object' ? answers : {},
    step: typeof step === 'string' && step ? step : FIRST_STEP,
    percent: Number.isFinite(percent) ? percent : 0,
    submittedAt: typeof submittedAt === 'string' ? submittedAt : null,
  }
}

/**
 * A stored row as the console reads one.
 *
 * The row's word for the figure is `progress`, because that is the column; the
 * console's word is percent, because that is what gets drawn. Renaming it once
 * here is what keeps the column's word out of every panel that draws a bar.
 */
function recordFrom(row) {
  return recordOf({
    answers: row?.answers,
    step: row?.step,
    percent: row?.progress,
    submittedAt: row?.submitted_at,
  })
}

/**
 * The figure to hold, given the one already held and the one the flow just
 * worked out.
 *
 * The rule is the database's: the stored figure is raised rather than set, and
 * nothing short of a submission reaches 100. It is repeated here so the bar
 * reads the same before an answer comes back as after it, and so a client who
 * goes back and empties a required field watches it stand still rather than
 * fall. The database is still the one that decides; this only stops the drawn
 * figure disagreeing with the stored one for the length of a request.
 */
function raised(current, live) {
  if (!Number.isFinite(live)) return current
  return Math.max(current, Math.min(99, Math.floor(live)))
}

/**
 * One build's brief: what the client has answered, and everything that writes
 * it down.
 *
 * Read once rather than on a timer, which is the whole difference between this
 * and the tracker beside it. The tracker polls because the other side of a
 * build moves without the client touching anything - a stage advances, an
 * update is written, a picture is attached. Nothing on this record moves but
 * the client's own typing, so a timer would have nothing to bring back and
 * would arrive mid-sentence to bring it, putting the last saved version into
 * the box under somebody's cursor.
 *
 * For the same reason the local draft outranks the record for as long as the
 * flow is open. What comes back from a write is the figure and the moment it
 * was handed over, never the answers, and a read that lands while there is
 * unsent typing keeps the typing. `WrittenAsk` on the tracker holds its own
 * draft against the poll for exactly this reason; here the whole record is the
 * draft.
 *
 * Typing goes up on an idle rather than on a keystroke, and again at every
 * point a thought ends: the step changes, the control is pressed, the tab goes
 * away, the flow unmounts. A write that fails changes nothing except that the
 * sentence saying so gets drawn - the draft stays where it is, it stays marked
 * as unsent, and it goes up again with the next change or the next flush. No
 * path here ends with a client's words in neither the box nor the record.
 *
 * `preview` is the admin's rehearsal, and it never touches the network at all.
 * Every read and every write is the tab's own session storage, answered in the
 * same tick, so an admin walking the flow cannot open a row, cannot raise a
 * figure on somebody's build and cannot submit anything. That is a property of
 * this file rather than of the endpoint's manners, which is what makes it safe
 * to hand the whole flow to an admin unchanged.
 *
 * `saving` is a boolean where the tracker's feed carries a key, because there
 * is one record and one writer: nothing here needs telling apart from anything
 * else in flight.
 *
 * @param {{token: string|null, projectId: string|null, enabled: boolean,
 *   preview: boolean}} options
 * @returns {{answers: object|null, step: string, percent: number,
 *   submittedAt: string|null, error: string|null, loading: boolean,
 *   saving: boolean, save: (answers: object, percent: number) => void,
 *   saveNow: () => Promise<boolean>, submit: () => Promise<boolean>,
 *   setStep: (step: string) => Promise<boolean>, refresh: () => Promise<void>}}
 */
export function useOnboardingFeed({ token, projectId, enabled, preview }) {
  const [held, setHeld] = useState(NOTHING_HELD)
  const [failed, setFailed] = useState(NOTHING_HELD)
  const [saving, setSaving] = useState(false)
  const alive = useAlive()

  // The record as the client has it, and whether the record behind it has been
  // told. Both are refs because every writer below reads them: held in state,
  // a callback would be rebuilt on each keystroke and restart the idle it was
  // called to extend.
  const latest = useRef(null)
  const unsent = useRef(false)
  const timer = useRef(null)

  // Which record is being held. A preview and a real brief are different
  // records, so what was read for one reads back as nothing under the other and
  // the flow draws its skeleton rather than a client's answers under a preview
  // strip.
  const source = preview ? 'preview' : projectId || null

  /** Hold a record, in both the place callbacks read and the place React draws. */
  const put = useCallback(
    record => {
      latest.current = record
      setHeld({ key: source, value: record })
    },
    [source]
  )

  /**
   * What a write the record accepted brings back in. Only the figure and the
   * moment: the answers on screen are the client's own and are newer than
   * anything a reply to a request already sent can carry.
   */
  const accept = useCallback(
    brief => {
      const row = recordFrom(brief)
      put({
        ...latest.current,
        percent: Math.max(latest.current.percent, row.percent),
        submittedAt: row.submittedAt,
      })
      setFailed(NOTHING_HELD)
    },
    [put]
  )

  /**
   * Put whatever is unsent up, and answer whether it landed.
   *
   * `keepalive` is for the two calls made while the page is going away. A
   * fetch from a document that is unloading is cancelled without it, and the
   * last thing somebody typed before closing the tab is the write most worth
   * keeping.
   *
   * What is being sent is remembered by identity rather than by copying it, so
   * a keystroke that arrived while the request was in flight is not marked as
   * saved by an answer to the version before it. Nothing clears the unsent
   * mark but a write the record accepted, which is what makes a failure cost a
   * sentence on screen and none of the writing.
   */
  const flush = useCallback(
    async ({ keepalive = false } = {}) => {
      window.clearTimeout(timer.current)
      const outgoing = latest.current
      if (!unsent.current || !outgoing) return true

      if (preview) {
        const kept = store()
        if (kept) kept.setItem(PREVIEW_KEY, JSON.stringify(outgoing))
        if (latest.current === outgoing) unsent.current = false
        return true
      }

      if (!token || !projectId || !enabled) return false
      if (alive.current) setSaving(true)
      try {
        const { response, payload } = await writeEndpoint(
          token,
          ONBOARDING_PATH,
          {
            action: 'save',
            project_id: projectId,
            answers: outgoing.answers,
            step: outgoing.step,
            percent: outgoing.percent,
          },
          { keepalive }
        )
        if (!response.ok) {
          if (alive.current) setFailed({ key: source, value: NOT_SAVED })
          return false
        }
        if (latest.current === outgoing) unsent.current = false
        if (alive.current) accept(payload.brief)
        return true
      } catch {
        if (alive.current) setFailed({ key: source, value: NOT_SAVED })
        return false
      } finally {
        if (alive.current) setSaving(false)
      }
    },
    [preview, token, projectId, enabled, source, accept, alive]
  )

  // The flush everything else reaches for, kept current rather than named as a
  // dependency. Named as one, a debounce would restart every time the session
  // handed down a fresh token and never fire under somebody typing, and the
  // unmount below would run its cleanup on every change instead of when the
  // flow actually closes.
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  const load = useCallback(async () => {
    if (preview) {
      // Answered out of the tab's own store, in the same tick. Nothing on this
      // path reaches the network, so an admin walking the flow cannot open a
      // row, move a figure or reach a real build, whatever the console around
      // them believes it is holding.
      let stored = null
      try {
        stored = JSON.parse(store()?.getItem(PREVIEW_KEY) || 'null')
      } catch {
        stored = null
      }
      unsent.current = false
      put(recordOf(stored || {}))
      setFailed(NOTHING_HELD)
      return
    }

    if (!token || !projectId || !enabled) return
    try {
      const { response, payload } = await readEndpoint(
        token,
        `${ONBOARDING_PATH}?project=${encodeURIComponent(projectId)}&t=${Date.now()}`
      )
      if (!alive.current) return
      if (!response.ok) {
        // A build nobody has answered anything on is not an error and never
        // reaches here; the endpoint opens the row on the first read. This is
        // the endpoint itself failing to answer.
        setFailed({ key: source, value: faultFromResponse(response, payload, NOT_READ) })
        return
      }
      const row = recordFrom(payload.brief)
      // Typing that has not reached the record outranks what the record sent
      // back, every time. A read that overwrote it would be this hook losing
      // the one thing it exists to keep.
      put(
        unsent.current && latest.current
          ? {
              ...row,
              answers: latest.current.answers,
              step: latest.current.step,
              percent: Math.max(latest.current.percent, row.percent),
            }
          : row
      )
      setFailed(NOTHING_HELD)
    } catch (cause) {
      if (alive.current) setFailed({ key: source, value: faultMessage(cause, NOT_READ) })
    }
  }, [preview, token, projectId, enabled, source, put, alive])

  useEffect(() => {
    load()
  }, [load])

  /**
   * Take a change, and start the clock on writing it down.
   *
   * The percent is the flow's arithmetic rather than this hook's: what counts
   * as answered is a property of the fields, and nothing here reads inside the
   * document it holds. What becomes of the figure once it arrives is the
   * database's rule, applied here so the bar and the row agree.
   */
  const save = useCallback(
    (answers, percent) => {
      const now = latest.current
      if (!now) return
      put({ ...now, answers, percent: raised(now.percent, percent) })
      unsent.current = true
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        flushRef.current()
      }, IDLE_MS)
    },
    [put]
  )

  const saveNow = useCallback(() => flushRef.current(), [])

  /**
   * Move to a step, and write it down at once rather than on the idle.
   *
   * Which step is furthest is the flow's arithmetic, because the order of the
   * steps is the flow's list; this records the name it is handed. A step change
   * is a save point rather than one more keystroke: it is the moment a client
   * would expect to be able to close the tab on.
   */
  const setStep = useCallback(
    step => {
      const now = latest.current
      if (!now || step === now.step) return Promise.resolve(true)
      put({ ...now, step })
      unsent.current = true
      return flushRef.current()
    },
    [put]
  )

  /**
   * Hand the brief over.
   *
   * Whatever is still sitting on the idle goes first, and the submission is
   * abandoned if that does not land: a brief submitted around an unsent
   * paragraph is a brief the studio reads without the paragraph in it, and
   * nothing on either side would say so.
   *
   * The record is the one that writes 100 and the one that re-checks what is
   * required before it does, so the refusal for an unfinished brief comes back
   * from the same place every other refusal on a project does.
   */
  const submit = useCallback(async () => {
    if (!(await flushRef.current())) return false

    if (preview) {
      const now = latest.current
      if (!now) return false
      const record = { ...now, percent: 100, submittedAt: new Date().toISOString() }
      const kept = store()
      if (kept) kept.setItem(PREVIEW_KEY, JSON.stringify(record))
      put(record)
      return true
    }

    if (!token || !projectId || !enabled) return false
    setSaving(true)
    try {
      const { response, payload } = await writeEndpoint(token, ONBOARDING_PATH, {
        action: 'submit',
        project_id: projectId,
      })
      if (!response.ok) {
        if (alive.current) setFailed({ key: source, value: NOT_SENT })
        return false
      }
      if (alive.current) accept(payload.brief)
      return true
    } catch {
      if (alive.current) setFailed({ key: source, value: NOT_SENT })
      return false
    } finally {
      if (alive.current) setSaving(false)
    }
  }, [preview, token, projectId, enabled, source, put, accept, alive])

  /**
   * The two ways a flow ends without anybody pressing anything.
   *
   * Unmounting is the client moving on inside the console, and `pagehide` is
   * the tab being closed, dropped by a phone reclaiming memory, or navigated
   * away from - which on a phone is the last event a page reliably gets. Both
   * send whatever is still on the idle, so the most anybody can lose is the
   * fraction of a second between their last keystroke and the flow closing.
   */
  useEffect(() => {
    const leaving = () => {
      flushRef.current({ keepalive: true })
    }
    window.addEventListener('pagehide', leaving)
    return () => {
      window.removeEventListener('pagehide', leaving)
      leaving()
    }
  }, [])

  const record = answerFor(held, source)
  const error = answerFor(failed, source)

  return {
    answers: record?.answers ?? null,
    step: record?.step ?? FIRST_STEP,
    percent: record?.percent ?? 0,
    submittedAt: record?.submittedAt ?? null,
    error,
    // A brief that has not landed draws its skeleton rather than a nought:
    // every figure on the flow comes off this record, and a zero drawn before
    // the read arrives is a wrong answer rather than a missing one.
    loading: !record && !error,
    saving,
    save,
    saveNow,
    submit,
    setStep,
    refresh: load,
  }
}
