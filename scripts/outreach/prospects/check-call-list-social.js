/**
 * Proves the Call List draws a company's Facebook history as it happened, and
 * ranks a company that answered without ever inventing that it did.
 *
 * Six things are held here.
 *
 * The times. Every date on this section is a Central one. The history is made
 * in Texas and read in Texas, and a stamp rendered in whatever zone the
 * browser happens to be in puts an afternoon comment on the following day.
 * Rendered from three zones, the line has to read the same from all of them.
 *
 * What was actually said. A comment, a reply, a message or a post is drawn
 * with its own words, and the card says so where only a summary was ever
 * captured, so a paraphrase is never read out as a quote.
 *
 * Done against not done. A comment waiting in a group's approval queue has not
 * been seen by anybody, and the one thing the owner must not do is mention it
 * as though it had. Confirmed is drawn plainly; pending, attempted and failed
 * each say what they are.
 *
 * Nothing invented. A row whose action this code does not know, whose status it
 * does not know, that has no readable time, or that claims to be a comment and
 * carries no comment, is not drawn at all. The table is written from another
 * machine, and a row that cannot be read is refused rather than guessed at. A
 * company with nothing on file draws nothing.
 *
 * The right company. The match is `outreach_prospects.id` and nothing looser.
 * One company's rows never appear on another's card, whatever the names look
 * like.
 *
 * What answering back is worth. A company that moved toward the studio inside
 * the window is multiplied by what the move was worth - asked about a website,
 * talked about their site, or merely reacted - and the strongest move counts
 * once, so a run of likes is one courtesy and not ten. The studio's own
 * comments and follows are worth nothing here. And none of it is a door onto
 * the list: a business the list would not offer is not carried back on by a
 * reaction.
 *
 * The endpoint is driven against a database in memory rather than read.
 *
 *   npm run check:call-list-social
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  PAGE_VERIFICATIONS,
  PAGE_VERIFICATION_IDS,
  SOCIAL_ACTIONS,
  SOCIAL_ACTION_IDS,
  SOCIAL_DIRECTIONS,
  SOCIAL_INTERESTS,
  SOCIAL_INTEREST_FLOOR,
  SOCIAL_INTEREST_IDS,
  SOCIAL_LOOKBACK_DAYS,
  SOCIAL_PLATFORM,
  SOCIAL_SHOWN_PER_BUSINESS,
  SOCIAL_STATUSES,
  SOCIAL_STATUS_IDS,
  SOCIAL_TEXT_SHOWN,
  actionWords,
  bestPageOf,
  engageBackOf,
  isCompactAction,
  socialActionOf,
  socialBoost,
  socialHistoryOf,
  socialReason,
  socialWords,
  statusOf,
  statusWords,
  verificationOf,
} from '../../../lib/outreach/prospects/social.js'
import { factsOf, scoreOf } from '../../../lib/outreach/prospects/callScore.js'
import { reasonsFor } from '../../../lib/outreach/prospects/callList.js'
import { isCallable } from '../../../lib/outreach/prospects/calls.js'
import { loadSnapshot } from '../../db/db-constraints.js'
import { list } from '../../../api/calls-admin.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = path => readFileSync(join(ROOT, path), 'utf8')

/** The afternoon every fixture happens on, and the moment the list is read at. */
const NOW = new Date('2026-11-05T22:00:00Z')

/** An afternoon in Texas that is already tomorrow everywhere east of it. */
const EVENING = '2026-11-06T03:30:00Z'

// ── The schema and this code agree ────────────────────────────────────────

// The values the table takes are the database's own answer, and the words this
// module knows are its own list. Nothing makes them agree except a check that
// reads both: a routine writing `like` where the column takes `reaction` fails
// every insert, and a module that has never heard of a value the column takes
// drops every row carrying it without a word.
const snapshot = loadSnapshot()
const allows = column => snapshot.columns.get(`outreach_social_actions.${column}`)?.allows ?? null

const agrees = (column, mine, what) =>
  check(`the ${what} this code knows are the ones the column takes`, () => {
    const live = allows(column)
    ok(live, `outreach_social_actions.${column} is not in the constraint snapshot`)
    same([...live].sort().join(','), [...mine].sort().join(','), what)
  })

agrees('action_type', SOCIAL_ACTION_IDS, 'actions')
agrees('status', SOCIAL_STATUS_IDS, 'statuses')
agrees('interest', SOCIAL_INTEREST_IDS, 'interest bands')
agrees('direction', SOCIAL_DIRECTIONS, 'directions')
agrees('platform', [SOCIAL_PLATFORM], 'platforms')

