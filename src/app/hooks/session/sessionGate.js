/**
 * What a guard may decide from what has been read of the account so far.
 *
 * A sign-in is two answers arriving separately: the stored session, and whether
 * that session still owes a second factor. The second takes a round trip beyond
 * the first, and for the length of it there is no answer at all - which is a
 * third state, and not the same as an account that owes nothing. Read as the
 * latter it opens the console to a session that has not finished arriving, and
 * the answer landing a moment later closes it again.
 *
 * So the gap is named here rather than left for each guard to infer. An answer
 * belongs to the account it was worked out for: a token rotating under the same
 * account keeps it, and a different account has none until its own arrives.
 *
 * There is a fourth state, and leaving it unnamed is what sent signed-in
 * readers to the sign-in form. The session read can fail rather than answer:
 * the request to GoTrue never lands, every rung of the retry ladder is spent,
 * and what the page holds is not "no account" but "no answer about the
 * account". Those two are opposite instructions to a guard - one means show the
 * sign-in form, the other means do not - and for want of telling them apart the
 * console took a dropped request for a sign-out. `unreachable` is that state,
 * and it is never true at the same time as a session.
 */

/** The answer before one has been worked out. `forUser` matches no account. */
export const NO_ANSWER = { pending: false, factorId: null, forUser: undefined }

/**
 * @param {{reading: boolean, userId: string|null, unreachable?: boolean,
 *   mfa: {pending: boolean, factorId: string|null, forUser: string|null|undefined}}} state
 * @returns {{checking: boolean, mfaPending: boolean, mfaFactorId: string|null,
 *   unreachable: boolean}}
 *   `checking` is true while anything about the account is still outstanding.
 *   `unreachable` says the account could not be read at all, which is not an
 *   answer and must not be acted on as one. The other two mean nothing until
 *   `checking` is false.
 */
export function sessionGate({ reading, userId, unreachable = false, mfa }) {
  // A read that failed outright. Nothing is outstanding - the ladder is spent,
  // so waiting longer is not what is owed - and nothing is decided either. A
  // guard reading this shows the reader what happened and offers the ask again;
  // what it may not do is conclude they are signed out, which is the one thing
  // this does not say.
  if (unreachable && !userId)
    return { checking: false, mfaPending: false, mfaFactorId: null, unreachable: true }
  // No account owes no factor, and nothing about one is outstanding. The
  // question is about an account and there is none to ask it of, so the answer
  // left over from the last one is not waited on: signing out clears the
  // session a moment before it clears that answer, and treating the gap as an
  // open question takes the console down to a placeholder on the way out.
  if (!userId)
    return { checking: reading, mfaPending: false, mfaFactorId: null, unreachable: false }
  return {
    checking: reading || mfa.forUser !== userId,
    mfaPending: mfa.pending,
    mfaFactorId: mfa.factorId,
    unreachable: false,
  }
}
