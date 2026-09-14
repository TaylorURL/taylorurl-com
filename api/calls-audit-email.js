/**
 * Sends one business its own audit, at the request of the caller on the phone
 * with them.
 *
 * The call screen reads the audit off the row and a caller reads it out. An
 * owner who agrees to see it in writing is the only reader this endpoint has:
 * nothing here goes out on a schedule, nothing here picks who to write to, and
 * one press of the button is one message to one address somebody just said out
 * loud.
 *
 * That is the whole reason it is a door rather than a job. A caller types an
 * address they heard over a phone line, so the address is checked the same way
 * the outreach pipeline checks a scraped one - the shape, the mailbox, the
 * domain's mail servers, the suppression list and the held domains - before a
 * message is built, because a typo repeated down the day is a run of hard
 * bounces charged against the sending domain the newsletter and the client mail
 * both leave from.
 *
 * The claim is the part worth reading twice. A caller who presses the button
 * again, a console that retried a request the network dropped, and two callers
 * who both have the business open are all the same failure: a business getting
 * the same audit twice from a studio that is trying to look like it pays
 * attention. So the row is claimed before the transport is reached, in one
 * conditional update that only takes a row nobody has claimed in the last day,
 * and a request that does not get the row sends nothing. A send that then fails
 * gives the claim back, so a mail server having a bad minute costs a message
 * rather than the business's only copy of its own report.
 *
 * Two ceilings, both on the caller. The in-memory window is the cheap refusal
 * that costs no query, and it holds for the length of one function instance. The
 * one that actually binds is counted in the database over the rows this caller
 * has claimed today, because a scaled-out deployment holds one window per
 * instance and a day's ceiling has to mean the same thing on all of them.
 *
 * What it reads: RESEND_API_KEY, and AUDIT_FROM for the sending identity. With
 * no key it refuses before claiming anything, which is the state a preview
 * build runs in.
 *
 * What it writes: `audit_emailed_at`, `audit_emailed_by` and `audit_emailed_to`
 * on the prospect, and the address itself where the row did not have it or had
 * a different one, since a caller who heard it from the owner has the better
 * copy of it than the enricher does.
 *
 * The pieces the check drives are exported: the refusal a row earns on its own,
 * the claim, and the whole path behind the door. The door itself is four gates
 * and a role, and every one of them is somebody else's tested code.
 */

import { bearerOr401, methodsOr405, servedHereOr404 } from '../lib/http/guard.js'
import { readBody } from '../lib/http/body.js'
import { callerWindow } from '../lib/http/rate.js'
import { authorizeCaller, connect } from '../lib/db/clients.js'
import { countOf, tableMissing } from '../lib/db/rows.js'
import { uuid } from '../lib/db/fields.js'
import { SITE } from '../lib/site/current.js'
import { auditEmail } from '../lib/mail/audit.js'
import { sendNotice } from '../lib/mail/notice.js'
import { AUDIT_COLUMNS, measured } from '../lib/outreach/audit/reading.js'
import { checkAddress, normalise, shapeOf } from '../lib/outreach/prospects/address.js'
import { heldDomainsLoaded, loadHeldDomains } from '../lib/outreach/prospects/exclusions.js'
import { suppressed } from '../lib/outreach/sending/queue.js'
import { STUDIO_INBOX } from '../lib/outreach/message.js'

const PROSPECTS = 'outreach_prospects'
const PROFILES = 'profiles'

/** Where the audit email leaves from, and where a reply goes by default. */
const AUDIT_FROM = process.env.AUDIT_FROM || 'TaylorURL <audits@taylorurl.com>'

/** What the studio's own people answer on, which is who may be a Reply-To. */
const STUDIO_DOMAIN = '@taylorurl.com'

/** What the row records as the origin of an address a caller was given. */
const CALL_SOURCE = 'call'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * How long one business is held after its audit goes out.
 *
 * A day rather than forever, because a reading taken again is a different
 * report and an owner who lost the first message is entitled to it. What it
 * stops is the same report arriving twice in one afternoon, which is the only
 * repeat that reads as carelessness.
 */
const REPEAT_MS = DAY_MS

/**
 * The cheap refusal in front of the counted one. It costs no query and holds
 * for the length of one instance, which is enough to stop a console stuck in a
 * retry loop from reaching the database at all.
 */
const BURST = callerWindow({ limit: 30, windowMs: 10 * 60 * 1000 })

