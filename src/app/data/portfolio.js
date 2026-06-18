/**
 * Client portfolio entries rendered by `@views/Portfolio`. Adding a new site is
 * a matter of appending one object — the page maps over the array, so no view
 * changes are required.
 *
 * Fields:
 * - `name`         Display name used as the card heading and image alt.
 * - `url`          Live site URL. Opens in a new tab from the card link.
 * - `displayUrl`   Hostname shown in the browser-chrome bar.
 * - `description`  One- or two-sentence pitch summarising the project.
 * - `accent`       Tailwind gradient classes for the placeholder swatch shown
 *                  before the live screenshot loads (and if it fails).
 */
export const PORTFOLIO_PROJECTS = [
  {
    name: 'Baytown Go Carts',
    url: 'https://baytowngocarts.com',
    displayUrl: 'baytowngocarts.com',
    description:
      'A modern marketing site for a Baytown go-kart track — hours, pricing, group bookings, and directions in a layout built to convert local search traffic into walk-ins.',
    accent: 'from-blue-500/30 via-indigo-500/20 to-slate-900/40',
  },
  {
    name: 'DeluxFit by Angie',
    url: 'https://deluxfitbyangie.com',
    displayUrl: 'deluxfitbyangie.com',
    description:
      'A polished brand site for a personal trainer — services, pricing, and a direct booking path designed to convert first-time visitors into scheduled sessions.',
    accent: 'from-rose-500/30 via-fuchsia-500/20 to-slate-900/40',
  },
  {
    name: 'SETX Football',
    url: 'https://setxfootball.org',
    displayUrl: 'setxfootball.org',
    description:
      'A local youth sports league site for Southeast Texas — season sign-ups, schedules, and shirt-order management in one streamlined hub for parents and coaches.',
    accent: 'from-green-500/30 via-lime-500/20 to-slate-900/40',
  },
  {
    name: 'Dickinson Bayou Fleeting',
    url: 'https://dickinsonbayoufleeting.com',
    displayUrl: 'dickinsonbayoufleeting.com',
    description:
      'A professional site for a Galveston Bay barge fleeting company — services, fleet capacity, and contact details built to establish credibility with maritime clients.',
    accent: 'from-cyan-500/30 via-sky-500/20 to-slate-900/40',
  },
]
