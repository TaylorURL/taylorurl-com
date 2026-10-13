/**
 * Draws the social cards that come from live data, stores them, and queues them.
 *
 *   node scripts/social/generated-cards.js review              the Google listing, once a day
 *   node scripts/social/generated-cards.js proof               the month's PageSpeed card
 *   node scripts/social/generated-cards.js launch              a client site that went live
 *   node scripts/social/generated-cards.js review --dry-run [--out DIR]
 *   node scripts/social/generated-cards.js proof --dry-run --force [--out DIR]
 *   node scripts/social/generated-cards.js launch --dry-run [--out DIR]
 *   node scripts/social/generated-cards.js <review|proof|launch> --fixture FILE --dry-run
 *
 * Run on the Pi from `~/work/taylorurl-com` by `social-cards-run.sh`, which the
 * intelligence repository carries: the review card every morning ahead of the
 * daily social routine, the proof card at midday on weekdays, when every
 * reading `site_speed` holds was taken that morning, and a client's launch every
 * evening, after the console has had the working day to mark a site live. Running from the
 * checkout of `develop` is deliberate: a change to what a card says reaches the
 * next run without waiting on a release of the site, because nothing here is
 * served by it.
 *
 * What each card says is decided in `lib/social/reviews.js`,
 * `lib/social/proof.js` and `lib/social/launches.js`, where it is checked; how
 * it is hosted and queued in `lib/social/generated.js`. What is here is the
 * reading, the drawing and the writing: the listing and the rows read, a
 * launched site filmed on a phone (`site-recording.js`), the card or the video
 * drawn on the library's own sheet and refused for anything the library would
 * be refused for, the file put in the public `social-cards` bucket, and the
 * post placed on every channel's next free slot.
 *
 * The record is written as the work goes rather than at the end. A card is
 * `drawn` once its image is stored and each post is added to it the moment
 * Buffer takes it, so a run that dies halfway is finished by the next one from
 * the same image and the same words, rather than drawn again and posted twice.
 *
 * A dry run reads everything a real run reads - the listing, the database,
 * Buffer's queue, a launched site - draws the card or the video to `--out`, and
 * writes nothing anywhere else: no object, no row, no post. `--fixture` takes
 * all of those reads from a file instead, so the whole path can be walked with
 * no keys at all; a fixture's site may carry its own `url` to be filmed at.
 *
 * The keys are read from the environment, where `with-credential.py` puts them:
 * GOOGLE_PLACES_API_KEY, BUFFER_API_KEY and SUPABASE_SERVICE_ROLE_KEY. The
 * launch run reads no listing and needs no Places key.
 *
 * The answer is JSON on stdout. The last line on stderr is one sentence, and the
 * exit code says whether a person has to act on it: 0 when the run did its job
 * or had none to do, 1 when something needs looking at. A listing whose reviews
 * come back without their words is a 0: the API's limit, not the run's fault.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { PORTFOLIO_PROJECTS } from '../../src/app/data/portfolio.js'
import { AREAS } from '../../src/app/data/towns-and-trades/areas.js'
import { bareDomain } from '../../src/app/utils/domains.js'
import { connect } from '../../lib/social/buffer.js'
import {
  BUCKET,
  CALL,
  PROJECT,
  cardUrl,
  queueCard,
  voiceFaults,
} from '../../lib/social/generated.js'
import {
  CLOSERS,
  READ_DAYS,
  allowFor,
  asShown,
  consented,
  frameTimeline,
  launchCardAlt,
  launchCardItem,
  launchLines,
  launchPaths,
  launchStillAlt,
  launchStillItem,
  launchTexts,
  launchesDue,
  nameOf,
  railDateOf,
  siteUrl,
  subjectOf,
  townOf,
  tradeOf,
} from '../../lib/social/launches.js'
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
  textUnavailable,
} from '../../lib/social/reviews.js'
import { altGuard, faults } from './media-guard.js'
import { loadTrades } from './media-content.js'
import { launch, renderClip, renderStill, sheet } from './media-sheet.js'
import { readSite, recordSite } from './site-recording.js'
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
 * a client's name or a missing font go away. A caller already holding a browser
 * hands it over and keeps it; `allow` is what `settle` takes.
 */