/**
 * What one caller may send in a day, counted in the database.
 *
 * The figure is well above a working day of calls. It is not a quota, it is the
 * ceiling that says something has gone wrong: an account sending sixty audits
 * between one midnight and the next is not a person on a phone.
 */
const DAY_CEILING = 60

/** What is said when the row itself will not read. */
const NOT_READ = 'That business could not be read. Try again in a moment.'

/** And when the send was made and the record of it will not save. */
const NOT_SAVED = 'That could not be saved. Try again in a moment.'

/**
 * Why an address was refused on its shape, said for the person who typed it.
 *
 * Each reason has a different answer on a call: one is a typo to read back, one
 * is the wrong mailbox to ask for, and one is a business the studio may not
 * write to at all. A single sentence covering all three would leave the caller
 * guessing which.
 */
const SHAPE_SAID = {
  malformed: 'That is not an address a mail server would take. Read it back to them and try again.',
  role_box: 'Nobody reads that mailbox. Ask for an address that reaches a person.',
  disposable: 'That is a throwaway mailbox, so nothing sent to it gets read.',
  platform: 'That address belongs to a platform rather than to the business. Ask for their own.',
  held_domain: 'That business has asked us not to write to them, so nothing can be sent.',
}

/** Why a domain cannot receive mail at all, in the two ways DNS says so. */
const DOMAIN_SAID = {
  no_domain: 'That domain does not exist, so mail to it bounces. Check the spelling with them.',
  no_mx: 'That domain has no mail server, so mail to it bounces. Ask for another address.',
}

/**
 * What a driver said, turned into an answer a console can print.
 *
 * A missing table is named outright, because the repair is a migration and
 * nobody guesses that from a general sentence. Everything else names columns,
 * constraints and policies, so it goes to the log where it is useful and `said`
 * comes back instead.
 */
function refusal(error, said) {
  if (tableMissing(error)) {
    return { status: 503, body: { error: 'The call desk tables are not in this database yet.' } }
  }
  console.error('calls-audit-email: %s', error?.message || error)
  return { status: 500, body: { error: said } }
}

/** The columns a message and its refusals are decided from. */
const SELECT = [
  'id',
  'name',
  'trade',
  'town',
  'website',
  'site_kind',
  'stage',
  'email',
  'audit_emailed_at',
  'audit_emailed_by',
  'audit_emailed_to',
  ...AUDIT_COLUMNS,
].join(', ')

/**
 * Whether this row may be sent its audit at all, and why not where it may not.
 *
 * Three refusals, and each of them is about the row rather than about the
 * request. A business that asked for no further contact and one a person
 * deliberately skipped are both somebody's decision, and neither is undone by a
 * caller who did not know about it. A row with no reading has nothing to send:
 * the call list is mostly businesses with no site of their own, so this is the
 * ordinary case rather than the odd one.
 *
 * The fourth is the one the console draws a sentence from. A business already
 * sent its audit today carries who sent it and where, so the screen can say the
 * name rather than refusing with nothing behind it.
 *
 * @param {object} row The prospect, as `SELECT` reads it.
 * @param {Date} now
 * @returns {{status: number, body: object}|null} Null where it may be sent.
 */
export function refusalFor(row, now) {
  if (row.stage === 'unsubscribed') {
    return {
      status: 409,
      body: { error: 'They asked for no further contact, so nothing can be sent.' },
    }
  }
  if (row.stage === 'skipped') {
    return {
      status: 409,
      body: { error: 'This business was skipped, so nothing can be sent to it.' },
    }
  }
  if (!measured(row)) {
    return {
      status: 409,
      body: {
        error: 'There is no audit on file for this business, so there is nothing to send.',
      },
    }
  }

  const sent = row.audit_emailed_at ? new Date(row.audit_emailed_at).getTime() : 0
  if (sent && now.getTime() - sent < REPEAT_MS) {
    return {
      status: 409,
      body: {
        error: 'This business was already sent its audit today.',
        audit_emailed_at: row.audit_emailed_at,
        audit_emailed_by: row.audit_emailed_by,
        audit_emailed_to: row.audit_emailed_to,
      },
    }
  }
  return null
}

