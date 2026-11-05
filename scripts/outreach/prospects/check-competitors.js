/**
 * Proves the call list knows another web or marketing business when it sees
 * one, and knows the businesses that only sound like one.
 *
 * The competitors are the ten the list was offering on 2026-11-05, every one
 * a new company off the state's filings, and a listing off the map named for
 * the work. The look-alikes are listings off the same table that day: hair
 * salons called Hair Design, a print shop called Target Media, an HVAC firm
 * called Digital, a realtor whose name ends in Technology Enhanced Marketing,
 * a mechanic in Webster.
 *
 *   node scripts/outreach/prospects/check-competitors.js
 */
import {
  AGENCY_TERMS,
  COMPETITOR_REASON,
  isCompetitor,
} from '../../../lib/outreach/prospects/competitors.js'
import { isRingable, uncallableReason } from '../../../lib/outreach/prospects/calls.js'
import { check, finish, ok, same } from '../../harness/checks.js'

/** A company off the state's filings, as its mirror row carries it. */
const filed = (name, website = null) => ({ name, trade: null, website, source: 'new-business' })
/** A listing off the map, filed under the trade it was searched for. */
const listed = (name, trade, website = null) => ({ name, trade, website, source: 'places' })

const COMPETITORS = [
  filed('Idea Web Agency', 'https://ideawebagency.com/'),
  filed('Chisholm Digital', 'https://chisholmdigital.com/'),
  filed('Synergy Core Digital', 'https://synergycoredigital.site/'),
  filed('Willfully Digital', 'https://willfullydigital.com/'),
  filed('Mederos Marketing Group', 'https://mederosmarketinggroup.com/'),
  filed('Dfw-Marketing Solutions', 'https://dfwmarketingsolutions.net/'),
  filed('Hales Market & Media', 'https://halesmarketmedia.site/'),
  filed('Maria Joaquina Creative Strategies'),
  filed('Kslugs Software Solutions', 'https://kslugssoftwaresolutions.com/'),
  filed('Tidewater ADS', 'https://tidewaterads.com/'),
  filed('Rivera Holdings LLC', 'https://riverawebdesign.com/'),
  listed('Bayou City Web Design', 'printing'),
  listed('Gulf Coast SEO', 'landscaping'),
  listed('Clear Lake Social Media Marketing', 'hair salon'),
]

const LOOK_ALIKES = [
  listed("Adrian's Hair Design", 'hair salon'),
  listed('Target Media TX', 'printing'),
  listed('Array Signs & Graphics LLC', 'printing'),
  listed('Digital HVAC Repair League City', 'HVAC contractor'),
  listed('By George Realty | Seabrook, TX | Technology Enhanced Marketing', 'real estate agency'),
  listed('WEBSTER MOBILE MECHANICS & BODY REPAIR', 'auto repair'),
  listed('Autonation fleet remarketing', 'auto repair'),
  listed('Creative Welding Works & Fencing', 'welding'),
  filed('Aquatic Design Group'),
  filed('Graphics Atoz'),
  filed('Precision Race Development'),
  filed('Digital Dental Lab of Katy'),
  filed('Social Grounds Coffee'),
  filed("Brad's Roadside Repair"),
  listed('Ads Plus Printing', 'printing'),
]

check('the web and marketing businesses the list was offering are known for what they are', () => {
  for (const one of COMPETITORS) ok(isCompetitor(one), `${one.name} read as an ordinary business`)
})

check('a business that only sounds like one is still offered', () => {
  for (const one of LOOK_ALIKES) ok(!isCompetitor(one), `${one.name} read as a competitor`)
  ok(!isCompetitor(null), 'nothing at all')
  ok(!isCompetitor({}), 'a row with nothing on it')
})

check('the agency words are chainwork’s own, read on every listing', () => {
  ok(AGENCY_TERMS.includes('web design'), 'chainwork’s agency rule was not found')
  ok(isCompetitor(listed('Harbor Digital Marketing', 'printing')), 'one of its words')
})

check('both doors onto the call list turn a competitor away', () => {
  const agency = {
    ...filed('Chisholm Digital', 'https://chisholmdigital.com/'),
    phone: '(254) 555-0103',
    site_kind: 'own',
    stage: 'contacted',
    business_status: null,
  }
  same(uncallableReason(agency), COMPETITOR_REASON, 'a stranger is not offered')
  same(isRingable(agency), false, 'and one who opened the mail is not rung either')
  const shop = { ...agency, name: 'Chisholm Plumbing', website: 'https://chisholmplumbing.com/' }
  same(uncallableReason(shop), null, 'the same row as a plumber is')
  same(isRingable(shop), true, 'and may be rung')
})

await finish()

console.log('competitors: web, app and marketing businesses stay off the call list')
