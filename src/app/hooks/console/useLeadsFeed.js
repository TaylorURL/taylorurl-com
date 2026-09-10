import { useCallback, useEffect, useRef, useState } from 'react'
import { faultFromResponse, faultMessage } from '@utils/faults'

const LEADS_PATH = '/api/leads-admin'

/** What a reader is told when the one read behind the section does not land. */
const NO_READ = 'The leads could not be read. Try again in a moment.'

/** What a reader is told when a mark does not save. */
const NO_MARK = 'That did not save. Try again in a moment.'

/**
 * Everybody who has raised a hand, whichever door they came through, as the
 * record holds them right now.
 *
 * One read covers the whole section. The list and the figures over it are two
 * readings of one table, and asking for them apart would mean a strip at the
 * top that could disagree with the rows underneath for as long as the second
 * request took.
 *
 * The one write is the mark: who is carrying a lead, when it is next owed
 * something, whether somebody has answered it or ruled it out. Nothing here
 * reaches the lead themselves - there is no verb behind this that sends a
 * message to anybody, because a hundred addresses beside a button is a mistake
 * waiting for a slow afternoon.
 *
 * A saved mark is written into the rows in hand rather than answered with
 * another read of the whole section. The endpoint returns the row it changed,
 * so the alternative is re-reading five hundred leads to learn one date - and
 * doing it while the reader is looking at the row that moved.
 *
 * `refresh` is offered because the record moves while nobody is looking - a
 * lead lands whenever somebody fills a form, answers an ad or takes a call -
 * and a reader watching for one wants to see it arrive rather than reload the
 * console.
 *
 * @param {{token: string|null, enabled: boolean}} options
 * @returns {{data: object|null, error: string|null, loading: boolean,
 *   reading: boolean, saving: string|null, refresh: () => Promise<void>,
 *   mark: (id: string, change: object) => Promise<boolean>}}
 */
export function useLeadsFeed({ token, enabled }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [reading, setReading] = useState(false)
  // Which lead is saving, rather than whether one is. Two rows marked in quick
  // succession would otherwise both show as busy, and the reader would not know
  // which of them the console was still working on.
  const [saving, setSaving] = useState(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const load = useCallback(async () => {
    if (!token || !enabled) return
    setReading(true)
    try {
      const response = await fetch(`${LEADS_PATH}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => ({}))
      if (!alive.current) return
      if (!response.ok) {
        setError(faultFromResponse(response, payload, NO_READ))
        return
      }
      setData(payload)
      setError(null)
    } catch (cause) {
      if (alive.current) setError(faultMessage(cause, NO_READ))
    } finally {
      if (alive.current) setReading(false)
    }
  }, [token, enabled])

  useEffect(() => {
    load()
  }, [load])

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
        // The row that came back, in place of the one that was there. The
        // figures over the table are left as they were: they are counted at
        // the server and a mark can move two of them at once, so guessing at
        // them here would put a strip on the page that disagrees with the rows
        // under it until the next read.
        setData(held =>
          held
            ? { ...held, leads: held.leads.map(lead => (lead.id === id ? payload.lead : lead)) }
            : held
        )
        setError(null)
        return true
      } catch (cause) {
        if (alive.current) setError(faultMessage(cause, NO_MARK))
        return false
      } finally {
        if (alive.current) setSaving(null)
      }
    },
    [token]
  )

  // The first read is the only one that leaves the page with nothing to draw.
  // A refresh after that redraws rows the reader is already looking at, and
  // blanking them to placeholders would be the page forgetting what it knows.
  return { data, error, loading: !data && !error, reading, saving, refresh: load, mark }
}
