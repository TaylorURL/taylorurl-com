/**
 * The address a lead is answered at, which is the site's own.
 *
 * Every notice about a lead carried the lead's address on Reply-To, so
 * pressing Reply in the inbox wrote straight to them - and told the record
 * nothing. A lead answered from Outlook stayed Waiting on the console until
 * somebody remembered to say otherwise, and the console's own send button was
 * the only way to answer that the record could see.
 *
 * So the Reply-To now names the site. Each lead gets an address of the shape
 * `lead.<id>@reply.taylorurl.com`, shown under the lead's own name so the To
 * line of a reply still reads as the person. Whatever mailbox the reply
 * leaves from, it arrives at api/lead-reply.js, which files it under the
 * lead, marks them answered, and passes the message on to them from the
 * studio's own domain. Nobody changes how they reply and no mailbox needs
 * wiring; the address does the wiring.
 *
 * The body of the notice still prints the lead's real address, because that
 * line is for a person reading the message, and the person is who they are
 * about to write to.
 */

import { UUID_PATTERN } from '../db/fields.js'
import { usableEmail } from './record.js'

/** The domain whose mail Resend hands to api/lead-reply.js. */
export const RELAY_DOMAIN = (process.env.LEAD_REPLY_DOMAIN || 'reply.taylorurl.com').toLowerCase()

/**
 * The domains Resend can send as. A reply from a mailbox on one of these
 * leaves for the lead under the writer's own address; a reply from anywhere
 * else leaves under the studio's, with the writer on Reply-To, because a From
 * the sending domain cannot sign is a message that lands in spam.
 */
export const SENDING_DOMAINS = Object.freeze(['taylorurl.com'])
/** Who a relayed reply leaves as when the writer's own domain cannot sign it. */
export const RELAY_SENDER = 'website@taylorurl.com'

const LOCAL_PREFIX = 'lead.'
/** Room for a name on an address line, and no room for a paragraph. */
const NAME_LIMIT = 60

/**
 * A display name safe to put in front of an address: nothing that could close
 * the quotes or open a bracket, and nothing that could start a new header.
 */
function displayName(value) {
  if (typeof value !== 'string') return null
  const clean = value
    .replace(/[\r\n\t"\\<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_LIMIT)
  return clean ? `"${clean}"` : null
}

/**
 * The relay address for one lead, or null for something that is not one.
 *
 * @param {{id?: string, name?: string}} lead
 * @returns {string|null} `"Name" <lead.<id>@reply.taylorurl.com>`.
 */
export function relayAddress(lead) {
  const id =
    typeof lead?.id === 'string' && UUID_PATTERN.test(lead.id) ? lead.id.toLowerCase() : null
  if (!id) return null
  const address = `${LOCAL_PREFIX}${id}@${RELAY_DOMAIN}`
  const name = displayName(lead.name)
  return name ? `${name} <${address}>` : address
}

/**
 * What a notice about a lead carries on Reply-To: the relay where the lead
 * has a row, and the lead's own address where the row was not written, so a
 * database refusing writes costs the record and never the reply.
 *
 * @param {{id?: string, name?: string}|null} lead
 * @param {unknown} fallback The lead's own address.
 * @returns {string|undefined}
 */
export function replyAddressFor(lead, fallback) {
  return relayAddress(lead) || usableEmail(fallback) || undefined
}

/**
 * The lead an inbound message is for, read off its recipients.
 *
 * @param {unknown[]} addresses Every address the message reached.
 * @returns {string|null} The lead's id.
 */
export function leadIdFrom(addresses) {
  if (!Array.isArray(addresses)) return null
  for (const value of addresses) {
    const address = usableEmail(value)
    if (!address) continue
    const at = address.lastIndexOf('@')
    if (address.slice(at + 1) !== RELAY_DOMAIN) continue
    const local = address.slice(0, at)
    if (!local.startsWith(LOCAL_PREFIX)) continue
    const id = local.slice(LOCAL_PREFIX.length)
    if (UUID_PATTERN.test(id)) return id
  }
  return null
}

/**
 * The name on a message's From line, or null where it carried only an address.
 *
 * Resend hands the headers over as they were on the wire, either as a list of
 * `{name, value}` pairs or keyed by name, and both shapes are read here so a
 * change on their side costs a name rather than the reply.
 *
 * @param {unknown} headers
 * @returns {string|null}
 */
export function senderNameFrom(headers) {
  let value = null
  if (Array.isArray(headers)) {
    const found = headers.find(entry => String(entry?.name || '').toLowerCase() === 'from')
    value = found?.value ?? null
  } else if (headers && typeof headers === 'object') {
    value = headers.from ?? headers.From ?? null
  }
  if (typeof value !== 'string') return null
  const match = value.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/)
  const name = match ? match[1].trim() : ''
  return name || null
}

/**
 * Who a relayed reply leaves as.
 *
 * @param {string} sender The address the reply was written from.
 * @param {string|null} name The name on its From line.
 * @returns {string}
 */
export function forwardFrom(sender, name) {
  const domain = sender.slice(sender.lastIndexOf('@') + 1)
  const address = SENDING_DOMAINS.some(own => domain === own || domain.endsWith(`.${own}`))
    ? sender
    : RELAY_SENDER
  const shown = displayName(name) || displayName(sender.slice(0, sender.indexOf('@')))
  return shown ? `${shown} <${address}>` : address
}
