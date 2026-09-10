/**
 * Everybody who has ever raised a hand, whichever door they came through.
 *
 * The studio takes leads nine ways and each door used to keep its own record
 * or none at all: the configurator wrote `start_leads`, the speed check wrote
 * a reading, the contact form wrote the campaign tags and sent the person to
 * an inbox, the ads wrote a spreadsheet, a call wrote a note. So the console
 * could show two doors' worth and everything else was worked out of mail.
 *
 * This is the layer in front of the one table that holds all of them. Each
 * door keeps its own detailed record, because a configurator brief and a call
 * note are not the same thing and flattening them would lose both. What comes
 * here is the person and how to reach them.
 *
 * Nothing in here throws. Every caller is an endpoint that has already done
 * the thing it is recording - the message is sent, the reading is taken, the
 * card is charged - and a lead that failed to be written is a figure, while a
 * visitor meeting an error because of one is the sale.
 */

import { connect } from '../db/clients.js'
import { tableMissing } from '../db/rows.js'
import { briefFrom, campaignFrom, usableEmail } from './record.js'

/** Where a lead lives once every door agrees on one place. */
export const SPINE = 'leads'

/**
 * The doors, in the spelling the column's own check constraint uses.
 *
 * Named here so a caller cannot invent a source the table will refuse. A new
 * door is two edits - this list and the constraint - and being made to do both
 * is the point: an unlisted source is a lead nobody's filter will ever show.
 */
export const SOURCES = Object.freeze({
  configurator: 'configurator',
  payment: 'payment',
  contact: 'contact',
  tools: 'tools',
  speedCheck: 'speed-check',
  ad: 'ad',
  outreachReply: 'outreach-reply',
  call: 'call',
})

/** The moments a lead can reach, and the column each is written in. */
export const MOMENTS = Object.freeze({
  contacted: 'contacted_at',
  replied: 'replied_at',
  enquired: 'enquired_at',
  checkout: 'checkout_at',
  bought: 'bought_at',
  unsubscribed: 'unsubscribed_at',
})

/**
 * The domains the studio itself sends and tests from.
 *
 * Somebody typing their own address into their own form is testing it, and a
 * console whose lead list is mostly the person reading it is a list that stops
 * being read. Both domains are here because the outreach pipeline sends from
 * the second one, so a reply that loops back arrives looking like a stranger.
 */
const OWN_DOMAINS = ['taylorurl.com', 'baytownwebdevelopment.com']

/** Room for a real answer and nothing beyond it. */
const LIMITS = { line: 200, note: 2000, ref: 200 }

/**
 * Whether an address belongs to the studio rather than to a lead.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function ownAddress(value) {
  const address = usableEmail(value)
  if (!address) return false
  const domain = address.slice(address.lastIndexOf('@') + 1)
  return OWN_DOMAINS.some(name => domain === name || domain.endsWith(`.${name}`))
}

/** A trimmed single-line field, capped, or null where there is nothing in it. */
function line(value, limit = LIMITS.line) {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, limit)
  return trimmed || null
}

/** A field that is allowed to have paragraphs in it, capped. */
function block(value, limit = LIMITS.note) {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/\r\n/g, '\n').trim().slice(0, limit)
  return trimmed || null
}

/**
 * The campaign tags a visit carried, with the ones it did not carry left out.
 *
 * `campaignFrom` answers with every tag it knows about and a null against each
 * one that was absent, which is the right shape for five columns and the wrong
 * one for a single jsonb field: stored as it comes, an untagged visit is five
 * nulls that read as a campaign until somebody opens it.
 *
 * @param {unknown} held
 * @returns {object|null}
 */
function tagsFrom(held) {
  const tags = campaignFrom(held)
  const kept = Object.fromEntries(Object.entries(tags).filter(([, value]) => value))
  return Object.keys(kept).length ? kept : null
}

