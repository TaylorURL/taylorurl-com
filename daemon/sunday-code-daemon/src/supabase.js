import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

let cachedClient = null

export function getSupabase() {
  if (cachedClient) return cachedClient
  cachedClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  })
  return cachedClient
}
