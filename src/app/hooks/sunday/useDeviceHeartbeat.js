import { useEffect } from 'react'
import { useAuth } from '@hooks/useAuth'
import { registerDeviceHeartbeat } from '@data/sunday/devicesClient'
import { getDisplayName } from '@utils/displayName'

const HEARTBEAT_MS = 30_000

/**
 * Registers the current browser as a Sunday device and refreshes
 * last_seen_at every 30 seconds while at least one Sunday tab is open.
 * Re-ticks immediately whenever the tab regains visibility so a backgrounded
 * laptop tab doesn't show stale "offline" status the moment you switch back.
 */
export function useDeviceHeartbeat() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const displayName = getDisplayName(user)

    async function tick() {
      if (cancelled || document.visibilityState === 'hidden') return
      try {
        await registerDeviceHeartbeat(user.id, displayName)
      } catch (err) {
        console.error('[devices] heartbeat failed', err)
      }
    }

    tick()
    const intervalId = setInterval(tick, HEARTBEAT_MS)

    function onVisibility() {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user?.id])
}
