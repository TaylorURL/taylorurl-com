import { IS_SECOND_SITE, SITE } from '../../../lib/site/current.js'
import { STATIC_ROUTES as SECOND_SITE_ROUTES } from '../../../lib/site/routes/taylorwebsite.js'
import { CROSS_LINKS } from '../../../lib/site/cross-links.js'
import { PORTFOLIO_PROJECTS, portfolioPreviewSrc } from '@data/portfolio'
import { SERVICE_LINES } from '@data/pages/services'
import { MarkFacebook, MarkInstagram } from '@components/marks/brandMarks'
import { REVIEW_SOURCE_MARKS } from '@components/marks/reviewMarks'
import { FACEBOOK_PAGE_URL } from '@data/reputation/facebook'
import { reviewSource, reviewSourcesWith } from '@data/reputation/reviews'
import { TOOLS_INDEX } from '@data/pages/tools'
import {
  MarkArea,
  MarkAt,
  MarkCanvass,
  MarkFind,
  MarkFrame,
  MarkGuard,
  MarkIndex,
  MarkIssues,
  MarkPage,
  MarkPanel,
  MarkPulse,
  MarkQuery,
  MarkGauge,
  MarkRefit,
  MarkScan,
  MarkSquare,
  MarkStack,
  MarkSteps,
  MarkTag,
  MarkTalk,
} from '@components/marks/marks'

// The bar's curve and the three lengths it opens at, held as numbers because
// the panel, the drawer and the account menu are animated in JavaScript and a
// custom property is not a value Framer can read. They are the same values the
// stylesheet carries as --nav-easing, --nav-duration and --nav-duration-slow,
// so a curve tuned in one place is tuned in both; the drawer's own length is
// longer because it travels the height of the screen rather than opening in
// place. Reduced motion is answered at each opening, which is where the choice
// between a length and nothing is made.
export const NAV_EASE = [0.16, 1, 0.3, 1]
export const NAV_DURATION = 0.24
export const NAV_DURATION_SLOW = 0.3
export const NAV_DRAWER_DURATION = 0.42

// The mark each service page carries, keyed on the slug its route ends in, so
// a page renamed in the data keeps its drawing.
const SERVICE_MARKS = {
  'new-website': MarkFrame,
  redesign: MarkRefit,
  'online-tools': MarkPanel,
  care: MarkGuard,
  'business-email': MarkAt,
  seo: MarkFind,
}

// The mark each free tool carries, keyed on the slug its route ends in, so a
// tool renamed in the registry keeps its drawing.
const TOOL_MARKS = {
  'google-presence-check': MarkGauge,
  'logo-background-remover': MarkCanvass,
  'qr-code-generator': MarkScan,
}

const TOOL_ENTRIES = TOOLS_INDEX.map(tool => ({
  to: tool.path,
  label: tool.name,
  summary: tool.summary,
  mark: TOOL_MARKS[tool.slug],
}))

// The service pages that are not service lines. Each has a page under
// /services and none is priced or sold as one of the four lines, so the copy
// lives here rather than in `SERVICE_LINES`. A slug that later joins the data
// takes the wording from there instead of from this list.
const STANDALONE_SERVICES = [
  {
    slug: 'business-email',
    label: 'Business Email',
    summary: 'Email on your own domain, set up and looked after.',
  },
  {
    slug: 'seo',
    label: 'Getting Found on Google',
    summary: 'The work that puts a business in front of people searching nearby.',
  },
]

const serviceEntry = ({ slug, label, summary }) => ({
  to: `/services/${slug}`,
  label,
  summary,
  mark: SERVICE_MARKS[slug],
})

const SERVICE_ENTRIES = [
  ...SERVICE_LINES.map(line =>
    serviceEntry({ slug: line.slug, label: line.name, summary: line.summary })
  ),
  ...STANDALONE_SERVICES.filter(page => !SERVICE_LINES.some(line => line.slug === page.slug)).map(
    serviceEntry
  ),
]

// The client studies the Work panel names, keyed on the site each client
// trades under rather than on the business name, so a client renamed in
// `PORTFOLIO_PROJECTS` keeps its row and carries the new name into it. Three
// is the whole of what the panel names, and /portfolio carries the rest.
const FEATURED_STUDIES = [
  {
    displayUrl: 'faded-barbershop.com',
    summary: 'A Main Street barber shop in Liberty.',
  },
  {
    displayUrl: 'djrxexcellence.com',
    summary: 'Listing search for an agent working Dayton and Liberty County.',
  },
  {
    displayUrl: 'baytowngokarts.com',
    summary: 'Booking and party rentals for a Baytown go-kart track.',
  },
]

