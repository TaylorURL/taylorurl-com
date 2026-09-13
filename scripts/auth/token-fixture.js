/**
 * The bearer token the door checks present.
 *
 * A door reads the account a token states before the verifier has said whether
 * the token is true, so the reads can go out together. A check therefore needs
 * a token that states an account and proves nothing: whatever a case lets
 * through was let through on the verifier's word, never on the token's own.
 */

/** A token that states an account, signed by nobody. */
export function token(sub) {
  const part = value => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
  return `Bearer ${part({ alg: 'HS256' })}.${part({ sub })}.not-a-signature`
}
