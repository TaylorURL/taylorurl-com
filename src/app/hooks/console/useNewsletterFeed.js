import { useCallback, useEffect, useRef, useState } from 'react'

const NEWSLETTER_PATH = '/api/newsletter-admin'
const SEND_PATH = '/api/newsletter-send'
// What came back to each sent issue is counted where the list lives, over the
// send rows, and answers from the audience endpoint rather than this one.
const RESULTS_PATH = '/api/audience-admin'

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
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  /**
   * One request, with the session on it and the answer already unwrapped.
   * `who` names the endpoint in a failure, since two of them answer here.
   */
  const ask = useCallback(
    async (path, init, who = 'The newsletter endpoint') => {
      if (!token) return { ok: false, error: 'Sign in again.' }
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
        if (!response.ok) {
          return {
            ok: false,
            error: payload.error || `${who} answered ${response.status}.`,
          }
        }
        return { ok: true, payload }
      } catch {
        return { ok: false, error: `${who} did not answer.` }
      }
    },
    [token]
  )

  const load = useCallback(async () => {
    if (!token || !enabled) return
    const answer = await ask(`${NEWSLETTER_PATH}?view=list&t=${Date.now()}`)
    if (!alive.current) return
    if (!answer.ok) {
      setError(answer.error)
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
    const answer = await ask(
      `${RESULTS_PATH}?view=issues&t=${Date.now()}`,
      undefined,
      'The audience endpoint'
    )
    if (!alive.current) return
    if (!answer.ok) {
      setResultsError(answer.error)
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
      const answer = await ask(`${NEWSLETTER_PATH}?view=issue&id=${encodeURIComponent(id)}`)
      if (!answer.ok) {
        if (alive.current) setError(answer.error)
        return null
      }
      return answer.payload.issue
    },
    [ask]
  )

  /** The message as it will be sent, composed by the server. */
  const compose = useCallback(
    async id => {
      const answer = await ask(`${NEWSLETTER_PATH}?view=preview&id=${encodeURIComponent(id)}`)
      if (!answer.ok) {
        if (alive.current) setError(answer.error)
        return null
      }
      return answer.payload
    },
    [ask]
  )

  const act = useCallback(
    async (body, key) => {
      setActing(key)
      setError(null)
      const answer = await ask(NEWSLETTER_PATH, { method: 'POST', body: JSON.stringify(body) })
      if (!answer.ok) {
        if (alive.current) setError(answer.error)
        if (alive.current) setActing(null)
        return null
      }
      await load()
      if (alive.current) setActing(null)
      return answer.payload
    },
    [ask, load]
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
      setError(null)
      const answer = await ask(SEND_PATH, { method: 'POST', body: JSON.stringify({ issueId }) })
      if (!answer.ok) {
        if (alive.current) {
          setError(answer.error)
          setActing(null)
        }
        return null
      }
      // The send moves the sent count on the issue's row as well as the list.
      await Promise.all([load(), loadResults()])
      if (alive.current) setActing(null)
      return answer.payload
    },
    [ask, load, loadResults]
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
