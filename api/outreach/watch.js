/**
 * Reads the outreach mailbox for what came back.
 *
 * What it does: opens the same Workspace account the messages are sent from,
 * this time over IMAP, and looks at everything that arrived in the last week.
 * A message from an address the pipeline has written to is a reply. A message
 * from a mail server reporting a permanent failure is a hard bounce. Anything
 * else in the mailbox is somebody else's business and is left alone.
 *
 * Nothing is marked read and no flag is changed, so the mailbox reads the same
 * afterwards as it did before. A message is recognised again by its Message-ID,
 * which is already stored against the row it produced, so a run over the same
 * week twice writes nothing twice.
 *
 * A soft failure is deliberately ignored. Only a 5.x.x status or a 5xx
 * diagnostic code counts as a bounce, because a full mailbox or a server
 * having a bad morning is not a reason to hold an address off outreach for
 * good.
 *
 * Every reply is read for an opt-out before anything else is done with it. The
 * outbound message invites one by reply, which makes that reply the opt-out
 * channel, and an opt-out that reaches a mailbox and waits for somebody to act
 * on it is the failure CAN-SPAM names. The reading is in
 * lib/outreach/sending/replies.js, over the sender's own new text rather than the copy
 * quoted underneath it.
 *
 * Every message a person wrote is then handed to the studio inbox. The mailbox
 * this job opens is a machine's mailbox and nobody reads it, so a reply that
 * only ever became a row is a business waiting on an answer that no one knows
 * to write. That includes the messages the pipeline cannot match: an owner who
 * answers from their own address rather than the one written to has no
 * prospect behind them and is still a person writing in. An unmatched message
 * has to read as something somebody typed before it is carried, because the
 * mailbox is a working account whose own administrative post - DMARC reports,
 * billing, Search Console - arrives in exactly that shape and would fill the
 * inbox this exists to keep worth reading.
 *
 * What it reads: OUTREACH_SMTP_USER and OUTREACH_SMTP_PASSWORD, over the IMAP
 * host and port beside them, RESEND_API_KEY for the notices, and
 * `outreach_prospects` matched by address.
 *
 * What it writes: an inbound `outreach_messages` row for each reply and each
 * hard bounce. A reply asking for no further contact moves its prospect to
 * 'unsubscribed', writes the address into `public.suppression` with the reason
 * 'unsubscribed', and records the phrase it was read from on the message row.
 * Any other reply moves its prospect to 'replied'. A hard bounce moves it to
 * 'bounced' and writes the address into the same table with the reason
 * 'bounced'. Both suppressions keep every other list off the address too, and
 * neither stage is one any job walks a prospect back out of.
 *
 * The inbound row is written last of the group, after the stage, the
 * suppression and the list standing. That row is what a later run recognises
 * the message by, so writing it first and failing afterwards would leave the
 * message marked as handled with the suppression missing - an address that
 * asked to be left alone, still on the list, with nothing to say so. Written
 * last, a failure anywhere leaves the message unrecognised and the next run
 * reads it again and finishes the group.
 *
 * Every write is read for its error and a failed one stops the run, which puts
 * the reason in `outreach_runs.error`. A count of rows changed is only worth
 * having if a row that did not change cannot be counted.
 *
 * What stops it: absent credentials, which are recorded against the run rather
 * than thrown, since a mailbox that has not been configured yet is a state to
 * report and not a fault to raise.
 */

import { servedHereOr404 } from '../../lib/http/guard.js'
import { ImapFlow } from 'imapflow'
import { runJob } from '../../lib/outreach/runtime.js'
import { field } from '../../lib/db/fields.js'
import { readAutoReply, readOptOut } from '../../lib/outreach/sending/replies.js'
import { sendNotice, notice } from '../../lib/mail/notice.js'

const IMAP_HOST = process.env.OUTREACH_IMAP_HOST || 'imap.gmail.com'
const IMAP_PORT = Number(process.env.OUTREACH_IMAP_PORT || 993)
const MAILBOX = process.env.OUTREACH_IMAP_MAILBOX || 'INBOX'
const USER = process.env.OUTREACH_SMTP_USER || ''
const PASSWORD = process.env.OUTREACH_SMTP_PASSWORD || ''

