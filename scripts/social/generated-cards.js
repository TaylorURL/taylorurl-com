/**
 * Draws the social cards that come from live data, stores them, and queues them.
 *
 *   node scripts/social/generated-cards.js review              the Google listing, once a day
 *   node scripts/social/generated-cards.js proof               the month's PageSpeed card
 *   node scripts/social/generated-cards.js review --dry-run [--out DIR]
 *   node scripts/social/generated-cards.js proof --dry-run --force [--out DIR]
 *   node scripts/social/generated-cards.js <review|proof> --fixture FILE --dry-run
 *
 * Run on the Pi from `~/work/taylorurl-com` by `social-cards-run.sh`, which the
 * intelligence repository carries: the review card every morning ahead of the
 * daily social routine, and the proof card on weekday afternoons, after the
 * daily maintenance routine has taken the morning's readings. Running from the
 * checkout of `develop` is deliberate: a change to what a card says reaches the
 * next run without waiting on a release of the site, because nothing here is
 * served by it.
 *
 * What each card says is decided in `lib/social/reviews.js` and
 * `lib/social/proof.js`, where it is checked; how it is hosted and queued in
 * `lib/social/generated.js`. What is here is the reading, the drawing and the
 * writing: the listing and the rows read, the card drawn on the library's own
 * sheet and refused for anything the library would be refused for, the PNG put
 * in the public `social-cards` bucket, and the post placed on every channel's
 * next free slot.
 *
 * The record is written as the work goes rather than at the end. A card is
 * `drawn` once its image is stored and each post is added to it the moment
 * Buffer takes it, so a run that dies halfway is finished by the next one from
 * the same image and the same words, rather than drawn again and posted twice.
 *
 * A dry run reads everything a real run reads - the listing, the database,
 * Buffer's queue - draws the card to `--out`, and writes nothing anywhere else:
 * no object, no row, no post. `--fixture` takes all of those reads from a file
 * instead, so the whole path can be walked with no keys at all.
 *
 * The keys are read from the environment, where `with-credential.py` puts them:
 * GOOGLE_PLACES_API_KEY, BUFFER_API_KEY and SUPABASE_SERVICE_ROLE_KEY.
 *
 * The answer is JSON on stdout. The last line on stderr is one sentence, and the
 * exit code says whether a person has to act on it: 0 when the run did its job
 * or had none to do, 1 when something needs looking at.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { PORTFOLIO_PROJECTS } from '../../src/app/data/portfolio.js'
import { AREAS } from '../../src/app/data/towns-and-trades/areas.js'
import { connect } from '../../lib/social/buffer.js'
import { BUCKET, PROJECT, cardUrl, queueCard } from '../../lib/social/generated.js'
import {
  MIN_SITES,
  dueOn,
  proofAlt,
  proofCardItem,
  proofFrom,
  proofPath,
  proofTexts,
} from '../../lib/social/proof.js'
import {
  choose,
  readListing,
  reviewAlt,
  reviewCardItem,
  reviewPath,
  reviewTexts,
} from '../../lib/social/reviews.js'
import { altGuard, faults } from './media-guard.js'
import { loadTrades } from './media-content.js'
import { launch, renderStill, sheet } from './media-sheet.js'
import * as T from './media-templates/templates.js'

const TABLE = 'social_generated_cards'

/**
 * Towns a review may name as the reviewer's, beyond the ones the site has a page
 * for: the places around Baytown an owner is likely to write. A town outside
 * the list is not read at all, which leaves the card saying "a client".
 */
const NEIGHBOURS = [
  'Highlands',
  'Crosby',
  'Channelview',
  'Anahuac',
  'Cove',
  'Beach City',
  'Seabrook',
  'Kemah',
  'League City',
  'Webster',
  'Friendswood',
  'Pearland',
  'Humble',
  'Kingwood',
  'Atascocita',
  'Beaumont',
]
const TOWNS = [...new Set([...AREAS.map(area => area.name), ...NEIGHBOURS])]

