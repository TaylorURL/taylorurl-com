/**
 * Finds the businesses the pipeline will look at, one slice of the map at a
 * time.
 *
 * What it does: pairs every town in `outreach_settings.towns` with every trade
 * in `outreach_settings.trades`, asks the Google Places API for
 * "<trade> in <town> TX", walks that search to the end of what the endpoint
 * will serve, and records what comes back as a prospect at stage 'found'. The
 * full grid is far more searching than one invocation has time for, so a run
 * takes QUERIES_PER_RUN pairs and the next run takes the next ones. Where it
 * starts is `outreach_settings.source_cursor`, which this job moves once it has
 * swept and wraps at the end of the grid, so the map is covered continuously
 * rather than once.
 *
 * Walking the search to its end is the difference between a sweep and a
 * sampling. The endpoint answers twenty at a time and carries a token for the
 * next twenty, three pages in all, and it orders those sixty by prominence -
 * which is very nearly an ordering by how good a website a business already
 * has. The twenty at the top are the businesses least likely to want anything
 * from a studio that builds websites, so reading one page spent an Enterprise
 * tier search on the part of the answer this pipeline had least use for and
 * threw the rest of it away. Reading all three costs a pair up to three
 * searches rather than one, which is what sets both the pairs a run takes and
 * the window it is given: six pairs with their pages is eighteen searches,
 * which is three minutes of waiting if every one of them sits on its timeout.
 * The grid still comes round inside a working week.
 *
 * The cursor moves at the end of a run rather than the start, which is what
 * makes a run that swept nothing cost nothing. Sourcing switched off, a
 * missing API key and every search in a slice failing all return before the
 * write, so the pairs that run would have taken are still in front of the next
 * one. Counting runs instead, which is what this did until 2026-08-29, walked
 * the starting point past thirty six pairs nothing had ever searched.
 *
 * The same ordering is why the loop watches the clock. A run killed at its
 * ceiling has filed rows and moved the cursor nowhere, so the next run takes
 * the same slice, meets the same slow pairs and dies in the same place - a
 * stall that reads from the run rows as ordinary work. So a run stops taking
 * pairs with a pair's worth of window still in hand and advances over the ones
 * it swept, which trades a slower sweep for one that cannot stop.
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
// the one edit here that would cost money rather than save it. The token that
// carries the next page is named here too, and it is free: the mask governs the
// whole answer rather than the places in it, so a token left out of it is a
// token Google does not send, and a token asked for is not a place field and
// moves the tier nowhere.
const FIELD_MASK =
  'nextPageToken,places.id,places.displayName,places.formattedAddress,' +
  'places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,' +
  'places.businessStatus'

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
 *
 * It moves against PAGES_PER_QUERY rather than on its own. A pair is up to
 * three searches now where it was one, so six pairs is eighteen searches where
 * twelve pairs was twelve, and the half of the grid a run gives up buys three
 * times the businesses on every pair it keeps. Eighteen searches at the
 * timeout below is three minutes of waiting in the worst case, which is what
 * moved the window under `config` from one minute to five; raising this
 * without reading that number too is what walks a run past its window and past
 * the money.
 */
const QUERIES_PER_RUN = 6

/**
 * Pages one search reads before it stops, which is every page there is.
 *
 * The endpoint answers twenty at a time and carries a token for the next
 * twenty, and it stops handing tokens out after the third page: sixty results
 * is the whole of what a text search will ever say about a query. So this is
 * not a budget somebody chose and could raise, it is the shape of the answer,
 * and the loop that reads it stops on a missing token long before it counts to
 * three on most pairs.
 */
const PAGES_PER_QUERY = 3

/** Results one page carries, and the most the Places API puts on one. */
const RESULTS_PER_PAGE = 20
const SEARCH_TIMEOUT_MS = 10_000

/**
 * The run's window, which has to hold the searching rather than the median of
 * it.
 *
 * A pair's pages are read one after another, because a page is asked for with
 * the token the page before it handed back and there is no way to ask for the
 * third without the second. So the pages do not overlap and neither do the
 * pairs: the worst case is every search of every pair sitting on its timeout,
 * which is eighteen at ten seconds. A minute held that when a pair was one
 * search and holds a third of it now.
 *
 * What a window too small costs is not a slow run. `advance` is deliberately
 * the last thing a run does, so a run killed at the ceiling has filed its rows
 * and moved the cursor nowhere, and the next run takes the same slice and dies
 * the same way. Two slow pairs in one slice would pin the cursor there and the
 * rest of the grid would never be searched again - which reads from the run
 * rows as ordinary work, since every one of those runs filed businesses.
 */
export const config = { maxDuration: 300 }

/**
 * How late into that window a run will still start another pair.
 *
 * The window above is sized for the whole slice, so this never bites on a
 * healthy endpoint and is not there to ration anything. It is there because a
 * window is a promise the platform makes and a slow morning is not covered by
 * arithmetic: whatever is left in the slice, a run that stops taking pairs
 * with a pair's worth of window in hand reaches `advance` and moves the cursor
 * over the pairs it actually swept. A shortened slice is a slower sweep. A
 * killed run is a sweep that has stopped.
 */
const LAST_PAIR_STARTS_MS = config.maxDuration * 1000 - PAGES_PER_QUERY * SEARCH_TIMEOUT_MS - 10_000

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

/**
 * One page of a search, with the token for the page behind it, or a throw
 * carrying what Google said.
 */