check('the Page standings this code knows are the ones that column takes', () => {
  const live = snapshot.columns.get('outreach_prospect_facebook_pages.verification')?.allows
  ok(live, 'outreach_prospect_facebook_pages.verification is not in the constraint snapshot')
  same([...live].sort().join(','), [...PAGE_VERIFICATION_IDS].sort().join(','), 'standings')
})

check('only one Page standing is the console saying this is them', () => {
  const confirmed = PAGE_VERIFICATIONS.filter(one => one.confirmed).map(one => one.id)
  same(confirmed.join(','), 'verified', 'the standings drawn as confirmed')
})

check('the band an unread inbound row falls back to is the lowest there is', () => {
  const lowest = [...SOCIAL_INTERESTS].sort((one, two) => one.rank - two.rank)[0]
  same(SOCIAL_INTEREST_FLOOR, lowest.id, 'the floor')
})

check('asking about a website is worth more than any other lift on the list', () => {
  const [strongest] = SOCIAL_INTERESTS
  same(strongest.id, 'purchase', 'the strongest band')
  ok(strongest.boost > 1.5, `purchase is ${strongest.boost}, no more than a new company's 1.5`)
  for (const band of SOCIAL_INTERESTS) ok(band.boost > 1, `${band.id} lifts nothing`)
})

// ── A row, read ───────────────────────────────────────────────────────────

const action = over => ({
  id: 'a1',
  prospect_id: 'fence',
  direction: 'outbound',
  action_type: 'comment',
  status: 'confirmed',
  interest: null,
  acted_at: '2026-11-05T20:05:00Z',
  exact_text: 'Stripping and recoating the iron is a practical option.',
  summary: null,
  reaction_kind: null,
  page_url: 'https://www.facebook.com/examplefence',
  source_url: 'https://www.facebook.com/groups/1/posts/2/',
  group_name: 'Example Small Business',
  notes: null,
  ...over,
})

check('a comment is drawn with the words it was sent in', () => {
  const drawn = socialActionOf(action())
  ok(drawn, 'the comment was not drawn')
  same(drawn.text, action().exact_text, 'the text')
  same(drawn.exact, true, 'read as the exact wording')
  same(actionWords(drawn), 'Commented', 'what it is called')
  same(statusWords(drawn), null, 'a confirmed row says nothing about its status')
})

check('a row that only ever had a summary says so rather than passing it off', () => {
  const drawn = socialActionOf(action({ exact_text: null, summary: 'Asked about the fence strip' }))
  ok(drawn, 'the row was not drawn')
  same(drawn.text, 'Asked about the fence strip', 'the text')
  same(drawn.exact, false, 'read as a summary')
})

check('exact words win over a summary filed beside them', () => {
  const drawn = socialActionOf(action({ summary: 'Said something about fences' }))
  same(drawn.text, action().exact_text, 'the text')
  same(drawn.exact, true, 'read as the exact wording')
})

check('a comment with no comment in it is not drawn at all', () => {
  for (const type of SOCIAL_ACTIONS.filter(one => one.quotes).map(one => one.id)) {
    const drawn = socialActionOf(action({ action_type: type, exact_text: '   ', summary: null }))
    same(drawn, null, `a ${type} with no words`)
  }
})

check('a reaction and a follow need no words', () => {
  for (const type of SOCIAL_ACTIONS.filter(one => one.compact).map(one => one.id)) {
    const drawn = socialActionOf(
      action({ action_type: type, exact_text: null, summary: null, reaction_kind: 'Like' })
    )
    ok(drawn, `a ${type} was not drawn`)
    same(drawn.text, null, `a ${type} quotes nothing`)
    same(isCompactAction(type), true, `a ${type} is drawn compactly`)
  }
})

check('a reaction says which one it was', () => {
  const drawn = socialActionOf(
    action({ action_type: 'reaction', exact_text: null, reaction_kind: 'Like' })
  )
  same(actionWords(drawn), 'Reacted Like', 'what it is called')
})

check('an action nobody here has heard of is refused', () => {
  same(socialActionOf(action({ action_type: 'poke' })), null, 'an unknown action')
  same(socialActionOf(action({ action_type: null })), null, 'no action at all')
})

check('a status nobody here has heard of is refused', () => {
  same(socialActionOf(action({ status: 'probably' })), null, 'an unknown status')
  same(socialActionOf(action({ status: null })), null, 'no status at all')
})

check('a row with no readable time is refused', () => {
  same(socialActionOf(action({ acted_at: 'last Tuesday' })), null, 'an unreadable time')
  same(socialActionOf(action({ acted_at: null })), null, 'no time at all')
})

