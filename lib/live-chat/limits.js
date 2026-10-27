/**
 * How much of the assistant one connection gets.
 *
 * Each turn spends real money on a machine in a house, so the ceiling has to
 * hold across every function instance, which means it is counted in the
 * database rather than in memory. The in-memory window in `lib/http/rate.js`
 * sits in front as the cheap refusal that never reaches a query.
 *
 * The numbers are set where an ordinary exchange never touches them. A shop owner
 * working out whether to call has ten or fifteen turns in them, not ninety;
 * anything past these is either a script or somebody entertaining themselves,
 * and both are answered by being handed the phone number, which is the
 * destination of every exchange the widget has.
 */

export const LIMITS = {
  perCallerHour: 25,
  perCallerDay: 60,
  perSessionTurns: 30,
  perDay: 600,
}

/**
 * Whether the counts have run out, and the sentence that says so.
 *
 * Every refusal names the way through rather than only the wall, because a
 * visitor who hit a ceiling is still a visitor worth having.
 *
 * @param {{callerHour: number, callerDay: number, sessionTurns: number, day: number}} counts
 * @returns {string|null}
 */
export function overCeiling(counts) {
  if (counts.sessionTurns >= LIMITS.perSessionTurns) {
    return 'That is a long thread, and I have reached the end of what I can carry in one. Trenton picks it up from here: trenton@taylorurl.com, or (281) 862-8687.'
  }

  if (counts.callerHour >= LIMITS.perCallerHour || counts.callerDay >= LIMITS.perCallerDay) {
    return 'That is as much as this connection gets for now. If there is more to talk about, Trenton is at trenton@taylorurl.com or (281) 862-8687.'
  }

  if (counts.day >= LIMITS.perDay) {
    return 'The assistant is at its limit for today. Trenton reads everything sent to trenton@taylorurl.com, and answers.'
  }

  return null
}

/**
 * Seconds to wait, for the Retry-After header.
 *
 * A session that has run out never reopens, so the honest answer for that one
 * is the rest of the day rather than a number that implies otherwise.
 */
export function retryAfter(counts) {
  if (counts.sessionTurns >= LIMITS.perSessionTurns) return 86400
  if (counts.callerHour >= LIMITS.perCallerHour) return 3600
  return 86400
}
