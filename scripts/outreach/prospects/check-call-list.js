/**
 * Proves the call list rings the right businesses, in the right order, and
 * never rings the one it must not.
 *
 * Three failures are possible here and all three are silent.
 *
 * The first is the serious one. A business that asked for no further contact
 * is unsubscribed, and that ask was about hearing from the studio rather than
 * about email specifically. The call list reads a different table of the same
 * rows through a different endpoint, so nothing the sender does protects it: a
 * rule dropped here and somebody rings a person who has already said stop, and
 * the only place that shows up is on the phone. The same goes for a row a
 * person skipped by hand on the outreach board, which the list would otherwise
 * quietly put back.
 *
 * The second is the ordering, which is a number nothing stores and nothing
 * displays. It exists for the length of one sort and is gone, so an axis that
 * ranks the wrong business first fails without leaving a mark - the list is
 * full, the calls get made, and the only thing that changed is who was rung
 * first. The reading it leans on is the review count measured against the
 * middle count for the same trade, and the failure to catch is the one where
 * that measurement collapses back into the raw count: sixty restaurants at the
 * top and every trade that collects reviews slowly buried under them. That
 * looks exactly like the ranking working.
 *
 * The third is the drift `check-db-values.js` exists for, which cannot see
 * this one. The outcomes are built as objects and the ids are read off them at
 * run time rather than written as literals into a call, so the scan that holds
 * every write to its column counts them as dynamic and passes. The column and
 * the dropdown are compared here instead, against the schema's own snapshot.
 *
 *   npm run check:call-list
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ATTEMPT_HOURS,
  BUSY_FLOOR,
  CALLBACK_DEFAULT_HOURS,
  CALL_OUTCOMES,
  OUTCOME_FLOOR_HOURS,
  OUTCOME_IDS,
  PLACES,
  PROMISE_KEEPS_DAYS,
  PULLS,
  QUIET_CEILING,
  SCORE_PEAK,
  SCORE_WEIGHTS,
  TRADE_FLOOR,
  TRACKS,
  byCallOrder,
  callMakesLead,
  callPlace,
  callRank,
  countAtBand,
  defaultCallbackAt,
  dialHref,
  isCallable,
  matchesControls,
  interestIn,
  medianOf,
  outcomeAsksInterest,
  outcomeEnds,
  outcomeTakesCallback,
  placeCalls,
  presenceOf,
  promiseOf,
  pullBand,
  pullOf,
  readyAt,
  scoreOf,
  tellingTerms,
  triesRun,
  uncallableReason,
  waitAfter,
  whyListed,
} from '../../../lib/outreach/prospects/calls.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')

const cases = []
const check = (name, run) => cases.push([name, run])

const same = (got, want, what) => {
  if (got !== want)
    throw new Error(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`)
}

const ok = (condition, what) => {
  if (!condition) throw new Error(what)
}

/** A row the way the table carries one, callable unless the case says otherwise. */
const row = over => ({
  id: 'p1',
  name: 'Channelview Barbers',
  phone: '(281) 862-9968',
  website: null,
  site_kind: 'none',
  stage: 'unreachable',
  trade: 'barber shop',
  town: 'Channelview',
  rating_count: 40,
  business_status: 'OPERATIONAL',
  ...over,
})

/** A row as the endpoint hands it to the sort: the listing plus its reading. */
const listed = over => ({
  ...row(),
  pull: 'steady',
  score: 40,
  calls: [],
  callback_at: null,
  ...over,
})

/** A call as the table holds one. */
const call = over => ({
  id: 'c1',
  outcome: 'no_answer',
  note: null,
  callback_at: null,
  called_at: '2026-09-01T15:00:00.000Z',
  ...over,
})

// ── Who is on the list ──────────────────────────────────────────────────

check('a business with no site and a number is on the list', () => {
  same(uncallableReason(row()), null, 'a plain callable row')
  ok(isCallable(row()), 'the plainest row on the list is not callable')
})

check('a listing pointing at a platform is on the list too', () => {
  const facebook = row({ site_kind: 'social', website: 'https://www.facebook.com/mikes' })
  ok(isCallable(facebook), 'a business whose only presence is a Facebook page is not callable')
})

