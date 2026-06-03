import { useAuth } from '@hooks/useAuth'

const SUNDAY_ADMIN_USER_ID = import.meta.env.VITE_SUNDAY_ADMIN_USER_ID ?? ''

/**
 * Authorization gate for every /sunday/* surface.
 *
 * Returns one of:
 *  - { state: 'loading' }                    — session still resolving
 *  - { state: 'unauthenticated' }            — no session, redirect to /sunday/auth
 *  - { state: 'forbidden', user }            — signed in but not the admin UUID
 *  - { state: 'authorized', user, session }  — proceed
 *
 * Admin check is a pure UUID match against the VITE_SUNDAY_ADMIN_USER_ID env var.
 * The same UUID must also be set as SUNDAY_ADMIN_USER_ID in edge function secrets;
 * edge functions enforce server-side, this hook only governs client routing.
 */
export function useSundayGuard() {
  const { user, session, loading } = useAuth()

  if (loading) return { state: 'loading' }
  if (!user || !session) return { state: 'unauthenticated' }
  if (!SUNDAY_ADMIN_USER_ID || user.id !== SUNDAY_ADMIN_USER_ID) {
    return { state: 'forbidden', user }
  }
  return { state: 'authorized', user, session }
}
