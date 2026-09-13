/**
 * Proves that a sign-in is never decided from an answer that has not arrived.
 *
 * Two guards read the account: the login form, which sends a finished sign-in
 * on to the console, and the console, which sends an unfinished one back. They
 * agree only while neither acts before the second factor question is answered.
 * A gate that reports "no factor owed" during the round trip that would have
 * said otherwise puts both of them in motion at once, and an account with two
 * factors' worth of screens ends up alternating between them.
 *
 * The sequences below are the ones a real sign-in walks, in order, so a change
 * that collapses the unanswered state back into the answered one fails here.
 */

import { NO_ANSWER, sessionGate } from '../../src/app/hooks/session/sessionGate.js'
import { cases, check, finish, same } from '../harness/checks.js'

const ACCOUNT = 'account-1'
const OTHER = 'account-2'

/** The answer once assurance has run for an account. */
function answered(userId, { pending, factorId = null }) {
  return { pending, factorId, forUser: userId }
}

/** The answer for a session that holds no account. */
const SIGNED_OUT = { pending: false, factorId: null, forUser: null }

check('nothing is decided before the stored session has been read', () => {
  const gate = sessionGate({ reading: true, userId: null, mfa: NO_ANSWER })
  same(gate.checking, true, 'checking on first mount')
})

check('nothing is decided while the factor question is outstanding', () => {
  // The password has been accepted and the session is in hand; assurance has
  // not come back. This is the state a premature redirect is made from.
  const gate = sessionGate({ reading: false, userId: ACCOUNT, mfa: NO_ANSWER })
  same(gate.checking, true, 'checking with the answer outstanding')
})

check('a session read back before assurance is still outstanding', () => {
  // The signed-out answer is a real answer, and it does not carry over to the
  // account that arrives after it.
  const gate = sessionGate({ reading: false, userId: ACCOUNT, mfa: SIGNED_OUT })
  same(gate.checking, true, 'checking with a signed-out answer against an account')
})

check('an account owing a factor is reported as owing it', () => {
  const mfa = answered(ACCOUNT, { pending: true, factorId: 'factor-1' })
  const gate = sessionGate({ reading: false, userId: ACCOUNT, mfa })
  same(gate.checking, false, 'checking once answered')
  same(gate.mfaPending, true, 'mfaPending')
  same(gate.mfaFactorId, 'factor-1', 'mfaFactorId')
})

check('an account owing no factor is let through', () => {
  const mfa = answered(ACCOUNT, { pending: false })
  const gate = sessionGate({ reading: false, userId: ACCOUNT, mfa })
  same(gate.checking, false, 'checking once answered')
  same(gate.mfaPending, false, 'mfaPending')
})

check('a token rotating under one account keeps its answer', () => {
  // The hourly refresh issues a new token for the same account. Reopening the
  // question here would blank the console every hour on the hour.
  const mfa = answered(ACCOUNT, { pending: false })
  const gate = sessionGate({ reading: false, userId: ACCOUNT, mfa })
  same(gate.checking, false, 'checking across a refresh')
})

check('one account never answers for another', () => {
  const mfa = answered(ACCOUNT, { pending: false })
  const gate = sessionGate({ reading: false, userId: OTHER, mfa })
  same(gate.checking, true, 'checking for an account with no answer of its own')
})

check('signing out is answered, not outstanding', () => {
  const gate = sessionGate({ reading: false, userId: null, mfa: SIGNED_OUT })
  same(gate.checking, false, 'checking when signed out')
  same(gate.mfaPending, false, 'mfaPending when signed out')
})

check('signing out is answered before the old answer has been cleared', () => {
  // Signing out drops the session first and the answer about its factor a
  // moment later, because one is a network round trip and the other is not.
  // Waiting on that gap takes the console down to a placeholder on the way to
  // the login form, which reads as the page loading twice.
  const stale = answered(ACCOUNT, { pending: true, factorId: 'factor-1' })
  const gate = sessionGate({ reading: false, userId: null, mfa: stale })
  same(gate.checking, false, 'checking between the session going and the answer going')
  same(gate.mfaPending, false, 'mfaPending')
  same(gate.mfaFactorId, null, 'mfaFactorId')
})

check('every step of signing out is decidable', () => {
  // The whole sequence, in the order it happens: a session owing a code, the
  // session gone, then the answer gone. Nothing between them may be a wait.
  const steps = [
    { reading: false, userId: ACCOUNT, mfa: answered(ACCOUNT, { pending: false }) },
    { reading: false, userId: null, mfa: answered(ACCOUNT, { pending: false }) },
    { reading: false, userId: null, mfa: SIGNED_OUT },
  ]
  const gates = steps.map(sessionGate)
  same(
    gates.every(gate => gate.checking === false),
    true,
    'no step of signing out is outstanding'
  )
})

check('a sign-in with a factor never reports a decidable state early', () => {
  // The whole sequence, in the order it happens. Every step before the answer
  // must be undecidable, and the first decidable step must say a code is owed.
  const steps = [
    { reading: true, userId: null, mfa: NO_ANSWER },
    { reading: true, userId: null, mfa: SIGNED_OUT },
    { reading: false, userId: null, mfa: SIGNED_OUT },
    { reading: false, userId: ACCOUNT, mfa: SIGNED_OUT },
    { reading: false, userId: ACCOUNT, mfa: answered(ACCOUNT, { pending: true, factorId: 'f' }) },
  ]
  const gates = steps.map(sessionGate)
  // The signed-out account is decidable and owes nothing; that is correct and
  // is what lets the login form draw at all.
  same(gates[2].checking, false, 'signed out is decidable')
  same(gates[2].mfaPending, false, 'signed out owes nothing')
  // The moment the account appears the question reopens and stays shut until
  // it is answered.
  same(gates[3].checking, true, 'account in hand, answer outstanding')
  same(gates[4].checking, false, 'answered')
  same(gates[4].mfaPending, true, 'a code is owed')
  const decidable = gates.filter(gate => !gate.checking)
  same(
    decidable.some(gate => gate.mfaPending === false && gate === gates[3]),
    false,
    'no step reports an account as owing nothing before it has been asked'
  )
})

const passed = await finish({ listed: true })
console.log(`\n${passed}/${cases.length} passed`)