const args = process.argv.slice(2)
const command = args[0]
const flag = name => args.includes(name)
const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null)
const dryRun = flag('--dry-run')
const fixture = option('--fixture') ? JSON.parse(readFileSync(option('--fixture'), 'utf8')) : null

/** A line of type the sheet's guards pass, which is the bar a quote is held to. */
const passes = text => faults(text).length === 0

/** The last line a run prints, read by the runner on the Pi as the run's reason. */
const say = sentence => console.error(`generated-cards: ${sentence}`)

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function database() {
  if (fixture) return null
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(process.env.SUPABASE_URL || PROJECT, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Answers a query, or throws with the table it was asked of. */
async function rows(query, what) {
  const { data, error } = await query
  if (error) throw new Error(`could not read ${what}: ${error.message}`)
  return data ?? []
}

/** Everybody who works here, by full name. */
async function readTeam(db) {
  if (fixture) return fixture.team ?? []
  const found = await rows(
    db.from('profiles').select('full_name').in('role', ['admin', 'staff']),
    'the team'
  )
  // A team read that comes back empty is a read that went wrong, not a studio
  // with nobody in it, and carding against it would card a colleague.
  if (!found.length) throw new Error('the team read came back empty, so no review is carded')
  return found.map(row => row.full_name).filter(Boolean)
}

/** Every row already written for one kind of card, by key. */
async function readRecorded(db, kind) {
  const found = fixture
    ? (fixture.recorded ?? []).filter(row => row.kind === kind)
    : await rows(db.from(TABLE).select('*').eq('kind', kind), TABLE)
  return new Map(found.map(row => [row.key, row]))
}

/** Writes a row, unless this is a dry run. */
async function record(db, row) {
  if (dryRun || fixture) return
  const { error } = await db
    .from(TABLE)
    .upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'kind,key' })
  if (error) throw new Error(`could not record ${row.kind} ${row.key}: ${error.message}`)
}

/** The Buffer key, or a run answering from the fixture. */
function buffer() {
  if (fixture) {
    const { channels = [], posts = [] } = fixture.buffer ?? {}
    const answer = query =>
      query.includes('organizations')
        ? { account: { organizations: [{ id: 'org' }] } }
        : query.includes('channels(')
          ? { channels }
          : { posts: { edges: posts.map(node => ({ node })) } }
    return connect('fixture', {
      get: async (_, init) => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ data: answer(JSON.parse(init.body).query) }),
      }),
    })
  }
  const key = process.env.BUFFER_API_KEY
  if (!key) throw new Error('BUFFER_API_KEY is not set')
  return connect(key)
}

// ---------------------------------------------------------------------------
// Drawing and storing
// ---------------------------------------------------------------------------

/**
 * The card drawn, from the first of `items` whose copy fits.
 *
 * Only a card that does not fit moves on to the next item; any other refusal -
 * a guard, a missing face - ends the run, because a shorter quote does not make
 * a client's name or a missing font go away.
 */
async function draw(items, template, key) {
  const browser = await launch()
  try {
    const { shared, runtime } = await sheet(browser)
    const context = await browser.newContext({ viewport: T.IMAGE, deviceScaleFactor: 1 })
    const page = await context.newPage()
    let last = null
    for (const item of items) {
      try {
        const html = T.page({ size: T.IMAGE, ...template(item) }, shared, runtime)
        const { fit, png } = await renderStill(page, html, null, key)
        return { item, png, shrunk: fit.shrunk }
      } catch (cause) {
        if (!/does not fit/.test(cause.message)) throw cause
        last = cause
      }
    }
    throw last ?? new Error(`${key}: nothing to draw`)
  } finally {
    await browser.close()
  }
}

/** Puts the PNG where Buffer will fetch it, or beside the dry run's other output. */
async function store(db, path, png) {
  if (dryRun || fixture) {
    const dir = option('--out') ?? join(tmpdir(), 'generated-cards')
    const file = join(dir, path)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, png)
    return { url: cardUrl(path), file }
  }
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, png, { contentType: 'image/png', cacheControl: '86400', upsert: true })
  if (error) throw new Error(`could not store ${path}: ${error.message}`)
  return { url: cardUrl(path), file: null }
}

