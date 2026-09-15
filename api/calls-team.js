/**
 * The whole desk: everybody who works the call list, what each of them has
 * come to today, this week and over the span being asked about, and whether
 * they are on a phone this minute.
 *
 * A third endpoint rather than more of the two next door, because it answers a
 * different question for a different reader. The list ranks fifteen hundred
 * businesses for the person about to ring one; the desk says who is here right
 * now and is polled three times a minute; this reads a month of calls across
 * everybody and is opened by somebody deciding how the week is going. Folding
 * it into either would put a month's read on the front of every call, or a
 * board that moves hourly behind a beat that has to answer in milliseconds.
 *
 * Every figure here is counted in `callTeam.js` rather than in this file, and
 * that is the point of the split. The management screen orders and draws the
 * answer through the same functions that built it, so what the board shows and
 * what the database was asked cannot drift apart - and the arithmetic can be
 * checked without a database at all.
 *
 * Two verbs. GET reads the board. POST sets one person's shift, which is the
 * one thing on this screen a manager does rather than reads, and it is admin
 * only: a representative may read the board they are counted on, and deciding
 * what a day should come to is the job of whoever asked them to work it.
 *
 * The calls read always covers at least a week, whatever span was asked for,
 * because the answer carries the week in every one of them. A board opened on
 * Today still prints the week behind it, and reading a day and reporting a
 * week off it would be seven times too small on the one figure nobody would
 * think to doubt.
 */

import { bearerOr401, methodsOr405, servedHereOr404 } from '../lib/http/guard.js'
import { authorizeCaller, connect } from '../lib/db/clients.js'
import { readAll, tableMissing } from '../lib/db/rows.js'
import { uuid } from '../lib/db/fields.js'
import { goalsPatch, normalizeGoals } from '../lib/outreach/prospects/callShift.js'
import { onPhone } from '../lib/outreach/prospects/callPresence.js'
import {
  daysOf,
  presenceOf,
  teamCounts,
  windowDays,
  windowStart,
} from '../lib/outreach/prospects/callTeam.js'

const PROFILES = 'profiles'
const CALLS = 'outreach_calls'
const PREFS = 'outreach_call_prefs'
const PRESENCE = 'outreach_call_presence'
const PROSPECTS = 'outreach_prospects'

/** The roles that work the call list, which is the set this board counts. */
const DESK_ROLES = ['admin', 'staff']

/**
 * The calls read's ceiling.
 *
 * Thirty days of a desk this size is a few hundred rows and the table holds
 * nineteen today, so this is nowhere near being met. It is stated because
 * `readAll` pages, and a read with no ceiling on a table that grows for years
 * is a function that gets slower every month without anything saying so.
 */
const CALLS_MAX = 20_000

/** What is said when the board itself will not read. */
const TEAM_UNREAD = 'The team could not be read. Try again in a moment.'

/** And when a shift somebody set will not store. */
const NOT_SAVED = 'Those goals could not be saved. Try it again.'

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
  console.error('calls-team: %s', error?.message || error)
  return { status: 500, body: { error: said } }
}

/**
 * Everybody on the desk, by name.
 *
 * Both roles the caller door admits, and everybody who holds one whether or
 * not they have placed a call. A board that only lists the people who rang
 * somebody is a board that cannot show a quiet morning, which is the reading
 * it exists to make visible.
 */
async function roster(db) {
  const { data, error } = await db
    .from(PROFILES)
    .select('id, full_name, role')
    .in('role', DESK_ROLES)
    .order('full_name')
  if (error) throw error
  return (data || []).map(row => ({ id: row.id, name: row.full_name || null, role: row.role }))
}

/**
 * Every call placed since an instant, oldest first.
 *
 * Totally ordered - `called_at` then `id` - because `readAll` pages with
 * `.range()`, and an unordered query paged that way can hand back one row
 * twice and skip another. On a board of counts that is not a cosmetic fault:
 * a dropped row is a call that happened and is not in anybody's figures.
 */
async function callsSince(db, from) {
  const { rows } = await readAll(
    () =>
      db
        .from(CALLS)
        .select('id, called_by, called_at, outcome', { count: 'exact' })
        .gte('called_at', from)
        .order('called_at')
        .order('id'),
    { max: CALLS_MAX }
  )
  return rows
}

/** The shift each account has set, by account, for whoever has set one. */
async function goalsFor(db, ids) {
  if (!ids.length) return new Map()
  const { data, error } = await db.from(PREFS).select('user_id, goals').in('user_id', ids)
  if (error) throw error
  return new Map((data || []).map(row => [row.user_id, row.goals]))
}

/**
 * Every presence row the desk holds, live or not.
 *
 * Not narrowed to the live ones, unlike the board `calls-desk.js` draws. That
 * one answers who is available to take the next number, so a row that stopped
 * beating is nobody. This one answers for a person who has a row on the list
 * either way, and an account last seen on Monday afternoon is a different
 * sentence from an account that has never opened the screen.
 */
