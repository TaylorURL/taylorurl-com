/**
 * Client portfolio entries rendered by `@views/Portfolio`. Adding a new site is
 * a matter of appending one object and running `npm run capture:portfolio` to
 * generate its preview images — the page maps over the array, so no view
 * changes are required.
 *
 * Previews are WebP captures committed under `public/portfolio/`, one desktop
 * and one phone shot per site, produced by `scripts/portfolio/capture-portfolio.js`.
 * Static images keep the page smooth to scroll — a live embed of one of these
 * sites costs 0.3–1 MB of JavaScript per frame, twice per row, booting during
 * the scroll it would be judged by. Re-run the capture script when a client
 * site changes enough that its preview should too.
 *
 * Fallback: if a capture is missing (say, a new entry added before the script
 * has run), the card swaps to a server-rendered screenshot from thum.io so the
 * row still shows the real site.
 *
 * Order deliberately alternates category rather than grouping like with like,
 * so the page reads as varied work instead of as a sorted list. Insert a new
 * entry where its category breaks up its neighbours rather than appending it.
 *
 * Fields:
 * - `name`         Display name used as the row heading and preview alt text.
 * - `slug`         URL segment of the entry's case study, at `/portfolio/:slug`.
 *                  Every entry carries one so the row can link to its study and
 *                  the build can name the page it renders.
 * - `kind`         `'client'` for work built for an outside business, `'product'`
 *                  for a TaylorURL product. The row label and the case study's
 *                  framing both read from it, so a product is never presented as
 *                  a client engagement.
 * - `url`          Live site URL. Used as the capture source, the screenshot
 *                  fallback source, and the row's outbound link.
 * - `displayUrl`   Hostname shown in the browser-chrome bar; also names the
 *                  capture files.
 * - `tagline`      Short category / stack chip surfaced above the heading.
 * - `trades`       Trade slugs from `@data/towns-and-trades/trades` this site is proof for. The
 *                  configurator on /start joins on them, so naming a slug here
 *                  is the whole of what makes a client the worked example for
 *                  that trade. Slugs with no control in the grid yet — welding,
 *                  industrial, recreation, youth-sports — are carried so a
 *                  trade added to the grid arrives with its proof already
 *                  attached. An empty array is a site offered as general work.
 * - `town`         Where the client trades, for the entries whose reach is one
 *                  place. Sites working a region rather than a town carry none.
 * - `location`     Where the business trades, where its own site states one.
 *                  Separate from `town`, which the /start configurator reads.
 * - `description`  One- or two-sentence pitch summarising the project.
 * - `hasStudy`     Whether `@data/portfolioStudies` carries a case study for
 *                  this entry, which is what the index row reads to decide
 *                  whether to link through. The study itself lives there rather
 *                  than here so that the nav, which needs three names and three
 *                  preview paths, does not carry twenty-five kilobytes of prose
 *                  into every page of the site.
 * - `pagespeed`    Google PageSpeed Insights performance scores for the live
 *                  site, each the median of `runs` runs on that strategy, with
 *                  the date they were taken. `runs` is carried rather than
 *                  assumed because the study page states it, and a site slow
 *                  enough to time the API out takes more samples than three to
 *                  land that many. Re-measure and update the date rather than
 *                  carrying an old figure forward.
 */