check('a business that asked for no further contact is never rung', () => {
  const gone = row({ stage: 'unsubscribed' })
  ok(!isCallable(gone), 'an unsubscribed business reached the call list')
  same(
    uncallableReason(gone),
    'the business asked for no further contact',
    'why an unsubscribed business is off the list'
  )
})

check('a business somebody skipped by hand stays skipped', () => {
  ok(!isCallable(row({ stage: 'skipped' })), 'a skipped business reached the call list')
})

check('a business already in conversation is a lead rather than a number', () => {
  ok(!isCallable(row({ stage: 'replied' })), 'a business that replied reached the call list')
})

check('a business with a site of its own belongs to the sender', () => {
  const own = row({ site_kind: 'own', website: 'https://baytownplumbing.com' })
  ok(!isCallable(own), 'a business the sender can write to reached the call list')
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
})

check('a listing whose status was never read is still rung', () => {
  // A third of the table was written by a sweep that did not ask for the
  // field. Reading that absence as a closure would empty the list of every
  // row the pipeline knows least about.
  ok(isCallable(row({ business_status: null })), 'an unread status was read as a closure')
})

check('every stage the sender leaves a business at is callable', () => {
  for (const stage of ['found', 'enriched', 'audited', 'unreachable', 'contacted', 'bounced']) {
    ok(isCallable(row({ stage })), `a business at ${stage} is not callable`)
  }
})

// ── The number itself ───────────────────────────────────────────────────

check('a number formatted for a person is flattened for a dialer', () => {
  same(dialHref('(281) 862-9968'), 'tel:2818629968', 'a formatted number')
  same(dialHref('+1 281-862-9968'), 'tel:+12818629968', 'a number carrying its country')
  same(dialHref(''), null, 'no number at all')
  same(dialHref(null), null, 'a null number')
})

// ── What the trade says ─────────────────────────────────────────────────

check('the middle of a list is its middle, at either length', () => {
  same(medianOf([1, 2, 3]), 2, 'an odd list')
  same(medianOf([1, 2, 3, 4]), 2.5, 'an even list')
  same(medianOf([]), null, 'an empty list')
  same(medianOf([null, undefined, 'x']), null, 'a list of nothing readable')
})

check('a count is read against its own trade rather than against every trade', () => {
  // The failure this exists to catch. A barber shop with 200 reviews is
  // exceptional; a restaurant with 400 is ordinary. Ranked on the raw count
  // the restaurant leads, and every trade that collects reviews slowly is
  // buried under the ones that collect them fast.
  const barber = row({ trade: 'barber shop', rating_count: 200 })
  const diner = row({ trade: 'restaurant', rating_count: 400 })
  const barberPull = pullOf(barber, 45)
  const dinerPull = pullOf(diner, 380)
  ok(barberPull > dinerPull, 'the raw count outranked the reading against the trade')
  same(pullBand(barber, 45), 'busy', 'a barber shop well ahead of its trade')
  same(pullBand(diner, 380), 'steady', 'a diner in the middle of its trade')
})

check('the three readings are cut where they say they are', () => {
  // Cut on the smoothed ratio, so the count that reaches a boundary is not the
  // boundary times the middle. Asserting the unsmoothed product instead is how
  // a check passes while the prior it was written for has quietly been
  // dropped, which would put the raw count back in charge of the page.
  same(
    pullBand(row({ rating_count: countAtBand(BUSY_FLOOR, 40) }), 40),
    'busy',
    'exactly at the busy floor'
  )
  same(
    pullBand(row({ rating_count: countAtBand(QUIET_CEILING, 40) }), 40),
    'quiet',
    'exactly at the quiet ceiling'
  )
  same(pullBand(row({ rating_count: 40 }), 40), 'steady', 'exactly the middle of its trade')
})

check('a handful of reviews in a busy trade is not read as exceptional', () => {
  // The prior is the whole of this. Unsmoothed, a flooring contractor with two
  // reviews in a trade whose middle is one reads twice its trade and lands
  // among the genuinely busy; smoothed it reads a shade under the middle. The
  // noise this removes is the reason the page can be ranked at all.
  same(pullBand(row({ rating_count: 2 }), 1), 'steady', 'two reviews against a middle of one')
  same(pullBand(row({ rating_count: 40 }), 4), 'busy', 'forty reviews against a middle of four')
})