async function presenceFor(db, ids) {
  if (!ids.length) return []
  const { data, error } = await db
    .from(PRESENCE)
    .select('user_id, prospect_id, on_phone_since, last_seen')
    .in('user_id', ids)
  if (error) throw error
  return data || []
}

/** The businesses whoever is on a call is on a call with. */
async function businessesFor(db, ids) {
  if (!ids.length) return new Map()
  const { data, error } = await db.from(PROSPECTS).select('id, name, town').in('id', ids)
  if (error) throw error
  return new Map((data || []).map(row => [row.id, row]))
}

/**
 * The board as the management screen draws it.
 *
 * The roster and the calls go out together, because neither needs the other's
 * answer; the shift and the presence rows wait on the roster only because they
 * are asked for by account id. The businesses are last and are usually not
 * asked for at all - nobody is on a phone most of the time this is opened.
 */
async function board(db, account, query, now) {
  const days = daysOf(query.days)
  const window = windowDays(days, now)
  // The wider of the two spans, because the answer carries the week whatever
  // was asked for.
  const from = windowStart(Math.max(days, 7), now)

  const [people, calls] = await Promise.all([roster(db), callsSince(db, from)])
  const ids = people.map(person => person.id)
  const [goals, presence] = await Promise.all([goalsFor(db, ids), presenceFor(db, ids)])
  const held = presence.filter(row => onPhone(row, now)).map(row => row.prospect_id)
  const businesses = await businessesFor(db, held)

  const counted = teamCounts(calls, people, { now, days })
  const rows = new Map(presence.map(row => [row.user_id, row]))

  return {
    status: 200,
    body: {
      // Which row on the board is the reader's own, and what they may do to it.
      // The role comes off the account rather than off the screen that asked,
      // so the editor the board draws and the door the write meets are reading
      // one answer: a screen that decided for itself who may set a shift would
      // be offering a control that the endpoint then refuses.
      you: account.userId,
      role: account.role,
      at: now.toISOString(),
      days,
      from: window[0],
      to: window[window.length - 1],
      people: counted.people.map(person => {
        const row = rows.get(person.id) ?? null
        const seat = presenceOf(row, now)
        const business = seat?.on_phone ? (businesses.get(row.prospect_id) ?? null) : null
        return {
          id: person.id,
          name: person.name,
          role: person.role,
          goals: normalizeGoals(goals.get(person.id)),
          today: person.today,
          week: person.week,
          range: person.range,
          last_call_at: person.last_call_at,
          presence: seat && {
            ...seat,
            business: business && { id: business.id, name: business.name, town: business.town },
          },
        }
      }),
      totals: counted.totals,
      by_day: counted.by_day,
    },
  }
}

/**
 * One person's shift, set by whoever decides shifts.
 *
 * The account is checked before anything is read, because a representative
 * setting their own figures is the whole of what this refuses and a refusal
 * that costs three queries first is a refusal somebody can hammer.
 *
 * The id is held against the roster rather than merely being a uuid. Without
 * that, an id pasted from anywhere writes a prefs row for an account that does
 * not work this list - which nothing would ever draw, and nothing would ever
 * say was there.
 *
 * Exported so the check can drive both answers without a database.
 */
export async function setShift(db, account, body) {
  if (account.role !== 'admin') {
    return { status: 403, body: { error: 'Only an admin sets a shift.' } }
  }

  const userId = uuid(body?.user_id)
  const people = await roster(db)
  if (!userId || !people.some(person => person.id === userId)) {
    return { status: 404, body: { error: 'That account is not on the desk.' } }
  }

  const goals = goalsPatch(body?.goals)
  if (!goals) {
    return { status: 400, body: { error: 'Set three figures for the shift.' } }
  }

  // The three figures and nothing else. The row this writes to is the same one
  // the caller's own console stores its columns, filters and kept narrowings
  // in, and a manager setting a shift must not touch how somebody has their
  // list set up.
  const { error } = await db
    .from(PREFS)
    .upsert({ user_id: userId, goals, updated_at: new Date().toISOString() })
  if (error) throw error

  return { status: 200, body: { ok: true, user_id: userId, goals } }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  const authorization = bearerOr401(request, response)
  if (!authorization) return
  if (!methodsOr405(request, response, ['GET', 'POST'])) return

  const wired = connect()
  if (!wired) return response.status(503).json({ error: 'The database is not configured here.' })

  response.setHeader('Cache-Control', 'private, no-store')

  try {
    const account = await authorizeCaller(wired, authorization)
    if (account.status) return response.status(account.status).json({ error: account.error })

    const now = new Date()
    let answer
    try {
      answer =
        request.method === 'POST'
          ? await setShift(wired.db, account, request.body ?? {})
          : await board(wired.db, account, request.query ?? {}, now)
    } catch (cause) {
      answer = refusal(cause, request.method === 'POST' ? NOT_SAVED : TEAM_UNREAD)
    }
    return response.status(answer.status).json(answer.body)
  } catch (cause) {
    console.error('calls-team: %s', cause.message)
    return response.status(502).json({ error: 'The team endpoint did not answer.' })
  }
}
