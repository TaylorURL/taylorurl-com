import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { answerFor, NOTHING_HELD } from './feedState'

const MAIL_PATH = '/api/mail-admin'

/**
 * Everything the site has sent, and whichever one of them is open.
 *
 * Two reads rather than one. The list moves with the filter and the page; the
 * message being read does not, and re-fetching it every time the list behind
 * it changed would empty the pane the moment a search was typed into. They are
 * filed separately for the same reason they are asked for separately.
 *
 * Both are filed under the question that asked for them. A new filter is a new
 * question and the rows on screen are not its answer, so the list reports as
 * loading again rather than handing back what it last held.
 *
 * `sending` is the id a copy is in flight for, so the one message being sent
 * shows its own progress and the list does not go quiet around it.
 *
 * @param {{token: string|null, enabled: boolean,
 *   filters: {system: string, search: string, page: number}, open: string|null}} options
 * @returns {{data: object|null, retained: object|null, error: string|null,
 *   loading: boolean, message: object|null, messageError: string|null,
 *   messageLoading: boolean, sending: string|null, sent: object|null,
 *   refresh: () => Promise<void>, send: (id: string) => Promise<object|null>}}
 */
export function useMailFeed({ token, enabled, filters, open }) {
  const [held, setHeld] = useState(NOTHING_HELD)
  const [failed, setFailed] = useState(NOTHING_HELD)
  const [message, setMessage] = useState(NOTHING_HELD)
  const [messageFailed, setMessageFailed] = useState(NOTHING_HELD)
  const [sending, setSending] = useState(null)
  const [sent, setSent] = useState(null)
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
      const response = await fetch(`${MAIL_PATH}?${query}&t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!alive.current) return
      if (!response.ok) {
        setFailed({
          key: query,
          value: payload.error || `The mail endpoint answered ${response.status}.`,
        })
        return
      }
      setHeld({ key: query, value: payload })
      setFailed(NOTHING_HELD)
    } catch {
      if (alive.current) setFailed({ key: query, value: 'The mail endpoint did not answer.' })
    }
  }, [token, enabled, query])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!token || !enabled || !open) {
      setMessage(NOTHING_HELD)
      setMessageFailed(NOTHING_HELD)
      return
    }
    let current = true
    const view = open.startsWith('family:') ? 'family' : 'message'
    const id = view === 'family' ? open.slice('family:'.length) : open
    const url = `${MAIL_PATH}?view=${view}&id=${encodeURIComponent(id)}&t=${Date.now()}`
    fetch(url, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}))
        if (!current || !alive.current) return
        if (!response.ok) {
          setMessageFailed({
            key: open,
            value: payload.error || `The mail endpoint answered ${response.status}.`,
          })
          setMessage(NOTHING_HELD)
          return
        }
        setMessage({ key: open, value: payload })
        setMessageFailed(NOTHING_HELD)
      })
      .catch(() => {
        if (current && alive.current) {
          setMessageFailed({ key: open, value: 'That message could not be read.' })
        }
      })
    return () => {
      current = false
    }
  }, [token, enabled, open])

  const send = useCallback(
    async id => {
      if (!token || !id) return null
      setSending(id)
      setSent(null)
      try {
        const response = await fetch(MAIL_PATH, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send', id }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!alive.current) return null
        if (!response.ok) {
          setSent({ ok: false, said: payload.error || 'That copy did not go out.' })
          return null
        }
        setSent({ ok: true, said: `Sent to ${payload.sent_to}.` })
        return payload
      } catch {
        if (alive.current) setSent({ ok: false, said: 'That copy did not reach the server.' })
        return null
      } finally {
        if (alive.current) setSending(null)
      }
    },
    [token]
  )

  const data = answerFor(held, query)
  const error = answerFor(failed, query)

  return {
    data,
    // The last answer that landed, whichever question it answered. The pager
    // and the filter chips describe the question rather than answering it, and
    // deriving them from `data` unmounts them the moment one is pressed.
    retained: held.value,
    error,
    loading: !data && !error,
    message: answerFor(message, open),
    messageError: answerFor(messageFailed, open),
    messageLoading: Boolean(open) && !answerFor(message, open) && !answerFor(messageFailed, open),
    sending,
    sent,
    refresh: load,
    send,
  }
}
