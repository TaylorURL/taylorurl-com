import { useCallback, useEffect, useRef, useState } from 'react'

export const STATUS_FEED_URL = 'https://sunday.tail1f78d7.ts.net/status.json'
const POLL_MS = 30_000

/**
 * Live status feed for the status page. Polls the monitor's public feed while
 * the tab is visible and keeps the last good payload through a failed fetch,
 * so a blip in the feed never blanks a page that was already showing data.
 * Runs only in the browser: the prerender renders the loading shell.
 */
export function useStatusFeed() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const timer = useRef(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${STATUS_FEED_URL}?t=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`feed answered ${response.status}`)
      const payload = await response.json()
      if (!Array.isArray(payload.sites)) throw new Error('feed shape')
      setData(payload)
      setError(null)
      setFetchedAt(new Date())
    } catch (cause) {
      setError(cause)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let first = true
    const tick = () => {
      if (cancelled) return
      // The first load always runs, even in a background tab, so the page never
      // sits on its loading shell; only the repeat polling waits for visibility.
      if (first || document.visibilityState === 'visible') load()
      first = false
      timer.current = window.setTimeout(tick, POLL_MS)
    }
    tick()
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  return { data, error, fetchedAt, loading: !data && !error, refresh: load }
}