// A study's route. Every entry in `PORTFOLIO_PROJECTS` spells its own slug;
// the derivation from the business name is the guard for an entry added
// without one, and it produces the same spelling the existing entries carry.
const studySlug = project =>
  project.slug ||
  project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// The studies carry no mark. One drawing repeated down a column of client
// names says nothing the names do not already say.
//
// Empty on the second site, and the emptiness is about the download rather than
// the menu. `NAV_GROUPS` below is already empty there, so nothing built here is
// ever drawn - but a menu that is never drawn and a menu that was never built
// are two different files. Once that fold leaves `STUDIO_NAV_GROUPS` unread the
// bundler drops the name and keeps the literal it was bound to, as a bare
// expression, because the array is assembled by calls it cannot prove are inert.
// Everything those calls reach stays live with them, so a menu with no reader
// held `PORTFOLIO_PROJECTS`, and all twelve clients - names, towns, live
// addresses, descriptions - rode in the chunk downloaded before the first paint
// of a site that lists no clients. Nothing was rendered and everything was
// readable, which is the shape this whole class of bug arrives in.
//
// Compared against the key Vite substitutes as a literal the derivation folds
// and there is nothing left to keep. It is the instrument `SERVICE_AREAS` in
// `@constants/seo` reaches for against the same failure, and the note there says
// why the record's own field will not do the job.
//
// The fold is half of the answer. The other half is in `@data/portfolio` itself:
// an edge to a module whose top level the bundler cannot prove is inert is kept
// however dead the names it brought in have gone, so the derivations over there
// are annotated for exactly this reason. Either half alone still leaks.
const CASE_STUDY_ENTRIES = IS_SECOND_SITE
  ? []
  : FEATURED_STUDIES.map(({ displayUrl, summary }) => {
      const project = PORTFOLIO_PROJECTS.find(entry => entry.displayUrl === displayUrl)
      return project && { to: `/portfolio/${studySlug(project)}`, label: project.name, summary }
    }).filter(Boolean)

// The same three studies the column lists, as the captures the portfolio
// renders. Reading them off `FEATURED_STUDIES` is what stops the strip from
// showing one set of sites while the names beside it say another. Written
// against the key for the reason the entries above it are: this is the second of
// the two reads of the portfolio in this file, and either one left standing
// carries the whole of it just as far as both would.
const CASE_STUDY_SHOTS = IS_SECOND_SITE
  ? []
  : FEATURED_STUDIES.map(({ displayUrl }) => {
      const project = PORTFOLIO_PROJECTS.find(entry => entry.displayUrl === displayUrl)
      return project && { src: portfolioPreviewSrc(project, 'desktop'), name: project.name }
    }).filter(Boolean)

export const FACEBOOK_URL = FACEBOOK_PAGE_URL

// The Instagram account, which is a handle rather than a numbered page, so
// unlike the Facebook page it is written here rather than held in `@data`:
// Instagram collects no reviews and belongs to no part of the proof the review
// registry holds, so nothing outside this file has to agree with it.
export const INSTAGRAM_URL = 'https://www.instagram.com/taylorwebdev/'

// One column of the Reviews panel, cut out of the review registry.
//
// Both columns are built from that one list in its own order, so a network is
// named the same way in either, and adding one is a row in the data rather than
// a column here. A column draws only the networks carrying an address for it,
// so one with nowhere to send a reader is dropped rather than drawn, which is
// what keeps the panel from offering a page that is not there. Yelp is the
// standing case in the writing column: it suppresses reviews that were asked
// for and can penalize the listing for the asking, so it holds no address for
// leaving one.
//
// `summarised` is what the reading column sets: the column that leaves a review
// has said what every row on it does in its own head, and a line under each row
// would be that same sentence again.
//
// The rows are written against the key rather than the two calls that ask for
// them, for the reason the note above `CASE_STUDY_ENTRIES` gives: those calls
// sit inside the menu literal, which is precisely what the bundler holds on to
// after the name it was bound to has gone. Asked here, inside the thing being
// held, the read of the registry folds with the key instead of surviving in a
// panel nobody can open.
const reviewColumn = (head, link, summarised) => ({
  head,
  items: IS_SECOND_SITE
    ? []
    : reviewSourcesWith(link).map(source => ({
        href: source[link],
        label: source.label,
        summary: summarised ? source.holds : undefined,
        mark: REVIEW_SOURCE_MARKS[source.key],
      })),
})