check('each status that is not done says what it is', () => {
  for (const status of SOCIAL_STATUSES) {
    const drawn = socialActionOf(action({ status: status.id }))
    ok(drawn, `a ${status.id} row was not drawn`)
    if (status.done) same(statusWords(drawn), null, `${status.id} says nothing`)
    else ok(statusWords(drawn), `${status.id} says nothing about itself`)
  }
})

check('a pending comment is drawn, and drawn as pending', () => {
  const held = socialHistoryOf({ actions: [action({ status: 'pending' })], now: NOW })
  same(held.actions.length, 1, 'actions drawn')
  same(held.actions[0].status, 'pending', 'the status')
  same(statusWords(held.actions[0]), statusOf('pending').label, 'what is said about it')
})

check('words longer than a card holds are cut rather than run on', () => {
  const long = 'f'.repeat(SOCIAL_TEXT_SHOWN + 200)
  const drawn = socialActionOf(action({ exact_text: long }))
  same(drawn.text.length, SOCIAL_TEXT_SHOWN, 'the length drawn')
  ok(drawn.text.endsWith('…'), 'the cut is marked')
})

// ── A history ─────────────────────────────────────────────────────────────

const HISTORY = [
  action({ id: 'old', acted_at: '2026-10-01T15:00:00Z', exact_text: 'The oldest thing said' }),
  action({ id: 'new', acted_at: '2026-11-05T20:05:00Z', exact_text: 'The newest thing said' }),
  action({ id: 'mid', acted_at: '2026-10-20T15:00:00Z', exact_text: 'The middle thing said' }),
]

check('a history reads latest first', () => {
  const held = socialHistoryOf({ actions: HISTORY, now: NOW })
  same(
    held.actions.map(one => one.id).join(','),
    'new,mid,old',
    'the order the history is drawn in'
  )
  same(held.latest_at, '2026-11-05T20:05:00Z', 'the latest action')
})

check('a company with nothing on file draws nothing', () => {
  same(socialHistoryOf({ actions: [], pages: [], now: NOW }), null, 'an empty history')
  same(socialHistoryOf({ now: NOW }), null, 'nothing read at all')
})

check('a history of nothing but unreadable rows draws nothing', () => {
  const held = socialHistoryOf({
    actions: [action({ action_type: 'poke' }), action({ exact_text: null, summary: null })],
    now: NOW,
  })
  same(held, null, 'a history of rows that cannot be read')
})

check('a Page on file with nothing done yet is still worth drawing', () => {
  const held = socialHistoryOf({
    actions: [],
    pages: [{ page_url: 'https://www.facebook.com/examplefence', verification: 'source_linked' }],
    now: NOW,
  })
  ok(held, 'the Page was not drawn')
  same(held.actions.length, 0, 'actions drawn')
  same(held.page.confirmed, false, 'drawn as a confirmed identity')
})

check('a long history is cut at the oldest end', () => {
  const many = Array.from({ length: SOCIAL_SHOWN_PER_BUSINESS + 10 }, (ignored, at) =>
    action({
      id: `a${at}`,
      acted_at: new Date(Date.parse('2026-01-01T12:00:00Z') + at * 86_400_000).toISOString(),
      exact_text: `Thing ${at} said`,
    })
  )
  const held = socialHistoryOf({ actions: many, now: NOW })
  same(held.actions.length, SOCIAL_SHOWN_PER_BUSINESS, 'actions drawn')
  same(held.actions[0].id, `a${many.length - 1}`, 'the newest is kept')
})

check('a history says what it comes to in a few words', () => {
  const words = socialWords(socialHistoryOf({ actions: HISTORY, now: NOW }))
  same(words, '3 comments', 'three comments')
  const mixed = socialHistoryOf({
    actions: [
      action({ id: 'c' }),
      action({ id: 'f', action_type: 'follow', exact_text: null, reaction_kind: null }),
      action({ id: 'r', action_type: 'reaction', exact_text: null, reaction_kind: 'Like' }),
    ],
    now: NOW,
  })
  same(socialWords(mixed), '1 comment, 1 reaction and a follow', 'a mixed history')
  same(socialWords(null), null, 'nothing on file')
})

// ── The Page a company is ─────────────────────────────────────────────────

const page = over => ({
  prospect_id: 'fence',
  page_url: 'https://www.facebook.com/examplefence',
  page_id: null,
  page_name: null,
  verification: 'source_linked',
  verified_at: null,
  found_at_url: 'https://examplefence.example/',
  notes: null,
  created_at: '2026-11-05T14:00:00Z',
  ...over,
})

