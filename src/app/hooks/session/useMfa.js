import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@data/supabase/supabaseClient'
import { faultMessage } from '@utils/faults'

/**
 * Two-factor authentication over a time-based code, and the recovery codes
 * that stand behind it.
 *
 * The factor itself belongs to Supabase: enrolling returns the QR code and the
 * secret, a six-digit code proves the authenticator was set up before the
 * factor is switched on, and a sign-in with a password afterwards lands at aal1
 * and has to answer a challenge to reach aal2.
 *
 * Recovery codes are this project's own, because the factor has none. They are
 * shown once at enrolment and stored as digests in public.mfa_recovery_codes,
 * so what the table holds cannot be typed into a sign-in form. Each is good for
 * one use.
 */

/** How many recovery codes an enrolment hands over. */
const RECOVERY_CODE_COUNT = 10

/** The name the factor carries in the account, and in an authenticator's list. */
const FACTOR_NAME = 'Authenticator App'

// No 0, O, 1, or I: a recovery code is read off a screen and typed by hand, and
// those four are the pairs that get read as each other. Thirty-two characters
// divide 256 exactly, so a byte maps to one without favouring any of them.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const CODE_LENGTH = 10
const GROUP = 5

const TABLE = 'mfa_recovery_codes'

// A recovery code stands in for the authenticator for the visit that spends it.
// It cannot reach aal2 - only the factor itself issues that - so the token goes
// on reporting a gap for as long as the session lasts, and every page that
// reads the token would send the account back to the prompt it just answered.
// This is what those reads consult instead. Per-tab, and gone when the tab
// closes, which is the length of the visit a code buys.
const RECOVERY_KEY = 'taylorurl:mfa-recovered'

/** Record that this account has answered for its factor with a recovery code. */
export function rememberRecovery(userId) {
  try {
    window.sessionStorage.setItem(RECOVERY_KEY, userId)
  } catch {
    // Private browsing refuses the write. The code was still spent, so this
    // visit ends at the prompt rather than in the console.
  }
}

/** Drop that record. Signing out ends the visit it belonged to. */
export function forgetRecovery() {
  try {
    window.sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    // Nothing was stored to remove.
  }
}

/** Whether this account spent a recovery code in this visit. */
function recovered(userId) {
  try {
    return Boolean(userId) && window.sessionStorage.getItem(RECOVERY_KEY) === userId
  } catch {
    return false
  }
}

/** A code as the table knows it: no separator, one case, nothing else. */
function normalise(code) {
  return String(code || '')
    .replace(/[^0-9a-z]/gi, '')
    .toUpperCase()
}

/**
 * The digest a row is matched by. The account id goes in with the code, so one
 * account's rows can never be matched by another's code even if both drew the
 * same characters.
 */
async function digest(userId, code) {
  const bytes = new TextEncoder().encode(`${userId}:${normalise(code)}`)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

/** A fresh set, drawn from the browser's cryptographic generator. */
function drawCodes() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
    const drawn = Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join('')
    return `${drawn.slice(0, GROUP)}-${drawn.slice(GROUP)}`
  })
}

/** Replace the account's recovery codes with these, and keep none of the plain text. */
async function storeCodes(userId, codes) {
  const hashes = await Promise.all(codes.map(code => digest(userId, code)))
  await supabase.from(TABLE).delete().eq('user_id', userId)
  const { error } = await supabase
    .from(TABLE)
    .insert(hashes.map(code_hash => ({ user_id: userId, code_hash })))
  return error
}

/**
 * Whether a signed-in account still owes a second factor, and which factor it
 * owes it to.
 *
 * Supabase answers with the assurance level held and the level reachable: a gap
 * between them means a verified factor that has not been answered for. An
 * account with no factor reports no gap, which is what keeps this out of the
 * way of everybody who has not enrolled.
 *
 * A recovery code spent in this visit closes the gap for the visit without
 * closing it in the token, so it is read here rather than left to each caller:
 * every page works the question out from the same answer, and one that decides
 * differently is what sends an account round between the console and the
 * prompt.
 *
 * @param {string|null} userId - The account the answer is for.
 * @returns {Promise<{pending: boolean, factorId: string|null}>}
 */
export async function assurance(userId) {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !data) return { pending: false, factorId: null }
  if (data.currentLevel === data.nextLevel || data.nextLevel !== 'aal2') {
    return { pending: false, factorId: null }
  }
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const factor = factors?.totp?.[0] ?? null
  if (!factor) return { pending: false, factorId: null }
  return { pending: !recovered(userId), factorId: factor.id }
}

/**
 * Answer a factor's challenge with a code from the authenticator.
 *
 * @param {string} factorId
 * @param {string} code
 * @returns {Promise<string|null>} what went wrong, or null once aal2 is held.
 */