async function search(query, token) {
  const upstream = await fetch(PLACES_ENDPOINT, {
    method: 'POST',
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    // A token stands for a query that was already asked, so everything beside
    // it has to be the query that was asked: change the text or the page size
    // on the way through and the endpoint refuses the token rather than
    // answering a different search.
    body: JSON.stringify({
      textQuery: query,
      pageSize: RESULTS_PER_PAGE,
      ...(token ? { pageToken: token } : {}),
    }),
  })

  if (!upstream.ok) {
    const said = await upstream.text().catch(() => '')
    const detail = said.replaceAll(API_KEY, '[redacted]').slice(0, 300)
    throw new Error(`places answered ${upstream.status} ${detail}`.trim())
  }

  const body = await upstream.json()
  return {
    places: Array.isArray(body.places) ? body.places : [],
    token: body.nextPageToken || null,
  }
}

/**
 * Every page of one search, read until the endpoint stops offering another.
 *
 * Google orders a text search by prominence, and prominence is close enough to
 * "already has a good website" that the first page is the page this pipeline
 * has the least use for. A run that read one page read the wrong twenty: the
 * businesses worth writing to are the ones ranked behind them, and until this
 * walked they were never filed at all.
 *
 * A page that fails is not a pair that failed. Only the first request going
 * nowhere means the query itself did, so that one is raised and the pair is
 * counted among the run's failures as it always was; a second or third page
 * that refuses ends the walk and keeps what is already in hand, which files a
 * pair's first twenty rather than nothing.
 *
 * The ids are held because the same listing can come back on two pages when
 * ranks shift between requests. A repeat would otherwise be both the row
 * `known()` says is new and the row it says is on file, stamping the count a
 * business was filed at and refreshing it in the same pass.
 */
async function pages(query) {
  const found = []
  const seen = new Set()
  let token = null
  for (let page = 0; page < PAGES_PER_QUERY; page += 1) {
    let answer
    try {
      answer = await search(query, token)
    } catch (cause) {
      if (!page) throw cause
      break
    }
    for (const place of answer.places) {
      if (!place?.id || seen.has(place.id)) continue
      seen.add(place.id)
      found.push(place)
    }
    token = answer.token
    if (!token) break
  }
  return found
}

/** What this job writes into `source`, which is the name every row it files carries. */
export const SOURCE = 'places'

/**
 * The state as it stands in a formatted address, with the zip it usually
 * carries and without the town it sometimes starts.
 *
 * 'Texas City' is why this is anchored at both ends. A part beginning with the
 * state's name is not the state where the town is called Texas City, and a
 * loose read of it would find the state in the town's own slot and take the
 * street address for the town.
 */
const TEXAS = /^(?:tx|texas)(?:\s+\d{5}(?:-\d{4})?)?$/i

/**
 * The town a listing sits in, read off the address Google printed for it
 * rather than off the search that turned it up.
 *
 * A text search is not bounded by the town it names. Baytown has on the order
 * of fifteen welding shops, so a search for welding in Baytown answers the
 * ones in Houston, Pasadena, Channelview and La Porte behind them, and reading
 * all three pages of that answer is what brings the far ones in. Filing those
 * under the town that was searched is not a rounding error in a column nobody
 * reads: the town is quoted back at the reader in the letter, as the search
 * they were found under and as the place a site was built near, and a shop in
 * west Houston told a studio built a site near it in Baytown has been handed
 * the one sentence in a cold letter it can disprove in a second. The same town
 * is also what a site has to name before `pageProves` will accept it as the
 * business's, and what the chain count reads to decide a host trades in three
 * towns rather than one.
 *
 * The pair's town is still the right thing to search for; it is only wrong on
 * the row. Where the address names nothing readable, the search's own town is
 * the best claim there is and stands.
 */
function townOf(address, searched) {
  const parts = String(address ?? '')
    .split(',')
    .map(part => part.trim())
  const state = parts.findIndex(part => TEXAS.test(part))
  return (state > 0 ? parts[state - 1] : '') || searched
}

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
 * `lib/outreach/prospects/youth.js` reads a null count as unread and never as young.
 *
 * The town on the row is the one the address names rather than the one the
 * search did. See `townOf`: the pair is what was asked for, and the listing is
 * what came back.
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
    town: townOf(place.formattedAddress, town),
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

export async function work({ db, settings, counts, clock = Date.now }) {
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

  const began = clock()
  const firsts = await firstCount(db)
  const failures = []
  let taken = 0
  for (const { town, trade } of slice) {
    // The first pair always goes, so a run that has nothing but a slow
    // endpoint still sweeps one pair and still moves the cursor past it.
    if (taken && clock() - began > LAST_PAIR_STARTS_MS) break
    taken += 1
    let places
    try {
      places = await pages(`${trade} in ${town} TX`)
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

  if (failures.length === taken) throw new Error(failures[0])

  // Over the pairs this run actually reached rather than the pairs it was
  // handed, so a run that stopped short leaves the ones it skipped for the
  // next one instead of pinning the cursor where it started.
  const next = (offset + taken) % pairs.length
  await advance(db, next)

  return {
    pairs: pairs.length,
    offset,
    next,
    searched: taken - failures.length,
    failed: failures.length,
    ...(taken < slice.length ? { left: slice.length - taken } : {}),
    ...(failures.length ? { failures: failures.slice(0, 3) } : {}),
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runJob({ request, response, job: 'source', work })
}
