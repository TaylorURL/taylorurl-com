import { useCallback, useEffect, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'
import { readEndpoint, writeEndpoint } from './endpoint'
import { answerFor, NOTHING_HELD } from './feedState'
import { useAlive } from './useAlive'
import { usePulse } from './usePulse'

const LEADS_PATH = '/api/leads-admin'

/** How often the Inbox is read again, so a reply that lands walks in on its own. */
const PULSE_MS = 15_000

const NO_READ = 'The Inbox could not be read. Try again in a moment.'
const NO_MARK = 'That did not save. Try again in a moment.'
const NO_SEND = 'That did not go. Try again in a moment.'

/**
 * The Inbox as the record holds it right now: everybody who wrote, the saved
 * replies, and the conversation of the one that is open.
 *
 * A mark comes back with the row it changed and a send with the row and the
 * message it recorded, and both are written into what is in hand rather than
 * answered with another read. The beat stands off while either is in flight,
 * because a read landing under a save can put the row's old shape back.
 *
 * @param {{token: string|null, enabled: boolean, openId: string|null}} options
 */
export function useInboxFeed({ token, enabled, openId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)
  const [sending, setSending] = useState(false)
  // The open lead's conversation, filed under the lead it belongs to, so the
  // last lead's letters are never read as this one's.
  const [held, setHeld] = useState(NOTHING_HELD)
  const [heldFault, setHeldFault] = useState(NOTHING_HELD)
  const alive = useAlive()

  const load = useCallback(async () => {
    if (!token || !enabled) return false
    try {
      const { response, payload } = await readEndpoint(token, `${LEADS_PATH}?t=${Date.now()}`)
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
  }, [token, enabled, alive])

  useEffect(() => {
    load()
  }, [load])

  usePulse(load, {
    enabled: Boolean(token) && enabled,
    intervalMs: PULSE_MS,
    holdWhile: Boolean(saving) || sending,
  })

  // The open lead's conversation, asked for when it is opened rather than
  // carried on every row of the list.
  useEffect(() => {
    if (!token || !enabled || !openId) return undefined
    let stale = false
    const ask = async () => {
      try {
        const { response, payload } = await readEndpoint(
          token,
          `${LEADS_PATH}?lead=${encodeURIComponent(openId)}`
        )
        if (stale || !alive.current) return
        if (!response.ok) {
          setHeldFault({ key: openId, value: faultFromResponse(response, payload, NO_READ) })
          return
        }
        setHeld({ key: openId, value: payload.conversation || [] })
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
  }, [token, enabled, openId, alive])

  /** One lead's row, put back where it stands, keeping what the list read beside it. */
  const place = useCallback(lead => {
    if (!lead) return
    setData(current =>
      current
        ? {
            ...current,
            leads: current.leads.map(row => (row.id === lead.id ? { ...row, ...lead } : row)),
          }
        : current
    )
  }, [])

  /** Marks one lead answered or ruled out, or takes the mark back. */
  const mark = useCallback(
    async (id, change) => {
      if (!token || !id) return false
      setSaving(id)
      try {
        const { response, payload } = await writeEndpoint(
          token,
          LEADS_PATH,
          { id, ...change },
          { method: 'PATCH' }
        )
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
    [token, place, alive]
  )

  /**
   * Sends one written reply to one lead. A refusal comes back as a sentence
   * for the reply box rather than the Inbox's own error line, because the
   * person it is for is looking at the reply box.
   */
  const send = useCallback(
    async ({ id, subject, body, templateId }) => {
      if (!token || !id) return { ok: false, error: NO_SEND }
      setSending(true)
      try {
        const { response, payload } = await writeEndpoint(token, LEADS_PATH, {
          action: 'send',
          id,
          subject,
          body,
          template_id: templateId || null,
        })
        if (!response.ok) {
          return { ok: false, error: faultFromResponse(response, payload, NO_SEND) }
        }
        if (alive.current) {
          place(payload.lead)
          if (payload.message) {
            setHeld(current =>
              current.key === id
                ? { key: id, value: [...(current.value || []), payload.message] }
                : current
            )
          }
        }
        return { ok: true }
      } catch (cause) {
        return { ok: false, error: faultMessage(cause, NO_SEND) }
      } finally {
        if (alive.current) setSending(false)
      }
    },
    [token, place, alive]
  )

  return {
    data,
    error,
    loading: !data && !error,
    saving,
    sending,
    mark,
    send,
    conversation: answerFor(held, openId || null),
    conversationError: answerFor(heldFault, openId || null),
  }
}