check('a trade with no middle to take reads unread rather than being ranked', () => {
  same(pullBand(row(), null), 'unread', 'a trade under the floor')
  same(pullBand(row({ rating_count: null }), 40), 'unread', 'a listing with no count')
  same(pullOf(row({ rating_count: '40' }), 40), null, 'a count that is not a number')
  ok(TRADE_FLOOR >= 5, 'the trade floor is low enough to be a middle of anything')
})

check('every reading a listing can come to is one of the four named', () => {
  const reached = new Set([
    pullBand(row({ rating_count: 200 }), 40),
    pullBand(row({ rating_count: 40 }), 40),
    pullBand(row({ rating_count: 4 }), 40),
    pullBand(row(), null),
  ])
  same([...reached].sort().join(','), [...PULLS].sort().join(','), 'the readings reached')
})

// ── When it comes back round ────────────────────────────────────────────

const now = new Date('2026-09-06T16:00:00.000Z')

/** An instant so many hours either side of the moment the checks read. */
const off = hours => new Date(now.getTime() + hours * 3_600_000).toISOString()

check('a call takes the business out of the working list, not merely lower', () => {
  // The change the section could not work without. A business rung this
  // morning used to still be on the first page this afternoon, and a list that
  // offers back what was just worked is a list nobody can work down.
  const rung = listed({ calls: [call({ called_at: off(-1) })] })
  same(callPlace(rung, now), 'resting', 'a business rung an hour ago')
  ok(!placeCalls(callPlace(rung, now)), 'a business rung an hour ago was still offered')
})

check('the wait is the outcome, and it lengthens as a number goes unanswered', () => {
  const cold = listed()
  same(waitAfter(cold, 'no_answer'), ATTEMPT_HOURS[0], 'the first unanswered ring')
  same(waitAfter(cold, 'voicemail'), OUTCOME_FLOOR_HOURS.voicemail, 'a voicemail left')
  same(waitAfter(cold, 'gatekeeper'), OUTCOME_FLOOR_HOURS.gatekeeper, 'a receptionist answering')
  same(waitAfter(cold, 'spoke'), OUTCOME_FLOOR_HOURS.spoke, 'the owner heard it')

  const twice = listed({ calls: [call(), call({ id: 'c2' })] })
  same(waitAfter(twice, 'no_answer'), ATTEMPT_HOURS[2], 'the third unanswered ring')
})

check('the ladder counts the run of unanswered rings, not the calls on file', () => {
  // A business somebody has legitimately spoken to five times must not land on
  // the thirty-day rung.
  const talked = listed({
    calls: [call({ outcome: 'spoke' }), call({ id: 'c2' }), call({ id: 'c3' })],
  })
  same(triesRun(talked), 0, 'the run after reaching somebody')
  same(waitAfter(talked, 'no_answer'), ATTEMPT_HOURS[0], 'the first ring after a conversation')
})

check('an ending outcome buys no wait at all, because there is nothing to wait for', () => {
  for (const outcome of ['booked', 'not_interested', 'wrong_number']) {
    same(waitAfter(listed(), outcome), null, `the wait after ${outcome}`)
  }
  same(waitAfter(listed(), 'callback'), null, 'the wait after a call back')
})

check('a time somebody named beats the rest the ladder would have set', () => {
  // The correction a critic found: with a floor on `callback`, a caller told at
  // ten in the morning to ring back at four would find the business resting
  // until tomorrow, which is the list overruling the only person on it who
  // knows anything.
  const promised = listed({
    calls: [call({ outcome: 'callback', called_at: off(-2), callback_at: off(4) })],
  })
  same(readyAt(promised, now).toISOString(), off(4), 'when a promised business comes back')
  same(callPlace(promised, now), 'promised', 'where a promised business sits')
})

check('a promise the caller has passed puts the business at the head of the list', () => {
  const due = listed({
    calls: [call({ outcome: 'callback', called_at: off(-48), callback_at: off(-2) })],
  })
  same(callPlace(due, now), 'due', 'where a passed promise sits')
  ok(placeCalls('due'), 'a business due back was not offered')
})

check('a stale promise stops deciding rather than leading the list forever', () => {
  // The defect this replaced. The endpoint used to lift the newest call that
  // NAMED a time rather than the newest call, so a business promised Friday
  // and then rung Wednesday returned to rank nought every Friday and nothing
  // could clear it.
  const chased = listed({
    calls: [
      call({ id: 'c2', outcome: 'no_answer', called_at: off(-1) }),
      call({ outcome: 'callback', called_at: off(-72), callback_at: off(-24) }),
    ],
  })
  same(callPlace(chased, now), 'resting', 'a business chased after its promise passed')
  same(readyAt(chased, now).toISOString(), off(23), 'the rest the last ring actually bought')
})

