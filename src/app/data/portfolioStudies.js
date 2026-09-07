/**
 * The case study bodies behind `/portfolio/:slug`, kept apart from the entries
 * they belong to.
 *
 * `@data/portfolio` is reached from the navigation drawer, which names three
 * studies and shows three preview shots, and the drawer sits in the layout on
 * every page of the site. Holding the prose in the same module would put
 * twenty-five kilobytes of case study text - the sector notes, the paragraphs
 * on each business, the sections on what each site does and how it is built -
 * into the entry bundle of a page that renders none of it.
 *
 * So the entries carry what a row needs to be drawn and linked, and the writing
 * lives here, behind the one route that sets it. `@views/CaseStudy` is lazily
 * loaded, so a reader who never opens a study never fetches a word of this.
 *
 * The two halves are joined on `slug`, and `scripts/portfolio/check-portfolio-split.js`
 * holds them to each other: an entry claiming a study that is not written, a
 * study written for an entry that is gone, or a field a view reads going
 * missing from either side, all fail there.
 */
import { PORTFOLIO_PROJECTS } from './portfolio.js'

/**
 * Case study content by entry slug. Everything in it is drawn from the live
 * site or the project's own repository, which is the whole of what the page is
 * allowed to claim.
 *
 * - `title`       Page title written for search. Kept short enough that the
 *                 brand suffix survives.
 * - `description` Meta description written for search.
 * - `summary`     The lede under the heading.
 * - `sector`      What kind of work the site is.
 * - `business`    Paragraphs describing what the business does.
 * - `site`        `{ title, body }` entries, one per thing a visitor can do on
 *                 the live site.
 * - `build`       `{ title, body }` entries covering how it is put together.
 * - `stack`       The pieces it is built on, shortest first.
 */
