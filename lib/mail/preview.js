/**
 * A message made safe to look at.
 *
 * Everything the studio sends carries three things that write something down
 * when a reader touches them: an image standing in front of a counter, a link
 * that takes an address off a list, and a campaign tag that files a visit
 * against the message that caused it. All three are the point of a message in
 * an inbox and all three are wrong in a console. A preview read at a desk that
 * moves a prospect's open count leaves the studio's own reading recorded as
 * the prospect's, and one stray click on the wrong link unsubscribes a
 * business that never asked to go.
 *
 * So a message on its way to a screen, or to the account's own inbox, comes
 * through here first. The picture stays, because the picture is most of what
 * there is to check. What goes is its ability to say it was seen.
 *
 * Nothing here rewrites what a message says. A preview that reads differently
 * from the message it stands for is not a preview of it.
 */

// The counter an outreach message's capture is served behind, and the two ways
// off a list. Matched on the path rather than the origin, so a message rendered
// against a preview build is disarmed the same as one rendered against the
// live site.
const OPEN_PATH = '/api/outreach/open'
const UNSUBSCRIBE_PATHS = ['/api/outreach/unsubscribe', '/api/lead-unsubscribe', '/unsubscribe']

// What stands in for a capture that has none of its own. A message to a
// business with no site of its own carries a single transparent pixel where
// the picture would be, and that pixel has nothing behind it worth drawing.
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** Every attribute value in the document, handed to a rewriter one at a time. */
function rewriteAttribute(html, attribute, rewrite) {
  const pattern = new RegExp(`(\\s${attribute}=)(["'])(.*?)\\2`, 'gi')
  return html.replace(pattern, (whole, lead, quote, value) => {
    const next = rewrite(value)
    return next === null ? whole : `${lead}${quote}${next}${quote}`
  })
}

/** Whether an address points at one of the paths that records something. */
function hits(value, paths) {
  const at = value.indexOf('?')
  const path = at === -1 ? value : value.slice(0, at)
  return paths.some(one => path.endsWith(one))
}

/**
 * The campaign parameters off a link, leaving the page it opens.
 *
 * A start link carries the message's own token, which is how an enquiry is
 * attributed to the message that caused it. Followed from a console it would
 * attribute the studio's own visit to a stranger's message.
 *
 * The separator is matched in both of its spellings. Inside an HTML attribute
 * the ampersands are written as entities, and splitting on the bare character
 * leaves every parameter after the first carrying `amp;` on the front of its
 * name - which is a name that does not begin with `utm_`, and so a campaign
 * that survives being stripped.
 */
function withoutCampaign(value) {
  const at = value.indexOf('?')
  if (at === -1) return value
  const query = value.slice(at + 1)
  const entities = query.includes('&amp;')
  const kept = query.split(/&amp;|&/).filter(pair => !/^utm_/.test(pair))
  if (!kept.length) return value.slice(0, at)
  return `${value.slice(0, at)}?${kept.join(entities ? '&amp;' : '&')}`
}

/**
 * One rendered message, with everything that writes taken out of it.
 *
 * @param {string} html The message as it was sent, or as it would be.
 * @param {{capture?: string|null}} [options] The picture the counter stands in
 *   front of, where the message has one. Without it the frame draws blank
 *   rather than reaching the counter to find out.
 * @returns {string} The same message, inert.
 */
export function inertHtml(html, { capture = null } = {}) {
  if (typeof html !== 'string' || !html) return ''
  let out = rewriteAttribute(html, 'src', value =>
    hits(value, [OPEN_PATH]) ? capture || BLANK : null
  )
  out = rewriteAttribute(out, 'href', value => {
    if (hits(value, UNSUBSCRIBE_PATHS)) return '#'
    return /(^|[?&;])utm_/.test(value) ? withoutCampaign(value) : null
  })
  return out
}

/**
 * The plain half, disarmed the same way.
 *
 * A text part is read as often as the laid-out one and its links are followed
 * from the same desk, so leaving it armed would leave the whole message armed
 * through its other half.
 */
export function inertText(text) {
  if (typeof text !== 'string' || !text) return ''
  return text
    .split(/(\s+)/)
    .map(piece => {
      if (!/^https?:\/\//i.test(piece)) return piece
      if (hits(piece, UNSUBSCRIBE_PATHS)) return '[unsubscribe link, disarmed for preview]'
      if (hits(piece, [OPEN_PATH])) return '[open counter, disarmed for preview]'
      return /(^|[?&;])utm_/.test(piece) ? withoutCampaign(piece) : piece
    })
    .join('')
}
