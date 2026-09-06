/**
 * The newsletter's writing desk: the issues, their drafts, and the preview of
 * what a reader will actually receive.
 *
 * Drafts are unreachable with the publishable key, because `newsletter_issues`
 * opens only sent issues to a select and the console holds a session rather
 * than a service role. So every read of an unsent issue comes through here, on
 * the service role, behind the same two steps the audience endpoint takes: the
 * session is verified against the project, the account behind it is resolved
 * from `profiles`, and any role other than admin is refused.
 *
 * GET answers one of three views:
 *
 *   ?view=list             every issue, newest first, with what has gone out
 *                          against each and how many people the next one reaches
 *   ?view=issue&id=…       one issue, whole, including its body blocks
 *   ?view=preview&id=…     the message itself: subject, HTML part and plain-text
 *                          part, rendered for a real recipient
 *
 * POST carries one action:
 *
 *   { action: 'create',  title, slug }
 *   { action: 'save',    id, title, slug, preheader, body }
 *   { action: 'ready',   id, scheduled_for }
 *   { action: 'unready', id }
 *   { action: 'remove',  id }
 *
 * Sending is not one of them. It is `api/newsletter-send.js`, which the page
 * posts to directly: a send is the one act here that hands something to a
 * provider and cannot be taken back, and it answers for itself rather than
 * through a switch alongside four writes that can.
 *
 * The preview is rendered for a real recipient rather than a made-up one. A
 * message composed against a placeholder is a message whose unsubscribe link
 * has never been built from a token that exists, which is the one part of it
 * that has to work on the first try.
 */
import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { field, uuid } from '../lib/db/fields.js'
import {
  AUDIENCES,
  RECIPIENT_COLUMNS,
  selectRecipients,
  splitByAudience,
} from '../lib/mail/audience.js'
import {
  DRAFT,
  READY,
  SENT,
  hasContentFor,
  issueSlug,
  readBody,
  LIMITS,
} from '../lib/mail/issues.js'
import { readAll } from '../lib/db/rows.js'
import { renderIssueEmail } from '../src/app/utils/emailTemplate.js'

const SITE_URL = process.env.SITE_URL || 'https://www.taylorurl.com'
const UNSUBSCRIBE_PAGE = `${SITE_URL}/unsubscribe`

/** Issues the list carries, newest first. Long enough to hold years of them. */
const ISSUE_LIMIT = 60
/** Columns the list needs, which is everything about an issue except its body. */
const ISSUE_COLUMNS =
  'id, slug, title, preheader, status, scheduled_for, published_at, sent_at, created_at, updated_at'

/** The Postgres code for a unique violation, which here is a slug already taken. */
const UNIQUE_VIOLATION = '23505'
/** What the table's own trigger raises when a sent issue is written to. */
const RESTRICT_VIOLATION = '2F004'

/** A moment, or null. An unreadable date is no date rather than an error. */
function moment(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  const when = new Date(value)
  return Number.isNaN(when.getTime()) ? null : when.toISOString()
}

/** The slug taken from a title, which is what the composer offers as a default. */
function slugFrom(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.slug)
    .replace(/-+$/, '')
}

/**
 * How many people an issue sent right now would reach, on each side of the list.
 *
 * Counted through the same module the send selects through, so the figure on
 * the page and the list the run walks are the same question asked twice.
 * Suppression is taken off it here for the same reason the send takes it off:
 * an address held off the list is not a recipient however it reads on it.
 *
 * The split rather than the total, because the total answers a question nobody
 * has. A block written for one side reaches whoever is on that side, and one
 * number cannot say whether that is anybody.
 */
async function audienceSplit(db) {
  const [selected, held] = await Promise.all([
    readAll(() => selectRecipients(db, 'id, email, source')),
    readAll(() => db.from('suppression').select('email')),
  ])
  const suppressed = new Set(held.rows.map(row => String(row.email).toLowerCase()))
  return splitByAudience(
    selected.rows.filter(row => !suppressed.has(String(row.email).toLowerCase()))
  )
}

