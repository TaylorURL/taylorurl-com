import { matchRoutes } from 'react-router-dom'

// Relative, not `@lib`, for the reason `src/app/constants/seo.js` gives: this
// module is read by the browser through Vite and by check scripts under bare
// node, and an aliased import resolves for only one of them.
import { IS_SECOND_SITE } from '../../../lib/site/current.js'
import { VIEW_KEYS as SECOND_SITE_VIEWS } from '../../../lib/site/routes/taylorwebsite.js'

/**
 * Whether this build has accounts at all.
 *
 * The studio sells a build, and what a buyer gets with it is a console: the
 * project tracker, the analytics and the invoices. The subsidiary sells nothing
 * on the site, has no console and no client portal, and its own privacy policy
 * tells a reader in as many words that there is nothing here to sign in to.
 *
 * One answer, exported, because the router and the bar both need it and the
 * failure that made it worth writing down is exactly the two of them
 * disagreeing: the screens were mounted and the bar offered them, on a site
 * whose page says neither exists.
 */
export const HAS_ACCOUNTS = !IS_SECOND_SITE

/**
 * Whether this build has a newsletter.
 *
 * The newsletter belongs to the studio, and four routes exist only because of
 * it: the archive at `/notes`, an issue's own page, and the two pages a mailed
 * link opens. The subsidiary sends none. It stands up no signup form, its guide
 * has no newsletter section, `vite/site-routes.js` already answers the issue
 * query with an empty list for it, and its allowlist admits neither subscription
 * endpoint - so the archive drew nothing and both link pages answered a token
 * they had nowhere to send. None of the four is in that site's list of pages
 * either, so none was prerendered and none was in a menu: they were reachable by
 * typing the URL and by nothing else.
 */
export const HAS_NEWSLETTER = !IS_SECOND_SITE

/**
 * Routes are data so the two entry points can load views differently: the
 * browser entry passes lazy() views for code splitting, the prerender entry
 * passes eager ones because static rendering can't await. Each `key` is the
 * view's file name under `@views`.
 *
 * `account: true` marks a route that exists only because there are accounts, and
 * `newsletter: true` one that exists only because there is a newsletter. Both
 * come out below on the site that has neither, so a URL typed by hand reaches
 * the same nothing the menus offer rather than the studio's sign-in form
 * rendered against the shared project on the wrong origin, or an archive with no
 * issues behind it.
 */