check('a link off their own website never reads as their Page', () => {
  const drawn = bestPageOf([page()])
  same(drawn.verification, 'source_linked', 'the standing')
  same(drawn.confirmed, false, 'drawn as confirmed')
  ok(verificationOf('source_linked').words.length > 0, 'the standing has words of its own')
})

check('a Page somebody checked reads as theirs, with the day it was checked', () => {
  const drawn = bestPageOf([
    page(),
    page({
      page_url: 'https://www.facebook.com/examplefenceco',
      verification: 'verified',
      verified_at: '2026-11-05T16:00:00Z',
    }),
  ])
  same(drawn.verification, 'verified', 'the standing')
  same(drawn.confirmed, true, 'drawn as theirs')
  same(drawn.verified_at, '2026-11-05T16:00:00Z', 'the day it was checked')
})

check('a Page on hold is drawn as a doubt rather than as them', () => {
  const drawn = bestPageOf([page({ verification: 'hold', notes: 'A different name' })])
  same(drawn.confirmed, false, 'drawn as theirs')
  same(drawn.notes, 'A different name', 'the doubt itself')
})

check('a standing nobody here has heard of is not a standing', () => {
  same(bestPageOf([page({ verification: 'probably' })]), null, 'an unknown standing')
  same(bestPageOf([page({ page_url: '  ' })]), null, 'a Page with no address')
  same(bestPageOf([]), null, 'no Page at all')
})

// ── What answering back is worth ──────────────────────────────────────────

const inbound = over =>
  action({
    direction: 'inbound',
    action_type: 'reply',
    interest: 'courtesy',
    exact_text: 'Thanks for the kind words.',
    ...over,
  })

check("the studio's own comments and follows are worth nothing", () => {
  const ours = [action(), action({ id: 'f', action_type: 'follow', exact_text: null })]
  same(engageBackOf(ours, NOW), null, 'what the studio did on its own')
  same(socialBoost({ engaged_back: engageBackOf(ours, NOW) }), 1, 'the lift')
})

check('a company that asked about a website is worth the most', () => {
  const back = engageBackOf([inbound({ interest: 'purchase' })], NOW)
  same(back.interest, 'purchase', 'the band')
  same(back.boost, 2, 'the lift')
  same(socialReason(back), 'Asked about a website on Facebook', 'the reason given')
})

check('a company that talked about their site is worth less than one that asked to buy', () => {
  const talk = engageBackOf([inbound({ interest: 'conversation' })], NOW)
  const buy = engageBackOf([inbound({ interest: 'purchase' })], NOW)
  ok(talk.boost < buy.boost, `a conversation is ${talk.boost} against a purchase's ${buy.boost}`)
  same(socialReason(talk), 'Wrote back about their site on Facebook', 'the reason given')
})

check('a reaction and a follow back are worth least, and say which they were', () => {
  const liked = engageBackOf(
    [inbound({ action_type: 'reaction', interest: 'courtesy', exact_text: null })],
    NOW
  )
  same(liked.boost, 1.25, 'the lift')
  same(socialReason(liked), 'Reacted to your post on Facebook', 'the reason given')
  const followed = engageBackOf(
    [inbound({ action_type: 'follow', interest: 'courtesy', exact_text: null })],
    NOW
  )
  same(socialReason(followed), 'Followed you back on Facebook', 'the reason given')
})

check('the strongest move counts, and counts once', () => {
  const back = engageBackOf(
    [
      inbound({ id: 'l1', action_type: 'reaction', exact_text: null }),
      inbound({ id: 'l2', action_type: 'reaction', exact_text: null }),
      inbound({ id: 'l3', action_type: 'reaction', exact_text: null }),
      inbound({ id: 'ask', interest: 'purchase', exact_text: 'What would a site cost?' }),
    ],
    NOW
  )
  same(back.interest, 'purchase', 'the band')
  same(back.boost, 2, 'the lift')
  same(back.actions, 4, 'how many moves it was read off')
})

check('a run of likes is one courtesy rather than a conversation', () => {
  const many = Array.from({ length: 20 }, (ignored, at) =>
    inbound({ id: `l${at}`, action_type: 'reaction', exact_text: null })
  )
  const back = engageBackOf(many, NOW)
  same(back.boost, 1.25, 'the lift twenty likes come to')
})

check('a move from before the window has stopped lifting anything', () => {
  const old = new Date(NOW.getTime() - (SOCIAL_LOOKBACK_DAYS + 1) * 86_400_000).toISOString()
  same(engageBackOf([inbound({ acted_at: old })], NOW), null, 'a move older than the window')
  const just = new Date(NOW.getTime() - (SOCIAL_LOOKBACK_DAYS - 1) * 86_400_000).toISOString()
  ok(engageBackOf([inbound({ acted_at: just })], NOW), 'a move inside the window')
})