/**
 * Takes the row, so that this request is the one that sends.
 *
 * One statement, and the condition is the whole of the guarantee: the update
 * only matches a row that has never been sent its audit or was last sent one
 * more than a day ago, so two requests that read the same row a millisecond
 * apart both pass `refusalFor` and only one of them comes back holding
 * anything. The other sends nothing and says so.
 *
 * The address is written onto the row in the same statement where the row did
 * not have it or had a different one. A caller who heard it from the owner has
 * the better copy than the enricher does, and writing it separately would leave
 * a row claimed for an address it does not carry.
 *
 * @param {object} db A service-role client.
 * @param {object} claim
 * @param {string} claim.id The prospect.
 * @param {string} claim.email The address, normalised.
 * @param {string} claim.userId Who is sending it.
 * @param {object} claim.row The row as it was read.
 * @param {Date} claim.now
 * @returns {Promise<boolean>} Whether this request got the row.
 */
export async function claimAudit(db, { id, email, userId, row, now }) {
  const stale = new Date(now.getTime() - REPEAT_MS).toISOString()
  const patch = {
    audit_emailed_at: now.toISOString(),
    audit_emailed_by: userId,
    audit_emailed_to: email,
  }
  if (normalise(row?.email) !== email) {
    patch.email = email
    patch.email_source = CALL_SOURCE
  }

  const { data, error } = await db
    .from(PROSPECTS)
    .update(patch)
    .eq('id', id)
    .or(`audit_emailed_at.is.null,audit_emailed_at.lt.${stale}`)
    .select('id')
  if (error) throw error
  return Boolean(data?.length)
}

/**
 * Gives the claim back, with the row as it stood before this request took it.
 *
 * A send that failed has to leave the row sendable, or a mail server having a
 * bad minute costs the business its only copy of its own report. It is written
 * back to exactly what was read rather than to null, because a second send a
 * week after the first is a row that already carries a date and has to keep it.
 */
async function releaseClaim(db, id, row) {
  const { error } = await db
    .from(PROSPECTS)
    .update({
      audit_emailed_at: row.audit_emailed_at ?? null,
      audit_emailed_by: row.audit_emailed_by ?? null,
      audit_emailed_to: row.audit_emailed_to ?? null,
    })
    .eq('id', id)
  if (error) console.error('calls-audit-email: the claim would not release: %s', error.message)
}

/** The caller's name, for the sentence the console draws under the button. */
async function namedCaller(db, userId) {
  const { data, error } = await db.from(PROFILES).select('full_name').eq('id', userId).maybeSingle()
  // A name that would not read costs the sentence a word and nothing else. The
  // message has already gone by the time this runs.
  if (error) {
    console.error('calls-audit-email: the caller could not be named: %s', error.message)
    return null
  }
  return data?.full_name ?? null
}

/** Where an answer to the audit goes. */
function replyAddress(account) {
  const address = normalise(account?.email)
  return address.endsWith(STUDIO_DOMAIN) ? address : STUDIO_INBOX
}

/**
 * The whole path behind the door: what may be sent, the claim, the message.
 *
 * Every refusal is a sentence a caller can read off the screen and act on with
 * the owner still on the line, because that is the only moment any of this is
 * fixable.
 *
 * @param {object} asked
 * @param {object} asked.db A service-role client.
 * @param {{userId: string, email: string, role: string}} asked.account Who is
 *   asking, as the caller door verified them.
 * @param {object} asked.body What the console posted.
 * @param {Date} [asked.now]
 * @param {Function} [asked.transport] What hands the message over. The default
 *   is Resend; a check passes a recorder.
 * @param {string} [asked.key] The Resend key.
 * @returns {Promise<{status: number, body: object, headers?: object}>}
 */
