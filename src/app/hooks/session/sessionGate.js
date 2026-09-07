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
 */

/** The answer before one has been worked out. `forUser` matches no account. */
export const NO_ANSWER = { pending: false, factorId: null, forUser: undefined }

/**
 * @param {{reading: boolean, userId: string|null,
 *   mfa: {pending: boolean, factorId: string|null, forUser: string|null|undefined}}} state
 * @returns {{checking: boolean, mfaPending: boolean, mfaFactorId: string|null}}
 *   `checking` is true while anything about the account is still outstanding.
 *   The other two mean nothing until it is false.
 */
export function sessionGate({ reading, userId, mfa }) {
  // No account owes no factor, and nothing about one is outstanding. The
  // question is about an account and there is none to ask it of, so the answer
  // left over from the last one is not waited on: signing out clears the
  // session a moment before it clears that answer, and treating the gap as an
  // open question takes the console down to a placeholder on the way out.
  if (!userId) return { checking: reading, mfaPending: false, mfaFactorId: null }
  return {
    checking: reading || mfa.forUser !== userId,
    mfaPending: mfa.pending,
    mfaFactorId: mfa.factorId,
  }
}
