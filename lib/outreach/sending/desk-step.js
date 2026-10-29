/**
 * A chain step that reaches somebody by telephone rather than by letter.
 *
 * Every step used to be an email, so the sender's only question was which
 * words to put in it. A chain may now say a step is a call, and nothing about
 * that goes near a mail server: the step is recorded on the same timeline as
 * the letters, and the business is put in front of the phone desk with the one
 * line the caller needs.
 *
 * ## Why it is written on the row
 *
 * The desk's list is worked out from the businesses themselves rather than
 * stored - the same design as the send queue - so a step that wants a call has
 * to leave something on the row for the desk to read. `call_due_at` is that
 * something, and it is also what lets the business onto the desk at all: the
 * desk otherwise rings only businesses with no site of their own, on the
 * reasoning that anybody with a site can be written to instead. A chain about
 * a site that has stopped working is the case that reasoning gets wrong, and
 * the chain saying so is what overrides it.
 *
 * ## What a call step does not spend
 *
 * Not the day's sending cap, not an address's room for the day, and not the
 * mailbox's. None of those are about a telephone. A call step is recorded as a
 * step of the chain, which moves the business to the next one, and nothing
 * else is charged for it.
 *
 * Strings and pure functions only, so the whole of what a call step writes can
 * be read without a database in front of it.
 */

/** Room for the line a caller reads, and no room for a paragraph. */
const REASON_MAX = 300

/**
 * The line a caller is given, which is the chain's own sentence about this
 * business where it has one and the chain's name where it does not.
 *
 * @param {object} prospect The business's row.
 * @param {object} chain The chain the step belongs to.
 */
export function callReason(prospect, chain) {
  const said = String(prospect?.fault_says ?? '').trim()
  const name = chain?.name ?? 'outreach'
  const line = said ? `${name}: ${said}` : `${name}: the chain asked for a call at this step`
  return line.slice(0, REASON_MAX)
}

/**
 * What a call step writes on the business.
 *
 * @param {object} prospect
 * @param {object} chain
 * @param {number} step Which step of the chain this is.
 * @param {Date} now
 */
export function deskPatch(prospect, chain, step, now = new Date()) {
  const at = now.toISOString()
  return {
    call_due_at: at,
    call_due_chain: chain?.id ?? null,
    call_due_reason: callReason(prospect, chain),
    // The chain moves on whether the call is made or not, the same way it
    // moves on from a letter that was delivered. Whether anybody rang is the
    // desk's own record, and a chain that waited on it would be a chain that
    // stops whenever the desk is busy.
    step,
    next_due_at: null,
    contacted_at: prospect?.contacted_at ?? at,
  }
}

/**
 * The row a call step leaves on the timeline.
 *
 * It carries no body and no address, because nothing was written and nothing
 * was sent. What it carries is the chain, the step and the channel, so the
 * recap counts a call beside the letters rather than losing it.
 */
export function deskMessage(prospect, chain, step, letterId, now = new Date()) {
  return {
    prospect_id: prospect.id,
    direction: 'outbound',
    status: 'sent',
    sent_at: now.toISOString(),
    chain: chain?.id ?? null,
    channel: 'call',
    step,
    variant_id: letterId ?? null,
    subject: callReason(prospect, chain),
    payload: { kind: 'call-owed', reason: callReason(prospect, chain) },
  }
}

/**
 * Whether a business was put in front of the desk by a chain, and is still
 * waiting to be rung.
 *
 * A call the desk has already made writes its own row in `outreach_calls`
 * against a later moment, so the question the desk asks is whether anything
 * has been recorded since the chain asked.
 *
 * @param {object} prospect Carrying `call_due_at` and `called_at`.
 */
export function callOwed(prospect) {
  const due = Date.parse(prospect?.call_due_at ?? '')
  if (!Number.isFinite(due)) return false
  const rung = Date.parse(prospect?.called_at ?? '')
  return !Number.isFinite(rung) || rung < due
}
