/**
 * The Houston mail box no message states, and the way a message is read for it.
 *
 * The newsletter and the outreach letters are built by different code and held
 * to the same rule, so they are read for the box the same way: whole, and in the
 * fragments a footer built from a differently formatted copy of the same box
 * would print. The box is here so the cases can look for it and hand it to a
 * sender that ought to leave it out.
 */
import { ok } from '../harness/checks.js'

/** The mail box, as a sender that stated it would be handed it. */
export const MAIL_BOX =
  'TaylorURL LLC, 3120 Southwest Fwy Ste 101, PMB #841258, Houston, TX 77098-4520'

/** What a footer built from another copy of the same box would print. */
const MAIL_BOX_FRAGMENTS = ['3120 Southwest Fwy', 'PMB #841258', 'Houston, TX', '77098']

/** Ends a case unless one part of one message states no piece of the mail box. */
export function statesNoAddress(part, where) {
  const said = String(part)
  ok(!said.includes(MAIL_BOX), `the whole address is absent from ${where}`)
  for (const fragment of MAIL_BOX_FRAGMENTS) {
    ok(!said.includes(fragment), `"${fragment}" is absent from ${where}`)
  }
}
