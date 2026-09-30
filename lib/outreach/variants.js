/**
 * The letter the sender opens with, and every letter that used to.
 *
 * A variant is one letter: the subject, the marker, the lines under the
 * greeting, the figure, the paragraphs after it and the closing line. That is
 * the whole of what one message says that another does not. Everything around
 * it - the greeting, the sign-off, the tracked image, the unsubscribe URL and
 * the footer - is assembled once by `compose` in api/outreach/send.js and
 * rendered twice by lib/outreach/message.js, so a letter carries none of it
 * and cannot break any of it.
 *
 * There are two letters. Cold outreach opens on an introduction that asks for
 * nothing, and two weeks later the second letter points at the work and asks
 * for a half-hour call. After that the introduction arrives again every two
 * weeks until the business replies or takes itself off the list. The same
 * words go to every business, whatever its segment, whatever its reading.
 * Nothing is drawn, nothing is tested against anything, and nobody receives
 * a version of either that somebody else does not.
 *
 * That is what `repeats` on the introduction says. A chain used to be four
 * different letters at four steps, and a step nothing was written for was
 * where a business's conversation ended. A repeating letter stands at every
 * step instead, so the chain has no end. A letter written for one step takes
 * that step from it, which is how the second letter stands at step two
 * without the introduction having to leave a gap there: switch the second
 * letter off and the introduction fills the step again.
 *
 * The words live under lib/outreach/openers/, one file per letter, and this
 * file is the registry that lists them. An id is stored on every message sent
 * under it, so an id is never renamed and never given to a second letter.
 *
 * Everything other than those two is paused, and kept. Between them those
 * letters wrote every message this pipeline has ever sent, and the rows that
 * hold their ids are the record of it:
 *
 *   `introduction`  the two letters that send, and the four that used to follow
 *   `plain`         opened on the reading itself, retired outright
 *   `designed`      the laid-out letters, retired outright
 *
 * The `designed` family is the slab that came first: a masthead, a figure, a
 * capture of the reader's own site, client cards, a badge and a button. The
 * `plain` family replaced it with a few typed paragraphs that still opened on
 * a finding about the reader's site. Both are paused, follow-ups included, so
 * nothing starts a business on one and nothing continues one.
 *
 * They are paused rather than deleted, because the ids are stored on every
 * message they ever sent and a deleted id turns those rows into a reference to
 * nothing. The words stay in the tree for the same reason.
 *
 * A business part way through one of those chains simply stops hearing them
 * and hears the letters that still go instead. `pickVariant` overturns a stamp
 * whose family has nothing live left, a draft already written under one reads
 * as stale in api/outreach/send.js and is written again in place, and a
 * follow-up owed under one is drawn among what still sends, which is what
 * `familyAhead` says. Without all three, a retired family leaves a queue of
 * businesses each holding a letter no run can produce, or a chain that ends
 * the day its next letter comes due.
 *
 * A business holding a letter from before families existed reads as designed,
 * which is what it was sent, so it is redrawn the same way.
 *
 * A `plain` letter says so with its own flag, and the composer renders it
 * bare. That flag is about rendering; `family` is about which chain a letter
 * belongs to. Both letters that send carry the flag, so what goes out reads
 * as a few typed paragraphs.
 *
 * `unsubscribeLink` and `styled` are the other two rendering flags. A letter
 * that sets `unsubscribeLink` false goes without the unsubscribe line in its
 * footer; the List-Unsubscribe header goes with every send regardless, since
 * `deliver` adds it and never reads the letter. A letter that sets `styled`
 * false goes out with no background and no type of the studio's own, in
 * whatever the reader's mail client shows a typed message in.
 *
 * Strings and pure functions only. The console imports this to show the
 * registry, and a server dependency here would break that bundle.
 */

