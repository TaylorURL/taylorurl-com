/**
 * Proves the Call List rings the right businesses, in the right order, and
 * never the one it must not.
 *
 * Five things are held here.
 *
 * Who may be rung at all. A business that asked for no further contact asked
 * not to hear from the studio, not merely not to be emailed, and the call list
 * reads the same rows through a different door than the sender, so nothing the
 * sender does protects it. The same goes for a row skipped by hand, a closed
 * business, and a listing with no number. A new company is rung whatever its
 * site, since it is weeks old and the founder answers.
 *
 * The order. Three scores, each 0 to 100, multiplied: will the owner pick up,
 * do they need a site, can they pay - with a company registered in the last 90
 * days worth half as much again. The formulas are in `callScore.js`, and the
 * cases below work them through by hand, two of them on real rows read off
 * the live table on 2026-11-03 with the trade table as it was loaded that day.
 *
 * What the list offers. The review ranking that came before the scores put
 * the wrong businesses first: of the first 31 calls placed off it, 12 were Bad
 * Lead, 10 of them Google listings with no reviews at all, and the wrong
 * numbers were a park on the county's 311 line and a mall's directory. The
 * rules in `callList.js` take those out, along with chains, shared numbers and
 * anything already called, and every case here is one of those failures.
 *
 * One list. The map sweep's businesses and every new company with a number are
 * offered together, call backs first, and a business whose last call reached a
 * front desk waits at the foot until the time the owner is in.
 *
 * What a call records. Seven results; Call Back and Front Desk carry a time;
 * Front Desk writes the owner's name and number on the business; the endpoint
 * still refuses a call against a business the list would not offer; and the
 * day's count comes back with every save. The endpoint is driven against an
 * in-memory database rather than read.
 *
 *   npm run check:call-list
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CALLBACK_LENGTHS,
  CALL_OUTCOMES,
  DAILY_CALL_GOAL,
  NEW_BUSINESS_SOURCE,
  OFFERED_OUTCOMES,
  OUTCOME_IDS,
  callBody,
  callMakesLead,
  dayLine,
  dayShare,
  dialHref,
  interestIn,
  isCallable,
  outcomeAsksOwner,
  outcomeEnds,
  outcomeTakesCallback,
  pullBand,
  pullOf,
  reviewsOf,
  scoreWords,
  uncallableReason,
} from '../../../lib/outreach/prospects/calls.js'
import {
  brandOf,
  droppedFor,
  indexOf,
  kept,
  phoneKey,
  reasonsFor,
  tradeMedians,
} from '../../../lib/outreach/prospects/callList.js'
import {
  BUDGET_FLOOR,
  FRESH_BOOST,
  MEASURED_AFTER,
  SITE_POINTS,
  budgetScore,
  daysSince,
  factsOf,
  needScore,
  ownerScore,
  scoreOf,
  siteOf,
  storefrontOf,
  tradeCalls,
} from '../../../lib/outreach/prospects/callScore.js'
import {
  CALL_FIRST_REASON,
  MIRROR_SOURCE,
  PHONE_ONLY_REASON,
  callFirstRow,
  contactedRow,
  phoneOnlyRow,
  phoneRow,
} from '../../../lib/new-business/mirror.js'
import { list, record, todayFrom, tomorrowFrom } from '../../../api/calls-admin.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = path => readFileSync(join(ROOT, path), 'utf8')

/** Noon in Baytown on a Monday, after the clocks went back. */
const NOW = new Date('2026-11-02T18:00:00Z')

/** Noon the day after, the day the two real rows below were read. */
const READ_ON = new Date('2026-11-03T18:00:00Z')

/** Two numbers the same to the places a person reads. */
const near = (got, want, what, places = 2) =>
  ok(Math.abs(got - want) < 10 ** -places, `${what}: expected about ${want}, got ${got}`)

/** A row the way the table carries one, callable unless the case says otherwise. */
const row = over => ({
  id: 'p1',
  name: 'Channelview Barbers',
  phone: '(281) 862-9968',
  address: '134 Dell Dale St, Channelview, TX 77530, USA',
  website: null,
  site_kind: 'none',
  stage: 'unreachable',
  source: 'places',
  trade: 'barber shop',
  town: 'Channelview',
  rating: 4.6,
  rating_count: 40,
  business_status: 'OPERATIONAL',
  calls: [],
  ...over,
})

/**
 * `call_trade_metrics` as loaded on 2026-11-03: the trade, its share of firms
 * with no employees, and its average yearly sales per one-person business.
 */
const TRADE_TABLE = [
  ['barber shop', 0.9766, 27011],
  ['fencing contractor', 0.948, 64509],
  ['painting contractor', 0.9423, 61985],
  ['flooring contractor', 0.9423, 61985],
  ['hair salon', 0.9412, 27437],
  ['landscaping', 0.9323, 32944],
  ['tree service', 0.9323, 32944],
  ['welding', 0.9182, 57851],
  ['pool service', 0.9074, 37892],
  ['real estate agency', 0.9, 65948],
  ['youth sports', 0.8991, 18576],
  ['concrete contractor', 0.89, 78780],
  ['roofing contractor', 0.89, 78780],
  ['storage', 0.8765, 169562],
  ['industrial contractor', 0.8439, 130101],
  ['electrician', 0.8306, 53330],
  ['auto repair', 0.8061, 59183],
  ['plumber', 0.7973, 74037],
  ['HVAC contractor', 0.7973, 74037],
  ['accountant', 0.7971, 34981],
  ['marine services', 0.796, 78714],
  ['towing service', 0.796, 78714],
  ['insurance agency', 0.745, 58731],
  ['printing', 0.7213, 45157],
  ['go kart track', 0.6811, 50269],
  ['fitness', 0.6811, 50269],
  ['title company', 0.6653, 90868],
  ['law firm', 0.6653, 90868],
  ['pest control', 0.604, 44514],
  ['veterinarian', 0.5294, 43427],
  ['chiropractor', 0.5219, 72781],
  ['machine shop', 0.4659, 87872],
  ['dentist', 0.3922, 73728],
  ['restaurant', 0.2756, 57722],
].map(([trade, solo, sales]) => ({ trade, solo_share: solo, avg_sales: sales }))

/** A run of listings in one trade, `own` of them with a site of their own. */
const listed = (trade, count, own) =>
  Array.from({ length: count }, (_, at) => ({ trade, site_kind: at < own ? 'own' : 'none' }))

/**
 * Every listing on the table on 2026-11-03, as the share of sites is read off
 * it: 16,556 listings, 9,621 with a site of their own. The trades the cases
 * name are their real counts; the rest are one bucket with the remainder.
 */
const LISTINGS = [
  ...listed('roofing contractor', 545, 422),
  ...listed('barber shop', 543, 178),
  ...listed('restaurant', 521, 381),
  ...listed('everything else', 16556 - 545 - 543 - 521, 9621 - 422 - 178 - 381),
]

const FACTS = factsOf({ metrics: TRADE_TABLE, listings: LISTINGS, calls: [] })

// ── Who is on the list ──────────────────────────────────────────────────

check('a business with no site and a number is on the list', () => {
  same(uncallableReason(row()), null, 'a plain callable row')
  ok(isCallable(row({ site_kind: 'social', website: 'https://www.facebook.com/x' })), 'a page')
})

check('a business that asked for no further contact is never rung', () => {
  same(
    uncallableReason(row({ stage: 'unsubscribed' })),
    'the business asked for no further contact',
    'why an unsubscribed business is off the list'
  )
})

check('a skipped business and a business in conversation stay off', () => {
  ok(!isCallable(row({ stage: 'skipped' })), 'a skipped business reached the list')
  ok(!isCallable(row({ stage: 'replied' })), 'a business that replied reached the list')
})

check('a business with a site of its own belongs to the sender', () => {
  ok(!isCallable(row({ site_kind: 'own', website: 'https://shop.example' })), 'it reached the list')
})

