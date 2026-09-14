import { useEffect, useState } from 'react'
import { clockIn } from '@lib/time/zone.js'

/** The days somebody is at the desk, as the zone's own short weekday names. */
const WEEKDAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])

/** When the desk opens and closes, in minutes past midnight Central. */
const OPENS = 8 * 60
const CLOSES = 17 * 60

/** How often the clock is read again, so the hour turns over on its own. */
const TICK_MS = 60 * 1000

/** Whether an instant falls inside the hours. */
function openAt(value) {
  const clock = clockIn(value)
  if (!clock) return false
  return WEEKDAYS.has(clock.weekday) && clock.minutes >= OPENS && clock.minutes < CLOSES
}

/**
 * Whether somebody is at the desk right now, read off the Central clock rather
 * than the reader's own.
 *
 * It answers false on the server and on the first client render, and only then
 * reads the clock. The markup is prerendered once and served to every reader
 * for as long as the deploy stands, so a hook that answered the build's clock
 * would put a number on the page at three in the morning and hydration would
 * take it away again in front of the reader. Answering the same thing on both
 * sides means the bar renders once and changes once, after mount, on the
 * reader's own instant.
 *
 * @returns {boolean}
 */
export function useBusinessHours() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const read = () => setOpen(openAt(new Date()))
    read()
    const tick = setInterval(read, TICK_MS)
    return () => clearInterval(tick)
  }, [])

  return open
}