import { coverOpener } from './openers/cover.js'
import { groundOpener } from './openers/ground.js'
import { holdingOpener } from './openers/holding.js'
import { lastOpener } from './openers/last.js'
import { lowestOpener } from './openers/lowest.js'
import { nearbyOpener } from './openers/nearby.js'
import { siteOpener } from './openers/presence.js'
import { searchOpener, searchShort } from './openers/search.js'
import { speedOpener } from './openers/speed.js'
import { introductionOpener } from './openers/plain/introduction.js'
import { meetingOpener } from './openers/plain/meeting.js'
import { pointerOpener } from './openers/plain/pointer.js'
import { processOpener } from './openers/plain/process.js'
import { plainCoverOpener } from './openers/plain/cover.js'
import { elsewhereOpener } from './openers/plain/elsewhere.js'
import { foundOpener } from './openers/plain/found.js'
import { plainLastOpener } from './openers/plain/last.js'
import { plainListingOpener } from './openers/plain/listing.js'
import { plainNearbyOpener } from './openers/plain/nearby.js'
import { plainSearchOpener } from './openers/plain/search.js'
import { plainSpeedOpener } from './openers/plain/speed.js'
import { lawsuitFollowUpOpener, lawsuitOpener } from './openers/plain/lawsuit.js'
import { LAWSUIT_SOURCE } from './prospects/lawsuits.js'
import { SEGMENTS, segmentOf } from './segments.js'

// The two openers the sender has always used, reachable from here as they
// were before the letters moved into files of their own.
export { siteOpener, speedOpener }

/** The states a variant can be in. Only a live one is ever chosen. */
export const VARIANT_STATUSES = Object.freeze(['live', 'paused', 'draft'])

/** The family a letter belongs to where it names none: the letters that were always here. */
const FIRST_FAMILY = 'designed'

/**
 * The sources whose businesses are written to with letters of their own.
 *
 * A business found on the map, by the speed check or by hand is written to
 * with the introduction, and a letter naming no source is one of those. A
 * business found by a source listed here has a reason to be written to that
 * the introduction knows nothing about, so it hears only the letters written
 * for its source, and the introduction is never drawn for it.
 */
const OWN_LETTER_SOURCES = Object.freeze([LAWSUIT_SOURCE])

/** The source a row's letters are written for: its own where it has letters, null otherwise. */
export function letterSourceOf(prospect) {
  const source = prospect?.source ?? null
  return OWN_LETTER_SOURCES.includes(source) ? source : null
}

/** One descriptor, frozen, with the defaults a letter ships with filled in. */
function variant({
  id,
  name,
  about,
  segment,
  needs,
  open,
  step = 1,
  when = null,
  condition = null,
  status = 'live',
  weight = 1,
  family = FIRST_FAMILY,
  plain = false,
  repeats = false,
  unsubscribeLink = true,
  styled = true,
  source = null,
}) {
  return Object.freeze({
    id,
    name,
    about,
    segment,
    step,
    status,
    weight,
    family,
    plain,
    repeats,
    unsubscribeLink,
    styled,
    source,
    needs: Object.freeze([...needs]),
    when,
    condition,
    open,
  })
}

/** The step a registry entry sends at, which is the first where it says nothing. */
export const stepOf = entry => entry.step ?? 1

/**
 * Whether a letter stands at a step.
 *
 * A letter written for one step stands at that step alone, which is what a
 * chain of different letters is made of. A letter that repeats stands at its
 * own step and at every step after it, for as long as the business is on the
 * list: it is the same letter arriving again rather than the next thing in a
 * sequence, so there is no step at which it runs out.
 *
 * Standing at a step is not the same as being sent at it. Where a live letter
 * was written for the step itself, that letter is the one drawn and the
 * repeating one waits for the step after; `drawn` settles it, since which of
 * the two goes depends on what else is switched on.
 *
 * @param {object} entry A registry entry.
 * @param {number} step The step being drawn for.
 */
export const sendsAt = (entry, step) =>
  entry?.repeats ? step >= stepOf(entry) : stepOf(entry) === step

/** The family a registry entry belongs to, which is the first where it names none. */
export const familyOf = entry => entry?.family ?? FIRST_FAMILY

/**
 * The family a business is in: that of the first letter it holds, or the
 * first family where it holds none the registry knows, since every letter
 * sent before families existed was one of those.
 *
 * @param {object} prospect A row carrying `variant_id`, or not.
 * @param {ReadonlyArray<object>} [variants] The registry the id is read against.
 */