check('a new company is rung whatever its site, and never once it asked to stop', () => {
  same(NEW_BUSINESS_SOURCE, MIRROR_SOURCE, 'the two spellings of the source')
  const company = row({ source: 'new-business', site_kind: 'own', website: 'https://co.example' })
  ok(isCallable(company), 'a new company with a site of its own')
  ok(isCallable({ ...company, stage: 'contacted', email: 'hi@co.example' }), 'written to already')
  ok(isCallable({ ...company, stage: 'bounced' }), 'its letter bounced')
  ok(!isCallable({ ...company, stage: 'unsubscribed' }), 'it asked to stop')
  ok(!isCallable({ ...company, stage: 'replied' }), 'it replied')
})

check('a listing with no number cannot be rung', () => {
  for (const phone of [null, '', '   ']) {
    ok(!isCallable(row({ phone })), `a listing with ${JSON.stringify(phone)} for a phone`)
  }
})

check('a closed business is not rung, either way it is closed', () => {
  for (const status of ['CLOSED_PERMANENTLY', 'CLOSED_TEMPORARILY']) {
    ok(!isCallable(row({ business_status: status })), `a ${status} business reached the list`)
  }
  ok(isCallable(row({ business_status: null })), 'an unread status was read as a closure')
})

check('a number formatted for a person is flattened for a dialer', () => {
  same(dialHref('(281) 862-9968'), 'tel:2818629968', 'a formatted number')
  same(dialHref('+1 281-862-9968'), 'tel:+12818629968', 'a number carrying its country')
  same(dialHref(''), null, 'no number at all')
})

// ── What the trade says about reviews ───────────────────────────────────

check('a count is read against its own trade', () => {
  ok(pullOf(row({ rating_count: 200 }), 45) > pullOf(row({ rating_count: 400 }), 380), 'raw count')
  same(pullBand(row({ rating_count: 2 }), 38), 'quiet', 'two reviews where the middle is 38')
  same(pullBand(row({ rating_count: 40 }), 4), 'busy', 'forty where the middle is four')
  same(pullBand(row(), null), 'unread', 'a trade with no middle')
})

check('a listing Google answered with no reviews reads as none, an unread one as unread', () => {
  same(reviewsOf(row({ rating_count: null })), 0, 'answered, no reviews')
  same(reviewsOf(row({ rating_count: null, business_status: null })), null, 'never asked')
})

check('a trade has a middle review count once eight of its listings have one', () => {
  const eight = Array.from({ length: 8 }, (_, at) => row({ rating_count: at + 1 }))
  same(tradeMedians(eight).get('barber shop'), 4.5, 'the middle of 1 to 8')
  same(tradeMedians(eight.slice(1)).has('barber shop'), false, 'seven is too few')
})

// ── The scores ──────────────────────────────────────────────────────────

check('the trade table is read as it was loaded', () => {
  near(FACTS.trades.solo, 0.8017, 'the median share of one-person firms', 4)
  same(FACTS.trades.sales, 60584, 'the median sales')
  same(FACTS.trades.low, 18576, 'the lowest sales, youth sports')
  same(FACTS.trades.high, 169562, 'the highest sales, storage')
  near(FACTS.sites.overall, 9621 / 16556, 'the share of sites across the whole table', 6)
  near(FACTS.sites.byTrade.get('restaurant'), 0.7313, 'restaurants with a site', 4)
  near(FACTS.sites.byTrade.get('barber shop'), 0.3278, 'barber shops with a site', 4)
})

check('a street number is a storefront, and a hidden street or a PO box is not', () => {
  same(storefrontOf('314 W Texas Ave, Baytown, TX 77520, USA'), true, 'a street number')
  same(storefrontOf('Texas City, TX 77590, USA'), false, 'a town and a zip')
  same(storefrontOf('Gardenia Trail, Pasadena, TX 77505, USA'), false, 'a street with no number')
  same(storefrontOf('PO BOX 360159, DALLAS, TX, 75336'), false, 'a PO box and a bare zip')
  same(storefrontOf('Farm to Market 1960 Bypass Rd E Suite 222, Humble'), true, 'a suite')
  same(storefrontOf(null), null, 'no address to read')
})

check('what a business has for a site', () => {
  same(siteOf(row()), 'none', 'nothing')
  same(siteOf(row({ site_kind: 'social', website: 'https://www.facebook.com/x' })), 'social', 'fb')
  same(siteOf(row({ site_kind: 'social', website: 'https://kats.square.site/' })), 'booking', 'sq')
  same(
    siteOf(row({ site_kind: 'social', website: 'https://www.bbb.org/us/tx/x' })),
    'portal',
    'bbb'
  )
  // The mirror files a company it can only ring as having no site, and it has
  // the site the pipeline found.
  const company = row({ source: 'new-business', website: 'https://rocksolidit.example/' })
  same(siteOf(company), 'own', 'a new company with its own site, filed as none')
  same(siteOf({ ...company, website: null }), 'none', 'a new company with no site')
})

// The two worked rows are real listings read off the table on 2026-11-03,
// carried here with everything that scores them and nothing that names them:
// the repository is public, so the name, the number and the site are stand-ins.

check('worked: a roofer in Texas City with no site and no street on its listing', () => {
  // Roofing contractor, no website, the address "Texas City, TX 77590, USA",
  // 4 reviews.
  const roofer = row({
    id: 'roofer',
    name: 'Gulf Coast Roofing',
    phone: '(409) 555-0141',
    address: 'Texas City, TX 77590, USA',
    town: 'Texas City',
    trade: 'roofing contractor',
    rating_count: 4,
  })
  // Owner: 89 of roofers' firms have no employees; no street number closes
  // half the gap to 100.
  near(ownerScore(roofer, FACTS, READ_ON), 89 + (100 - 89) * 0.5, 'owner, 94.5')
  // Need: no site is 100 points, and 422 of 545 roofers have a site.
  near(needScore(roofer, FACTS), 100 * (0.5 + 422 / 545 / 2), 'need, 88.72')
  // Budget: $78,780 a year, on the log scale between $18,576 and $169,562.
  const spread = (Math.log(78780) - Math.log(18576)) / (Math.log(169562) - Math.log(18576))
  near(budgetScore(roofer, FACTS), BUDGET_FLOOR + 80 * spread, 'budget, 72.27')
  const score = scoreOf(roofer, FACTS, READ_ON)
  same(scoreWords(score), 'Owner 95 · Need 89 · Budget 72', 'in words')
  same(score.total, 60.6, 'the total, 94.5 × 88.72 × 72.27 ÷ 10,000')
  same(score.fresh, false, 'not a new company')
  same(
    reasonsFor({ ...roofer, score }).join(' · '),
    'No website · 77% of its trade have a website · No storefront address',
    'why it is there'
  )
})

check('worked: a San Antonio company registered with the state on Oct 15', () => {
  // A new company the pipeline found a site for with no address on it,
  // mirrored phone-only, no trade, a street address on its filing.
  const company = row({
    id: 'company',
    name: 'Rock Solid IT',
    phone: '(210) 555-0160',
    address: '100 ARGYLE PASS, SAN ANTONIO, TX, 78247',
    town: 'San Antonio',
    trade: null,
    website: 'https://rocksolidit.example/',
    site_kind: 'none',
    source: 'new-business',
    skip_reason: PHONE_ONLY_REASON,
    rating: null,
    rating_count: null,
    business_status: null,
    formed_on: '2026-10-15',
  })
  same(daysSince(company.formed_on, READ_ON), 19, 'nineteen days old')
  // Owner: no trade, so the table's median, 80.17; registered this year
  // closes half the gap.
  near(ownerScore(company, FACTS, READ_ON), 80.17 + (100 - 80.17) * 0.5, 'owner, 90.09')
  // Need: a company registered this year with a site has the site it started
  // with, which is 70 points rather than an established site's 25, and with no
  // trade the share is the whole table's, 58%.
  near(needScore(company, FACTS, READ_ON), 70 * (0.5 + 9621 / 16556 / 2), 'need, 55.34')
  near(
    needScore({ ...company, formed_on: '2024-01-10' }, FACTS, READ_ON),
    25 * (0.5 + 9621 / 16556 / 2),
    'an older company’s site, 19.76'
  )
  // Budget: no trade, so the median sales, $60,584.
  const spread = (Math.log(60584) - Math.log(18576)) / (Math.log(169562) - Math.log(18576))
  near(budgetScore(company, FACTS), BUDGET_FLOOR + 80 * spread, 'budget, 62.77')
  const score = scoreOf({ ...company }, FACTS, READ_ON)
  same(scoreWords(score), 'Owner 90 · Need 55 · Budget 63', 'in words')
  same(score.fresh, true, 'registered in the last ninety days')
  same(score.total, 46.9, 'the total, 90.09 × 55.34 × 62.77 ÷ 10,000 × 1.5')
  same(
    reasonsFor({ ...company, new_business: true, score }).join(' · '),
    'New business, registered Oct 15, 2026 · No email address on its site',
    'why it is there'
  )
})

