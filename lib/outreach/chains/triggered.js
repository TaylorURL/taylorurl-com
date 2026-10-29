/**
 * The chains that fire on something that just happened.
 *
 * Each one is the same shape: a trigger files a business under its own source
 * with the one named defect written on the row, and the letters open on that
 * sentence. What makes them worth more than a sweep of the map is that the
 * reader can check the thing in ten seconds and it is theirs.
 *
 * `needs` is what keeps a letter from being sent about nothing. A business on
 * one of these chains whose stored sentence has gone - the fault was fixed and
 * the row swept - is held rather than written to, and the exit takes it off
 * the chain entirely.
 *
 * The broken-site chain rings on its middle step rather than writing. A site
 * that has stopped working is the one case where a telephone beats a second
 * letter: the owner may not be reading the inbox the letter went to, and the
 * thing being reported is urgent enough to be worth interrupting somebody
 * over. The step is handed to the phone desk, which is what
 * lib/outreach/sending/desk-step.js writes on the row.
 */

import { defineChain, fromCode } from 'chainwork/core'
import {
  againLastOpener,
  againOpener,
  brokenSiteAgainOpener,
  brokenSiteLastOpener,
  brokenSiteOpener,
  builderAgainOpener,
  builderLastOpener,
  builderOpener,
  growingAgainOpener,
  growingOpener,
  listingAgainOpener,
  listingLastOpener,
  listingOpener,
  partnerAgainOpener,
  partnerLastOpener,
  partnerOpener,
} from '../openers/plain/fault.js'

/** A business whose stored defect has gone has nothing left to be written about. */
const faultFixed = row => !row?.fault_says

/** Every one of these letters is plain, like the cold intro's. */
const letter = (open, rest = {}) => ({
  channel: 'email',
  letter: fromCode(open),
  plain: true,
  ...rest,
})

/** A last letter drops the unsubscribe line, as the other chains' last letters do. */
const last = open => letter(open, { unsubscribeLink: false })

export const brokenSite = defineChain({
  id: 'broken-site',
  name: 'Broken site',
  about: 'The certificate has expired, the home page errors, or the domain is about to lapse.',
  source: 'broken-site',
  exits: [faultFixed],
  steps: [
    { at: 0, ...letter(brokenSiteOpener), needs: ['fault_says'] },
    { at: 3, slug: 'call', channel: 'call' },
    { at: 7, slug: 'again', ...letter(brokenSiteAgainOpener) },
    { at: 14, slug: 'last', ...last(brokenSiteLastOpener) },
  ],
})

export const listing = defineChain({
  id: 'listing',
  name: 'Listing',
  about: 'The Google listing has no site, no photographs or no reviews on it.',
  source: 'listing',
  exits: [faultFixed],
  steps: [
    { at: 0, ...letter(listingOpener), needs: ['fault_says'] },
    { at: 7, slug: 'again', ...letter(listingAgainOpener) },
    { at: 18, slug: 'last', ...last(listingLastOpener) },
  ],
})

export const builder = defineChain({
  id: 'builder',
  name: 'Site builder',
  about: 'The site is on a builder the business has outgrown.',
  source: 'builder',
  exits: [faultFixed],
  steps: [
    { at: 0, ...letter(builderOpener), needs: ['fault_says'] },
    { at: 7, slug: 'again', ...letter(builderAgainOpener) },
    { at: 21, slug: 'last', ...last(builderLastOpener) },
  ],
})

export const growing = defineChain({
  id: 'growing',
  name: 'Growing',
  about: 'The business has gained a run of Google reviews since it was first looked at.',
  source: 'growing',
  steps: [
    { at: 0, ...letter(growingOpener), needs: ['fault_says'] },
    { at: 12, slug: 'again', ...last(growingAgainOpener) },
  ],
})

export const reactivation = defineChain({
  id: 'again',
  name: 'Asked again',
  about: 'A business put aside or written to months ago, asked once more.',
  source: 'reactivation',
  steps: [
    { at: 0, ...letter(againOpener) },
    { at: 14, slug: 'last', ...last(againLastOpener) },
  ],
})

export const partner = defineChain({
  id: 'partner',
  name: 'Partner',
  about:
    'An accountant, broker, agent or sign shop who talks to the same businesses, asked for a working relationship rather than sold to.',
  source: 'partner',
  steps: [
    { at: 0, ...letter(partnerOpener) },
    { at: 8, slug: 'again', ...letter(partnerAgainOpener) },
    { at: 20, slug: 'last', ...last(partnerLastOpener) },
  ],
})

/** The triggered chains, in the order their letters are registered in. */
export const TRIGGERED = Object.freeze([
  brokenSite,
  listing,
  builder,
  growing,
  reactivation,
  partner,
])
