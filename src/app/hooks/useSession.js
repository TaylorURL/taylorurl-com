import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@data/supabaseClient'
import { NO_ANSWER, sessionGate } from '@hooks/sessionGate'
import { AUTH_EVENT } from '@hooks/useSessionGlimpse'
import {
  assurance,
  forgetRecovery,
  redeemRecoveryCode,
  rememberRecovery,
  verifyCode,
} from '@hooks/useMfa'

/** Context carrying the session state provided by <SessionProvider>. */
export const SessionContext = createContext(null)

/**
 * The signed-in account, worked out once for the whole page.
 *
 * Nothing here decides what anyone may read. The collector verifies the token
 * and resolves the role on every request; this decides what the page shows —
 * which nav links, which screen, whose name.
 *
 * `checking` is true until the account is fully known, which means both halves
 * of it: the stored session read back, and the question of whether that session
 * still owes a second factor answered. Both are needed before anything may be
 * decided, because a guard cannot tell an account that owes no factor from one
 * whose answer has not arrived yet - and reading the second as the first is
 * what lets a sign-in past the code prompt.
 *
 * `mfaPending` is the second half of a sign-in for an account carrying a
 * verified factor: a password gets the account to aal1, and the code from the
 * authenticator is what carries it to aal2. It means nothing while `checking`
 * is true.
 */
export function useSessionState() {
  const [session, setSession] = useState(null)
  const [reading, setReading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [mfa, setMfa] = useState(NO_ANSWER)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session ?? null)
      setReading(false)
    })

    // Covers the refresh that happens on its own an hour in, and a sign-in or
    // sign-out in another tab, both of which have to reach this page without a
    // reload.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (cancelled) return
      setSession(next)
      // The navigation reads the stored session without loading this client, and
      // a storage event does not fire in the tab that wrote it.
      window.dispatchEvent(new Event(AUTH_EVENT))
    })

    return () => {
      cancelled = true
      listener?.subscription?.unsubscribe()
    }
  }, [])

  const token = session?.access_token ?? null
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!token) {
      setMfa({ pending: false, factorId: null, forUser: null })
      return undefined
    }
    let cancelled = false
    assurance(userId).then(next => {
      if (cancelled) return
      setMfa({ ...next, forUser: userId })
    })
    return () => {
      cancelled = true
    }
  }, [token, userId])

  const gate = sessionGate({ reading, userId, mfa })

  const signIn = useCallback(async (email, password) => {
    setBusy(true)
    setError(null)
    const { error: cause } = await supabase.auth.signInWithPassword({ email, password })
    // Supabase answers a wrong address and a wrong password identically, which
    // is the point; the message is passed through as it comes.
    if (cause) setError(cause.message)
    setBusy(false)
    return !cause
  }, [])

  /**
   * Create an account, and say which of the two things just happened.
   *
   * With confirmation switched off Supabase hands back a session and the
   * screen is left; with it on there is no session and nothing visible occurs,
   * because the next step is in an inbox. The caller cannot tell those apart
   * from a bare true, and a signup that silently does nothing is the worst of
   * the three outcomes to leave a person looking at.
   *
   * @returns {Promise<{ok: boolean, confirming: boolean}>}
   */
  const signUp = useCallback(async (email, password, fullName) => {
    setBusy(true)
    setError(null)
    const { data, error: cause } = await supabase.auth.signUp({
      email,
      password,
      // Read by the trigger that creates the profile row, so the name is on the
      // account from its first moment rather than collected again afterwards.
      options: { data: { full_name: fullName } },
    })
    if (cause) setError(cause.message)
    setBusy(false)
    return { ok: !cause, confirming: !cause && !data?.session }
  }, [])

  const signOut = useCallback(async () => {
    forgetRecovery()
    await supabase.auth.signOut()
    setSession(null)
    setMfa({ pending: false, factorId: null, forUser: null })
  }, [])

  /** End every session the account holds, on every device, including this one. */
  const signOutEverywhere = useCallback(async () => {
    const { error: cause } = await supabase.auth.signOut({ scope: 'global' })
    if (cause) return cause.message
    forgetRecovery()
    setSession(null)
    setMfa({ pending: false, factorId: null, forUser: null })
    return null
  }, [])

  const verifyMfa = useCallback(
    async code => {
      if (!mfa.factorId) return false
      setBusy(true)
      setError(null)
      const cause = await verifyCode(mfa.factorId, code)
      if (cause) {
        setError(cause)
        setBusy(false)
        return false
      }
      // Verifying issues a token at aal2, and the listener above sets it; this
      // opens the page in the same tick rather than a round trip later. It
      // stays the settled answer for this account, so the token arriving a
      // moment later does not put the question back.
      setMfa({ pending: false, factorId: null, forUser: userId })
      setBusy(false)
      return true
    },
    [mfa.factorId, userId]
  )

  /**
   * Spend a recovery code in place of the authenticator.
   *
   * The account is already signed in at aal1 by the time a code is offered, so
   * a match opens the console for this visit. It does not reach aal2, which
   * only the factor itself can issue, so the visit is what carries it: the
   * redemption is written down where every page reads it, and without that the
   * next page to read the token would send the account straight back here.
   */
  const redeemRecovery = useCallback(
    async code => {
      if (!userId) return false
      setBusy(true)
      setError(null)
      const spent = await redeemRecoveryCode(userId, code)
      if (!spent) {
        setError('That recovery code is not one of yours, or it has been used already.')
        setBusy(false)
        return false
      }
      rememberRecovery(userId)
      setMfa({ pending: false, factorId: null, forUser: userId })
      setBusy(false)
      return true
    },
    [userId]
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    session,
    email: session?.user?.email ?? null,
    userId,
    checking: gate.checking,
    busy,
    error,
    mfaPending: gate.mfaPending,
    mfaFactorId: gate.mfaFactorId,
    signIn,
    signUp,
    signOut,
    signOutEverywhere,
    verifyMfa,
    redeemRecovery,
    clearError,
  }
}

/**
 * The signed-in account. Must be called within a <SessionProvider>.
 *
 * @returns {{session: object|null, email: string|null, userId: string|null,
 *   checking: boolean, busy: boolean, error: string|null,
 *   mfaPending: boolean, mfaFactorId: string|null,
 *   signIn: (email: string, password: string) => Promise<boolean>,
 *   signUp: (email: string, password: string, fullName: string) => Promise<boolean>,
 *   signOut: () => Promise<void>,
 *   signOutEverywhere: () => Promise<string|null>,
 *   verifyMfa: (code: string) => Promise<boolean>,
 *   redeemRecovery: (code: string) => Promise<boolean>,
 *   clearError: () => void}}
 */
export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used within SessionProvider')
  return context
}
