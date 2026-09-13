/**
 * speed-check - the reading behind the Speed Check page.
 *
 *   POST { site, email }   the mobile PageSpeed reading of that address
 *
 * The same report, the same three bands and the same sentence about what a
 * score means that the outreach pipeline works from: `lib/outreach/audit/pagespeed.js`
 * runs it, `lib/outreach/audit/bands.js` says what it means, and
 * `lib/outreach/audit/shot.js` takes the picture. A figure shown here and a figure
 * quoted in a message are the same figure, because nothing here composes one.
 *
 * The address is a stranger's, so `lib/http/target.js` refuses anything that is
 * not a name on the public internet before a request exists to point at it, and
 * the ceilings in `lib/speed-check/reading.js` are counted in the table rather
 * than in this instance's memory, since a ceiling one instance holds is not a
 * ceiling.
 *
 * The answer is streamed as newline-delimited JSON: a line per stage while the
 * work runs, then one line carrying the reading. A report takes most of a
 * minute and reports no progress of its own, so the alternative is a page that
 * looks dead for the whole of it. A proxy that buffers the stream costs the
 * stages and nothing else - the last line is the whole answer either way.
 *
 * What it writes: one row in `public.speed_checks`, opened before the work
 * starts so a run that dies still leaves the record of who asked, and, once a
 * reading comes back, one row in `public.outreach_prospects` through
 * `lib/outreach/prospects/bridge.js`. An address given to get one answer is still not a
 * subscription: `public.subscribers` is where a subscription lives and nothing
 * here goes near it. The prospect is a lead, and it answers to every rule the
 * leads beside it answer to - the same suppression list, the same address
 * checks, the same held domains, the same unsubscribe token on the row - which
 * is what makes it a lead rather than a mailing list.
 *
 * What it sends: one notice to the studio inbox, once the reading is stored and
 * on the page. The page tells the sender their address is kept so a reply can
 * reach them, and a row in a table nobody opens does not keep that promise.
 * Nothing is sent to the sender: the reading is already in front of them.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { readBody } from '../lib/http/body.js'
import { createHash } from 'node:crypto'
import { countOf } from '../lib/db/rows.js'
import { callerAddress, callerWindow } from '../lib/http/rate.js'
import { target } from '../lib/http/target.js'
import { connect } from '../lib/db/clients.js'
import { measure, reading } from '../lib/outreach/audit/pagespeed.js'
import { bandOf } from '../lib/outreach/audit/bands.js'
import { ensureShot } from '../lib/outreach/audit/shot.js'
import { suppressed } from '../lib/outreach/sending/queue.js'
import { bridge } from '../lib/outreach/prospects/bridge.js'
import { loadHeldDomains } from '../lib/outreach/prospects/exclusions.js'
import { SOURCES, keepLead } from '../lib/leads/spine.js'
import { sendNotice, notice } from '../lib/mail/notice.js'
import {
  DAY_MS,
  HOUR_MS,
  overCeiling,
  readEmail,
  readingFor,
  stillFresh,
} from '../lib/speed-check/reading.js'

// A report runs two page loads on Google's hardware, a report Google failed on
// its own side is taken again, and the capture renders one more, so the
// invocation is given room for all of it and a little over.
export const config = { maxDuration: 180 }

/** What the reading is allowed, across however many reports it takes. */
const REPORT_BUDGET_MS = 125_000

/** How long the capture is given once the report is in. */
const SHOT_BUDGET_MS = 25_000

/** How long the address is given to answer at all. */
const REACH_TIMEOUT_MS = 8000

const RESEND_API_KEY = process.env.RESEND_API_KEY || ''

const USER_AGENT =
  'Mozilla/5.0 (compatible; TaylorURLTools/1.0; +https://www.taylorurl.com/speed-check)'