// The mailbox this job reads is not one anybody opens, so a reply that stops
// here is a reply nobody answers. Resend carries it the rest of the way.
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

/** How far back a run looks, which is well past the gap between two of them. */
const LOOKBACK_DAYS = 7
/** Messages one run reads, newest first. */
const MAX_MESSAGES = 100
/** Characters of a body kept against a row. */
const BODY_LIMIT = 20_000
/**
 * Characters of an HTML part read before it is turned into text. Far past the
 * body's own cap, because a reply written above a quoted copy of the outreach
 * message is a few lines of text at the top of a great deal of markup, and a
 * read that stopped at the body's cap would keep the markup and lose the lines.
 */
const HTML_LIMIT = 400_000
/** Characters of the matched opt-out phrase kept against a row. */
const PHRASE_LIMIT = 200
/**
 * Notices one run hands on, for the same reason a run reads a fixed number of
 * messages: a mailbox that fills with something unexpected costs one run's
 * worth of mail rather than the account's whole allowance. A run that reaches
 * the cap stops there and records nothing further, because a recorded message
 * is one no later run reads again: recording past the cap would file replies
 * that no notice ever followed. What is left is read by the next run.
 */
const FORWARD_LIMIT = 25
/** Characters of a reply carried into the notice. */
const FORWARD_BODY_LIMIT = 4000
/**
 * The gap held between two notices. The mail provider answers 429 above ten
 * requests a second, and a run that reads a full mailbox would otherwise cross
 * that inside the first second and lose the rest of the batch to a refusal
 * that says nothing about the messages themselves.
 */
const NOTICE_GAP_MS = 150

let lastNotice = 0

export const config = { maxDuration: 120 }

const DAEMON = /^(mailer-daemon|postmaster|no-?reply)@/i

// The outreach mailbox is a working Google Workspace account, so alongside
// whatever a business writes back it receives that account's own
// administrative post: DMARC reports, billing notices, Search Console. None of
// that is somebody making contact, and an inbox filling with it every hour
// stops being read - which is the failure the carrying exists to prevent
// rather than to cause. So a message with no prospect behind it has to look
// like something a person typed. A prospect's own reply is carried whatever it
// looks like, because there the pipeline already knows who is writing.
const MACHINE_SENDER =
  /(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce|dmarc|abuse|notification|automated|billing)/i
// RFC 3834 and the conventions either side of it. Anything a mailing list, an
// auto-responder or a bulk sender sets on its own way out.
const AUTOMATED_HEADER =
  /^(auto-submitted:\s*auto|precedence:\s*(bulk|list|junk|auto_reply)|list-id:|list-unsubscribe:|x-auto-response-suppress:|feedback-id:|x-autoreply:|x-autorespond:)/im
const FINAL_RECIPIENT = /^final-recipient:\s*rfc822;\s*<?([^\s>]+)>?/im
const ORIGINAL_RECIPIENT = /^original-recipient:\s*rfc822;\s*<?([^\s>]+)>?/im
const FAILED_RECIPIENTS = /^x-failed-recipients:\s*<?([^\s,>]+)>?/im
const DELIVERY_STATUS = /^status:\s*([245])\.\d+\.\d+/im
const DIAGNOSTIC_CODE = /^diagnostic-code:\s*smtp;\s*([245])\d\d/im

/** The address out of a "Name <box@example.com>" pair, lowercased. */
const addressOf = value =>
  String(value ?? '')
    .trim()
    .toLowerCase()

/** One part of a message as text, read no further than the limit allows. */
async function download(client, uid, part, limit) {
  try {
    const { content } = await client.download(uid, part, { uid: true })
    if (!content) return ''
    let text = ''
    for await (const chunk of content) {
      text += chunk.toString('utf8')
      if (text.length >= limit) {
        content.destroy?.()
        break
      }
    }
    return text.slice(0, limit)
  } catch {
    return ''
  }
}

