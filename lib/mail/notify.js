/**
 * A notification sent on behalf of a client project, rather than by the studio.
 *
 * The studio runs a dozen sites and every one of them eventually needs to tell
 * somebody something: a trading desk that has found a setup, a shop whose order
 * failed, a monitor that has gone quiet. Left to themselves each of those grows
 * its own sender - a second domain to warm, a second frame to keep in step, a
 * second place for a message to stop arriving without anybody noticing. The
 * studio already runs one mail stack that works, and the honest way to give a
 * client project a voice is to lend it that one rather than to stand up another
 * beside it.
 *
 * So the transport, the sheet and the delivery are the studio's, and everything
 * a reader can see is the client's. That split is the whole design, and it is
 * held as data: a project becomes able to send by a row appearing in
 * `notify_projects`, not by a name appearing in a condition here. Nothing in
 * this file or in the endpoint above it knows what a Root & Rise is.
 *
 * Two things are worth saying about what is deliberately not here. There is no
 * template per project, because a notification is a heading, a short reading of
 * facts and one thing to open, and a project that needs its own layout needs
 * its own product rather than a branch in this one. And there is no plaintext
 * secret: the row carries a digest, the project holds the secret, and a
 * service-role read of the table - which the studio's own mail console
 * performs - therefore hands out nobody's sending credential.
 */

import { randomUUID } from 'node:crypto'
import { ACCENT } from './frame.js'
import { notice } from './notice.js'

/** The tables. Named once so a rename is one edit rather than nine strings. */
const PROJECTS = 'notify_projects'
export const RECIPIENTS = 'notify_recipients'
export const DELIVERIES = 'notify_deliveries'

/** The studio's own suppression list, which every send is filtered through. */
const SUPPRESSION = 'suppression'

/**
 * How loud a notification is, low to high.
 *
 * The order is the whole of the ladder: it decides who is reached, because a
 * recipient states the quietest thing they want woken for, and it decides
 * whether the message is marked urgent, because a header that marks everything
 * high marks nothing.
 */
export const SEVERITIES = ['info', 'warning', 'urgent']

/** What a caller that names no severity is taken to mean. */
export const DEFAULT_SEVERITY = 'info'

/** The eyebrow each severity is read under, in the client's own colour. */
const SEVERITY_LABELS = {
  info: 'Notice',
  warning: 'Warning',
  urgent: 'Urgent',
}

/**
 * What a project may send before it is refused, where its row names no figure
 * of its own. The burst window is the cheap refusal that never reaches a query;
 * the day is the one that actually holds, because it is counted in the table.
 */
export const DEFAULT_BURST = { limit: 12, windowMs: 10 * 60 * 1000 }
export const DEFAULT_DAILY = 120

/**
 * Room for a real notification and nothing beyond it.
 *
 * A value arriving longer than its cap is cut rather than refused, since the
 * length of a paste is not something the caller chose - except the request
 * itself, which is refused, because a body this endpoint has to parse before it
 * can measure is a body worth putting a ceiling on.
 */
export const CAPS = {
  subject: 140,
  label: 40,
  value: 160,
  lines: 16,
  body: 4000,
  url: 500,
  key: 200,
  recipients: 20,
  request: 16 * 1024,
}

/** The side of the square a project's mark is drawn at, in pixels. */
const MARK_SIZE = 64

/**
 * How many recipient rows one send reads before the cap is applied.
 *
 * The cap is on who is reached; this is on what is read to decide it, and the
 * two differ because the suppression list can take addresses out between them.
 * Reading a multiple of the cap leaves room for that without letting a project
 * with a mailing list in this table turn one notification into a full scan.
 */
const RECIPIENT_ROWS = CAPS.recipients * 4

/** The shape of an idempotency key: something a caller can build a name out of. */
const KEY_PATTERN = /^[A-Za-z0-9:_.-]{1,200}$/

/** The columns a send needs off a project. The secret digest is not one of them. */
const PROJECT_COLUMNS =
  'id, slug, name, from_name, from_address, reply_to, accent, mark_url, mark_ground, ' +
  'site_url, link_label, footer_line, burst_limit, daily_limit, active'

/** Where a mark named by path is served from. */
const SITE_URL = process.env.SITE_URL || 'https://www.taylorurl.com'

/**
 * The address a project with none of its own leaves from.
 *
 * Resend accepts a From only on a domain verified against the account, so a
 * client whose own domain is not verified yet sends from the studio's with
 * their name in front of it. Moving them to their own address afterwards is one
 * column changing and nothing else.
 */
const FROM_ADDRESS = process.env.NOTIFY_FROM_ADDRESS || 'notifications@taylorurl.com'