export async function send({
  db,
  account,
  body,
  now = new Date(),
  transport = sendNotice,
  key = process.env.RESEND_API_KEY || '',
}) {
  const id = uuid(body?.id)
  if (!id) return { status: 400, body: { error: 'Pick the business the audit is for.' } }

  const email = normalise(body?.email)
  if (!email) return { status: 400, body: { error: 'Type the address the audit goes to.' } }

  // Asked before the row is read, so a deployment that cannot send never claims
  // a business it is about to fail to write to.
  if (!key) return { status: 503, body: { error: 'Mail is not configured here.' } }

  if (!BURST.allows(account.userId, now.getTime())) {
    return {
      status: 429,
      headers: { 'Retry-After': String(BURST.windowMs / 1000) },
      body: { error: 'That is a lot of audits in a few minutes. Give it ten and try again.' },
    }
  }

  // The shape rules refuse to judge an address until the held list is in hand,
  // and they throw rather than guess when it is not.
  if (!heldDomainsLoaded() && !(await loadHeldDomains(db))) {
    return { status: 503, body: { error: NOT_READ } }
  }

  const shape = shapeOf(email)
  if (shape) {
    return {
      status: 400,
      body: { error: SHAPE_SAID[shape.reason] ?? 'That address cannot be written to.' },
    }
  }

  let row
  try {
    const read = await db.from(PROSPECTS).select(SELECT).eq('id', id).maybeSingle()
    if (read.error) throw read.error
    row = read.data
  } catch (cause) {
    return refusal(cause, NOT_READ)
  }
  if (!row) return { status: 404, body: { error: 'That business is not on the call list.' } }

  const refused = refusalFor(row, now)
  if (refused) return refused

  try {
    const held = await suppressed(db, [email])
    if (held.has(email)) {
      return {
        status: 409,
        body: { error: 'That address has asked for no more mail, so nothing can be sent to it.' },
      }
    }
  } catch (cause) {
    return refusal(cause, NOT_READ)
  }

  // A resolver having a bad afternoon is not a fact about the address, so an
  // unsettled reading is let through and the transport decides. Only a domain
  // that has said outright it takes no mail is refused here.
  const deliverable = await checkAddress(db, email)
  if (deliverable.verdict === 'undeliverable') {
    return {
      status: 422,
      body: {
        error: DOMAIN_SAID[deliverable.reason] ?? 'That address cannot receive mail.',
      },
    }
  }

  try {
    const today = await countOf(
      db
        .from(PROSPECTS)
        .select('id', { count: 'exact', head: true })
        .eq('audit_emailed_by', account.userId)
        .gte('audit_emailed_at', new Date(now.getTime() - DAY_MS).toISOString())
    )
    if (today >= DAY_CEILING) {
      return {
        status: 429,
        headers: { 'Retry-After': String(DAY_MS / 1000) },
        body: { error: 'That is every audit this account can send today.' },
      }
    }
  } catch (cause) {
    return refusal(cause, NOT_READ)
  }

  let claimed
  try {
    claimed = await claimAudit(db, { id, email, userId: account.userId, row, now })
  } catch (cause) {
    return refusal(cause, NOT_SAVED)
  }
  if (!claimed) {
    return {
      status: 409,
      body: { error: 'Somebody else sent this business its audit a moment ago.' },
    }
  }

  // No unsubscribe link and no one-click header. This is not a list: the owner
  // asked for the report on the phone an hour ago and one copy goes to them.
  // What the message honours instead is the stop already on record, above,
  // which is refused before anything is drawn.
  const drawn = auditEmail({ prospect: row, startUrl: `${SITE.origin}/start`, now })

  try {
    await transport({ ...drawn, replyTo: replyAddress(account) }, key, {
      from: AUDIT_FROM,
      to: [email],
      // The urgent headers mark a message somebody in the studio is waiting
      // on. This one is read by a stranger, and a message that arrives
      // shouting is a message that reads as bulk mail.
      urgent: false,
    })
  } catch (cause) {
    console.error('calls-audit-email: handing over: %s', cause?.message || cause)
    await releaseClaim(db, id, row)
    return {
      status: 502,
      body: { error: 'The mail server would not take it. Nothing was sent, so try again.' },
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      audit_emailed_at: now.toISOString(),
      audit_emailed_by: account.userId,
      audit_emailed_to: email,
      audit_emailed_by_name: await namedCaller(db, account.userId),
    },
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const authorization = bearerOr401(request, response)
  if (!authorization) return
  if (!methodsOr405(request, response, ['POST'])) return

  const wired = connect()
  if (!wired) return response.status(503).json({ error: 'The database is not configured here.' })

  response.setHeader('Cache-Control', 'private, no-store')

  try {
    const account = await authorizeCaller(wired, authorization)
    if (account.status) return response.status(account.status).json({ error: account.error })

    const answer = await send({
      db: wired.db,
      account,
      body: readBody(request),
      now: new Date(),
    })
    for (const [name, value] of Object.entries(answer.headers ?? {})) {
      response.setHeader(name, value)
    }
    return response.status(answer.status).json(answer.body)
  } catch (cause) {
    console.error('calls-audit-email: %s', cause.message)
    return response.status(502).json({ error: 'The audit email endpoint did not answer.' })
  }
}