const ALL_ROUTES = [
  { key: 'Home', index: true },
  { key: 'About', path: 'about' },
  { key: 'Services', path: 'services' },
  // Each service line's own page. One view answers for all four, from the
  // content held against the slug in the path.
  { key: 'ServiceDetail', path: 'services/:service' },
  // The two services that are not one of the four lines. A static path outranks
  // a parameterized one however they are ordered, so both reach their own view
  // rather than the one above.
  { key: 'BusinessEmail', path: 'services/business-email' },
  { key: 'ServiceSeo', path: 'services/seo' },
  // The price, on a page of its own rather than only at the end of the
  // configurator.
  { key: 'Pricing', path: 'pricing' },
  { key: 'Contact', path: 'contact' },
  // The configurator every Start a Project button opens: one page that fills
  // in around the trade a visitor picks and finishes on the three ways to
  // start.
  { key: 'Start', path: 'start' },
  // The same sale with the argument taken out, for a build agreed in person.
  // Noindex, in no menu, and reached by being handed the address; the
  // configurator above is the way in for everybody who was not.
  { key: 'Payment', path: 'payment' },
  { key: 'Privacy', path: 'privacy' },
  { key: 'Terms', path: 'terms' },
  { key: 'License', path: 'license' },
  { key: 'Process', path: 'process' },
  { key: 'Portfolio', path: 'portfolio' },
  // The two landing families, and the destinations the navigation's panels
  // point at. Both are built entirely from `@data/towns-and-trades/trades`, `@data/portfolio`
  // and the town list, so which detail routes exist is decided by the data
  // rather than restated here (see vite/site-routes.js).
  { key: 'Industries', path: 'industries' },
  { key: 'Industry', path: 'industries/:slug' },
  { key: 'Areas', path: 'areas' },
  { key: 'Area', path: 'areas/:slug' },
  // One case study per portfolio entry that carries one. Which slugs exist is
  // decided by `@data/portfolio`, so a new client arrives with its page from
  // the same object that puts it on the index.
  { key: 'CaseStudy', path: 'portfolio/:slug' },
  // The free tools. One view answers for all of them, from the entry held
  // against the slug in the path, the way the service pages do.
  { key: 'Tools', path: 'tools' },
  // The speed check. It takes an address and an email and answers with the
  // reading, so it sits beside the tools rather than inside them: the tools
  // index renders one view from a registry entry and this one has an endpoint
  // and a form of its own.
  { key: 'SpeedCheck', path: 'speed-check' },
  { key: 'ToolPage', path: 'tools/:slug' },
  { key: 'Blog', path: 'blog' },
  { key: 'BlogSeries', path: 'blog/series/:slug' },
  { key: 'BlogPost', path: 'blog/:slug' },
  // The newsletter archive. Issues live in the database rather than in a data
  // module, so which detail routes exist is decided at build time by the same
  // query the page makes (see vite/site-routes.js).
  { key: 'Notes', path: 'notes', newsletter: true },
  { key: 'NotesIssue', path: 'notes/:slug', newsletter: true },
  { key: 'Faq', path: 'faq' },
  // The assistant's own page. The widget itself is mounted in the layout and
  // reaches every route; this is where it is introduced and where it opens on
  // arrival.
  { key: 'Live', path: 'live' },
  { key: 'Login', path: 'login', session: true, account: true },
  { key: 'Signup', path: 'signup', session: true, account: true },
  // The two pages a newsletter link opens. Each reads the token in its query
  // string, acts on it and reports; both are noindex and out of the sitemap.
  { key: 'ConfirmSubscription', path: 'subscribe/confirm', newsletter: true },
  { key: 'Unsubscribe', path: 'unsubscribe', newsletter: true },
  // The two halves of a password reset: the page that asks for the link, and
  // the page the link lands on. Both are noindex, like the rest of the account
  // screens.
  { key: 'ForgotPassword', path: 'forgot-password', account: true },
  { key: 'ResetPassword', path: 'reset-password', account: true },
  // The console and its sections. Every one is its own URL, so the sidebar is
  // navigation a person can bookmark and come back to rather than a tab strip
  // hiding state. Status is the public one and is in the sitemap; the rest ask
  // for an account and are not.
  {
    key: 'Console',
    path: 'console',
    session: true,
    account: true,
    children: [
      { key: 'ConsoleOverview', index: true },
      { key: 'ConsoleOnboarding', path: 'onboarding' },
      { key: 'ConsoleProject', path: 'project' },
      { key: 'ConsoleLive', path: 'live' },
      { key: 'ConsoleSites', path: 'sites' },
      { key: 'ConsolePages', path: 'pages' },
      { key: 'ConsoleSources', path: 'sources' },
      { key: 'ConsoleVisitors', path: 'visitors' },
      { key: 'ConsoleVitals', path: 'vitals' },
      { key: 'ConsoleAudience', path: 'audience' },
      { key: 'ConsoleOutreach', path: 'outreach' },
      { key: 'ConsoleNewsletter', path: 'newsletter' },
      { key: 'ConsoleMail', path: 'mail' },
      { key: 'ConsoleSettings', path: 'settings' },
      { key: 'ConsoleBuilds', path: 'builds' },
      { key: 'ConsoleLeads', path: 'leads' },
      { key: 'ConsolePayments', path: 'payments' },
      { key: 'ConsoleAdmin', path: 'admin' },
      { key: 'ConsoleStatus', path: 'status' },
    ],
  },
  { key: 'NotFound', path: '*' },
]

/** Whether a route is one this build has no reason to carry. */
const omitted = route => (route.account && !HAS_ACCOUNTS) || (route.newsletter && !HAS_NEWSLETTER)

/**
 * Whether this build mounts a route at all.
 *
 * The markers above take a family off a site that has no accounts or no
 * newsletter, and they only ever describe the studio's own reasons. The
 * subsidiary's reason is the opposite one: it publishes a written list of pages
 * and mounts what that list names, so a route family added to the studio next
 * year reaches it never rather than reaching it by default. That is why this
 * reads as an allow-list on the second site and a deny-list on the studio.
 */
const mounted = route =>
  !omitted(route) && (!IS_SECOND_SITE || SECOND_SITE_VIEWS.includes(route.key))

/**
 * What this build actually mounts.
 *
 * The same array on the studio, by reference, so nothing about the site that has
 * always been here goes through a filter to come out unchanged.
 *
 * `!IS_SECOND_SITE` is redundant beside the two flags today, because both are
 * defined as exactly that. It is written anyway: a third site registered with
 * accounts and a newsletter would otherwise take the by-reference branch and
 * mount the studio's whole table, which is the failure this file exists to stop.
 */
export const ROUTE_DEFINITIONS =
  HAS_ACCOUNTS && HAS_NEWSLETTER && !IS_SECOND_SITE ? ALL_ROUTES : ALL_ROUTES.filter(mounted)

/*
 * The same definitions in the shape react-router matches against, so a URL can
 * be resolved to the views it renders without rendering anything. The prerender
 * uses it to work out which stylesheets a route's HTML needs in its <head>;
 * deriving it here rather than restating the paths keeps it from drifting from
 * what the Routes above actually mount.
 */
const MATCH_TREE = [
  {
    path: '/',
    children: ROUTE_DEFINITIONS.map(({ key, index, path, children }) => ({
      key,
      index,
      path,
      children: children?.map(child => ({ key: child.key, index: child.index, path: child.path })),
    })),
  },
]

/**
 * @param {string} pathname - Route path, e.g. `/console/status`.
 * @returns {string[]} Keys of every view the path mounts, outermost first.
 */
export function matchViewKeys(pathname) {
  return (matchRoutes(MATCH_TREE, pathname) || []).map(match => match.route.key).filter(Boolean)
}
