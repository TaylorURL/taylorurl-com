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
      'A modern marketing site for a Baytown go-kart track — hours, pricing, group bookings, and directions in a layout built to convert local search traffic into walk-ins.',
  },
  {
    name: 'DeluxFit by Angie',
    url: 'https://deluxfitbyangie.com',
    displayUrl: 'deluxfitbyangie.com',
    description:
      'A polished brand site for a personal trainer — services, pricing, and a direct booking path designed to convert first-time visitors into scheduled sessions.',
  },
  {
    name: 'SETX Football',
    url: 'https://setxfootball.org',
    displayUrl: 'setxfootball.org',
    description:
      'A local youth sports league site for Southeast Texas — season sign-ups, schedules, and shirt-order management in one streamlined hub for parents and coaches.',
  },
  {
    name: 'Dickinson Bayou Fleeting',
    url: 'https://dickinsonbayoufleeting.com',
    displayUrl: 'dickinsonbayoufleeting.com',
    description:
      'A professional site for a Galveston Bay barge fleeting company — services, fleet capacity, and contact details built to establish credibility with maritime clients.',
  },
]
