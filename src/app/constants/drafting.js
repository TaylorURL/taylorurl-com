import { matchViewKeys } from '@constants/routes'

/**
 * What a section draws on the field it shares with the rest of the page.
 *
 * Ground says what colour a section is; this says what is drawn on it, and the
 * two are independent - a ledger rule on paper and a ledger rule on a band are
 * one drawing at the two weights the rule tokens already carry. That is why
 * this is a table beside `@constants/grounds` rather than more roles inside
 * it: folding them together turns four grounds into forty, and it was the
 * folding that made two sections on one ground identical in the first place.
 *
 * Every motif is cut from the same rule on the same module, so a motif
 * changing is a change of which axes are drawn and never of scale or colour.
 * That is the whole bet. At the weights a page like this can carry, a change
 * of spacing between two bands is a difference of a fraction of one level of
 * grey and a reader will not see it; a change of direction is a difference a
 * reader sees at a glance and keeps seeing on a bad screen in a bright room.
 *
 * What each one means, because a backdrop that means nothing is a backdrop
 * that comes out:
 *
 *   plan    the survey sheet, both axes, for a band laid out as a mesh or a
 *           page stating the whole of its subject
 *   ledger  rows of like things read down: a list, a register, an archive, a
 *           schedule of charges, the body of a piece of writing
 *   column  parallel things set out side by side: tiers, options, a rack of
 *           cards, a comparison
 *   node    the setting-out points before any line is drawn - places, a map, a
 *           town, a route
 *   hatch   the section cut. On a drawing, hatching means the thing shown is
 *           solid and you do not pass through it, which is what an exclusion
 *           is. It is drawn nowhere the page is not saying stop
 *   iso     thirty and the vertical, near enough: the assembly drawing, for a
 *           section about how a thing is put together or where it stands
 *   quiet   the sheet's own rules and nothing between them, for a band that
 *           would be the third in a row carrying a drawing, and for a surface
 *           somebody is reading words on
 *
 * Every string is written out. The stylesheet is built by reading these files
 * and a name assembled at runtime is a name it never sees.
 */
export const DRAFTS = {
  plan: 'draft-plan',
  ledger: 'draft-ledger',
  column: 'draft-column',
  node: 'draft-node',
  hatch: 'draft-hatch',
  iso: 'draft-iso',
  quiet: 'draft-quiet',
}

/**
 * How the field meets the edges of the band it is drawn on.
 *
 *   band  the default, and the only one most sections want
 *   foot  the head fade off, for a closing call - its top edge already carries
 *         an accent rule and the aurora behind it, and the aurora is drawn
 *         under the field rather than over it, so a head fade would pour the
 *         ground over the brightest part of it
 *   hero  the head fade off and the foot deepened, for a slab at the top of a
 *         document whose field drifts under a parallax: the drift carries the
 *         fade with it, so the fade has to have finished before the drift can
 *         expose the section's own edge
 *   card  no fade at all, for an object bounded by its own edge
 */
export const SEAMS = {
  band: '',
  foot: 'draft-foot-only',
  hero: 'draft-foot-only draft-foot-deep',
  card: 'draft-flush',
}

/**
 * The module a page is drawn on.
 *
 * A drawing set has one sheet module and every sheet in it is drawn at a scale
 * that divides it. This is that module, and it is a fact about a page rather
 * than about a section: it is set once above the routed view and inherited, so
 * the datum rules that cross one seam on a page are the rules that cross every
 * other one, and a section can never be told the wrong module because it is
 * never told anything.
 *
 * It travels as a number on the element rather than as a rule, and that is not
 * a detail. A rule keyed on an attribute is inlined into every one of the
 * site's prerendered documents whether that document draws it or not; a rule
 * keyed on a class is one more class for every module the site holds. A custom
 * property in a style attribute is neither, and the prerender is set to leave
 * inline styles alone.
 *
 * Sixty-four to a hundred and twenty-eight, and no wider, because a paper band
 * draws at half of whatever this is: below sixty-four the halved band is
 * tighter than the eye resolves at these weights, and above a hundred and
 * twenty-eight a phone-width band shows too few rules to read as a field.
 *
 * Which module a page takes is one decision on one criterion. A page whose
 * content is a catalogue - a mesh of towns, trades, tools, posts or figures -
 * takes a close module, because the tighter sheet sits nearer the pitch the
 * items are laid out on. A page that is written rather than listed takes a
 * wide one. Pages in a family share a motif and separate on the module, so a
 * reader moving from an index to one of its details arrives somewhere related
 * rather than somewhere else.
 */
const MODULES = {
  Home: '96px',
  About: '112px',
  Services: '80px',
  ServiceDetail: '96px',
  ServiceSeo: '64px',
  BusinessEmail: '128px',
  Pricing: '112px',
  Contact: '64px',
  Start: '80px',
  Process: '128px',
  Portfolio: '96px',
  CaseStudy: '80px',
  Blog: '96px',
  BlogSeries: '96px',
  BlogPost: '128px',
  Notes: '80px',
  NotesIssue: '112px',
  Faq: '96px',
  Live: '128px',
  Tools: '112px',
  ToolPage: '112px',
  SpeedCheck: '64px',
  Industries: '64px',
  Industry: '64px',
  Areas: '128px',
  Area: '112px',
  Privacy: '112px',
  Terms: '112px',
  License: '112px',
  ConfirmSubscription: '96px',
  Unsubscribe: '96px',
  NotFound: '64px',
}

const HOUSE = '96px'

/**
 * The module the page at a path is drawn on, as the style its root takes.
 *
 * It resolves the view rather than the path, so the twenty-odd routes one view
 * answers for are one sheet and a town or a trade added to the data arrives
 * already dressed. The deepest matching view wins, which is what puts a case
 * study on its own module rather than on the portfolio's.
 *
 * @param {string} pathname
 * @returns {Record<string, string>} the style the page root takes
 */
export function moduleFor(pathname) {
  const held = matchViewKeys(pathname).reduce((found, key) => MODULES[key] || found, HOUSE)
  return { '--sig-tile': held }
}

/**
 * The motif a section takes from its place in a page's own rotation, the way a
 * section takes its ground from `groundAt`.
 *
 * A page states its ring once and its bands read from it, so adding a band in
 * the middle cannot leave two neighbours drawing the same thing. The rings are
 * three and four long against a ground alternation that is two, and the two
 * periods share no factor - so a page never draws the same ground and motif
 * together twice running, and never falls into a visible cycle inside its own
 * length.
 *
 * @param {number} index
 * @param {readonly string[]} ring
 */
export function draftAt(index, ring) {
  return ring[index % ring.length]
}

/**
 * The rings the location and trade pages run on.
 *
 * They hold the motif's own name rather than its class, because that is what a
 * section is given: `draft` is a name and the component resolves it against
 * `DRAFTS`. A ring of classes resolves to nothing, and nothing is a section
 * drawing the bare field with no error anywhere.
 */
export const RINGS = {
  survey: ['plan', 'ledger', 'column'],
  build: ['plan', 'iso', 'column', 'ledger'],
}