check('a promise nobody kept for a fortnight is spent', () => {
  const held = listed({ callback_at: off(-24 * (PROMISE_KEEPS_DAYS - 1)) })
  ok(promiseOf(held, now), 'a promise inside the fortnight was dropped')
  const spent = listed({ callback_at: off(-24 * (PROMISE_KEEPS_DAYS + 1)) })
  same(promiseOf(spent, now), null, 'a promise well past the fortnight still led')
})

check('an ended business never comes back round, whatever else is on it', () => {
  const booked = listed({
    calls: [call({ outcome: 'booked', called_at: off(-1) })],
    callback_at: off(4),
  })
  same(callPlace(booked, now), 'booked', 'where a booked business sits')
  same(readyAt(booked, now), null, 'when a booked business comes back')
  same(callPlace(listed({ calls: [call({ outcome: 'not_interested' })] }), now), 'closed', 'a no')
})

check('exactly three places are work to do now', () => {
  const offered = PLACES.filter(place => place.calls).map(place => place.id)
  same(offered.sort().join(','), 'due,fresh,ready', 'the places the list offers')
})

// ── What it is worth calling ────────────────────────────────────────────

check('the score is built from the terms it shows, and shows every term', () => {
  // The decomposition is the return value rather than something the page works
  // out again, so a row's chips and its scorecard cannot drift apart from the
  // number they explain.
  const { score, raw, terms } = scoreOf(row({ rating_count: 200 }), { median: 40 })
  same(
    terms.reduce((sum, term) => sum + term.points, 0),
    raw,
    'the terms against the raw total'
  )
  same(score, Math.min(SCORE_PEAK, Math.max(0, raw)), 'the score against the raw total')
  same(new Set(terms.map(term => term.id)).size, terms.length, 'two terms sharing an id')
  for (const term of terms) {
    ok(term.label && term.chip, `${term.id} is missing a label or a chip`)
  }
})

check('how the trade reads is the largest thing the score turns on', () => {
  // The failure to catch is the one where the trade reading is quietly demoted
  // under something easier to compute. Everything else about a business is
  // circumstance; how it reads against its own trade is the finding.
  const busy = SCORE_WEIGHTS.trade.busy
  const rest = [
    ...Object.values(SCORE_WEIGHTS.proof),
    ...Object.values(SCORE_WEIGHTS.presence),
    SCORE_WEIGHTS.reached.points,
    Math.abs(SCORE_WEIGHTS.reputation.under),
    Math.abs(SCORE_WEIGHTS.attempts.floor),
  ]
  for (const weight of rest) {
    ok(busy > weight, `a weight of ${weight} met or beat how the trade reads`)
  }
  for (const band of PULLS) {
    ok(SCORE_WEIGHTS.trade[band] > 0, `${band} scores nothing, so its trade decides nothing`)
  }
})

check('a busy listing outscores a middling one in the same trade', () => {
  const busy = scoreOf(row({ rating_count: 200 }), { median: 40 }).score
  const steady = scoreOf(row({ rating_count: 40 }), { median: 40 }).score
  const quiet = scoreOf(row({ rating_count: 4 }), { median: 40 }).score
  ok(busy > steady, 'a busy listing did not outscore a middling one')
  ok(steady > quiet, 'a middling listing did not outscore an unfindable one')
  ok(quiet > 0, 'an unfindable listing scored nothing, which is not what it is worth')
})

check('an unrated listing is not read as a badly rated one', () => {
  // A null rating compared against the floor would fire the subtraction on the
  // third of the table Google never answered for - a reputation problem
  // invented out of an absent field.
  const unread = scoreOf(row({ rating: null, rating_count: 200 }), { median: 40 })
  const reputation = unread.terms.find(term => term.id === 'reputation')
  same(reputation.points, 0, 'what an unrated listing was docked')
  same(reputation.reading, 'unread', 'how an unrated listing reads')

  const poor = scoreOf(row({ rating: 3.1, rating_count: 200 }), { median: 40 })
  same(
    poor.terms.find(term => term.id === 'reputation').points,
    SCORE_WEIGHTS.reputation.under,
    'what a poorly rated listing was docked'
  )
})

