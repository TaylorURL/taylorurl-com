import { createClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig.js'

/**
 * The browser's Supabase client, used for one thing: signing in to the traffic
 * console and holding that session.
 *
 * The publishable key is the same one the email signup already carries and is
 * public by design — it identifies the project and grants nothing on its own.
 * What a request is allowed to do comes from the session it presents, and the
 * console's endpoint checks that server-side on every read.
 *
 * The session is persisted and auto-refreshed so a signed-in visit survives a
 * reload and a long-open tab keeps working past the access token's hour.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // The console is the only page that signs anyone in, and it is reached by
    // typing its URL rather than by following a link back from a provider.
    detectSessionInUrl: false,
  },
})
