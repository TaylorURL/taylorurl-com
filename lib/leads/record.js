/**
 * The address left on the first step of the configurator, and everything that
 * happens to it afterwards.
 *
 * The step asks for an address before it opens the four screens behind it, so
 * every visitor who gets past the first question has told the site who they
 * are. Until this existed that answer lived in the browser's session storage
 * and nowhere else: somebody who picked a trade, chose four designs, read the
 * price and closed the tab was the warmest visitor the site gets and the one
 * it recorded nothing about. The row is what turns that into something a
 * person can act on.
 *
 * One row per address rather than one per keystroke. The configurator reports
 * the address as it is answered and again as the visitor moves through the
 * steps, so the same person arrives here several times in a sitting and comes
 * back a week later; what is worth keeping is the furthest they reached, not
 * the number of times they were seen.
 *
 * The campaign is the exception to that, and deliberately: the first tagged
 * arrival is the one that produced the lead, so a later untagged visit does
 * not overwrite the message that earned it.
 *
 * What happens next is written as times rather than as a stage. A lead can be
 * enquired and bought, or bought without ever enquiring, and a single column
 * holding a word would have to pick one of those to forget. Each fact stands
 * on its own and reading them together is the caller's business.
 */

import { connect } from '../db/clients.js'
import { tableMissing } from '../db/rows.js'

/** Where a lead lives. */
export const LEADS = 'start_leads'

/** The campaign tags a tagged arrival carries, in the spelling the columns use. */
export const CAMPAIGN_FIELDS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
]

/**
 * The moments a lead can reach, and the column each is written in.
 *
 * Named here rather than passed as column names by the endpoints, so a caller
 * cannot stamp a column that is not one of these.
 */
export const MOMENTS = {
  enquired: 'enquired_at',
  checkout: 'checkout_at',
  bought: 'bought_at',
}

/** Room for a real answer and nothing beyond it. */
const LIMITS = { email: 254, trade: 80, path: 200, tag: 200 }

/** How much of a brief is kept, and how long each half of a row may be. */
const BRIEF = { rows: 20, label: 60, value: 400 }

/** The shape an address has to take before it is worth a row. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * An address that could plausibly belong to somebody, lowercased.
 *
 * The column is citext, so the case does not decide identity; it is folded
 * here anyway because the address is also read back into a message and an
 * inbox line, and one person written two ways reads as two people.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function usableEmail(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (trimmed.length < 5 || trimmed.length > LIMITS.email) return null
  return EMAIL_PATTERN.test(trimmed) ? trimmed : null
}

/**
 * Domains that exist so they can be written about, and can never carry mail.
 *
 * example.com, example.net and example.org are reserved by RFC 2606, and the
 * .test, .invalid, .localhost and .example top-level domains by RFC 6761. No
 * mailbox has ever existed behind any of them and none ever will, so a message
 * addressed to one is not a message somebody ignored - it is a hard bounce
 * charged against the domain the newsletter and the outreach pipeline send
 * from.
 *
 * Second-level names carry their subdomains with them, which is why the test
 * below reads the whole domain rather than only its last label.
 */
const RESERVED_DOMAINS = [
  'example.com',
  'example.net',
  'example.org',
  'test',
  'invalid',
  'localhost',
  'example',
]

/**
 * Whether an address could ever reach a person.
 *
 * A stricter question than whether it is usable, and asked in a different
 * place: `usableEmail` decides whether a row is worth writing, and this decides
 * whether writing to that row would reach anybody. A test address typed into
 * the configurator is a perfectly good lead to record and a terrible one to
 * send to.
 *
 * An address that is not usable at all is not deliverable either, so the two
 * answers cannot disagree about the same string.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function deliverable(value) {
  const address = usableEmail(value)
  if (!address) return false
  const domain = address.slice(address.lastIndexOf('@') + 1)
  return !RESERVED_DOMAINS.some(name => domain === name || domain.endsWith(`.${name}`))
}

/** A trimmed single-line field, capped, or null where the column takes one. */
function line(value, limit) {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, limit)
  return trimmed || null
}

/**
 * The campaign as the page held it, read against the closed set of columns.
 *
 * Whatever else the body carried is dropped rather than stored: these values
 * are joined against outreach's own records and read in a console, and neither
 * is a place to put whatever a stranger cared to put in a URL.
 *
 * @param {unknown} held
 * @returns {Record<string, string|null>}
 */
export function campaignFrom(held) {
  const tags = {}
  for (const key of CAMPAIGN_FIELDS) {
    tags[key] = held && typeof held === 'object' ? line(held[key], LIMITS.tag) : null
  }
  return tags
}