export const PORTFOLIO_PROJECTS = [
  {
    name: 'Speedway 146',
    slug: 'speedway-146',
    kind: 'client',
    url: 'https://baytowngokarts.com',
    displayUrl: 'baytowngokarts.com',
    tagline: 'Local recreation · Conversion site',
    trades: ['recreation'],
    town: 'Baytown',
    location: 'Baytown, Texas',
    description:
      'Five-minute heats, indoor bounce houses, and a party room that seats sixty. The prices sit on one page and the tickets go through a checkout, so a parent planning Saturday can book without calling.',
    pagespeed: { mobile: 93, desktop: 100, runs: 3, measured: '2026-09-05' },
    hasStudy: true,
  },
  {
    name: 'Impressiva Printing',
    slug: 'impressiva-printing',
    kind: 'client',
    url: 'https://impressivaprinting.com',
    displayUrl: 'impressivaprinting.com',
    tagline: 'Custom print studio · Order portal',
    trades: ['printing'],
    location: 'Pasadena, Texas',
    description:
      'A hundred business cards or a ten-foot vinyl banner, off five different presses in one Pasadena shop. Customers upload the artwork, approve the proof, and follow the job through the pipeline the floor runs on.',
    pagespeed: { mobile: 97, desktop: 100, runs: 3, measured: '2026-09-05' },
    hasStudy: true,
  },
  {
    name: 'Dickinson Bayou Fleeting',
    slug: 'dickinson-bayou-fleeting',
    kind: 'client',
    url: 'https://dickinsonbayoufleeting.com',
    displayUrl: 'dickinsonbayoufleeting.com',
    tagline: 'Marine terminal · Dock leasing site',
    trades: ['marine-services'],
    town: 'Dickinson',
    location: 'Dickinson, Texas',
    description:
      'Two five-acre gated waterfront yards on the upper Texas Gulf Coast, let by the month with the shore crew already on them. Monochrome, with the rate and the phone number on every screen, because a phone on one bar out on a dock is what the site has to load on.',
    pagespeed: { mobile: 96, desktop: 99, runs: 3, measured: '2026-09-05' },
    hasStudy: true,
  },
  {
    name: 'Dylan Jordan Real Estate',
    slug: 'dylan-jordan-real-estate',
    kind: 'client',
    url: 'https://djrxexcellence.com',
    displayUrl: 'djrxexcellence.com',
    tagline: 'Real estate · Listing search',
    trades: ['real-estate'],
    town: 'Dayton',
    location: 'Dayton, Texas',
    description:
      'Listings across Dayton and the Liberty County towns around it, grouped by place rather than by a radius on a map. Buyers save what is worth a second look, put the shortlist side by side, and ask their questions on the listing itself.',
    pagespeed: { mobile: 96, desktop: 100, runs: 3, measured: '2026-09-05' },
    hasStudy: true,
  },
  {
    name: 'TireTracker',
    slug: 'tiretracker',
    kind: 'product',
    url: 'https://www.tiretracker.app',
    displayUrl: 'tiretracker.app',
    tagline: 'Field service software · Dispatch and logging',
    trades: ['auto-repair'],
    description:
      'Recordkeeping for commercial tire shops, built here rather than for a client. A technician logs tire positions, DOT codes, tread depths, photos, and a signature at the roadside, and the fleet customer reads that history in a portal instead of asking for it.',
    pagespeed: { mobile: 77, desktop: 86, runs: 3, measured: '2026-09-05' },
    hasStudy: true,
  },
  {
    name: 'DeluxFit by Angie',
    slug: 'deluxfit-by-angie',
    kind: 'client',
    url: 'https://deluxfitbyangie.com',
    displayUrl: 'deluxfitbyangie.com',
    tagline: 'Personal brand · Booking funnel',
    trades: ['fitness'],
    town: 'Houston',
    location: 'Houston, Texas',
    description:
      'Memberships, online coaching, and one-to-one sessions, each priced on a page of its own and sold through a checkout. The client then signs in to the same app for their plan, their nutrition, their bookings, and a thread with the coach.',
    pagespeed: { mobile: 96, desktop: 100, runs: 3, measured: '2026-09-05' },
    hasStudy: true,
  },
  {
    name: 'Hollingshead Harbor',
    slug: 'hollingshead-harbor',
    kind: 'client',
    url: 'https://hollingsheadharbor.com',
    displayUrl: 'hollingsheadharbor.com',
    tagline: 'Marine transport · Brand site',
    trades: ['marine-services'],
    description:
      'Bulk dry cargo, vessel and barge charter, and a network of thirteen harbors, run by the marine arm of a company family-owned since 1999. The employment application is a page in its own right, because a deckhand fills it in once, on a phone, standing on a dock.',
    pagespeed: { mobile: 98, desktop: 100, runs: 3, measured: '2026-09-05' },
    hasStudy: true,
  },
  {
    name: 'Compound Industrial Scale Services',
    slug: 'compound-scale-services',
    kind: 'client',
    url: 'https://ccscaleservices.com',
    displayUrl: 'ccscaleservices.com',
    tagline: 'Industrial services · Brand site',
    trades: ['welding', 'industrial'],
    town: 'Huffman',
    location: 'Huffman, Texas',
    description:
      'On-site calibration against certified test weights, repair, and a parts counter for industrial weighing equipment, out of a family-owned shop in Huffman, Texas. Every part carries a page of its own, so a search for a failed load cell lands on the thing itself.',
    pagespeed: { mobile: 95, desktop: 100, runs: 3, measured: '2026-09-05' },
    hasStudy: true,
  },
  {
    name: 'Faded Barber Shop',
    slug: 'faded-barber-shop',
    kind: 'client',
    url: 'https://faded-barbershop.com',
    displayUrl: 'faded-barbershop.com',
    tagline: 'Neighborhood barber · Walk-in shop',
    trades: ['barber-shop', 'hair-salon'],
    town: 'Liberty',
    location: 'Liberty, Texas',
    description:
      'Fades taken to skin, beard shaping cut to match the head, and straight razor shaves, on Main Street in Liberty since 2018. Tuesday through Thursday is by appointment and Friday is the walk-in day, which is the one thing most callers are ringing to find out.',
    pagespeed: { mobile: 97, desktop: 100, runs: 3, measured: '2026-09-05' },
    hasStudy: true,
  },
  {
    name: 'Delux Financial Solutions',
    slug: 'delux-financial-solutions',
    kind: 'client',
    url: 'https://deluxlavello.com',
    displayUrl: 'deluxlavello.com',
    tagline: 'Financial services · Brand site',
    trades: ['accounting'],
    town: 'Houston',
    location: 'Houston, Texas',
    description:
      'A Houston credit-education practice with four services compared side by side, an education section on the five factors behind a score, and every page published in English and Spanish. It states plainly that it is not a law firm and guarantees no outcome.',
    pagespeed: { mobile: 100, desktop: 100, runs: 3, measured: '2026-09-05' },
    hasStudy: true,
  },
  {
    name: 'SETX Football',
    slug: 'setx-football',
    kind: 'client',
    url: 'https://www.setxfootball.org',
    displayUrl: 'setxfootball.org',
    tagline: 'Youth sports camp · Parent portal',
    trades: ['youth-sports'],
    town: 'Daisetta',
    location: 'Daisetta, Texas',
    description:
      'Two half-days in Daisetta for kids five to twelve, with no tryouts and no bench. A parent registers, orders the shirts, and pays without being made to create a login first, then signs in later to follow it.',
    pagespeed: { mobile: 95, desktop: 100, runs: 3, measured: '2026-09-05' },
    hasStudy: true,
  },
  {
    name: 'Smyrna Tools',
    slug: 'smyrna-tools',
    kind: 'client',
    url: 'https://www.smyrnatools.com',
    displayUrl: 'smyrnatools.com',
    tagline: 'Operations platform · Management dashboard',
    trades: [],
    town: 'Baytown',
    location: 'Baytown, Texas',
    description:
      'Every mixer, tractor, and trailer a concrete producer owns, plus the operators running them and the plant figures they produce, behind one sign-in. The public side of the site is the door and nothing else.',
    pagespeed: { mobile: 96, desktop: 100, runs: 3, measured: '2026-09-05' },
    hasStudy: true,
  },
]

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * A `measured` date written the way a sentence carries it.
 *
 * The stored form is `YYYY-MM-DD`, which is what a figure is filed under and
 * not what a caption under it should say. It is rendered from its own parts
 * rather than through `Date`, because parsing a bare date puts it at UTC
 * midnight and formats as the day before anywhere west of Greenwich — the
 * portfolio is measured from Texas, so every date would read a day early.
 *
 * Every surface that prints a measurement date shares this, so the day a score
 * was taken reads the same on the row, the study, and the front door.
 *
 * @param {string} iso Date in `YYYY-MM-DD` form, as `pagespeed.measured` holds it.
 * @returns {string} e.g. `August 27, 2026`.
 */
