import { useEffect, useRef, useState } from 'react'
import { TICK_MS } from '@app/tools/lib/progress'

/**
 * How long a reading has been running, counted while `running` holds.
 *
 * The elapsed count is what tells a reader the page has not died on them, so it
 * runs off a clock rather than off the stages: it keeps moving whatever Google
 * is doing, and it goes on being true once the stages have nothing new to say.
 *
 * @param {boolean} running - Whether the reading is under way.
 * @returns {{ elapsed: number, restart: () => void }} `restart` sets the count
 *   back to nothing as a reading begins.
 */
export function useElapsed(running) {
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef(0)

  useEffect(() => {
    if (!running) return undefined
    const tick = setInterval(() => setElapsed(Date.now() - startedAt.current), TICK_MS)
    return () => clearInterval(tick)
  }, [running])

  const restart = () => {
    startedAt.current = Date.now()
    setElapsed(0)
  }

  return { elapsed, restart }
}
