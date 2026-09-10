/**
 * Writes the outreach message, and sends it only when both switches are open.
 *
 * What it does: picks prospects at stage 'audited' that carry an address, have
 * never been contacted and are not suppressed, composes one message for each
 * in both a laid-out and a plain form, and records it. Whether that message is
 * then handed to a mail server depends on two switches that are separate on
 * purpose: sending_enabled in `outreach_settings`, which the console turns,
 * and OUTREACH_SEND_ARMED on the deployment, which a person sets by hand. Both
 * are off unless set, and while either one is off the run does everything
 * except reach the transport, leaving both halves on the row as a draft to be
 * read.
 *
 * There is one message and every business gets it. It is an introduction: who
 * is writing, what they do, where they do it, a promise that nothing else is
 * coming, and the studio's own signature under it. It makes no claim about the
 * reader's own site, quotes no reading and carries no capture, so nothing
 * about a business has to be known before it can be written to.
 *
 * That is why the queue is as wide as it is. A business with no site of its
 * own, one whose site scored ninety-six, and one nothing has managed to
 * measure all read the same letter, and lib/outreach/sending/queue.js takes every one
 * of them that carries an address.
 *
 * Ordering is still by audit score, worst first, because a business with a
 * slow site is the likeliest of them to want a new one even though the letter
 * does not say so. A business with no site of its own goes ahead of all of
 * them, and one nothing has measured goes behind. A prospect whose draft has
 * already been written waits at the front of that order once sending opens, so
 * what goes out is the message that was reviewed rather than a fresh
 * composition of it.
 *
 * The openers live under lib/outreach/openers/, one file each, and
 * lib/outreach/variants.js is the registry. One letter is live there, once for
 * each segment, and everything else is paused: those letters wrote every
 * message this pipeline sent before, and their ids are stored on those rows.
 * `pickVariant` settles which entry a business is written under, a business
 * keeps the one it was first given, and every message carries the id it was
 * written under. `compose` assembles the chrome around the opener, and
 * lib/outreach/message.js renders the result twice.
 *
 * A prospect at 'queued' was claimed by a run that reached the transport and
 * never came back. Where its message came back 'sent' the delivery landed and
 * only the stage write was lost, so the row is repaired to 'contacted'. Where
 * the message is still a draft and old enough that no live invocation could
 * hold it, the claim is released and the same drafted text goes out. Neither
 * recovery needs a statement written by hand.
 *
 * Every message carries a one-click way off the list: the prospect's own
 * unsub_token, in the footer of both halves and in the RFC 8058 headers, all
 * pointing at api/outreach/unsubscribe. The reply route in watch.js is the
 * safety net beside it rather than the only door.
 *
 * Every address is verified before a message is written for it and again in
 * front of the transport, against lib/outreach/prospects/address.js. A prospect whose
 * address cannot receive mail moves to 'undeliverable' carrying the reason and
 * stays in the table, so the console says why a business was never written to
 * and a later run can take the reading again. A prospect whose reading could
 * not be settled at all keeps its place in the queue.
 *
 * What it reads: OUTREACH_SMTP_USER and OUTREACH_SMTP_PASSWORD, the host and
 * port beside them, the sender's phone number, OUTREACH_SITE_URL,
 * OUTREACH_SEND_ARMED, and daily_cap, sending_enabled,
 * from_name and from_address out of `outreach_settings`. The cap is the day's
 * rather than the run's, and the schedule spreads it across the window, so a
 * run takes the part of it that is due and stops at what one invocation can
 * deliver.
 *
 * What it writes: an `outreach_messages` row per prospect, always before the
 * transport is reached, so a crash costs a message that reads as written and
 * never arrived rather than a second copy to somebody who already had one. A
 * prospect moves to 'queued' the moment its message exists and the transport
 * has not answered, to 'contacted' when it has, and back to the stage its own
 * kind waits at when the send failed, which is what puts it in the queue for
 * the next run.
 *
 * It writes nothing to `subscribers`, and must not. Receiving a cold message
 * is not asking for a newsletter, and a mailing list built out of the
 * addresses this job found is a list nobody on it agreed to be on. This job
 * used to write one such row per delivered message; it does not.
 * `public.suppression` still sits across both systems, keyed on the address
 * and outliving every row either holds, so a business that says stop to one is
 * off both.
 *
 * Each of those writes is read for its error and a failed one stops the run.
 * The pair after a delivered message is the reason: a status that does not
 * land leaves the row at 'drafted' and the prospect at 'queued', which is a
 * message the queue offers again an hour later and a stranger who receives the
 * same cold email twice.
 *
 * What stops it: either switch being off stops the transport but not the
 * drafting. The day's cap stops the drafting too, and so does an empty queue.
 * Missing mail credentials stop an armed run outright rather than quietly
 * leaving messages unsent.
 */

import { servedHereOr404 } from '../../lib/http/guard.js'
import { randomUUID } from 'node:crypto'
import nodemailer from 'nodemailer'
import { runJob, wait } from '../../lib/outreach/runtime.js'
import { field } from '../../lib/db/fields.js'
import {
  FOLLOW_UP_DAYS,
  FOLLOW_UPS_PER_RUN,
  SEND_PER_RUN_MAX,
} from '../../lib/outreach/sending/limits.js'
import { dueBy } from '../../lib/outreach/sending/schedule.js'
import {
  candidates,
  dueFollowUps,
  existingMessages,
  firstMessages,
  followUpColumns,
  homeStage,
  queueFor,
  sendWindow,
  sentToday,
  suppressed,
  variantSettings,
  writtenTo,
} from '../../lib/outreach/sending/queue.js'
import {
  OUTREACH_ORIGIN,
  homeUrl,
  partOfDay,
  renderHtml,
  renderPlainHtml,
  renderPlainText,
  renderText,
  workFor,
  workUrl,
} from '../../lib/outreach/message.js'
import { firstNameOf } from '../../lib/outreach/first-names.js'
import { BIO_PHONE } from '../../lib/mail/bio.js'
import { ensureShot } from '../../lib/outreach/audit/shot.js'
import {
  VARIANTS,
  familyHeld,
  familyOf,
  liveAhead,
  pickVariant,
  withSettings,
} from '../../lib/outreach/variants.js'
import { segmentOf } from '../../lib/outreach/segments.js'
import {
  Undeliverable,
  assertDeliverable,
  checkAddress,
} from '../../lib/outreach/prospects/address.js'