/**
 * The configuration as the page held it, read back as rows a console can draw.
 *
 * The configurator posts what it has each time it reports, so this arrives
 * from a browser and is read as such: anything that is not a pair of strings
 * is not a row, both halves are trimmed to a length something has to render,
 * and rows past the cap are dropped rather than stored. A brief is what a
 * person reads to decide whether to write back; it is not a place for whatever
 * a stranger cared to post.
 *
 * @param {unknown} held
 * @returns {Array<{label: string, value: string}>|null} The rows, or null
 *   where there is nothing worth keeping - which is what stops a report made
 *   before anything was picked erasing the brief a later one wrote.
 */
export function briefFrom(held) {
  if (!Array.isArray(held)) return null

  const rows = []
  for (const row of held) {
    if (rows.length >= BRIEF.rows) break
    if (!row || typeof row !== 'object') continue
    const label = line(row.label, BRIEF.label)
    const value = line(row.value, BRIEF.value)
    if (label && value) rows.push({ label, value })
  }
  return rows.length ? rows : null
}

/**
 * Records one address, or brings the row it already has up to date.
 *
 * The upsert is a database function rather than a client call because the rule
 * it holds cannot be written as one: the step kept is the furthest the visitor
 * has ever reached, and a plain upsert would happily write a lower number over
 * a higher one the next time somebody opened the configurator on step one.
 *
 * A deployment whose database has not been migrated yet answers `null` rather
 * than throwing, so the endpoint in front of this degrades to recording
 * nothing instead of refusing the request. The configurator does not wait on
 * this call and a visitor must never meet an error because of it.
 *
 * @param {object} lead
 * @param {string} lead.email The address, already known to be usable.
 * @param {string} [lead.trade] The trade picked beside it.
 * @param {number} [lead.step] How far through the steps they have reached.
 * @param {string} [lead.path] The page the configurator was open at.
 * @param {object} [lead.campaign] The tags the visit arrived on.
 * @param {Array<{label: string, value: string}>} [lead.brief] What they have
 *   picked so far. The latest one that says anything is kept, because the
 *   answers only ever accumulate inside a sitting and a fuller brief is the
 *   truer one.
 * @param {object} [db] A service-role client, or null to build one.
 * @returns {Promise<{id: string, fresh: boolean}|null>} The row, and whether
 *   this call is what created it.
 */
export async function recordLead(
  { email, trade = null, step = 0, path = null, campaign = null, brief = null },
  db = connect()?.db || null
) {
  if (!db) return null

  const { data, error } = await db.rpc('start_lead_record', {
    p_email: email,
    p_trade: line(trade, LIMITS.trade),
    p_step: Number.isFinite(step) ? Math.max(0, Math.min(20, Math.trunc(step))) : 0,
    p_path: line(path, LIMITS.path),
    p_campaign: campaignFrom(campaign),
    p_brief: briefFrom(brief),
  })

  if (error) {
    // A function that is not there yet is a deployment ahead of its migration,
    // which is the one failure worth passing over in silence: the lead is lost
    // and nothing else is.
    if (!tableMissing(error) && error.code !== 'PGRST202') {
      console.error('leads: the address was not recorded: %s', error.message)
    }
    return null
  }
  if (!data?.lead_id) return null
  return { id: data.lead_id, fresh: data.fresh === true }
}

/**
 * Marks what a lead went on to do.
 *
 * Called from the endpoints that see it happen rather than worked out later by
 * joining tables, because two of the three moments leave no other trace under
 * the address: an enquiry is delivered as mail and files no name, and a
 * checkout that is opened and abandoned is a Stripe session nobody reads.
 *
 * Every failure is swallowed. This runs after the thing it records has already
 * happened, and a lead that is missing a timestamp is worth less than a buyer
 * who met an error on the way to Stripe.
 *
 * @param {string} moment One of `MOMENTS`.
 * @param {string} email The address it happened under.
 * @param {object} [db] A service-role client, or null to build one.
 * @returns {Promise<boolean>} Whether a row was stamped.
 */
export async function markLead(moment, email, db = connect()?.db || null) {
  const column = MOMENTS[moment]
  if (!db || !column) return false

  const address = usableEmail(email)
  if (!address) return false

  const { error } = await db
    .from(LEADS)
    .update({ [column]: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('email', address)
    .is(column, null)

  if (error && !tableMissing(error)) {
    console.error('leads: %s was not stamped: %s', moment, error.message)
  }
  return !error
}

/**
 * Whether an address is one this domain has been told not to write to.
 *
 * The same list the newsletter and the outreach pipeline answer to. A lead is
 * a person who typed an address into a form rather than one who asked to hear
 * from anybody, so the suppression list is the only thing standing between the
 * follow-up and somebody who has already said no once.
 *
 * A read that fails answers true. Refusing to send is the safe way to be
 * wrong.
 *
 * @param {object} db A service-role client.
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function suppressed(db, email) {
  const { data, error } = await db
    .from('suppression')
    .select('email')
    .eq('email', email)
    .maybeSingle()
  if (error) {
    if (tableMissing(error)) return false
    console.error('leads: the suppression list did not answer: %s', error.message)
    return true
  }
  return Boolean(data)
}