check('a move that did not go through lifts nothing', () => {
  for (const status of ['pending', 'attempted', 'failed']) {
    same(engageBackOf([inbound({ status })], NOW), null, `an inbound row at ${status}`)
  }
})

check('an inbound row with no band read off it is read as the least', () => {
  const back = engageBackOf([inbound({ interest: null })], NOW)
  same(back.interest, SOCIAL_INTEREST_FLOOR, 'the band')
  same(back.boost, 1.25, 'the lift')
  const odd = engageBackOf([inbound({ interest: 'enormous' })], NOW)
  same(odd.interest, SOCIAL_INTEREST_FLOOR, 'the band an unknown reading comes to')
})

// ── The lift inside the score ─────────────────────────────────────────────

const TRADES = [{ trade: 'fencing contractor', solo_share: '0.7', avg_sales: '400000' }]
const LISTINGS = Array.from({ length: 30 }, (ignored, at) => ({
  id: `l${at}`,
  trade: 'fencing contractor',
  site_kind: at < 15 ? 'own' : 'none',
  website: at < 15 ? `https://fence${at}.example` : null,
  phone: `(281) 555-${String(1000 + at)}`,
  name: `Fence ${at}`,
  town: 'Baytown',
  address: `${at} Main St, Baytown, TX 77520`,
  source: 'map',
}))
const FACTS = factsOf({ metrics: TRADES, listings: LISTINGS, calls: [] })

const scored = over => ({
  id: 'fence',
  name: 'Example Fence',
  phone: '(281) 555-0100',
  town: 'Baytown',
  address: '1 Main St, Baytown, TX 77520',
  trade: 'fencing contractor',
  site_kind: 'none',
  website: null,
  stage: 'found',
  source: 'map',
  rating: 4.8,
  rating_count: 31,
  business_status: 'OPERATIONAL',
  ...over,
})

check('answering back lifts the total by exactly what the band is worth', () => {
  const plain = scoreOf(scored(), FACTS, NOW)
  for (const band of SOCIAL_INTERESTS) {
    const lifted = scoreOf(
      scored({ engaged_back: { interest: band.id, boost: band.boost } }),
      FACTS,
      NOW
    )
    same(lifted.engagedBack, band.id, `the band on the score for ${band.id}`)
    same(
      Math.round(lifted.total * 10) / 10,
      Math.round(plain.total * band.boost * 10) / 10,
      `the total lifted by ${band.id}`
    )
  }
})

check('the three readings themselves are untouched by a Facebook answer', () => {
  const plain = scoreOf(scored(), FACTS, NOW)
  const lifted = scoreOf(scored({ engaged_back: { interest: 'purchase', boost: 2 } }), FACTS, NOW)
  same(lifted.owner, plain.owner, 'Owner')
  same(lifted.need, plain.need, 'Need')
  same(lifted.budget, plain.budget, 'Budget')
})

check('a business that cannot pay does not pass one that can on a Facebook answer alone', () => {
  const poor = factsOf({
    metrics: [
      { trade: 'fencing contractor', solo_share: '0.7', avg_sales: '40000' },
      { trade: 'builder', solo_share: '0.7', avg_sales: '4000000' },
    ],
    listings: LISTINGS,
    calls: [],
  })
  const liked = scoreOf(scored({ engaged_back: { interest: 'courtesy', boost: 1.25 } }), poor, NOW)
  const richer = scoreOf(scored({ id: 'build', trade: 'builder' }), poor, NOW)
  ok(
    richer.total > liked.total,
    `a like carried the poorer trade to ${liked.total} past ${richer.total}`
  )
})

check('nothing a company does on Facebook puts it on a list it is off', () => {
  const back = { engaged_back: { interest: 'purchase', boost: 2 } }
  for (const over of [
    { stage: 'unsubscribed' },
    { stage: 'skipped' },
    { business_status: 'CLOSED_PERMANENTLY' },
    { phone: null },
    { site_kind: 'own', website: 'https://examplefence.example' },
  ]) {
    same(
      isCallable(scored({ ...over, ...back })),
      false,
      `a business at ${JSON.stringify(over)} with a purchase answer`
    )
  }
})