check('a good rating earns nothing, because a third of the table is five stars', () => {
  const five = scoreOf(row({ rating: 5, rating_count: 6 }), { median: 40 })
  same(five.terms.find(term => term.id === 'reputation').points, 0, 'what five stars earned')
})

check('rings nobody picked up subtract, and only the ones that reached nobody', () => {
  const cold = scoreOf(row(), { median: 40, calls: [call(), call({ id: 'c2' })] })
  same(
    cold.terms.find(term => term.id === 'attempts').points,
    SCORE_WEIGHTS.attempts.each * 2,
    'two unanswered rings'
  )
  const floored = scoreOf(row(), {
    median: 40,
    calls: Array.from({ length: 9 }, (_, at) => call({ id: `c${at}` })),
  })
  same(
    floored.terms.find(term => term.id === 'attempts').points,
    SCORE_WEIGHTS.attempts.floor,
    'nine unanswered rings against the floor'
  )
  const held = scoreOf(row(), { median: 40, calls: [call({ outcome: 'gatekeeper' })] })
  same(
    held.terms.find(term => term.id === 'attempts').points,
    0,
    'a receptionist answering counted as a failed ring'
  )
})

check('a business somebody has heard scores above one nobody has reached', () => {
  const warm = scoreOf(row(), { median: 40, calls: [call({ outcome: 'spoke' })] })
  same(
    warm.terms.find(term => term.id === 'reached').points,
    SCORE_WEIGHTS.reached.points,
    'a business the owner heard'
  )
  const refused = scoreOf(row(), {
    median: 40,
    calls: [call({ outcome: 'not_interested' }), call({ id: 'c2', outcome: 'spoke' })],
  })
  same(refused.terms.find(term => term.id === 'reached').points, 0, 'a business that said no')
})

check('what it has instead of a site is read from the listing, not guessed', () => {
  same(presenceOf(row()), 'none', 'a listing naming no website')
  same(
    presenceOf(row({ site_kind: 'social', website: 'https://www.booksy.com/en-us/1' })),
    'booking',
    'a booking platform'
  )
  same(
    presenceOf(row({ site_kind: 'social', website: 'https://www.facebook.com/mikes' })),
    'social',
    'a page it does not own'
  )
  same(
    presenceOf(row({ site_kind: 'social', website: 'https://www.yelp.com/biz/mikes' })),
    'portal',
    'a directory somebody else listed it in'
  )
  ok(
    SCORE_WEIGHTS.presence.booking > SCORE_WEIGHTS.presence.social,
    'a business already paying for software did not outrank a Facebook page'
  )
  ok(
    SCORE_WEIGHTS.presence.none > SCORE_WEIGHTS.presence.portal,
    'a directory listing outranked a business with nothing at all'
  )
})

check('a row says why it is on the list, whatever it has instead of a site', () => {
  for (const website of [
    null,
    'https://www.facebook.com/mikes',
    'https://www.booksy.com/en-us/1',
    'https://www.yelp.com/biz/mikes',
  ]) {
    const kind = website ? 'social' : 'none'
    const sentence = whyListed(row({ website, site_kind: kind }))
    ok(sentence && sentence.endsWith('.'), `no sentence for ${website ?? 'no website'}`)
  }
})

check('a row shows its two best reasons and every penalty', () => {
  const { terms } = scoreOf(row({ rating: 2.9, rating_count: 200 }), {
    median: 40,
    calls: [call(), call({ id: 'c2' })],
  })
  const telling = tellingTerms(terms)
  const negatives = terms.filter(term => term.points < 0)
  for (const term of negatives) {
    ok(
      telling.some(one => one.id === term.id),
      `${term.id} subtracted points and was not shown`
    )
  }
  same(telling.filter(term => term.points > 0).length, 2, 'the positives shown')
})

// ── The order to work it in ─────────────────────────────────────────────

check('a callback that has come due leads everything', () => {
  const due = listed({
    score: 10,
    calls: [call({ outcome: 'callback', called_at: off(-48), callback_at: off(-1) })],
  })
  const best = listed({ score: SCORE_PEAK })
  ok(callRank(due, now) < callRank(best, now), 'a due callback did not lead the best score')
})