export async function verifyCode(factorId, code) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: normalise(code),
  })
  return error ? error.message : null
}

/**
 * Spend one recovery code.
 *
 * The row is matched on its digest and marked used in the same breath, so a
 * code read out over a phone call cannot be spent twice.
 *
 * @param {string} userId
 * @param {string} code
 * @returns {Promise<boolean>} whether a live code matched
 */
export async function redeemRecoveryCode(userId, code) {
  const hash = await digest(userId, code)
  const { data, error } = await supabase
    .from(TABLE)
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('code_hash', hash)
    .is('used_at', null)
    .select('id')
  return !error && Array.isArray(data) && data.length > 0
}

/**
 * The account's factor, as the settings page works it.
 *
 * Enrolment is two steps and stays two steps: the first returns a secret and
 * the QR code carrying it, and the factor is switched on only once a code
 * generated from that secret has come back correct. A secret nobody has
 * successfully used is a lock with no key, so an enrolment left half-finished
 * is taken away rather than left in the account's list.
 *
 * @param {{userId: string|null}} options
 * @returns {{factors: Array<object>, loading: boolean, busy: boolean,
 *   error: string|null, enrolment: object|null, codes: string[]|null,
 *   begin: () => Promise<void>, confirm: (code: string) => Promise<boolean>,
 *   cancel: () => Promise<void>, remove: (factorId: string) => Promise<boolean>,
 *   regenerate: () => Promise<boolean>, dismissCodes: () => void,
 *   clearError: () => void}}
 */
export function useMfa({ userId }) {
  const [factors, setFactors] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [enrolment, setEnrolment] = useState(null)
  const [codes, setCodes] = useState(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setFactors([])
      setLoading(false)
      return
    }
    const { data, error: cause } = await supabase.auth.mfa.listFactors()
    if (cause)
      setError(faultMessage(cause, 'The two-factor settings could not be read. Reload the page.'))
    setFactors(data?.totp ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  /** Take away every factor that was started and never proved. */
  const dropUnverified = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    const stale = (data?.all ?? []).filter(factor => factor.status !== 'verified')
    await Promise.all(stale.map(factor => supabase.auth.mfa.unenroll({ factorId: factor.id })))
  }, [])

  const begin = useCallback(async () => {
    setBusy(true)
    setError(null)
    await dropUnverified()
    const { data, error: cause } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: FACTOR_NAME,
    })
    if (cause)
      setError(
        faultMessage(
          cause,
          'Two-factor authentication could not be started. Try again in a moment.'
        )
      )
    else {
      setEnrolment({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      })
    }
    setBusy(false)
  }, [dropUnverified])

  const confirm = useCallback(
    async code => {
      if (!enrolment || !userId) return false
      setBusy(true)
      setError(null)
      const cause = await verifyCode(enrolment.factorId, code)
      if (cause) {
        setError(faultMessage(cause, 'That code was not accepted. Try the current six digits.'))
        setBusy(false)
        return false
      }
      const fresh = drawCodes()
      const stored = await storeCodes(userId, fresh)
      if (stored)
        setError(
          faultMessage(stored, 'The recovery codes could not be saved. Try switching it on again.')
        )
      else setCodes(fresh)
      setEnrolment(null)
      await refresh()
      setBusy(false)
      return !stored
    },
    [enrolment, refresh, userId]
  )

  const cancel = useCallback(async () => {
    if (enrolment) await supabase.auth.mfa.unenroll({ factorId: enrolment.factorId })
    setEnrolment(null)
    setError(null)
  }, [enrolment])

  const remove = useCallback(
    async factorId => {
      setBusy(true)
      setError(null)
      const { error: cause } = await supabase.auth.mfa.unenroll({ factorId })
      if (cause) {
        setError(
          faultMessage(cause, 'Two-factor authentication could not be switched off. Try again.')
        )
        setBusy(false)
        return false
      }
      // The codes stand behind the factor and mean nothing without it.
      if (userId) await supabase.from(TABLE).delete().eq('user_id', userId)
      forgetRecovery()
      setCodes(null)
      await refresh()
      setBusy(false)
      return true
    },
    [refresh, userId]
  )

  const regenerate = useCallback(async () => {
    if (!userId) return false
    setBusy(true)
    setError(null)
    const fresh = drawCodes()
    const stored = await storeCodes(userId, fresh)
    if (stored)
      setError(faultMessage(stored, 'A new set of recovery codes could not be made. Try again.'))
    else setCodes(fresh)
    setBusy(false)
    return !stored
  }, [userId])

  const dismissCodes = useCallback(() => setCodes(null), [])
  const clearError = useCallback(() => setError(null), [])

  return {
    factors,
    loading,
    busy,
    error,
    enrolment,
    codes,
    begin,
    confirm,
    cancel,
    remove,
    regenerate,
    dismissCodes,
    clearError,
  }
}
