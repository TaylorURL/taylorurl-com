/**
 * Finds the businesses the pipeline will look at, one slice of the map at a
 * time.
 *
 * What it does: pairs every town in `outreach_settings.towns` with every trade
 * in `outreach_settings.trades`, asks the Google Places API for
 * "<trade> in <town> TX", and records what comes back as a prospect at stage
 * 'found'. The full grid is far more searching than one invocation has time
 * for, so a run takes QUERIES_PER_RUN pairs and the next run takes the next
 * ones. Where it starts is `outreach_settings.source_cursor`, which this job
 * moves once it has swept and wraps at the end of the grid, so the map is
 * covered continuously rather than once.
 *
 * The cursor moves at the end of a run rather than the start, which is what
 * makes a run that swept nothing cost nothing. Sourcing switched off, a
 * missing API key and every search in a slice failing all return before the
 * write, so the pairs that run would have taken are still in front of the next
 * one. Counting runs instead, which is what this did until 2026-08-29, walked
 * the starting point past thirty six pairs nothing had ever searched.
 *
 * What it reads: GOOGLE_PLACES_API_KEY, and the towns, trades, cursor and
 * sourcing_enabled switch out of `outreach_settings`.
 *
 * What it writes: `outreach_settings.source_cursor`, and
 * `outreach_prospects`, upserted on place_id. Every row it writes says where
 * it came from: `source` is 'places' and `source_ref` is the place id again,
 * so a row's identity is the pair whatever found it, and a source with no
 * place id at all files under the same two columns. The name, address, phone,
 * website, town and trade of a business already on file are refreshed from
 * the search; its stage and its email are not, because a prospect that has
 * been enriched, audited or written to is further along than a map result
 * knows and a search result must not walk it back.
 *
 * The review count is written twice over, and the two are not the same column.
 * `rating_count` is refreshed by every sweep like the name and the phone
 * number beside it. `rating_count_first` is written once, for a place id that
 * was not on file when the search came back, and never again: it is the
 * reading the business was filed at, so a later sweep rewriting it would leave
 * the two columns saying the same thing and the run of reviews between them
 * gone. What the pair together says is how many reviews a business has gained
 * since the sweep first filed it, which is the only honest way to tell a
 * business that opened recently from one nobody has got round to reviewing.
 * The column is not in every database this code runs against, so a run asks
 * once whether it is there and files without it where it is not, rather than
 * refusing to sweep the map over a figure nothing downstream requires.
 *
 * What stops it: sourcing_enabled being false, an empty town or trade list, a
 * missing API key, or every search in the slice failing. One or two failing
 * searches do not, since a single refused query says nothing about the rest.
 */

import { columnMissing } from '../../lib/db/rows.js'
import { servedHereOr404 } from '../../lib/http/guard.js'
import { runJob } from '../../lib/outreach/runtime.js'

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'
// A search is billed at the highest tier any field in the mask sits in, once
// for the request rather than once per field. The phone number and the website
// are both Enterprise fields and neither is going anywhere, so the tier is
// already paid: the rating and its count sit in that same tier and ride along
// for nothing, and businessStatus is a tier below them. Dropping the phone or
// the website would leave the rating paying for the tier on its own, which is
// the one edit here that would cost money rather than save it.
const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,' +
  'places.websiteUri,places.rating,places.userRatingCount,places.businessStatus'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || ''

/**
 * Pairs one run searches, which is what keeps it inside the function's window.
 *
 * How fast the grid is covered is set by the cron beside this rather than by
 * this number, and the two are worth reading together: the pairs a run takes,
 * times the runs in a day, is how much of the map a day sees, and everything
 * downstream is a share of that. A sweep slower than the sender empties what it
 * finds is a queue that runs dry between passes, which is what the every-two-
 * hours cadence in vercel.json is set against - the whole grid inside a working
 * week, which is about as often as a map of small businesses has anything new
 * on it.
 */
const QUERIES_PER_RUN = 12
/** Results one search asks for, and the most the Places API returns at once. */
const RESULTS_PER_QUERY = 20
const SEARCH_TIMEOUT_MS = 10_000

export const config = { maxDuration: 60 }

/**
 * Where the next run picks the grid up. Called once this run's slice has been
 * searched, so a run that returned before that leaves the cursor where it was.
 *
 * updated_at is left alone deliberately. It records when somebody last changed
 * a setting, and a sweep every six hours moving it would bury that.
 */
async function advance(db, cursor) {
  const { error } = await db.from('outreach_settings').update({ source_cursor: cursor }).eq('id', 1)
  if (error) throw new Error(error.message)
}

/** Every town and trade pair, in the order the two lists are held in. */
function grid(settings) {
  const pairs = []
  for (const town of settings.towns) {
    for (const trade of settings.trades) {
      if (town && trade) pairs.push({ town, trade })
    }
  }
  return pairs
}

/** One search's worth of places, or a throw carrying what Google said. */
async function search(query) {
  const upstream = await fetch(PLACES_ENDPOINT, {
    method: 'POST',
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({ textQuery: query, pageSize: RESULTS_PER_QUERY }),
  })

  if (!upstream.ok) {
    const said = await upstream.text().catch(() => '')
    const detail = said.replaceAll(API_KEY, '[redacted]').slice(0, 300)
    throw new Error(`places answered ${upstream.status} ${detail}`.trim())
  }

  const body = await upstream.json()
  return Array.isArray(body.places) ? body.places : []
}