check('the best score leads everything there is to call', () => {
  const best = listed({ score: 88 })
  const worse = listed({ score: 41 })
  ok(callRank(best, now) < callRank(worse, now), 'a lower score was offered first')
})

check('a number nobody has tried has no standing of its own', () => {
  // The never-called wall is gone deliberately. It held a busy welding shop
  // rung once on Tuesday below an unread notary nobody had tried, and it
  // stranded every ready row a thousand places down where paging would not
  // reach it for months. The attempts term carries that difference now.
  const fresh = listed({ score: 30 })
  const ready = listed({ score: 70, calls: [call({ called_at: off(-72) })] })
  same(callPlace(ready, now), 'ready', 'a business whose gap has run out')
  ok(callRank(ready, now) < callRank(fresh, now), 'a fresh low score outranked a ready high one')
})

check('a business waiting out a gap is behind everything there is to call', () => {
  const resting = listed({ score: SCORE_PEAK, calls: [call({ called_at: off(-1) })] })
  const worst = listed({ score: 0 })
  ok(callRank(worst, now) < callRank(resting, now), 'a resting business jumped the working list')
})

check('among the resting, the one back soonest comes first', () => {
  const soon = listed({ calls: [call({ called_at: off(-20) })], ready_at: off(4) })
  const later = listed({ calls: [call({ called_at: off(-2) })], ready_at: off(22) })
  ok(callRank(soon, now) < callRank(later, now), 'the business back latest was offered first')
})

check('a business off the list sorts behind everything still on it', () => {
  const booked = listed({ score: SCORE_PEAK, calls: [call({ outcome: 'booked' })] })
  const resting = listed({ score: 0, calls: [call({ called_at: off(-1) })] })
  ok(callRank(resting, now) < callRank(booked, now), 'a finished business was offered again')
})

check('two businesses level on rank are separated to the last', () => {
  // Without a total order a page boundary can show one business twice and
  // another not at all, which reads as the list losing rows.
  const order = byCallOrder(now)
  const one = listed({ id: 'a', rating_count: 90, created_at: '2026-01-01T00:00:00.000Z' })
  const two = listed({ id: 'b', rating_count: 40, created_at: '2026-01-01T00:00:00.000Z' })
  ok(order(one, two) < 0, 'the busier listing did not break the tie')

  const older = listed({ id: 'a', rating_count: 40, created_at: '2025-01-01T00:00:00.000Z' })
  ok(order(older, two) < 0, 'the listing that has waited longest did not break the tie')

  const same0 = listed({ id: 'a', rating_count: 40, created_at: '2026-01-01T00:00:00.000Z' })
  const same1 = listed({ id: 'b', rating_count: 40, created_at: '2026-01-01T00:00:00.000Z' })
  ok(order(same0, same1) !== 0, 'two identical listings ordered the same, so the sort is partial')
})

// ── What the controls do and do not hide ────────────────────────────────

check('a business due back survives every control but the search', () => {
  // A promise is the one appointment on the page. A score floor or a town
  // filter quietly hiding one would make the two most useful things on the
  // page cancel each other out.
  const due = listed({ place: 'due', score: 5, pull: 'unread', town: 'Baytown' })
  ok(
    matchesControls(due, {
      state: 'fresh',
      pull: 'busy',
      minScore: 70,
      town: 'Channelview',
      trade: 'welder',
    }),
    'a business due back was hidden by a filter'
  )
  ok(!matchesControls(due, { search: 'nothing like this' }), 'a search did not reach a due row')
})

check('every other control narrows what it says it narrows', () => {
  const ready = listed({ place: 'ready', score: 50, pull: 'steady', town: 'Channelview' })
  ok(matchesControls(ready, {}), 'an unnarrowed list dropped a row')
  ok(!matchesControls(ready, { minScore: 70 }), 'a score floor let a lower score through')
  ok(matchesControls(ready, { minScore: 40 }), 'a score floor hid a row above it')
  ok(!matchesControls(ready, { pull: 'busy' }), 'a trade reading let another reading through')
  ok(!matchesControls(ready, { town: 'Baytown' }), 'a town filter let another town through')
  ok(!matchesControls(ready, { trade: 'welder' }), 'a trade filter let another trade through')
  ok(!matchesControls(ready, { state: 'fresh' }), 'the never-called filter let a rung row through')
  ok(matchesControls(ready, { state: 'rung' }), 'the rung-and-ready filter hid a ready row')
  ok(matchesControls(ready, { search: 'channelview' }), 'a search missed the town it names')
  ok(matchesControls(ready, { search: '862-9968' }), 'a search missed the number it names')
})

