/**
 * Client portfolio entries rendered by `@views/Portfolio`. Adding a new site is
 * a matter of appending one object — the page maps over the array, so no view
 * changes are required.
 *
 * Previews are rendered as live iframes pointed at `url`, so each card shows
 * the current production version of the site on every page load. No saved
 * screenshot or build-time snapshot is involved.
 *
 * Fields:
 * - `name`         Display name used as the card heading and iframe title.
 * - `url`          Live site URL. Used both as the iframe src (with a
 *                  per-page-load cache-buster) and as the card's outbound link.
 * - `displayUrl`   Hostname shown in the browser-chrome bar.
 * - `description`  One- or two-sentence pitch summarising the project.
 */
export const PORTFOLIO_PROJECTS = [
  {
    name: 'Baytown Go Carts',
    url: 'https://baytowngocarts.com',
    displayUrl: 'baytowngocarts.com',
    description:
      'A modern site for a Baytown go-kart track. Hours, pricing, group bookings, and directions — laid out to turn people searching for fun nearby into walk-ins through the gate.',
  },
  {
    name: 'DeluxFit by Angie',
    url: 'https://deluxfitbyangie.com',
    displayUrl: 'deluxfitbyangie.com',
    description:
      'A clean brand site for a personal trainer. Services, pricing, and a clear booking path so first-time visitors actually end up on the schedule.',
  },
  {
    name: 'SETX Football',
    url: 'https://setxfootball.org',
    displayUrl: 'setxfootball.org',
    description:
      'A Southeast Texas youth football league site. Season sign-ups, schedules, and shirt orders pulled into one easy place for parents and coaches.',
  },
  {
    name: 'Dickinson Bayou Fleeting',
    url: 'https://dickinsonbayoufleeting.com',
    displayUrl: 'dickinsonbayoufleeting.com',
    description:
      'A professional site for a Galveston Bay barge fleeting company. Services, fleet capacity, and contact details laid out to look like the serious operation it is.',
  },
  {
    name: 'Hollingshead Harbor',
    url: 'https://hollingsheadharbor.com',
    displayUrl: 'hollingsheadharbor.com',
    description:
      'The official site for Hollingshead Harbor. A clear front door for customers — learn about the company, apply, and get in touch — all in one place.',
  },
  {
    name: 'Smyrna Tools',
    url: 'https://smyrnatools.com',
    displayUrl: 'smyrnatools.com',
    description:
      'A regional management tool for a concrete ready-mix operation. Tracks assets, personnel, productivity, and efficiency so the team can run the yard from one screen.',
  },
]