check('the reason line says why the place was lifted, after the mail', () => {
  const back = engageBackOf([inbound({ interest: 'purchase' })], NOW)
  const row = scored({ engaged_back: back })
  const said = reasonsFor({ ...row, score: scoreOf(row, FACTS, NOW) })
  ok(said.includes('Asked about a website on Facebook'), `the reasons read ${said.join(' · ')}`)
  const answered = reasonsFor({
    ...row,
    engaged: {
      opens: 4,
      replied_at: null,
      last_open_at: '2026-11-04T15:00:00Z',
      at: '2026-11-04T15:00:00Z',
    },
    score: scoreOf(row, FACTS, NOW),
  })
  ok(
    answered.indexOf('Asked about a website on Facebook') > 0,
    `the mail did not lead the reasons: ${answered.join(' · ')}`
  )
})

check('a business that has not answered on Facebook says nothing about it', () => {
  const row = scored()
  const said = reasonsFor({ ...row, score: scoreOf(row, FACTS, NOW) })
  ok(
    !said.some(one => /facebook/i.test(one)),
    `the reasons mention Facebook anyway: ${said.join(' · ')}`
  )
  same(socialReason(null), null, 'no answer at all')
  same(socialReason({ interest: 'enormous' }), null, 'a band nobody here knows')
})

// ── Every date on it is a Central one ─────────────────────────────────────

// The history is made in Texas and read in Texas. Rendered in whatever zone
// the browser is set to, an afternoon comment lands on the following day and a
// clock reads hours out, and nothing on the card says which of the two a
// reader is looking at. So the same instant is rendered from three zones and
// the three answers have to be one answer.
const ELSEWHERE = ['UTC', 'Australia/Sydney', 'America/New_York']

const renderedIn = (zone, source) =>
  execFileSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: ROOT,
    env: { ...process.env, TZ: zone },
    encoding: 'utf8',
  }).trim()

// The page draws a day with `onDay` and a time with `clock`, both of them
// `formatInstant` with these fields, which is the one place the zone is named.
const DAY = `import { formatInstant } from './lib/time/zone.js'
  console.log(formatInstant('${EVENING}', { month: 'short', day: 'numeric', year: 'numeric' }))`
const CLOCK = `import { formatInstant } from './lib/time/zone.js'
  console.log(formatInstant('${EVENING}', { hour: 'numeric', minute: '2-digit' }))`

check('the day an action is drawn on reads the same from any zone', () => {
  const drawn = ELSEWHERE.map(zone => renderedIn(zone, DAY))
  same(new Set(drawn).size, 1, `the day read ${drawn.join(' / ')}`)
  same(drawn[0], 'Nov 5, 2026', 'the Central day a 9:30 PM Texas action falls on')
})

check('the time an action is drawn at reads the same from any zone', () => {
  const drawn = ELSEWHERE.map(zone => renderedIn(zone, CLOCK))
  same(new Set(drawn).size, 1, `the time read ${drawn.join(' / ')}`)
  same(drawn[0], '9:30 PM', 'the Central clock a 03:30 UTC action was made at')
})

check('the Facebook section names no zone of its own', () => {
  const source = read('src/app/views/console/pages/calls/CallListPage.jsx')
  const section = source.slice(
    source.indexOf('function SocialPage'),
    source.indexOf('function History')
  )
  ok(section.length > 0, 'the Facebook section is not in the page')
  ok(!/toLocale(?:Date|Time)?String/.test(section), 'it renders a date of its own')
  ok(/onDay\(/.test(section) && /clock\(/.test(section), 'it does not draw a day and a clock')
})

// ── The endpoint, against a database in memory ───────────────────────────

/** A list written the way PostgREST takes one: `(a,b)`. */
const listOf = value =>
  String(value)
    .replace(/^\(|\)$/g, '')
    .split(',')

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

/** One `column.operator.value` term, as a test of a row. */
function termTest(term) {
  const [column, operator, ...rest] = term.split('.')
  const value = rest.join('.')
  if (operator === 'eq') return one => String(one[column]) === value
  if (operator === 'in') return one => listOf(value).includes(String(one[column]))
  throw new Error(`the stand-in database does not read ${term}`)
}

/**
 * Enough of the Supabase client for the endpoint: the rows held, filtered,
 * ordered and ranged the way PostgREST does it. `absent` names tables this
 * database does not have, which is what a deployment standing ahead of its
 * migration reads like.
 */
function database(tables, { absent = [] } = {}) {
  const from = table => {
    const filters = []
    let columns = '*'
    let head = false
    let order = null
    let cut = null
    let limit = null
    let single = false
    const builder = {
      select(wanted = '*', options = {}) {
        columns = wanted
        head = Boolean(options.head)
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
        if (operator === 'is')
          filters.push(one => one[column] !== null && one[column] !== undefined)
        else if (operator === 'in')
          filters.push(one => !listOf(value).includes(String(one[column])))
        else throw new Error(`the stand-in database does not read not.${operator}`)
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
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject)
      },
    }
    const run = () => {
      if (absent.includes(table)) {
        return {
          data: null,
          error: { code: '42P01', message: `relation "public.${table}" does not exist` },
        }
      }
      let rows = (tables[table] ?? []).filter(one => filters.every(test => test(one)))
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
          const business = (tables.outreach_prospects ?? []).find(
            one => one.id === call.prospect_id
          )
          return { ...call, outreach_prospects: { phone: business?.phone, trade: business?.trade } }
        })
      }
      return single ? { data: rows[0] ?? null, error: null } : { data: rows, error: null, count }
    }
    return builder
  }
  return { from }
}