const SMTP_HOST = process.env.OUTREACH_SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = Number(process.env.OUTREACH_SMTP_PORT || 465)
const SMTP_USER = process.env.OUTREACH_SMTP_USER || ''
const SMTP_PASSWORD = process.env.OUTREACH_SMTP_PASSWORD || ''

// The second switch, and the one the console cannot reach. Anything other than
// the exact word leaves sending closed, so a half-set variable is off.
const ARMED = process.env.OUTREACH_SEND_ARMED === 'true'

// The number every message signs off with. The environment moves it without a
// deploy and cannot empty it: a message that reaches a stranger and offers no
// way to reach a person is the one message this pipeline must not send, so an
// unset variable falls back to the studio's own number rather than to nothing.
const REPLY_PHONE = process.env.OUTREACH_REPLY_PHONE || BIO_PHONE

/** The wait between two sends, which is what keeps a run from arriving as a burst. */
const SPACING_MS = 20_000
const SEND_TIMEOUT_MS = 20_000
/**
 * How long a capture is given before the run stops holding a socket open for it.
 *
 * The whole warm answers to this, not each of its attempts: the service is
 * asked again when it replies with its holding image, and three of those plus
 * the pauses between them is far more than a message's turn can afford out of a
 * five minute invocation that also spaces its sends twenty seconds apart. This
 * figure is one of the four SEND_PER_RUN_MAX is derived from.
 */
const SHOT_WARM_MS = 25_000

/**
 * What the write recording a delivered message gets before the run gives up.
 *
 * Both bounds hold at once and the tighter one wins, because attempts alone
 * say nothing about how long they take. A full run already spends most of its
 * five minutes on the spacing between sends and the captures before them, so
 * the ceiling here is in wall clock and is small enough that a full run cannot
 * be pushed past its own budget by it.
 *
 * The cost is paid once per run rather than once per message. A write that
 * cannot land after all of this throws, and the throw ends the run, so no
 * second message ever reaches these attempts.
 */
const STATUS_ATTEMPTS = 3
const STATUS_WINDOW_MS = 2_000
/** The first pause between attempts, doubled for each one after it. */
const STATUS_BACKOFF_MS = 200

export const config = { maxDuration: 300 }

/**
 * How much of the invocation the two sending loops may spend between them.
 *
 * A run does two things that take real time: it sends the first letters the
 * schedule says are due, and then it sends the reminders that have come round.
 * Each was bounded by a count of its own, and two counts cannot see each
 * other: a full allowance of first letters followed by a full allowance of
 * reminders is more than the five minutes the platform gives, and the run that
 * results is killed partway with claims on rows nobody released.
 *
 * So the count bounds what a loop may do and this bounds what the invocation
 * may spend, and a loop stops at whichever comes first. The reserve below the
 * five minutes is for the reads at the top of the run and the writes at the
 * bottom, which is where the run records what it did.
 */
const RUN_BUDGET_MS = 250_000
/**
 * What one message needs before it is worth beginning.
 *
 * A loop asks whether the budget has this much left rather than whether it has
 * any left at all, because a message begun with ten seconds to go is a message
 * the platform interrupts somewhere inside the transport. Both figures are the
 * worst case: the address check is two resolver tries at four seconds, and
 * every send is a timeout and the spacing that follows it.
 */
const FIRST_LETTER_NEEDS_MS = 8_000 + SEND_TIMEOUT_MS + SPACING_MS
const FOLLOW_UP_NEEDS_MS = SEND_TIMEOUT_MS + SPACING_MS

/**
 * Where a prospect's own unsubscribe link points.
 *
 * The token is the whole credential, so the link works from any client, any
 * device and no session. The same URL is the `List-Unsubscribe` header, which
 * is what lets a mailbox provider offer its own one-click control beside the
 * sender's name.
 *
 * @param {string} token The prospect's `unsub_token`.
 * @returns {string} The absolute URL, or an empty string where the row carries
 *   no token yet.
 */
export function unsubscribeUrl(token) {
  return token
    ? `${OUTREACH_ORIGIN}/api/outreach/unsubscribe?token=${encodeURIComponent(token)}`
    : ''
}

/**
 * The message one prospect gets, laid out and in plain text.
 *
 * Both halves come from one content object, so the figure, the client sites
 * and the way off the list are written once and rendered twice. A client
 * showing either half shows the same message.
 *
 * @param {object} prospect Row from `outreach_prospects`.
 * @param {string|null} [shot] The stored capture of the business's own page.
 * @param {string|null} [track] The token this message is recognised by from
 *   outside, which its images and its links carry.
 * @param {object|null} [variant] The variant to open with. The sender picks
 *   one with a roll and passes it; left out, the first live variant that fits
 *   is taken, which is what a preview and a check want.
 * @param {{prior?: {subject: string}|null, at?: Date}} [context] What a letter
 *   after the first is handed: the first letter it follows, so it can thread
 *   under it. The client work the message shows is added here, so a letter
 *   that points at it says the same thing the pictures under it show. `at` is
 *   the moment the letter is written for, which is what its greeting reads the
 *   half of the day off; a caller that names none is writing for now.
 * @returns {{ subject: string, text: string, html: string, variant: string }}
 *   The message, and the id of the variant it was written under.
 * @throws {Error} When no variant fits the prospect, since a message with no
 *   opener is not a message.
 */
