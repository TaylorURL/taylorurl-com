import { useCallback, useEffect, useRef, useState } from 'react'

const STATUS_FEED_PATH = '/api/status-feed'
const POLL_MS = 30_000
// A failed read is usually a restart or a blip a couple of seconds wide.
// Waiting a full poll to discover that leaves the page reporting a problem it
// no longer has, so a failure retries soon and backs off if the feed is
// genuinely gone.
const RETRY_MS = [3_000, 5_000, 10_000]

/**
 * Live status feed for the status page. Polls the server-side proxy while the
 * tab is visible and keeps the last good payload through a failed fetch, so a
 * blip in the feed never blanks a page that was already showing data. Runs
 * only in the browser: the prerender renders the loading shell.
 */
export function useStatusFeed() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const timer = useRef(null)
  const failures = useRef(0)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${STATUS_FEED_PATH}?t=${Date.now()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`feed answered ${response.status}`)
      const payload = await response.json()
      if (!Array.isArray(payload.sites)) throw new Error('feed shape')
      failures.current = 0
      setData(payload)
      setError(null)
      setFetchedAt(new Date())
      return true
    } catch (cause) {
      failures.current += 1
      setError(cause)
      return false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let first = true
    const tick = async () => {
      if (cancelled) return
      // The first load always runs, even in a background tab, so the page never
      // sits on its loading shell; only the repeat polling waits for visibility.
      let ok = true
      if (first || document.visibilityState === 'visible') ok = await load()
      first = false
      if (cancelled) return
      const wait = ok ? POLL_MS : RETRY_MS[Math.min(failures.current - 1, RETRY_MS.length - 1)]
      timer.current = window.setTimeout(tick, wait)
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