/** The identifier of the first part of a given type, walking a message's structure. */
function partOfType(node, type) {
  if (!node) return null
  if (String(node.type ?? '').toLowerCase() === type) return node.part || '1'
  for (const child of node.childNodes ?? []) {
    const found = partOfType(child, type)
    if (found) return found
  }
  return null
}

const HTML_COMMENT = /<!--[\s\S]*?-->/g
/** The parts of a page nobody reads: what the head holds, styles and scripts. */
const HTML_UNREAD = /<(head|style|script|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi
/** Marks a mail client writes into text that never show, and never should. */
const INVISIBLE = /\ufeff|\u200b|\u200c|\u200d|\u00ad/g
/** The tags that start or end a line of their own. */
const LINE_TAGS = new Set([
  'p',
  'div',
  'tr',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'table',
  'pre',
  'ul',
  'ol',
  'hr',
])
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** The characters an HTML entity stands for. */
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === '#') {
      const point =
        code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1))
      return Number.isFinite(point) && point > 0 && point < 0x110000
        ? String.fromCodePoint(point)
        : whole
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? whole
  })
}

/**
 * The words on an HTML page, one line per line, with quoted copy marked.
 *
 * A mail client that writes HTML alone wraps the message it is answering in a
 * blockquote, where a plain-text client marks every quoted line with '>'. The
 * marks are what the opt-out reader cuts on and what a person skims past, so
 * the quoted copy comes out marked the same way whichever client wrote it: a
 * reply that says "go on then" above a quoted copy of the outreach footer
 * reads as "go on then" and not as the footer.
 *
 * Exported for the case suite; the mailbox reader is the only caller.
 *
 * @param {string} html
 * @returns {string}
 */
export function textOfHtml(html) {
  const source = String(html ?? '')
    .replace(HTML_COMMENT, '')
    .replace(HTML_UNREAD, '')
  const lines = []
  let line = ''
  let depth = 0
  const flush = () => {
    const words = decodeEntities(line).replace(INVISIBLE, '').replace(/\s+/g, ' ').trim()
    lines.push(depth ? `${'> '.repeat(depth)}${words}`.trimEnd() : words)
    line = ''
  }

  for (const token of source.split(/(<[^>]*>)/)) {
    if (!token) continue
    if (token[0] !== '<') {
      line += token
      continue
    }
    const name = /^<\/?\s*([a-z0-9]+)/i.exec(token)?.[1]?.toLowerCase()
    if (!name) continue
    if (name === 'blockquote') {
      flush()
      depth = Math.max(0, depth + (token[1] === '/' ? -1 : 1))
      continue
    }
    if (name === 'br' || LINE_TAGS.has(name)) flush()
    // Two cells on one row are two words, not one.
    else if (name === 'td' || name === 'th') line += ' '
  }
  flush()

  // Runs of empty lines say nothing a single one does not, and a table laid
  // out as mail produces a great many of them.
  const kept = []
  for (const entry of lines) {
    const blank = /^[>\s]*$/.test(entry)
    if (blank && (!kept.length || /^[>\s]*$/.test(kept[kept.length - 1]))) continue
    kept.push(entry)
  }
  while (kept.length && /^[>\s]*$/.test(kept[kept.length - 1])) kept.pop()
  return kept.join('\n')
}

/**
 * What a person wrote, out of the parts a message is made of.
 *
 * The plain part is the words themselves and is read where there is one. A
 * message with no plain part - which is what Apple Mail sends when it answers
 * an HTML message - is read from its HTML part instead, with the markup taken
 * off. A message with neither is left empty. It is never read whole, because a
 * whole message is its headers and its encoded parts, which is a source
 * listing and not something anybody typed, and a body that holds one is a body
 * nobody can read.
 *
 * Exported for the case suite; the mailbox reader is the only caller.
 *
 * @param {object|null} structure The message's body structure as the mailbox described it.
 * @param {(part: string, limit: number) => Promise<string>} fetchPart Reads one part, decoded.
 * @returns {Promise<string>}
 */
export async function readableBody(structure, fetchPart) {
  const plain = partOfType(structure, 'text/plain')
  if (plain) {
    const text = await fetchPart(plain, BODY_LIMIT)
    if (text.trim()) return text
  }
  const html = partOfType(structure, 'text/html')
  if (!html) return ''
  return textOfHtml(await fetchPart(html, HTML_LIMIT)).slice(0, BODY_LIMIT)
}

