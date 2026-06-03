import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@data/supabaseClient'
import { forgetDevice as apiForgetDevice, listDevices } from '@data/sunday/devicesClient'
import { getDeviceFingerprint } from '@utils/deviceFingerprint'

const ONLINE_THRESHOLD_MS = 90_000

export function useDevices() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(Date.now())

  const refresh = useCallback(async () => {
    try {
      const rows = await listDevices()
      setDevices(rows)
      setError(null)
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    refresh().catch(() => {})

    const channel = supabase
      .channel('sunday-devices')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sunday_devices' }, () => {
        if (!cancelled) refresh().catch(() => {})
      })
      .subscribe()

    // Tick `now` every 15s so online/offline transitions reflect on screen
    // without waiting for the next realtime event.
    const tickId = setInterval(() => {
      if (!cancelled) setNow(Date.now())
    }, 15_000)

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      clearInterval(tickId)
    }
  }, [refresh])

  const forget = useCallback(
    async id => {
      setDevices(prev => prev.filter(d => d.id !== id))
      try {
        await apiForgetDevice(id)
      } catch (err) {
        setError(err?.message ?? String(err))
        await refresh()
      }
    },
    [refresh]
  )

  const currentFingerprint = useMemo(() => getDeviceFingerprint(), [])

  const augmented = useMemo(
    () =>
      devices.map(d => ({
        ...d,
        online: now - new Date(d.last_seen_at).getTime() < ONLINE_THRESHOLD_MS,
        isThisDevice: d.device_fingerprint === currentFingerprint,
      })),
    [devices, now, currentFingerprint]
  )

  const onlineCount = augmented.filter(d => d.online).length

  return { devices: augmented, onlineCount, loading, error, forget, refresh }
}
