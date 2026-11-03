/**
 * The session read is asked for more than once, and a read that failed is not
 * reported as a sign-out.
 *
 * `AuthRetryableFetchError: Load failed` arrived from /console/calls in Safari.
 * The name is supabase-js saying the request never landed and asking to be
 * asked again; nothing asked. `useSession` took the `data` half of
 * `getSession()` and dropped the `error`, so a dropped packet reached the guard
 * as `session: null` - the same shape a signed-out visitor has - and the console
 * sent a signed-in reader to the sign-in form while their session sat in
 * storage and the nav bar went on saying they were signed in.
 *
 * Two things are asserted here, because either alone leaves the fault. The
 * ladder, so a request that did not land is asked again; and the third state, so
 * a read that never succeeded says "unknown" rather than "signed out". The
 * bounds are imported by name rather than written as literals, so moving a rung
 * moves this with it.
 */
import { cases, check, finish, ok, same } from '../harness/checks.js'
import {
  SESSION_RETRIES,
  SESSION_RETRY_MS,
  SESSION_WAIT_MS,
  askWithLadder,
  readSession,
  worthAnotherAsk,
} from '../../src/app/hooks/session/readSession.js'
import { NO_ANSWER, sessionGate } from '../../src/app/hooks/session/sessionGate.js'

const ACCOUNT = '00000000-0000-4000-8000-000000000001'
const SESSION = { access_token: 'token', user: { id: ACCOUNT, email: 'owner@example.com' } }

/** The failure Safari renders as a bare sentence, as supabase-js hands it over. */
function dropped() {
  const cause = new Error('Load failed')
  cause.name = 'AuthRetryableFetchError'
  return { data: { session: null }, error: cause }
}

/** A session that has genuinely gone, which is a real answer. */
function missing() {
  const cause = new Error('Auth session missing!')
  cause.name = 'AuthSessionMissingError'
  return { data: { session: null }, error: cause }
}

/** Runs the read against a scripted series of answers, recording every pause. */
async function run(answers) {
  const asked = []
  const waits = []
  const ask = () => {
    const next = answers[asked.length]
    asked.push(next)
    if (next instanceof Error) return Promise.reject(next)
    return Promise.resolve(next)
  }
  const outcome = await readSession({ ask, pause: ms => (waits.push(ms), Promise.resolve()) })
  return { ...outcome, asked, waits }
}

const landed = await run([dropped(), dropped(), { data: { session: SESSION } }])

check('a session read that did not land is asked again', () => {
  same(landed.asked.length, 3, 'attempts at a read that failed twice and then landed')
  same(landed.session, SESSION, 'the session the third attempt answered with')
  same(landed.unreachable, false, 'unreachable after a read that succeeded')
})

check('the quick attempts back off rather than firing in a moment', () => {
  same(landed.waits[0], SESSION_RETRY_MS, 'the first pause')
  same(landed.waits[1], SESSION_RETRY_MS * 2, 'the second pause')
})

const spent = await run([dropped(), dropped(), dropped(), dropped()])

check('the ladder has a rung left after the first second', () => {
  // An outage that lasts two or three seconds is the one that happens. A ladder
  // spent inside one second is a ladder spent entirely inside the outage.
  same(spent.asked.length, SESSION_RETRIES + 2, 'attempts in a ladder fully spent')
  same(spent.waits[spent.waits.length - 1], SESSION_WAIT_MS, 'the last pause')
  ok(
    SESSION_WAIT_MS > SESSION_RETRY_MS * (SESSION_RETRIES + 1) * 2,
    'the long rung outlasting the quick pair, without which the whole ladder is spent inside the outage it is for'
  )
})

check('a read that never landed is not reported as a sign-out', () => {
  same(spent.unreachable, true, 'unreachable with every attempt failed')
  same(spent.session, null, 'the session after a read that never answered')
})