/** Whether a message is a mail server reporting on one of ours. */
/**
 * Whether a message reads as something a person sat down and wrote.
 *
 * Two readings, because either one alone lets the other's traffic through. The
 * address covers the senders that name themselves - a `noreply`, a `dmarc`, a
 * billing desk - and the headers cover the ones that do not but declare
 * themselves on the way out, which is what `Auto-Submitted` and `Precedence`
 * are for. A sender doing neither is taken at face value and carried, since
 * the cost of reading one message that turns out to be a robot is a great deal
 * lower than the cost of dropping one that turns out to be a customer.
 *
 * @param {object} message One message as the mailbox handed it over.
 * @returns {boolean}
 */
function writtenByAPerson(message) {
  const from = addressOf(message.envelope?.from?.[0]?.address)
  if (!from) return false
  if (MACHINE_SENDER.test(from.split('@')[0])) return false
  return !AUTOMATED_HEADER.test(message.headerText || '')
}

function looksLikeBounce(message) {
  const from = addressOf(message.envelope?.from?.[0]?.address)
  if (DAEMON.test(from)) return true
  return /multipart\/report/i.test(message.headerText)
}

/**
 * The address a bounce is about and whether the failure is permanent. A report
 * that names neither a status nor a diagnostic code is left for a person,
 * since guessing at it would hold a working address off outreach for good.
 */
function bounceDetail(report, headerText) {
  const text = `${report}\n${headerText}`
  const recipient =
    FINAL_RECIPIENT.exec(text)?.[1] ??
    ORIGINAL_RECIPIENT.exec(text)?.[1] ??
    FAILED_RECIPIENTS.exec(headerText)?.[1] ??
    null
  const severity = DELIVERY_STATUS.exec(text)?.[1] ?? DIAGNOSTIC_CODE.exec(text)?.[1] ?? null
  return { recipient: recipient ? addressOf(recipient) : null, permanent: severity === '5' }
}

/** Everything in the mailbox from the last week, with its structure and headers. */
async function readMailbox() {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: USER, pass: PASSWORD },
    logger: false,
    emitLogs: false,
  })

  await client.connect()
  const lock = await client.getMailboxLock(MAILBOX)
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    const uids = await client.search({ since }, { uid: true })
    if (!uids || !uids.length) return []

    const wanted = uids.slice(-MAX_MESSAGES)
    const messages = []
    for await (const message of client.fetch(
      wanted.join(','),
      { uid: true, envelope: true, bodyStructure: true, headers: true },
      { uid: true }
    )) {
      messages.push({
        uid: message.uid,
        envelope: message.envelope,
        bodyStructure: message.bodyStructure,
        headerText: message.headers ? message.headers.toString('utf8') : '',
      })
    }

    // The bodies are read while the mailbox is still open. A bounce with no
    // delivery-status part is read whole, since the report the run needs can
    // sit anywhere in it; a reply is read from the part a person wrote.
    for (const message of messages) {
      message.bounce = looksLikeBounce(message)
      if (message.bounce) {
        const part = partOfType(message.bodyStructure, 'message/delivery-status') ?? null
        message.body = await download(client, message.uid, part, BODY_LIMIT)
        continue
      }
      message.body = await readableBody(message.bodyStructure, (part, limit) =>
        download(client, message.uid, part, limit)
      )
    }

    return messages
  } finally {
    lock.release()
    await client.logout().catch(() => {})
  }
}

/** The Message-IDs already recorded, out of the ones just read. */
async function alreadyRecorded(db, ids) {
  if (!ids.length) return new Set()
  const { data, error } = await db
    .from('outreach_messages')
    .select('provider_id')
    .eq('direction', 'inbound')
    .in('provider_id', ids)
  if (error) throw new Error(error.message)
  return new Set(data.map(row => row.provider_id))
}