// The network the Reviews panel promotes onto its own card, and the ones it
// sets as a row of marks along the foot of it.
//
// The accreditation leads where there is one to point at. It answers a
// different question from the platforms beside it - whether the company is what
// it says it is, rather than whether the work was any good - and it is the one
// a buyer checks first. Where no profile is published it is not there to lead,
// and the platform holding the most words leads instead, so the panel always
// has a card rather than a hole.
//
// The marks under it are every other listing that can be read, each in its own
// colour. That row is the point of the card: the proof is spread across
// listings this site does not own, and a reader can go and check any of them.
//
// Written against the key for the reason the studies above are. This and the
// columns are every reach into `@data/reviews` this file makes outside a
// function body, and what sits behind them is five networks with their labels,
// their publishers and their profile addresses, the client quotes filed on two
// of them, and the portfolio each reviewer is placed by.
const featureSource = IS_SECOND_SITE
  ? undefined
  : ['bbb', 'trustpilot'].map(reviewSource).find(source => source?.reads)

const REVIEW_FEATURE = featureSource && {
  href: featureSource.reads,
  label: featureSource.longLabel,
  summary: featureSource.featureLine,
  mark: REVIEW_SOURCE_MARKS[featureSource.key],
  tone: featureSource.key,
  marks: reviewSourcesWith('reads')
    .filter(source => source.key !== featureSource.key)
    .map(source => ({
      key: source.key,
      label: source.label,
      mark: REVIEW_SOURCE_MARKS[source.key],
    })),
}

