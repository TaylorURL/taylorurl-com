/**
 * The saved replies the Inbox answers a lead from, and the blanks they carry.
 *
 * A reply to a lead is the same dozen sentences most of the time - what the
 * studio does, what happens next, what it costs to find out - and typing them
 * fresh against every name is how a Tuesday lead gets answered on Thursday. So
 * the saved replies live in the database and the reply box starts from one
 * with the lead's own facts already in place.
 *
 * The blanks are a closed set rather than whatever a saved reply cares to
 * invent, because each one has to be answerable from a lead row. A blank the
 * lead cannot fill stays standing in the reply box, and the send refuses while
 * any blank stands - which is what makes a saved reply safe to keep: the
 * message that goes is always the message that was read, with nobody's name
 * missing from the top of it.
 *
 * This file is shared by the page and the endpoint, so the two cannot disagree
 * about what a blank is or which lead fills it.
 */

/** How much a message is allowed to hold. The database checks the same figures. */
export const TEMPLATE_LIMITS = Object.freeze({ subject: 200, body: 5000 })

/** The front of a name, for the greeting. */
function firstNameOf(name) {
  if (typeof name !== 'string') return null
  const first = name.trim().split(/\s+/)[0] || ''
  return first || null
}

/**
 * What one lead has to offer each blank, absences left out. `first_name` is
 * the one that is worked out rather than read: the doors collect a whole name
 * where they collect one, and a greeting wants the front of it.
 *
 * @param {object} lead
 * @returns {Record<string, string>}
 */
function placeholderValues(lead = {}) {
  const values = {
    name: lead.name,
    first_name: firstNameOf(lead.name),
    business: lead.business,
    trade: lead.trade,
    town: lead.town,
    website: lead.website,
    email: lead.email,
  }
  const held = {}
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string' && value.trim()) held[key] = value.trim()
  }
  return held
}

/**
 * A saved reply with one lead's facts written into its blanks.
 *
 * Only the blanks the lead can fill are filled. The rest stand as typed, so
 * the reply box shows exactly what is missing rather than a message with holes
 * papered over - and `unfilled` below is what refuses the send while they do.
 *
 * @param {string} text
 * @param {object} lead
 * @returns {string}
 */
export function fillTemplate(text, lead) {
  if (typeof text !== 'string') return ''
  const values = placeholderValues(lead)
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, key) => values[key] ?? whole)
}

/**
 * The blanks still standing in a message, each named once.
 *
 * Anything in double braces counts, not only the known set: a draft carrying a
 * blank this file has never heard of is a draft that can never be filled, and
 * the send has to refuse it by the same door.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function unfilled(text) {
  if (typeof text !== 'string') return []
  const found = text.match(/\{\{[^{}]*\}\}/g) || []
  return [...new Set(found.map(token => token.replace(/\s+/g, '')))]
}