check('more of a trade with sites is more need, and the kind of site sets the rest', () => {
  const restaurant = needScore(row({ trade: 'restaurant' }), FACTS)
  const barber = needScore(row({ trade: 'barber shop' }), FACTS)
  ok(restaurant > barber, `a restaurant ${restaurant} needs less than a barber ${barber}`)
  near(barber, 100 * (0.5 + 178 / 543 / 2), 'a barber with nothing')
  const page = row({ site_kind: 'social', website: 'https://www.facebook.com/x' })
  near(needScore(page, FACTS), SITE_POINTS.social * (0.5 + 178 / 543 / 2), 'a barber with fb')
  ok(SITE_POINTS.none > SITE_POINTS.social, 'nothing outranks a page')
  ok(SITE_POINTS.social > SITE_POINTS.booking, 'a page outranks a booking page')
  ok(SITE_POINTS.booking > SITE_POINTS.own, 'a booking page outranks a site of its own')
})

check('a direct number for the owner is a certain answer, the main line is not', () => {
  same(ownerScore(row({ owner_phone: '(281) 555-0199' }), FACTS, READ_ON), 100, 'own number')
  same(ownerScore(row({ owner_phone: '2815550199' }), FACTS, READ_ON), 100, 'as digits')
  near(
    ownerScore(row({ owner_phone: '(281) 862-9968' }), FACTS, READ_ON),
    97.66,
    'the listing’s own line written into the owner’s'
  )
  near(ownerScore(row({ owner_phone: '555-0199' }), FACTS, READ_ON), 97.66, 'not a whole number')
})

check('a trade not on the table takes the middle on Owner and Budget', () => {
  const church = row({ trade: 'Church' })
  near(ownerScore(church, FACTS, READ_ON), 80.17, 'the median one-person share', 2)
  near(budgetScore(church, FACTS), budgetScore(row({ trade: null }), FACTS), 'the median sales')
  // One listing is too few to read a trade's share of sites off.
  const sites = factsOf({ listings: [...LISTINGS, { trade: 'Church', site_kind: 'none' }] })
  near(needScore(church, sites), 100 * (0.5 + 9621 / 16557 / 2), 'the whole table’s share', 4)
})

check('registered in the last ninety days is worth half as much again', () => {
  const at = formed => scoreOf(row({ source: 'new-business', formed_on: formed }), FACTS, READ_ON)
  same(at('2026-08-05').fresh, true, 'ninety days')
  same(at('2026-08-04').fresh, false, 'ninety-one days')
  same(at('2027-01-01').fresh, true, 'a charter that takes effect later is new')
  same(FRESH_BOOST, 1.5, 'the multiplier')
  const fresh = at('2026-10-15')
  const year = at('2026-06-01')
  near(fresh.total / year.total, 1.5, 'the same company either side of ninety days', 1)
})

/**
 * Calls in one trade: `owner` the owner answered, `keen` of them wanting more,
 * `desk` a front desk answered, and `missed` nobody did.
 */
const rang = (trade, { owner = 0, desk = 0, keen = 0, missed = 0 }) => [
  ...Array.from({ length: owner }, (_, at) => ({
    trade,
    outcome: at < keen ? 'callback' : 'spoke',
    interested: at < keen ? true : null,
  })),
  ...Array.from({ length: desk }, () => ({ trade, outcome: 'gatekeeper', interested: null })),
  ...Array.from({ length: missed }, () => ({ trade, outcome: 'no_answer', interested: null })),
]

check('once a trade has twenty pick-ups, its calls replace the Census', () => {
  const calls = [
    ...rang('roofing contractor', { owner: 16, desk: 4, keen: 3, missed: 30 }),
    ...rang('barber shop', { owner: 20, keen: 3 }),
    ...rang('restaurant', { desk: 19 }),
  ]
  const tally = tradeCalls(calls)
  same(tally.byTrade.get('roofing contractor').reached, 20, 'a ring-out is not a pick-up')
  same(MEASURED_AFTER, 20, 'the threshold')
  const facts = factsOf({ metrics: TRADE_TABLE, listings: LISTINGS, calls })
  const roofer = row({ trade: 'roofing contractor' })
  // 16 owners of 20 pick-ups replaces 89 for the roofers.
  near(ownerScore(roofer, facts, READ_ON), 80, 'owner, measured')
  // 3 interested of 16 owners against 6 of 36 across every trade: 1.125.
  near(needScore(roofer, facts), 100 * (0.5 + 422 / 545 / 2) * 1.125, 'need, measured')
  // The barbers: 3 of 20 against 6 of 36 is 0.9.
  near(needScore(row(), facts), 100 * (0.5 + 178 / 543 / 2) * 0.9, 'a barber, measured')
  // The restaurants have 19 pick-ups, all front desks, one short, and keep
  // the Census.
  near(ownerScore(row({ trade: 'restaurant' }), facts, READ_ON), 27.56, 'nineteen is too few')
})

check('a measured trade moves Need by half at most, and never past 100', () => {
  const calls = [
    ...rang('roofing contractor', { owner: 20, keen: 20 }),
    ...rang('barber shop', { owner: 200, keen: 1 }),
  ]
  const facts = factsOf({ metrics: TRADE_TABLE, listings: LISTINGS, calls })
  same(needScore(row({ trade: 'roofing contractor' }), facts), 100, 'held at 100')
  near(needScore(row(), facts), 100 * (0.5 + 178 / 543 / 2) * 0.5, 'held at half')
})

// ── What the list offers ────────────────────────────────────────────────

check('a number is its ten digits', () => {
  same(phoneKey('(281) 862-9968'), '2818629968', 'formatted')
  same(phoneKey('+1 281 862 9968'), '2818629968', 'with its country')
  same(phoneKey('862-9968'), null, 'seven digits')
  same(phoneKey(null), null, 'nothing')
})

check('a name is read as the brand it trades under', () => {
  same(brandOf('Farmers Insurance - Joseph Pugh'), 'farmersinsurance', 'an agent after a dash')
  same(brandOf('Alvarez Tire Repair # 2'), 'alvareztirerepair', 'a store number')
  same(brandOf('A-1 Loggins Tree Services'), 'a1logginstreeservices', 'a hyphen inside a name')
  same(brandOf('RE/MAX American Dream'), brandOf('Re Max American Dream'), 'punctuation')
})

/** The table the rules are read against, in the shape of the live failures. */
const RULE_LISTINGS = [
  { name: 'Farmers Insurance - Joseph Pugh', phone: '(281) 100-0001', town: 'Baytown' },
  { name: 'Farmers Insurance - Mary Lee', phone: '(281) 100-0002', town: 'Pasadena' },
  { name: 'Farmers Insurance', phone: '(281) 100-0003', town: 'Humble' },
  { name: 'Pecan Park', phone: '(281) 420-6597', town: 'Baytown' },
  { name: 'Champion Little League Park', phone: '(281) 420-6597', town: 'Baytown' },
  { name: 'Hollaway Park', phone: '(281) 420-6597', town: 'Baytown' },
  { name: 'BW James LLP', phone: '(281) 420-1040', town: 'Baytown' },
  { name: 'BW James LLP', phone: '(281) 420-1040', town: 'Baytown' },
  { name: 'BW James LLP', phone: '(281) 420-1040', town: 'Baytown' },
  { name: "Merchant's Towing", phone: '(281) 331-4784', town: 'Alvin' },
  { name: 'Merchants Wrecker Services', phone: '(281) 331-4784', town: 'Alvin' },
  { name: 'Two Shops', phone: '(281) 555-0101', town: 'Baytown' },
  { name: 'Two Shops', phone: '(281) 555-0102', town: 'Baytown' },
]
const INDEX = indexOf(RULE_LISTINGS, [{ phone: '(281) 331-4784', prospect_id: 'towing' }])