/**
 * Whether a notification at `severity` reaches a recipient who asked to be
 * woken at `floor` and no quieter.
 *
 * A floor this ladder does not recognise reaches nothing. The column's own
 * CHECK makes that unreachable through the database, and a comparison that
 * silently treated an unknown value as the lowest would mail a corrupt row
 * everything rather than nothing.
 *
 * @param {string} severity What the notification says it is.
 * @param {string} floor The quietest thing this recipient wants.
 * @returns {boolean}
 */
export function reaches(severity, floor) {
  const at = SEVERITIES.indexOf(floor)
  return at !== -1 && SEVERITIES.indexOf(severity) >= at
}

/**
 * The floors a notification at this severity reaches, so the ladder is applied
 * by the database rather than by reading every recipient back and filtering.
 *
 * @param {string} severity
 * @returns {string[]}
 */
export function floorsReached(severity) {
  const at = SEVERITIES.indexOf(severity)
  return at === -1 ? [] : SEVERITIES.slice(0, at + 1)
}

/** The project holding this secret's digest, or null. */
export async function projectByDigest(db, digest) {
  const { data, error } = await db
    .from(PROJECTS)
    .select(PROJECT_COLUMNS)
    .eq('secret_sha256', digest)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

/** The project with this slug, or null. Only the studio's own caller may ask. */
export async function projectBySlug(db, slug) {
  const { data, error } = await db
    .from(PROJECTS)
    .select(PROJECT_COLUMNS)
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

/** A mark named by path, as the absolute address a mail client can fetch. */
function markUrlOf(value) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const origin = SITE_URL.replace(/\/+$/, '')
  return `${origin}${value.startsWith('/') ? '' : '/'}${value}`
}

/** The project's own domain, as a reader would say it. */
function hostOf(value) {
  if (!value) return ''
  try {
    return new URL(value).host.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

/**
 * A project's row, as the sheet needs it.
 *
 * The mark is drawn at a fixed 64 because that is what the capture script
 * writes: every client mark the studio holds is the same shape of file at the
 * same optical weight, and a row that named its own dimensions would be a row
 * that could disagree with the picture behind it.
 *
 * @param {object} project A row from `notify_projects`.
 * @returns {object} A brand `lib/mail/frame.js` can draw.
 */
export function brandOf(project) {
  const host = hostOf(project.site_url)
  return {
    name: project.name,
    markUrl: markUrlOf(project.mark_url),
    markWidth: MARK_SIZE,
    markHeight: MARK_SIZE,
    // A client mark is a badge rather than a name drawn out, so the name is set
    // beside it. It is also what an image-blocking client is left with.
    wordmark: false,
    annotation: host ? [host] : [],
    ground: project.mark_ground === 'dark' ? 'dark' : 'light',
    accent: project.accent || ACCENT,
    footer: project.footer_line || project.name,
  }
}

/**
 * A display name that survives being put in front of an address.
 *
 * A name carrying a comma or a full stop splits the header it lands in, so
 * anything outside the safe set is quoted rather than trusted. A control
 * character is taken out instead of quoted, because quoting a return does not
 * make it safe - it is still the character that ends a header line, and the
 * rest of the name would land as one of its own.
 */
function displayName(name) {
  const held = String(name)
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return /^[A-Za-z0-9 &'+-]+$/.test(held) ? held : `"${held.replace(/["\\]/g, '\\$&')}"`
}

/**
 * Who a project's notification leaves as, and whether it is marked urgent.
 *
 * The address has to be on a domain verified against the studio's Resend
 * account, which is why it is a column rather than a guess off the project's
 * own site: a project whose domain is not verified yet sends from the studio's
 * with its own name in front, and moving to its own address later is one
 * column changing.
 *
 * @param {object} project
 * @param {string} severity
 * @returns {{from: string, urgent: boolean}}
 */
export function envelopeFor(project, severity) {
  return {
    from: `${displayName(project.from_name)} <${project.from_address || FROM_ADDRESS}>`,
    urgent: severity === 'urgent',
  }
}

/**
 * Who this notification reaches.
 *
 * Three filters, and each of them exists because of a different way a
 * notification goes wrong. The severity floor is the recipient's own standing,
 * so the studio can hold a seat on the loud ones without a second list. The
 * suppression list is the studio's hard rule that an address which has
 * unsubscribed or hard bounced is reached by nothing at all, and it is checked
 * here rather than trusted to whoever wrote the recipient row. The cap is on
 * this endpoint being a notifier rather than a mailing list: twenty people is a
 * team, and anything beyond it is a broadcast that belongs somewhere with an
 * unsubscribe link on it.
 *
 * @param {object} db A service-role client.
 * @param {object} project
 * @param {string} severity
 * @returns {Promise<Array<{email: string, name: string|null}>>}
 */
export async function recipientsFor(db, project, severity) {
  const floors = floorsReached(severity)
  if (floors.length === 0) return []

  const { data, error } = await db
    .from(RECIPIENTS)
    .select('email, name, min_severity')
    .eq('project_id', project.id)
    .eq('active', true)
    .in('min_severity', floors)
    .order('created_at', { ascending: true })
    .limit(RECIPIENT_ROWS)
  if (error) throw error

  const wanted = data || []
  if (wanted.length === 0) return []

  const held = await db
    .from(SUPPRESSION)
    .select('email')
    .in(
      'email',
      wanted.map(row => String(row.email))
    )
  if (held.error) throw held.error

  const barred = new Set((held.data || []).map(row => String(row.email).toLowerCase()))
  return wanted
    .filter(row => !barred.has(String(row.email).toLowerCase()))
    .slice(0, CAPS.recipients)
    .map(row => ({ email: String(row.email), name: row.name ?? null }))
}

/** A single-line field. A break in one of these is a way to write a header. */
function line(value, limit) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, limit)
}

/** A written block, which keeps its paragraphs and loses its stray returns. */
function block(value, limit) {
  if (typeof value !== 'string') return ''
  return value.replace(/\r\n?/g, '\n').trim().slice(0, limit)
}

/**
 * The facts, as pairs the sheet can set in two columns.
 *
 * A malformed pair is dropped rather than refused, and so is everything past
 * the sixteenth. Neither is worth failing a notification over: the caller is a
 * deployment reporting something that has already happened, and refusing the
 * whole message because the eighteenth row was badly shaped would lose the
 * seventeen that were fine along with the thing they were about.
 */
function readLines(value) {
  if (!Array.isArray(value)) return []
  const rows = []
  for (const entry of value) {
    if (rows.length >= CAPS.lines) break
    if (!Array.isArray(entry) || entry.length < 2) continue
    const [label, said] = entry
    if (typeof label !== 'string' || typeof said !== 'string') continue
    const name = line(label, CAPS.label)
    const held = line(said, CAPS.value)
    if (!name || !held) continue
    rows.push([name, held])
  }
  return rows
}

/**
 * The one thing the reader is asked to open, or a refusal.
 *
 * Only `https:` passes. A notification is a message a person is told to act on
 * in a hurry, and a scheme this endpoint accepted without reading would make it
 * a way to put `javascript:` or a bare `http:` login page in front of somebody
 * in the client's own name.
 *
 * @returns {{link: object|null}|{error: string}}
 */
function readLink(value, project) {
  if (value === undefined || value === null) return { link: null }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'A link is an object with a url on it.' }
  }

  const url = line(value.url, CAPS.url)
  if (!url) return { error: 'A link needs a url.' }

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return { error: 'That link is not an address.' }
  }
  if (parsed.protocol !== 'https:') return { error: 'A link has to be https.' }

  const label = line(value.label, CAPS.label) || project.link_label || project.name
  return { link: { label: line(label, CAPS.label), url } }
}