async function draw(items, template, key, { browser: open = null, allow = [] } = {}) {
  const browser = open ?? (await launch())
  try {
    const { shared, runtime } = await sheet(browser)
    const context = await browser.newContext({ viewport: T.IMAGE, deviceScaleFactor: 1 })
    try {
      const page = await context.newPage()
      let last = null
      for (const item of items) {
        try {
          const html = T.page({ size: T.IMAGE, ...template(item) }, shared, runtime)
          const { fit, png } = await renderStill(page, html, null, key, { allow })
          return { item, png, shrunk: fit.shrunk }
        } catch (cause) {
          if (!/does not fit/.test(cause.message)) throw cause
          last = cause
        }
      }
      throw last ?? new Error(`${key}: nothing to draw`)
    } finally {
      await context.close()
    }
  } finally {
    if (!open) await browser.close()
  }
}

/**
 * What the bucket is handed for each kind of file, and the most it takes of one.
 *
 * Checked here rather than left to the bucket, which holds one ceiling for
 * every file in it: a still held to the video's ceiling would be a still that
 * could grow four times over before anything said so.
 */
const STORED = {
  png: { type: 'image/png', ceiling: 2 * 1024 * 1024 },
  mp4: { type: 'video/mp4', ceiling: 8 * 1024 * 1024 },
}

/** Puts the file where Buffer will fetch it, or beside the dry run's other output. */
async function store(db, path, bytes) {
  const kind = STORED[path.split('.').pop()]
  if (!kind) throw new Error(`${path} is not a kind of file the bucket takes`)
  if (bytes.length > kind.ceiling) {
    throw new Error(
      `${path} is ${(bytes.length / 1048576).toFixed(2)} MB, over the ${kind.ceiling / 1048576} MB the bucket takes`
    )
  }
  if (dryRun || fixture) {
    const dir = option('--out') ?? join(tmpdir(), 'generated-cards')
    const file = join(dir, path)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, bytes)
    return { url: cardUrl(path), file }
  }
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: kind.type, cacheControl: '86400', upsert: true })
  if (error) throw new Error(`could not store ${path}: ${error.message}`)
  return { url: cardUrl(path), file: null }
}

/** Each channel's words, refused for anything the card itself would be refused for. */
function checked(texts, allow = []) {
  for (const [service, text] of Object.entries(texts)) {
    const found = faults(text, { allow })
    if (found.length) throw new Error(`the ${service} post carries ${found.join(', ')}`)
  }
  return texts
}

/**
 * Queues a drawn card and keeps the record in step with every post placed.
 *
 * @returns {Promise<object>} What `queueCard` answered.
 */