export function familyHeld(prospect, variants = VARIANTS) {
  const id = prospect?.variant_id
  const held = id ? variants.find(entry => entry.id === id) : null
  return held ? familyOf(held) : FIRST_FAMILY
}

/**
 * The family a business's chain goes on in at a step.
 *
 * The family it opened in, while that family has anything live left for the
 * segment, so a business hears one voice. A family retired outright has no
 * voice left, and a business part way through one is owed the letters that
 * still go rather than a chain that ends on a letter nobody sends, so it is
 * drawn among whatever the segment still sends: null, for any family.
 *
 * @param {object} prospect A row carrying `variant_id`, or not.
 * @param {ReadonlyArray<object>} [variants] The registry as it stands.
 * @param {number} [step] The step it is owed next.
 * @returns {string|null}
 */
export function familyAhead(prospect, variants = VARIANTS, step = 2) {
  const held = familyHeld(prospect, variants)
  const source = letterSourceOf(prospect)
  return liveAhead(variants, segmentOf(prospect ?? {}), step, held, source) ? held : null
}

/** The segments a measured site can read as, in the order the console lists them. */
const MEASURED = ['slow-site', 'fair-site', 'sound-site']

/**
 * The letters written for a measured site.
 *
 * Each is registered once per scored segment, under an id that names both,
 * because the same words land differently on a site that scored 30 and one
 * that scored 95, and a result kept per id is a result kept per conversation.
 * A new letter for measured sites is one entry here, and it is registered for
 * all three segments at once.
 */
const READINGS = [
  {
    suffix: 'audit',
    name: 'Speed Reading',
    about: 'Opens on the mobile speed score, out of 100.',
    needs: ['audit_score'],
    open: speedOpener,
    weight: 2,
    status: 'paused',
  },
  {
    suffix: 'search',
    name: 'Search Reading',
    about: 'Opens on the SEO score, the checks Google reads before it can show a page.',
    needs: ['seo_score'],
    open: searchOpener,
    when: searchShort,
    condition: 'the SEO score is under 90',
    weight: 2,
    status: 'paused',
  },
  {
    suffix: 'holding',
    name: 'Holding Up',
    about: 'Asks whether the site is still doing its job, then gives the speed score.',
    needs: ['audit_score'],
    open: holdingOpener,
    weight: 2,
    status: 'paused',
  },
  {
    suffix: 'lowest',
    step: 2,
    status: 'paused',
    name: 'Lowest Mark',
    about: 'Names the one mark on the report to start with.',
    needs: ['audit_score'],
    open: lowestOpener,
  },
  {
    suffix: 'nearby',
    step: 3,
    status: 'paused',
    name: 'Nearby Work',
    about: 'Points at a site built for a business like theirs.',
    needs: [],
    open: nearbyOpener,
  },
  {
    suffix: 'last',
    step: 4,
    status: 'paused',
    name: 'Last Note',
    about: 'A short last note, with a one-word way to say later.',
    needs: [],
    open: lastOpener,
  },
  // The plain chain, retired. Its opening letter led on the reader's load
  // time, which is now what the introduction chain says second, so nothing
  // starts here and nothing continues here.
  {
    suffix: 'plain',
    status: 'paused',
    name: 'Plain Load Time',
    about: 'A few typed paragraphs: the seconds the page took on a phone, and what causes it.',
    needs: ['audit_score'],
    open: plainSpeedOpener,
    family: 'plain',
    plain: true,
    weight: 3,
  },
  {
    suffix: 'plain-search',
    step: 2,
    status: 'paused',
    name: 'Plain Search',
    about:
      'A few typed paragraphs on what the report says about search, or on what a phone visitor can do.',
    needs: [],
    open: plainSearchOpener,
    family: 'plain',
    plain: true,
  },
  {
    suffix: 'plain-nearby',
    step: 3,
    status: 'paused',
    name: 'Plain Nearby Work',
    about: 'A few typed paragraphs pointing at a site built for a business like theirs.',
    needs: [],
    open: plainNearbyOpener,
    family: 'plain',
    plain: true,
  },
  {
    suffix: 'plain-last',
    step: 4,
    status: 'paused',
    name: 'Plain Last Note',
    about: 'A short typed last note, answered with a number.',
    needs: [],
    open: plainLastOpener,
    family: 'plain',
    plain: true,
  },
  // The rest of the introduction chain as it was first written. The letter it
  // opened with now repeats and the one letter after it is the meeting ask,
  // registered below, so the letters that used to follow it are history.
  {
    suffix: 'intro-found',
    step: 2,
    name: 'The Load Time',
    about: 'The seconds the page took on a phone, said after a letter that made no claim about it.',
    needs: ['audit_score'],
    open: foundOpener,
    family: 'introduction',
    plain: true,
  },
  {
    suffix: 'intro-process',
    step: 2,
    status: 'paused',
    name: 'How A Build Goes',
    about: 'What a build actually runs like, and how little of their week it takes.',
    needs: [],
    open: processOpener,
    family: 'introduction',
    plain: true,
  },
  {
    suffix: 'intro-pointer',
    step: 3,
    name: 'Wrong Person',
    about: 'Assumes theirs is sorted and asks to be pointed at somebody it is not.',
    needs: [],
    open: pointerOpener,
    family: 'introduction',
    plain: true,
  },
  {
    suffix: 'intro-last',
    step: 4,
    name: 'Introduction Last Note',
    about: 'A short typed last note, answered with a number.',
    needs: [],
    open: plainLastOpener,
    family: 'introduction',
    plain: true,
  },
]

