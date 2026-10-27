/**
 * Checks the launch posts: which launches are posted, whom each one names, what
 * it says, and where it lands.
 *
 * A launch post goes out with nobody watching, on the evening a client's site
 * goes live, and it is the one post the studio publishes that can name a client.
 * So the decisions that matter most are walked here against fixtures, where a
 * mistake costs a pull request rather than a client's trust: that only a stored
 * yes names the business and everything else - no, unanswered, no brief at all
 * - names a trade and a town; that a yes from one client never lets another
 * client's name through the guard; that the three lines are the studio's fixed
 * words, borne out by the brief and the page; that every post holds to the
 * voice; that a launch is posted once, inside its week, and passed over after
 * it; and that the video is cut on the channels that play one and the still
 * goes where none can.
 *
 * Nothing here launches a browser or reaches a network. The recording and the
 * drawing are the sheet's own, shared with the library and the other generated
 * cards; what is checked is everything handed to them, and the run itself
 * through the paths that end before anything is drawn.
 *
 *   npm run check:launch-posts
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CADENCE } from '../../lib/social/buffer.js'
import { CALL, SERVICES, cardUrl, plan, voiceFaults } from '../../lib/social/generated.js'
import {
  CLOSERS,
  LINES,
  SHOWCASE_KEY,
  WINDOW_DAYS,
  allowFor,
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
  subjectOf,
  townOf,
  tradeOf,
} from '../../lib/social/launches.js'
import { MAX_SENTENCES, sentenceCount } from '../../lib/social/voice.js'
import { STEPS } from '../../src/app/views/console/lib/onboarding.js'
import { PORTFOLIO_PROJECTS } from '../../src/app/data/portfolio.js'
import { cases, check, finish, is, ok, raised, same } from '../harness/checks.js'
import { altFaults, faults } from './media-guard.js'
import { PHONE, SLOW_4G, cpuSlowdown } from './site-recording.js'
import { launchCard, launchClip, launchSiteCard } from './media-templates/templates.js'

const passes = text => faults(text).length === 0
const NOW = new Date('2026-10-13T23:13:00Z')
const LAUNCHED = '2026-10-13T19:05:00Z'

// Two clients' names, read off the portfolio rather than written here, so the
// check names nobody itself and holds whatever the portfolio says.
const [CLIENT, OTHER] = PORTFOLIO_PROJECTS.filter(project => project.kind === 'client')
const NAME = 'Bellview Plumbing'
const DOMAIN = 'bellviewplumbing.example'

// ---------------------------------------------------------------------------
// The question and the answer
// ---------------------------------------------------------------------------

check('the brief asks the question once, optional, with Yes and No and nothing else', () => {
  const fields = STEPS.flatMap(step => step.fields)
  const asked = fields.filter(field => field.key === SHOWCASE_KEY)
  same(asked.length, 1, 'fields asking it')
  const [field] = asked
  same(field.kind, 'choice', 'its kind')
  same(field.required, false, 'whether it is required')
  same(field.fill, null, 'its prefill')
  same(field.options.map(option => option.id).join(), 'yes,no', 'its answers')
  same(field.options.map(option => option.name).join(), 'Yes,No', 'how they read')
  same(
    field.help,
    'Can I post your new site and your business name on my social pages when it goes live?',
    'the question as asked'
  )
})

for (const [answers, expected, why] of [
  [{ contacts: { showcase: 'yes' } }, true, 'a stored yes'],
  [{ contacts: { showcase: 'no' } }, false, 'a stored no'],
  [{ contacts: {} }, false, 'the question left alone'],
  [{}, false, 'a brief with nothing in it'],
  [null, false, 'no brief at all'],
  [{ contacts: { showcase: 'Yes' } }, false, 'a value the form never stores'],
  [{ contacts: { showcase: true } }, false, 'a value of the wrong kind'],
  [{ contacts: 'yes' }, false, 'a step stored as a string'],
]) {
  is(`${why} reads as ${expected ? 'a yes' : 'not a yes'}`, consented(answers), expected)
}

// ---------------------------------------------------------------------------
// Which launches a run is for
// ---------------------------------------------------------------------------

const project = (id, launchedAt, extra = {}) => ({
  id,
  business_name: 'Fixture Business',
  stage: 'live',
  status: 'complete',
  launched_at: launchedAt,
  site_id: 'site-fixture',
  ...extra,
})

check('a launch is a live build with a stamp, posted on its day and the six after', () => {
  const { due, late } = launchesDue({
    projects: [
      project('today', '2026-10-13T19:05:00Z'),
      project('six-days', '2026-10-07T15:00:00Z'),
      project('seven-days', '2026-10-06T15:00:00Z'),
      project('not-live', '2026-10-13T15:00:00Z', { stage: 'checks' }),
      project('cancelled', '2026-10-13T15:00:00Z', { status: 'cancelled' }),
      project('no-stamp', null),
      project('ahead', '2026-10-15T15:00:00Z'),
    ],
    recorded: new Map(),
    now: NOW,
  })
  same(due.map(entry => entry.project.id).join(), 'six-days,today', 'due, oldest first')
  same(late.map(entry => entry.project.id).join(), 'seven-days', 'passed over')
  same(WINDOW_DAYS, 7, 'the window')
})

check('the launch day is the day in Central, not the day in UTC', () => {
  // 01:30 UTC on the 14th is 20:30 on the 13th in Baytown.
  const { due } = launchesDue({
    projects: [project('evening', '2026-10-14T01:30:00Z')],
    recorded: new Map(),
    now: new Date('2026-10-14T02:00:00Z'),
  })
  same(due[0]?.on, '2026-10-13', 'the launch day')
})

check('a launch posted is never posted again, and one left half done goes first', () => {
  const { due, done } = launchesDue({
    projects: [
      project('older', '2026-10-10T15:00:00Z'),
      project('posted', '2026-10-11T15:00:00Z'),
      project('half', '2026-10-12T15:00:00Z'),
      project('skipped', '2026-10-12T16:00:00Z'),
    ],
    recorded: new Map([
      ['posted', { state: 'queued' }],
      ['half', { state: 'drawn', image_url: 'x', detail: {} }],
      ['skipped', { state: 'skipped', reason: 'past-window' }],
    ]),
    now: NOW,
  })
  same(done.join(), 'posted', 'already posted')
  same(due.map(entry => entry.project.id).join(), 'half,older', 'the order a run takes them in')
  same(due[0].resume, true, 'the half-done one resumes')
})

// ---------------------------------------------------------------------------
// Whom an anonymous launch describes
// ---------------------------------------------------------------------------

const brief = trade => [{ label: 'Business Type', value: trade }]

check('the trade comes from the pay form and is named as the review cards name it', () => {
  same(tradeOf(brief('Plumbing'))?.noun, 'a plumbing company', 'plumbing')
  same(tradeOf(brief('Barber Shop'))?.noun, 'a barber shop', 'a barber shop')
  same(tradeOf(brief('HVAC'))?.noun, 'an HVAC company', 'HVAC')
  same(tradeOf(brief('Something Else')), null, 'something else')
  same(tradeOf([]), null, 'no brief')
})

for (const [answers, expected, why] of [
  [{ business: { address: { none: false, city: 'Crosby' } } }, 'Crosby', 'the address'],
  [{ business: { address: { none: false, city: 'mont belvieu' } } }, 'Mont Belvieu', 'case'],
  [
    { business: { address: { none: true }, service_area: ['Highlands', 'Baytown'] } },
    'Highlands',
    'no address, so the first town covered',
  ],
  [{ business: { address: { none: false, city: '77520' } } }, null, 'a postcode'],
  [
    { business: { address: { none: false, city: 'We cover the whole county!' } } },
    null,
    'a sentence',
  ],
  [{}, null, 'nothing given'],
]) {
  is(`the town from ${why}`, townOf(answers), expected)
}

check('an anonymous launch is described down to what the guard lets through', () => {
  const trade = { noun: 'a roofing company' }
  same(subjectOf({ trade, town: 'Crosby', passes }), 'a roofing company in Crosby', 'both')
  same(subjectOf({ trade: null, town: 'Crosby', passes }), 'a local business in Crosby', 'no trade')
  same(subjectOf({ trade, town: null, passes }), 'a roofing company', 'no town')
  // A town carrying another client's name comes off rather than onto a card.
  const named = CLIENT.name.split(/\s+/)[0]
  same(subjectOf({ trade, town: named, passes }), 'a roofing company', 'a town the guard refuses')
})

check(
  "a named post uses the client's own spelling, with nothing the sheet would read as markup",
  () => {
    same(
      nameOf({ business_name: 'bellview plumbing' }, { brand: { name_as_written: NAME } }),
      NAME,
      'the brief over the pay form'
    )
    same(nameOf({ business_name: NAME }, {}), NAME, 'the pay form with no brief')
    same(nameOf({ business_name: '*Bell*  view' }, {}), 'Bell view', 'asterisks and spacing')
    same(nameOf({ business_name: '  ' }, {}), null, 'no name at all')
  }
)

// ---------------------------------------------------------------------------
// The three lines
// ---------------------------------------------------------------------------

const ANSWERS = {
  customers: { decision: 'books_online' },
  contacts: { text_ok: 'no' },
  pages: {
    chosen: ['services', 'reviews', 'service_areas', 'book', 'contact'],
    services: [{ name: 'Water heaters' }, { name: 'Repipes' }],
  },
}
const FACTS = {
  tel: true,
  sms: false,
  form: true,
  links: ['/services services', '/book book online', '/reviews reviews'],
}

check('the line for what customers do first leads, and every line is borne out', () => {
  const lines = launchLines({ answers: ANSWERS, facts: FACTS })
  same(lines.length, 3, 'lines')
  same(lines[0], 'book a time online', 'the first')
  same(lines[1], 'call with one tap', 'the second')
  same(lines[2], 'see every service in one place', 'the third')
})

check('a line the page does not bear out is left off, and the closers fill in', () => {
  const lines = launchLines({
    answers: ANSWERS,
    facts: { tel: false, sms: false, form: false, links: [] },
  })
  same(lines.join(' | '), CLOSERS.join(' | '), 'the lines')
})

check('with the page unread the brief decides, and nothing is ever said twice', () => {
  const lines = launchLines({ answers: ANSWERS, facts: null })
  same(lines.length, 3, 'lines')
  same(new Set(lines).size, 3, 'distinct lines')
  const bare = launchLines({ answers: {}, facts: null })
  same(
    bare.join(' | '),
    ['call with one tap', ...CLOSERS.slice(0, 2)].join(' | '),
    'an empty brief'
  )
})

check('every line is the studio’s fixed words, short, and clean on a card', () => {
  const faulty = [...LINES.map(entry => entry.line), ...CLOSERS].filter(
    line => line.length > 44 || !passes(line) || /[.!?]$/.test(line) || line !== line.toLowerCase()
  )
  same(faulty.join(', '), '', 'lines that would not sit on a card')
})

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

const LINES3 = ['call with one tap', 'book a time online', 'see every service in one place']
const NAMED = launchTexts({ named: true, who: NAME, lines: LINES3, launchedAt: LAUNCHED })
const SUBJECT = 'a plumbing company in Baytown'
const ANONYMOUS = launchTexts({
  named: false,
  who: SUBJECT,
  lines: LINES3,
  launchedAt: LAUNCHED,
})
const ALLOW = allowFor({ name: NAME, domain: DOMAIN })

check('every launch post holds to the voice on every channel, in both versions', () => {
  const faulty = []
  for (const [version, texts, allow] of [
    ['named', NAMED, ALLOW],
    ['anonymous', ANONYMOUS, []],
  ]) {
    for (const service of SERVICES) {
      const text = texts[service]
      const found = [...voiceFaults(service, text, { allow }), ...faults(text, { allow })]
      if (found.length) faulty.push(`${version} ${service}: ${found.join('; ')}`)
      if (sentenceCount(text) > MAX_SENTENCES) faulty.push(`${version} ${service}: too long`)
      if (!text.startsWith(`Customers of ${version === 'named' ? NAME : SUBJECT} can now`))
        faulty.push(`${version} ${service}: does not lead with what customers get`)
    }
    for (const service of ['facebook', 'instagram']) {
      if (!texts[service].endsWith(`\n\n${CALL}`))
        faulty.push(`${version} ${service}: ends somewhere other than the number`)
    }
    if (/\d{3}\D{0,2}\d{3}\D?\d{4}/.test(texts.googlebusiness))
      faulty.push(`${version} googlebusiness: carries a number`)
  }
  same(faulty.join('\n'), '', 'faults')
})

check('the date a post names is the launch day, written out', () => {
  ok(NAMED.facebook.includes('went live on October 13.'), NAMED.facebook)
  ok(ANONYMOUS.googlebusiness.includes('went live on October 13.'), ANONYMOUS.googlebusiness)
})

check('an anonymous launch never names the business or its address, anywhere', () => {
  const item = launchCardItem({ subject: SUBJECT, lines: LINES3, launchedAt: LAUNCHED })
  const alt = launchCardAlt({ subject: SUBJECT, lines: LINES3, launchedAt: LAUNCHED })
  const said = [...Object.values(ANONYMOUS), alt, JSON.stringify(item)].join('\n')
  for (const word of [NAME, 'Bellview', DOMAIN, 'bellviewplumbing'])
    ok(!said.includes(word), `the anonymous launch says ${word}`)
  same(faults(said).join(', '), '', 'what the guard finds in it')
  same(altFaults(alt).join(', '), '', 'what the alt guard finds in its alt')
  const drawn = launchCard(item)
  ok(!/<img/.test(drawn.inner), 'the anonymous card carries a picture')
})

check('a named launch names the business on every channel and in its still', () => {
  for (const service of SERVICES) ok(NAMED[service].includes(NAME), `${service} leaves it off`)
  const alt = launchStillAlt({ name: NAME, domain: DOMAIN, lines: LINES3, launchedAt: LAUNCHED })
  ok(alt.includes(NAME) && alt.includes(DOMAIN), alt)
  same(faults(alt, { allow: ALLOW }).join(', '), '', 'what the guard finds in the alt')
  same(altFaults(alt).join(', '), '', 'what the alt guard finds')
  const still = launchSiteCard(
    launchStillItem({
      name: NAME,
      domain: `www.${DOMAIN}`,
      lines: LINES3,
      launchedAt: LAUNCHED,
      shot: 'data:image/jpeg;base64,AAAA',
    })
  )
  ok(still.inner.includes(`>${DOMAIN}</div>`), 'the still reads the bare address')
})

// ---------------------------------------------------------------------------
// The guard, and the one name a yes lets through
// ---------------------------------------------------------------------------

check("a yes lets that client's own name through and nobody else's", () => {
  const theirs = `${CLIENT.name} is live.`
  ok(faults(theirs).length > 0, 'the guard did not refuse a client name to begin with')
  same(faults(theirs, { allow: [CLIENT.name] }).join(', '), '', 'their own name, allowed')
  const both = `${CLIENT.name} and ${OTHER.name} are live.`
  ok(
    faults(both, { allow: [CLIENT.name] }).some(found => found.includes('client name')),
    "one client's yes let another client's name through"
  )
  const first = CLIENT.name.split(/\s+/)[0]
  if (first !== CLIENT.name) {
    ok(
      faults(`${CLIENT.name} and ${first} again.`, { allow: [CLIENT.name] }).length > 0,
      'the first word standing alone was let through'
    )
  }
})

check('a name is excused the voice rules and nothing else', () => {
  const name = 'We Fix It Plumbing'
  ok(faults(`${name} is live.`).length > 0, 'the guard did not read "We" as the studio speaking')
  same(faults(`${name} is live.`, { allow: [name] }).join(', '), '', 'the name, allowed')
  ok(
    faults(`${name} is live. Our work.`, { allow: [name] }).length > 0,
    'the voice of a team outside the name was let through'
  )
  ok(
    faults('Pool Guy \u{1F30A} is live.', { allow: ['Pool Guy \u{1F30A}'] }).length > 0,
    'an emoji inside an allowed name was let through'
  )
  same(voiceFaults('instagram', `${name} is live.\n\n${CALL}`, { allow: [name] }).length, 0, 'IG')
  ok(
    voiceFaults('instagram', `${name} is live.\n\n${CALL}`).length > 0,
    'the voice let "We" through with no name allowed'
  )
})

// ---------------------------------------------------------------------------
// Where it lands
// ---------------------------------------------------------------------------

const channel = service => ({
  id: `${service}-channel`,
  name: service,
  service,
  cadence: CADENCE[service],
  isDisconnected: false,
  isLocked: false,
  isQueuePaused: false,
})
const CHANNELS = SERVICES.map(channel)
const PATHS = launchPaths('0f3a8c2e-1b6d-4e1a-9c47-5d2b8e6f7a01')
const VIDEO = cardUrl(PATHS.video)
const STILL = cardUrl(PATHS.still)
const reel = { video: { url: VIDEO, metadata: { title: `${NAME} is live`, thumbnailOffset: 0 } } }
const MEDIA = {
  facebook: [reel],
  instagram: [reel],
  googlebusiness: [{ image: { url: STILL, metadata: { altText: 'the still' } } }],
}

check('a launch is stored at stable paths in the public bucket, one file each', () => {
  same(PATHS.video, 'launches/0f3a8c2e-1b6d-4e1a-9c47-5d2b8e6f7a01-site.mp4', 'the video')
  same(PATHS.still, 'launches/0f3a8c2e-1b6d-4e1a-9c47-5d2b8e6f7a01-site.png', 'the still')
  same(PATHS.card, 'launches/0f3a8c2e-1b6d-4e1a-9c47-5d2b8e6f7a01-card.png', 'the card')
  same(launchPaths('../x/y').card, 'launches/xy-card.png', 'a key that tries to climb out')
})

check('the video goes where a reel plays and the still where none can', () => {
  const { queued, held } = plan({
    image: VIDEO,
    alt: 'the still',
    texts: NAMED,
    channels: CHANNELS,
    media: MEDIA,
    allow: ALLOW,
    now: NOW,
  })
  same(held.length, 0, 'held')
  const by = Object.fromEntries(queued.map(entry => [entry.service, entry]))
  same(by.facebook.assets[0].video.url, VIDEO, 'the Page')
  same(by.facebook.metadata.facebook.type, 'reel', 'the Page post type')
  same(by.instagram.assets[0].video.url, VIDEO, 'Instagram')
  same(by.instagram.metadata.instagram.type, 'reel', 'the Instagram post type')
  same(by.googlebusiness.assets[0].image.url, STILL, 'the Business Profile')
  ok(!by.googlebusiness.assets.some(asset => asset.video), 'a video reached the profile')
})

check('a channel already carrying its own file is settled, not posted to twice', () => {
  const existing = [
    {
      id: 'held',
      status: 'scheduled',
      dueAt: '2026-10-16T14:00:00.000Z',
      text: 'held',
      channelId: 'googlebusiness-channel',
      assets: [
        { type: 'image', source: `https://buffer.example.com/x/${PATHS.still.split('/')[1]}` },
      ],
    },
  ]
  const { queued, held } = plan({
    image: VIDEO,
    alt: 'the still',
    texts: NAMED,
    channels: CHANNELS,
    media: MEDIA,
    allow: ALLOW,
    existing,
    placed: ['facebook'],
    now: NOW,
  })
  same(queued.map(entry => entry.service).join(), 'instagram', 'channels still to take it')
  same(held.length, 2, 'channels settled')
})

check('a named post with its name not allowed is refused before anything is placed', async () => {
  const ours = launchTexts({
    named: true,
    who: 'We Fix It Plumbing',
    lines: LINES3,
    launchedAt: LAUNCHED,
  })
  const cause = await raised(() =>
    plan({ image: VIDEO, alt: 'x', texts: ours, channels: CHANNELS, media: MEDIA, now: NOW })
  )
  ok(cause && /breaks the voice/.test(cause.message), `got ${cause?.message}`)
})

// ---------------------------------------------------------------------------
// The recording and the video
// ---------------------------------------------------------------------------

check('the phone and the connection are the ones PageSpeed grades a phone on', () => {
  same(`${PHONE.width}x${PHONE.height}`, '390x844', 'the screen')
  same(SLOW_4G.latencyMs, 150 * 3.75, 'latency, as DevTools applies it')
  same(SLOW_4G.downloadKbps.toFixed(2), (1.6 * 1024 * 0.9).toFixed(2), 'down')
  same(SLOW_4G.uploadKbps, 750 * 0.9, 'up')
  same(cpuSlowdown('linux', 'arm64'), 2, 'on the Pi')
  same(cpuSlowdown('darwin', 'arm64'), 4, 'on a workstation')
})

const recorded = {
  painted: 3.2,
  load: [
    { at: 0, src: 'blank' },
    { at: 3.2, src: 'first-paint' },
    { at: 3.2, src: 'same-moment' },
    { at: 3.9, src: 'images' },
  ],
  scroll: Array.from({ length: 120 }, (_, index) => `scroll-${index}`),
}

check('the load plays as it happened, with a long blank lead-in cut to a second', () => {
  const { frames, loaded } = frameTimeline(recorded, { end: 7.8 })
  same(frames[0].src, 'blank', 'the first picture')
  same(frames[0].at, 0, 'when it shows')
  same(frames[1].src, 'same-moment', 'two pictures at one moment keep the later')
  same(Number(frames[1].at.toFixed(3)), 1, 'the first paint, a second in')
  same(Number((frames[2].at - frames[1].at).toFixed(3)), 0.7, 'the gap after it, as recorded')
  same(Number(loaded.toFixed(3)), 1.7, 'when the load is done')
  const scroll = frames.filter(frame => frame.src.startsWith('scroll'))
  same(scroll.length, 120, 'scroll pictures')
  same(Number(scroll[0].at.toFixed(3)), 2.9, 'the scroll starts after the hold')
  ok(scroll.at(-1).at <= 7.8 - 0.5 + 1e-9, `the scroll runs to ${scroll.at(-1).at}`)
  ok(
    frames.every((frame, index) => !index || frame.at >= frames[index - 1].at),
    'the pictures run out of order'
  )
})

check('a load too slow to leave room for the scroll plays without it', () => {
  const slow = { ...recorded, painted: 1, load: [...recorded.load, { at: 7, src: 'late' }] }
  const { frames } = frameTimeline(slow, { end: 7.8 })
  ok(!frames.some(frame => frame.src.startsWith('scroll')), 'a scroll was squeezed in')
  same(frames.at(-1).src, 'late', 'the last picture')
})

check('the video runs about fifteen seconds and its cover is already standing', () => {
  const clip = launchClip({
    key: 'fixture',
    name: NAME,
    domain: DOMAIN,
    lines: LINES3,
    frames: [{ at: 0, src: 'data:image/jpeg;base64,AAAA' }],
    counter: 'Oct 13, 2026',
    close: 'I build sites like this for *local* businesses.',
    path: CALL,
  })
  ok(clip.duration >= 14 && clip.duration <= 16, `${clip.duration} seconds`)
  ok(clip.poster > 0 && clip.poster < clip.duration, `a poster at ${clip.poster}`)
  const [first] = clip.scenes
  ok(first.from < 0, 'the first scene fades in after the first frame')
  ok(first.html.includes('data-frames="site"'), 'the first scene plays no recording')
  ok(clip.scenes.at(-1).hold, 'the last scene does not hold to the end')
  same(clip.scenes.at(-1).to, clip.duration, 'where the last scene ends')
  for (let index = 1; index < clip.scenes.length; index += 1)
    same(clip.scenes[index].from, clip.scenes[index - 1].to, `scene ${index} starts on time`)
  ok(clip.frames.site.length === 1, 'the recording is not carried as data')
})

check('a name is set as text in every layout, never as markup', () => {
  const name = 'Bell <img src=x onerror=alert(1)> & Sons'
  const clip = launchClip({
    key: 'k',
    name,
    domain: DOMAIN,
    lines: LINES3,
    frames: [],
    counter: '',
    close: 'x',
    path: CALL,
  })
  ok(!clip.scenes[0].html.includes('<img src=x'), 'the video')
  const still = launchSiteCard(
    launchStillItem({ name, domain: DOMAIN, lines: LINES3, launchedAt: LAUNCHED, shot: 'x' })
  )
  ok(!still.inner.includes('<img src=x'), 'the still')
})

// ---------------------------------------------------------------------------
// The schema, and the run read the way the Pi reads it
// ---------------------------------------------------------------------------

check('the table takes a launch row and the bucket a video', () => {
  const snapshot = JSON.parse(
    readFileSync(new URL('../db/db-constraints.json', import.meta.url), 'utf8')
  )
  const table = snapshot.columns?.social_generated_cards
  ok(table, 'the snapshot has no social_generated_cards')
  ok(table.kind.allows.includes('launch'), `the table takes ${table.kind.allows.join(', ')}`)
  ok(table.state.allows.includes('skipped'), 'the table cannot say a launch was passed over')
  const cli = readFileSync(new URL('./generated-cards.js', import.meta.url), 'utf8')
  ok(/mp4: \{ type: 'video\/mp4'/.test(cli), 'the run stores no MP4')
})

const CLI = fileURLToPath(new URL('./generated-cards.js', import.meta.url))

/** The launch run against a fixture, read by its exit code and its last line. */
function launchRun(fixture) {
  const dir = mkdtempSync(join(tmpdir(), 'launch-posts-check-'))
  try {
    const file = join(dir, 'fixture.json')
    writeFileSync(file, JSON.stringify({ now: NOW.toISOString(), recorded: [], ...fixture }))
    const run = spawnSync(process.execPath, [CLI, 'launch', '--fixture', file, '--out', dir], {
      encoding: 'utf8',
      timeout: 60_000,
    })
    const said = (run.stderr ?? '')
      .split('\n')
      .filter(line => line.startsWith('generated-cards: '))
      .pop()
    let answer = null
    try {
      answer = JSON.parse(run.stdout)
    } catch {
      answer = null
    }
    return { status: run.status, said: said?.slice('generated-cards: '.length) ?? '', answer }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

check('a run with no launch to post ends clean and says so', () => {
  const { status, said } = launchRun({ projects: [] })
  same(status, 0, 'the exit code')
  same(said, 'no client site launched in the last week is waiting for its post', 'the sentence')
})

check('a launch past its week is passed over quietly, once', () => {
  const { status, said, answer } = launchRun({
    projects: [project('old', '2026-10-01T15:00:00Z')],
  })
  same(status, 0, 'the exit code')
  ok(/past its week was passed over/.test(said), `the run said "${said}"`)
  same(answer?.passedOver?.[0]?.project, 'old', 'the launch passed over')
})

check('a yes with no site to film stops the run for a person, and draws nothing', () => {
  const id = '0f3a8c2e-1b6d-4e1a-9c47-5d2b8e6f7a01'
  const { status, said } = launchRun({
    projects: [project(id, LAUNCHED, { site_id: null })],
    onboarding: [{ project_id: id, answers: { contacts: { showcase: 'yes' } } }],
  })
  same(status, 1, 'the exit code')
  ok(/links it to no site/.test(said), `the run said "${said}"`)
})

await finish()
console.log(
  `launch posts hold: ${cases.length} checks over whom a launch names, what it says, when it posts and where it lands`
)
