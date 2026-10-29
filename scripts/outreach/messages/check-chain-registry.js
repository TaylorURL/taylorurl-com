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

check('the chains derive as many letters as the studio registered by hand', () =>
  same(VARIANTS.length, BEFORE.length, 'letters')
)

check('they derive them in the same order', () =>
  same(VARIANTS.map(one => one.id).join(' '), BEFORE.map(one => one.id).join(' '), 'ids')
)

for (const [index, want] of BEFORE.entries()) {
  check(`${want.id} is derived exactly as it was registered`, () => {
    const got = VARIANTS[index]
    ok(got, `nothing was derived at position ${index}`)
    same(JSON.stringify(shape(got)), JSON.stringify(want), want.id)
  })
}

check('every letter is written for one of the segments in force', () => {
  const wrong = VARIANTS.filter(one => !SEGMENTS.includes(one.segment)).map(one => one.id)
  same(wrong.join(', '), '', 'letters written for a segment nothing reads as')
})

// ── What the derivation adds ────────────────────────────────────────────

check('every letter now carries the chain it came from', () => {
  const orphans = VARIANTS.filter(one => CHAIN_REGISTRY.chainById(one.chain) === null)
  same(orphans.map(one => one.id).join(', '), '', 'letters whose chain nothing knows')
})

check('every letter carries the day its step falls due', () => {
  same(VARIANTS.find(one => one.step === 1).at, 0, 'a first letter')
  const second = VARIANTS.find(one => one.step === 2)
  same(second.at, FOLLOW_UP_DAYS, 'a second letter')
})

check('each chain states its own days rather than sharing one constant', () => {
  same(CHAIN_REGISTRY.dueAt(CHAIN_REGISTRY.chainById('intro'), 2), FOLLOW_UP_DAYS, 'the intro')
  same(CHAIN_REGISTRY.dueAt(CHAIN_REGISTRY.chainById('lawsuit'), 2), FOLLOW_UP_DAYS, 'the suit')
  same(CHAIN_REGISTRY.dueAt(CHAIN_REGISTRY.chainById('intro'), 3), null, 'a third intro letter')
})

check('every letter goes out by email, since nothing else is wired yet', () => {
  const other = VARIANTS.filter(one => one.channel !== 'email').map(one => one.id)
  same(other.join(', '), '', 'letters on a channel nothing can send')
})

// ── The chain a letter belongs to ───────────────────────────────────────

check('a letter id answers with its own chain', () => {
  same(CHAIN_REGISTRY.chainOf('no-site-intro').id, 'intro', 'an intro letter')
  same(CHAIN_REGISTRY.chainOf('no-site-lawsuit-follow-up').id, 'lawsuit', 'a suit letter')
})

check('an id nothing knows answers with nothing rather than with a guess', () =>
  same(CHAIN_REGISTRY.chainOf('a-letter-retired-before-the-chains'), null, 'chainOf')
)

check('a chain that shares a word with another is told apart from it', () => {
  // Both of these hold the string the recap used to decide a chain by.
  const appeal = defineChain({
    id: 'lawsuit-appeal',
    name: 'Lawsuit appeal',
    source: 'an-appeal-reader',
    steps: [{ at: 0, channel: 'email', letter: fromCode(() => ({})) }],
  })
  const three = createChains({
    chains: [...CHAINS, appeal],
    segments: SEGMENTS,
    segmentOf,
  })
  same(three.chainOf('no-site-lawsuit').id, 'lawsuit', 'the suit letter')
  same(three.chainOf('no-site-lawsuit-appeal').id, 'lawsuit-appeal', 'the appeal letter')
})

// ── The recap reads the lookup rather than guessing ─────────────────────

check("every chain's name is a lane the recap lists", () => {
  const missing = CHAINS.filter(chain => !LANES.includes(chain.name)).map(chain => chain.name)
  same(missing.join(', '), '', 'chains the recap has no lane for')
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

check('a fifth chain is one file and changes nothing about the four letters', () => {
  const broken = defineChain({
    id: 'broken-site',
    name: 'Broken site',
    source: 'broken-site',
    exits: ['cert_fixed'],
    steps: [
      { at: 0, channel: 'email', letter: fromCode(() => ({})), needs: ['cert_expires_at'] },
      { at: 5, slug: 'call', channel: 'call' },
      { at: 14, slug: 'last', channel: 'email', letter: fromCode(() => ({})) },
    ],
  })
  const five = createChains({ chains: [...CHAINS, broken], segments: SEGMENTS, segmentOf })
  const kept = five.letters
    .slice(0, VARIANTS.length)
    .map(one => one.id)
    .join(' ')
  same(kept, VARIANTS.map(one => one.id).join(' '), 'the letters that were already there')
  same(five.letters.length, VARIANTS.length + 3 * SEGMENTS.length, 'letters in all')
  same(five.chainFor({ source: 'broken-site' }).id, 'broken-site', 'where its businesses go')
  same(
    five.letters.find(one => one.id === 'no-site-broken-site-call').channel,
    'call',
    'its call step'
  )
})

await finish({
  hint:
    'lib/outreach/chains holds the chains, chainwork derives the registry, and\n' +
    '  registry-before-chains.json is what it has to keep deriving. A letter id never moves.',
})

console.log(
  `chain registry: ${cases.length} checks passed — ${CHAINS.length} chains derive ` +
    `${VARIANTS.length} letters, field for field as they were registered by hand`
)
