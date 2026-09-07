/**
 * The database connection every authenticated endpoint works through, and the
 * door in front of it.
 *
 * Two clients, not one. The service-role key bypasses row security, so it can
 * read and write anything; the publishable key can do nothing on its own and is
 * what a caller's own token is checked against. Verifying a session with the
 * key that bypasses security would be asking the lock whether the key fits.
 *
 * The pair is built once per function instance and held, because building a
 * client is the kind of setup that costs nothing to reuse and a measurable
 * amount to repeat on every request. Both carry a request deadline, so a stalled
 * database read ends the query rather than the function's whole allowance.
 *
 * The role check lives here for the same reason the clients do: an endpoint that
 * reads the profile row itself is an endpoint that can read it differently, and
 * a door that is 'admins only' at five endpoints and 'anybody signed in' at the
 * sixth is a hole nobody sees until it is used.
 */

import { createClient } from '@supabase/supabase-js'
import { timedFetch } from '../http/timed.js'

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://gujgtjqqurildqurpffh.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

let clients = null

/**
 * The two clients, or null where the deployment holds no keys.
 *
 * A null is a deployment that was never given its keys rather than a request
 * that went wrong, so the caller answers 503 and says which keys are missing.
 *
 * @returns {{db: object, verifier: object}|null}
 */
export function connect() {
  if (!SERVICE_KEY || !ANON_KEY) return null
  if (!clients) {
    const options = {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: timedFetch },
    }
    clients = {
      db: createClient(SUPABASE_URL, SERVICE_KEY, options),
      verifier: createClient(SUPABASE_URL, ANON_KEY, options),
    }
  }
  return clients
}

/**
 * Who is asking, from the session they presented.
 *
 * @param {{verifier: object}} clients
 * @param {string} authorization A `Bearer` header.
 * @param {string} [expired] What to say when the session no longer verifies.
 * @returns {Promise<{userId: string, email: string}|{status: number, error: string}>}
 *   An account, or the refusal to answer with.
 */
export async function authorizeAccount({ verifier }, authorization, expired) {
  const jwt = String(authorization || '')
    .slice('Bearer '.length)
    .trim()
  if (!jwt) return { status: 401, error: expired || 'That session has expired. Sign in again.' }

  const { data, error } = await verifier.auth.getUser(jwt)
  if (error || !data?.user) {
    return { status: 401, error: expired || 'That session has expired. Sign in again.' }
  }
  return { userId: data.user.id, email: data.user.email }
}

/**
 * Who is asking, refused unless they hold the admin role.
 *
 * A missing profile row is a client rather than an error: an account that
 * arrived without one sees nothing rather than everything.
 *
 * @param {{db: object, verifier: object}} clients
 * @param {string} authorization A `Bearer` header.
 * @returns {Promise<{userId: string, email: string}|{status: number, error: string}>}
 */
export async function authorizeAdmin(clients, authorization) {
  const account = await authorizeAccount(clients, authorization)
  if (account.status) return account

  const profile = await clients.db
    .from('profiles')
    .select('role')
    .eq('id', account.userId)
    .maybeSingle()
  if (profile.error) {
    // The row would not read, so whether this account holds the role is
    // unknown, and unknown is not a yes. What Postgres said about why is the
    // first thing worth having when this is looked into and the last thing the
    // person in front of it should be shown, so it goes to the log and stops
    // there: a constraint, a table name or a policy is detail about the inside
    // of the site, handed to whoever asked.
    console.error('clients: the role check could not read a profile: %s', profile.error.message)
    return { status: 500, error: 'Your account could not be checked just now. Try again shortly.' }
  }
  if ((profile.data?.role ?? 'client') !== 'admin') {
    return { status: 403, error: 'This account is not allowed to do that.' }
  }
  return account
}
