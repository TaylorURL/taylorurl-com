/**
 * What an issue is, what state it is in, and which of its blocks each side of
 * the list is shown.
 *
 * The three statuses the table allows are one vocabulary, named once here so
 * the run that mails an issue and the schedule that finds the ones due cannot
 * drift apart on what any of them means:
 *
 *   draft      being written; the send refuses it
 *   scheduled  ready to go out, on its date or when somebody presses send
 *   sent       gone; nothing sends it again and nothing rewrites it
 *
 * The body is a list of blocks rather than markup, because the same content is
 * drawn twice — once as email tables and once as plain text — and a blob of
 * HTML authored for one of them is wrong in the other. So the block types are
 * fixed.
 *
 * A block also carries who it is for. One issue speaks to two lists at once -
 * people whose sites the studio runs, and people it has only written to - and
 * a block marked for one of them is drawn for that one alone. A block carrying
 * no marker reaches both, which is what leaves every issue written before this
 * existed rendering exactly as it did.
 */

/** Unfinished writing. */
export const DRAFT = 'draft'
/** Ready: the writing is done and the issue may go out. */
export const READY = 'scheduled'
/** Delivered, and final. */
export const SENT = 'sent'

/** The six block types both renderers draw. */
const BLOCK_TYPES = ['heading', 'paragraph', 'image', 'button', 'divider', 'list']

/**
 * The types that say something.
 *
 * A rule is spacing between two things, so an issue whose whole copy for one
 * side is a rule is an issue with nothing to say to that side. That is the
 * distinction {@link hasContentFor} answers on.
 */
const CONTENT_TYPES = BLOCK_TYPES.filter(type => type !== 'divider')

/**
 * The blocks of an issue one side of the list is shown.
 *
 * Every renderer and every count runs through here, so the laid-out half, the
 * plain half and the check that an issue has anything to say are answering one
 * question rather than three that agree by inspection. A block dropped from one
 * part and kept in the other is a message contradicting itself, and it is the
 * fault this would otherwise ship with.
 *
 * A marker naming no side matches nobody. A marker nobody can read is a block
 * whose readership was never decided, and either other answer would decide it
 * by accident - as everybody, which is the leak, or as one side, which is a
 * guess.
 *
 * @param {Array} body The issue's blocks.
 * @param {string|null} [audience] `CLIENT` or `PROSPECT`, or null for every block.
 * @returns {Array} The blocks that side is shown, in order.
 */
export function blocksFor(body, audience = null) {
  const blocks = Array.isArray(body) ? body : []
  if (!audience) return blocks
  return blocks.filter(block => {
    const side = typeof block?.audience === 'string' ? block.audience : ''
    return !side || side === audience
  })
}

/**
 * Whether an issue says anything to one side of the list.
 *
 * A copy carrying a masthead, a title and a footer is a message with nothing in
 * it, which is what an issue written entirely for the other side would post.
 *
 * @param {Array} body The issue's blocks.
 * @param {string|null} [audience] `CLIENT` or `PROSPECT`, or null for every block.
 * @returns {boolean}
 */
export function hasContentFor(body, audience = null) {
  return blocksFor(body, audience).some(block => CONTENT_TYPES.includes(block?.type))
}

/**
 * Why this issue cannot be sent, or null when it can.
 *
 * The two refusals are different facts and read differently. A draft is not
 * finished, which is a thing the writer fixes by marking it ready. An issue
 * already sent is finished, and pressing send again is a mistake with no fix -
 * the mail has landed.
 *
 * @param {{status?: string, slug?: string}} issue
 * @returns {{status: number, error: string}|null}
 */
export function sendRefusal(issue) {
  if (issue?.status === SENT) {
    return { status: 409, error: 'That issue has already gone out. It cannot be sent again.' }
  }
  if (issue?.status !== READY) {
    return { status: 409, error: 'Mark the issue ready before sending it.' }
  }
  return null
}

/**
 * Why this issue cannot go to these sides of the list, or null when it can.
 *
 * The whole run stops rather than the empty copies being left out of it. An
 * issue with nothing to say to one side is a writer who marked a block wrongly,
 * and the fix is one edit; sending to the other side first and reporting the
 * gap afterwards turns that edit into a second issue, because the half that
 * went out cannot be recalled.
 *
 * The sides are the ones the run actually holds recipients for, so an issue
 * written for clients alone still goes out on a night when no prospect is owed
 * a copy.
 *
 * @param {{body?: Array}} issue
 * @param {string[]} audiences The sides the run is about to mail.
 * @returns {{status: number, error: string}|null}
 */
export function contentRefusal(issue, audiences) {
  const empty = (Array.isArray(audiences) ? audiences : []).filter(
    audience => !hasContentFor(issue?.body, audience)
  )
  if (empty.length === 0) return null
  const sides = empty.join(' and ')
  return {
    status: 409,
    error: `This issue has no blocks the ${sides} side can read, so that copy would arrive empty. Nothing was sent.`,
  }
}