// The groups the bar carries, and what each one opens.
//
// The five are shaped around what a visitor arrived to settle rather than
// around how the site is filed: what can be built, the work already standing,
// what other clients said about it, what can be used for free, and what is
// worth reading before deciding. A group opens the shell's one panel, and the
// panel is columns: each has a head naming what is under it and entries
// carrying a destination and the line that says what is there.
//
// `feature` is the group's own index page, promoted onto a card beside the
// columns. Every group has one, so a panel always holds an answer when none of
// the rows is it.
//
// An entry without a `summary` is a name that already says what it is, and the
// panel sets those in a tighter row. The column that leaves a review is the
// whole of that case: its head has already said what every row under it does.
//
// An entry carries either a `to` for a route on this site or an `href` for one
// off it, and the routes are all real ones: the services come from
// `SERVICE_LINES` and the client studies from `PORTFOLIO_PROJECTS`, each keyed
// on what the route ends in, so a row cannot name something the data does not
// hold. Three sets stop at their index rather than running into the bar: the
// towns, which /areas carries in full, the trades, which /industries carries,
// and the clients, of whom the panel names three and /portfolio holds all.
//
// /start is absent from the panels because the bar's own Start a Project
// button opens it, and /contact carries the slower route to the same
// conversation.
const STUDIO_NAV_GROUPS = [
  {
    key: 'services',
    label: 'Services',
    columns: [
      { head: 'Websites', items: SERVICE_ENTRIES.slice(0, 2) },
      { head: 'Beyond the Site', items: SERVICE_ENTRIES.slice(2) },
      {
        head: 'What It Costs',
        items: [
          {
            to: '/pricing',
            label: 'Pricing',
            summary: 'A site from $1,000 up front, and $250 a month to keep it running.',
            mark: MarkTag,
          },
        ],
      },
    ],
    feature: {
      to: '/services',
      label: 'All Services',
      summary: 'What each one covers, what it costs to run, and how long it takes.',
      mark: MarkIndex,
    },
  },
  {
    key: 'work',
    label: 'Work',
    columns: [
      { head: 'Case Studies', items: CASE_STUDY_ENTRIES },
      {
        head: 'How It Runs',
        items: [
          {
            to: '/process',
            label: 'The Process',
            summary: 'Six steps from the first call to launch day.',
            mark: MarkSteps,
          },
          {
            to: '/about',
            label: 'About Trenton',
            summary: 'Who builds it, and why there is no agency in between.',
            mark: MarkSquare,
          },
          {
            to: '/console/status',
            label: 'System Status',
            summary: 'Live uptime for every site under care.',
            mark: MarkPulse,
          },
        ],
      },
      {
        head: 'Where We Work',
        items: [
          {
            to: '/areas',
            label: 'Service Areas',
            summary: 'Baytown, Houston, and the towns around them, a page each.',
            mark: MarkArea,
          },
        ],
      },
    ],
    feature: {
      to: '/portfolio',
      label: 'Recent Work',
      summary: 'Live sites built for businesses around Baytown and Houston.',
      mark: MarkStack,
      shots: CASE_STUDY_SHOTS,
    },
  },
  {
    key: 'reviews',
    label: 'Reviews',
    // The middle column is names alone, so it takes about half the width of
    // the two that carry a line under each name.
    columnTemplate: 'minmax(0, 1.15fr) minmax(0, 0.7fr) minmax(0, 1.15fr)',
    columns: [
      reviewColumn('Read the Reviews', 'reads', true),
      reviewColumn('Leave a Review', 'writes', false),
      {
        head: 'The Work Behind Them',
        items: [
          {
            to: '/portfolio',
            label: 'Recent Work',
            summary: 'The sites the reviews are about, all of them live.',
            mark: MarkStack,
          },
          {
            href: FACEBOOK_URL,
            label: 'Follow Along',
            summary: 'What is being built, posted as it goes live.',
            mark: MarkFacebook,
          },
          {
            href: INSTAGRAM_URL,
            label: 'See the Builds',
            summary: 'The same work in pictures, a site at a time.',
            mark: MarkInstagram,
          },
        ],
      },
    ],
    feature: REVIEW_FEATURE,
  },
  {
    key: 'tools',
    label: 'Tools',
    columns: [
      { head: 'Free Tools', items: TOOL_ENTRIES },
      // The paid line sits beside the free ones so the two stay distinct: the
      // wording is read from the service data rather than restated here.
      {
        head: 'Built to Order',
        items: SERVICE_ENTRIES.filter(entry => entry.to.endsWith('/online-tools')),
      },
    ],
    feature: {
      to: '/tools',
      label: 'All Tools',
      summary: 'Free tools that run in your browser, with no account and no fee.',
      mark: MarkIndex,
    },
  },
  {
    key: 'resources',
    label: 'Resources',
    columns: [
      {
        head: 'Reading',
        items: [
          {
            to: '/notes',
            label: 'The Newsletter',
            summary:
              'Short letters on getting found on Google, monthly at most, one click to stop.',
            mark: MarkIssues,
          },
          {
            to: '/faq',
            label: 'Questions and Answers',
            summary: 'What a site costs, how long it takes, and who owns it when it is done.',
            mark: MarkQuery,
          },
        ],
      },
      {
        head: 'Talk',
        items: [
          {
            to: '/contact',
            label: 'Get in Touch',
            summary: 'Say what the business needs. A reply usually comes within the hour.',
            mark: MarkTalk,
          },
        ],
      },
    ],
    feature: {
      to: '/blog',
      label: 'The Blog',
      summary: 'Plain-English pieces on websites, Google, and getting more customers.',
      mark: MarkPage,
    },
  },
]

// What the drawer carries on a phone.
//
// The bar's five groups are a directory: they exist because a pointer can hover
// one and read a panel of thirty-eight destinations without committing to any
// of them. A thumb cannot do that, and the same thirty-eight poured into one
// column run four screens before the button most readers came for. So the
// phone gets its own list, and it is six indexes rather than a flattened tree.
//
// Each of these is a real page that carries the rest of its branch, so the
// tree is one tap deeper rather than gone: /services holds the six lines,
// /portfolio the client work and the towns it was done in, /tools the free
// ones, /contact the ways to start a conversation.
//
// Two things this list does not reach, and the footer is where they stay. The
// reviews are five profiles on networks this site does not own and there is no
// /reviews page to send a phone to, so a row here would be a section whose
// every destination leaves. The status board sits under the footer's Legal
// column and is a page for the clients already under care, not a thing a
// visitor is choosing between. Both are one scroll from any page on the site.
//
// No summaries. The names are the whole of it: a line under each one is a line
// a thumb has to scroll past, and these six are already plain English.
const STUDIO_DRAWER_LINKS = [
  { to: '/services', label: 'Services', mark: MarkFrame },
  { to: '/portfolio', label: 'Work', mark: MarkStack },
  { to: '/pricing', label: 'Pricing', mark: MarkTag },
  { to: '/tools', label: 'Free Tools', mark: MarkPanel },
  { to: '/about', label: 'About', mark: MarkSquare },
  { to: '/contact', label: 'Contact', mark: MarkTalk },
]

