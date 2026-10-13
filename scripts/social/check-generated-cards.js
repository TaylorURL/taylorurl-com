/**
 * Checks the cards drawn from live data: what each one says, who it names, and
 * where it lands.
 *
 * Both cards are made and queued on the Pi with nobody watching, and a card is
 * out of reach the moment its post publishes. So everything that decides one is
 * walked here against fixtures, where a mistake costs a pull request: which
 * review is carded and which is passed over and why, what a quote may and may
 * not carry, when the reviewer is described and when they are "a client", which
 * sites the proof card counts and what its averages say, when in the month it is
 * due, what every post's words are held to, and that a card goes on each
 * channel's next free slot once and never twice.
 *
 * Nothing here launches a browser or reaches a network. The drawing itself is
 * the library's sheet and guard, which `generated-cards.js` shares with
 * `render-media.js`; what is checked is everything handed to it.
 *
 *   npm run check:generated-cards
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CADENCE, HORIZON_DAYS, connect, freeSlots } from '../../lib/social/buffer.js'
import {
  BUCKET,
  CALL,
  HELD,
  SERVICES,
  carries,
  cardUrl,
  plan,
  queueCard,
  voiceFaults,
} from '../../lib/social/generated.js'
import {
  CATCH_UP_DAY,
  MIN_SITES,
  OURS,
  SPEED_CHECK,
  average,
  describeSite,
  dueOn,
  firstWeekday,
  proofAlt,
  proofCardItem,
  proofFrom,
  proofPath,
  proofTexts,
} from '../../lib/social/proof.js'
import {
  MIN_STARS,
  PLACE_CID,
  PLACE_ID,
  QUOTE_MAX,
  choose,
  cleaned,
  describe,
  isTeam,
  quoteOptions,
  readListing,
  reviewAlt,
  reviewCardItem,
  reviewPath,
  reviewTexts,
  splitSentences,
  textUnavailable,
} from '../../lib/social/reviews.js'
import { PORTFOLIO_PROJECTS } from '../../src/app/data/portfolio.js'
import { cases, check, finish, is, ok, raised, same } from '../harness/checks.js'
import { altFaults, faults } from './media-guard.js'
import { proofCard, reviewCard } from './media-templates/templates.js'
import { localReading } from './local-reading.js'

const passes = text => faults(text).length === 0
const TOWNS = ['Baytown', 'Liberty', 'Crosby', 'Mont Belvieu', 'Dayton']
const NOW = new Date('2026-10-13T13:00:00Z')

// A client's business name, read off the portfolio rather than written here, so
// the check holds whatever the portfolio says and names nobody itself.
const CLIENT = PORTFOLIO_PROJECTS.find(project => project.kind === 'client').name

// ---------------------------------------------------------------------------
// The listing
// ---------------------------------------------------------------------------

const listingOf =
  (body, { status = 200, json = true } = {}) =>
  async () => ({
    ok: status < 400,
    status,
    json: async () => {
      if (!json) throw new SyntaxError('not JSON')
      return body
    },
  })

const LISTING = {
  id: PLACE_ID,
  googleMapsUri: `https://maps.google.com/?cid=${PLACE_CID}&g_mp=fixture`,
  rating: 4.8,
  userRatingCount: 3,
  reviews: [
    {
      name: `places/${PLACE_ID}/reviews/Ci9fixture-one`,
      rating: 5,
      publishTime: '2026-09-30T15:00:00Z',
      text: { text: 'Translated words.', languageCode: 'en' },
      originalText: { text: 'The words as written.', languageCode: 'en' },
      authorAttribution: { displayName: 'Pat Example' },
    },
  ],
}

check('the listing is read for its reviews, in the shape the rest reads', async () => {
  const asked = []
  const listing = await readListing('fixture-key', {
    get: async (url, init) => {
      asked.push({ url, init })
      return listingOf(LISTING)()
    },
  })
  same(asked.length, 1, 'requests made')
  same(asked[0].url, `https://places.googleapis.com/v1/places/${PLACE_ID}`, 'the place asked for')
  ok(/\breviews\b/.test(asked[0].init.headers['X-Goog-FieldMask']), 'reviews are not asked for')
  same(listing.count, 3, 'the rating count')
  same(listing.reviews.length, 1, 'reviews read')
  const [review] = listing.reviews
  same(review.id, 'Ci9fixture-one', 'the review id')
  same(review.text, 'The words as written.', 'the original text, not the translation')
  same(review.stars, 5, 'the stars')
  same(review.author, 'Pat Example', 'the author, read so the card can leave it off')
})

check('a listing answering as another place is refused rather than carded', async () => {
  const cause = await raised(() =>
    readListing('fixture-key', {
      get: listingOf({ ...LISTING, googleMapsUri: 'https://maps.google.com/?cid=1' }),
    })
  )
  ok(cause && /not the listing the profile names/.test(cause.message), `got ${cause?.message}`)
})

check('a refused or unreadable answer is a failed read, not an empty listing', async () => {
  const refused = await raised(() =>
    readListing('fixture-key', {
      get: listingOf({ error: { message: 'quota' } }, { status: 429 }),
    })
  )
  ok(refused && /429/.test(refused.message), `a 429 read as ${refused?.message}`)
  const garbled = await raised(() =>
    readListing('fixture-key', { get: listingOf(null, { json: false }) })
  )
  ok(garbled && /no JSON/.test(garbled.message), `a non-JSON answer read as ${garbled?.message}`)
})

check('ratings with no review text behind them read as unavailable, not as a failed read', () => {
  same(textUnavailable({ count: 2, reviews: [] }), true, 'ratings and no reviews returned')
  same(textUnavailable({ count: 0, reviews: [] }), false, 'a listing nobody has rated')
  same(textUnavailable({ count: 3, reviews: [{ id: 'one' }] }), false, 'reviews returned')
})

const CLI = fileURLToPath(new URL('./generated-cards.js', import.meta.url))

/**
 * The review run against a fixture, read the way the runner on the Pi reads it:
 * by its exit code and the last `generated-cards:` line it prints.
 */
