/**
 * Everything the site sends, in one place, and a way to read any of it as mail.
 *
 * Four systems send from this domain and each one keeps a different amount of
 * what it sent. Cold outreach stores the message whole. The newsletter stores
 * the issue and draws the letter again from it, which is exact because an
 * issue is frozen the moment it goes. The enquiry notice and the signup
 * confirmation keep nothing at all, by design in the first case and by having
 * nowhere to put it in the second. So this answers two different questions
 * with one shape: what went out, to whom and when, where a row exists; and
 * what a message of that kind looks like, where none does.
 *
 * Nothing here reaches a reader. Every body leaves through `lib/mail/preview.js`
 * first, which takes out the image standing in front of the open counter, the
 * link that would take a business off the list, and the campaign tag that
 * files a visit against the message that caused it. A console that recorded an
 * open every time it was scrolled would turn the studio's own reading into the
 * prospect's, and the one number the outreach engine is steered by would be a
 * record of somebody looking at it.
 *
 * GET answers one of three views:
 *
 *   ?view=list&system=…&page=…   what has gone out, newest first, across every
 *                                system that keeps a record
 *   ?view=message&id=…           one of those, whole, both halves
 *   ?view=family&id=…            a message of a kind that keeps no record,
 *                                drawn from a sample by the code that sends it
 *
 * POST carries one action:
 *
 *   { action: 'send', id }       the same message, into the account's own inbox
 *
 * The recipient of that send is not in the request. It is read off the session
 * the caller proved, so the only inbox this endpoint can reach is the one
 * belonging to whoever is signed in. A console that took an address from the
 * browser would be a way to send the studio's own mail to a stranger, and no
 * amount of checking the address afterwards would make it not one.
 */
import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { uuid } from '../lib/db/fields.js'

import { FAMILIES, renderFamily } from '../lib/mail/catalogue.js'
import { inertHtml, inertText } from '../lib/mail/preview.js'
import { shotUrl } from '../lib/outreach/audit/shot.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_ENDPOINT = 'https://api.resend.com/emails'

// The address a copy arrives from. One of the studio's own verified senders
// rather than the address the original went out as, so a copy sitting in the
// inbox is not a message that appears to have come from a prospect's own
// correspondent.
const FROM = process.env.NEWSLETTER_FROM || 'TaylorURL <notes@taylorurl.com>'

// The subject a copy arrives under, so a cold message in the studio's own
// inbox cannot be mistaken for one a prospect received. `scripts/mail/preview-emails.mjs`
// has marked its copies this way since before there was a console.
const SUBJECT_PREFIX = '[Preview] '

const PAGE_SIZE = 25

// How far back a page of the union is assembled from. The systems are separate
// tables with no common key, so a page is merged rather than queried: this many
// of the most recent rows from each, sorted together, and the page taken out of
// that. Beyond it the older half of one system could be hidden by the newer
// half of another, so the endpoint says how deep it reached rather than
// implying it read everything.
const MERGE_DEPTH = 500

/**
 * A driver fault, with the driver's own words kept out of the answer.
 *
 * Postgres names tables, columns and constraints in a message, and the mail
 * provider answers a refusal with a body of its own. Both go to the log, where
 * they are what we need to find the cause; the console gets the sentence for
 * whichever thing did not happen.
 */
function faulted(error, said) {
  console.error('mail-admin: %s', error?.message || error)
  return said
}

/** What is said when the record of what has gone out will not come back. */
const SENT_UNREAD = 'The sent mail could not be read. Try again in a moment.'

/** An id as the console carries it: which system, and which row inside it. */
function readId(value) {
  const raw = typeof value === 'string' ? value : ''
  const at = raw.indexOf(':')
  if (at === -1) return null
  return { system: raw.slice(0, at), key: raw.slice(at + 1) }
}

/**
 * What has gone out, from every system that keeps a record of it.
 *
 * Outreach and the newsletter are read separately because they are separate
 * tables holding different things, and merged on the one field they agree on,
 * which is when the message left.
 */