/** What this job writes into `source`, which is the name every row it files carries. */
export const SOURCE = 'places'

/**
 * One place as a prospect row, or null when it has no name to file it under.
 *
 * The rating, its count and the trading status are read here rather than off
 * the business's own site, which is the point of them: they say how big a
 * business is and whether it is still open before anything has been fetched,
 * enriched or audited on its behalf. Google omits the review fields entirely
 * for a listing nobody has reviewed, so a null count on a row built here is a
 * listing with no reviews rather than a count of zero. The table also holds
 * rows filed before the mask carried these fields, where the same null means
 * nobody asked, and nothing on the row tells the two apart - which is why
 * `lib/outreach/youth.js` reads a null count as unread and never as young.
 *
 * Exported for the check that reads the row without a map to ask.
 */
export function prospect(place, town, trade) {
  const name = place?.displayName?.text?.trim()
  if (!place?.id || !name) return null
  return {
    place_id: place.id,
    source: SOURCE,
    source_ref: place.id,
    name,
    address: place.formattedAddress ?? null,
    phone: place.nationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    rating: place.rating ?? null,
    rating_count: place.userRatingCount ?? null,
    business_status: place.businessStatus ?? null,
    town,
    trade,
  }
}

/**
 * Whether the write-once first-count column is in the database.
 *
 * It is not in every database this code runs against, and a sweep that stopped
 * over that would stop the pipeline finding anybody at all for the sake of one
 * figure. So the run asks once, files the count where the column is there and
 * leaves it out where it is not. Any other refusal is a real one and is thrown.
 */
async function firstCount(db) {
  const { error } = await db.from('outreach_prospects').select('rating_count_first').limit(1)
  if (!error) return true
  if (columnMissing(error)) return false
  throw new Error(error.message)
}

/**
 * Files a batch of prospects, upserted on place_id, and does nothing at all
 * where there is nothing to file.
 *
 * Every row in one call carries the same keys, so the conflict clause rewrites
 * the same columns for all of them and leaves stage and email alone: absent
 * from the payload means the default on the way in and untouched on the way
 * over. It is also why the rows a run is filing for the first time travel in a
 * call of their own - they carry a column that must not be rewritten on
 * anybody already on file, and one payload cannot both carry it and not.
 */
async function save(db, rows) {
  if (!rows.length) return
  const { error } = await db.from('outreach_prospects').upsert(rows, { onConflict: 'place_id' })
  if (error) throw new Error(error.message)
}

/** Which of these place ids are already on file. */
async function known(db, ids) {
  const { data, error } = await db.from('outreach_prospects').select('place_id').in('place_id', ids)
  if (error) throw new Error(error.message)
  return new Set(data.map(row => row.place_id))
}

async function work({ db, settings, counts }) {
  if (!settings.sourcing_enabled) return { skipped: 'sourcing is switched off' }
  if (!API_KEY) throw new Error('GOOGLE_PLACES_API_KEY is not set')

  const pairs = grid(settings)
  if (!pairs.length) return { skipped: 'no towns or trades are configured' }

  const width = Math.min(QUERIES_PER_RUN, pairs.length)
  // Both lists are edited from the console, so the grid a cursor was written
  // against is not always the grid it is read against. Taking it modulo the
  // current length lands somewhere inside the new grid instead of past the end
  // of it, and the sweep carries on from there.
  const start = Number(settings.source_cursor)
  const offset = Number.isFinite(start) && start > 0 ? start % pairs.length : 0
  const slice = []
  for (let step = 0; step < width; step += 1) slice.push(pairs[(offset + step) % pairs.length])

  const firsts = await firstCount(db)
  const failures = []
  for (const { town, trade } of slice) {
    let places
    try {
      places = await search(`${trade} in ${town} TX`)
    } catch (cause) {
      failures.push(`${trade} in ${town}: ${cause.message}`)
      continue
    }

    const rows = places.map(place => prospect(place, town, trade)).filter(Boolean)
    counts.examined += rows.length
    if (!rows.length) continue

    const already = await known(
      db,
      rows.map(row => row.place_id)
    )

    // The count a business is filed at is stamped on the rows this search is
    // the first to see, and on nobody else, which is the whole of what makes
    // it write-once. Where the column is absent, or where the search returned
    // nothing new, every row travels in the one refreshing call instead.
    const filing = rows.filter(row => !already.has(row.place_id))
    const stamped = firsts
      ? filing.map(row => ({ ...row, rating_count_first: row.rating_count }))
      : []
    const rest = stamped.length ? rows.filter(row => already.has(row.place_id)) : rows

    await save(db, rest)
    await save(db, stamped)

    counts.changed += filing.length
  }

  if (failures.length === slice.length) throw new Error(failures[0])

  const next = (offset + width) % pairs.length
  await advance(db, next)

  return {
    pairs: pairs.length,
    offset,
    next,
    searched: slice.length - failures.length,
    failed: failures.length,
    ...(failures.length ? { failures: failures.slice(0, 3) } : {}),
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runJob({ request, response, job: 'source', work })
}
