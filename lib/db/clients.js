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
  const jwt = bearer(authorization)
  if (!jwt) return { status: 401, error: expired || 'That session has expired. Sign in again.' }

  const { data, error } = await verifier.auth.getUser(jwt)
  if (error || !data?.user) {
    return { status: 401, error: expired || 'That session has expired. Sign in again.' }
  }
  return { userId: data.user.id, email: data.user.email }
}

/** The token out of a `Bearer` header, or an empty string. */
function bearer(authorization) {
  return String(authorization || '')
    .slice('Bearer '.length)
    .trim()
}

/**
 * The account id the token states, as the token states it.
 *
 * Unverified and unverifiable here - anybody can write a JWT saying anything -
 * so it is a guess about which row will be wanted and never an answer about
 * who is asking. The caller has to check it against the verified account
 * before a single field off that row is allowed to matter.
 */
function subjectOf(jwt) {
  const claims = jwt.split('.')[1]
  if (!claims) return null
  try {
    const stated = JSON.parse(Buffer.from(claims, 'base64url').toString('utf8'))
    return typeof stated?.sub === 'string' && stated.sub ? stated.sub : null
  } catch {
    // A token this malformed will not verify either, so there is nothing to
    // report: the round trip below is what refuses it.
    return null
  }
}

/** The role row for one account, carrying the account it was read for. */
function readRole(db, userId) {
  return db
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
    .then(answer => ({ ...answer, forUser: userId }))
}

/**
 * Who is asking, refused unless their role is one of the ones named.
 *
 * A missing profile row is a client rather than an error: an account that
 * arrived without one sees nothing rather than everything.
 *
 * Two round trips, and they go out together. Verifying the session and reading
 * the role are both remote, and running the second after the first put the
 * whole of one on the front of every authenticated request - every page, and
 * every twenty-second beat behind them. The role read is started against the
 * id the token claims, which is a guess, and the guess is thrown away unless
 * the verified account turns out to be the one it read: a forged token buys a
 * wasted read of a row nobody is shown and is refused exactly as before.
 *
 * The role comes back on the account, because an endpoint two roles can reach
 * usually has one action inside it that only the higher one may take, and
 * reading the row a second time to find that out would undo the saving above.
 *
 * @param {{db: object, verifier: object}} clients
 * @param {string} authorization A `Bearer` header.
 * @param {string[]} allowed The roles that may proceed.
 * @returns {Promise<{userId: string, email: string, role: string}|{status: number, error: string}>}
 */
async function authorizeRole(clients, authorization, allowed) {
  const claimed = subjectOf(bearer(authorization))
  const [account, guessed] = await Promise.all([
    authorizeAccount(clients, authorization),
    claimed ? readRole(clients.db, claimed) : null,
  ])
  if (account.status) return account

  const profile =
    guessed?.forUser === account.userId ? guessed : await readRole(clients.db, account.userId)
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
  const role = profile.data?.role ?? 'client'
  if (!allowed.includes(role)) {
    return { status: 403, error: 'This account is not allowed to do that.' }
  }
  return { ...account, role }
}

/**
 * Who is asking, refused unless they hold the admin role.
 *
 * @param {{db: object, verifier: object}} clients
 * @param {string} authorization A `Bearer` header.
 * @returns {Promise<{userId: string, email: string, role: string}|{status: number, error: string}>}
 */
export function authorizeAdmin(clients, authorization) {
  return authorizeRole(clients, authorization, ['admin'])
}

/**
 * The same, for the two endpoints a representative works the call list through.
 *
 * A representative is hired to ring the businesses on that list and is given an
 * account that can do nothing else, which is what the `staff` role is: it
 * reaches the call list and the call desk, and every other admin endpoint
 * refuses it exactly as it refuses a client. An admin is admitted here too,
 * because the console's own calling screen is this same list and the person who
 * set the list up works it as well.
 *
 * The narrowing inside an endpoint is the endpoint's, off the role this
 * returns. Reading the list and recording a call are the job; handing a
 * business to somebody else is deciding who does the job, and that stays with
 * the role that hired them.
 *
 * @param {{db: object, verifier: object}} clients
 * @param {string} authorization A `Bearer` header.
 * @returns {Promise<{userId: string, email: string, role: string}|{status: number, error: string}>}
 */
export function authorizeCaller(clients, authorization) {
  return authorizeRole(clients, authorization, ['admin', 'staff'])
}
