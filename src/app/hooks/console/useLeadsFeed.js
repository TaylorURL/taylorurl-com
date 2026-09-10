import { useCallback, useEffect, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { answerFor, NOTHING_HELD } from './feedState'
import { usePulse } from './usePulse'

const LEADS_PATH = '/api/leads-admin'

/** How often the record is read again. A lead lands whenever somebody fills a
 * form, answers an ad or takes a call, and this section is the one place that
 * shows it - so it keeps the shortest beat in the console after the live one. */
const PULSE_MS = 15_000

/** What a reader is told when the one read behind the section does not land. */
const NO_READ = 'The leads could not be read. Try again in a moment.'

/** What a reader is told when a mark does not save. */
const NO_MARK = 'That did not save. Try again in a moment.'

/** And when a message or a draft does not go through. */
const NO_SEND = 'That did not go. Try again in a moment.'

/**
 * Everybody who has raised a hand, whichever door they came through, as the
 * record holds them right now - kept current on its own beat rather than
 * behind a button.
 *
 * One read covers the whole section: the list, the figures over it, the
 * drafts the composer offers and the team a lead can be handed to. Asking for
 * them apart would mean a strip at the top that could disagree with the rows
 * underneath for as long as the second request took.
 *
 * The writes are the mark, the send and the drafts. A saved mark is written
 * into the rows in hand rather than answered with another read of the whole
 * section; a send comes back with the row it stamped and the message it
 * recorded, and the messages under the open lead take it straight in. The
 * figures over the table are left to the next beat: they are counted at the
 * server and a mark can move two of them at once, so guessing at them here
 * would put a strip on the page that disagrees with the rows under it.
 *
 * The beat stands off while any write is in flight, because a read landing
 * under a save can put the row's old shape back for the length of a beat.
 *
 * @param {{token: string|null, enabled: boolean, openId: string|null}} options
 */
export function useLeadsFeed({ token, enabled, openId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  // Which lead is saving, rather than whether one is. Two rows marked in quick
  // succession would otherwise both show as busy, and the reader would not know
  // which of them the console was still working on.
  const [saving, setSaving] = useState(null)
  const [sending, setSending] = useState(false)
  const [templateBusy, setTemplateBusy] = useState(false)
  // What has been written to the open lead, filed under the lead it answers
  // for, so the last lead's letters are never read as this one's.
  const [held, setHeld] = useState(NOTHING_HELD)
  const [heldFault, setHeldFault] = useState(NOTHING_HELD)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!token || !enabled) return false
    try {
      const response = await fetch(`${LEADS_PATH}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!alive.current) return false
      if (!response.ok) {
        setError(faultFromResponse(response, payload, NO_READ))
        return false
      }
      setData(payload)
      setError(null)
      return true
    } catch (cause) {
      if (alive.current) setError(faultMessage(cause, NO_READ))
      return false
    }
  }, [token, enabled])

  useEffect(() => {
    load()
  }, [load])

  usePulse(load, {
    enabled: Boolean(token) && enabled,
    intervalMs: PULSE_MS,
    holdWhile: Boolean(saving) || sending || templateBusy,
  })

  // The letters under the lead being read. They are asked for when the lead
  // is opened rather than carried on every row of the list, because the list
  // is five hundred rows and the reading is one.
  useEffect(() => {
    if (!token || !enabled || !openId) return undefined
    let stale = false
    const ask = async () => {
      try {
        const response = await fetch(`${LEADS_PATH}?lead=${encodeURIComponent(openId)}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        })
        const payload = await response.json().catch(() => ({}))
        if (stale || !alive.current) return
        if (!response.ok) {
          setHeldFault({ key: openId, value: faultFromResponse(response, payload, NO_READ) })
          return
        }
        setHeld({ key: openId, value: payload.messages || [] })
        setHeldFault(NOTHING_HELD)
      } catch (cause) {
        if (!stale && alive.current)
          setHeldFault({ key: openId, value: faultMessage(cause, NO_READ) })
      }
    }
    ask()
    return () => {
      stale = true
    }
  }, [token, enabled, openId])

  /** One lead's row, put back where it stands in the list. */
  const place = useCallback(lead => {
    if (!lead) return
    setData(current =>
      current
        ? { ...current, leads: current.leads.map(row => (row.id === lead.id ? lead : row)) }
        : current
    )
  }, [])

  const mark = useCallback(
    async (id, change) => {
      if (!token || !id) return false
      setSaving(id)
      try {
        const response = await fetch(LEADS_PATH, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...change }),
        })
        const payload = await response.json().catch(() => ({}))
        if (!alive.current) return false
        if (!response.ok || !payload?.lead) {
          setError(faultFromResponse(response, payload, NO_MARK))
          return false
        }
        place(payload.lead)
        setError(null)
        return true
      } catch (cause) {
        if (alive.current) setError(faultMessage(cause, NO_MARK))
        return false
      } finally {
        if (alive.current) setSaving(null)
      }
    },
    [token, place]
  )

  /** One POST, shared by the send and the two draft verbs. */
  const act = useCallback(
    async body => {
      const response = await fetch(LEADS_PATH, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        return { ok: false, error: faultFromResponse(response, payload, NO_SEND) }
      }
      return { ok: true, ...payload }
    },
    [token]
  )

  /**
   * Sends one composed message to one lead.
   *
   * The refusal comes back as a sentence rather than landing in the section's
   * own error line, because the person it is for is looking at the composer.
   */
  const send = useCallback(
    async ({ id, subject, body, templateId }) => {
      if (!token || !id) return { ok: false, error: NO_SEND }
      setSending(true)
      try {
        const answer = await act({
          action: 'send',
          id,
          subject,
          body,
          template_id: templateId || null,
        })
        if (!alive.current) return answer
        if (answer.ok) {
          place(answer.lead)
          if (answer.message) {
            setHeld(current =>
              current.key === id
                ? { key: id, value: [answer.message, ...(current.value || [])] }
                : current
            )
          }
        }
        return answer
      } catch (cause) {
        return { ok: false, error: faultMessage(cause, NO_SEND) }
      } finally {
        if (alive.current) setSending(false)
      }
    },
    [token, act, place]
  )

  /** Keeps one draft, and writes the answer into the list the composer reads. */
  const saveTemplate = useCallback(
    async template => {
      if (!token) return { ok: false, error: NO_SEND }
      setTemplateBusy(true)
      try {
        const answer = await act({ action: 'template-save', template })
        if (!alive.current) return answer
        if (answer.ok && answer.template) {
          setData(current => {
            if (!current) return current
            const drafts = current.templates || []
            const known = drafts.some(row => row.id === answer.template.id)
            return {
              ...current,
              templates: known
                ? drafts.map(row => (row.id === answer.template.id ? answer.template : row))
                : [...drafts, answer.template],
            }
          })
        }
        return answer
      } catch (cause) {
        return { ok: false, error: faultMessage(cause, NO_SEND) }
      } finally {
        if (alive.current) setTemplateBusy(false)
      }
    },
    [token, act]
  )

  /** Takes one draft out of the set the composer offers. */
  const removeTemplate = useCallback(
    async id => {
      if (!token || !id) return { ok: false, error: NO_SEND }
      setTemplateBusy(true)
      try {
        const answer = await act({ action: 'template-delete', id })
        if (!alive.current) return answer
        if (answer.ok) {
          setData(current =>
            current
              ? { ...current, templates: (current.templates || []).filter(row => row.id !== id) }
              : current
          )
        }
        return answer
      } catch (cause) {
        return { ok: false, error: faultMessage(cause, NO_SEND) }
      } finally {
        if (alive.current) setTemplateBusy(false)
      }
    },
    [token, act]
  )

  // The first read is the only one that leaves the page with nothing to draw.
  // Every read after it lands into rows the reader is already looking at, and
  // blanking them to placeholders would be the page forgetting what it knows.
  return {
    data,
    error,
    loading: !data && !error,
    saving,
    sending,
    templateBusy,
    mark,
    send,
    saveTemplate,
    removeTemplate,
    messages: answerFor(held, openId || null),
    messagesError: answerFor(heldFault, openId || null),
  }
}