// The cheap refusal in front of the counted one. It costs no query and holds
// for the length of one instance, which is enough to keep a script hammering
// one connection from reaching the database at all.
const BURST = callerWindow({ limit: 6, windowMs: 10 * 60 * 1000 })

/**
 * The caller's connection, as something that tells two callers apart and says
 * nothing else about either.
 *
 * A bare digest of an IPv4 address is a lookup table away from the address, so
 * the digest is peppered with a secret the deployment already holds. Without
 * one there is nothing safe to store, and the row carries no connection at all
 * rather than a digest that reverses.
 */
function callerHash(address) {
  const pepper = process.env.SPEED_CHECK_PEPPER || process.env.CRON_SECRET || ''
  if (!pepper) return null
  return createHash('sha256').update(`${pepper}:${address}`).digest('hex').slice(0, 32)
}

/** How many rows match, since a moment. */
function countSince(db, from, narrow) {
  let query = db
    .from('speed_checks')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(from).toISOString())
  if (narrow) query = query.eq(narrow.column, narrow.value)
  return countOf(query)
}

/**
 * Whether the address answers at all.
 *
 * Only a failure to reach the server counts against it. A site behind a bot
 * filter answers a request from here with a refusal and answers Google's with
 * the page, so reading a status code as a verdict would turn away the sites
 * most worth measuring. What this catches is a name that does not resolve and a
 * server that is not there, which is a report not worth spending.
 */
async function answers(url) {
  try {
    const probe = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(REACH_TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
    })
    await probe.body?.cancel().catch(() => {})
    return true
  } catch {
    return false
  }
}

/** One line of the stream. */
function say(response, payload) {
  response.write(`${JSON.stringify(payload)}\n`)
}

/**
 * The reading, measured.
 *
 * The capture is taken after the report rather than beside it, because the
 * report is the answer and the picture is the evidence beside it: a capture
 * that will not render leaves the picture out, and one that holds the
 * invocation open past the report costs the reader the answer they came for.
 */
async function takeReading(db, row, url, response) {
  say(response, { stage: 'measuring' })
  const measured = reading(await measure(url.toString(), { budgetMs: REPORT_BUDGET_MS }))

  say(response, { stage: 'capturing' })
  const shot = await ensureShot(
    db,
    { id: row.id, website: url.toString() },
    { budgetMs: SHOT_BUDGET_MS }
  )

  return {
    status: 'done',
    finished_at: new Date().toISOString(),
    score: measured.scores.audit_score,
    accessibility_score: measured.scores.accessibility_score,
    best_practices_score: measured.scores.best_practices_score,
    seo_score: measured.scores.seo_score,
    band: bandOf(measured.scores.audit_score),
    audit_raw: measured.raw,
    shot_url: shot,
  }
}

/**
 * The notice a finished check becomes.
 *
 * The sender's address rides on Reply-To, so answering the notice answers
 * them. The band is carried beside the score because the sentence the page
 * shows them is the band's, and an answer written without it would be written
 * against a different reading than the one they are looking at.
 *
 * Exported because the mail console draws every family the studio sends from
 * the code that sends it, and a sample retyped somewhere else is a sample that
 * stops being the message the moment either copy moves.
 *
 * @param {object} check The row as it stands once the reading is written.
 * @returns {{subject: string, text: string, html: string, replyTo: string}}
 */
export function speedCheckNotice(check) {
  const rows = [
    ['Email', check.email],
    ['Site', check.site],
    ['Mobile score', check.score == null ? 'Not read' : String(check.score)],
    ['Band', check.band || 'Not read'],
    ['On the suppression list', check.suppressed ? 'Yes' : 'No'],
  ]
  // Named outright when there is one, because a reading that did not come back
  // is the sender most worth writing to and the row alone would read as a
  // check that simply scored nothing.
  if (check.fault) rows.push(['Did not finish', check.fault])

  return notice({
    label: 'Speed Check',
    subject: check.fault
      ? `Speed Check from ${check.host} did not finish`
      : `Speed Check from ${check.host}`,
    rows,
    replyTo: check.email,
  })
}