// The footer's Sitemap column, one entry per listed page.
//
// The footer sets it in two columns, so the order runs down the first column
// and on into the second. A page the footer already reaches from another
// column belongs to that column alone: /console/status sits under Legal and
// /start is the Talk column's button, so neither is repeated here. The pages
// under /services, /industries, and /areas are reached from their own index
// rather than listed one by one.
const STUDIO_PRIMARY_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/industries', label: 'Industries' },
  { to: '/areas', label: 'Service Areas' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/tools', label: 'Free Tools' },
  { to: '/speed-check', label: 'Speed Check' },
  { to: '/process', label: 'Process' },
  { to: '/about', label: 'About' },
  { to: '/blog', label: 'Blog' },
  { to: '/notes', label: 'Newsletter' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
]

// The footer's Legal column. Separate from the sitemap so the policies keep
// their own heading rather than sitting among the pages they govern.
const STUDIO_LEGAL_LINKS = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
  { to: '/license', label: 'License' },
]

export const SUPPORT_EMAIL = SITE.supportEmail
export const SALES_EMAIL = SITE.salesEmail

// One answer for the number, in the two shapes a page needs it: the spacing a
// reader expects, and the digits a dial takes. Every citation on a directory is
// matched against the first of these, so a page that formats its own copy is a
// second answer rather than the same one.
export const COMPANY_PHONE = SITE.phone
export const COMPANY_PHONE_HREF = SITE.phoneHref

// The whole of the location claim. The work is carried out from Baytown and
// reaches the towns around it, and there is nowhere a visitor can be met, so
// the claim is an area and carries no street line. Every citation on a
// directory is matched against this, and the schema in `index.html` publishes
// the same two lines.
export const COMPANY_LOCATION = SITE.location

// Where the company is written to, which the line above does not answer. The
// area claim and the mail box are two facts and the site says both: the towns
// the work reaches, and the Houston address the business is registered at.
// Null on a site that claims no address, and the foot of the page prints
// nothing rather than a blank line.
export const COMPANY_MAILING_ADDRESS = SITE.mailingAddress

// How an inquiry says it wants to be answered. The form asks because the sender
// knows better than the page does: a number on the screen says a call is
// possible, not that it is wanted, and a reply that guesses gets it wrong about
// half the time.
export const CONTACT_METHODS = [
  { value: 'either', label: 'Either Is Fine' },
  { value: 'email', label: 'Email Me' },
  { value: 'phone', label: 'Call Me' },
]

export const DEFAULT_CONTACT_METHOD = 'either'

export const BRAND_NAME = SITE.brandName

// Where the business can be followed. One entry per account that exists, so a
// page listing them shows what is actually there rather than a row of icons
// leading nowhere. `brand` names the glyph the view draws for it.
//
// The Google Business Profile is posted to through Buffer but is not here: it
// serves nothing public yet, so Maps answers its location id with an empty
// panel and a row for it would be an icon leading nowhere. `MarkGoogle` and the
// `google` entry in `BRAND_MARKS` are already drawn and wired, so the row is
// one line the day the listing surfaces.
export const SOCIAL_LINKS = [
  {
    brand: 'facebook',
    label: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61591005089902',
  },
  {
    brand: 'instagram',
    label: 'Instagram',
    href: INSTAGRAM_URL,
  },
  {
    brand: 'yelp',
    label: 'Yelp',
    href: 'https://www.yelp.com/biz/taylor-url-houston',
  },
]

/**
 * The menu, trimmed to the pages the site being built actually serves.
 *
 * The studio's menu names a portfolio, town pages, trade pages and free tools.
 * The second site has none of those, and a link to a route that was never
 * prerendered is a 404 with nothing in the build to warn about it — the route
 * table and the menu are two lists, and only one of them decides what exists.
 *
 * So the menu is filtered against the other list rather than written twice. A
 * page removed from a site's routes leaves its own menu at the same moment,
 * which is the failure this is here to make impossible.
 */
const SERVED = new Set(SECOND_SITE_ROUTES.map(route => route.path))

