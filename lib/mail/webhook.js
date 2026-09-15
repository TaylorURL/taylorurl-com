/**
 * Whether a delivery from Resend is the one it claims to be.
 *
 * Resend signs its webhooks through Svix: `id.timestamp.body` under the secret
 * that follows `whsec_`, base64 decoded, with one or more candidate signatures
 * on the header because a secret can be rotated with both live. Any one of
 * them matching is a match. The body is the bytes that arrived rather than
 * what a parser made of them, which is why every endpoint that calls this
 * turns the platform's body parsing off and reads the stream itself.
 *
 * One copy, read by every endpoint Resend posts to, because a check that is
 * right on one webhook and stale on another is a door that is open on the one
 * nobody looked at.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/** Two strings compared without the comparison itself saying how far it got. */
export function same(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * @param {object} headers The request headers, lowercased as Node hands them over.
 * @param {string} body The raw body.
 * @param {string} secret The `whsec_` signing secret of the webhook.
 * @returns {boolean}
 */
export function signedByResend(headers, body, secret) {
  if (!secret || !body) return false
  const id = headers['svix-id']
  const stamp = headers['svix-timestamp']
  const offered = headers['svix-signature']
  if (!id || !stamp || !offered) return false

  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${stamp}.${body}`).digest('base64')
  return String(offered)
    .split(' ')
    .some(entry => {
      const [version, value] = entry.split(',')
      return version === 'v1' && value && same(value, expected)
    })
}
