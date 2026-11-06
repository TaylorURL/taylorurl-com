import { useEffect, useRef } from 'react'
import { supabase } from '@data/supabase/supabaseClient'
import { listenForLive } from './liveSignal'

/**
 * Reads the live view again the moment the collector says somebody arrived,
 * moved or left, rather than on the next tick of the poll.
 *
 * The poll stays underneath it. It is what notices somebody who left without
 * saying so - a phone put away, a laptop closed - since nothing is sent when a
 * visitor simply stops beating, and it is what carries the console through a
 * socket that dropped.
 *
 * The channels are joined by the joined list of ids rather than the array, so
 * a list rebuilt on every render does not leave and rejoin them each time.
 *
 * @param {{siteIds: string[], enabled: boolean, onSignal: () => void}} options
 */
export function useLiveSignal({ siteIds, enabled, onSignal }) {
  const latest = useRef(onSignal)
  latest.current = onSignal
  const key = enabled ? [...new Set(siteIds.filter(Boolean))].sort().join(',') : ''

  useEffect(() => {
    if (!key) return undefined
    return listenForLive(supabase, key.split(','), () => latest.current())
  }, [key])
}