/**
 * The last ten digits of whatever was typed, which is what makes
 * +18327755485 and (832) 775-5485 the same person.
 *
 * The database computes this for itself on the way in. It is repeated here
 * because the stamping calls have to find a row by number without one, and two
 * different answers to "which digits" would be two different people.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function phoneDigits(value) {
  if (typeof value !== 'string') return null
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 ? digits.slice(-10) : null
}

/**
 * Records a lead, or brings the row that person already has up to date.
 *
 * The merge is a database function rather than a client upsert because it
 * holds rules a plain upsert cannot: the door stays the first one, the
 * campaign stays the first tagged arrival, and a door with nothing to say
 * about a field leaves what another door already wrote standing.
 *
 * A lead with neither an address nor a number is refused by the function
 * rather than written, because a lead nobody can reach is not one.
 *
 * @param {object} lead
 * @param {string} lead.source One of `SOURCES`.
 * @param {string} [lead.ref] The row this came from in the door's own record.
 * @param {string} [lead.email]
 * @param {string} [lead.name]
 * @param {string} [lead.phone]
 * @param {string} [lead.business]
 * @param {string} [lead.trade]
 * @param {string} [lead.website]
 * @param {string} [lead.town]
 * @param {string} [lead.note] What they said, in their own words.
 * @param {Array<{label: string, value: string}>} [lead.brief]
 * @param {object} [lead.campaign] The tags the visit arrived on.
 * @param {string} [lead.path]
 * @param {number} [lead.step] How far through the configurator they reached.
 *   Only the two doors that have screens send one; for the rest it is absent
 *   rather than zero, because a phone call has no screen somebody got to.
 * @param {object} [db] A service-role client, or null to build one.
 * @returns {Promise<{id: string, fresh: boolean}|null>} The row, and whether
 *   this call is what created it.
 */
export async function keepLead(
  {
    source,
    ref = null,
    email = null,
    name = null,
    phone = null,
    business = null,
    trade = null,
    website = null,
    town = null,
    note = null,
    brief = null,
    campaign = null,
    path = null,
    step = null,
  },
  db = connect()?.db || null
) {
  // A door the table would refuse is caught here rather than by the check
  // constraint, so an unlisted source costs one lead instead of an error in a
  // log nobody reads.
  if (!db || !Object.values(SOURCES).includes(source)) return null

  const address = usableEmail(email)
  // The studio's own address is a person testing their own form. The row is
  // skipped rather than written and dismissed later, because a lead that has
  // to be cleared by hand every time somebody checks a page is worse than no
  // lead at all.
  if (address && ownAddress(address)) return null

  const { data, error } = await db.rpc('lead_record', {
    p_source: source,
    p_source_ref: line(ref, LIMITS.ref),
    p_email: address,
    p_name: line(name),
    p_phone: line(phone),
    p_business: line(business),
    p_trade: line(trade),
    p_website: line(website),
    p_town: line(town),
    p_note: block(note),
    // Both arrive from a browser and are read back against a closed shape
    // rather than stored as posted. A brief is a dozen short answers somebody
    // reads before writing back, and a campaign is joined against outreach's
    // own records; neither is a place for whatever a stranger cared to send.
    p_brief: briefFrom(brief),
    p_campaign: tagsFrom(campaign),
    p_path: line(path),
    // Bounded to a screen that could exist, so a posted number cannot put a
    // lead on a step no page ever drew.
    p_step: Number.isFinite(step) ? Math.max(0, Math.min(20, Math.trunc(step))) : null,
  })

  if (error) {
    // A function that is not there yet is a deployment ahead of its migration,
    // which is the one failure worth passing over: the lead is lost and
    // nothing else is.
    if (!tableMissing(error) && error.code !== 'PGRST202') {
      console.error('leads: the lead was not kept: %s', error.message)
    }
    return null
  }
  if (!data?.lead_id) return null
  return { id: data.lead_id, fresh: data.fresh === true }
}

/**
 * Marks what a lead went on to do.
 *
 * Stamped by whichever endpoint watches it happen rather than worked out later
 * by joining tables, because most of these moments leave no other trace under
 * the person: an enquiry is delivered as mail and files no name, and a
 * checkout somebody opened and abandoned is a Stripe session nobody reads.
 *
 * Only the first time counts. A moment already stamped is left alone, so a
 * second checkout does not rewrite the day somebody first reached one.
 *
 * @param {string} moment One of `MOMENTS`.
 * @param {{email?: string, phone?: string}} who
 * @param {object} [db] A service-role client, or null to build one.
 * @returns {Promise<boolean>} Whether a row was stamped.
 */
export async function markLead(moment, who, db = connect()?.db || null) {
  const column = MOMENTS[moment]
  if (!db || !column) return false

  const address = usableEmail(who?.email)
  const digits = phoneDigits(who?.phone)
  if (!address && !digits) return false

  const now = new Date().toISOString()
  let query = db
    .from(SPINE)
    .update({ [column]: now, last_seen: now, updated_at: now })
    .is(column, null)
  query = address ? query.eq('email', address) : query.eq('phone_digits', digits)

  const { error } = await query
  if (error && !tableMissing(error)) {
    console.error('leads: %s was not stamped: %s', moment, error.message)
  }
  return !error
}