/** A business on the table, callable unless the case says otherwise. */
const business = (id, over = {}) => scored({ id, name: id, phone: '(281) 555-0100', ...over })

/** A Facebook action on the table. */
const logged = (id, prospect, over = {}) => action({ id, prospect_id: prospect, ...over })

/** The table the endpoint is driven against. */
const table = () => ({
  outreach_prospects: [
    business('fence', { phone: '(281) 555-0101' }),
    business('roof', { phone: '(281) 555-0102', trade: 'roofing contractor' }),
    business('quiet', { phone: '(281) 555-0103', trade: 'fencing contractor' }),
  ],
  outreach_calls: [],
  outreach_messages: [],
  preview_sessions: [],
  preview_events: [],
  new_business_leads: [],
  leads: [],
  call_trade_metrics: [
    { trade: 'fencing contractor', solo_share: '0.948', avg_sales: '64509' },
    { trade: 'roofing contractor', solo_share: '0.89', avg_sales: '78780' },
  ],
  outreach_social_actions: [
    logged('f-old', 'fence', {
      acted_at: '2026-10-01T15:00:00Z',
      exact_text: 'The oldest thing said to the fence company',
    }),
    logged('f-new', 'fence', {
      acted_at: '2026-11-05T20:05:00Z',
      exact_text: 'The newest thing said to the fence company',
    }),
    logged('f-pending', 'fence', {
      acted_at: '2026-11-05T20:21:00Z',
      status: 'pending',
      exact_text: 'A comment waiting on a group admin',
    }),
    logged('f-like', 'fence', {
      acted_at: '2026-11-05T20:20:00Z',
      action_type: 'reaction',
      exact_text: null,
      reaction_kind: 'Like',
    }),
    logged('r-ask', 'roof', {
      acted_at: '2026-11-04T16:00:00Z',
      direction: 'inbound',
      action_type: 'reply',
      interest: 'purchase',
      exact_text: 'What would a new site cost us?',
    }),
  ],
  outreach_prospect_facebook_pages: [
    {
      prospect_id: 'fence',
      page_url: 'https://www.facebook.com/examplefence',
      page_id: null,
      page_name: null,
      verification: 'source_linked',
      verified_at: null,
      found_at_url: 'https://examplefence.example/',
      notes: null,
      created_at: '2026-11-05T14:00:00Z',
    },
  ],
})

/** The list as the endpoint answers it, by business. */
async function offered(over = {}, options = {}) {
  const answer = await list(database({ ...table(), ...over }, options), {}, NOW)
  same(answer.status, 200, 'the list answered')
  const rows = [
    ...answer.body.engaged,
    ...answer.body.due,
    ...answer.body.rows,
    ...answer.body.waiting,
  ]
  return { answer, rows, by: new Map(rows.map(row => [row.id, row])) }
}

check('a business carries its own Facebook history, latest first', async () => {
  const { by } = await offered()
  const held = by.get('fence')
  ok(held, 'the fence company is not on the list')
  ok(held.social, 'it carries no history')
  same(
    held.social.actions.map(one => one.id).join(','),
    'f-pending,f-like,f-new,f-old',
    'the order the history is drawn in'
  )
  same(held.social.actions[2].text, 'The newest thing said to the fence company', 'the words')
})

check('a pending comment is drawn beside the confirmed ones, marked', async () => {
  const { by } = await offered()
  const held = by.get('fence').social.actions
  same(held.find(one => one.id === 'f-pending').status, 'pending', 'the pending comment')
  same(held.find(one => one.id === 'f-new').status, 'confirmed', 'the confirmed comment')
})

check('a reaction comes through with nothing to quote', async () => {
  const { by } = await offered()
  const like = by.get('fence').social.actions.find(one => one.id === 'f-like')
  same(like.text, null, 'a reaction quotes nothing')
  same(like.reaction_kind, 'Like', 'which reaction it was')
  same(isCompactAction(like.action_type), true, 'drawn compactly')
})