export function compose(
  prospect,
  shot = null,
  track = null,
  variant = pickVariant(prospect),
  context = {}
) {
  if (!variant) {
    throw new Error(
      `no variant fits ${prospect.id ?? prospect.name}: it reads as ${segmentOf(prospect)}`
    )
  }

  // The two the wider area is named by. A prospect in one of them gets the plain
  // surrounding-area phrasing, since naming their own town twice reads as a
  // template filling itself in.
  const ANCHOR_TOWNS = ['baytown', 'houston']

  /**
   * How the service area is put to one prospect.
   *
   * Their own town leads, because that is the part a reader checks first, and the
   * wider area follows so the offer does not read as stopping at the town line.
   */
  function serviceArea(town) {
    if (!town) return 'around Baytown, Houston and the rest of Southeast Texas'
    if (ANCHOR_TOWNS.includes(town.toLowerCase())) return `in ${town} and the surrounding area`
    return `in ${town} and across the Baytown and Houston area`
  }
  const where = serviceArea(prospect.town)
  const work = workFor(prospect)
  // What a letter is given to write with. The number is here because the cold
  // letter hopes to be rung rather than replied to, and the portfolio is here
  // for the paused families alone: the letter that sends offers one address,
  // under the sign-off, and no second door into a gallery of work.
  const opener = variant.open(prospect, where, shot, {
    ...context,
    work,
    phone: REPLY_PHONE,
    site: workUrl(track),
  })
  const contact = {
    phone: REPLY_PHONE,
    unsubscribe: unsubscribeUrl(prospect.unsub_token),
  }

  // A plain letter is its paragraphs and nothing else, rendered bare. It is
  // the one letter greeted by name, since a typed note to a person opens with
  // their name where the address gave one, and with nothing where it did not.
  if (opener.plain) {
    const message = {
      subject: opener.subject,
      greeting: firstNameOf(prospect.email),
      // The half of the day the greeting says, fixed when the letter is
      // written. A draft the queue holds past noon is written again before it
      // goes, so the word and the hour it lands in never disagree.
      at: context.at ?? new Date(),
      paragraphs: opener.paragraphs,
      track,
      // The studio's own signature goes under the letter, and the studio's own
      // address is what it links to. It is a place to look rather than an
      // invitation: nothing in the letter asks the reader to ring or to reply,
      // and the number the signature carries is there the way a number on a
      // business card is. The unsubscribe rides along because it is owed.
      contact: { unsubscribe: contact.unsubscribe, site: homeUrl(track) },
    }
    return {
      subject: message.subject,
      text: renderPlainText(message),
      html: renderPlainHtml(message),
      variant: variant.id,
    }
  }

  const message = {
    subject: opener.subject,
    marker: opener.marker,
    // A business name in the salutation reads as a mail merge, because that is
    // the only place a name appears in that position. The business is named in
    // the sentence beneath it instead, where a person would put it.
    greeting: 'there',
    lines: opener.lines,
    figure: opener.figure,
    after: opener.after,
    close: opener.close,
    work,
    track,
    contact,
  }

  return {
    subject: message.subject,
    text: renderText(message),
    html: renderHtml(message),
    variant: variant.id,
  }
}

let transport = null

/** The mail server the message goes through, built once per function instance. */
function mailer() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    })
  }
  return transport
}

/** The sender both the draft and the send carry. */
export function sender(settings) {
  const address = settings.from_address || SMTP_USER
  if (!address) {
    throw new Error(
      'no from address; set from_address in outreach_settings or OUTREACH_SMTP_USER on the deployment'
    )
  }
  return { name: settings.from_name || 'TaylorURL', address }
}

/**
 * One letter delivered to the studio's own inbox, as it would go.
 *
 * A proof is the message the composer wrote, handed to the same mail server
 * the sender uses, so what arrives is what a business would get, pictures and
 * all. It carries no unsubscribe header, because it is on no list, and it
 * writes nothing: a proof is not a relationship with anyone.
 *
 * @param {{from: object, to: string, subject: string, text: string, html: string}} message
 * @param {() => object} [transport] The mail client, built once per instance.
 * @returns {Promise<string>} The id the mail server accepted it under.
 * @throws {Error} When the deployment has no mail login to send with.
 */
export async function deliverProof({ from, to, subject, text, html }, transport = mailer) {
  if (!SMTP_USER || !SMTP_PASSWORD) {
    throw new Error(
      'the deployment has no mail login; set OUTREACH_SMTP_USER and OUTREACH_SMTP_PASSWORD'
    )
  }
  const sent = await transport().sendMail({ from, to, subject, text, html })
  return field(sent?.messageId, 500)
}

/**
 * The drafted row for a prospect, written before anything is handed anywhere.
 *
 * The variant goes on the message row, and then on the prospect if the
 * prospect does not hold one yet. Writing the draft is the moment a business
 * is given its message, and the row is what a later run reads before it
 * chooses, so the two say the same id from the moment either exists. The
 * prospect's write names a row still holding nothing, which is what keeps a
 * run that read the row before another wrote it from overturning the first.
 */