/**
 * Every issue, with what has gone out against each.
 *
 * A draft has no send rows and reports zeroes, which is the truth about it
 * rather than a gap. The audience split sits beside the list rather than on
 * each row, because it is the shape of the list today and not a property of any
 * one issue.
 */
async function list(db) {
  const [issues, audience] = await Promise.all([
    db
      .from('newsletter_issues')
      .select(ISSUE_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(ISSUE_LIMIT),
    audienceSplit(db),
  ])
  if (issues.error) return { status: 500, body: { error: issues.error.message } }

  const ids = issues.data.map(row => row.id)
  const tally = new Map(ids.map(id => [id, { claimed: 0, sent: 0, failed: 0 }]))
  if (ids.length) {
    const { rows } = await readAll(() =>
      db.from('newsletter_sends').select('issue_id, sent_at, failed_at').in('issue_id', ids)
    )
    for (const row of rows) {
      const held = tally.get(row.issue_id)
      if (!held) continue
      held.claimed += 1
      if (row.sent_at) held.sent += 1
      if (row.failed_at) held.failed += 1
    }
  }

  return {
    status: 200,
    body: {
      generated_at: new Date().toISOString(),
      audience,
      issues: issues.data.map(issue => ({ ...issue, ...tally.get(issue.id) })),
    },
  }
}

/** One issue, whole. */
async function read(db, query) {
  const id = uuid(query.id)
  if (!id) return { status: 400, body: { error: 'Name the issue to open.' } }
  const { data, error } = await db
    .from('newsletter_issues')
    .select(`${ISSUE_COLUMNS}, body`)
    .eq('id', id)
    .maybeSingle()
  if (error) return { status: 500, body: { error: error.message } }
  if (!data) return { status: 404, body: { error: 'That issue is no longer here.' } }
  return { status: 200, body: { generated_at: new Date().toISOString(), issue: data } }
}

/**
 * The message itself, both parts, for each side of the list.
 *
 * One issue reads differently to a client and to a prospect, so both copies are
 * drawn and the composer shows them side by side. A preview of one of them
 * hides exactly the mistake it exists to catch: a block marked for the wrong
 * side is invisible in the copy it stayed in and only shows up as an absence in
 * the copy it left.
 *
 * Both are rendered against one real recipient, which is the first person on
 * the list the send would reach, and the preview says who it was: a message
 * rendered for somebody is a message whose unsubscribe link points at a row
 * that exists, and naming them is what lets the reader of the preview tell a
 * working link from a plausible one. The side is named outright rather than
 * taken from that person, so one recipient yields both copies.
 *
 * An empty list is answered as an empty list rather than by substituting a
 * placeholder. Nothing to render for is the thing worth knowing at that
 * moment, and a preview that fills the gap hides it until the send reports
 * nought recipients.
 */
async function preview(db, query) {
  const id = uuid(query.id)
  if (!id) return { status: 400, body: { error: 'Name the issue to preview.' } }

  const [found, recipients, held] = await Promise.all([
    db.from('newsletter_issues').select(`${ISSUE_COLUMNS}, body`).eq('id', id).maybeSingle(),
    selectRecipients(db, RECIPIENT_COLUMNS).order('created_at', { ascending: true }).limit(25),
    readAll(() => db.from('suppression').select('email')),
  ])
  if (found.error) return { status: 500, body: { error: found.error.message } }
  if (!found.data) return { status: 404, body: { error: 'That issue is no longer here.' } }
  if (recipients.error) return { status: 500, body: { error: recipients.error.message } }

  const suppressed = new Set(held.rows.map(row => String(row.email).toLowerCase()))
  const reader = (recipients.data || []).find(
    row => row.unsub_token && !suppressed.has(String(row.email).toLowerCase())
  )
  if (!reader) {
    return {
      status: 200,
      body: {
        generated_at: new Date().toISOString(),
        issue: found.data,
        recipient: null,
        subject: null,
        copies: null,
      },
    }
  }

  // One render per side, through the same call the send composes with, so the
  // copy on the screen is the copy that goes out rather than a second drawing
  // of it. `empty` is the state the send refuses, stated here while it is still
  // one edit away from fixed.
  const drawn = AUDIENCES.map(audience => [
    audience,
    renderIssueEmail({
      issue: found.data,
      subscriber: reader,
      unsubscribeEndpoint: UNSUBSCRIBE_PAGE,
      siteUrl: SITE_URL,
      audience,
    }),
  ])
  const subject = drawn[0][1].subject
  const unsubscribeUrl = drawn[0][1].unsubscribeUrl
  const copies = Object.fromEntries(
    drawn.map(([audience, copy]) => [
      audience,
      { html: copy.html, text: copy.text, empty: !hasContentFor(found.data.body, audience) },
    ])
  )
  return {
    status: 200,
    body: {
      generated_at: new Date().toISOString(),
      issue: found.data,
      recipient: { email: reader.email, name: reader.name },
      unsubscribe: unsubscribeUrl,
      subject,
      copies,
    },
  }
}

/** A new draft, empty apart from the two things it is named by. */
async function create(db, body) {
  const title = field(body.title, LIMITS.title)
  if (!title) return { status: 400, body: { error: 'Give the issue a title.' } }
  const slug = issueSlug(body.slug) || issueSlug(slugFrom(title))
  if (!slug) {
    return {
      status: 400,
      body: {
        error: 'Give the issue a web address in lowercase letters, numbers and hyphens.',
      },
    }
  }

  const inserted = await db
    .from('newsletter_issues')
    .insert({ slug, title, status: DRAFT, body: [] })
    .select(ISSUE_COLUMNS)
    .single()
  if (inserted.error) {
    if (inserted.error.code === UNIQUE_VIOLATION) {
      return { status: 409, body: { error: `An issue already answers to ${slug}.` } }
    }
    return { status: 500, body: { error: inserted.error.message } }
  }
  return { status: 200, body: { ok: true, issue: inserted.data } }
}

/**
 * The refusal a write to this issue earns, or null.
 *
 * The trigger on the table refuses a sent issue whatever asks, and this is the
 * same refusal made in the sentence a person reads. Leaving it to the trigger
 * alone answers a careful question with a Postgres error message.
 */
function writeRefusal(issue, { sentIsFinal = true } = {}) {
  if (!issue) return { status: 404, body: { error: 'That issue is no longer here.' } }
  if (sentIsFinal && issue.status === SENT) {
    return {
      status: 409,
      body: { error: 'That issue has gone out. What readers received cannot be rewritten.' },
    }
  }
  return null
}

/** The issue named by an action, read for the check it is about to fail. */
async function standing(db, body) {
  const id = uuid(body.id)
  if (!id) return { refusal: { status: 400, body: { error: 'Name the issue.' } } }
  const { data, error } = await db
    .from('newsletter_issues')
    .select('id, slug, status')
    .eq('id', id)
    .maybeSingle()
  if (error) return { refusal: { status: 500, body: { error: error.message } } }
  return { id, issue: data }
}

/** An answer for a write the table's own trigger turned away. */
function refused(error) {
  if (error.code === UNIQUE_VIOLATION) {
    return { status: 409, body: { error: 'Another issue already answers to that web address.' } }
  }
  if (error.code === RESTRICT_VIOLATION) {
    return {
      status: 409,
      body: { error: 'That issue has gone out. What readers received cannot be rewritten.' },
    }
  }
  return { status: 500, body: { error: error.message } }
}

/** The writing, saved. */
async function save(db, body) {
  const { id, issue, refusal } = await standing(db, body)
  if (refusal) return refusal
  const blocked = writeRefusal(issue)
  if (blocked) return blocked

  const title = field(body.title, LIMITS.title)
  if (!title) return { status: 400, body: { error: 'Give the issue a title.' } }
  const slug = issueSlug(body.slug)
  if (!slug) {
    return {
      status: 400,
      body: { error: 'Give the issue a web address in lowercase letters, numbers and hyphens.' },
    }
  }

  const written = await db
    .from('newsletter_issues')
    .update({
      title,
      slug,
      preheader: field(body.preheader, LIMITS.preheader),
      body: readBody(body.body),
    })
    .eq('id', id)
    .select(`${ISSUE_COLUMNS}, body`)
    .single()
  if (written.error) return refused(written.error)
  return { status: 200, body: { ok: true, issue: written.data } }
}

/**
 * Marked ready, which is what opens the send.
 *
 * An issue with nothing in it is refused here. The send would compose a
 * message carrying a title, a footer and no letter, and every recipient's copy
 * would be claimed before anybody could stop it.
 *
 * The date is optional. With one, the issue goes out on it; without, it waits
 * for somebody to send it.
 */
async function ready(db, body) {
  const { id, issue, refusal } = await standing(db, body)
  if (refusal) return refusal
  const blocked = writeRefusal(issue)
  if (blocked) return blocked

  const { data: held, error } = await db
    .from('newsletter_issues')
    .select('body')
    .eq('id', id)
    .maybeSingle()
  if (error) return { status: 500, body: { error: error.message } }
  if (!readBody(held?.body).length) {
    return { status: 400, body: { error: 'Write the issue before marking it ready.' } }
  }

  const written = await db
    .from('newsletter_issues')
    .update({ status: READY, scheduled_for: moment(body.scheduled_for) })
    .eq('id', id)
    .select(ISSUE_COLUMNS)
    .single()
  if (written.error) return refused(written.error)
  return { status: 200, body: { ok: true, issue: written.data } }
}

/** Back to a draft, which closes the send again and clears the date with it. */
async function unready(db, body) {
  const { id, issue, refusal } = await standing(db, body)
  if (refusal) return refusal
  const blocked = writeRefusal(issue)
  if (blocked) return blocked

  const written = await db
    .from('newsletter_issues')
    .update({ status: DRAFT, scheduled_for: null })
    .eq('id', id)
    .select(ISSUE_COLUMNS)
    .single()
  if (written.error) return refused(written.error)
  return { status: 200, body: { ok: true, issue: written.data } }
}

/**
 * A draft, discarded.
 *
 * A sent issue stays. It is the web version readers were pointed at and the
 * row every open and click on their copy is filed against, so deleting it
 * takes both away.
 */
async function remove(db, body) {
  const { id, issue, refusal } = await standing(db, body)
  if (refusal) return refusal
  const blocked = writeRefusal(issue)
  if (blocked) return blocked

  const deleted = await db.from('newsletter_issues').delete().eq('id', id)
  if (deleted.error) return { status: 500, body: { error: deleted.error.message } }
  return { status: 200, body: { ok: true, removed: issue.slug } }
}

const ACTIONS = { create, save, ready, unready, remove }

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const authorization = request.headers.authorization || ''
  if (!authorization.startsWith('Bearer ')) {
    response.status(401).json({ error: 'not authorized' })
    return
  }
  if (request.method !== 'GET' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST')
    response.status(405).json({ error: 'GET or POST only' })
    return
  }

  const connected = connect()
  if (!connected) {
    response.status(500).json({
      error:
        'The newsletter endpoint has no database keys. Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY on the deployment.',
    })
    return
  }

  response.setHeader('Cache-Control', 'private, no-store')

  try {
    const caller = await authorizeAdmin(connected, authorization)
    if (caller.error) {
      response.status(caller.status).json({ error: caller.error })
      return
    }

    if (request.method === 'GET') {
      const query = request.query ?? {}
      let answer
      if (query.view === 'issue') answer = await read(connected.db, query)
      else if (query.view === 'preview') answer = await preview(connected.db, query)
      else answer = await list(connected.db)
      response.status(answer.status).json(answer.body)
      return
    }

    const body = request.body ?? {}
    const act = ACTIONS[String(body.action ?? '')]
    const answer = act
      ? await act(connected.db, body)
      : { status: 400, body: { error: 'Unknown action.' } }
    response.status(answer.status).json(answer.body)
  } catch (cause) {
    console.error('newsletter-admin: %s', cause.message)
    response.status(502).json({ error: 'The newsletter endpoint did not answer.' })
  }
}
