import { SERVICE_LINES as TAYLORWEBSITE_LINES } from '../taylorwebsite/servicesTaylorwebsite.js'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

// Everything TaylorURL sells, in three lists that are the three columns of the
// Services menu and the three bands of the services page. A service cannot be
// in the menu and missing from the page, or on the page and missing from the
// sitemap, because all three read these lists and nothing else.
//
// The lists are drawn by what a reader pays for. The lines are the two ways a
// site is bought. What is included comes with every site, inside the build or
// the monthly, and a page of its own does not make it a second bill. The
// software is the work quoted as a project of its own.
//
// `slug` does two jobs. It is the id the index puts on the row, so
// `/services#<slug>` still lands on the service it names, and it is the last
// segment of that service's own page.
// `summary` is the one line a menu row or a card shows; the pages themselves
// run longer than either can hold. On an included service it says where the
// cost sits, because that is the question a card for one raises.
const LINES = [
  {
    slug: 'new-website',
    name: 'Custom Website Design',
    summary: 'Designed around your business, not a template.',
  },
  {
    slug: 'redesign',
    name: 'Website Redesign',
    summary: 'A site that stopped bringing work in, rebuilt from the frame up.',
  },
]

const INCLUDED = [
  {
    slug: 'online-tools',
    name: 'Booking and Online Ordering',
    summary: 'Appointments, orders, and payment taken on the site. Part of the build.',
  },
  {
    slug: 'business-email',
    name: 'Company Email',
    summary: 'Mail at your own domain, set up with the site. The provider bills the mailboxes.',
  },
  {
    slug: 'ad-tracking',
    name: 'Ad Tracking Setup',
    summary: 'The Meta Pixel, Google Ads tag, and analytics, installed with the site.',
  },
  {
    slug: 'seo',
    name: 'SEO and Google Rankings',
    summary: 'Search work every month, inside the monthly rather than billed on top.',
  },
  {
    slug: 'care',
    name: 'Hosting and Care',
    summary: 'Hosting, security, backups, and changes any time, all inside the monthly.',
  },
]

const SOFTWARE = [
  {
    slug: 'mobile-apps',
    name: 'Mobile Apps',
    summary: 'An app on both stores, quoted as a project of its own.',
  },
  {
    slug: 'desktop-apps',
    name: 'Desktop Apps',
    summary: 'Software for Windows and Mac, built around how the shop works.',
  },
  {
    slug: 'automation',
    name: 'Business Automation',
    summary: 'The work you still do by hand, done by software instead.',
  },
  {
    slug: 'ai-integration',
    name: 'AI Integration',
    summary: 'AI built around your business, from managing email to systems that cut the workload.',
  },
]

const withPath = list => list.map(service => ({ ...service, path: `/services/${service.slug}` }))

/**
 * The lines for whichever site is building.
 *
 * Compared against the substituted literal rather than looked up, so the site
 * that lost is dropped from the bundle instead of shipping the other offer's
 * copy inside this one.
 *
 * The studio's lists are built inside the branch rather than in a const above
 * it. A `const` holding a `.map()` call reads as possibly side-effecting, so the
 * bundler keeps it even where nothing references it, and `LINES` with it - which
 * is how the studio's four service names were still in the subsidiary's chunk
 * after the selection had already picked the other list.
 */
export const SERVICE_LINES = IS_SECOND_SITE ? TAYLORWEBSITE_LINES : withPath(LINES)

/** What comes with every site. Empty on the subsidiary. */
export const INCLUDED_SERVICES = IS_SECOND_SITE ? [] : withPath(INCLUDED)

/** The software quoted as its own project. Empty on the subsidiary. */
export const SOFTWARE_SERVICES = IS_SECOND_SITE ? [] : withPath(SOFTWARE)

/**
 * What the Start page offers as the work itself: a site, or the software
 * quoted as its own project. AI integration is left to the extras, because it
 * goes into something the business already has or is having built.
 */
const START_MAIN_SLUGS = ['new-website', 'redesign', 'mobile-apps', 'desktop-apps', 'automation']
const START_ADD_ON_SLUGS = [
  'online-tools',
  'business-email',
  'ad-tracking',
  'seo',
  'care',
  'ai-integration',
]

const bySlug = (list, slugs) => slugs.map(slug => list.find(service => service.slug === slug))

/** The services the Start page lets a sender pick one of. */
export const START_SERVICES = IS_SECOND_SITE
  ? SERVICE_LINES
  : bySlug([...SERVICE_LINES, ...SOFTWARE_SERVICES], START_MAIN_SLUGS)

/** The extras the Start page lets a sender tick. Empty on the subsidiary. */
export const START_ADD_ONS = IS_SECOND_SITE
  ? []
  : bySlug([...INCLUDED_SERVICES, ...SOFTWARE_SERVICES], START_ADD_ON_SLUGS)

/** Every service, in the order the menu and the index read them. */
export const ALL_SERVICES = [...SERVICE_LINES, ...INCLUDED_SERVICES, ...SOFTWARE_SERVICES]