async function draft(db, prospect, from, shot, variant, chain = {}) {
  // The token is minted here rather than taken from the stored row, because
  // the message quotes it in its own images and its own links and is therefore
  // written before the row it belongs to exists. Both halves carry the one the
  // row is then filed under.
  const track = randomUUID()
  const step = chain.step ?? 1
  const { subject, text, html } = compose(prospect, shot, track, variant, {
    prior: chain.prior ?? null,
  })
  const { data, error } = await db
    .from('outreach_messages')
    .insert({
      prospect_id: prospect.id,
      direction: 'outbound',
      subject,
      body_text: text,
      body_html: html,
      from_address: from.address,
      to_address: String(prospect.email).toLowerCase(),
      status: 'drafted',
      track_token: track,
      variant_id: variant.id,
      // Which letter of the chain this is, once the column is there to say.
      ...(chain.ready ? { step } : {}),
    })
    .select('id, subject, body_text, body_html, to_address')
    .single()
  if (error) throw new Error(error.message)

  await stamp(db, prospect, variant, step)
  return data
}

/**
 * The letter a business keeps, written on its row once. The first letter is
 * the one it keeps; a follow-up stamps nothing.
 *
 * The write names the row as this run read it - holding nothing, or holding
 * the letter this run is overturning - which is what keeps a run that read the
 * row before another wrote it from taking back the first one's answer.
 *
 * A stamp is overturned one way only, and `pickVariant` is where it is
 * decided: the letter on the row belongs to a family with nothing live left,
 * so the business was drawn again and the message actually going out carries
 * another id. Leaving the old one on the row would have the results counting
 * one letter and the follow-up opening in another's family.
 */
async function stamp(db, prospect, variant, step) {
  const before = prospect.variant_id ?? null
  if (step !== 1 || before === variant.id) return
  const write = db
    .from('outreach_prospects')
    .update({ variant_id: variant.id, variant_assigned_at: new Date().toISOString() })
    .eq('id', prospect.id)
  const given = await (before === null
    ? write.is('variant_id', null)
    : write.eq('variant_id', before))
  if (given.error) throw new Error(given.error.message)
  prospect.variant_id = variant.id
}

/**
 * A draft written before the letters existed, written again under one.
 *
 * The row keeps its id and its place in the queue. Its words, its letter and
 * its token change, since the message quotes the token in its own images and
 * links and a message drafted again is a new message under the old row. Only
 * a row still at 'drafted' is written: one that left in the meantime is a
 * message that went, and goes on the record as it went.
 */
async function redraft(db, held, prospect, from, shot, variant, chain = {}) {
  const track = randomUUID()
  const step = chain.step ?? 1
  const { subject, text, html } = compose(prospect, shot, track, variant, {
    prior: chain.prior ?? null,
  })
  const { data, error } = await db
    .from('outreach_messages')
    .update({
      subject,
      body_text: text,
      body_html: html,
      from_address: from.address,
      to_address: String(prospect.email).toLowerCase(),
      track_token: track,
      variant_id: variant.id,
      ...(chain.ready ? { step } : {}),
    })
    .eq('id', held.id)
    .eq('status', 'drafted')
    .select('id, subject, body_text, body_html, to_address')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return held

  await stamp(db, prospect, variant, step)
  return data
}

/**
 * A business held out, recorded where its draft would have been written.
 *
 * The holdout goes on the prospect under its own id, the way a variant does,
 * so the queue leaves the business alone from here on and the results count
 * it against its segment. No message row is written: there is no message, and
 * a row saying so would be a message that was never sent. The write names a
 * row still holding nothing, for the same reason the draft's does.
 */
async function hold(db, prospect, holdout) {
  const given = await db
    .from('outreach_prospects')
    .update({ variant_id: holdout.id, variant_assigned_at: new Date().toISOString() })
    .eq('id', prospect.id)
    .is('variant_id', null)
  if (given.error) throw new Error(given.error.message)
  prospect.variant_id = holdout.id
}

/**
 * One message, handed to the mail server, answering with what it was given as
 * an id.
 *
 * Both halves go with it, which is what makes the mail multipart: a client
 * that renders the layout takes the HTML and one that does not falls back to
 * the same content as text. A row drafted before the HTML column existed
 * carries text alone and still sends.
 *
 * The two `List-Unsubscribe` headers are RFC 8058's one-click contract: the
 * URL accepts a POST, and the `Post` header is what tells the mailbox provider
 * it may send one without asking the reader to visit a page. A row whose
 * prospect predates the token column carries neither, since a header pointing
 * at a link that cannot work is worse than no header.
 *
 * The recipient is verified here, in front of the transport, rather than at the
 * point that chose it. A guessed address costs a hard bounce against the domain
 * the newsletter and the client mail also leave from, so the check has to hold
 * for every route to the mail server there will ever be, including one written
 * by somebody who did not know to call it. The queue runs the same check first,
 * so by the time a message reaches this the answer is already in the process
 * cache and costs nothing.
 *
 * @param {object} db A service-role client, which holds the domain cache.
 * @param {() => object} [transport] The mail client, built once per instance.
 * @throws {Undeliverable} Before the transport is touched, when the address fails.
 */
