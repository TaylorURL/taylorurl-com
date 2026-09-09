import { SERVICE_LINES as TAYLORWEBSITE_LINES } from '../taylorwebsite/servicesTaylorwebsite.js'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

// The four things TaylorURL sells, in the order the services page presents
// them. The index renders its rows from this list, each line has a page of its
// own at `path`, and the navigation's Services panel renders its entries from
// the same list, so a service cannot exist in one of the three and not the
// others.
//
// `slug` does two jobs. It is the id the index puts on the row, so
// `/services#<slug>` still lands on the service it names, and it is the last
// segment of that service's own page.
// `summary` is the one line a menu row or a card shows; the pages themselves
// run longer than either can hold.
const LINES = [
  {
    slug: 'new-website',
    name: 'A Brand-New Website',
    summary: 'Designed around your business, not a template.',
  },
  {
    slug: 'redesign',
    name: 'Rebuilding Your Current Site',
    summary: 'Rebuilt from the ground up when the old one stopped earning.',
  },
  {
    slug: 'online-tools',
    name: 'Booking, Ordering, and Tools',
    summary: 'Booking and payment at the front, ad tracking and cold email underneath.',
  },
  {
    slug: 'care',
    name: 'Keeping It Running',
    summary: 'Hosting, security, backups, and a direct line to the team.',
  },
]

/**
 * The lines for whichever site is building.
 *
 * Compared against the substituted literal rather than looked up, so the site
 * that lost is dropped from the bundle instead of shipping the other offer's
 * copy inside this one.
 *
 * The studio's list is built inside the branch rather than in a const above it.
 * A `const` holding a `.map()` call reads as possibly side-effecting, so the
 * bundler keeps it even where nothing references it, and `LINES` with it - which
 * is how the studio's four service names were still in the subsidiary's chunk
 * after the selection had already picked the other list.
 */
export const SERVICE_LINES = IS_SECOND_SITE
  ? TAYLORWEBSITE_LINES
  : LINES.map(line => ({ ...line, path: `/services/${line.slug}` }))