const rejected = await run([
  Object.assign(new Error('Load failed'), { name: 'AuthRetryableFetchError' }),
  { data: { session: SESSION } },
])

check('a rejection and an error field are the same failure, and both are retried', () => {
  // Which shape arrives depends on the version of auth-js, and a ladder that
  // only catches one of them is a ladder that is not there half the time.
  same(rejected.asked.length, 2, 'attempts when the first one threw')
  same(rejected.session, SESSION, 'the session after a thrown first attempt')
})

const gone = await run([missing(), { data: { session: SESSION } }])

check('a session that has genuinely gone is not asked about again', () => {
  // Every visitor who is not signed in takes this path, and holding them on a
  // placeholder for five seconds on the way to the sign-in form is its own
  // fault. Only a request that did not complete is worth repeating.
  same(gone.asked.length, 1, 'attempts at a session that is genuinely missing')
  same(gone.unreachable, false, 'unreachable for a definite answer')
})

check('only a network failure is worth another ask', () => {
  same(worthAnotherAsk(dropped().error), true, 'a retryable fetch error')
  same(worthAnotherAsk(new Error('Load failed')), true, 'the bare sentence Safari renders')
  same(worthAnotherAsk(new Error('Failed to fetch')), true, 'the sentence other browsers render')
  same(worthAnotherAsk(missing().error), false, 'a session that has gone')
  same(worthAnotherAsk(null), false, 'no cause at all')
})

check('the guard is told the account is unknown, not signed out', () => {
  // This is the half that decides what the reader sees. `checking` false and
  // `unreachable` true is the third state: nothing is outstanding, and nothing
  // is decided either.
  const gate = sessionGate({ reading: false, userId: null, unreachable: true, mfa: NO_ANSWER })
  same(gate.unreachable, true, 'unreachable on the gate after a failed read')
  same(gate.checking, false, 'checking after a ladder that is spent')
  same(gate.mfaPending, false, 'mfaPending for an account that could not be read')
})

check('a genuinely signed-out visitor is still signed out', () => {
  const gate = sessionGate({ reading: false, userId: null, unreachable: false, mfa: NO_ANSWER })
  same(gate.unreachable, false, 'unreachable for a visitor who is simply not signed in')
  same(gate.checking, false, 'checking for a settled signed-out visitor')
})

check('a session in hand is never reported as unreachable', () => {
  const gate = sessionGate({
    reading: false,
    userId: ACCOUNT,
    unreachable: true,
    mfa: { pending: false, factorId: null, forUser: ACCOUNT },
  })
  same(gate.unreachable, false, 'unreachable while a session is held')
  same(gate.checking, false, 'checking with both halves answered')
})

const refreshed = []
const refresh = await askWithLadder(
  () => {
    refreshed.push(1)
    return Promise.resolve(refreshed.length < 3 ? dropped() : { data: { session: SESSION } })
  },
  { pause: () => Promise.resolve() }
)

check('the refresh behind a refused read gets the ladder too', () => {
  // The console refreshes the session when a read is refused, and signs the
  // reader out if that refresh fails. On one attempt, a dropped request ended a
  // session that was fine.
  same(refreshed.length, 3, 'attempts at a refresh that failed twice')
  same(refresh.unreachable, false, 'unreachable after a refresh that landed')
  same(refresh.answer?.data?.session, SESSION, 'the session the refresh answered with')
})

const lost = await askWithLadder(() => Promise.resolve(dropped()), {
  pause: () => Promise.resolve(),
})

check('a refresh that never landed proves nothing about the session', () => {
  same(lost.unreachable, true, 'unreachable after a refresh that never answered')
  same(lost.answer, null, 'the answer from a refresh that never answered')
  same(lost.cause?.name, 'AuthRetryableFetchError', 'the cause carried back')
})

const passed = await finish({
  hint: 'a request that did not land is asked again, and a session nobody could read is not a session that ended',
})
console.log(`\n${passed}/${cases.length} passed`)