function reviewRun(listing) {
  const dir = mkdtempSync(join(tmpdir(), 'generated-cards-check-'))
  try {
    const file = join(dir, 'fixture.json')
    writeFileSync(file, JSON.stringify({ listing, team: ['Pat Sample'], recorded: [] }))
    const run = spawnSync(process.execPath, [CLI, 'review', '--fixture', file, '--out', dir], {
      encoding: 'utf8',
      timeout: 60_000,
    })
    const said = (run.stderr ?? '')
      .split('\n')
      .filter(line => line.startsWith('generated-cards: '))
      .pop()
    return { status: run.status, said: said?.slice('generated-cards: '.length) ?? '' }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

check('a listing whose reviews come back without words ends the run clean and says so', () => {
  const { status, said } = reviewRun({ ...LISTING, reviews: [] })
  same(status, 0, 'the exit code')
  ok(/^review text is unavailable from the Places API\b/.test(said), `the run said "${said}"`)
})

check('a listing answering as another place still stops the run for a person', () => {
  const { status, said } = reviewRun({
    ...LISTING,
    reviews: [],
    googleMapsUri: 'https://maps.google.com/?cid=1',
  })
  same(status, 1, 'the exit code')
  ok(/not the listing the profile names/.test(said), `the run said "${said}"`)
})

// ---------------------------------------------------------------------------
// Who works here
// ---------------------------------------------------------------------------

const TEAM = ['Pat Example', 'Sam Lee Sample Jones', 'Robin']
for (const [author, expected, why] of [
  ['Pat Example', true, 'the same name'],
  ['Sam Jones', true, 'a profile carrying a middle name and a second surname'],
  ['sam jones', true, 'a different case'],
  ['Sam', true, 'a review signed with a first name alone'],
  ['Robin Fixture', true, 'a one-word profile, matched on its word'],
  ['Pat Other', false, 'a shared first name and a different surname'],
  ['Casey Example', false, 'a shared surname and a different first name'],
  ['', false, 'no name at all'],
]) {
  is(`"${author}" read as the team (${why})`, isTeam(author, TEAM), expected)
}

// ---------------------------------------------------------------------------
// What a quote may carry
// ---------------------------------------------------------------------------

check('a closing sentence typed without a stop is kept as a sentence', () => {
  const split = splitSentences('Great work. Would hire again')
  same(split.length, 2, 'sentences')
  same(split[1], 'Would hire again', 'the closing fragment')
})

check('emoji come off and an em dash is set as the sheet sets one', () => {
  same(cleaned('Fast \u{1F680} site — great'), 'Fast site – great', 'the cleaned text')
})

check('first-person sentences are left out, and the quote never jumps a gap', () => {
  const options = quoteOptions(
    'Fast, clear and on time. I loved working with them. The site looks sharp on a phone.',
    { passes }
  )
  same(options[0], 'Fast, clear and on time.', 'the first run of usable sentences')
  ok(
    options.every(option => !option.includes('sharp')),
    'a sentence after the left-out one was stitched on'
  )
})

check('the quote is offered longest first, each a sentence shorter', () => {
  const options = quoteOptions(
    'The site went up in two weeks. Calls picked up the month after. Everything was explained plainly.',
    { passes }
  )
  same(options.length, 3, 'options')
  ok(options[0].length > options[1].length && options[1].length > options[2].length, 'order')
  same(options[2], 'The site went up in two weeks.', 'the shortest')
})

check('a review that starts in the first person is quoted from its first clean run', () => {
  const options = quoteOptions('My site is great. They built it fast and kept it simple.', {
    passes,
  })
  same(options[0], 'They built it fast and kept it simple.', 'the quote')
})

check('nothing of the reviewer, nobody else, no price and no address reaches a quote', () => {
  const said = [
    `They built our site for ${CLIENT} and it shows.`,
    'Paid $1,200 and worth every cent of the money.',
    'Look at the result on www.example.com today.',
    'Call them on 281-555-0100 any time at all.',
    'Jordan Roofer here, and the team was great.',
  ]
  for (const sentence of said) {
    same(
      quoteOptions(sentence, { passes, author: 'Jordan Roofer' }).length,
      0,
      `quotes offered from "${sentence}"`
    )
  }
})

check('every quote offered passes the sheet and fits the ceiling', () => {
  const long = Array.from(
    { length: 12 },
    (_, i) => `The team kept every promise number ${i + 1}.`
  ).join(' ')
  const options = quoteOptions(long, { passes })
  ok(options.length > 0, 'a long review gave no quote')
  for (const option of options) {
    ok(option.length <= QUOTE_MAX, `a quote of ${option.length} characters`)
    ok(passes(option), `a quote the sheet refuses: ${option}`)
  }
})

is('a review of too few words gives no quote', quoteOptions('Good people.', { passes }).length, 0)

// ---------------------------------------------------------------------------
// Who the reviewer is said to be
// ---------------------------------------------------------------------------

for (const [text, subject] of [
  [
    'We run a small family roofing company in Crosby and the site works.',
    'a roofing company in Crosby',
  ],
  ["I'm a realtor and the listing pages load fast.", 'a real estate business'],
  ['Our salon here in Mont Belvieu books more chairs now.', 'a hair salon in Mont Belvieu'],
  ['As a small business owner in Liberty, this was easy.', 'a client in Liberty'],
  ['I own a barbershop out of Dayton.', 'a barber shop in Dayton'],
  ['Best web designer in Baytown, hands down.', 'a client'],
  ["My brother's roofing company in Crosby uses them too.", 'a client'],
  ["My wife's salon in Liberty was their first job for us.", 'a client'],
  ['They are a great company in Baytown.', 'a client'],
  ['Great roofing advice from a team in Crosby.', 'a client'],
]) {
  is(
    `"${text}" describes its writer as ${subject}`,
    describe(text, { towns: TOWNS }).subject,
    subject
  )
}

// ---------------------------------------------------------------------------
// Which review is carded
// ---------------------------------------------------------------------------

const review = (id, stars, text, author, publishedAt, language = 'en') => ({
  id,
  name: `places/${PLACE_ID}/reviews/${id}`,
  stars,
  text,
  author,
  publishedAt,
  language,
})

const REVIEWS = [
  review(
    'newest',
    5,
    'They answered every question the same day.',
    'Lee Client',
    '2026-10-10T00:00:00Z'
  ),
  review('team', 5, 'Exceptional websites from this team.', 'Pat Example', '2026-08-01T00:00:00Z'),
  review('three', 3, 'It was fine and it works now.', 'Dana Rater', '2026-08-02T00:00:00Z'),
  review('blank', 5, '', 'Quiet Rater', '2026-08-03T00:00:00Z'),
  review('spanish', 5, 'Muy buen trabajo con el sitio.', 'Ana Rater', '2026-08-04T00:00:00Z', 'es'),
  review('mine', 4, 'I love my site and I tell everyone.', 'Kim Rater', '2026-08-05T00:00:00Z'),
  review(
    'oldest',
    4,
    'The new site has the phone ringing again.',
    'Max Client',
    '2026-08-06T00:00:00Z'
  ),
]

check('the oldest review that can be carded is the one carded, one a run', () => {
  const { card, skipped } = choose({
    reviews: REVIEWS,
    team: TEAM,
    recorded: new Map(),
    passes,
    towns: TOWNS,
  })
  same(card?.review.id, 'oldest', 'the review carded')
  const why = Object.fromEntries(skipped.map(entry => [entry.id, entry.reason]))
  same(why.team, 'team', 'a review by somebody on the team')
  same(why.three, 'rating', `a review under ${MIN_STARS} stars`)
  same(why.blank, 'no-words', 'a rating with no words')
  same(why.spanish, 'language', 'a review not written in English')
  same(why.mine, 'no-quotable-words', 'a review with nothing the sheet would print')
  ok(!('newest' in why), 'a cardable review waiting its turn was recorded as skipped')
})

check('a review already queued is never carded again, and one left half done goes first', () => {
  const recorded = new Map([
    ['oldest', { kind: 'review', key: 'oldest', state: 'queued' }],
    ['newest', { kind: 'review', key: 'newest', state: 'drawn' }],
  ])
  const { card, done } = choose({ reviews: REVIEWS, team: TEAM, recorded, passes, towns: TOWNS })
  same(done.includes('oldest'), true, 'the queued review read as done')
  same(card?.review.id, 'newest', 'the half-done review taken first')
  same(card?.resume, true, 'the half-done review marked to resume')
})

check('a description the sheet would refuse comes off, down to "a client"', () => {
  const refusing = text => passes(text) && !/Crosby/.test(text)
  const { card } = choose({
    reviews: [
      review(
        'roofer',
        5,
        'We run a roofing company in Crosby. The calls came back within a month of launch.',
        'Jo Client',
        '2026-10-01T00:00:00Z'
      ),
    ],
    team: TEAM,
    recorded: new Map(),
    passes: refusing,
    towns: TOWNS,
  })
  same(card?.subject, 'a roofing company', 'the subject once the town is refused')
  same(card?.quotes[0], 'The calls came back within a month of launch.', 'the quote around it')
})

// ---------------------------------------------------------------------------
// Every post's words
// ---------------------------------------------------------------------------

const SUBJECTS = [
  'a client',
  'a client in Liberty',
  'a barber shop',
  'an HVAC company in Mont Belvieu',
]
const PROOFS = [
  { date: '2026-11-02', count: 8, mobile: '93.8', desktop: '99.5' },
  { date: '2027-02-01', count: 12, mobile: '100', desktop: '100' },
  { date: '2026-12-01', count: 3, mobile: '71.3', desktop: '88' },
]
const written = [
  ...SUBJECTS.flatMap(subject =>
    [4, 5].map(stars => ({
      what: `review, ${stars} stars, ${subject}`,
      texts: reviewTexts({ stars, subject }),
    }))
  ),
  ...PROOFS.map(proof => ({ what: `proof, ${proof.date}`, texts: proofTexts(proof) })),
]

for (const { what, texts } of written) {
  for (const service of SERVICES) {
    const text = texts[service]
    check(`${what}: the ${service} post is held to the voice`, () => {
      ok(text, 'no post written')
      const found = [...voiceFaults(service, text), ...faults(text)]
      ok(!found.length, found.join('; '))
    })
  }
  is(
    `${what}: the Page post ends on its one next step`,
    texts.facebook.trim().split('\n').pop() === CALL || texts.facebook.trim().endsWith(SPEED_CHECK),
    true
  )
  is(
    `${what}: the Instagram post ends on the number`,
    texts.instagram.trim().split('\n').pop(),
    CALL
  )
}

for (const [service, text, fault] of [
  ['facebook', 'One. Two. Three. Four.\n\nCall or text (281) 862-8687', 'sentences'],
  ['facebook', 'We built it and I answered.\n\nCall or text (281) 862-8687', 'first person'],
  ['facebook', 'We built it \u{1F44D}.\n\nCall or text (281) 862-8687', 'emoji'],
  ['facebook', 'Which do you like best?\n\nCall or text (281) 862-8687', 'question'],
  ['facebook', 'Drop a comment below.\n\nCall or text (281) 862-8687', 'comment'],
  ['facebook', 'We built it.', 'next step'],
  [
    'facebook',
    'We built it.\n\nhttps://www.taylorurl.com/contact\nCall or text (281) 862-8687',
    'next steps',
  ],
  ['instagram', 'We built it.\n\nhttps://www.taylorurl.com/contact', 'address in a caption'],
  ['googlebusiness', 'We built it.\nCall or text (281) 862-8687', 'phone number'],
]) {
  check(`a ${service} post with ${fault} is refused`, () => {
    const found = voiceFaults(service, text)
    ok(
      found.some(entry => entry.includes(fault)),
      `refused for ${found.join('; ') || 'nothing'}`
    )
  })
}

// ---------------------------------------------------------------------------
// What the cards show
// ---------------------------------------------------------------------------

check("a reviewer's words are set as text, never as markup", () => {
  const spec = reviewCard(
    reviewCardItem({
      stars: 4,
      quote: 'Fast <b>work</b> and *no* fuss.',
      subject: 'a client',
      publishedAt: '2026-10-10T15:00:00Z',
    })
  )
  ok(
    spec.inner.includes('Fast &lt;b&gt;work&lt;/b&gt; and *no* fuss.'),
    'the quote was not escaped'
  )
  same((spec.inner.match(/class="star on"/g) ?? []).length, 4, 'stars drawn lit')
  same((spec.inner.match(/class="star"/g) ?? []).length, 1, 'stars drawn unlit')
  same(spec.eyebrow, 'Four Stars on Google', 'the eyebrow')
  ok(spec.inner.includes('October 2026'), 'the month the review was left, in Central')
})

check('every alt is a clean sentence the sheet would print', () => {
  const alts = [
    reviewAlt({ stars: 5, quote: 'Would hire again', subject: 'a client in Liberty' }),
    reviewAlt({ stars: 4, quote: 'Fast and clear!', subject: 'a barber shop' }),
    proofAlt({ ...PROOFS[0], sites: [{ label: 'Printing · Pasadena', mobile: 88, desktop: 100 }] }),
  ]
  for (const alt of alts) {
    const found = [...faults(alt), ...altFaults(alt)]
    ok(!found.length, `${alt}\n${found.join('; ')}`)
  }
})

check('the proof card shows a row for every site its figures are taken over', () => {
  const proof = {
    ...PROOFS[0],
    sites: [
      { label: 'Printing · Pasadena', mobile: 88, desktop: 100 },
      { label: 'Fitness · Houston', mobile: 98, desktop: 100 },
    ],
  }
  const spec = proofCard(proofCardItem({ ...proof, count: proof.sites.length }))
  same((spec.inner.match(/class="row"/g) ?? []).length, 2, 'rows')
  ok(spec.inner.includes('93.8') && spec.inner.includes('99.5'), 'the averages')
  same(spec.counter, 'Nov 2, 2026', 'the date the readings were taken')
})

check('cards are stored at stable paths in the public bucket', () => {
  same(reviewPath({ id: 'Ci9/../x y' }), 'reviews/Ci9xy.png', 'a review path')
  same(proofPath('2026-11'), 'proof/2026-11.png', 'a proof path')
  same(
    cardUrl('proof/2026-11.png'),
    `https://gujgtjqqurildqurpffh.supabase.co/storage/v1/object/public/${BUCKET}/proof/2026-11.png`,
    'the public URL'
  )
})

// ---------------------------------------------------------------------------
// The proof card's figures
// ---------------------------------------------------------------------------

const PROJECTS = [
  {
    kind: 'client',
    displayUrl: 'print.example.com',
    trades: ['printing'],
    tagline: 'Custom print studio · Order portal',
    location: 'Pasadena, Texas',
  },
  {
    kind: 'client',
    displayUrl: 'trees.example.com',
    trades: ['tree-service'],
    tagline: 'Tree service · Service-area site',
    town: 'Pasadena',
  },
  {
    kind: 'client',
    displayUrl: 'harbor.example.com',
    trades: ['marine-services'],
    tagline: 'Marine transport · Brand site',
  },
  {
    kind: 'client',
    displayUrl: 'gym.example.com',
    trades: ['fitness'],
    tagline: 'Personal brand · Booking funnel',
    town: 'Houston',
  },
  { kind: 'client', displayUrl: 'exempt.example.com', trades: ['plumbing'], town: 'Baytown' },
  { kind: 'client', displayUrl: 'yesterday.example.com', trades: ['roofing'], town: 'Crosby' },
  { kind: 'client', displayUrl: 'half.example.com', trades: ['towing'], town: 'Dayton' },
  { kind: 'product', displayUrl: 'product.example.com', trades: ['auto-repair'] },
]
const TRADE_NAMES = new Map([
  ['printing', 'Printing'],
  ['marine-services', 'Marine Services'],
  ['fitness', 'Fitness'],
  ['hvac', 'HVAC'],
])
const CLIENT_SITES = [
  ...['print', 'trees', 'harbor', 'gym', 'yesterday', 'half', 'unnamed', 'product'].map(name => ({
    domain: `${name}.example.com`,
    exempt: false,
  })),
  { domain: 'exempt.example.com', exempt: true },
  { domain: OURS[0], exempt: false },
]
const TODAY = '2026-11-02'
const AT = '2026-11-02T14:00:00Z'
const READINGS = [
  ...[
    ['print', 88, 100],
    ['trees', 96, 100],
    ['harbor', 92, 99],
    ['gym', 98, 99],
    ['exempt', 50, 60],
    ['unnamed', 70, 80],
    ['product', 100, 100],
    [OURS[0], 30, 63],
  ].flatMap(([name, mobile, desktop]) => {
    const url = name.includes('.') ? `https://www.${name}` : `https://www.${name}.example.com`
    return [
      { url, strategy: 'mobile', performance: mobile, fetched_at: AT },
      { url, strategy: 'desktop', performance: desktop, fetched_at: AT },
    ]
  }),
  {
    url: 'https://yesterday.example.com',
    strategy: 'mobile',
    performance: 99,
    fetched_at: '2026-11-01T14:00:00Z',
  },
  {
    url: 'https://yesterday.example.com',
    strategy: 'desktop',
    performance: 99,
    fetched_at: '2026-11-01T14:00:00Z',
  },
  { url: 'https://half.example.com', strategy: 'mobile', performance: 91, fetched_at: AT },
]

check('the proof card counts the client sites measured that day, and only those', () => {
  const proof = proofFrom({
    clientSites: CLIENT_SITES,
    readings: READINGS,
    projects: PROJECTS,
    tradeNames: TRADE_NAMES,
    date: TODAY,
  })
  same(proof.count, 4, 'sites counted')
  same(
    proof.sites.map(site => site.label).join(' | '),
    'Fitness · Houston | Tree service · Pasadena | Marine services | Printing · Pasadena',
    'the rows, best phone score first'
  )
  same(proof.mobile, '93.5', 'the phone average, over the rows shown')
  same(proof.desktop, '99.5', 'the desktop average, to one decimal rather than rounded up')
  const left = Object.fromEntries(proof.left.map(entry => [entry.host.split('.')[0], entry.why]))
  ok(/no reading taken/.test(left.yesterday), 'a reading from the day before was counted')
  ok(/one strategy/.test(left.half), 'a site with one strategy was counted')
  ok(
    /neither its trade nor its town/.test(left.unnamed),
    'a site the portfolio does not describe was counted'
  )
  ok(/neither/.test(left.product), 'a product was counted as a client site')
  ok(
    !('exempt' in left) && !proof.sites.some(site => site.label.includes('Baytown')),
    'an exempt site was counted'
  )
  ok(
    !proof.left.some(entry => entry.host === OURS[0]),
    "the studio's own site was considered at all"
  )
})

is('an average of 99 and 100 is written 99.5, never 100', average([99, 100]), '99.5')
is('an average that is whole is written whole', average([90, 92]), '91')
is(
  'a site described by its trade label alone keeps an acronym',
  describeSite({ kind: 'client', trades: ['hvac'] }, TRADE_NAMES)?.label,
  'HVAC'
)
is(`fewer than ${MIN_SITES} sites is not a portfolio`, MIN_SITES >= 3, true)

// ---------------------------------------------------------------------------
// When the proof card is due
// ---------------------------------------------------------------------------

for (const [month, first] of [
  ['2026-11', '2026-11-02'],
  ['2026-08', '2026-08-03'],
  ['2027-01', '2027-01-01'],
  ['2026-12', '2026-12-01'],
]) {
  is(`the first weekday of ${month}`, firstWeekday(`${month}-15`), first)
}

for (const [at, due, why] of [
  ['2026-11-02T20:00:00Z', true, 'the first weekday, in the afternoon'],
  ['2026-11-02T05:30:00Z', false, 'a Sunday evening in Central that is Monday in UTC'],
  ['2026-11-01T20:00:00Z', false, 'a Sunday'],
  ['2026-11-03T20:00:00Z', true, 'the day after, catching up a missed card'],
  ['2026-11-07T20:00:00Z', false, 'a Saturday inside the first week'],
  ['2026-11-09T20:00:00Z', false, `past day ${CATCH_UP_DAY}`],
  ['2026-10-13T20:00:00Z', false, 'the middle of the month'],
]) {
  is(`proof due at ${at} (${why})`, dueOn(new Date(at)).due, due)
}

// ---------------------------------------------------------------------------
// Where a card lands
// ---------------------------------------------------------------------------

const channel = (service, extra = {}) => ({
  id: `${service}-channel`,
  name: service,
  service,
  cadence: CADENCE[service],
  isDisconnected: false,
  isLocked: false,
  isQueuePaused: false,
  ...extra,
})
const CHANNELS = SERVICES.map(service => channel(service))
const IMAGE = cardUrl('reviews/fixture.png')
const TEXTS = reviewTexts({ stars: 5, subject: 'a client' })
const ALT = reviewAlt({ stars: 5, quote: 'Fast and clear.', subject: 'a client' })
const scheduled = (service, dueAt, assets = []) => ({
  id: `${service}-${dueAt}`,
  status: 'scheduled',
  dueAt,
  text: 'held',
  channelId: `${service}-channel`,
  assets,
})

check('each channel takes the card on the next slot its own cadence leaves free', () => {
  const existing = [scheduled('facebook', freeSlots(CADENCE.facebook, [], 1, NOW)[0])]
  const { queued, held } = plan({
    image: IMAGE,
    alt: ALT,
    texts: TEXTS,
    channels: CHANNELS,
    existing,
    now: NOW,
  })
  same(held.length, 0, 'channels held')
  for (const entry of queued) {
    const want = freeSlots(
      CADENCE[entry.service],
      existing.filter(post => post.channelId === `${entry.service}-channel`),
      1,
      NOW
    )[0]
    same(entry.dueAt, want, `${entry.service} slot`)
    const reading = localReading(entry.dueAt)
    ok(
      !CADENCE[entry.service].weekdays ||
        CADENCE[entry.service].weekdays.includes(
          ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(reading.weekday)
        ),
      `${entry.service} on a ${reading.weekday}`
    )
    same(entry.assets[0].image.url, IMAGE, `${entry.service} image`)
    same(entry.assets[0].image.metadata.altText, ALT, `${entry.service} alt`)
  }
  ok(
    queued.find(entry => entry.service === 'facebook').dueAt > existing[0].dueAt,
    'the Page doubled up on a held day'
  )
})

check('a channel already carrying the card is settled, not posted to twice', () => {
  const existing = [
    scheduled('instagram', '2026-10-14T14:00:00.000Z', [
      { type: 'image', source: `https://buffer.example.com/x/fixture.png` },
    ]),
  ]
  const { queued, held } = plan({
    image: IMAGE,
    alt: ALT,
    texts: TEXTS,
    channels: CHANNELS,
    existing,
    placed: ['facebook'],
    now: NOW,
  })
  same(queued.map(entry => entry.service).join(), 'googlebusiness', 'channels still to take it')
  same(held.filter(entry => entry.code === HELD.alreadyQueued).length, 2, 'channels settled')
  ok(carries(existing[0], IMAGE), 'a post carrying the file under another host was not recognised')
})

check('a channel that cannot take the card is named with the reason', () => {
  const full = Array.from({ length: HORIZON_DAYS + 2 }, (_, day) =>
    scheduled('googlebusiness', new Date(NOW.getTime() + day * 86_400_000).toISOString())
  ).map(post => ({
    ...post,
    dueAt: freeSlots(CADENCE.googlebusiness, [], 1, new Date(post.dueAt))[0],
  }))
  const { held } = plan({
    image: IMAGE,
    alt: ALT,
    texts: TEXTS,
    channels: [channel('facebook', { isDisconnected: true }), channel('googlebusiness')],
    existing: full,
    now: NOW,
  })
  const code = Object.fromEntries(held.map(entry => [entry.service, entry.code]))
  same(code.facebook, HELD.disconnected, 'a disconnected Page')
  same(code.instagram, HELD.noChannel, 'no Instagram channel')
  same(code.googlebusiness, HELD.noSlot, 'a profile with no free slot')
})

check('a post that breaks the voice stops the card before anything is placed', async () => {
  const cause = await raised(() =>
    plan({
      image: IMAGE,
      alt: ALT,
      texts: { ...TEXTS, instagram: 'I made this.' },
      channels: CHANNELS,
      now: NOW,
    })
  )
  ok(cause && /instagram post breaks the voice/.test(cause.message), `got ${cause?.message}`)
})

/** A Buffer that answers from fixtures and remembers every mutation it is asked for. */
function fakeBuffer(posts = []) {
  const mutations = []
  const run = connect('fixture', {
    get: async (_, init) => {
      const { query, variables } = JSON.parse(init.body)
      let data
      if (query.includes('organizations')) data = { account: { organizations: [{ id: 'org' }] } }
      else if (query.includes('channels('))
        // Buffer answers a channel without a cadence; `wiring` puts that on.
        data = {
          channels: CHANNELS.map(entry => ({
            id: entry.id,
            name: entry.name,
            service: entry.service,
            isDisconnected: false,
            isLocked: false,
            isQueuePaused: false,
          })),
        }
      else if (query.includes('posts(')) data = { posts: { edges: posts.map(node => ({ node })) } }
      else {
        mutations.push(variables.input)
        data = {
          createPost: {
            __typename: 'PostActionSuccess',
            post: {
              id: `new-${mutations.length}`,
              status: 'scheduled',
              dueAt: variables.input.dueAt,
            },
          },
        }
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({ data }) }
    },
  })
  return { run, mutations }
}

check('a dry run reads the queue and writes nothing', async () => {
  const { run, mutations } = fakeBuffer()
  const answer = await queueCard(run, {
    image: IMAGE,
    alt: ALT,
    texts: TEXTS,
    now: NOW,
    dryRun: true,
  })
  same(mutations.length, 0, 'mutations sent')
  same(answer.queued.length, SERVICES.length, 'posts planned')
  same(answer.settled, true, 'settled')
})

check('every post placed is recorded before the next is asked for', async () => {
  const { run, mutations } = fakeBuffer()
  const recorded = []
  const answer = await queueCard(run, {
    image: IMAGE,
    alt: ALT,
    texts: TEXTS,
    now: NOW,
    onPlaced: async entry => {
      same(mutations.length, recorded.length + 1, 'posts placed when one was recorded')
      recorded.push(entry.service)
    },
  })
  same(recorded.join(), SERVICES.join(), 'channels recorded, in order')
  same(answer.settled, true, 'settled')
  for (const input of mutations) {
    same(input.mode, 'customScheduled', 'placed on a day rather than as a draft')
    same(input.saveToDraft, false, 'saved as a draft')
  }
})

check('a run resumed after two channels took the card places the third alone', async () => {
  const { run, mutations } = fakeBuffer()
  const answer = await queueCard(run, {
    image: IMAGE,
    alt: ALT,
    texts: TEXTS,
    now: NOW,
    placed: ['facebook', 'instagram'],
  })
  same(mutations.length, 1, 'posts placed')
  same(mutations[0].channelId, 'googlebusiness-channel', 'the channel placed on')
  same(answer.settled, true, 'settled')
})

await finish()
console.log(
  `generated cards hold: ${cases.length} checks over the review and proof cards, their words, their figures and where they land`
)