export async function deliver(db, message, from, unsubscribe, transport = mailer, thread = null) {
  await assertDeliverable(db, message.to_address)
  const sent = await transport().sendMail({
    from,
    to: message.to_address,
    subject: message.subject,
    text: message.body_text,
    html: message.body_html || undefined,
    // A follow-up names the message it follows, which is what a mail client
    // reads to keep the two in one thread.
    ...(thread?.inReplyTo ? { inReplyTo: thread.inReplyTo, references: thread.inReplyTo } : {}),
    ...(unsubscribe
      ? {
          headers: {
            'List-Unsubscribe': `<${unsubscribe}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }
      : {}),
  })
  return field(sent?.messageId, 500)
}

/**
 * Records a message the transport has already accepted, taken again if it fails.
 *
 * This one write is retried and the others around it are not, because this is
 * the only one whose loss cannot be repaired later. A status that does not land
 * leaves the row at 'drafted' with its prospect at 'queued', and `queueFor`
 * hands that pair back an hour on, which sends the same cold message to the
 * same business twice. The stage write after it has no such hazard: a prospect
 * left at 'queued' beside a message reading 'sent' is the exact shape the
 * repair pass at the top of a run looks for, and it is never re-queued in the
 * meantime, since a claim is only released for a message still at 'drafted'.
 *
 * Retrying is safe here for a reason that is narrower than replay. The update
 * names one row by its key and writes fixed values into it, so the second
 * attempt asks for precisely what the first asked for; a write that turns out
 * to have landed after all is asked to land again and nothing moves.
 *
 * A run whose writes are all failing still fails. The attempts narrow the
 * window in which a delivered message can be left looking undelivered; they do
 * not make the run's own report of what happened optional.
 *
 * @param {object} db A service-role client.
 * @param {object} message The row the transport was handed.
 * @param {string|null} providerId What the mail server called it.
 * @param {string} at The moment it left.
 * @throws {Error} When every attempt inside the window is refused.
 */
// A cold message puts nobody on the mailing list. Receiving one is not asking
// for another, and a list built out of the people who never answered is a list
// nobody on it agreed to. The send job used to write a `subscribers` row for
// every address it wrote to; it does not, and nothing here may. The only ways
// onto that list are the sign-up form, which confirms, and the console, which
// is a person adding a client by hand.

async function markSent(db, message, providerId, at) {
  const closes = Date.now() + STATUS_WINDOW_MS
  let pause = STATUS_BACKOFF_MS
  let refusal = null

  for (let attempt = 1; attempt <= STATUS_ATTEMPTS; attempt += 1) {
    const written = await db
      .from('outreach_messages')
      .update({ status: 'sent', sent_at: at, provider_id: providerId, error: null })
      .eq('id', message.id)
    if (!written.error) return
    refusal = written.error

    // The pause is only taken when there is both an attempt left to spend it on
    // and room inside the window to finish it.
    if (attempt === STATUS_ATTEMPTS || Date.now() + pause >= closes) break
    console.error(
      'outreach send: %s: recording the send, attempt %d: %s',
      message.to_address,
      attempt,
      refusal.message
    )
    await wait(pause)
    pause *= 2
  }

  throw new Error(refusal.message)
}

/**
 * Asks the screenshot service for a prospect's page before the message quoting
 * it can be opened.
 *
 * The service renders a URL on the first request for it and answers that
 * request with a holding image carrying its own logo, so a reader opening a
 * message nobody had asked ahead of would find the service where their page
 * belongs. Asking here puts the render behind the message instead.
 *
 * It is waited on, since the draft quoting it is written straight afterwards,
 * and it is waited on for no longer than SHOT_WARM_MS. Past that the run stops
 * holding the socket open and writes the message without a capture, which costs
 * little: the message states every fact in text and names the business in the
 * alt. A render that never answers would cost the rest of the run's queue.
 *
 * A letter that shows no capture is not waited on at all. `compose` renders a
 * plain letter from its paragraphs and never reaches the laid-out half that
 * places a picture, so a capture taken for one is a render nobody sees and
 * SHOT_WARM_MS of an invocation spent holding a socket open for it. That is
 * the whole of what the letter that sends is, which is why the wait is asked
 * about per letter rather than assumed: a paused family switched back on wants
 * its capture, and gets it.
 *
 * @param {object} prospect Row from `outreach_prospects`.
 * @param {object|null} [letter] The letter about to be written, where one has
 *   been settled. A held draft settles it already and needs no capture.
 */
async function warmShot(db, prospect, letter = null) {
  // A letter that renders no picture has nothing to take one for.
  if (!letter || letter.plain) return null
  // The listing of a business with no site of its own points at a platform,
  // and the opener it gets shows no capture, so there is nothing to take.
  if (prospect.site_kind === 'social' || !prospect.website) return null
  return ensureShot(db, prospect, { budgetMs: SHOT_WARM_MS })
}

/** Postgres and PostgREST each have their own way of saying a column is absent. */
function columnMissing(error) {
  const code = error?.code || ''
  if (code === '42703' || code === 'PGRST204') return true
  return /column .* does not exist|could not find the .* column/i.test(error?.message || '')
}

/**
 * Files what a check found about a prospect's address.
 *
 * The verdict, its reason and the moment it was taken go on the row of every
 * prospect a check refused, so a business the pipeline never wrote to carries
 * the account of why on itself. Only a settled refusal moves the stage: a
 * resolver that did not answer says nothing about the domain, so the prospect
 * stays where it was waiting and is asked about again on the next run.
 *
 * The row is never removed. An address refused because its domain does not
 * resolve today is one a later check can take again, and a business dropped
 * from the table could not be.
 *
 * A database still on the schema before these columns keeps the refusal and
 * loses only the record of it. The guard is the check, not the write behind it,
 * so a deployment that reaches the project ahead of its migration sends
 * nothing it should not; it says less about why until the migration lands.
 *
 * @param {object} db A service-role client.
 * @param {object} prospect Row from `outreach_prospects`.
 * @param {{verdict: string, reason: string|null}} check
 * @param {string} [waitsAt] Where an unsettled prospect belongs, when it has
 *   already been claimed and cannot be left where it stands.
 */
async function markAddress(db, prospect, check, waitsAt) {
  const patch = {
    email_verdict: check.verdict,
    email_check_reason: check.reason,
    email_checked_at: new Date().toISOString(),
  }
  if (check.verdict === 'undeliverable') patch.stage = 'undeliverable'
  else if (waitsAt) patch.stage = waitsAt

  const { error } = await db.from('outreach_prospects').update(patch).eq('id', prospect.id)
  if (error && !columnMissing(error)) throw new Error(error.message)
  if (error) {
    console.error('outreach send: %s: recording the address check: %s', prospect.id, error.message)
    return
  }
  prospect.stage = patch.stage ?? prospect.stage
}

export async function work({ db, settings, counts }) {
  // The moment both loops stop at. Opened before the reads, so the time they
  // take is spent out of the same budget the sending is.
  const endsAt = Date.now() + RUN_BUDGET_MS
  const armed = Boolean(settings.sending_enabled) && ARMED
  if (armed && (!SMTP_USER || !SMTP_PASSWORD)) {
    throw new Error('sending is armed but OUTREACH_SMTP_USER or OUTREACH_SMTP_PASSWORD is not set')
  }

  // Outside the window a run still composes and stores its drafts, so the text
  // is ready to read and goes out on the next run inside it. Nothing is lost by
  // running at midnight; it simply does not deliver.
  const window = sendWindow()
  const sending = armed && window.open

  // The registry as the console has set it, read once for the run. A variant
  // paused in the console stops being chosen on the next run and not before,
  // and a business already holding it keeps it either way.
  const stored = await variantSettings(db)
  const variants = withSettings(VARIANTS, stored)

  // Whether the chain's columns are in the database yet. Until they are, the
  // run sends first letters alone and records no step, and the chain waits
  // for the migration rather than stopping the run over it.
  const ready = await followUpColumns(db)

  const first = await firstLetters({
    db,
    settings,
    counts,
    sending,
    window,
    variants,
    ready,
    endsAt,
  })
  // Follow-ups only ever go out, never wait as drafts, so a run that is not
  // sending has none to do. They are outside the cap and the ramp: what bounds
  // them is what is due and what one invocation has time for.
  const later =
    sending && ready
      ? await followUps({ db, settings, counts, variants, endsAt })
      : { followed: 0, closed: 0, deferred: 0 }
  return { ...first, ...later }
}

/**
 * The first letters a run owes: the day's cap spread across the window, sent
 * to the businesses at the head of the queue.
 */
async function firstLetters({ db, settings, counts, sending, window, variants, ready, endsAt }) {
  // The day's cap is spread across the window rather than sent on the first run
  // that finds it. Each invocation asks how many should have gone by now and
  // sends only the difference, so a missed run catches up on the next and two
  // runs a minute apart do not both send. Three bounds hold at once: the cap
  // bounds the day, the schedule bounds this moment within it, and
  // SEND_PER_RUN_MAX bounds what this invocation can finish before the platform
  // stops it. A backlog longer than the last of them is left for the next run.
  const already = await sentToday(db, { firstOnly: ready })
  const due = dueBy(settings.daily_cap, new Date())
  const owed = Math.max(Math.min(settings.daily_cap, due) - already, 0)
  const allowance = Math.min(owed, SEND_PER_RUN_MAX)
  if (allowance <= 0) {
    const capped = already >= settings.daily_cap
    return { sending, allowance: 0, capped, waiting: !capped, due, already, window }
  }

  const from = sender(settings)

  const rows = await candidates(db)
  if (!rows.length) return { sending, allowance, queue: 0, window }

  const addresses = rows.map(row => String(row.email).toLowerCase())
  const held = await suppressed(db, addresses)
  // Addresses this pipeline has already written to, whatever row carried the
  // letter. Two listings of one business share a mailbox and neither row knows
  // about the other, so without this the second is a first letter to somebody
  // who has already had one.
  const alreadyWritten = await writtenTo(db, addresses)
  const messages = await existingMessages(
    db,
    rows.map(row => row.id)
  )

  // A claim left behind by a run that never came back, put where the state of
  // its message says it belongs. A message that came back 'sent' is a delivery
  // that landed and a stage write that did not, so the row is finished. A
  // prospect with no live message had one end in failure, so it goes back to
  // where its own kind waits and is drafted again. The local stage moves with
  // the write, which is what lets the queue below act on the repair in the
  // same run.
  let repaired = 0
  for (const prospect of rows) {
    if (prospect.stage !== 'queued') continue
    const existing = messages.get(prospect.id)
    if (existing && existing.status !== 'sent') continue

    const update = existing
      ? { stage: 'contacted', contacted_at: existing.sent_at ?? new Date().toISOString() }
      : { stage: homeStage(prospect) }
    const written = await db.from('outreach_prospects').update(update).eq('id', prospect.id)
    if (written.error) throw new Error(written.error.message)

    prospect.stage = update.stage
    counts.changed += 1
    repaired += 1
  }

  const queue = queueFor({ candidates: rows, held, written: alreadyWritten, messages, sending })

  const run = queue.slice(0, allowance)
  const tally = {
    drafted: 0,
    sent: 0,
    failed: 0,
    repaired,
    refused: 0,
    unsettled: 0,
    unmatched: 0,
    held: 0,
    // Businesses this run had the allowance for and not the minutes. They keep
    // their place at the head of the queue for the next one.
    postponed: 0,
  }

  for (const [position, prospect] of run.entries()) {
    // The invocation's own budget, checked before anything is spent on this
    // business rather than after. A run that stops here leaves the rest of the
    // queue exactly as it found it, and the next run ten minutes later reads
    // the same order and carries on; a run the platform stops instead leaves
    // whatever it was holding claimed.
    if (sending && Date.now() + FIRST_LETTER_NEEDS_MS > endsAt) {
      tally.postponed += run.length - position
      break
    }
    counts.examined += 1

    // Which message this business gets is settled before anything is spent on
    // it. A draft already written settled it when it was written, so nothing
    // is chosen for one. A business no live variant fits is left where it
    // stands, and the run sends one fewer than its allowance rather than
    // composing a message with nothing in it.
    // A draft written before the letters existed names none, and would go
    // out as the one opener the sender had then. A draft written under a
    // letter whose family has since been retired is the same fault a version
    // on: words nothing sends any more, sitting in the queue waiting to go.
    // Either is drafted again under a live letter, in place, so the row keeps
    // its id and the business is given a letter the way every other one is.
    //
    // A letter merely paused in the console is not stale. The draft stands and
    // goes as it was written, which is what keeps a switch flipped for an
    // afternoon from rewriting the words somebody read before they went.
    const held = messages.get(prospect.id)
    const under = held ? (variants.find(one => one.id === held.variant_id) ?? null) : null
    const stale = Boolean(
      held && (!under || !liveAhead(variants, segmentOf(prospect), 1, familyOf(under)))
    )
    const variant = held && !stale ? null : pickVariant(prospect, variants, Math.random())
    if (!variant && (!held || stale)) {
      tally.unmatched += 1
      continue
    }

    // A plain letter greets the half of the day it arrives in, and that half is
    // written into it when it is drafted. A draft the queue held past noon
    // would go out saying good morning in the afternoon, which is the one line
    // in the letter a reader can tell a machine wrote. So it is written again,
    // under the letter it already names, on the run that is about to send it:
    // the words are the words it was given and only the greeting moves. A run
    // that is not sending leaves it alone, since the half it is eventually read
    // in is not one this run knows.
    const dated = Boolean(
      held &&
      !stale &&
      sending &&
      under?.plain &&
      partOfDay(new Date(held.created_at)) !== partOfDay(new Date())
    )

    // Verification comes before the capture and the draft, not just before the
    // transport. A dead address is dead whether or not the switches are open,
    // and drafting for one spends a screenshot and a composition on a message
    // that can never go anywhere. A run that refuses a prospect here sends
    // fewer than its allowance rather than reaching past it for a replacement,
    // and the next run's own arithmetic makes that up.
    const check = await checkAddress(db, prospect.email)
    if (check.verdict !== 'deliverable') {
      await markAddress(db, prospect, check)
      counts.changed += 1
      if (check.verdict === 'undeliverable') tally.refused += 1
      else tally.unsettled += 1
      continue
    }

    // A business drawn into the holdout is recorded and left. It passed the
    // same address check the businesses written to pass, so the two slices are
    // alike in everything but the message, which is what makes the floor a
    // floor. The run sends one fewer than its allowance, and the next run's
    // own arithmetic makes that up.
    if (variant?.holdout) {
      await hold(db, prospect, variant)
      counts.changed += 1
      tally.held += 1
      continue
    }

    // The capture is taken before the draft, because the draft is the HTML
    // that gets sent: a picture that arrives after it is written is a picture
    // no reader sees. Waiting here is waiting the run already does between
    // sends, and a capture that cannot be taken leaves the message without one
    // rather than with a frame that will not fill.
    const shot = await warmShot(db, prospect, variant)
    // The letter a draft already in hand is written again under: a fresh pick
    // where the one it named has been retired, and the one it named where only
    // its greeting has gone out of date.
    const rewriting = stale ? variant : dated ? under : null
    const message = rewriting
      ? await redraft(db, held, prospect, from, shot, rewriting, { ready, step: 1 })
      : (held ?? (await draft(db, prospect, from, shot, variant, { ready, step: 1 })))

    if (!sending) {
      counts.changed += 1
      tally.drafted += 1
      continue
    }

    // The prospect leaves the queue before the transport is reached, so a run
    // that dies mid-send leaves it at 'queued' rather than back in line. The
    // stage it belongs at is worked out first, since a send that fails has to
    // put it back where its own kind waits.
    const home = homeStage(prospect)
    const claimed = await db
      .from('outreach_prospects')
      .update({ stage: 'queued' })
      .eq('id', prospect.id)
    if (claimed.error) throw new Error(claimed.error.message)

    // The catch covers the transport and nothing else. A bookkeeping write that
    // fails afterwards is a different fault from a message that did not leave,
    // and reading the first as the second is what would mark a delivered
    // message 'failed' and hand it back to the queue to be sent again.
    let providerId = null
    let refused = null
    try {
      providerId = await deliver(db, message, from, unsubscribeUrl(prospect.unsub_token))
    } catch (cause) {
      refused = cause
    }

    if (refused) {
      console.error('outreach send: %s failed: %s', message.to_address, refused.message)
      const marked = await db
        .from('outreach_messages')
        .update({ status: 'failed', error: String(refused.message).slice(0, 1000) })
        .eq('id', message.id)
      if (marked.error) throw new Error(marked.error.message)
      // A refusal at the transport is the guard catching an address the queue
      // did not, so the row is filed by its verdict rather than sent back to
      // wait for the same answer. Anything else is a send that failed, and the
      // prospect returns to where its own kind waits.
      if (refused instanceof Undeliverable) {
        await markAddress(db, prospect, refused, home)
        if (refused.verdict === 'undeliverable') tally.refused += 1
        else tally.unsettled += 1
      } else {
        const returned = await db
          .from('outreach_prospects')
          .update({ stage: home })
          .eq('id', prospect.id)
        if (returned.error) throw new Error(returned.error.message)
        tally.failed += 1
      }
    } else {
      const now = new Date().toISOString()
      await markSent(db, message, providerId, now)
      // `contacted_at` is the whole record that this business has been written
      // to, and the queue reads it to leave the business alone afterwards. It
      // is set for a message that actually left and for nothing else: a draft
      // nobody sent is not a relationship with anyone.
      // The first letter puts the business on the chain: one letter in, and
      // the next owed a few days on, where the columns exist to say so.
      const moved = await db
        .from('outreach_prospects')
        .update({
          stage: 'contacted',
          contacted_at: now,
          ...(ready ? { step: 1, next_due_at: dueAfter(now) } : {}),
        })
        .eq('id', prospect.id)
      if (moved.error) throw new Error(moved.error.message)
      counts.changed += 1
      tally.sent += 1
    }

    if (position + 1 < run.length) await wait(SPACING_MS)
  }

  return { sending, allowance, due, already, queue: queue.length, window, ...tally }
}

/** The moment the next letter of a chain is owed, counted from this one. */
const DAY_MS = 24 * 60 * 60 * 1000
export const dueAfter = (at, days = FOLLOW_UP_DAYS) =>
  new Date(new Date(at).getTime() + days * DAY_MS).toISOString()

/** A chain ended: the business keeps its stage and is owed nothing more. */
async function closeChain(db, prospect) {
  const done = await db
    .from('outreach_prospects')
    .update({ next_due_at: null })
    .eq('id', prospect.id)
  if (done.error) throw new Error(done.error.message)
  prospect.next_due_at = null
}

/**
 * The follow-ups owed right now, sent after the run's first letters.
 *
 * A business is owed one while it stands at 'contacted' with a due date that
 * has passed. Each is given the next step's letter, drawn by the shares set
 * for that step, threaded under the first letter it was sent, and delivered
 * the way a first letter is: the same address check in front of the transport,
 * the same record of the send, the same way off the list. Then the business
 * is moved one step on and owed the next letter a few days out, or owed
 * nothing more where no letter is registered for the step after.
 *
 * An address held off the list since, or a chain with nothing written for its
 * next step, ends here. A step whose letters are all paused waits: the chain
 * is not skipped a step because the console has one switched off. A send the
 * transport refuses is recorded as failed; a dead address is filed as one, and
 * anything else is asked again a day on rather than every quarter hour.
 *
 * Nothing here counts against the day's cap or the ramp, and one invocation
 * sends at most FOLLOW_UPS_PER_RUN of them, since they run after its first
 * letters inside the same time.
 */
async function followUps({ db, settings, counts, variants, endsAt }) {
  const tally = { followed: 0, closed: 0, deferred: 0 }
  const due = await dueFollowUps(db, new Date())
  if (!due.length) return tally

  const held = await suppressed(
    db,
    due.map(row => String(row.email ?? '').toLowerCase())
  )
  const first = await firstMessages(
    db,
    due.map(row => row.id)
  )
  const from = sender(settings)

  // The run walks the list in the order it is owed and stops once it has
  // handed FOLLOW_UPS_PER_RUN letters to the transport. A business the run
  // cannot write to now, because every letter at its step is switched off, is
  // stepped past rather than counted, so a paused step never spends the slots
  // the businesses behind it were owed.
  let handed = 0
  for (const prospect of due) {
    if (handed >= FOLLOW_UPS_PER_RUN) break
    // The same budget the first letters spent from. Reminders run after them,
    // so this is usually what stops the loop on a busy day rather than the
    // count, and a business left here is still owed: its next_due_at is
    // untouched and the next run reads it at the head of the line.
    if (Date.now() + FOLLOW_UP_NEEDS_MS > endsAt) break
    // Read off the row rather than trusted from the query, so a read that
    // answered with something else cannot put a business on the chain.
    if (prospect.stage !== 'contacted' || !prospect.next_due_at || !prospect.email) continue
    counts.examined += 1

    const address = String(prospect.email).toLowerCase()
    const step = (prospect.step ?? 1) + 1
    const segment = segmentOf(prospect)
    // The chain stays in the family of the first letter, so the step after
    // this one is asked about within that family and no other.
    const family = familyHeld(prospect, variants)

    // A chain ends when its family has nothing live left to send, not merely
    // when the code holds no words for the next step. A family retired outright
    // leaves every business part way through it owed a letter no draw can
    // produce, and deferring those forever is a queue that quietly holds people
    // and reports nothing.
    if (held.has(address) || !liveAhead(variants, segment, step, family)) {
      await closeChain(db, prospect)
      counts.changed += 1
      tally.closed += 1
      continue
    }

    const letter = pickVariant(prospect, variants, Math.random(), step)
    if (!letter) {
      tally.deferred += 1
      continue
    }

    const prior = first.get(prospect.id) ?? null
    const shot = await warmShot(db, prospect, letter)
    const message = await draft(db, prospect, from, shot, letter, {
      ready: true,
      step,
      prior: prior ? { subject: prior.subject } : null,
    })

    if (handed) await wait(SPACING_MS)
    handed += 1

    let providerId = null
    let refused = null
    try {
      providerId = await deliver(
        db,
        message,
        from,
        unsubscribeUrl(prospect.unsub_token),
        undefined,
        prior?.provider_id ? { inReplyTo: prior.provider_id } : null
      )
    } catch (cause) {
      refused = cause
    }

    if (refused) {
      console.error(
        'outreach send: follow-up to %s failed: %s',
        message.to_address,
        refused.message
      )
      const marked = await db
        .from('outreach_messages')
        .update({ status: 'failed', error: String(refused.message).slice(0, 1000) })
        .eq('id', message.id)
      if (marked.error) throw new Error(marked.error.message)
      if (refused instanceof Undeliverable) {
        await markAddress(db, prospect, refused)
        await closeChain(db, prospect)
        tally.closed += 1
      } else {
        const later = await db
          .from('outreach_prospects')
          .update({ next_due_at: dueAfter(new Date(), 1) })
          .eq('id', prospect.id)
        if (later.error) throw new Error(later.error.message)
        tally.deferred += 1
      }
      counts.changed += 1
      continue
    }

    const now = new Date().toISOString()
    await markSent(db, message, providerId, now)
    const next = liveAhead(variants, segment, step + 1, family) ? dueAfter(now) : null
    const moved = await db
      .from('outreach_prospects')
      .update({ step, next_due_at: next })
      .eq('id', prospect.id)
    if (moved.error) throw new Error(moved.error.message)
    counts.changed += 1
    tally.followed += 1
  }

  return tally
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runJob({ request, response, job: 'send', work })
}