/**
 * The letter cold outreach sends, registered once for every segment a business
 * can read as.
 *
 * It is the same letter each time and it repeats, so a business hears it at
 * step one and again at every step after the second. Its `needs` is empty and
 * it makes no claim about the reader, which is why one registration covers
 * every segment including `unmeasured`: nothing about the business has to be
 * known before the letter can be written, so a business nothing has measured
 * is as writable as one that scored thirty.
 */
const INTRODUCTION = {
  name: 'Introduction',
  about: 'Who is writing, what they do, where they do it, and nothing asked for.',
  needs: [],
  open: introductionOpener,
  family: 'introduction',
  plain: true,
  repeats: true,
}

/**
 * The second letter, registered for every segment the way the introduction is.
 *
 * It stands at step two alone and does not repeat. It points at the work and
 * asks for a call, which is a thing to ask once; the letters after it go back
 * to the introduction. Like the introduction it needs nothing off the row, so
 * one registration covers every segment.
 *
 * It goes without the unsubscribe line in the footer, and without the
 * background and type the introduction is set in. The header that lets a mail
 * client take the reader off the list still goes with it.
 */
const MEETING = {
  step: 2,
  name: 'Meeting Ask',
  about:
    'Points at the work and asks for a half-hour call, or a visit where the business is local.',
  needs: [],
  open: meetingOpener,
  family: 'introduction',
  plain: true,
  unsubscribeLink: false,
  styled: false,
}

/**
 * The letter a business sued over its website's accessibility is sent, and
 * the one note that follows it. Registered for every segment, since what the
 * site scored says nothing the lawsuit has not already said, and written for
 * the lawsuits source alone, so no other business is ever drawn one and no
 * business in a suit is ever drawn the introduction.
 *
 * Neither repeats. After the second the chain closes: see
 * lib/outreach/openers/plain/lawsuit.js for why there is no third.
 */
const LAWSUIT = {
  name: 'Accessibility Lawsuit',
  about:
    'Names the website accessibility suit filed against the business and offers the rebuild to WCAG 2.1 AA.',
  needs: ['case_filed_on'],
  open: lawsuitOpener,
  family: 'lawsuit',
  source: LAWSUIT_SOURCE,
  plain: true,
}

const LAWSUIT_FOLLOW_UP = {
  step: 2,
  name: 'Lawsuit Follow-Up',
  about: 'Asks once more, two weeks on, whether the site still has to be brought up to standard.',
  needs: [],
  open: lawsuitFollowUpOpener,
  family: 'lawsuit',
  source: LAWSUIT_SOURCE,
  plain: true,
  unsubscribeLink: false,
  styled: false,
}