check('a business already called is not offered again', () =>
  same(droppedFor(row({ calls: [{ outcome: 'no_answer' }] }), INDEX), 'already called', 'why')
)

check('a business whose last call reached a front desk stays on to wait for the owner', () => {
  const desk = row({ calls: [{ outcome: 'gatekeeper' }, { outcome: 'no_answer' }] })
  same(droppedFor(desk, INDEX), null, 'a front desk')
  const after = row({ calls: [{ outcome: 'no_answer' }, { outcome: 'gatekeeper' }] })
  same(droppedFor(after, INDEX), 'already called', 'rung again since')
  // Its own call is on the index, and is not a call under another listing.
  const own = indexOf(RULE_LISTINGS, [{ phone: '(281) 862-9968', prospect_id: 'p1' }])
  same(droppedFor(desk, own), null, 'its own call')
})

check('a Google listing with no reviews at all is not offered, a new company is', () => {
  // Ten of the first twelve Bad Leads were exactly this.
  const nobody = row({ name: 'StayFaded420', rating_count: null, trade_median: 37 })
  same(droppedFor(nobody, INDEX), 'no reviews on Google', 'why')
  // A company the pipeline found off the state's filings has no listing to
  // have reviews on, which is a different fact, whatever its status says.
  same(droppedFor(row({ rating_count: null, business_status: null }), INDEX), null, 'unread')
  same(droppedFor({ ...nobody, source: 'new-business' }, INDEX), null, 'a new company')
})

check('a chain or franchise is not offered', () => {
  const agent = row({ name: 'Farmers Insurance - Joseph Pugh', phone: '(281) 100-0001' })
  same(droppedFor(agent, INDEX), 'chain or franchise', 'three listings in three towns')
  const local = row({ name: 'Two Shops', phone: '(281) 555-0101' })
  same(droppedFor(local, INDEX), null, 'two listings in one town is a business, not a chain')
})

check('a number many businesses share is not an owner’s line', () => {
  const park = row({ name: 'Pecan Park', phone: '(281) 420-6597' })
  same(droppedFor(park, INDEX), 'number shared by several businesses', 'a city department')
  const firm = row({ name: 'BW James LLP', phone: '(281) 420-1040' })
  same(droppedFor(firm, INDEX), null, 'one firm listed three times under its own name')
})

check('a number already rung under another listing is not offered', () => {
  const second = row({ name: 'Merchants Wrecker Services', phone: '(281) 331-4784' })
  same(droppedFor(second, INDEX), 'number already called under another listing', 'why')
})

check('a listing far busier than its trade is not a small business', () => {
  const mall = row({ name: 'Deerbrook Marketplace', rating_count: 2625, trade_median: 7 })
  same(droppedFor(mall, INDEX), 'far more reviews than its trade', 'a mall filed as printing')
  // The tyre shop that turned out to be the best lead on the list: busy, and
  // still a shop.
  const busy = row({ name: "Luna's Tire Shop", rating_count: 411, trade_median: 35 })
  same(droppedFor(busy, INDEX), null, 'a busy shop')
})

check('a number that is not a number is not offered', () => {
  same(droppedFor(row({ phone: '862-9968' }), INDEX), 'not a full phone number', 'seven digits')
  same(droppedFor(row({ phone: '214-748-3647' }), INDEX), 'not a full phone number', 'a ceiling')
})

check('a second listing of one number is offered once', () => {
  const one = row({ id: 'a', name: 'BW James LLP', phone: '(281) 420-1040' })
  const two = row({ id: 'b', name: 'BW James LLP', phone: '(281) 420-1040' })
  same(
    kept([one, two], INDEX)
      .map(each => each.id)
      .join(','),
    'a',
    'the first'
  )
  same(kept([one], INDEX, new Set(['2814201040'])).length, 0, 'a number a call back holds')
})

check('every row says why it is there, in plain words', () => {
  const said = over => {
    const held = row(over)
    return reasonsFor({ ...held, score: scoreOf(held, FACTS, READ_ON) }).join(' · ')
  }
  same(said({ address: null }), 'No website', 'a barber with nothing')
  same(
    said({ trade: 'restaurant', address: null }),
    'No website · 73% of its trade have a website',
    'a restaurant'
  )
  same(
    said({ site_kind: 'social', website: 'https://www.facebook.com/kats' }),
    'Only a Facebook page',
    'a Facebook page'
  )
  same(
    said({ site_kind: 'social', website: 'https://kats.square.site/' }),
    'Only a Square booking page',
    'a booking page'
  )
  same(
    said({ site_kind: 'social', website: 'https://www.bbb.org/us/tx/x' }),
    'Only a BBB listing',
    'a directory, without its article'
  )
  same(
    said({ address: 'Highlands, TX 77562, USA' }),
    'No website · No storefront address',
    'no street'
  )
  const company = { source: 'new-business', new_business: true, formed_on: '2026-09-27' }
  const site = { ...company, site_kind: 'own', website: 'https://katscookies.example/' }
  same(
    said({ ...site, stage: 'contacted', email: 'hi@katscookies.example' }),
    'New business, registered Sep 27, 2026 · Emailed, no reply yet',
    'a new company written to'
  )
  same(
    said({ ...site, stage: 'bounced', email: 'hi@katscookies.example' }).split(' · ')[1],
    'Its email bounced',
    'bounced'
  )
  same(
    said({ ...site, skip_reason: CALL_FIRST_REASON }).split(' · ')[1],
    'Not emailed yet',
    'ahead'
  )
  ok(
    said({ call_due_reason: 'Broken site', trade: 'restaurant', address: 'Highlands' }).split(' · ')
      .length <= 3,
    'three'
  )
})

// ── What a call records ─────────────────────────────────────────────────

check('the seven results offered, in the order they are drawn', () => {
  same(
    OFFERED_OUTCOMES.join(','),
    'spoke,gatekeeper,no_answer,voicemail,callback,not_interested,wrong_number',
    'the results'
  )
  same(
    CALL_OUTCOMES.filter(one => one.offered)
      .map(one => one.label)
      .join(', '),
    'Owner Answered, Front Desk, No Answer, Voicemail, Call Back, Not Interested, Bad Number',
    'the labels'
  )
})

check('every outcome the column holds can still be read back', () => {
  const snapshot = JSON.parse(read('scripts/db/db-constraints.json'))
  const column = snapshot.columns?.outreach_calls?.outcome
  ok(column, 'the schema snapshot carries no outcome column for outreach_calls')
  same([...OUTCOME_IDS].sort().join(','), [...column.allows].sort().join(','), 'the outcomes')
  for (const id of OFFERED_OUTCOMES) ok(column.allows.includes(id), `${id} is not allowed`)
})

check('what each result does next', () => {
  ok(outcomeTakesCallback('callback'), 'Call Back carries a time')
  ok(outcomeTakesCallback('gatekeeper'), 'Front Desk carries a time')
  ok(
    outcomeAsksOwner('gatekeeper') && !outcomeAsksOwner('spoke'),
    'only Front Desk asks after the owner'
  )
  for (const id of ['spoke', 'no_answer', 'voicemail', 'not_interested', 'wrong_number']) {
    ok(!outcomeTakesCallback(id), `${id} carries a time`)
  }
  ok(outcomeEnds('not_interested') && outcomeEnds('wrong_number'), 'the two that end it')
  ok(!outcomeEnds('gatekeeper'), 'a front desk ends nothing')
  same(interestIn('not_interested'), false, 'a no')
  same(interestIn('no_answer'), null, 'nobody reached')
  same(interestIn('gatekeeper'), null, 'a front desk says nothing about interest')
})

check('a call that reached somebody who could buy becomes a lead, and only that', () => {
  ok(callMakesLead('spoke'), 'a conversation with the owner')
  ok(callMakesLead('callback'), 'a call back')
  ok(!callMakesLead('gatekeeper'), 'a front desk')
  ok(!callMakesLead('no_answer') && !callMakesLead('voicemail'), 'nobody reached')
  ok(!callMakesLead('not_interested') && !callMakesLead('wrong_number'), 'a no')
})

