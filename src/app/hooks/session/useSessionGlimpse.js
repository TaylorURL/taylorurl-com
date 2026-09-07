import { useCallback, useEffect, useState } from 'react'

// Where supabase-js keeps the session. Reading it directly is what lets the
// navigation know whether to say Log In without importing the client, which
// costs about 58kB gzipped on a marketing site where almost nobody signs in.
const STORAGE_KEY = 'sb-gujgtjqqurildqurpffh-auth-token'
// Fired by useSession when the session changes, so chrome that never loads the
// client still hears about it in the tab where it happened.
export const AUTH_EVENT = 'taylorurl:auth'

function read() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw)
    // A token past its expiry is not a session. The refresh that would renew it
    // only happens where the real client is loaded, so treating an expired one
    // as signed-in would leave the bar wrong until the visitor opened a page
    // that runs it.
    if (stored?.expires_at && stored.expires_at * 1000 < Date.now()) return null
    return stored?.access_token ? stored : null
  } catch {
    return null
  }
}

/**
 * Whether somebody is signed in, and what to call them — for chrome that has to
 * render on every page.
 *
 * This is for display only and is trusted for nothing else. It reports what the
 * browser has stored, which anyone could edit; every request is still verified
 * by the collector against the project, and a forged entry here buys a wrong
 * word in the navigation and nothing more.
 *
 * @returns {{signedIn: boolean, firstName: string|null, checking: boolean,
 *   signOut: () => Promise<void>}}
 */
export function useSessionGlimpse() {
  const [stored, setStored] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    setStored(read())
    setChecking(false)

    // Two ways this changes. A storage event covers another tab signing in or
    // out; it deliberately does not fire in the tab that caused it, which is
    // the tab the sign-in form is on, so the real client announces itself with
    // AUTH_EVENT and this listens for both.
    const reread = () => setStored(read())
    window.addEventListener('storage', reread)
    window.addEventListener(AUTH_EVENT, reread)
    return () => {
      window.removeEventListener('storage', reread)
      window.removeEventListener(AUTH_EVENT, reread)
    }
  }, [])

  const signOut = useCallback(async () => {
    // The only place the chrome needs the real client, loaded at the moment it
    // is needed rather than on every page in case it might be.
    const { supabase } = await import('@data/supabase/supabaseClient')
    await supabase.auth.signOut()
    setStored(null)
  }, [])

  const fullName = stored?.user?.user_metadata?.full_name || ''
  return {
    signedIn: Boolean(stored),
    // Only the first word: a nav bar has room for a name, not a full one.
    firstName: fullName.trim().split(/\s+/)[0] || null,
    checking,
    signOut,
  }
}
