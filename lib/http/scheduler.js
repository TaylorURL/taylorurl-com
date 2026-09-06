/**
 * Whether an invocation is the platform's own scheduler.
 *
 * Vercel signs a cron invocation with `CRON_SECRET` and nothing else carries
 * it, so this is the one thing a job can check to tell a schedule from a
 * request. An unset secret leaves no way for an invocation to prove it is the
 * scheduler, and the answer is then no for everybody rather than yes.
 *
 * One copy, because a guard that is right in one job and stale in another is
 * indistinguishable from a guard that works right up until the day it matters.
 */

import { createHash, timingSafeEqual } from 'node:crypto'

const CRON_SECRET = process.env.CRON_SECRET || ''

const digest = value => createHash('sha256').update(String(value)).digest()

/**
 * The comparison is made over digests so it runs in fixed time and gives away
 * neither the secret nor its length.
 *
 * @param {string} authorization A `Bearer` header, or the bare token.
 * @returns {boolean}
 */
export function isScheduler(authorization) {
  if (!CRON_SECRET) return false
  const token = String(authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  return timingSafeEqual(digest(token), digest(CRON_SECRET))
}