/**
 * Every variant there is: the two letters that send, and then the ones that
 * used to.
 *
 * Everything under those two is paused, whatever status it once shipped
 * with, and paused in one place rather than one line at a time so nothing can
 * be switched back on by an entry the eye skips. They are kept rather than
 * deleted because their ids are stored on every message they ever sent, and a
 * deleted id turns those rows into a reference to nothing.
 */
export const VARIANTS = Object.freeze([
  ...SEGMENTS.map(segment => variant({ ...INTRODUCTION, id: `${segment}-intro`, segment })),
  ...SEGMENTS.map(segment => variant({ ...MEETING, id: `${segment}-intro-meeting`, segment })),
  ...SEGMENTS.map(segment => variant({ ...LAWSUIT, id: `${segment}-lawsuit`, segment })),
  ...SEGMENTS.map(segment =>
    variant({ ...LAWSUIT_FOLLOW_UP, id: `${segment}-lawsuit-follow-up`, segment })
  ),
  ...[
    {
      id: 'no-site-listing',
      weight: 2,
      status: 'paused',
      name: 'Web Presence',
      about: 'Says the listing points at a page on a platform, not a site of their own.',
      segment: 'no-site',
      needs: [],
      open: (prospect, where) => siteOpener(prospect, where),
    },
    {
      id: 'no-site-ground',
      weight: 2,
      status: 'paused',
      name: 'Own Ground',
      about: 'Names the platform and says the page belongs to it, not to them.',
      segment: 'no-site',
      needs: [],
      open: (prospect, where) => groundOpener(prospect, where),
    },
    {
      id: 'no-site-cover',
      status: 'paused',
      step: 2,
      name: 'What It Covers',
      about: 'Says in a paragraph what a site of their own would hold.',
      segment: 'no-site',
      needs: [],
      open: coverOpener,
    },
    {
      id: 'no-site-nearby',
      status: 'paused',
      step: 3,
      name: 'Nearby Work',
      about: 'Points at a site built for a business like theirs.',
      segment: 'no-site',
      needs: [],
      open: nearbyOpener,
    },
    {
      id: 'no-site-last',
      status: 'paused',
      step: 4,
      name: 'Last Note',
      about: 'A short last note, with a one-word way to say later.',
      segment: 'no-site',
      needs: [],
      open: lastOpener,
    },
    // The plain chain for a business with no site of its own, retired. Its
    // opening letter led on where the listing sends a searcher, which is now
    // what the introduction chain says second.
    {
      id: 'no-site-plain',
      status: 'paused',
      name: 'Plain Listing',
      about:
        'A few typed paragraphs on where the listing sends a searcher, and what a page of their own would do.',
      segment: 'no-site',
      needs: [],
      open: plainListingOpener,
      family: 'plain',
      plain: true,
      weight: 2,
    },
    {
      id: 'no-site-plain-cover',
      step: 2,
      status: 'paused',
      name: 'Plain What It Covers',
      about:
        'A few typed paragraphs on three things a site of their own does that the platform cannot.',
      segment: 'no-site',
      needs: [],
      open: plainCoverOpener,
      family: 'plain',
      plain: true,
    },
    {
      id: 'no-site-plain-nearby',
      step: 3,
      status: 'paused',
      name: 'Plain Nearby Work',
      about: 'A few typed paragraphs pointing at a site built for a business like theirs.',
      segment: 'no-site',
      needs: [],
      open: plainNearbyOpener,
      family: 'plain',
      plain: true,
    },
    {
      id: 'no-site-plain-last',
      step: 4,
      status: 'paused',
      name: 'Plain Last Note',
      about: 'A short typed last note, answered with a number.',
      segment: 'no-site',
      needs: [],
      open: plainLastOpener,
      family: 'plain',
      plain: true,
    },
    {
      id: 'no-site-intro-elsewhere',
      step: 2,
      name: 'The Listing',
      about: 'Where the listing sends a searcher, said after a letter that made no claim about it.',
      segment: 'no-site',
      needs: [],
      open: elsewhereOpener,
      family: 'introduction',
      plain: true,
    },
    {
      id: 'no-site-intro-process',
      step: 2,
      status: 'paused',
      name: 'How A Build Goes',
      about: 'What a build actually runs like, and how little of their week it takes.',
      segment: 'no-site',
      needs: [],
      open: processOpener,
      family: 'introduction',
      plain: true,
    },
    {
      id: 'no-site-intro-pointer',
      step: 3,
      name: 'Wrong Person',
      about: 'Assumes theirs is sorted and asks to be pointed at somebody it is not.',
      segment: 'no-site',
      needs: [],
      open: pointerOpener,
      family: 'introduction',
      plain: true,
    },
    {
      id: 'no-site-intro-last',
      step: 4,
      name: 'Introduction Last Note',
      about: 'A short typed last note, answered with a number.',
      segment: 'no-site',
      needs: [],
      open: plainLastOpener,
      family: 'introduction',
      plain: true,
    },
    ...MEASURED.flatMap(segment =>
      READINGS.map(entry => ({ ...entry, id: `${segment}-${entry.suffix}`, segment }))
    ),
  ].map(entry => variant({ ...entry, status: 'paused' })),
])