/** The prospects behind a set of addresses, keyed by address. */
async function prospectsFor(db, emails) {
  if (!emails.length) return new Map()
  const { data, error } = await db
    .from('outreach_prospects')
    .select('id, email, name, website, stage, replied_at')
    .in('email', emails)
  if (error) throw new Error(error.message)
  return new Map(data.map(row => [addressOf(row.email), row]))
}

/** Messages a run reconciles clicks and enquiries for, newest first. */
const CLICK_BATCH = 200

/**
 * Clicks out of a cold message, read off the site's own arrivals.
 *
 * A cold message's links are plain first-party addresses rather than hops
 * through a counter, so nothing tells the sender directly that one was
 * followed. What does is the site: every link carries the message's own token
 * in `utm_content`, and an arrival lands in `analytics_events` with that token
 * on it. Matching the two is what turns a visit into a click on a message.
 *
 * It is done here rather than at the moment of arrival because the site's
 * collector has no business writing to the outreach tables, and because a
 * click is worth knowing about within the hour rather than within the second.
 *
 * The first click is kept where it stands and the count is the arrivals seen,
 * so a business that came back twice reads differently from one that glanced.
 */
async function reconcileClicks(db) {
  const { data: messages, error } = await db
    .from('outreach_messages')
    .select('id, track_token, clicked_at')
    .eq('direction', 'outbound')
    .not('track_token', 'is', null)
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(CLICK_BATCH)
  if (error) throw new Error(error.message)
  if (!messages.length) return 0

  const tokens = messages.map(row => row.track_token)
  const arrivals = await db
    .from('analytics_events')
    .select('utm_content, created_at')
    .eq('utm_source', 'outreach')
    .in('utm_content', tokens)
  // The analytics tables belong to the collector rather than to this
  // repository, so a deployment without them is a pipeline with no click
  // reading rather than a watch run that failed.
  if (arrivals.error) return 0

  const seen = new Map()
  for (const row of arrivals.data) {
    const held = seen.get(row.utm_content)
    if (!held) {
      seen.set(row.utm_content, { first: row.created_at, last: row.created_at, count: 1 })
      continue
    }
    held.count += 1
    if (row.created_at < held.first) held.first = row.created_at
    if (row.created_at > held.last) held.last = row.created_at
  }

  let moved = 0
  for (const message of messages) {
    const found = seen.get(message.track_token)
    if (!found) continue
    const written = await db
      .from('outreach_messages')
      .update({
        clicked_at: message.clicked_at ?? found.first,
        last_click_at: found.last,
        click_count: found.count,
      })
      .eq('id', message.id)
    if (written.error) throw new Error(written.error.message)
    if (!message.clicked_at) moved += 1
  }
  return moved
}

/**
 * Enquiries out of a cold message, read off the site's own forms.
 *
 * A click says a business looked. This says one of them wrote in, which is the
 * only reading in the pipeline that a decision about where to spend the sends
 * can rest on: an opener that earns looks and no enquiries is an opener that
 * does not work.
 *
 * It pairs the same two things the click reading does. `api/contact.js` files
 * the campaign a delivered enquiry arrived on, an outreach arrival carries the
 * message's own token in `utm_content`, and matching them names the message.
 * The enquiry itself is not read and is not here to be read - the table holds
 * the campaign and nothing about the sender.
 *
 * The first enquiry is kept where it stands and the count is the enquiries
 * seen, so a business that wrote twice reads differently from one that wrote
 * once.
 */
