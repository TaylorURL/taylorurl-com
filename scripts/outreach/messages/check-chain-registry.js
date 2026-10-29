/**
 * The chains derive the registry the studio used to write out by hand.
 *
 * The letters moved out of lib/outreach/variants.js and into one file per
 * chain under lib/outreach/chains, and the registry is now derived from them.
 * Two things have to hold for that to have cost nothing.
 *
 * The first is the ids. A letter's id is stored on every message ever sent
 * under it, so a derivation that renamed one would detach that history from
 * the letter that made it, silently and permanently. registry-before-chains.json
 * is the registry as it stood the day the chains took over, captured field for
 * field, and the derivation is checked against it rather than against a
 * description of it.
 *
 * The second is that the chain a letter belongs to is now looked up. The daily
 * recap decided it by asking whether a letter's id contained the string
 * 'lawsuit', which is wrong in both directions the moment a chain is added:
 * a chain called 'lawsuit-appeal' reads as the lawsuit chain, and a chain
 * sharing no word with its letters reads as the introduction.
 *
 *   node scripts/outreach/messages/check-chain-registry.js
 */
import { readFileSync } from 'node:fs'
import { defineChain, fromCode, createChains } from 'chainwork/core'
import { CHAIN_REGISTRY, CHAINS, VARIANTS } from '../../../lib/outreach/variants.js'
import { SEGMENTS, segmentOf } from '../../../lib/outreach/segments.js'
import { FOLLOW_UP_DAYS } from '../../../lib/outreach/sending/limits.js'
import { LAWSUIT_SOURCE } from '../../../lib/outreach/prospects/lawsuits.js'
import { CHAINS as LANES, chainOf, tallyOf } from '../../../lib/outreach/daily-report.js'
import { cases, check, finish, ok, same } from '../../harness/checks.js'

const BEFORE = JSON.parse(
  readFileSync(new URL('./registry-before-chains.json', import.meta.url), 'utf8')
)

/** A letter, reduced to the fields a stored message or the console reads. */
const shape = one => ({
  id: one.id,
  name: one.name,
  about: one.about,
  segment: one.segment,
  step: one.step,
  status: one.status,
  weight: one.weight,
  family: one.family,
  plain: one.plain,
  repeats: one.repeats,
  unsubscribeLink: one.unsubscribeLink,
  styled: one.styled,
  source: one.source,
  needs: [...one.needs],
  when: typeof one.when,
  condition: one.condition,
  open: typeof one.open,
})

// ── The registry, letter for letter ─────────────────────────────────────

// The four chains the studio has always had come first, so the letters it
// registered by hand keep the positions they were registered in and every
// chain added since is added behind them rather than inserted among them.
const KEPT = VARIANTS.slice(0, BEFORE.length)
const ADDED = VARIANTS.slice(BEFORE.length)

check('the letters the studio registered by hand are still the first of them', () =>
  same(KEPT.length, BEFORE.length, 'letters')
)

check('they are derived in the order they were registered', () =>
  same(KEPT.map(one => one.id).join(' '), BEFORE.map(one => one.id).join(' '), 'ids')
)

check('no letter added since took the place of one that was there', () => {
  const taken = ADDED.filter(one => BEFORE.some(was => was.id === one.id)).map(one => one.id)
  same(taken.join(', '), '', 'letters added under an id already in use')
})

for (const [index, want] of BEFORE.entries()) {
  check(`${want.id} is derived exactly as it was registered`, () => {
    const got = KEPT[index]
    ok(got, `nothing was derived at position ${index}`)
    same(JSON.stringify(shape(got)), JSON.stringify(want), want.id)
  })
}

check('every letter is written for one of the segments in force', () => {
  const wrong = VARIANTS.filter(one => !SEGMENTS.includes(one.segment)).map(one => one.id)
  same(wrong.join(', '), '', 'letters written for a segment nothing reads as')
})

// ── What the derivation adds ────────────────────────────────────────────

