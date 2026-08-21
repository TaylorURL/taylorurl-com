/**
 * Client portfolio entries rendered by `@views/Portfolio`. Adding a new site is
 * a matter of appending one object and running `npm run capture:portfolio` to
 * generate its preview images — the page maps over the array, so no view
 * changes are required.
 *
 * Previews are WebP captures committed under `public/portfolio/`, one desktop
 * and one phone shot per site, produced by `scripts/capture-portfolio.js`.
 * Static images keep the page smooth to scroll — a live embed of one of these
 * sites costs 0.3–1 MB of JavaScript per frame, twice per row, booting during
 * the scroll it would be judged by. Re-run the capture script when a client
 * site changes enough that its preview should too.
 *
 * Fallback: if a capture is missing (say, a new entry added before the script
 * has run), the card swaps to a server-rendered screenshot from thum.io so the
 * row still shows the real site.
 *
 * Order is intentionally mixed across categories (SaaS → recreation →
 * fintech → game → print → industrial → personal brand → dev studio →
 * property → industrial services → community) so the showcase reads as a
 * varied portfolio instead of a grouped list.
 *
 * Fields:
 * - `name`         Display name used as the row heading and preview alt text.
 * - `url`          Live site URL. Used as the capture source, the screenshot
 *                  fallback source, and the row's outbound link.
 * - `displayUrl`   Hostname shown in the browser-chrome bar; also names the
 *                  capture files.
 * - `tagline`      Short category / stack chip surfaced above the heading.
 * - `description`  One- or two-sentence pitch summarising the project.
 */
export const PORTFOLIO_PROJECTS = [
  {
    name: 'Smyrna Tools',
    url: 'https://smyrnatools.com',
    displayUrl: 'smyrnatools.com',
    tagline: 'Operations SaaS · Management dashboard',
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
    name: 'Root & Rise',
    url: 'https://rootriseholdings.com',
    displayUrl: 'rootriseholdings.com',
    tagline: 'Trading signals · Fintech platform',
    description:
      'A Smart Money Concepts signal-intelligence platform for gold, indices, and FX. Scripts read market structure around the clock and flag high-conviction setups — the trader always holds the trigger.',
  },
  {
    name: 'DomeBreak',
    url: 'https://domebreak.com',
    displayUrl: 'domebreak.com',
    tagline: 'Strategy game · Real-time web app',
    description:
      'A real-time missile defense and offense game played across a live world map. Built for fast, tactical rounds where every player can see the fight unfold globally as it happens.',
  },
  {
    name: 'Impressiva Printing',
    url: 'https://impressivaprinting.com',
    displayUrl: 'impressivaprinting.com',
    tagline: 'Custom print studio · Order portal',
    description:
      'A sharp storefront for a custom print studio — business cards to building-size banners. Customers request quotes, upload artwork, and track their orders in one place.',
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
    name: 'Knight Plugins',
    url: 'https://knightplugins.com',
    displayUrl: 'knightplugins.com',
    tagline: 'Game dev studio · Service site',
    description:
      'The home of a custom Minecraft plugin studio. Spigot, Paper, and Bukkit plugins built to spec, ready-made plugins on SpigotMC, and support from the original developer after launch.',
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
    name: 'Compound Scale Services',
    url: 'https://ccscaleservices.com',
    displayUrl: 'ccscaleservices.com',
    tagline: 'Industrial services · Brand site',
    description:
      'A brand site for a family-owned scale company in Huffman, Texas. Calibration, repair, and parts for industrial weighing equipment, laid out so customers can find their service and request a quote fast.',
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

/**
 * Public path of a project's committed preview image. Shared by the Portfolio
 * view (as the img src) and `scripts/capture-portfolio.js` (as the output
 * path), so the two can never disagree about where a capture lives.
 *
 * @param {{ displayUrl: string }} project Entry from `PORTFOLIO_PROJECTS`.
 * @param {'desktop' | 'phone'} device Which of the two captures to point at.
 * @returns {string} Root-relative URL, e.g. `/portfolio/smyrnatools-com-desktop.webp`.
 */
export function portfolioPreviewSrc(project, device) {
  return `/portfolio/${project.displayUrl.replace(/\./g, '-')}-${device}.webp`
}

// thum.io option handling is fragile: `crop` is ignored, `maxAge` corrupts
// the render config, `wait` alone drops to a 600px render, and `width` plus
// `wait` caps at a 1200x1200 square. That square is still the right desktop
// recipe: it is the largest render the `wait` holds open long enough for
// client-rendered pages to finish painting — without the wait, late-drawing
// backgrounds are missing from the shot, and the slowest canvas backgrounds
// need more than eight seconds to paint. The capture script crops
// the square down to the 16:10 the desktop stage shows, so no hidden rows
// ship. The iPhone recipe's 375x812 output matches the phone frame's 390:844
// aspect to within a tenth of a percent and needs no crop.
const SCREENSHOT_SERVICE_PREFIX = {
  desktop: 'https://image.thum.io/get/width/1280/wait/10/',
  phone: 'https://image.thum.io/get/iphoneX/wait/10/',
}

/**
 * Server-rendered screenshot of a project's live site from thum.io. The
 * Portfolio view uses it as the fallback when a committed capture is missing;
 * `scripts/capture-portfolio.js` uses it as the source the committed captures
 * are downloaded from.
 *
 * @param {{ url: string }} project Entry from `PORTFOLIO_PROJECTS`.
 * @param {'desktop' | 'phone'} device Which viewport to render.
 * @returns {string} Full thum.io URL for the shot.
 */
export function portfolioScreenshotServiceUrl(project, device) {
  return `${SCREENSHOT_SERVICE_PREFIX[device]}${project.url}`
}