// ── What a call comes to ────────────────────────────────────────────────

check('the outcomes the console offers are the ones the column accepts', () => {
  // The scan that holds every write to its column reads literals, and these
  // are read off objects at run time. So the two are compared here instead.
  const snapshot = JSON.parse(readFileSync(join(ROOT, 'scripts/db/db-constraints.json'), 'utf8'))
  const column = snapshot.columns?.outreach_calls?.outcome
  ok(column, 'the schema snapshot carries no outcome column for outreach_calls')
  same(
    [...OUTCOME_IDS].sort().join(','),
    [...column.allows].sort().join(','),
    'the outcomes offered against the ones the column takes'
  )
})

check('every outcome carries a label and a tone, and none repeats an id', () => {
  same(new Set(OUTCOME_IDS).size, CALL_OUTCOMES.length, 'two outcomes sharing an id')
  for (const outcome of CALL_OUTCOMES) {
    ok(outcome.label && outcome.tone, `${outcome.id} is missing a label or a tone`)
  }
})

check('every outcome sits in a track, and every track has something in it', () => {
  // The tracks are what turn eight buttons into four decisions on screen, so
  // an outcome added later without one would simply not be offered.
  const tracks = new Set(TRACKS.map(track => track.id))
  for (const outcome of CALL_OUTCOMES) {
    ok(tracks.has(outcome.track), `${outcome.id} is in no track`)
  }
  for (const track of TRACKS) {
    ok(
      CALL_OUTCOMES.some(outcome => outcome.track === track.id),
      `${track.id} holds no outcome`
    )
  }
})

check('every outcome carries the key it is recorded on, and no key repeats', () => {
  const keys = CALL_OUTCOMES.map(outcome => outcome.key)
  same(new Set(keys).size, keys.length, 'two outcomes sharing a key')
  for (const key of keys) ok(/^[1-9]$/.test(key), `${key} is not a number key`)
})

check('the outcomes that end a business are the ones that should', () => {
  for (const id of ['booked', 'not_interested', 'wrong_number']) {
    ok(outcomeEnds(id), `${id} left the business on the list`)
  }
  for (const id of ['no_answer', 'voicemail', 'gatekeeper', 'spoke', 'callback']) {
    ok(!outcomeEnds(id), `${id} took the business off the list`)
  }
})

check('a call back is the one outcome that carries a time to ring back', () => {
  ok(outcomeTakesCallback('callback'), 'a call back carried no time at all')
  for (const id of OUTCOME_IDS.filter(one => one !== 'callback')) {
    ok(!outcomeTakesCallback(id), `${id} was made to carry a callback time`)
  }
})

check('a call back nobody timed is filed a day out rather than refused', () => {
  // The console and the endpoint both fill this, and what it has to produce is
  // a promise the list reads like any other. A default that landed in the past
  // or that the ladder outranked would be the call back nobody typed a time on
  // going quietly missing, which is the failure the refusal was there to stop.
  const filed = defaultCallbackAt(now)
  same(
    filed.getTime() - now.getTime(),
    CALLBACK_DEFAULT_HOURS * 3_600_000,
    'how far out an untimed call back lands'
  )
  const untimed = listed({
    calls: [call({ outcome: 'callback', called_at: off(-1), callback_at: filed.toISOString() })],
  })
  same(callPlace(untimed, now), 'promised', 'where an untimed call back sits')
  same(readyAt(untimed, now).toISOString(), filed.toISOString(), 'when it comes back')
})

check('an id nothing offers is not an outcome', () => {
  ok(!outcomeEnds('sold'), 'an unknown id ended a business')
  ok(!outcomeTakesCallback(''), 'an empty id carried a callback')
})

// ── Who becomes a lead ──────────────────────────────────────────────────