check('every chain added since derives letters of its own', () => {
  const added = new Set(ADDED.map(one => one.chain))
  for (const chain of CHAINS) {
    if (chain.segments !== 'all' && !chain.segments.length) continue
    const its = VARIANTS.filter(one => one.chain === chain.id)
    ok(its.length, `${chain.id} derived no letters at all`)
    void added
  }
})

check('a chain whose words are written per business derives none', () => {
  for (const id of ['preview', 'new-business']) {
    const its = VARIANTS.filter(one => one.chain === id)
    same(its.length, 0, `${id} letters in the registry`)
    ok(CHAIN_REGISTRY.chainById(id), `${id} is not a chain at all`)
  }
})

check('every letter now carries the chain it came from', () => {
  const orphans = VARIANTS.filter(one => CHAIN_REGISTRY.chainById(one.chain) === null)
  same(orphans.map(one => one.id).join(', '), '', 'letters whose chain nothing knows')
})

check('every letter carries the day its step falls due', () => {
  same(VARIANTS.find(one => one.step === 1).at, 0, 'a first letter')
  const second = KEPT.find(one => one.step === 2)
  same(second.at, FOLLOW_UP_DAYS, "the cold intro's second letter")
})

check('a chain that fires on something that happened states its own days', () => {
  const broken = CHAIN_REGISTRY.chainById('broken-site')
  same([1, 2, 3, 4].map(n => CHAIN_REGISTRY.dueAt(broken, n)).join(','), '0,3,7,14', 'broken site')
  const partner = CHAIN_REGISTRY.chainById('partner')
  same([1, 2, 3].map(n => CHAIN_REGISTRY.dueAt(partner, n)).join(','), '0,8,20', 'partner')
})

check('a chain that writes about a named defect will not send without one', () => {
  for (const id of ['broken-site', 'listing', 'builder', 'growing']) {
    const first = VARIANTS.find(one => one.chain === id && one.step === 1)
    ok(first.needs.includes('fault_says'), `${id} would send with no defect to name`)
    // The row has to read as the letter's own segment as well, which is most
    // of what `fits` is about, so it is built from the letter rather than guessed.
    const row = { source: id, site_kind: first.segment === 'no-site' ? 'social' : null }
    same(CHAIN_REGISTRY.fits(first, row), false, `${id} fits a row with no defect`)
    same(
      CHAIN_REGISTRY.fits(first, { ...row, fault_says: 'the thing' }),
      true,
      `${id} does not fit a row with one`
    )
  }
})

check('a business whose defect has been fixed is off the chain', () => {
  const broken = CHAIN_REGISTRY.chainById('broken-site')
  const exit = broken.exits.find(one => typeof one === 'function')
  ok(exit, 'the chain has no exit of its own')
  same(exit({ fault_says: 'the certificate expired' }), false, 'a business still broken')
  same(exit({ fault_says: null }), true, 'a business put right')
})

check('each chain states its own days rather than sharing one constant', () => {
  same(CHAIN_REGISTRY.dueAt(CHAIN_REGISTRY.chainById('intro'), 2), FOLLOW_UP_DAYS, 'the intro')
  same(CHAIN_REGISTRY.dueAt(CHAIN_REGISTRY.chainById('lawsuit'), 2), FOLLOW_UP_DAYS, 'the suit')
  same(CHAIN_REGISTRY.dueAt(CHAIN_REGISTRY.chainById('intro'), 3), null, 'a third intro letter')
})

check('a step that rings rather than writes is on one chain and one step', () => {
  // The broken-site chain rings on its second step, because the owner of a
  // site that has stopped working may not be reading the inbox the first
  // letter went to. Every other step is a letter.
  const rung = VARIANTS.filter(one => one.channel !== 'email')
  same(
    [...new Set(rung.map(one => `${one.chain}:${one.step}:${one.channel}`))].join(' '),
    'broken-site:2:call',
    'the steps that are not letters'
  )
  for (const one of rung) same(one.open, null, `${one.id} carries words`)
})