/**
 * Puts a finished check in front of a person.
 *
 * Somebody who hands over an address to have their own site read is somebody
 * asking to be spoken to, and the page says as much. The reading is stored and
 * already on their screen by the time this runs, so a refusal here costs the
 * notice and never the record, and it is logged rather than raised for the
 * same reason: the sender has their answer and nothing is owed to the stream.
 *
 * Their address rides on Reply-To, so answering the notice answers them.
 *
 * A deployment with no mail key sends nothing, which is the state a preview
 * build runs in.
 *
 * @param {object} check The row as it stands once the reading is written.
 */
async function announce(check) {
  if (!RESEND_API_KEY) return

  try {
    await sendNotice(speedCheckNotice(check), RESEND_API_KEY)
  } catch (cause) {
    console.error('speed-check: notifying: %s', cause.message)
  }
}

/**
 * Files a finished check as a lead.
 *
 * Somebody who typed their own site into a form and waited most of a minute for
 * a number has named a problem about their own business at the moment they
 * cared enough to go looking. It is the one lead in this pipeline the business
 * named itself, and `lib/outreach/prospects/bridge.js` carries it into
 * `outreach_prospects` under the same suppression list, the same address rules
 * and the same held domains every other row in that table answers to.
 *
 * Only a reading that came back is worth carrying: a check that failed knows an
 * address and nothing about the site behind it, and the bridge refuses one
 * anyway rather than trusting a caller to.
 *
 * The visitor's reading is the priority and it is already on their screen by
 * the time this runs, so nothing here is allowed to reach them. The bridge
 * answers with a refusal rather than raising, and the wrap is here for the fault
 * it cannot answer for - a client that is gone, a module that would not load -
 * because a prospect the studio did not get is a cost to the studio and a
 * reading turned into an error is a cost to the person who asked for it.
 *
 * @param {object} db The service-role client the rest of the request used.
 * @param {object} check The row as it stands once the reading is written.
 */
