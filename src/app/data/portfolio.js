/**
 * Client portfolio entries rendered by `@views/Portfolio`. Adding a new site is
 * a matter of appending one object — the page maps over the array, so no view
 * changes are required.
 *
 * Previews are rendered as live, non-interactive <iframe> thumbnails pointed
 * at `url`. The iframe is rendered at a desktop-class logical width and
 * CSS-`transform: scale()`d down to fit the card, so each card shows the
 * current production version of the site on every page load — never a saved
 * screenshot or build-time snapshot.
 *
 * Fallback: if a site refuses framing (X-Frame-Options / CSP) or the iframe
 * load times out, the card swaps to a fresh server-rendered screenshot from
 * thum.io with a per-page-load cache-busting query param, so the fallback
 * also reflects the current site rather than a stale cached snapshot.
 *
 * Order is intentionally mixed across categories (SaaS → recreation → industrial
 * → personal brand → property → community) so the showcase reads as a varied
 * portfolio instead of a grouped list.
 *
 * Fields:
 * - `name`         Display name used as the row heading and iframe title.
 * - `url`          Live site URL. Used as the iframe src, the screenshot
 *                  fallback source, and the row's outbound link.
 * - `displayUrl`   Hostname shown in the browser-chrome bar.
 * - `tagline`      Short category / stack chip surfaced above the heading.
 * - `description`  One- or two-sentence pitch summarising the project.
 */
export const PORTFOLIO_PROJECTS = [
  {
    name: 'Smyrna Tools',
    url: 'https://smyrnatools.com',
    displayUrl: 'smyrnatools.com',
    tagline: 'Operations SaaS · React · Supabase',
    description:
      'A regional management tool for a concrete ready-mix operation. Tracks assets, personnel, productivity, and efficiency so the team can run the yard from one screen.',
  },
  {
    name: 'Baytown Go Karts',
    url: 'https://baytowngokarts.com',
    displayUrl: 'baytowngokarts.com',
    tagline: 'Local recreation · Conversion site',
    description:
      'A modern site for a Baytown go-kart track. Hours, pricing, group bookings, and directions — laid out to turn people searching for fun nearby into walk-ins through the gate.',
  },
  {
    name: 'Dickinson Bayou Fleeting',
    url: 'https://dickinsonbayoufleeting.com',
    displayUrl: 'dickinsonbayoufleeting.com',
    tagline: 'Maritime industrial · Brand site',
    description:
      'A professional site for a Galveston Bay barge fleeting company. Services, fleet capacity, and contact details laid out to look like the serious operation it is.',
  },
  {
    name: 'DeluxFit by Angie',
    url: 'https://deluxfitbyangie.com',
    displayUrl: 'deluxfitbyangie.com',
    tagline: 'Personal brand · Booking funnel',
    description:
      'A clean brand site for a personal trainer. Services, pricing, and a clear booking path so first-time visitors actually end up on the schedule.',
  },
  {
    name: 'Hollingshead Harbor',
    url: 'https://hollingsheadharbor.com',
    displayUrl: 'hollingsheadharbor.com',
    tagline: 'Property & community · Marketing site',
    description:
      'The official site for Hollingshead Harbor. A clear front door for customers — learn about the company, apply, and get in touch — all in one place.',
  },
  {
    name: 'SETX Football',
    url: 'https://setxfootball.org',
    displayUrl: 'setxfootball.org',
    tagline: 'Youth sports league · Parent portal',
    description:
      'A Southeast Texas youth football league site. Season sign-ups, schedules, and shirt orders pulled into one easy place for parents and coaches.',
  },
]