check('one business never carries another business a row', async () => {
  const { by } = await offered()
  for (const [id, row] of by) {
    for (const one of row.social?.actions ?? []) {
      ok(
        (id === 'fence' && one.id.startsWith('f-')) || (id === 'roof' && one.id.startsWith('r-')),
        `${id} was drawn ${one.id}`
      )
    }
  }
  same(by.get('roof').social.actions.length, 1, "the roofer's own history")
})

check('a business with nothing on Facebook carries nothing', async () => {
  const { by } = await offered()
  same(by.get('quiet').social, null, 'a business with no rows')
})

check('the Page a company was linked to comes through unverified', async () => {
  const { by } = await offered()
  const linked = by.get('fence').social.page
  ok(linked, 'no Page came through')
  same(linked.url, 'https://www.facebook.com/examplefence', 'the Page')
  same(linked.confirmed, false, 'drawn as their own Page')
  same(by.get('roof').social.page, null, 'a company with no Page on file')
})

check('a company that asked about a website comes up the list, and says why', async () => {
  const { by } = await offered()
  const asked = by.get('roof')
  ok(asked.engaged_back, 'the answer did not reach the row')
  same(asked.engaged_back.interest, 'purchase', 'the band')
  ok(
    asked.reasons.includes('Asked about a website on Facebook'),
    `the reasons read ${asked.reasons.join(' · ')}`
  )
})

check('the lift is in the order the list is offered in', async () => {
  const plain = await offered({ outreach_social_actions: [] })
  const lifted = await offered()
  const place = (held, id) => held.answer.body.rows.findIndex(row => row.id === id)
  const was = plain.answer.body.rows.map(row => row.id)
  ok(was.length >= 2, `the list offered ${was.length} businesses`)
  ok(
    lifted.by.get('roof').score.total > plain.by.get('roof').score.total,
    'the answer did not lift the score'
  )
  ok(place(lifted, 'roof') <= place(plain, 'roof'), 'the answer did not move it up the order')
})

check("the studio's own comments move nothing", async () => {
  const plain = await offered({ outreach_social_actions: [] })
  const { by } = await offered()
  const talked = by.get('fence')
  same(talked.engaged_back, null, 'a company the studio only talked at')
  ok(talked.social.actions.length > 0, 'the history did not come through')
  same(
    talked.score.total,
    plain.by.get('fence').score.total,
    'the total of a company the studio only talked at'
  )
})

check('a business that asked to stop is not carried back on by an answer', async () => {
  const { by } = await offered({
    outreach_prospects: [
      business('fence', { phone: '(281) 555-0101' }),
      business('roof', {
        phone: '(281) 555-0102',
        trade: 'roofing contractor',
        stage: 'unsubscribed',
      }),
    ],
  })
  same(by.has('roof'), false, 'the business that asked to stop was offered anyway')
})

check('the list still answers where the social tables are not in the database', async () => {
  const { answer, by } = await offered(
    {},
    { absent: ['outreach_social_actions', 'outreach_prospect_facebook_pages'] }
  )
  same(answer.status, 200, 'the list answered')
  ok(by.size > 0, 'the list came back empty')
  for (const [id, row] of by) same(row.social, null, `${id} drew a history anyway`)
})

// ── What the page and the hook do with it ────────────────────────────────

check('the page draws the history through the one module that reads it', () => {
  const source = read('src/app/views/console/pages/calls/CallListPage.jsx')
  ok(
    /from '@lib\/outreach\/prospects\/social\.js'/.test(source),
    'the page does not read the history through social.js'
  )
  ok(/row\.social && <Social/.test(source), 'the page draws no Facebook section')
  ok(/facebookLine\(row\.social\)/.test(source), 'the list row says nothing about Facebook')
})

check('the hook carries the history to the page', () => {
  const source = read('src/app/hooks/console/useCallList.js')
  ok(/social: row\?\.social \?\? null/.test(source), 'the hook drops the history')
})

check('nothing in the console writes to either social table', () => {
  for (const path of [
    'src/app/views/console/pages/calls/CallListPage.jsx',
    'src/app/hooks/console/useCallList.js',
    'api/calls-admin.js',
  ]) {
    const source = read(path)
    for (const write of ['insert', 'update', 'upsert', 'delete']) {
      const near = new RegExp(
        `(SOCIAL|FACEBOOK_PAGES|outreach_social_actions|outreach_prospect_facebook_pages)[\\s\\S]{0,120}\\.${write}\\(`
      )
      ok(!near.test(source), `${path} ${write}s one of the social tables`)
    }
  }
})

await finish({ hint: 'The Facebook history is drawn as it happened, or not at all.' })

console.log(`call list social: ${cases.length} checks passed`)