/**
 * Whether a destination leaves this origin.
 *
 * Every list below is filtered against the route table, and a route table only
 * knows about paths. A row pointing at the other site is not a route this build
 * failed to serve; it is not a route at all, and asking whether it was
 * prerendered is the wrong question about it.
 *
 * Asked of the string rather than of a flag on the entry, so a row cannot claim
 * to be off-site while carrying a path, or the reverse.
 */
const isOffSite = target => typeof target === 'string' && target.includes('://')

/**
 * The rows this site can actually draw.
 *
 * This filtered on `link.to` alone, which read as correct because every row had
 * one. A row carrying only an `href` has `to === undefined`, `SERVED.has(undefined)`
 * is false, and the row was dropped from the subsidiary without a word — while
 * the studio, which returns the array by identity, kept it. So the same list
 * produced different menus on the two sites for a reason nothing reported, and
 * the direction that lost was always the one pointing home.
 */
const served = links =>
  IS_SECOND_SITE ? links.filter(link => isOffSite(link.href) || SERVED.has(link.to)) : links

/**
 * The bar's grouped menus, and the second site has none.
 *
 * Filtering them the way every other list here is filtered is what the machinery
 * below does, and on this shape it produces the wrong answer rather than a
 * smaller one: three triggers reading Services, Work and Resources, opening
 * panels that between them hold three links, one of which is the about page
 * sitting under a heading that says Work on a site with no portfolio. A menu is
 * a claim about how much there is to navigate, and a heading standing over
 * almost nothing makes that claim falsely. Nothing 404s, so
 * `check-internal-links` is happy and always would be.
 *
 * Nine pages do not need a mega menu. Empty here means the bar draws
 * `DRAWER_LINKS` as plain links instead - the same three destinations, said
 * once - which is what a site this size actually has.
 */
export const NAV_GROUPS = IS_SECOND_SITE ? [] : STUDIO_NAV_GROUPS
export const DRAWER_LINKS = served(STUDIO_DRAWER_LINKS)
export const PRIMARY_LINKS = served(STUDIO_PRIMARY_LINKS)
export const LEGAL_LINKS = served(STUDIO_LEGAL_LINKS)

/**
 * Whether this site serves `path` at all.
 *
 * The menus above are filtered wholesale, but a few links are written into a
 * component by hand rather than drawn from a list - the status row in the
 * footer's Legal column is one. Those need the same question asked, and asking
 * it here keeps the answer coming off the route table rather than off somebody
 * remembering which pages the second site has.
 */
export const serves = target => isOffSite(target) || !IS_SECOND_SITE || SERVED.has(target)

/**
 * The other site, and the rows this one points at it with.
 *
 * `SIBLING` is the whole of what the chrome needs to name it: an origin to build
 * a link on and the name to print. Both come off the record `current.js`
 * resolved, so the losing site's copy is not in this bundle.
 *
 * `SIBLING_LINKS` is `CROSS_LINKS` read from this side. An entry names the site
 * that serves it, so the rows for this build are the ones naming the other, and
 * each becomes an `href` on the sibling's origin. `check-cross-links.js` resolves
 * every one of these against that site's route table, which is the only thing in
 * the repo that looks at a link leaving the origin it is drawn on.
 */
export const SIBLING = {
  origin: SITE.siblingOrigin,
  label: SITE.siblingShortName,
}

export const SIBLING_LINKS = CROSS_LINKS.filter(entry => entry.site !== SITE.key).map(entry => ({
  key: entry.key,
  href: `${SITE.siblingOrigin}${entry.path === '/' ? '' : entry.path}`,
  label: entry.label,
  summary: entry.summary,
}))

/**
 * The bar's, the drawer's and the footer's call to action, in one place.
 *
 * Three components draw this button and every one of them had the destination
 * written into it. On the studio that is right: /start is the checkout, and
 * "Start a Project" is what it does. The second site has no /start - it is not
 * in its route table and nothing prerenders it - so all three buttons were
 * links to a 404 sitting in the chrome of every page. It sells nothing on the
 * site either, so the enquiry form is where the same intent goes.
 *
 * One record rather than three conditionals, because the failure was three
 * copies of an answer and only some of them being corrected.
 */
export const START_LINK = IS_SECOND_SITE
  ? { to: '/contact', label: 'Send an Enquiry' }
  : { to: '/start', label: 'Start a Project' }