check('Call Back and Front Desk are sent with a time, and Front Desk with the owner', () => {
  const back = callBody({ id: 'p1', outcome: 'callback', hours: 24, note: ' ring Tue ' })
  ok(back.callback_at, 'a call back went with no time')
  same(back.note, 'ring Tue', 'the note, trimmed')
  same('owner_name' in back, false, 'a call back carries no owner')
  same(callBody({ id: 'p1', outcome: 'no_answer', hours: 24 }).callback_at, null, 'no answer')
  same(
    callBody({ id: 'p1', outcome: 'callback', at: '2026-11-05T15:00:00.000Z' }).callback_at,
    '2026-11-05T15:00:00.000Z',
    'a time typed in'
  )
  const desk = callBody({
    id: 'p1',
    outcome: 'gatekeeper',
    at: '2026-11-05T21:00:00.000Z',
    ownerName: ' Maria Lopez ',
    ownerPhone: '',
  })
  same(desk.callback_at, '2026-11-05T21:00:00.000Z', 'when the owner is in')
  same(desk.owner_name, 'Maria Lopez', 'the owner, trimmed')
  same(desk.owner_phone, null, 'no number given')
  ok(
    CALLBACK_LENGTHS.every(length => length.hours > 0 && length.label),
    'a length with no label'
  )
})

check('the day is counted against fifty, in words and as a share of the bar', () => {
  same(DAILY_CALL_GOAL, 50, 'the goal')
  same(dayLine(12), '12 of 50 calls today', 'twelve')
  same(dayLine(0), '0 of 50 calls today', 'none yet')
  same(dayShare(12), 24, 'twelve of fifty')
  same(dayShare(61), 100, 'a long day fills the bar and no more')
})

// ── The new-business mirror ─────────────────────────────────────────────

const LEAD = {
  taxpayer_number: '32100000002',
  name: 'ROCK SOLID IT LLC',
  address: '100 ARGYLE PASS',
  city: 'SAN ANTONIO',
  state: 'TX',
  zip: '78247',
  website: 'https://rocksolidit.example/',
  phone: '(210) 555-0160',
}

check('a company with an address and a number is on the call list before its letter', () => {
  const ahead = phoneRow({ ...LEAD, email: 'sam@rocksolidit.example' })
  same(JSON.stringify(ahead), JSON.stringify(callFirstRow(LEAD)), 'the row it is mirrored as')
  same(ahead.stage, 'unreachable', 'a stage the sweep does not read')
  same(ahead.email, null, 'no address, so the outreach sender never writes to it')
  same(ahead.skip_reason, CALL_FIRST_REASON, 'a reason the retry does not read')
  same(isCallable(ahead), true, 'callable')
  // The retry takes rows back by the reasons it knows; neither mirror reason is one.
  const enrich = read('api/outreach/enrich.js')
  const retried = enrich.slice(
    enrich.indexOf('const RETRY_AFTER_DAYS'),
    enrich.indexOf('const READ_FROM_A_SITE')
  )
  for (const reason of [CALL_FIRST_REASON, PHONE_ONLY_REASON]) {
    ok(!retried.includes(reason), `the retry reads "${reason}"`)
  }
  // The sender reads only rows carrying an address.
  ok(/\.not\('email', 'is', null\)/.test(read('lib/outreach/sending/queue.js')), 'the sender')
  // And the letter takes the same row over: one company, one row.
  const written = contactedRow(
    { ...LEAD, email: 'sam@rocksolidit.example' },
    '2026-11-03T15:00:00Z'
  )
  same(`${written.source}/${written.source_ref}`, `${ahead.source}/${ahead.source_ref}`, 'the key')
  same(written.stage, 'contacted', 'written to')
  same(written.skip_reason, null, 'the reason goes with it')
  same(JSON.stringify(phoneRow(LEAD)), JSON.stringify(phoneOnlyRow(LEAD)), 'no address at all')
})

check('the check job mirrors a number the moment it is found', () => {
  const job = read('api/new-business/check.js')
  ok(/found\.email[\s\S]*?phoneRow\(/.test(job), 'a company with an address is not mirrored')
  ok(/prospect_id = prospectId/.test(job), 'the lead is not tied to its row')
})

// ── The endpoint, against a database in memory ──────────────────────────

/** Splits a PostgREST `or` filter at its top-level commas. */
function terms(expression) {
  const out = []
  let depth = 0
  let at = 0
  for (let index = 0; index < expression.length; index += 1) {
    const char = expression[index]
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      out.push(expression.slice(at, index))
      at = index + 1
    }
  }
  out.push(expression.slice(at))
  return out
}

/** A list written the way PostgREST takes one: `(a,b)`. */
const listOf = value =>
  String(value)
    .replace(/^\(|\)$/g, '')
    .split(',')

/** One `column.operator.value` term, as a test of a row. */
function termTest(term) {
  const [column, operator, ...rest] = term.split('.')
  const value = rest.join('.')
  if (operator === 'eq') return one => String(one[column]) === value
  if (operator === 'in') return one => listOf(value).includes(String(one[column]))
  throw new Error(`the stand-in database does not read ${term}`)
}

/**
 * Enough of the Supabase client for the endpoint: filters are applied to the
 * rows held, writes are recorded, and the lead function is answered by hand.
 */
function database(tables) {
  const writes = []
  const rpcs = []
  let made = 0
  const from = table => {
    const filters = []
    let op = 'select'
    let payload = null
    let columns = '*'
    let head = false
    let order = null
    let cut = null
    let limit = null
    let single = false
    const builder = {
      select(wanted = '*', options = {}) {
        if (op === 'select') {
          columns = wanted
          head = Boolean(options.head)
        }
        return builder
      },
      eq(column, value) {
        filters.push(one => one[column] === value)
        return builder
      },
      in(column, values) {
        filters.push(one => values.includes(one[column]))
        return builder
      },
      not(column, operator, value) {
        if (operator === 'is') {
          filters.push(one => one[column] !== null && one[column] !== undefined)
        } else if (operator === 'in') {
          filters.push(one => !listOf(value).includes(String(one[column])))
        } else throw new Error(`the stand-in database does not read not.${operator}`)
        return builder
      },
      or(expression) {
        const tests = terms(expression).map(termTest)
        filters.push(one => tests.some(test => test(one)))
        return builder
      },
      lt(column, value) {
        filters.push(one => one[column] && Date.parse(one[column]) < Date.parse(value))
        return builder
      },
      gte(column, value) {
        filters.push(one => one[column] && Date.parse(one[column]) >= Date.parse(value))
        return builder
      },
      order(column, { ascending = true } = {}) {
        order = { column, ascending }
        return builder
      },
      range(start, end) {
        cut = [start, end]
        return builder
      },
      limit(count) {
        limit = count
        return builder
      },
      maybeSingle() {
        single = true
        return builder
      },
      insert(values) {
        op = 'insert'
        payload = values
        return builder
      },
      update(values) {
        op = 'update'
        payload = values
        return builder
      },
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject)
      },
    }
    const run = () => {
      const held = (tables[table] ??= [])
      if (op === 'insert') {
        made += 1
        const written = { id: `made-${made}`, called_at: new Date().toISOString(), ...payload }
        held.push(written)
        writes.push({ table, op, row: written })
        return { data: single ? written : [written], error: null }
      }
      let rows = held.filter(one => filters.every(test => test(one)))
      if (op === 'update') {
        for (const one of rows) Object.assign(one, payload)
        writes.push({ table, op, row: payload, ids: rows.map(one => one.id) })
        return { data: rows, error: null }
      }
      if (head) return { data: null, error: null, count: rows.length }
      if (order) {
        rows = [...rows].sort((one, two) => {
          const by = String(one[order.column]).localeCompare(String(two[order.column]))
          return order.ascending ? by : -by
        })
      }
      const count = rows.length
      if (cut) rows = rows.slice(cut[0], cut[1] + 1)
      if (limit !== null) rows = rows.slice(0, limit)
      if (columns.includes('outreach_prospects(')) {
        rows = rows.map(call => {
          const business = tables.outreach_prospects.find(one => one.id === call.prospect_id)
          return { ...call, outreach_prospects: { phone: business?.phone, trade: business?.trade } }
        })
      }
      return single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null, count }
    }
    return builder
  }
  const rpc = async (name, args) => {
    rpcs.push({ name, args })
    if (name === 'lead_record') return { data: { lead_id: 'lead-1', fresh: true }, error: null }
    return { data: null, error: { message: `no function ${name} here` } }
  }
  return { from, rpc, writes, rpcs, tables }
}