check('every outcome either answers for interest, asks, or reached nobody', () => {
  // The three states are the whole model, and an outcome added later that
  // lands in none of them would be recorded with the question never asked and
  // never settled - which is the silent half of the failure this exists for.
  const held = id => CALL_OUTCOMES.find(one => one.id === id) ?? {}
  const asks = ['gatekeeper', 'spoke']
  const answers = ['callback', 'booked', 'not_interested']
  const reachedNobody = ['no_answer', 'voicemail', 'wrong_number']
  same(
    [...asks, ...answers, ...reachedNobody].sort().join(','),
    [...OUTCOME_IDS].sort().join(','),
    'the outcomes accounted for against the outcomes there are'
  )
  for (const id of asks) {
    ok(outcomeAsksInterest(id), `${id} settled the interest the caller has to answer`)
    ok(!Object.hasOwn(held(id), 'interest'), `${id} both asks and answers`)
  }
  for (const id of answers) {
    ok(!outcomeAsksInterest(id), `${id} asked a question it already answers`)
    ok(typeof held(id).interest === 'boolean', `${id} answers with nothing`)
  }
  for (const id of reachedNobody) {
    ok(!outcomeAsksInterest(id), `${id} asked about somebody nobody reached`)
    same(interestIn(id), null, `${id} recorded an interest nobody heard`)
  }
})

check('the outcomes that answer for themselves answer the right way', () => {
  same(interestIn('booked'), true, 'a booking was read as anything but a yes')
  same(interestIn('callback'), true, 'a time somebody named was read as anything but a yes')
  same(interestIn('not_interested'), false, 'the word itself was read as anything but a no')
})

check('an outcome that asks takes the answer the caller gave it', () => {
  for (const id of ['spoke', 'gatekeeper']) {
    same(interestIn(id, true), true, `${id} lost a yes`)
    same(interestIn(id, false), false, `${id} lost a no`)
    // Unanswered is not a no. The question does not always come up on the
    // call, and a reading that turned silence into a refusal would drop those
    // conversations out of the lead list without anybody having said so.
    same(interestIn(id, null), null, `${id} read an unanswered call as a refusal`)
    same(interestIn(id), null, `${id} read a missing answer as a refusal`)
  }
})

check('an outcome that answers for itself ignores an answer sent against it', () => {
  // The endpoint refuses this rather than storing it, and the reading agrees
  // with the refusal: nothing a form sends can turn a Booked into a no.
  same(interestIn('booked', false), true, 'a posted no overrode a booking')
  same(interestIn('not_interested', true), false, 'a posted yes overrode the word itself')
})

check('the calls that reached somebody become leads unless they said no', () => {
  // Both halves of the rule, and each is a failure that has happened. Filing
  // every call as a lead buried the handful who asked for something under
  // eight thousand names off a map. Filing only the answered yeses lost the
  // conversations the question never came up on, which is most of them.
  ok(callMakesLead('booked'), 'a booking did not become a lead')
  ok(callMakesLead('callback'), 'a time somebody named did not become a lead')
  ok(callMakesLead('spoke', true), 'an owner who wanted it did not become a lead')
  ok(callMakesLead('gatekeeper', true), 'a gatekeeper who handed over a name did not become a lead')
  ok(callMakesLead('spoke'), 'a conversation nobody answered for was dropped')
  ok(callMakesLead('gatekeeper'), 'a desk nobody answered for was dropped')

  ok(!callMakesLead('spoke', false), 'an owner who said no became a lead')
  ok(!callMakesLead('gatekeeper', false), 'a desk that turned the call away became a lead')
  ok(!callMakesLead('not_interested'), 'a refusal became a lead')
  // A phone that rang out reached nobody who could have wanted anything, so no
  // answer sent against one puts it in front of a person as a lead.
  for (const id of ['no_answer', 'voicemail', 'wrong_number']) {
    ok(!callMakesLead(id), `${id} became a lead having reached nobody`)
    ok(!callMakesLead(id, true), `${id} became a lead on an answer nobody could have given`)
  }
  ok(!callMakesLead('sold', true), 'an id nothing offers became a lead')
})

// ── Run them ────────────────────────────────────────────────────────────

const failures = []
for (const [name, run] of cases) {
  try {
    await run()
  } catch (cause) {
    failures.push(`${name}: ${cause.message}`)
  }
}

if (failures.length) {
  for (const failure of failures) console.error(failure)
  console.error(`\n${failures.length} of ${cases.length} call list checks failed`)
  process.exit(1)
}

console.log(`call list: ${cases.length} checks passed`)