/**
 * The id a segment's holdout is recorded under, and the test for one.
 *
 * A holdout is written on the prospect the way a variant is, so it needs an
 * id, and the id says which segment the business was held out of. The suffix
 * is what the queue and the results know one by.
 */
export const holdoutId = segment => `${segment}-holdout`
export const isHoldoutId = id => typeof id === 'string' && id.endsWith('-holdout')

/**
 * One holdout per segment, held at nothing.
 *
 * A holdout was a slice of a segment given no letter at all, so that what the
 * letters did could be read against a group that heard nothing. It was the
 * floor under an experiment, and there is no experiment: one letter goes to
 * everybody, so there is nothing for a floor to be under and nobody a slice
 * would be withheld from.
 *
 * They stay as records rather than as switches. Every business ever drawn into
 * one carries its id, and the console reads these to say what those rows mean.
 * `pickVariant` draws nobody into one and a business already holding one is
 * drawn again, so the weight is nought here and cannot be anything else.
 */
export const HOLDOUTS = Object.freeze(
  [...new Set(VARIANTS.map(entry => entry.segment))].map(segment =>
    Object.freeze({
      id: holdoutId(segment),
      name: 'Holdout',
      about: 'Given no letter at all. Nobody is any more.',
      segment,
      step: 1,
      status: 'paused',
      weight: 0,
      needs: Object.freeze([]),
      when: null,
      condition: null,
      open: null,
      holdout: true,
    })
  )
)

/**
 * Whether a letter is written for a business: the row reads as the letter's
 * segment, carries every column the letter needs, and passes the letter's own
 * test where it has one.
 *
 * This is the whole of the gate, read here by the picker and by the console's
 * preview, so what the preview renders against is a business the sender would
 * actually give the letter to.
 *
 * @param {object} variant A registry entry.
 * @param {object} prospect A candidate row, as lib/outreach/sending/queue.js reads one.
 */
export function fits(variant, prospect) {
  const row = prospect ?? {}
  return (
    variant.segment === segmentOf(row) &&
    (variant.source ?? null) === letterSourceOf(row) &&
    variant.needs.every(column => row[column] !== null && row[column] !== undefined) &&
    (typeof variant.when !== 'function' || Boolean(variant.when(row)))
  )
}