/**
 * One posted body, read into the notification it describes, or the first thing
 * wrong with it.
 *
 * Everything is measured again here rather than trusted, because the caller is
 * a machine on somebody else's deployment and the subject reaches a mail
 * header. Unknown fields are ignored rather than refused, so a caller can start
 * sending a field before this endpoint has learned it.
 *
 * @param {object} body The posted JSON.
 * @param {object} project The project the credential resolved to.
 * @returns {{notification: object}|{error: string}}
 */
export function readNotification(body, project) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Send a JSON object.' }
  }

  const subject = line(body.subject, CAPS.subject)
  if (!subject) return { error: 'A notification needs a subject.' }

  const severity = body.severity === undefined ? DEFAULT_SEVERITY : body.severity
  if (!SEVERITIES.includes(severity)) {
    return { error: `Severity is one of ${SEVERITIES.join(', ')}.` }
  }

  const lines = readLines(body.lines)
  const written = block(body.body, CAPS.body)
  if (lines.length === 0 && !written) {
    return { error: 'A notification carries lines, a body, or both.' }
  }

  const read = readLink(body.link, project)
  if (read.error) return { error: read.error }

  let key = body.idempotency_key
  if (key === undefined || key === null || key === '') key = randomUUID()
  else if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
    return { error: 'An idempotency key is up to 200 letters, digits, : _ . or -.' }
  }

  return { notification: { subject, severity, lines, body: written, link: read.link, key } }
}

/**
 * One notification, drawn as the project rather than as the studio.
 *
 * @param {object} project A row from `notify_projects`.
 * @param {object} notification What `readNotification` returned.
 * @returns {{subject: string, text: string, html: string, replyTo?: string}}
 */
export function clientNotice(project, notification) {
  return notice({
    label: SEVERITY_LABELS[notification.severity] || SEVERITY_LABELS[DEFAULT_SEVERITY],
    subject: notification.subject,
    rows: notification.lines,
    body: notification.body,
    ...(project.reply_to ? { replyTo: project.reply_to } : {}),
    ...(notification.link ? { link: notification.link } : {}),
    brand: brandOf(project),
  })
}