export function formatMeasuredDate(iso) {
  const [year, month, day] = iso.split('-')
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`
}

/**
 * The sites built for an outside business, which is what every claim about
 * client work is counted and averaged over. A studio product is the studio
 * marking its own homework, so it is shown on the portfolio and left out of the
 * figures quoted as proof of client work.
 *
 * Annotated pure, and the annotation is about the bundle rather than the value.
 * A module whose top level runs a call the bundler cannot see through counts as
 * having side effects, and an import of a module with side effects is kept even
 * when every name it brought in has folded away - so one import written in a
 * file the chrome of every page reaches was enough to put this whole list in the
 * first thing taylor.website downloads, on a site with no portfolio, no case
 * studies and no page that names a client. The three derivations below are the
 * calls in question. Each is a fold over a literal written above it in the same
 * file: they read nothing outside it, write nothing, and cannot throw. The
 * annotation is how a bundler is told that, and there is no other way to say it
 * short of moving the derivations to callers that all want the same answer.
 */
export const CLIENT_PROJECTS = /*#__PURE__*/ PORTFOLIO_PROJECTS.filter(
  project => project.kind === 'client'
)

/** The mean of one strategy's scores, rounded the way a headline figure is. */
function meanScore(projects, strategy) {
  const total = projects.reduce((sum, project) => sum + project.pagespeed[strategy], 0)
  return Math.round(total / projects.length)
}

/**
 * What the client sites average, computed rather than written down.
 *
 * The figure appears on the front door, the about page, and the FAQ, and it was
 * a literal in all three: re-measuring one site left three sentences quoting an
 * average no set of numbers on the site added up to, with nothing failing. It
 * is derived here so a new entry or a new measurement moves every sentence that
 * quotes it, and `scripts/portfolio/check-portfolio-scores.js` fails a page that goes
 * back to spelling one out.
 *
 * Both calls annotated, for the reason the note above `CLIENT_PROJECTS` gives.
 * `meanScore` sums a field and rounds it; one unannotated call here holds the
 * file open exactly as far as three would.
 */
export const PORTFOLIO_AVERAGES = {
  mobile: /*#__PURE__*/ meanScore(CLIENT_PROJECTS, 'mobile'),
  desktop: /*#__PURE__*/ meanScore(CLIENT_PROJECTS, 'desktop'),
}

/**
 * The client sites that stand as proof for a trade.
 *
 * @param {string | null} trade Trade slug from `@data/towns-and-trades/trades`.
 * @returns {Array<object>} Matching entries in portfolio order; empty for a
 *   trade no client works in yet.
 */
export function portfolioProofFor(trade) {
  if (!trade) return []
  return PORTFOLIO_PROJECTS.filter(project => project.trades.includes(trade))
}

/**
 * The proof shown for a trade with no client of its own: the sites whose town
 * is named, which is what makes them read as local work rather than as a list
 * of URLs.
 *
 * Annotated for the reason the note above `CLIENT_PROJECTS` gives.
 */
export const LOCAL_PORTFOLIO = /*#__PURE__*/ PORTFOLIO_PROJECTS.filter(project => project.town)

/**
 * Public path of a project's committed preview image. Shared by the Portfolio
 * view (as the img src) and `scripts/portfolio/capture-portfolio.js` (as the output
 * path), so the two can never disagree about where a capture lives.
 *
 * @param {{ displayUrl: string }} project Entry from `PORTFOLIO_PROJECTS`.
 * @param {'desktop' | 'phone'} device Which of the two captures to point at.
 * @returns {string} Root-relative URL, e.g. `/portfolio/smyrnatools-com-desktop.webp`.
 */
export function portfolioPreviewSrc(project, device) {
  return `/portfolio/${project.displayUrl.replace(/\./g, '-')}-${device}.webp`
}

/**
 * Public path of the same desktop capture as a JPEG, which is what an outreach
 * message shows its client sites with.
 *
 * WebP is drawn by every browser and by none of the Outlook builds on Windows,
 * where the proof band would otherwise be three empty frames — the part of a
 * cold message that has to be seen. The phone capture has no email twin
 * because no message uses one.
 *
 * @param {{ displayUrl: string }} project Entry from `PORTFOLIO_PROJECTS`.
 * @returns {string} Root-relative URL, e.g. `/portfolio/email/smyrnatools-com-desktop.jpg`.
 */
export function portfolioEmailPreviewSrc(project) {
  return `/portfolio/email/${project.displayUrl.replace(/\./g, '-')}-desktop.jpg`
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
 * `scripts/portfolio/capture-portfolio.js` uses it as the source the committed captures
 * are downloaded from.
 *
 * @param {{ url: string }} project Entry from `PORTFOLIO_PROJECTS`.
 * @param {'desktop' | 'phone'} device Which viewport to render.
 * @returns {string} Full thum.io URL for the shot.
 */
export function portfolioScreenshotServiceUrl(project, device) {
  return `${SCREENSHOT_SERVICE_PREFIX[device]}${project.url}`
}
