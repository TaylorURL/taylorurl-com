import { useCallback, useEffect, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { useToast } from '@hooks/chrome/useToast'

const NEWSLETTER_PATH = '/api/newsletter-admin'
const SEND_PATH = '/api/newsletter-send'
// What came back to each sent issue is counted where the list lives, over the
// send rows, and answers from the audience endpoint rather than this one.
const RESULTS_PATH = '/api/audience-admin'

/** What a reader is told when each of the four reads does not land. */
const NO_LIST = 'The issues could not be read. Try again in a moment.'
const NO_RESULTS = 'The results could not be read. Try again in a moment.'
const NO_ISSUE = 'That issue could not be opened. Try again in a moment.'
const NO_PREVIEW = 'The preview could not be built. Try again in a moment.'

/** And when one of the two writes does not take. */
const NO_CHANGE = 'That change could not be saved. Try it again.'
const NO_SEND = 'The issue could not be sent. Try sending it again.'

/**
 * The issues, the one being written, the message it will go out as, and what
 * each one did once it landed.
 *
 * Four reads rather than one, because they move at different rates. The list
 * changes when an issue is created, saved or sent. The open issue changes on
 * every keystroke the page holds and is only re-read when a different one is
 * opened. The preview is composed by the server against a real recipient, so
 * it is asked for rather than derived, and it is asked for again after a save
 * - a preview of the draft as it was two edits ago is worse than none. What
 * came back moves on its own clock: Resend reports a delivery, an open or a
 * bounce hours after the send, so it is read on arrival and after a send, and
 * left alone while an issue is being written.
 *
 * Every write re-reads the list. A save moves the updated time, marking an
 * issue ready moves its status and the count of what can be sent, and a send
 * moves all of it; patching a row in place would leave the figures above the
 * table describing the list before the change.
 *
 * A read that does not land is held in `error` and drawn where the issues
 * would have been, because a notice that fades would leave a blank composer
 * with nothing to explain it. A save or a send that does not take leaves the
 * issue on screen untouched, so it is a notice in the bottom-right corner of
 * the screen rather than a banner over an issue that is still right.
 *
 * `acting` is the key of the control a change is in flight for, so one button
 * shows its own progress while the rest of the page stays live.
 *
 * @param {{token: string|null, enabled: boolean}} options
 */
export function useNewsletterFeed({ token, enabled }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)
  const [resultsError, setResultsError] = useState(null)
  const [acting, setActing] = useState(null)
  const toast = useToast()
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  /**
   * One request, with the session on it and the answer already unwrapped.
   *
   * `fallback` is what a reader is told when neither the far end nor the door
   * has anything better, and every caller passes its own, because which of the
   * six things on this page did not happen is the only part of the sentence
   * worth reading. The failure comes back as `fault` rather than `error` for
   * the same reason it is written here at all: what leaves this function is
   * always a sentence for a person, never the raw thing that was caught.
   */
  const ask = useCallback(
    async (path, init, fallback) => {
      // Nothing on this page can be read without a session, and a lost one is
      // the same sentence wherever it is met, so it is taken from the door
      // rather than written again here.
      if (!token) return { ok: false, fault: faultMessage(401) }
      try {
        const response = await fetch(path, {
          cache: 'no-store',
          ...init,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          },
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok)
          return { ok: false, fault: faultFromResponse(response, payload, fallback) }
        return { ok: true, payload }
      } catch (cause) {
        return { ok: false, fault: faultMessage(cause, fallback) }
      }
    },
    [token]
  )

  const load = useCallback(async () => {
    if (!token || !enabled) return
    const answer = await ask(`${NEWSLETTER_PATH}?view=list&t=${Date.now()}`, undefined, NO_LIST)
    if (!alive.current) return
    if (!answer.ok) {
      setError(answer.fault)
      return
    }
    setData(answer.payload)
    setError(null)
  }, [ask, token, enabled])

  useEffect(() => {
    load()
  }, [load])

  /**
   * What each sent issue did once it landed.
   *
   * A second read rather than a column on the list, because working out an
   * issue's reach costs a read of every send row behind it, and the list is
   * re-read on every save.
   */
  const loadResults = useCallback(async () => {
    if (!token || !enabled) return
    const answer = await ask(`${RESULTS_PATH}?view=issues&t=${Date.now()}`, undefined, NO_RESULTS)
    if (!alive.current) return
    if (!answer.ok) {
      setResultsError(answer.fault)
      return
    }
    setResults(answer.payload)
    setResultsError(null)
  }, [ask, token, enabled])

  useEffect(() => {
    loadResults()
  }, [loadResults])

  /** One issue, whole, for the composer to hold and edit. */
  const open = useCallback(
    async id => {
      const answer = await ask(
        `${NEWSLETTER_PATH}?view=issue&id=${encodeURIComponent(id)}`,
        undefined,
        NO_ISSUE
      )
      if (!answer.ok) {
        if (alive.current) setError(answer.fault)
        return null
      }
      return answer.payload.issue
    },
    [ask]
  )

  /** The message as it will be sent, composed by the server. */
  const compose = useCallback(
    async id => {
      const answer = await ask(
        `${NEWSLETTER_PATH}?view=preview&id=${encodeURIComponent(id)}`,
        undefined,
        NO_PREVIEW
      )
      if (!answer.ok) {
        if (alive.current) setError(answer.fault)
        return null
      }
      return answer.payload
    },
    [ask]
  )

  const act = useCallback(
    async (body, key) => {
      setActing(key)
      const answer = await ask(
        NEWSLETTER_PATH,
        { method: 'POST', body: JSON.stringify(body) },
        NO_CHANGE
      )
      if (!answer.ok) {
        if (alive.current) {
          toast(answer.fault, 'error')
          setActing(null)
        }
        return null
      }
      await load()
      if (alive.current) setActing(null)
      return answer.payload
    },
    [ask, load, toast]
  )

  /**
   * The send, which is its own endpoint rather than an action on this one.
   *
   * It answers with what it did - who it reached, who is still owed, and the
   * status the issue now holds - and the list is re-read afterwards so the row
   * on screen says the same thing.
   */
  const send = useCallback(
    async issueId => {
      setActing('send')
      const answer = await ask(
        SEND_PATH,
        { method: 'POST', body: JSON.stringify({ issueId }) },
        NO_SEND
      )
      if (!answer.ok) {
        if (alive.current) {
          toast(answer.fault, 'error')
          setActing(null)
        }
        return null
      }
      // The send moves the sent count on the issue's row as well as the list.
      await Promise.all([load(), loadResults()])
      if (alive.current) setActing(null)
      return answer.payload
    },
    [ask, load, loadResults, toast]
  )

  return {
    data,
    error,
    loading: !data && !error,
    results,
    resultsError,
    resultsLoading: !results && !resultsError,
    acting,
    refresh: load,
    open,
    compose,
    act,
    send,
    clearError: () => setError(null),
  }
}
