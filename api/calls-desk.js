/**
 * The caller's own desk: how they have the call list set up, and who else is
 * working it this minute.
 *
 * It is a second endpoint rather than more of `calls-admin.js` because the two
 * answer at completely different rates. The list re-reads every callable
 * business and every call ever placed to rank them - fifteen hundred rows and
 * a full pass over the calls table, which is one round trip and not a cheap
 * one. This reads one row for the account and a handful for whoever is on the
 * list. Polling the first often enough to be live would spend the whole
 * function budget on a ranking that barely moves; polling this one every
 * twenty seconds costs almost nothing, and it carries the only two facts that
 * actually change from second to second - who is here, and which number each
 * of them is on.
 *
 * Two verbs, and the useful one is POST. A GET reads the desk and writes
 * nothing, which is what the first paint wants. Everything after it is a POST,
 * because saying "I am still here" and asking "who else is here" are the same
 * question asked from a console that is open, and splitting them would be two
 * requests to learn one thing.
 *
 * The claim is the point of the whole endpoint. Two callers who open the list
 * a minute apart are handed the same page in the same order and ring the same
 * business, and no amount of suppression helps: a call is only suppressed once
 * it has been recorded, and the collision happens in the minutes before either
 * of them records anything. So a caller says which number they are on, the
 * unique index over the business settles any race between two consoles, and
 * every other console draws the lock.
 *
 * Nothing here is permanent. A row is worth what its last beat is worth, and a
 * console that closed, slept or lost the network stops beating and gives back
 * whatever it was holding - which is what stops a crashed browser locking a
 * business until somebody notices.
 */

import { bearerOr401, methodsOr405, servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { tableMissing } from '../lib/db/rows.js'
import { uuid } from '../lib/db/fields.js'
import { isCallable } from '../lib/outreach/prospects/calls.js'
import { normalizePrefs, prefsPatch } from '../lib/outreach/prospects/callPrefs.js'
import {
  BEAT_MS,
  PHONE_MAX_MS,
  PRESENCE_TTL_MS,
  onPhone,
  presenceLive,
} from '../lib/outreach/prospects/callPresence.js'

const PREFS = 'outreach_call_prefs'
const PRESENCE = 'outreach_call_presence'
const PROSPECTS = 'outreach_prospects'
const PROFILES = 'profiles'

/** What Postgres says when a unique index refuses a second row. */
const ALREADY_TAKEN = '23505'

/** What is said when the desk itself will not read. */
const DESK_UNREAD = 'The call desk could not be read. Try again in a moment.'

/** And when a change to it will not save. */
const NOT_SAVED = 'That could not be saved. Try again in a moment.'

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
  console.error('calls-desk: %s', error?.message || error)
  return { status: 500, body: { error: said } }
}

/** This account's setup, as stored, or nothing where it has never set one. */
async function readPrefs(db, userId) {
  const { data, error } = await db
    .from(PREFS)
    .select('columns, density, take, sort, filters, views')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return normalizePrefs(data)
}

/**
 * Whoever is on the list right now, with what each of them is on the phone
 * with.
 *
 * Liveness is decided here rather than on the console, so three consoles with
 * three clocks all draw the same board. A dead row is left in the table rather
 * than swept: it is one row per account, it is overwritten by that account's
 * next beat, and a delete pass on every read would be a write on every poll.
 *
 * The names come from `profiles` and the businesses from `outreach_prospects`,
 * each in one query over the handful of ids that are actually live. A join per
 * row would be three queries to draw three names.
 */
async function readPresence(db, now) {
  const { data, error } = await db
    .from(PRESENCE)
    .select('user_id, prospect_id, on_phone_since, last_seen')
    .gte('last_seen', new Date(now.getTime() - PRESENCE_TTL_MS).toISOString())
    .order('last_seen', { ascending: false })
  if (error) throw error

  const live = (data || []).filter(row => presenceLive(row, now))
  if (!live.length) return []

  const held = live.filter(row => onPhone(row, now)).map(row => row.prospect_id)
  const [people, businesses] = await Promise.all([
    db
      .from(PROFILES)
      .select('id, full_name')
      .in(
        'id',
        live.map(row => row.user_id)
      ),
    held.length
      ? db.from(PROSPECTS).select('id, name, town, phone').in('id', held)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (people.error) throw people.error
  if (businesses.error) throw businesses.error

  const named = new Map((people.data || []).map(row => [row.id, row.full_name]))
  const rung = new Map((businesses.data || []).map(row => [row.id, row]))

  return live.map(row => {
    const business = onPhone(row, now) ? (rung.get(row.prospect_id) ?? null) : null
    return {
      user_id: row.user_id,
      name: named.get(row.user_id) ?? null,
      // A row whose call has run past its ceiling reads as present rather than
      // as on the phone, which is the same thing every other reader of it says.
      prospect_id: business ? row.prospect_id : null,
      on_phone_since: business ? row.on_phone_since : null,
      business: business
        ? { id: business.id, name: business.name, town: business.town, phone: business.phone }
        : null,
      last_seen: row.last_seen,
    }
  })
}

/** The desk as a console draws it. */
async function desk(db, userId, now) {
  const [prefs, presence] = await Promise.all([readPrefs(db, userId), readPresence(db, now)])
  return {
    status: 200,
    body: {
      // Which row on the board is the reader's own. A caller's own claim is the
      // call they are on rather than a colleague's lock, and nothing else in
      // the payload distinguishes the two.
      you: userId,
      prefs,
      presence,
      at: now.toISOString(),
      beat_ms: BEAT_MS,
      ttl_ms: PRESENCE_TTL_MS,
    },
  }
}

/** This account's setup, changed in whatever fields the console sent. */
async function savePrefs(db, userId, sent) {
  const patch = prefsPatch(sent)
  if (!Object.keys(patch).length) return
  const { error } = await db
    .from(PREFS)
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() })
  if (error) throw error
}