async function sent(db, { system, search }) {
  const rows = []

  if (system === 'all' || system === 'outreach') {
    let query = db
      .from('outreach_messages')
      .select('id, subject, to_address, from_address, status, sent_at, open_count, prospect_id')
      .eq('direction', 'outbound')
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(MERGE_DEPTH)
    if (search) query = query.or(`subject.ilike.%${search}%,to_address.ilike.%${search}%`)
    const found = await query
    if (found.error) return { error: faulted(found.error, SENT_UNREAD) }
    for (const row of found.data || []) {
      rows.push({
        id: `outreach:${row.id}`,
        system: 'outreach',
        subject: row.subject,
        to: row.to_address,
        from: row.from_address,
        status: row.status,
        sent_at: row.sent_at,
        opens: row.open_count ?? 0,
      })
    }
  }

  if (system === 'all' || system === 'newsletter') {
    let query = db
      .from('newsletter_sends')
      .select(
        'id, sent_at, failed_at, error, open_count, newsletter_issues(title), subscribers(email)'
      )
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(MERGE_DEPTH)
    const found = await query
    if (found.error) return { error: faulted(found.error, SENT_UNREAD) }
    for (const row of found.data || []) {
      const to = row.subscribers?.email ?? null
      const subject = row.newsletter_issues?.title ?? 'Newsletter issue'
      if (search) {
        const hay = `${subject} ${to ?? ''}`.toLowerCase()
        if (!hay.includes(search.toLowerCase())) continue
      }
      rows.push({
        id: `newsletter:${row.id}`,
        system: 'newsletter',
        subject,
        to,
        from: FROM,
        status: row.failed_at ? 'failed' : row.sent_at ? 'sent' : 'drafted',
        sent_at: row.sent_at,
        opens: row.open_count ?? 0,
      })
    }
  }

  rows.sort((one, two) => String(two.sent_at ?? '').localeCompare(String(one.sent_at ?? '')))
  return { rows }
}

/** One stored outreach message, disarmed. */
async function outreachMessage(db, id) {
  const found = await db
    .from('outreach_messages')
    .select(
      'id, subject, body_html, body_text, to_address, from_address, status, sent_at, open_count, prospect_id, outreach_prospects(name, website)'
    )
    .eq('id', id)
    .maybeSingle()
  if (found.error) {
    const said = faulted(found.error, 'That message could not be opened. Try again in a moment.')
    return { status: 500, body: { error: said } }
  }
  if (!found.data) return { status: 404, body: { error: 'That message is no longer here.' } }

  const row = found.data
  // The capture the counter stands in front of, handed over directly. Without
  // it the frame would draw blank where the whole point of the message is the
  // reader's own home page looking slow.
  const capture = row.prospect_id ? shotUrl(db, row.prospect_id) : null
  return {
    status: 200,
    body: {
      id: `outreach:${row.id}`,
      system: 'outreach',
      subject: row.subject,
      to: row.to_address,
      from: row.from_address,
      status: row.status,
      sent_at: row.sent_at,
      opens: row.open_count ?? 0,
      about: row.outreach_prospects?.name ?? null,
      html: inertHtml(row.body_html, { capture }),
      text: inertText(row.body_text),
    },
  }
}

/**
 * One newsletter send, drawn again from the issue behind it.
 *
 * The issue is frozen once it has been sent, so re-rendering it reproduces the
 * letter that left rather than a later draft of it.
 */
async function newsletterMessage(db, id) {
  const found = await db
    .from('newsletter_sends')
    .select('id, sent_at, failed_at, open_count, issue_id, subscribers(email, source, unsub_token)')
    .eq('id', id)
    .maybeSingle()
  if (found.error) {
    const said = faulted(found.error, 'That send could not be opened. Try again in a moment.')
    return { status: 500, body: { error: said } }
  }
  if (!found.data) return { status: 404, body: { error: 'That send is no longer here.' } }

  const { renderIssueEmail } = await import('../lib/mail/emailTemplate.js')
  const issue = await db
    .from('newsletter_issues')
    .select('id, slug, title, preheader, body')
    .eq('id', found.data.issue_id)
    .maybeSingle()
  if (issue.error) {
    const said = faulted(issue.error, 'That send could not be opened. Try again in a moment.')
    return { status: 500, body: { error: said } }
  }
  if (!issue.data) return { status: 404, body: { error: 'The issue behind that send is gone.' } }

  // The recipient's own row decides which of the issue's two letters they were
  // sent. Drawing against a stand-in subscriber shows the client copy to
  // everybody, including the two thirds of the list that never received it.
  const reader = found.data.subscribers ?? null
  const drawn = renderIssueEmail({
    issue: issue.data,
    subscriber: reader ?? { unsub_token: 'preview', source: 'outreach' },
    unsubscribeEndpoint: 'https://www.taylorurl.com/unsubscribe',
  })
  return {
    status: 200,
    body: {
      id: `newsletter:${found.data.id}`,
      system: 'newsletter',
      subject: drawn.subject,
      to: reader?.email ?? null,
      from: FROM,
      status: found.data.failed_at ? 'failed' : found.data.sent_at ? 'sent' : 'drafted',
      sent_at: found.data.sent_at,
      opens: found.data.open_count ?? 0,
      about: `${issue.data.title}, the ${drawn.audience} copy`,
      html: inertHtml(drawn.html),
      text: inertText(drawn.text),
    },
  }
}