/** Each channel's words, refused for anything the card itself would be refused for. */
function checked(texts) {
  for (const [service, text] of Object.entries(texts)) {
    const found = faults(text)
    if (found.length) throw new Error(`the ${service} post carries ${found.join(', ')}`)
  }
  return texts
}

/**
 * Queues a drawn card and keeps the record in step with every post placed.
 *
 * @returns {Promise<object>} What `queueCard` answered.
 */
async function queue(db, row, { image, alt, texts, now }) {
  const placed = [...(row.posts ?? [])]
  const answer = await queueCard(buffer(), {
    image,
    alt,
    texts: checked(texts),
    placed: placed.map(entry => entry.service),
    now,
    dryRun: dryRun || Boolean(fixture),
    onPlaced: async entry => {
      placed.push(entry)
      await record(db, { ...row, posts: placed })
    },
  })
  if (answer.settled) await record(db, { ...row, posts: placed, state: 'queued' })
  return answer
}

// ---------------------------------------------------------------------------
// The two cards
// ---------------------------------------------------------------------------

async function review(now) {
  const db = database()
  const listing = await readListing(fixture ? 'fixture' : process.env.GOOGLE_PLACES_API_KEY, {
    get: fixture
      ? async () => ({ ok: true, status: 200, json: async () => fixture.listing })
      : fetch,
  })
  const team = await readTeam(db)
  const recorded = await readRecorded(db, 'review')
  const { card, skipped, done } = choose({
    reviews: listing.reviews,
    team,
    recorded,
    passes,
    towns: TOWNS,
  })

  // Written so the table says why a review was passed over, and rewritten only
  // when the reason changes, so the row's date is when it was last decided.
  for (const entry of skipped) {
    const row = recorded.get(entry.id)
    if (row?.state === 'skipped' && row.reason === entry.reason) continue
    await record(db, { kind: 'review', key: entry.id, state: 'skipped', reason: entry.reason })
  }

  // Google answers a listing's rating count whatever it does with the reviews
  // behind it. A listing with ratings and no reviews returned is a listing this
  // run could not read, and "nothing new" said over it would be untrue.
  const unread = listing.count > 0 && !listing.reviews.length
  const summary = {
    command: 'review',
    dryRun,
    listing: { rating: listing.rating, ratings: listing.count, returned: listing.reviews.length },
    skipped,
    alreadyCarded: done.length,
  }

  if (!card) {
    console.log(JSON.stringify({ ...summary, card: null }, null, 2))
    if (unread) {
      say(
        `the Google listing carries ${listing.count} ratings and the Places API returned none of the reviews, so no review could be read`
      )
      return 1
    }
    say('no review is waiting to be carded')
    return 0
  }

  const { review: chosen } = card
  const row = recorded.get(chosen.id) ?? { kind: 'review', key: chosen.id, posts: [] }
  let image
  let detail
  if (card.resume && row.image_url && row.detail?.quote) {
    image = row.image_url
    detail = row.detail
  } else {
    const items = card.quotes.map(quote =>
      reviewCardItem({
        stars: chosen.stars,
        quote,
        subject: card.subject,
        publishedAt: chosen.publishedAt,
      })
    )
    const drawn = await draw(items, T.reviewCard, `review ${chosen.id}`)
    detail = {
      stars: chosen.stars,
      quote: drawn.item.quote,
      subject: card.subject,
      publishedAt: chosen.publishedAt,
    }
    const stored = await store(db, reviewPath(chosen), drawn.png)
    image = stored.url
    summary.file = stored.file
    await record(db, { ...row, state: 'drawn', reason: null, image_url: image, detail })
  }

  const alt = reviewAlt(detail)
  altGuard(`review ${chosen.id}`, alt)
  const queued = await queue(
    db,
    { ...row, state: 'drawn', reason: null, image_url: image, detail },
    { image, alt, texts: reviewTexts(detail), now }
  )
  console.log(
    JSON.stringify(
      { ...summary, card: { id: chosen.id, ...detail, image, alt }, ...queued },
      null,
      2
    )
  )
  if (queued.needsAttention) {
    say(
      `the review card was held on ${queued.held
        .filter(entry => entry.code !== 'already-queued')
        .map(entry => `${entry.service} (${entry.reason})`)
        .join(', ')}`
    )
    return 1
  }
  say(
    `a ${chosen.stars}-star review ${dryRun || fixture ? 'would be' : 'was'} carded on ${queued.queued.map(entry => `${entry.service} for ${entry.dueAt}`).join(', ') || 'no new channel'}`
  )
  return 0
}

