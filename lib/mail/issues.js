/**
 * Which of an issue's blocks each side of the list is shown.
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