/** A business on the table. */
const business = (id, over = {}) => ({ ...row({ id, name: id }), ...over, calls: undefined })

/** A new company's mirror row on the table. */
const company = (id, over = {}) =>
  business(id, {
    source: 'new-business',
    source_ref: `tx-${id}`,
    website: `https://${id}.example/`,
    address: '100 Main St, Houston, TX, 77002',
    trade: null,
    rating: null,
    rating_count: null,
    business_status: null,
    ...over,
  })

/** A call on the record. */
const rung = (id, prospect, at, over = {}) => ({
  id,
  prospect_id: prospect,
  outcome: 'spoke',
  note: null,
  interested: null,
  callback_at: null,
  called_at: at,
  ...over,
})

function table() {
  const prospects = [
    // What is owed.
    business('overdue', { phone: '(281) 200-0001' }),
    business('later-today', { phone: '(281) 200-0002' }),
    business('tomorrow', { phone: '(281) 200-0003' }),
    business('superseded', { phone: '(281) 200-0004' }),
    business('ended', { phone: '(281) 200-0005' }),
    business('stopped', { phone: '(281) 200-0006', stage: 'unsubscribed' }),
    business('asked', {
      phone: '(281) 200-0007',
      site_kind: 'own',
      website: 'https://harbortire.example',
      call_due_at: '2026-11-01T15:00:00+00:00',
      call_due_reason: 'Broken site: the certificate expired',
    }),
    business('asked-and-rung', {
      phone: '(281) 200-0008',
      site_kind: 'own',
      website: 'https://other.example',
      call_due_at: '2026-10-30T15:00:00+00:00',
    }),
    business('desk-today', { phone: '(281) 200-0009', owner_name: 'Ray' }),
    // The map sweep's businesses.
    business('r-roof', {
      phone: '(409) 555-0141',
      address: 'Texas City, TX 77590, USA',
      trade: 'roofing contractor',
    }),
    business('r-barber', {
      phone: '(281) 400-0003',
      site_kind: 'social',
      website: 'https://www.facebook.com/kats',
    }),
    business('r-nobody', { phone: '(281) 400-0001', rating_count: null }),
    business('r-same-number', { phone: '(281) 200-0001' }),
    business('r-rung', { phone: '(281) 400-0004' }),
    business('r-closed', { phone: '(281) 400-0006', business_status: 'CLOSED_PERMANENTLY' }),
    business('r-own', {
      phone: '(281) 400-0007',
      site_kind: 'own',
      website: 'https://own.example',
    }),
    business('r-desk', {
      phone: '(281) 400-0008',
      owner_name: 'Maria Lopez',
      owner_phone: '(281) 555-0199',
      owner_source: 'call',
    }),
    business('r-desk-late', { phone: '(281) 400-0009' }),
    // The new companies.
    company('nb-phone', {
      phone: '(512) 300-0001',
      skip_reason: PHONE_ONLY_REASON,
      address: 'PO BOX 360159, HOUSTON, TX, 77002',
    }),
    company('nb-contacted', {
      phone: '(512) 300-0002',
      site_kind: 'own',
      stage: 'contacted',
      email: 'hi@nb-contacted.example',
    }),
    company('nb-first', {
      phone: '(512) 300-0003',
      site_kind: 'own',
      skip_reason: CALL_FIRST_REASON,
      owner_name: 'Sam Rivera',
      owner_source: 'https://nb-first.example/about https://nb-first.example/contact',
    }),
    company('nb-stopped', { phone: '(512) 300-0004', site_kind: 'own', stage: 'unsubscribed' }),
    company('nb-replied', { phone: '(512) 300-0005', site_kind: 'own', stage: 'replied' }),
    company('nb-rung', { phone: '(512) 300-0006', skip_reason: PHONE_ONLY_REASON }),
  ]
  const calls = [
    rung('c1', 'overdue', '2026-09-08T20:32:00+00:00', {
      callback_at: '2026-09-22T20:31:00+00:00',
    }),
    rung('c2', 'later-today', '2026-11-02T15:00:00+00:00', {
      outcome: 'callback',
      interested: true,
      callback_at: '2026-11-02T22:00:00+00:00',
    }),
    rung('c3', 'tomorrow', '2026-11-02T15:00:00+00:00', {
      outcome: 'callback',
      interested: true,
      callback_at: '2026-11-03T15:00:00+00:00',
    }),
    rung('c4', 'superseded', '2026-10-01T15:00:00+00:00', {
      callback_at: '2026-10-02T15:00:00+00:00',
    }),
    rung('c5', 'superseded', '2026-10-03T15:00:00+00:00', { outcome: 'no_answer' }),
    rung('c6', 'ended', '2026-10-01T15:00:00+00:00', { callback_at: '2026-10-02T15:00:00+00:00' }),
    rung('c7', 'ended', '2026-10-02T15:00:00+00:00', { outcome: 'not_interested' }),
    rung('c8', 'stopped', '2026-10-01T15:00:00+00:00', {
      outcome: 'callback',
      callback_at: '2026-10-02T15:00:00+00:00',
    }),
    rung('c9', 'asked-and-rung', '2026-10-31T15:00:00+00:00', { outcome: 'no_answer' }),
    rung('c10', 'r-rung', '2026-10-31T15:00:00+00:00', { outcome: 'no_answer' }),
    rung('c11', 'nb-rung', '2026-10-31T15:00:00+00:00', { outcome: 'voicemail' }),
    // Front desks: one whose owner is in later today, one on Thursday, one
    // who gave no time before Front Desk booked one.
    rung('c12', 'desk-today', '2026-11-02T16:00:00+00:00', {
      outcome: 'gatekeeper',
      callback_at: '2026-11-02T21:00:00+00:00',
    }),
    rung('c13', 'r-desk', '2026-11-02T16:30:00+00:00', {
      outcome: 'gatekeeper',
      callback_at: '2026-11-05T21:00:00+00:00',
    }),
    rung('c14', 'r-desk-late', '2026-09-10T19:22:00+00:00', { outcome: 'gatekeeper' }),
  ]
  const leads = [
    { id: 'l1', taxpayer_number: 'tx-nb-phone', formed_on: '2026-10-20', stage: 'phone_only' },
    { id: 'l2', taxpayer_number: 'tx-nb-contacted', formed_on: '2026-07-01', stage: 'contacted' },
    { id: 'l3', taxpayer_number: 'tx-nb-first', formed_on: '2026-10-28', stage: 'emailable' },
    { id: 'l4', taxpayer_number: 'tx-nb-stopped', formed_on: '2026-10-26', stage: 'unsubscribed' },
    { id: 'l5', taxpayer_number: 'tx-nb-rung', formed_on: '2026-10-25', stage: 'phone_only' },
    { id: 'l6', taxpayer_number: 'tx-waiting', formed_on: '2026-10-30', stage: 'waiting' },
  ]
  return database({
    outreach_prospects: prospects,
    outreach_calls: calls,
    new_business_leads: leads,
    call_trade_metrics: TRADE_TABLE,
    leads: [],
  })
}

check('today runs from midnight to midnight in Baytown, not in Greenwich', () => {
  same(todayFrom(NOW).toISOString(), '2026-11-02T06:00:00.000Z', 'the start of the day')
  same(tomorrowFrom(NOW).toISOString(), '2026-11-03T06:00:00.000Z', 'the end of the day')
})

check('call backs due today or overdue lead the list, oldest first', async () => {
  const answer = await list(table(), {}, NOW)
  same(answer.status, 200, 'the status')
  same(
    answer.body.due.map(one => one.id).join(','),
    'overdue,asked,desk-today,later-today',
    'what is owed today'
  )
  const [overdue, asked, desk, later] = answer.body.due
  same(overdue.due.kind, 'callback', 'a call back')
  same(asked.due.kind, 'asked', 'a call a chain asked for')
  same(asked.reasons[0], 'Broken site: the certificate expired', 'the chain’s own line')
  same(desk.due.kind, 'callback', 'a front desk whose owner is in today comes up with them')
  same(desk.owner_name, 'Ray', 'with the name to ask for')
  same(later.calls[0].outcome, 'callback', 'the history comes with it')
  ok(overdue.score && overdue.reasons, 'a call back is scored and explained like the rest')
})