/** A family that keeps no record, drawn from its sample. */
function familyMessage(slug) {
  const family = FAMILIES.find(one => one.slug === slug)
  if (!family) return { status: 404, body: { error: 'No message of that kind is sent from here.' } }
  if (family.previewable === false) {
    return { status: 409, body: { error: family.note } }
  }
  const drawn = renderFamily(slug)
  if (!drawn) return { status: 409, body: { error: family.note } }
  return {
    status: 200,
    body: {
      id: `family:${slug}`,
      system: family.system,
      subject: drawn.subject,
      to: null,
      from: family.from,
      status: 'sample',
      sent_at: null,
      about: family.label,
      html: inertHtml(drawn.html),
      text: inertText(drawn.text),
    },
  }
}

/** Whatever the id names, whole. */
async function message(db, id) {
  const named = readId(id)
  if (!named) return { status: 400, body: { error: 'Name the message to read.' } }
  if (named.system === 'family') return familyMessage(named.key)
  const key = uuid(named.key)
  if (!key) return { status: 400, body: { error: 'Name the message to read.' } }
  if (named.system === 'outreach') return outreachMessage(db, key)
  if (named.system === 'newsletter') return newsletterMessage(db, key)
  return { status: 400, body: { error: 'No system by that name sends mail.' } }
}

/**
 * One copy, into the inbox of whoever asked for it.
 *
 * The body has already been through the same disarming the screen shows, so a
 * copy read in a real mail client cannot move a figure either. That matters
 * more here than on screen: a mail client fetches the images itself, before
 * anybody has decided to look.
 */
async function deliver(to, drawn) {
  if (!RESEND_API_KEY) {
    return { status: 503, body: { error: 'No mail provider is configured for this deployment.' } }
  }
  const upstream = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject: `${SUBJECT_PREFIX}${drawn.subject}`,
      html: drawn.html,
      text: drawn.text,
    }),
  })
  if (!upstream.ok) {
    // The provider's refusal names the address it would not take and the rule
    // it broke, which is worth having in the log and is not what the console
    // draws: the copy either arrived or it did not.
    const detail = await upstream.text().catch(() => '')
    console.error(`mail-admin: the mail provider answered ${upstream.status}`, detail.slice(0, 500))
    return {
      status: 502,
      body: { error: 'That copy could not be sent. Try again in a moment.' },
    }
  }
  const answer = await upstream.json().catch(() => ({}))
  return { status: 200, body: { sent_to: to, provider_id: answer.id ?? null } }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const connected = connect()
  if (!connected) {
    return response.status(503).json({ error: 'This deployment cannot reach the database.' })
  }
  const authorization = request.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) {
    return response.status(401).json({ error: 'Sign in to read this.' })
  }

  const { db } = connected
  const account = await authorizeAdmin(connected, authorization)
  if (account.error) return response.status(account.status).json({ error: account.error })

  if (request.method === 'GET') {
    const view = String(request.query.view || 'list')

    if (view === 'message') {
      const found = await message(db, request.query.id)
      return response.status(found.status).json(found.body)
    }

    if (view === 'family') {
      const found = familyMessage(String(request.query.id || ''))
      return response.status(found.status).json(found.body)
    }

    const system = ['outreach', 'newsletter'].includes(String(request.query.system))
      ? String(request.query.system)
      : 'all'
    const search = String(request.query.search || '')
      .trim()
      .slice(0, 80)
    const page = Math.max(0, Number.parseInt(String(request.query.page || '0'), 10) || 0)

    const found = await sent(db, { system, search })
    if (found.error) return response.status(500).json({ error: found.error })

    const start = page * PAGE_SIZE
    return response.status(200).json({
      generated_at: new Date().toISOString(),
      account: account.email,
      families: FAMILIES,
      total: found.rows.length,
      capped: found.rows.length >= MERGE_DEPTH,
      page,
      pages: Math.max(1, Math.ceil(found.rows.length / PAGE_SIZE)),
      rows: found.rows.slice(start, start + PAGE_SIZE),
    })
  }

  if (request.method === 'POST') {
    const body = typeof request.body === 'object' && request.body ? request.body : {}
    if (body.action !== 'send') {
      return response.status(400).json({ error: 'That is not something this can do.' })
    }
    if (!account.email) {
      return response.status(409).json({ error: 'This account has no address to send to.' })
    }
    const found = await message(db, body.id)
    if (found.status !== 200) return response.status(found.status).json(found.body)
    const out = await deliver(account.email, found.body)
    return response.status(out.status).json(out.body)
  }

  response.setHeader('Allow', 'GET, POST')
  return response.status(405).json({ error: 'That method is not allowed here.' })
}
