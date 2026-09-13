import { useEffect, useRef } from 'react'

// A failed read is usually a redeploy or a blip a couple of seconds wide.
// Waiting a full interval to find that out leaves the console showing an error
// it no longer has, so a failure retries soon and backs off if it persists.
const RETRY_MS = [3_000, 6_000, 15_000]

/**
 * Re-runs one feed's read on a beat, so the section moves as the record does.
 *
 * The analytics feeds have polled this way since they were written, and every
 * other section sat still until somebody pressed a button over it - which is
 * how a lead landed, a card was charged or a build moved and the console said
 * nothing until a reload. The button is gone; the beat is what replaced it,
 * and it is one piece of code rather than a copy in every feed.
 *
 * The first read is the feed's own. This begins after it, so a section is
 * never blanked or raced by its own heartbeat - each tick lands into state
 * the same way a pressed re-read did.
 *
 * Polling pauses while the tab is hidden and catches up the moment it comes
 * back: a background tab spending requests on figures nobody is reading is
 * the one case where "realtime" costs something and returns nothing. It also
 * stands off while the section is writing, because a read landing under a
 * save can put the row's old shape back for the length of a beat.
 *
 * @param {() => Promise<unknown>} tick The feed's own read. Resolving false
 *   counts as a failure and brings the retry cadence; anything else is a beat.
 * @param {{enabled: boolean, intervalMs: number, holdWhile?: boolean}} options
 *   `holdWhile` skips beats - and the catch-up on returning to the tab -
 *   while a write is in flight.
 */
export function usePulse(tick, { enabled, intervalMs, holdWhile = false }) {
  const beat = useRef(tick)
  beat.current = tick
  const held = useRef(holdWhile)
  held.current = holdWhile
  const failures = useRef(0)

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined
    let cancelled = false
    let timer = null

    const run = async () => {
      if (cancelled) return
      let ok = true
      if (document.visibilityState === 'visible' && !held.current) {
        ok = (await beat.current()) !== false
        failures.current = ok ? 0 : failures.current + 1
      }
      if (cancelled) return
      const wait = ok ? intervalMs : RETRY_MS[Math.min(failures.current - 1, RETRY_MS.length - 1)]
      timer = window.setTimeout(run, wait)
    }
    timer = window.setTimeout(run, intervalMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !held.current) beat.current()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, intervalMs])
}

/**
 * Makes a feed's first read and then polls it, for a feed that has no read of
 * its own to begin after.
 *
 * The first read always runs, even in a background tab, so the page never sits
 * on its loading shell; only the repeat polling waits for the tab to be
 * visible. Unlike the beat above, it starts over whenever the read changes, so
 * a feed asked a different question - another window, another site - is read
 * again at once rather than a beat later.
 *
 * The count of failures belongs to the read rather than to this, because the
 * read is also what a returning tab and a pressed refresh call, and a failure
 * either of those meets is one the next poll should back off from.
 *
 * @param {() => Promise<boolean>} load The feed's read, resolving whether it landed.
 * @param {{enabled?: boolean, intervalMs: number, retryMs?: number[],
 *   failures: {current: number}}} options
 */
export function usePoll(load, { enabled = true, intervalMs, retryMs = RETRY_MS, failures }) {
  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    let first = true
    let timer = null

    const tick = async () => {
      if (cancelled) return
      let ok = true
      if (first || document.visibilityState === 'visible') ok = await load()
      first = false
      if (cancelled) return
      const wait = ok ? intervalMs : retryMs[Math.min(failures.current - 1, retryMs.length - 1)]
      timer = window.setTimeout(tick, wait)
    }
    tick()

    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, intervalMs, retryMs, failures, load])
}