check(
  'a call back a newer call replaced, a business that ended, and a stop are not owed',
  async () => {
    const owed = (await list(table(), {}, NOW)).body.due.map(one => one.id)
    for (const id of ['tomorrow', 'superseded', 'ended', 'stopped', 'asked-and-rung']) {
      ok(!owed.includes(id), `${id} was offered as due`)
    }
  }
)

check('one list: the sweep’s businesses and the new companies, best score first', async () => {
  const answer = await list(table(), {}, NOW)
  const rows = answer.body.rows
  same(
    rows.map(one => one.id).join(','),
    'r-roof,nb-phone,nb-first,nb-contacted,r-barber',
    'what is left to call, in order'
  )
  const totals = rows.map(one => one.score.total)
  ok(
    totals.every((total, at) => at === 0 || totals[at - 1] >= total),
    `the list is not in score order: ${totals.join(', ')}`
  )
  const [roof, phoneOnly, ahead, contacted, barber] = rows
  // No trade on this small table has the twenty listings its own share of
  // sites is read from, so every row reads the table's 7 in 24.
  same(scoreWords(roof.score), 'Owner 95 · Need 65 · Budget 72', 'the roofer’s scores')
  same(roof.reasons.join(' · '), 'No website · No storefront address', 'why the roofer is there')
  same(barber.reasons[0], 'Only a Facebook page', 'why the barber is there')
  same(phoneOnly.new_business, true, 'a new company, marked as one')
  same(phoneOnly.formed_on, '2026-10-20', 'with the day it was registered')
  same(
    phoneOnly.reasons.join(' · '),
    'New business, registered Oct 20, 2026 · No email address on its site · No storefront address',
    'why the phone-only company is there'
  )
  same(ahead.reasons[1], 'Not emailed yet', 'a company mirrored before its letter')
  same(ahead.owner_name, 'Sam Rivera', 'the name the owner finder found')
  same(
    ahead.owner_from.pages.join(' '),
    'https://nb-first.example/about https://nb-first.example/contact',
    'and the two pages it was read off'
  )
  same(ahead.owner_phone, null, 'no number found, so the listing’s is dialled')
  same(contacted.reasons[1], 'Emailed, no reply yet', 'a company already written to')
  // The ninety days are worth half as much again: nb-first is five days old
  // and nb-contacted four months. And a PO box is no storefront, which lifts
  // nb-phone's Owner above nb-first's.
  ok(ahead.score.total > contacted.score.total, 'a fresher company did not rank higher')
  ok(phoneOnly.score.owner > ahead.score.owner, 'a PO box did not lift Owner')
  for (const id of ['r-nobody', 'r-same-number', 'r-rung', 'r-closed', 'r-own']) {
    ok(!rows.some(one => one.id === id), `${id} was offered`)
  }
  for (const id of ['nb-stopped', 'nb-replied', 'nb-rung']) {
    ok(!rows.some(one => one.id === id), `${id} was offered`)
  }
  same(answer.body.page, 1, 'the page')
  same(answer.body.pages, 1, 'one page of five')
})

check('a business whose last call was Front Desk waits at the foot until it is due', async () => {
  const answer = await list(table(), {}, NOW)
  same(
    answer.body.waiting.map(one => one.id).join(','),
    'r-desk,r-desk-late',
    'waiting on the owner, the soonest first and the one with no time last'
  )
  const [desk, late] = answer.body.waiting
  same(desk.front_desk.at, '2026-11-05T21:00:00+00:00', 'when the owner is in')
  same(late.front_desk.at, null, 'a front desk that gave no time')
  same(desk.calls[0].outcome, 'gatekeeper', 'the history comes with it')
  same(desk.owner_name, 'Maria Lopez', 'the owner')
  same(desk.dial, 'tel:2815550199', 'the button rings the owner’s own number')
  same(desk.phone, '(281) 400-0008', 'and the listing’s is still drawn')
  same(desk.score.owner, 100, 'a direct line is a certain answer')
  ok(!answer.body.rows.some(one => one.id === 'r-desk'), 'it is not among the fresh ones')
  // On the day the owner is in, it moves up into what is due.
  const thursday = await list(table(), {}, new Date('2026-11-05T15:00:00Z'))
  ok(
    thursday.body.due.some(one => one.id === 'r-desk'),
    'not due on the day'
  )
  ok(!thursday.body.waiting.some(one => one.id === 'r-desk'), 'still waiting on the day')
})

check('the day’s calls are counted from midnight in Central, every one of them', async () => {
  const answer = await list(table(), {}, NOW)
  // c2, c3, c12 and c13 were placed on Nov 2 in Baytown; the rest before.
  same(answer.body.today.calls, 4, 'calls today')
  same(answer.body.today.goal, 50, 'the goal')
  const night = await list(table(), {}, new Date('2026-11-03T05:59:00Z'))
  same(night.body.today.calls, 4, 'still Nov 2 at eleven at night')
  const morning = await list(table(), {}, new Date('2026-11-03T06:01:00Z'))
  same(morning.body.today.calls, 0, 'a new day')
})

check('a business that asked to stop since the set was read is not drawn', async () => {
  const db = table()
  const first = await list(db, {}, NOW)
  same(first.body.rows[0].id, 'r-roof', 'the roofer leads the first read')
  // A new row rather than an edit, so the set this instance holds still has
  // the roofer at 'unreachable' and only the read before drawing sees the stop.
  const rows = db.tables.outreach_prospects
  const at = rows.findIndex(one => one.id === 'r-roof')
  rows[at] = { ...rows[at], stage: 'unsubscribed' }
  const again = await list(db, {}, NOW)
  ok(!again.body.rows.some(one => one.id === 'r-roof'), 'the roofer was offered after a stop')
})

check('the list reads no view and no ranking function', async () => {
  const db = table()
  const answer = await list(db, { view: 'new' }, NOW)
  same(answer.body.rows.length, 5, 'a view parameter changes nothing')
  same(db.rpcs.length, 0, 'a database function was asked for the list')
})

/** A business id the endpoint will read, and the owner recording against it. */
const UUID = '6f1c3a52-6a0e-4b8e-9d1f-0c2a8e5b7d10'
const OWNER = { userId: '9b2e4f10-1d3c-4a5b-8e7f-102030405060' }

/** A database holding one business, and the endpoint's answer to a call against it. */
async function callOn(over, body) {
  const db = database({
    outreach_prospects: [business(UUID, over)],
    outreach_calls: [],
    leads: [],
  })
  const answer = await record(db, { id: UUID, ...body }, OWNER)
  return { db, answer }
}

check('only the seven results are recorded', async () => {
  for (const outcome of ['audit_booked', 'booked', 'bad_lead', 'nonsense']) {
    const answer = await record(table(), { id: UUID, outcome }, OWNER)
    same(answer.status, 400, `${outcome} was taken`)
  }
})

check('a time goes with Call Back and Front Desk and nothing else', async () => {
  const later = new Date(Date.now() + 86_400_000).toISOString()
  const { answer } = await callOn({}, { outcome: 'no_answer', callback_at: later })
  same(answer.status, 400, 'a no answer with a time')
  const past = await callOn({}, { outcome: 'callback', callback_at: '2020-01-01T00:00:00Z' })
  same(past.answer.status, 400, 'a call back in the past')
  const desk = await callOn({}, { outcome: 'gatekeeper', callback_at: later })
  same(desk.answer.status, 200, 'a front desk with the time the owner is in')
})

check('a business the list would not offer takes no call', async () => {
  same((await callOn({ stage: 'unsubscribed' }, { outcome: 'spoke' })).answer.status, 409, 'stop')
  same((await callOn({ stage: 'skipped' }, { outcome: 'spoke' })).answer.status, 409, 'skipped')
  same((await callOn({ phone: '' }, { outcome: 'spoke' })).answer.status, 409, 'no number')
  const stopped = await callOn(
    { stage: 'unsubscribed' },
    { outcome: 'gatekeeper', owner_name: 'A' }
  )
  same(stopped.answer.status, 409, 'a front desk at a business that asked to stop')
  same(stopped.db.writes.length, 0, 'and nothing was written about its owner')
  const missing = database({ outreach_prospects: [], outreach_calls: [] })
  same((await record(missing, { id: UUID, outcome: 'spoke' }, OWNER)).status, 404, 'unknown')
  same((await record(missing, { id: 'x', outcome: 'spoke' }, OWNER)).status, 400, 'not an id')
})