async function reconcileEnquiries(db) {
  const { data: messages, error } = await db
    .from('outreach_messages')
    .select('id, track_token, enquired_at')
    .eq('direction', 'outbound')
    .not('track_token', 'is', null)
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })
    .limit(CLICK_BATCH)
  if (error) throw new Error(error.message)
  if (!messages.length) return 0

  const tokens = messages.map(row => row.track_token)
  const written = await db
    .from('enquiry_attribution')
    .select('utm_content, created_at')
    .eq('utm_source', 'outreach')
    .in('utm_content', tokens)
  // A deployment that has not taken the migration yet is a pipeline with no
  // enquiry reading rather than a watch run that failed, which is the same
  // allowance the click reading makes for the collector's own tables.
  if (written.error) return 0

  const seen = new Map()
  for (const row of written.data) {
    const held = seen.get(row.utm_content)
    if (!held) {
      seen.set(row.utm_content, { first: row.created_at, last: row.created_at, count: 1 })
      continue
    }
    held.count += 1
    if (row.created_at < held.first) held.first = row.created_at
    if (row.created_at > held.last) held.last = row.created_at
  }

  let moved = 0
  for (const message of messages) {
    const found = seen.get(message.track_token)
    if (!found) continue
    const update = await db
      .from('outreach_messages')
      .update({
        enquired_at: message.enquired_at ?? found.first,
        last_enquiry_at: found.last,
        enquiry_count: found.count,
      })
      .eq('id', message.id)
    if (update.error) throw new Error(update.error.message)
    if (!message.enquired_at) moved += 1
  }
  return moved
}

/**
 * The readings taken off the site rather than out of the mailbox.
 *
 * What the site saw does not depend on what the mailbox holds, so both are
 * taken on every pass, including one that finds no mail at all. A pass that
 * returned early on an empty mailbox would leave a message clicked on a quiet
 * day unread until somebody happened to write in.
 */
async function reconcileReach(db, counts) {
  const clicks = await reconcileClicks(db)
  const enquiries = await reconcileEnquiries(db)
  counts.changed += clicks + enquiries
  return { clicks, enquiries }
}

/**
 * The notice one message from the mailbox becomes.
 *
 * The sender's own address rides on Reply-To, which is what makes an answer
 * written from the inbox reach the business rather than the mailbox this job
 * reads out of.
 *
 * A message from an address no prospect carries is still somebody writing in.
 * It is named as unmatched rather than dressed up as a reply, because the
 * pipeline has nothing to file it against and the reader is the one who can
 * tell whether it is a lead answering from a second address or a stranger.
 *
 * Exported because the mail console draws every family the studio sends from
 * the code that sends it, and a sample retyped somewhere else is a sample that
 * stops being the message the moment either copy moves.
 *
 * @param {object} message The address, subject and body as the mailbox held them.
 * @param {object|null} prospect The row the address matched, where one did.
 * @returns {{subject: string, text: string, html: string, replyTo: string}}
 */
export function replyNotice({ from, subject, body }, prospect) {
  const rows = [
    ['From', from],
    ['Business', prospect?.name || 'Not matched to a prospect'],
    ['Site', prospect?.website || 'Not given'],
    ['Standing', prospect?.stage || 'Not on the list'],
    ['Subject', subject || 'No subject'],
  ]
  return notice({
    label: prospect?.name ? 'Outreach reply' : 'Outreach mailbox',
    subject: prospect?.name
      ? `Outreach reply from ${prospect.name}`
      : `Outreach mailbox: message from ${from}`,
    rows,
    body: field(body, FORWARD_BODY_LIMIT),
    replyTo: from,
  })
}

/**
 * Puts one message in front of a person.
 *
 * The row is the record and this is the notification, so the send is read for
 * its error and logged rather than raised: a mail provider having a bad
 * morning must not cost a reply that is already stored, and must not stop the
 * run before the messages behind it are read.
 *
 * @param {object} message The address, subject and body as the mailbox held them.
 * @param {object|null} prospect The row the address matched, where one did.
 * @returns {Promise<boolean>} Whether a notice was handed over.
 */
async function forward(message, prospect) {
  // A deployment with no mail key hands nothing over, which is the state a
  // preview build and the case suite both run in.
  if (!RESEND_API_KEY) return false

  const notice = replyNotice(message, prospect)
  const { from } = message

  const wait = NOTICE_GAP_MS - (Date.now() - lastNotice)
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait))
  lastNotice = Date.now()

  try {
    await sendNotice(notice, RESEND_API_KEY)
    return true
  } catch (cause) {
    console.error('outreach watch: forwarding %s: %s', from, cause.message)
    return false
  }
}

/**
 * One pass over the mailbox.
 *
 * @param {object} run
 * @param {object} run.db A service-role client.
 * @param {{examined: number, changed: number}} run.counts Raised as it goes.
 * @param {() => Promise<object[]>} [run.read] Where the messages come from.
 */