async function proof(now) {
  const due = dueOn(now)
  if (!due.due && !flag('--force')) {
    console.log(JSON.stringify({ command: 'proof', due }, null, 2))
    say(`no proof card is due today (${due.reason})`)
    return 0
  }

  const db = database()
  const recorded = await readRecorded(db, 'proof')
  const row = recorded.get(due.month) ?? { kind: 'proof', key: due.month, posts: [] }
  if (row.state === 'queued') {
    console.log(JSON.stringify({ command: 'proof', due, card: row }, null, 2))
    say(`the ${due.month} proof card is already queued`)
    return 0
  }

  let image
  let detail
  const summary = { command: 'proof', dryRun, due }
  if (row.state === 'drawn' && row.image_url && row.detail?.sites) {
    image = row.image_url
    detail = row.detail
  } else {
    const clientSites = fixture
      ? fixture.clientSites
      : await rows(db.from('client_sites').select('domain, exempt'), 'client_sites')
    const readings = fixture
      ? fixture.readings
      : await rows(
          db.from('site_speed').select('url, strategy, performance, fetched_at'),
          'site_speed'
        )
    const trades = await loadTrades()
    detail = proofFrom({
      clientSites,
      readings,
      projects: PORTFOLIO_PROJECTS,
      tradeNames: new Map(trades.map(trade => [trade.id, trade.name])),
      date: due.date,
    })
    summary.left = detail.left
    if (detail.count < MIN_SITES) {
      console.log(JSON.stringify({ ...summary, proof: detail }, null, 2))
      say(
        `only ${detail.count} client sites carry a phone and a desktop reading from ${due.date}, under the ${MIN_SITES} a proof card is drawn over, so the daily maintenance readings have not landed`
      )
      return 1
    }
    const drawn = await draw([proofCardItem(detail)], T.proofCard, `proof ${due.month}`)
    const stored = await store(db, proofPath(due.month), drawn.png)
    image = stored.url
    summary.file = stored.file
    summary.shrunk = drawn.shrunk
    await record(db, { ...row, state: 'drawn', image_url: image, detail })
  }

  const alt = proofAlt(detail)
  altGuard(`proof ${due.month}`, alt)
  const queued = await queue(
    db,
    { ...row, state: 'drawn', image_url: image, detail },
    { image, alt, texts: proofTexts(detail), now }
  )
  console.log(JSON.stringify({ ...summary, proof: detail, image, alt, ...queued }, null, 2))
  if (queued.needsAttention) {
    say(
      `the proof card was held on ${queued.held
        .filter(entry => entry.code !== 'already-queued')
        .map(entry => `${entry.service} (${entry.reason})`)
        .join(', ')}`
    )
    return 1
  }
  say(
    `the ${due.month} proof card over ${detail.count} sites ${dryRun || fixture ? 'would be' : 'was'} queued on ${queued.queued.map(entry => `${entry.service} for ${entry.dueAt}`).join(', ') || 'no new channel'}`
  )
  return 0
}

async function main() {
  const now = option('--now')
    ? new Date(option('--now'))
    : fixture?.now
      ? new Date(fixture.now)
      : new Date()
  if (command === 'review') return review(now)
  if (command === 'proof') return proof(now)
  console.error(
    'usage: generated-cards.js review|proof [--dry-run] [--out DIR] [--fixture FILE] [--now ISO] [--force]'
  )
  return 64
}

main().then(
  code => process.exit(code),
  error => {
    say(error.code ? `${error.code}: ${error.message}` : error.message)
    process.exit(1)
  }
)