/**
 * The variant one prospect is given, the holdout it is drawn into, or null
 * where none fits.
 *
 * A prospect that already holds one keeps it: a business that re-qualifies
 * under a second segment, or whose letter has been paused in the console, is
 * still the business the first message was written to, and a later letter
 * under another id would read as a different company writing. An id the
 * registry no longer knows fits nothing, which leaves the prospect where it
 * stands rather than rolling it a second time.
 *
 * The one thing that overturns a stamp is its family being retired. A paused
 * letter is a switch, and the businesses under it wait; a family with nothing
 * live left for the segment is a letter that is never drawn again, and a
 * business standing on one of those would sit in the queue forever holding a
 * message no run can produce. Since nothing has been written to it yet, it is
 * drawn again among what is still sending. A business stamped as held out is
 * the same case: nothing was ever written to it, and nothing is held out now.
 *
 * Otherwise the eligible variants are the live ones written for the prospect,
 * carrying a weight, and the roll picks among them in proportion to their
 * weights.
 *
 * A later step is drawn the same way among the letters that stand at it. At
 * step two that is the second letter, which was written for the step; at
 * every step after it the introduction repeats, so the draw lands on the
 * letter it landed on at step one, which is what a reminder is.
 *
 * @param {object} prospect A candidate row, as lib/outreach/sending/queue.js reads one.
 * @param {ReadonlyArray<object>} [variants] The registry, with whatever the
 *   console has set laid over it. The code's own defaults otherwise.
 * @param {number} [roll] A number in [0, 1), drawn by the caller.
 * @param {number} [step] Which letter is being chosen. The first unless the
 *   caller says otherwise.
 * @returns {object|null} The variant, or null where nothing fits.
 */
export function pickVariant(prospect, variants = VARIANTS, roll = 0, step = 1) {
  const row = prospect ?? {}
  const segment = segmentOf(row)

  // The letter already written on the row, which the business keeps while its
  // family still has anything live for the segment. A letter paused on its own
  // is a switch flipped in the console for an afternoon and the business is
  // still written to under it, while a family retired outright leaves the
  // stamp naming a letter no draw can produce. A business standing on one of
  // those has been written to by nobody yet, so it is drawn again among what
  // is still sending rather than held for a letter that is never coming.
  if (step === 1 && row.variant_id) {
    const kept = variants.find(entry => entry.id === row.variant_id)
    // A business stamped as held was written to by nobody, and nothing is held
    // out any more, so it is drawn again like any other business the pipeline
    // has not spoken to. An id nothing at all knows is a row from a registry
    // this one cannot reason about, and it is left where it stands.
    if (!kept) return isHoldoutId(row.variant_id) ? drawn(variants, row, roll, 1) : null
    if (liveAhead(variants, segment, 1, familyOf(kept), letterSourceOf(row))) return kept
  }

  // A first letter is drawn among every family; every letter after it stays
  // in the family of the first while that family still sends, and goes on in
  // whatever does once it has been retired.
  return drawn(variants, row, roll, step, step === 1 ? null : familyAhead(row, variants, step))
}

/**
 * One of a set, in proportion to the weights on it.
 *
 * A roll outside [0, 1) is held to it, so a bad draw still lands on a slice
 * rather than past the end of the list.
 */
function weighted(slices, roll) {
  const total = slices.reduce((sum, entry) => sum + entry.weight, 0)
  const point = (Number.isFinite(roll) ? Math.min(Math.max(roll, 0), 1) : 0) * total
  let passed = 0
  for (const entry of slices) {
    passed += entry.weight
    if (point < passed) return entry
  }
  return slices[slices.length - 1]
}

/**
 * The letters live for a row at a step, in one family where one is named,
 * drawn among by weight. `fits` is what holds the draw to the row's segment.
 *
 * A letter written for the step takes it from one that has repeated into it,
 * so the draw is among those where there are any, and among the repeating
 * letters only where nothing was written for the step.
 */
function drawn(variants, row, roll, step, family = null) {
  const eligible = variants.filter(
    entry =>
      sendsAt(entry, step) &&
      entry.status === 'live' &&
      entry.weight > 0 &&
      (family === null || familyOf(entry) === family) &&
      fits(entry, row)
  )
  const own = eligible.filter(entry => stepOf(entry) === step)
  const pool = own.length ? own : eligible
  return pool.length ? weighted(pool, roll) : null
}