async function queue(db, row, { image, alt, texts, now, media = null, allow = [] }) {
  const placed = [...(row.posts ?? [])]
  const answer = await queueCard(buffer(), {
    image,
    alt,
    texts: checked(texts, allow),
    placed: placed.map(entry => entry.service),
    now,
    media,
    allow,
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
  // behind it, and some keys are never handed the reviews at all. That is said
  // in the log as what it is, not as "nothing new", and the run ends clean: it
  // is a limit nobody here can lift, and the same read cards the first review
  // the day the words come back.
  const unavailable = textUnavailable(listing)
  const summary = {
    command: 'review',
    dryRun,
    listing: { rating: listing.rating, ratings: listing.count, returned: listing.reviews.length },
    reviewText: unavailable ? 'unavailable' : 'returned',
    skipped,
    alreadyCarded: done.length,
  }

  if (!card) {
    console.log(JSON.stringify({ ...summary, card: null }, null, 2))
    say(
      unavailable
        ? `review text is unavailable from the Places API (the listing shows ${listing.count} ratings and none came back with words), so there is nothing to card`
        : 'no review is waiting to be carded'
    )
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
        `only ${detail.count} client sites carry a phone and a desktop reading from ${due.date}, under the ${MIN_SITES} a proof card is drawn over, so the day's readings have not landed`
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

// ---------------------------------------------------------------------------
// Launches
// ---------------------------------------------------------------------------

/** The builds marked live inside the window and the week before it. */
async function readLaunched(db, now) {
  if (fixture) return fixture.projects ?? []
  const since = new Date(now.getTime() - READ_DAYS * 86_400_000).toISOString()
  return rows(
    db
      .from('projects')
      .select('id, business_name, stage, status, launched_at, site_id')
      .eq('stage', 'live')
      .gte('launched_at', since),
    'projects'
  )
}

/**
 * What the run needs to know about each launch beside the build itself: the
 * brief the client answered, the pay form's brief, and the site the console
 * linked the build to.
 */
async function readLaunchContext(db, projects) {
  const ids = projects.map(project => project.id)
  const siteIds = projects.map(project => project.site_id).filter(Boolean)
  const onboarding = fixture
    ? (fixture.onboarding ?? [])
    : await rows(
        db.from('project_onboarding').select('project_id, answers').in('project_id', ids),
        'project_onboarding'
      )
  const briefs = fixture
    ? (fixture.briefs ?? [])
    : await rows(
        db
          .from('project_briefs')
          .select('project_id, answers, created_at')
          .in('project_id', ids)
          .order('created_at', { ascending: true }),
        'project_briefs'
      )
  const sites = fixture
    ? (fixture.sites ?? [])
    : siteIds.length
      ? await rows(
          db.from('analytics_sites').select('id, name').in('id', siteIds),
          'analytics_sites'
        )
      : []
  return {
    answers: new Map(onboarding.map(row => [row.project_id, row.answers ?? {}])),
    // Oldest first, so the newest brief for a project is the one left standing.
    briefs: new Map(briefs.map(row => [row.project_id, row.answers ?? []])),
    sites: new Map(sites.map(row => [row.id, row])),
  }
}

/** A picture as the page carries it. */
const dataUrl = (bytes, type = 'image/jpeg') => `data:${type};base64,${bytes.toString('base64')}`

/**
 * Whether a business's name can stand in a named post, or why it cannot.
 *
 * The name is the client's to write and is printed as they wrote it, so it is
 * excused the client and voice rules; the rest still apply. A name carrying an
 * emoji, a price or a question mark cannot be printed in the studio's voice,
 * and the launch goes out without it rather than not at all.
 */
function printable(name) {
  const allow = [name]
  const lines = ['call with one tap', ...CLOSERS]
  const texts = launchTexts({ named: true, who: name, lines, launchedAt: new Date() })
  const found = [
    ...faults(`${name} is live.`, { allow }),
    ...Object.entries(texts).flatMap(([service, text]) => [
      ...voiceFaults(service, text, { allow }),
      ...faults(text, { allow }),
    ]),
  ]
  return found.length ? found[0] : null
}

/** The video drawn and cut, with its poster. */
async function cutClip(browser, video, allow) {
  const { shared, runtime } = await sheet(browser)
  const context = await browser.newContext({ viewport: T.VIDEO, deviceScaleFactor: 1 })
  const dir = mkdtempSync(join(tmpdir(), 'launch-clip-'))
  try {
    const page = await context.newPage()
    const file = join(dir, 'clip.mp4')
    const { poster } = await renderClip(page, T.videoPage(video, shared, runtime), video, file, {
      allow,
    })
    return { mp4: readFileSync(file), poster }
  } finally {
    await context.close()
    rmSync(dir, { recursive: true, force: true })
  }
}

/** The line the last scene of a launch video says, over the number. */
const CLOSE = 'We build sites like this for *local* businesses.'

/**
 * One launch, drawn, stored and queued, or resumed from where a run left it.
 *
 * Which version goes out is decided again on every run from the answer as it
 * stands, so a client who takes their yes back before the post is placed is
 * posted without their name; a channel that already took the named post keeps
 * it, because nothing here takes a post down.
 *
 * @returns {Promise<object>} What was done, for the run's answer.
 */
async function postLaunch(db, entry, context, now) {
  const { project, on } = entry
  const answers = context.answers.get(project.id) ?? {}
  const brief = context.briefs.get(project.id) ?? []
  const site = project.site_id ? context.sites.get(project.site_id) : null
  const domain = site?.name ?? null
  const said = consented(answers)
  const name = nameOf(project, answers)
  const subject = subjectOf({ trade: tradeOf(brief), town: townOf(answers), passes })
  const paths = launchPaths(project.id)
  const key = `launch ${project.id}`

  // A yes with no site linked is the one case a person has to settle: the
  // client asked to be shown, and there is nothing to film until the console
  // says which site the build became.
  if (said && !domain) {
    throw new Error(
      `the build that went live on ${on} said yes to being shown, and the console links it to no site, so there is nothing to film`
    )
  }
  const unprintable = said && name ? printable(name) : null
  const named = Boolean(said && name && !unprintable)
  const why = !said
    ? 'not-consented'
    : !name
      ? 'no-name'
      : unprintable
        ? `name-unprintable: ${unprintable}`
        : null

  const row = entry.row ?? { kind: 'launch', key: project.id, posts: [] }
  const summary = { project: project.id, launchedOn: on, named, why }
  let detail
  let image
  if (row.state === 'drawn' && row.image_url && row.detail?.named === named) {
    image = row.image_url
    detail = row.detail
    summary.resumed = true
  } else {
    const browser = await launch()
    try {
      if (named) {
        const recording = await recordSite(browser, site.url ?? siteUrl(domain))
        const lines = launchLines({ answers, facts: recording.facts })
        const allow = allowFor({ name, domain })
        const { frames, loaded } = frameTimeline(
          {
            load: recording.load.map(frame => ({ at: frame.at, src: dataUrl(frame.jpeg) })),
            painted: recording.painted,
            scroll: recording.scroll.map(jpeg => dataUrl(jpeg)),
          },
          { end: 7.8 }
        )
        const clip = await cutClip(
          browser,
          T.launchClip({
            key,
            name,
            domain: bareDomain(domain),
            lines: lines.map(asShown),
            frames,
            counter: railDateOf(project.launched_at),
            close: CLOSE,
            path: CALL,
          }),
          allow
        )
        const still = await draw(
          [
            launchStillItem({
              name,
              domain,
              lines,
              launchedAt: project.launched_at,
              shot: dataUrl(recording.shot),
            }),
          ],
          T.launchSiteCard,
          key,
          { browser, allow }
        )
        const video = await store(db, paths.video, clip.mp4)
        const card = await store(db, paths.still, still.png)
        if (dryRun || fixture) {
          const poster = join(
            video.file,
            '..',
            paths.video.split('/').pop().replace('.mp4', '-poster.png')
          )
          writeFileSync(poster, clip.poster)
          summary.files = { video: video.file, poster, still: card.file }
        }
        summary.recording = {
          url: recording.url,
          frames: recording.load.length,
          firstPaint: recording.painted,
          loaded: Number(recording.loaded.toFixed(2)),
          shownLoaded: Number(loaded.toFixed(2)),
          scroll: recording.scroll.length,
          bytes: clip.mp4.length,
        }
        image = video.url
        detail = {
          named: true,
          name,
          domain: bareDomain(domain),
          lines,
          launchedAt: project.launched_at,
          still: card.url,
          facts: { tel: recording.facts.tel, sms: recording.facts.sms, form: recording.facts.form },
        }
      } else {
        // The page is read for the lines and nothing else: no picture of it is
        // kept, and a site that does not answer leaves the lines to the brief.
        const facts = domain
          ? await readSite(browser, site.url ?? siteUrl(domain)).catch(cause => {
              summary.siteUnread = cause.message
              return null
            })
          : null
        const lines = launchLines({ answers, facts })
        const drawn = await draw(
          [launchCardItem({ subject, lines, launchedAt: project.launched_at })],
          T.launchCard,
          key,
          { browser }
        )
        const card = await store(db, paths.card, drawn.png)
        if (dryRun || fixture) summary.files = { card: card.file }
        image = card.url
        detail = { named: false, subject, lines, launchedAt: project.launched_at, why }
      }
    } finally {
      await browser.close()
    }
    await record(db, { ...row, state: 'drawn', reason: why, image_url: image, detail })
  }

  const texts = launchTexts({
    named: detail.named,
    who: detail.named ? detail.name : detail.subject,
    lines: detail.lines,
    launchedAt: detail.launchedAt,
  })
  let alt
  let media = null
  let allow = []
  if (detail.named) {
    allow = allowFor({ name: detail.name, domain: detail.domain })
    alt = launchStillAlt(detail)
    const reel = {
      video: { url: image, metadata: { title: `${detail.name} is live`, thumbnailOffset: 0 } },
    }
    media = {
      facebook: [reel],
      instagram: [reel],
      googlebusiness: [{ image: { url: detail.still, metadata: { altText: alt } } }],
    }
  } else {
    alt = launchCardAlt(detail)
  }
  altGuard(key, alt, { allow })

  const queued = await queue(
    db,
    { ...row, state: 'drawn', reason: why, image_url: image, detail },
    { image, alt, texts, now, media, allow }
  )
  return { ...summary, detail, alt, ...queued }
}

async function launches(now) {
  const db = database()
  const projects = await readLaunched(db, now)
  const recorded = await readRecorded(db, 'launch')
  const { due, late, done } = launchesDue({ projects, recorded, now })

  // A launch past its week is written down once as passed over, so the table
  // says why it never posted and the next run does not ask again.
  for (const entry of late) {
    await record(db, {
      ...(entry.row ?? { kind: 'launch', key: entry.project.id, posts: [] }),
      state: 'skipped',
      reason: 'past-window',
    })
  }

  const summary = {
    command: 'launch',
    dryRun,
    read: projects.length,
    due: due.map(entry => ({ project: entry.project.id, launchedOn: entry.on })),
    passedOver: late.map(entry => ({ project: entry.project.id, launchedOn: entry.on })),
    alreadyPosted: done.length,
  }
  if (!due.length) {
    console.log(JSON.stringify(summary, null, 2))
    say(
      late.length
        ? `no launch is waiting for its post, and ${late.length} past its week ${late.length === 1 ? 'was' : 'were'} passed over`
        : 'no client site launched in the last week is waiting for its post'
    )
    return 0
  }

  // One launch a run, oldest first. A launch that cannot be posted is reported
  // and the next one is tried, so one site that will not load does not hold up
  // every launch behind it for a week.
  const context = await readLaunchContext(
    db,
    due.map(entry => entry.project)
  )
  const failed = []
  let posted = null
  for (const entry of due) {
    try {
      posted = await postLaunch(db, entry, context, now)
      break
    } catch (cause) {
      failed.push({ project: entry.project.id, launchedOn: entry.on, error: cause.message })
    }
  }
  console.log(JSON.stringify({ ...summary, posted, failed }, null, 2))

  const would = dryRun || fixture ? 'would be' : 'was'
  const where = posted?.queued.map(entry => `${entry.service} for ${entry.dueAt}`).join(', ')
  const said = posted
    ? `the launch from ${posted.launchedOn} ${would} posted ${posted.named ? 'by name' : 'without the name'} on ${where || 'no new channel'}`
    : null
  if (failed.length) {
    say(
      [said, `the launch from ${failed[0].launchedOn} could not be posted: ${failed[0].error}`]
        .filter(Boolean)
        .join('; ')
    )
    return 1
  }
  if (posted.needsAttention) {
    say(
      `the launch from ${posted.launchedOn} was held on ${posted.held
        .filter(entry => entry.code !== 'already-queued')
        .map(entry => `${entry.service} (${entry.reason})`)
        .join(', ')}`
    )
    return 1
  }
  say(said)
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
  if (command === 'launch') return launches(now)
  console.error(
    'usage: generated-cards.js review|proof|launch [--dry-run] [--out DIR] [--fixture FILE] [--now ISO] [--force]'
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
