import { supabase } from '@data/supabaseClient'
import { getDeviceFingerprint, parseDeviceInfo } from '@utils/deviceFingerprint'

const FIELDS =
  'id, device_fingerprint, label, browser, os, device_type, user_agent, user_name, first_seen_at, last_seen_at, updated_at'

export async function listDevices() {
  const { data, error } = await supabase
    .from('sunday_devices')
    .select(FIELDS)
    .order('last_seen_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Upsert the current browser as a known device and refresh its heartbeat.
 * Identified by (user_id, device_fingerprint). The DB trigger refreshes
 * updated_at; we explicitly bump last_seen_at so the Devices page sees
 * "online" right after a heartbeat fires.
 */
export async function registerDeviceHeartbeat(userId, userName) {
  if (!userId) return
  const fingerprint = getDeviceFingerprint()
  const info = parseDeviceInfo()
  const { error } = await supabase.from('sunday_devices').upsert(
    {
      user_id: userId,
      device_fingerprint: fingerprint,
      label: info.label,
      browser: info.browser,
      os: info.os,
      device_type: info.deviceType,
      user_agent: info.userAgent,
      user_name: userName ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,device_fingerprint' }
  )
  if (error) throw error
}

export async function forgetDevice(id) {
  const { error } = await supabase.from('sunday_devices').delete().eq('id', id)
  if (error) throw error
}