async function enlist(db, check) {
  try {
    await bridge(db, check)
  } catch (cause) {
    console.error('speed-check: filing: %s', cause?.message)
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ error: 'Send this as a POST.' })
    return
  }

  const clients = connect()
  if (!clients) {
    response.status(503).json({ error: 'The check is not available right now.' })
    return
  }
  const { db } = clients

  // The shape rules refuse to judge an address until the held list is in hand,
  // and this reads a visitor's own address through them.
  if (!(await loadHeldDomains(db))) {
    response.status(503).json({ error: 'The check is not available right now.' })
    return
  }

  const address = callerAddress(request)
  if (!BURST.allows(address)) {
    response.setHeader('Retry-After', String(BURST.windowMs / 1000))
    response.status(429).json({ error: 'Too many checks from this connection. Try again later.' })
    return
  }

  const body = readBody(request)
  const chosen = target(body.site)
  if (chosen.fault) {
    response.status(400).json({ error: chosen.fault })
    return
  }
  const asked = readEmail(body.email)
  if (asked.fault) {
    response.status(400).json({ error: asked.fault })
    return
  }

  const { url } = chosen
  const { email } = asked
  const host = url.hostname.toLowerCase()
  const caller = callerHash(address)
  const now = Date.now()

  let fresh = null
  try {
    const [callerHour, callerDay, emailDay, day] = await Promise.all([
      caller ? countSince(db, now - HOUR_MS, { column: 'caller_hash', value: caller }) : 0,
      caller ? countSince(db, now - DAY_MS, { column: 'caller_hash', value: caller }) : 0,
      countSince(db, now - DAY_MS, { column: 'email', value: email }),
      countSince(db, now - DAY_MS, null),
    ])

    const full = overCeiling({ callerHour, callerDay, emailDay, day })
    if (full) {
      response.setHeader('Retry-After', String(HOUR_MS / 1000))
      response.status(429).json({ error: full })
      return
    }

    // A reading of this host taken recently stands in for a fresh one, which
    // spends no quota on a question already answered.
    const { data: recent } = await db
      .from('speed_checks')
      .select(
        'id, status, created_at, score, accessibility_score, best_practices_score, seo_score, band, audit_raw, shot_url'
      )
      .eq('host', host)
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(1)
    if (stillFresh(recent?.[0], now)) fresh = recent[0]
  } catch (cause) {
    console.error('speed-check: counting: %s', cause.message)
    response.status(503).json({ error: 'The check is not available right now.' })
    return
  }

  const held = await suppressed(db, [email]).catch(() => new Set())

  const opened = {
    email,
    site: url.toString(),
    host,
    status: 'running',
    caller_hash: caller,
    suppressed: held.has(email),
  }
  const { data: row, error: openError } = await db
    .from('speed_checks')
    .insert(opened)
    .select('id, created_at')
    .single()
  if (openError) {
    console.error('speed-check: opening: %s', openError.message)
    response.status(503).json({ error: 'The check is not available right now.' })
    return
  }

  // Somebody who typed their address in to have their own site measured is
  // asking about their own site, which is the warmest question this business
  // gets asked. The reading was being kept and the person asking was not.
  await keepLead(
    {
      source: SOURCES.speedCheck,
      ref: row.id,
      email,
      website: url.toString(),
      note: `Ran a speed check on ${host}`,
    },
    db
  )

  // Everything that could refuse the request has answered, so the status is
  // settled and the rest of the answer can be written as it happens.
  response.status(200)
  response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  response.setHeader('Cache-Control', 'private, no-store')
  response.setHeader('X-Accel-Buffering', 'no')

  try {
    let settled
    if (fresh) {
      settled = {
        status: 'done',
        finished_at: new Date().toISOString(),
        score: fresh.score,
        accessibility_score: fresh.accessibility_score,
        best_practices_score: fresh.best_practices_score,
        seo_score: fresh.seo_score,
        band: fresh.band,
        audit_raw: fresh.audit_raw,
        shot_url: fresh.shot_url,
        reused_from: fresh.id,
      }
    } else {
      say(response, { stage: 'reaching' })
      if (!(await answers(url))) {
        await db
          .from('speed_checks')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            fault: 'the address did not answer',
          })
          .eq('id', row.id)
        say(response, {
          fault: 'Nothing answered at that address. Check the spelling and try again.',
        })
        response.end()
        return
      }
      settled = await takeReading(db, row, url, response)
    }

    const { error: closeError } = await db.from('speed_checks').update(settled).eq('id', row.id)
    if (closeError) throw new Error(closeError.message)

    const check = { ...opened, ...settled, id: row.id, created_at: row.created_at }
    say(response, { result: readingFor(check) })

    // Before the stream closes, not after. The reading is already written to
    // it, so the sender has their answer either way and the wait costs them
    // nothing they can see - but the platform is free to stop the invocation
    // the moment the response ends, and work left on the far side of that is
    // work that sometimes happens. The lead goes first of the two, because it
    // is a write on a client already in hand and the notice is a call to
    // somebody else's server.
    await enlist(db, check)
    await announce(check)
    response.end()
  } catch (cause) {
    console.error('speed-check: %s: %s', host, cause.message)
    const fault = cause.message.slice(0, 300)
    await db
      .from('speed_checks')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        fault,
      })
      .eq('id', row.id)
      .then(
        () => {},
        () => {}
      )
    // A reading that did not come back is still somebody who asked for one and
    // left an address to be answered at. They are the sender most worth
    // writing to, since the page told them nothing useful.
    await announce({ ...opened, status: 'failed', fault })
    say(response, { fault: 'The reading did not come back. Try again in a few minutes.' })
    response.end()
  }
}