const STUDY_BODIES = {
  'smyrna-tools': {
    title: 'Smyrna Tools Operations Platform',
    description:
      'How the Smyrna Ready Mix operations platform is built: fleet records, personnel lifecycle, and plant efficiency reporting behind one authenticated portal.',
    summary:
      'The operations platform Smyrna Ready Mix runs its fleet, its people, and its plant figures on.',
    sector: 'Operations platform',
    business: [
      'Smyrna Ready Mix is a concrete producer working plants across several regions. Running one means keeping track of hundreds of moving assets, an operator workforce flowing through onboarding and duty changes, and plant efficiency numbers that only say anything once they roll up across regions.',
      'Smyrna Tools is the internal platform that holds all three. It sits behind a sign-in, so the public side of the site is the door and nothing else.',
    ],
    site: [
      {
        title: 'Fleet and assets',
        body: 'Mixers, tractors, trailers, equipment, and pickup trucks, each with a verification status, service tracking, and a change-history timeline that keeps every edit.',
      },
      {
        title: 'People and personnel',
        body: 'The operator lifecycle from onboarding through training, active duty, light duty, and separation, alongside manager profiles and role-based access.',
      },
      {
        title: 'Productivity and reporting',
        body: 'Plant efficiency scoring, live dashboards, and weekly role-based reports across regions, with charts, maps, and export to Excel and PDF.',
      },
    ],
    build: [
      {
        title: 'Every write goes through the server',
        body: 'The browser never mutates the database directly. Writes travel through edge functions, and Postgres row-level security decides what an account can read.',
      },
      {
        title: 'Three themes, described once',
        body: 'Light, dark, and gray themes come from one set of semantic tokens, so a surface is described once rather than three times.',
      },
      {
        title: 'Watched in production',
        body: 'Sentry carries the errors, and analytics and speed measurement run alongside it, so a fault on a plant floor is visible without waiting for somebody to report it.',
      },
    ],
    stack: [
      'React 19',
      'React Router 7',
      'Vite 6',
      'Tailwind CSS 3',
      'Supabase',
      'Recharts',
      'Leaflet',
      'Sentry',
      'Vercel',
    ],
  },
  'speedway-146': {
    title: 'Speedway 146 Go-Kart Site, Baytown TX',
    description:
      'How the Speedway 146 website works: kart heats, bounce houses, and party bookings sold through Stripe, with a staff back office on the same app.',
    summary:
      'An outdoor go-kart speedway on TX-146 that sells its own tickets, packages, and parties.',
    sector: 'Recreation',
    business: [
      'Speedway 146 is an outdoor go-kart track at 6750 TX-146 in Baytown, open Thursday through Sunday. Heats run five minutes, adults race adults and kids race kids, and the timer stops for a breakdown or a caution so a racer gets the full five.',
      'The track is not only karts. Indoor bounce houses run alongside it, and a private party room seats up to sixty guests with twenty racing wristbands included.',
    ],
    site: [
      {
        title: 'Pricing that answers before the call',
        body: 'Wristbands, party packages, and bounce house rates are laid out on one page, including the Thursday special that runs two and a half hours of unlimited racing for a flat price.',
      },
      {
        title: 'A cart and a checkout',
        body: 'Ticket bundles, double-seater packages, and party rentals go into a cart and out through Stripe Checkout, rather than stopping at a phone number.',
      },
      {
        title: 'Every party question, answered',
        body: 'Room capacity, included wristbands, decorating time, and catering sit on a dedicated page, so the phone call is about locking in a date instead of covering the basics.',
      },
      {
        title: 'Orders and revenue on the same app',
        body: 'The same app carries an authenticated panel for orders and revenue, plus a live traffic dashboard, both reading straight from Postgres.',
      },
    ],
    build: [
      {
        title: 'Pricing is never trusted to the browser',
        body: 'An edge function re-prices every line of a cart against a canonical price map, applies tax, fees, and the group discount, and only then builds the Stripe session. A total edited in the browser does not survive the trip.',
      },
      {
        title: 'Row-level security on the back office',
        body: 'Orders, revenue, and traffic are read through policies in Postgres, so a staff screen is gated by the database rather than by the page that draws it.',
      },
    ],
    stack: ['React 18', 'Vite 6', 'Tailwind CSS 3', 'Supabase', 'Stripe', 'Vercel'],
  },
  'impressiva-printing': {
    title: 'Impressiva Printing Order Portal',
    description:
      'How the Impressiva Printing site works: a print catalog, a client portal for artwork and proofs, and an admin panel that runs jobs to press.',
    summary:
      'A print shop storefront, and behind it the preflight, proof, and press pipeline the floor already runs.',
    sector: 'Custom printing',
    business: [
      'Impressiva Printing is a custom print studio in Pasadena. The floor runs offset, digital, screen, direct-to-film, and wide-format presses, which is what lets one shop take a job from a hundred business cards through to a ten-foot vinyl banner.',
      'Press and paper covers cards, flyers, posters, and packaging. Wide format and apply covers banners, apparel, stickers, and storefront signage.',
    ],
    site: [
      {
        title: 'A catalog written in the shop’s own terms',
        body: 'Stocks from 14pt card through 32pt board, 13oz and 18oz vinyl, and SBS packaging board, with the finishes named: soft-touch lamination, spot UV, foil, die-cutting, rounded corners.',
      },
      {
        title: 'The job flow, stated up front',
        body: 'What file to send, what bleed to leave, that the studio preflights it and returns a proof, and that the job only goes on press once the proof is approved.',
      },
      {
        title: 'The customer watches the job move',
        body: 'Customers open an order, upload print-ready artwork, approve the proof, and follow the job through the shop’s own pipeline rather than through a thread of emails.',
      },
      {
        title: 'The same pipeline from any device',
        body: 'Staff work the same pipeline from an admin panel on any device: preflight artwork, send proofs, run jobs to press, and keep the customer book.',
      },
    ],
    build: [
      {
        title: 'Static files, with a database behind them',
        body: 'The site ships as static files, but accounts, sessions, orders, and uploaded artwork live in Postgres behind row-level security, with one data layer between the app and the tables.',
      },
      {
        title: 'Artwork travels with the order',
        body: 'A file is read into the order record itself, print-ready PDFs alongside PNG, JPEG, WebP, SVG, and GIF, with a four-megabyte cap per file so one row stays a sane size.',
      },
    ],
    stack: ['React 19', 'Vite 7', 'Tailwind CSS 3', 'Supabase', 'Vercel'],
  },
  'dickinson-bayou-fleeting': {
    title: 'Dickinson Bayou Fleeting Website',
    description:
      'How Dickinson Bayou Fleeting argues for a dock lease: two five-acre yards on the Texas Gulf Coast, the monthly rates, and the crew that comes with them.',
    summary:
      'Two waterfront yards let by the month, and a site whose whole argument is what a lease at either one carries.',
    sector: 'Marine services',
    business: [
      'Dickinson Bayou Fleeting runs coastal barge fleeting, marine services, and long-term waterfront dock leasing on Galveston Bay, the Houston Ship Channel, and the Gulf Intracoastal Waterway.',
      'The two yards are five gated acres each: Dickinson on Galveston Bay at $4,100 a month and Freeport on the GIWW at $4,800. The reach named on the site runs from Dickinson out through Texas City, League City, Kemah, Bacliff, Seabrook, La Marque, Galveston, Pasadena, Houston, and Freeport.',
    ],
    site: [
      {
        title: 'The rate is on the page',
        body: 'Both monthly rates, the acreage, and the seven jobs the shore crew already covers are stated outright rather than held behind a quote form. An operator comparing yards can do the comparison here.',
      },
      {
        title: 'Contact from anywhere on the page',
        body: 'Fleeting is a phone-call business, so the number sits in the strip above the bar on a desk and on a fixed bar under the thumb on a phone, one tap from any screen.',
      },
      {
        title: 'The whole site behind one key',
        body: 'A search over every service, yard, rate, question, and town the site names, opened on the command pair or a bare slash, so a returning operator does not navigate to a figure they already know exists.',
      },
    ],
    build: [
      {
        title: 'No color, and no need for one',
        body: 'The palette is black, white, and the grays between. Rank comes from tone, weight, and the rules that fence each band, so nothing on the page is competing with the one filled control that is the action.',
      },
      {
        title: 'Two faces, each with one job',
        body: 'Condensed caps set every heading and figure. Labels, controls, and running text, everything a reader is meant to read as words, are set in the body face at sentence case with no tracking opened up under it.',
      },
      {
        title: 'The placeholder is the page',
        body: 'While a page is loading, its header is drawn as ruled bars sized from the same type scale, so a page that carries an actions row reserves the room for one. Nothing on screen moves when the content lands.',
      },
      {
        title: 'Deliberately small',
        body: 'No framework routing, no CSS-in-JS, and no cookie banner. What is left is a small React bundle, because the one-bar connection it loads on is the constraint that matters.',
      },
    ],
    stack: ['React 19', 'Create React App', 'Tailwind CSS 3', 'Vercel'],
  },
  'dylan-jordan-real-estate': {
    title: 'Dylan Jordan Real Estate Listing Site',
    description:
      'How the Dylan Jordan listing site works: search homes in Dayton and Liberty County, save and compare them, and ask questions on the listing itself.',
    summary:
      'A listing search for Dayton and Liberty County, with the agent’s own dashboard behind it.',
    sector: 'Real estate',
    business: [
      'Dylan Jordan is an agent with RE/MAX Excellence, working Dayton, Texas and the towns around it in Liberty County.',
      'The site handles both sides of the trade: buyers searching what is on the market, and sellers looking for what a home is worth.',
    ],
    site: [
      {
        title: 'Every town gets a page of its own',
        body: 'Listings are grouped by the towns either side of Dayton, and each area has a page of its own, so a search that starts with a place name lands somewhere useful.',
      },
      {
        title: 'Save, then compare',
        body: 'A buyer keeps the homes worth a second look, saves the search that found them, and puts the shortlist side by side before making a call.',
      },
      {
        title: 'Questions on the listing itself',
        body: 'A question is asked on the home it is about rather than through a contact form, and the agent answers it in the same place.',
      },
      {
        title: 'The agent’s own dashboard',
        body: 'Listings are posted and updated, leads are read, and comments are moderated from a dashboard on the same site, so nothing waits on someone else to publish it.',
      },
    ],
    build: [
      {
        title: 'Two account types, separated in the database',
        body: 'Row-level policies keep a member account and the agent account apart, so what a visitor can reach is decided by Postgres rather than by which screen they found.',
      },
      {
        title: 'Maps that load only when shown',
        body: 'The map library and its tiles are pulled in at the moment a map appears, so a listing list is not paying for a map nobody opened.',
      },
      {
        title: 'Prerendered, sitemap and all',
        body: 'The build writes the sitemap, builds the bundle, and renders the routes to static HTML, so a crawler is handed finished markup instead of an empty shell.',
      },
    ],
    stack: [
      'React 19',
      'React Router 7',
      'Vite 7',
      'Tailwind CSS 3',
      'Supabase',
      'Leaflet',
      'Vercel',
    ],
  },
  tiretracker: {
    title: 'TireTracker Field Service Software',
    description:
      'How TireTracker is built: roadside service logging for commercial tire shops, with DOT codes, photos, and signatures, and a portal for fleet customers.',
    summary: 'Service recordkeeping for commercial tire shops, and the fleet portal that reads it.',
    sector: 'Studio product',
    business: [
      'TireTracker is a TaylorURL product rather than a client site. A shop logs what its technicians did to which tires on which trucks, and its fleet customers see that history in a portal of their own.',
      'It is a recordkeeping product rather than a billing one. What it captures is the work: tire positions, DOT codes, tread depths, photos, and signatures, so a shop and its customers stop disagreeing about what was done.',
    ],
    site: [
      {
        title: 'Logged where the work happens',
        body: 'A technician records a job from the roadside, with the codes, the depths, the photographs, and the signature attached to it at the time.',
      },
      {
        title: 'The fleet reads its own history',
        body: 'The customer signs in and reads their own service history rather than asking for it.',
      },
      {
        title: 'One subscription, and no more money moving',
        body: 'The shop’s own subscription is the only payment the product handles.',
      },
    ],
    build: [
      {
        title: 'Tenant isolation, enforced twice',
        body: 'Every query is scoped to a shop in application code, and Postgres row-level security backs it up. Routes are assembled from wrappers that set the security context, so a route written by hand reads and writes nothing.',
      },
      {
        title: 'Deletes are soft',
        body: 'Records, photos, vehicles, and clients carry a deletion timestamp, reads filter them out, and a scheduled job removes for good what has been gone thirty days.',
      },
      {
        title: 'Photos out of the database',
        body: 'Uploads go to object storage through a queue, so a technician on a weak signal is not holding a job open waiting on an image.',
      },
    ],
    stack: [
      'Next.js 16',
      'Clerk',
      'Prisma',
      'Neon Postgres',
      'Tailwind CSS 4',
      'Stripe',
      'Cloudflare R2',
      'Sentry',
      'Vercel',
    ],
  },
  'deluxfit-by-angie': {
    title: 'DeluxFit by Angie Booking Site',
    description:
      'How the DeluxFit by Angie site works: memberships, online coaching, and live training sold through Stripe, with a member portal and a coach dashboard.',
    summary: 'A personal trainer’s site that sells the plan and then holds the whole relationship.',
    sector: 'Fitness coaching',
    business: [
      'DeluxFit by Angie is the practice of a certified personal trainer, offering memberships, online coaching, and live one-to-one training.',
      'Most trainer sites sell a service and then hand the client off to a spreadsheet and a text thread. This one keeps both sides in the same application.',
    ],
    site: [
      {
        title: 'Three ways in, priced',
        body: 'Membership, online coaching, and single sessions each have a page that says what it is, and the live training program has one of its own.',
      },
      {
        title: 'The public pages take payment',
        body: 'The public funnel closes the sale through Stripe rather than stopping at an inquiry.',
      },
      {
        title: 'Everything the client bought, in one sign-in',
        body: 'The buyer signs in to their plan, their nutrition, their progress, their bookings, and a message thread with the coach.',
      },
      {
        title: 'The coach works from the same data',
        body: 'The other side of that same data: clients, plans, bookings, nutrition, staff, and the content on the public pages.',
      },
    ],
    build: [
      {
        title: 'The browser holds no privileged key',
        body: 'Every sensitive write goes through an edge function, so nothing that matters depends on the page asking nicely.',
      },
      {
        title: 'A content library assigned per client',
        body: 'The coach files material by category and media type, sets the access level it needs, and assigns it to named clients. Media lands in a private bucket, reached only through the staff-only function that wrote it.',
      },
    ],
    stack: ['React 19', 'Vite 7', 'Tailwind CSS 3', 'Supabase', 'Stripe', 'Vercel'],
  },
  'hollingshead-harbor': {
    title: 'Hollingshead Harbor Marine Site',
    description:
      'How the Hollingshead Harbor site works: bulk cargo, vessel and barge charter, a fleet listing, and a one-page employment application built for a phone.',
    summary:
      'The marine division of SRM, its thirteen-harbor network, and an application a deckhand can finish on a phone.',
    sector: 'Marine transportation',
    business: [
      'Hollingshead Harbor is the marine arm of SRM, family-owned since 1999. It moves bulk dry cargo, charters vessels and barges, and runs full-service ports across a network of thirteen harbors.',
      'Hiring is a constant, which is why the employment application is treated as a first-class page rather than as a PDF hidden behind a careers link.',
    ],
    site: [
      {
        title: 'The application, on one page',
        body: 'Position, contact details, four employers, personal history, and a signed acknowledgment, all on a single screen. Most applicants fill this in on a phone standing on a dock, and they do not come back for a second attempt.',
      },
      {
        title: 'The fleet, listed',
        body: 'An equipment page covering what the division runs, so a charter inquiry starts from what is available.',
      },
      {
        title: 'Who the company is',
        body: 'Pages for what it does, how it began, its core values, and where it sits inside the wider SRM family.',
      },
    ],
    build: [
      {
        title: 'Checked twice, then mailed',
        body: 'The application validates in the browser and again on the server, then reaches the hiring inbox as a formatted email with the resume attached.',
      },
      {
        title: 'Pages the office edits without a CMS',
        body: 'Job postings and fleet equipment are two JSON files. Adding a boat or a job description is a data edit rather than a code change.',
      },
    ],
    stack: ['React 19', 'React Router 7', 'Vite 7', 'Tailwind CSS 3', 'Resend', 'Vercel'],
  },
  'compound-scale-services': {
    title: 'Compound Industrial Scale Services Website',
    description:
      'How the Compound Industrial Scale Services site works: calibration and repair pages, a parts catalog, and a quote list that composes one email to sales.',
    summary:
      'Scale calibration, repair, and a parts counter in Huffman, Texas, running with no backend at all.',
    sector: 'Industrial services',
    business: [
      'Compound Industrial Scale Services works on industrial and commercial weighing equipment out of Huffman, Texas: on-site calibration against certified test weights with a certificate for the customer’s records, repair and troubleshooting, scheduled preventive maintenance, and installation.',
      'It also runs a parts counter, covering load cells, indicators and displays, junction boxes and cable, printers and supplies, test weights, and mounting hardware.',
    ],
    site: [
      {
        title: 'Two things a caller ever wants',
        body: 'A customer arrives with a scale reading wrong or a part that has failed, and needs either a technician or a price. Both paths are on the front page.',
      },
      {
        title: 'A page for every part',
        body: 'Each catalog entry is its own indexable URL with structured data, which is what somebody searching a symptom or a component name lands on.',
      },
      {
        title: 'A cart that ends at a salesperson',
        body: 'Parts collect in a list, each carrying the make, model, and capacity of the scale it is meant for, so one message reaches sales with everything needed to price it.',
      },
    ],
    build: [
      {
        title: 'No server and no database',
        body: 'Forms hand a composed message to the visitor’s own mail program, and the quote list is held in the browser. There is no server-side customer data to secure, because there is none.',
      },
      {
        title: 'Content without a content system',
        body: 'Services and parts are data the site is built from, so the catalog grows by editing a file rather than by adding a page.',
      },
    ],
    stack: ['React 19', 'React Router 7', 'Vite 7', 'Tailwind CSS 3', 'Vercel'],
  },
  'faded-barber-shop': {
    title: 'Faded Barber Shop Site, Liberty TX',
    description:
      'How the Faded Barber Shop site works: services, hours, the walk-in day, and booking, on a page that fades from long hair to skin as you scroll.',
    summary:
      'A Main Street barber in Liberty, Texas, on a page that is one continuous fade from top to bottom.',
    sector: 'Barber shop',
    business: [
      'Faded Barber Shop has been on Main Street in Liberty, Texas since 2018. The work is fades taken to skin, low, mid, or high, beard shaping cut to match the head, straight razor shaves, and kids’ cuts.',
      'Tuesday through Thursday runs on appointment and Friday is the walk-in day, which is the single fact most callers are ringing to find out.',
    ],
    site: [
      {
        title: 'The hours answer the phone',
        body: 'Each day carries its own label, appointment or walk-in, so the difference between Thursday and Friday is readable at a glance rather than buried in a sentence.',
      },
      {
        title: 'Booking where the shop already takes it',
        body: 'Appointments open on the booking service the shop uses, with the price and the length of a slot stated before the visitor leaves the page.',
      },
      {
        title: 'Services, taken down by the number',
        body: 'The cuts are laid out as guard numbers rather than as a menu, which is the language the shop already uses.',
      },
      {
        title: 'The shop’s own reviews',
        body: 'A reviews page carries what customers have published about the shop, quoted and attributed.',
      },
    ],
    build: [
      {
        title: 'One continuous fade',
        body: 'Scroll position drives a clipper guard, and a full-screen shader renders a field of hair at that length: long at the top of the page, taken to skin at the bottom. Section markers are guard numbers, so the navigation and the effect are the same scale.',
      },
      {
        title: 'Four effects on one canvas',
        body: 'The scroll fade, the pointer shaving a path through the field, a ray fan taken from the shop’s own sign, and a clipper pass on every route change, all drawn on a single surface rather than four.',
      },
    ],
    stack: ['React 19', 'React Router 7', 'Vite 7', 'WebGL', 'Vercel'],
  },
  'delux-financial-solutions': {
    title: 'Delux Financial Solutions Website',
    description:
      'How the Delux Financial Solutions site works: four credit services compared side by side, an education section, and a Spanish edition of every page.',
    summary:
      'A Houston credit-education practice, published in English and Spanish from one set of pages.',
    sector: 'Financial services',
    business: [
      'Delux L Avello LLC is a credit education and credit-building practice in Houston, Texas. It runs four services: credit building, credit growth, the two together, and support for someone responding to a consumer debt lawsuit.',
      'Consultations are virtual or mobile in person, by appointment. The site states plainly that the practice is not a law firm and does not guarantee outcomes.',
    ],
    site: [
      {
        title: 'Four paths, compared',
        body: 'Each service has a page of its own, and a comparison page puts all four side by side with what each covers and who it suits.',
      },
      {
        title: 'The figures behind a decision',
        body: 'An education section covers what a report holds, the five factors behind a score and the weight each carries, and how utilization is read per card and across every card together.',
      },
      {
        title: 'The engagement, in four stages',
        body: 'From the first consultation through reviewing the credit picture, following a written plan, and continuing as the profile develops.',
      },
      {
        title: 'English and Spanish',
        body: 'Every page is available in both. Switching fetches nothing and keeps the URL where it is.',
      },
    ],
    build: [
      {
        title: 'A page is a page',
        body: 'Each route is its own HTML file, assembled at build time from shared partials. There is no client-side router and no application to boot before the first word is readable.',
      },
      {
        title: 'Translation keyed on the English',
        body: 'Spanish rides along as a lookup keyed by the English string itself, so no page carries translation markup and a phrase written once is translated once. Only the entries a given page uses are inlined into it.',
      },
      {
        title: 'Theme and language before the first paint',
        body: 'Both resolve in an inline script in the head, so a stored choice never arrives as a flash of the other one.',
      },
    ],
    stack: ['Vite', 'Static HTML', 'CSS custom properties', 'Vercel'],
  },
  'setx-football': {
    title: 'SETX Football Camp Sign-Up Site',
    description:
      'How the SETX Football Camp site works: camp registration and shirt orders for ages 5 to 12 in Daisetta, with a staff panel that verifies payment.',
    summary:
      'A youth football camp in Daisetta, with the sign-up, the shirt order, and the roster in one place.',
    sector: 'Youth sports',
    business: [
      'SETX Football Camp is a community camp in Daisetta, Liberty County, run over two half-days for kids ages five to twelve. There are no tryouts and no bench, so a camper who has never played gets the same reps as one who has played for years.',
      'The camp states that every coach on the field has cleared a background check, and the shirts, drinks, and snacks each camper goes home with are paid for by the local businesses on the sponsor wall.',
    ],
    site: [
      {
        title: 'Register without an account first',
        body: 'A parent fills in the registration and the shirt order and pays, without being made to create a login before they can start.',
      },
      {
        title: 'A shirt order with a live total',
        body: 'Multiple shirts on one order, with the total updating as sizes are added.',
      },
      {
        title: 'Three days to fix a mistake',
        body: 'A signed-in parent tracks payment status and edits their registration inside a three-day window, with the days remaining counted down on screen.',
      },
      {
        title: 'Built for the morning of the camp',
        body: 'Volunteers verify each payment and work the roster from a role-gated panel, which is what makes check-in on the day survive contact with a queue of parents.',
      },
    ],
    build: [
      {
        title: 'Parents see their own registrations and nothing else',
        body: 'Row-level security in Postgres draws that line, so a parent reading someone else’s registration is not something the interface has to prevent.',
      },
      {
        title: 'Payment where the camp already takes it',
        body: 'The camp takes payment through the service it already uses, and the staff panel is where a payment is marked verified.',
      },
    ],
    stack: [
      'React 19',
      'React Router 7',
      'Create React App',
      'Tailwind CSS 3',
      'Supabase',
      'Vercel',
    ],
  },
}

/**
 * The entries with a case study to link to, each carrying its study. The build
 * reads it to decide which `/portfolio/:slug` pages exist, and the study page
 * reads it for the one it is rendering.
 */
export const PORTFOLIO_STUDIES = PORTFOLIO_PROJECTS.filter(project => project.hasStudy).map(
  project => ({ ...project, study: STUDY_BODIES[project.slug] })
)

/**
 * @param {string} slug Case study slug from the URL.
 * @returns {object | undefined} The entry that study belongs to, or undefined
 *   for a slug no entry carries.
 */
export function portfolioStudyBySlug(slug) {
  return PORTFOLIO_STUDIES.find(project => project.slug === slug)
}