// ── The recap reads the lookup rather than guessing ─────────────────────

check('the four lanes the recap lists are the four chains it was built around', () => {
  for (const name of ['Introduction', 'Lawsuit', 'Draft preview', 'New business']) {
    ok(LANES.includes(name), `the recap lists no ${name} lane`)
  }
})

check('the recap names a live letter’s chain by looking it up', () => {
  const named = id => CHAIN_REGISTRY.chainOf(id)?.name ?? null
  same(chainOf('no-site-intro', named), 'Introduction', 'an intro letter')
  same(chainOf('no-site-lawsuit-follow-up', named), 'Lawsuit', 'a suit letter')
})

check('a letter retired before the chains is still read the way it always was', () => {
  const named = id => CHAIN_REGISTRY.chainOf(id)?.name ?? null
  // Its id is all that is left of it, and its messages are still counted.
  same(chainOf('slow-site-lawsuit-from-before', named), 'Lawsuit', 'an old suit letter')
  same(chainOf('slow-site-something-else', named), 'Introduction', 'an old intro letter')
  same(chainOf(null, named), 'Draft preview', 'a letter with no variant at all')
})

check('a chain the recap lists no lane for is counted in one of its own', () => {
  const named = () => 'Broken site'
  const tally = tallyOf(
    { outreach: [{ variant_id: 'no-site-broken-site', opened_at: null }] },
    named
  )
  const lane = tally.chains.find(one => one.chain === 'Broken site')
  ok(lane, `the lanes came back as ${tally.chains.map(one => one.chain).join(', ')}`)
  same(lane.sent, 1, 'what it counted')
})

// ── Which chain a business is on ────────────────────────────────────────

check('a business in a suit is on the suit chain', () =>
  same(CHAIN_REGISTRY.chainFor({ source: LAWSUIT_SOURCE }).id, 'lawsuit', 'the chain')
)

check('a business found anywhere else is on the introduction', () => {
  for (const source of ['places', 'speed-check', null, undefined, 'something-new']) {
    same(CHAIN_REGISTRY.chainFor({ source }).id, 'intro', `a business from ${source}`)
  }
})

check('the introduction is the chain a business falls to', () =>
  same(CHAIN_REGISTRY.defaultChain.id, 'intro', 'defaultChain')
)

// ── Adding one ──────────────────────────────────────────────────────────

check('another chain is one file and changes nothing about the letters already there', () => {
  const hiring = defineChain({
    id: 'hiring',
    name: 'Hiring',
    source: 'hiring',
    exits: ['filled'],
    steps: [
      { at: 0, channel: 'email', letter: fromCode(() => ({})), needs: ['fault_says'] },
      { at: 5, slug: 'call', channel: 'call' },
      { at: 14, slug: 'last', channel: 'email', letter: fromCode(() => ({})) },
    ],
  })
  const five = createChains({ chains: [...CHAINS, hiring], segments: SEGMENTS, segmentOf })
  const kept = five.letters
    .slice(0, VARIANTS.length)
    .map(one => one.id)
    .join(' ')
  same(kept, VARIANTS.map(one => one.id).join(' '), 'the letters that were already there')
  same(five.letters.length, VARIANTS.length + 3 * SEGMENTS.length, 'letters in all')
  same(five.chainFor({ source: 'hiring' }).id, 'hiring', 'where its businesses go')
  same(five.letters.find(one => one.id === 'no-site-hiring-call').channel, 'call', 'its call step')
})

await finish({
  hint:
    'lib/outreach/chains holds the chains, chainwork derives the registry, and\n' +
    '  registry-before-chains.json is what it has to keep deriving. A letter id never moves.',
})

console.log(
  `chain registry: ${cases.length} checks passed — ${CHAINS.length} chains derive ` +
    `${VARIANTS.length} letters, the first ${BEFORE.length} of them field for field as they ` +
    'were registered by hand'
)