/**
 * Gives back whatever a claim on this business is being held on, where
 * whoever held it has stopped saying so.
 *
 * The unique index does not know about time: a row left behind by a console
 * that crashed still occupies the business, and without this a number nobody
 * is on could never be claimed again. So the two clocks that decide a claim is
 * over - a beat gone quiet, and a call that has run longer than any call runs -
 * are applied to that one business before anybody else is refused it.
 */
async function freeStale(db, prospectId, now) {
  const quiet = new Date(now.getTime() - PRESENCE_TTL_MS).toISOString()
  const overlong = new Date(now.getTime() - PHONE_MAX_MS).toISOString()
  const { error } = await db
    .from(PRESENCE)
    .update({ prospect_id: null, on_phone_since: null })
    .eq('prospect_id', prospectId)
    .or(`last_seen.lt.${quiet},on_phone_since.lt.${overlong}`)
  if (error) throw error
}

/** Whoever is holding a business, by name, or null. */
async function holderOf(db, prospectId, now) {
  const presence = await readPresence(db, now)
  return presence.find(row => row.prospect_id === prospectId) ?? null
}

/**
 * The beat, and whatever it carried.
 *
 * One statement writes the whole row, because a beat, a claim and a release
 * are the same row in three states and writing them separately would leave a
 * console that is on a call reading as merely present for as long as the second
 * write took.
 */
async function beat(db, userId, body, now) {
  const wanted = 'on_phone' in body ? uuid(body.on_phone) : undefined
  const releasing = 'on_phone' in body && wanted === null

  const mine = await db
    .from(PRESENCE)
    .select('prospect_id, on_phone_since, last_seen')
    .eq('user_id', userId)
    .maybeSingle()
  if (mine.error) throw mine.error

  // A claim on the business already held is the same call, not a new one, so
  // the clock it is measured against is the one it started on. Restarting it
  // on every beat would leave every call reading as a minute old forever.
  const holding = onPhone(mine.data, now) ? mine.data.prospect_id : null
  let prospectId = holding
  let since = holding ? mine.data.on_phone_since : null

  if (releasing) {
    prospectId = null
    since = null
  } else if (wanted) {
    if (wanted !== holding) {
      // The row has to be one the list would have offered. Without this an id
      // pasted from anywhere would lock a business nobody may ring, and the
      // lock would read exactly like a colleague being on the call.
      const found = await db
        .from(PROSPECTS)
        .select('id, phone, site_kind, stage, business_status')
        .eq('id', wanted)
        .maybeSingle()
      if (found.error) throw found.error
      if (!found.data || !isCallable(found.data)) {
        return { status: 409, body: { error: 'That business is not on the call list.' } }
      }
      await freeStale(db, wanted, now)
      since = now.toISOString()
    }
    prospectId = wanted
  }

  const written = await db.from(PRESENCE).upsert({
    user_id: userId,
    prospect_id: prospectId,
    // A held business always carries the instant it was picked up. The column
    // refuses the pair any other way, and it is right to: a claim with no start
    // never reaches its ceiling, so it would be the one lock nothing expires.
    on_phone_since: prospectId ? (since ?? now.toISOString()) : null,
    last_seen: now.toISOString(),
  })
  if (!written.error) return null
  if (written.error.code !== ALREADY_TAKEN) throw written.error

  // Somebody live is already on it. The beat still has to land, or a caller who
  // asks for a taken number twice drops off the board while being told why -
  // so the row is written again holding nothing, and the refusal names whoever
  // has it, because the answer to it is to ring somebody else.
  const present = await db.from(PRESENCE).upsert({
    user_id: userId,
    prospect_id: null,
    on_phone_since: null,
    last_seen: now.toISOString(),
  })
  if (present.error) throw present.error

  const holder = await holderOf(db, prospectId, now)
  return {
    status: 409,
    error: holder
      ? `${holder.name || 'Somebody'} is on that call already.`
      : 'Somebody else is on that call already.',
  }
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
    const account = await authorizeAdmin(wired, authorization)
    if (account.status) return response.status(account.status).json({ error: account.error })

    const now = new Date()
    let answer
    try {
      if (request.method === 'POST') {
        const body = request.body ?? {}
        if (body.prefs) await savePrefs(wired.db, account.userId, body.prefs)
        const refused = await beat(wired.db, account.userId, body, now)
        answer = await desk(wired.db, account.userId, now)
        // A refused claim still answers with the desk. The console that met it
        // has to redraw the board it was refused against, or it sits holding a
        // lock nobody gave it and asks for the same number again.
        if (refused)
          answer = { status: refused.status, body: { ...answer.body, error: refused.error } }
      } else {
        answer = await desk(wired.db, account.userId, now)
      }
    } catch (cause) {
      answer = refusal(cause, request.method === 'POST' ? NOT_SAVED : DESK_UNREAD)
    }
    return response.status(answer.status).json(answer.body)
  } catch (cause) {
    console.error('calls-desk: %s', cause.message)
    return response.status(502).json({ error: 'The call desk endpoint did not answer.' })
  }
}