export async function work({ db, counts, read = readMailbox }) {
  if (!USER || !PASSWORD) {
    return { error: 'OUTREACH_SMTP_USER or OUTREACH_SMTP_PASSWORD is not set' }
  }

  const messages = await read()
  if (!messages.length) return { read: 0, ...(await reconcileReach(db, counts)) }

  const recorded = await alreadyRecorded(
    db,
    messages.map(message => message.envelope?.messageId).filter(Boolean)
  )
  const fresh = messages.filter(message => !recorded.has(message.envelope?.messageId))

  // A bounce names the address that failed inside the report; a reply is from
  // the address itself. Both are looked up in one read.
  const wanted = new Set()
  for (const message of fresh) {
    if (message.bounce) {
      const { recipient } = bounceDetail(message.body, message.headerText)
      if (recipient) wanted.add(recipient)
    } else {
      const from = addressOf(message.envelope?.from?.[0]?.address)
      if (from) wanted.add(from)
    }
  }
  const prospects = await prospectsFor(db, [...wanted])

  const tally = {
    replies: 0,
    automatic: 0,
    optOuts: 0,
    bounces: 0,
    ignored: 0,
    soft: 0,
    forwarded: 0,
    deferred: 0,
  }
  const now = new Date().toISOString()

  for (const message of fresh) {
    counts.examined += 1
    const providerId = field(message.envelope?.messageId, 500)
    const subject = field(message.envelope?.subject, 500)
    const to = addressOf(message.envelope?.to?.[0]?.address) || USER.toLowerCase()
    const arrived = message.envelope?.date ? new Date(message.envelope.date).toISOString() : now

    if (message.bounce) {
      const { recipient, permanent } = bounceDetail(message.body, message.headerText)
      const prospect = recipient ? prospects.get(recipient) : null
      if (!prospect) {
        tally.ignored += 1
        continue
      }
      if (!permanent) {
        tally.soft += 1
        continue
      }

      const stage = await db
        .from('outreach_prospects')
        .update({ stage: 'bounced', bounced_at: now })
        .eq('id', prospect.id)
      if (stage.error) throw new Error(stage.error.message)

      // The address is held off every list, not just this one, which is the
      // same table the mailing list checks before it adds anybody.
      const held = await db
        .from('suppression')
        .upsert(
          { email: recipient, reason: 'bounced', note: 'outreach hard bounce' },
          { onConflict: 'email', ignoreDuplicates: true }
        )
      if (held.error) throw new Error(held.error.message)

      // Suppression stops the mail either way; this is what stops the mailing
      // list reporting the address as a live subscriber it can still reach.
      const listed = await db
        .from('subscribers')
        .update({ status: 'bounced', last_bounce_at: now })
        .eq('email', recipient)
        .not('status', 'in', '("unsubscribed","complained")')
      if (listed.error) throw new Error(listed.error.message)

      // Last of the group, and not to be moved up. A later run recognises this
      // report by this row, so everything the report has to bring with it is
      // written before it: ahead of them, a failure here leaves the report
      // recorded and the suppression missing, and nothing reads it again.
      const recorded = await db.from('outreach_messages').insert({
        prospect_id: prospect.id,
        direction: 'inbound',
        subject,
        body_text: field(message.body, BODY_LIMIT),
        from_address: addressOf(message.envelope?.from?.[0]?.address),
        to_address: to,
        status: 'bounced',
        provider_id: providerId,
        sent_at: arrived,
      })
      if (recorded.error) throw new Error(recorded.error.message)

      counts.changed += 1
      tally.bounces += 1
      continue
    }

    const from = addressOf(message.envelope?.from?.[0]?.address)
    const prospect = prospects.get(from)
    if (!prospect) {
      // Nothing to file it against, which is not the same as nothing to read.
      // A business answering from an address other than the one written to
      // arrives exactly like this, and so does anybody who was handed the
      // address rather than the reply button. What the mailbox's own
      // administrative post arrives as is the same shape, so only the messages
      // that read as written by somebody are carried.
      if (tally.forwarded < FORWARD_LIMIT && writtenByAPerson(message)) {
        if (await forward({ from, subject, body: message.body }, null)) tally.forwarded += 1
      }
      tally.ignored += 1
      continue
    }

    // The row is what stops a later run reading this message again, and the
    // notice is the only thing that puts it in front of a person. Writing one
    // without the other spends the retry on a reply nobody is told about, and
    // nothing reads it a second time to notice. So the pass stops here rather
    // than recording past the cap, and leaves the rest for the next run, which
    // starts with the budget full.
    if (tally.forwarded >= FORWARD_LIMIT) {
      counts.examined -= 1
      tally.deferred = fresh.length - counts.examined
      break
    }

    const asked = readOptOut(message.body)
    // An auto-responder is not a reply. A mailbox that answers "thank you for
    // contacting us" the moment anything lands would otherwise move the
    // business to 'replied', end its chain and be counted as the thing every
    // letter is trying to earn, on the strength of nobody having read it. The
    // opt-out reading comes first, so a person who typed "stop" under an
    // automatic subject line is still heard.
    const machine = asked.optOut
      ? { auto: false, phrase: null }
      : readAutoReply(subject, message.body)

    // A machine's answer is filed against the business and forwarded, so the
    // reply is not lost, and leaves the standing exactly as it was: the
    // business is still waiting on its next letter, because it is.
    if (!machine.auto) {
      const stage = await db
        .from('outreach_prospects')
        .update({
          stage: asked.optOut ? 'unsubscribed' : 'replied',
          replied_at: prospect.replied_at ?? now,
        })
        .eq('id', prospect.id)
      if (stage.error) throw new Error(stage.error.message)
    }

    if (asked.optOut) {
      // The stage stops this pipeline and the suppression stops the rest, so
      // an address that asked once is off every list without asking again.
      const held = await db
        .from('suppression')
        .upsert(
          { email: from, reason: 'unsubscribed', note: `outreach reply: ${asked.phrase}` },
          { onConflict: 'email', ignoreDuplicates: true }
        )
      if (held.error) throw new Error(held.error.message)

      // The same address on the mailing list is the same person asking, so the
      // reply closes both standings rather than only the one it arrived on.
      const listed = await db
        .from('subscribers')
        .update({ status: 'unsubscribed', unsubscribed_at: now })
        .eq('email', from)
        .neq('status', 'unsubscribed')
      if (listed.error) throw new Error(listed.error.message)
    }

    // The phrase is written beside the message it was read from, so a
    // suppressed prospect carries the sentence that suppressed it rather than
    // a flag nothing accounts for.
    //
    // Last of the group, and not to be moved up. A later run recognises this
    // reply by this row, so the stage and the suppression are written before
    // it: ahead of them, a failure here leaves a business that asked to be left
    // alone marked as answered and still on the list.
    const recorded = await db.from('outreach_messages').insert({
      prospect_id: prospect.id,
      direction: 'inbound',
      subject,
      body_text: field(message.body, BODY_LIMIT),
      from_address: from,
      to_address: to,
      status: 'received',
      intent: asked.optOut ? 'opt_out' : machine.auto ? 'auto_reply' : null,
      intent_phrase: asked.optOut
        ? field(asked.phrase, PHRASE_LIMIT)
        : machine.auto
          ? field(machine.phrase, PHRASE_LIMIT)
          : null,
      provider_id: providerId,
      sent_at: arrived,
    })
    if (recorded.error) throw new Error(recorded.error.message)

    // After the row, for the reason the row is written last: a notice handed
    // over before the reply is stored is a reply that can be answered and then
    // lost. After it, the worst a refusal costs is a message the console still
    // holds.
    if (tally.forwarded < FORWARD_LIMIT) {
      if (await forward({ from, subject, body: message.body }, prospect)) tally.forwarded += 1
    }

    if (asked.optOut) tally.optOuts += 1
    else if (machine.auto) tally.automatic += 1
    else tally.replies += 1

    counts.changed += 1
  }

  const reach = await reconcileReach(db, counts)

  return { read: messages.length, fresh: fresh.length, ...reach, ...tally }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runJob({ request, response, job: 'watch', work })
}