check('a new company written to can be rung', async () => {
  const { answer } = await callOn(
    { source: 'new-business', site_kind: 'own', stage: 'contacted', email: 'a@x.example' },
    { outcome: 'no_answer' }
  )
  same(answer.status, 200, 'the status')
})

check('a call back nobody timed is filed a day out', async () => {
  const { db, answer } = await callOn({}, { outcome: 'callback', note: 'try tomorrow' })
  same(answer.status, 200, 'the status')
  const call = db.writes.find(one => one.table === 'outreach_calls').row
  const hours = (Date.parse(call.callback_at) - Date.now()) / 3_600_000
  ok(hours > 23.9 && hours <= 24, `the call back lands ${hours} hours out`)
  same(call.note, 'try tomorrow', 'the note')
  same(call.called_by, OWNER.userId, 'who rang')
  same(answer.body.callback_at, call.callback_at, 'the time comes back to the page')
})

check('Front Desk books the call back and writes the owner on the business', async () => {
  const at = new Date(Date.now() + 2 * 86_400_000).toISOString()
  const { db, answer } = await callOn(
    {},
    {
      outcome: 'gatekeeper',
      callback_at: at,
      owner_name: '  Maria Lopez ',
      owner_phone: '281.555.0199',
      note: 'in after lunch',
    }
  )
  same(answer.status, 200, 'the status')
  const owner = db.writes.find(one => one.table === 'outreach_prospects')
  same(owner.ids.join(','), UUID, 'written on the business called')
  same(owner.row.owner_name, 'Maria Lopez', 'the name, trimmed')
  same(owner.row.owner_phone, '(281) 555-0199', 'the number, written as the listing’s is')
  same(owner.row.owner_source, 'call', 'from a call')
  ok(Date.parse(owner.row.owner_checked_at) > Date.now() - 60_000, 'when it was asked')
  const call = db.writes.find(one => one.table === 'outreach_calls').row
  same(call.outcome, 'gatekeeper', 'stored as gatekeeper')
  same(call.callback_at, at, 'the call back is when the owner is in')
  same(call.interested, null, 'a front desk says nothing about interest')
  ok(
    db.writes.indexOf(owner) <
      db.writes.indexOf(db.writes.find(one => one.table === 'outreach_calls')),
    'the owner is written before the call, so a refusal saves neither'
  )
  same(answer.body.owner.name, 'Maria Lopez', 'the page is told the name')
  same(answer.body.owner.phone, '(281) 555-0199', 'and the number it now dials')
  same(answer.body.owner.from.call, true, 'and where it came from')
  same(
    db.rpcs.some(one => one.name === 'lead_record'),
    false,
    'a front desk is not a lead'
  )
})

check('Front Desk with nothing learned still books a day out, and unlearns nothing', async () => {
  const { db, answer } = await callOn(
    { owner_name: 'Ray', owner_phone: '(281) 555-0100', owner_source: 'call' },
    { outcome: 'gatekeeper' }
  )
  same(answer.status, 200, 'the status')
  const owner = db.writes.find(one => one.table === 'outreach_prospects').row
  same('owner_name' in owner || 'owner_phone' in owner, false, 'nothing cleared')
  same('owner_source' in owner, false, 'and the source left as it was')
  const call = db.writes.find(one => one.table === 'outreach_calls').row
  const hours = (Date.parse(call.callback_at) - Date.now()) / 3_600_000
  ok(hours > 23.9 && hours <= 24, `the call back lands ${hours} hours out`)
  same(answer.body.owner.name, 'Ray', 'the name already on file comes back')
})

check('the owner’s name and number go with Front Desk only, and only a whole number', async () => {
  const spoke = await callOn({}, { outcome: 'spoke', owner_name: 'Maria' })
  same(spoke.answer.status, 400, 'a name on Owner Answered')
  same(spoke.db.writes.length, 0, 'and nothing written')
  const short = await callOn({}, { outcome: 'gatekeeper', owner_phone: '555-0199' })
  same(short.answer.status, 400, 'a number that is not whole')
  same(short.db.writes.length, 0, 'and nothing written')
  // The listing's own line is what reached the front desk, so it is not kept.
  const main = await callOn({}, { outcome: 'gatekeeper', owner_phone: '(281) 862-9968' })
  same(main.answer.status, 200, 'the status')
  const owner = main.db.writes.find(one => one.table === 'outreach_prospects').row
  same('owner_phone' in owner, false, 'the main line kept as the owner’s')
  same(main.answer.body.owner.phone, null, 'and none dialled')
})

check('a save comes back with the day’s count, other screens included', async () => {
  const db = database({
    outreach_prospects: [business(UUID)],
    outreach_calls: [rung('earlier', 'someone-else', new Date().toISOString())],
    leads: [],
  })
  const answer = await record(db, { id: UUID, outcome: 'no_answer' }, OWNER)
  same(answer.body.today.calls, 2, 'this call and the one before it')
  same(answer.body.today.goal, 50, 'the goal')
})

check('a conversation becomes a lead and a ring-out does not', async () => {
  const spoke = await callOn({}, { outcome: 'spoke' })
  ok(
    spoke.db.rpcs.some(one => one.name === 'lead_record'),
    'a conversation made no lead'
  )
  const nobody = await callOn({}, { outcome: 'no_answer' })
  ok(!nobody.db.rpcs.some(one => one.name === 'lead_record'), 'a ring-out made a lead')
  const no = await callOn({}, { outcome: 'not_interested' })
  ok(!no.db.rpcs.some(one => one.name === 'lead_record'), 'a no made a lead')
  same(no.db.writes[0].row.interested, false, 'a no is stored as one')
})

check('nothing is claimed: the business is not handed to anybody', async () => {
  const { db } = await callOn({}, { outcome: 'spoke' })
  ok(
    !db.writes.some(one => one.table === 'outreach_prospects' && 'assigned_to' in one.row),
    'the call wrote an owner onto the business'
  )
})

// ── The page ────────────────────────────────────────────────────────────

check('the page is the owner’s one list and nothing else', () => {
  const page = read('src/app/views/console/pages/calls/CallListPage.jsx')
  const hook = read('src/app/hooks/console/useCallList.js')
  ok(/useCallList/.test(page), 'the page does not read the list')
  ok(/CALL_OUTCOMES\.filter\(outcome => outcome\.offered\)/.test(page), 'the results drawn')
  ok(/href=\{row\.dial\}/.test(page), 'the number is not a link to dial')
  for (const gone of ['staff', 'shift', 'presence', 'scriptFor', 'handbook', 'assigned']) {
    ok(!new RegExp(gone, 'i').test(page), `the page still mentions ${gone}`)
  }
  for (const gone of ['ViewNav', 'useView', 'New Businesses', "view === 'new'"]) {
    ok(!page.includes(gone), `the page still has its views: ${gone}`)
  }
  ok(!/view=/.test(hook), 'the hook still asks for a view')
  ok(!read('api/calls-admin.js').includes('VIEWS'), 'the endpoint still has its views')
})

check('the page says the scores, the day, and the front desk', () => {
  const page = read('src/app/views/console/pages/calls/CallListPage.jsx')
  ok(/scoreWords\(row\.score\)/.test(page), 'the three scores are not drawn')
  ok(/GoalBar/.test(page) && /dayLine\(/.test(page), 'the day is not drawn against its goal')
  ok(/Save Front Desk/.test(page), 'Front Desk has nothing to save')
  ok(/Waiting on the owner/.test(page), 'the front desks are not at the foot')
  ok(/Ask for \{row\.owner_name\}/.test(page), 'the owner’s name is not drawn')
  const css = read('src/app/views/console/console.css')
  const bar = css.slice(css.indexOf('.console-goal {'), css.indexOf('/* ── The views inside'))
  ok(bar.length > 0 && !/transition|animation/.test(bar), 'the day’s bar moves')
})

await finish()

console.log(`call list: ${cases.length} checks passed`)