/**
 * Whether a chain has any live letter left at this step or beyond.
 *
 * Whether the code holds words for a step is a fact about the tree, and it stays
 * true after a letter is switched off. This asks the question a run actually
 * needs: is there anything left for this business to be sent.
 *
 * The two answers came apart when a whole family was retired. A letter paused
 * on its own leaves the steps behind it live, and the business waits, which is
 * right: a switch flipped in the console for an afternoon should not end
 * somebody's chain. A family paused entirely leaves nothing ahead at all, and
 * a business waiting on that waits forever, owed a letter no draw can produce
 * and counted as deferred every run for the rest of time.
 *
 * A chain nobody has opened yet is the exception. Its first letter is the only
 * way to the letters after it, so a family whose first letters are all
 * switched off has nothing ahead for a business it has not written to,
 * whatever is live further along. Without that, pausing the introduction would
 * go on sending it to every business already drafted under it, because the
 * second letter is still switched on.
 *
 * @param {ReadonlyArray<object>} variants The registry as it stands.
 * @param {string} segment The segment the business reads as.
 * @param {number} step The step it is owed next.
 * @param {string|null} [family] The chain it was opened in.
 * @param {string|null} [source] The source whose letters it hears, which
 *   `letterSourceOf` reads off the row. Null for the introduction's businesses.
 */
export function liveAhead(variants, segment, step, family = null, source = null) {
  return variants.some(
    entry =>
      entry.segment === segment &&
      (entry.source ?? null) === source &&
      (sendsAt(entry, step) || (step > 1 && stepOf(entry) > step)) &&
      entry.status === 'live' &&
      entry.weight > 0 &&
      (family === null || familyOf(entry) === family)
  )
}

/** The most a variant may weigh, which is plenty for a ratio between a few of them. */
export const WEIGHT_MAX = 100

/**
 * The registry with what the console has set laid over it.
 *
 * A stored row names a variant by id and carries the status and the weight it
 * has been set to. Only a known id is read, since a row for a variant that has
 * since been retired is a fact about its history rather than an instruction,
 * and only a value the registry would accept is taken, so a row written by
 * hand with a weight the sender cannot use leaves the code's own default
 * standing rather than emptying a segment.
 *
 * @param {ReadonlyArray<object>} [variants] The registry.
 * @param {Array<{id: string, status?: string, weight?: number}>} [rows] What
 *   is stored, as `outreach_variants` holds it.
 * @returns {ReadonlyArray<object>} A new frozen list in the registry's order.
 */
export function withSettings(variants = VARIANTS, rows = []) {
  const stored = new Map((rows ?? []).filter(row => row?.id).map(row => [row.id, row]))
  return Object.freeze(
    variants.map(entry => {
      const row = stored.get(entry.id)
      if (!row) return entry
      const status = VARIANT_STATUSES.includes(row.status) ? row.status : entry.status
      const weight =
        Number.isInteger(row.weight) && row.weight >= 0 && row.weight <= WEIGHT_MAX
          ? row.weight
          : entry.weight
      return Object.freeze({ ...entry, status, weight })
    })
  )
}

/**
 * Whether a change would leave a segment with nothing live to send.
 *
 * A segment whose every first letter is paused is a queue that quietly
 * empties: the businesses in it are skipped run after run and nothing says
 * why. So the last first letter a segment can still send under cannot be
 * paused and cannot be weighted to nothing, and the console is refused rather
 * than the queue going silent. A segment with nothing live already is left to
 * be changed freely, since no change to it can take away what it does not
 * have. A holdout sends nothing and so never counts as keeping a segment
 * alive, whichever list it arrives in. A later step may be emptied: a chain
 * that waits at a step is a decision, not a silent queue.
 *
 * @param {ReadonlyArray<object>} variants The registry as it stands.
 * @param {string} id The variant being changed.
 * @param {{status?: string, weight?: number}} change What it is being changed to.
 * @returns {boolean} True when the change would empty the segment.
 */
export function wouldEmptySegment(variants, id, change) {
  const target = variants.find(entry => entry.id === id)
  if (!target || stepOf(target) !== 1) return false
  const sends = entry =>
    !entry.holdout &&
    entry.segment === target.segment &&
    (entry.source ?? null) === (target.source ?? null) &&
    stepOf(entry) === 1 &&
    entry.status === 'live' &&
    entry.weight > 0
  if (!variants.some(sends)) return false
  const after = variants.map(entry => (entry.id === id ? { ...entry, ...change } : entry))
  return !after.some(sends)
}

/** The variant an id names, or null where nothing does. */
export function variantById(id) {
  return VARIANTS.find(entry => entry.id === id) ?? null
}
