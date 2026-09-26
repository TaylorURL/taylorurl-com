import { lazyWithRetry } from '@utils/lazyWithRetry'
import { HAS_ACCOUNTS, matchViewKeys } from '@constants/routes'
import { IS_SECOND_SITE } from '../../lib/site/current.js'

// The import itself, held by name rather than handed straight to lazy(). A
// route's chunk is a thing the page may need to have in hand *before* it
// hydrates, and a lazy() component gives no way to ask for the module behind
// it; the factory does.
//
// Gated the way the route table next door is gated, and on the same constants,
// because a key this build cannot mount must carry no import() for Rollup to
// find. Each folds to a literal (see lib/site/current.js), so the branch that
// lost is dropped along with every chunk it named. Ungated, this map was
// reachable through Object.entries below whatever the route table said, and
// reachable is all Rollup asks: the subsidiary's dist carried the console and
// its seventeen sections, the sign-in and password screens, and the portfolio
// with every client on it, as files nothing on that site could ever ask for.
const loaders = {
  Home: () => import('@views/home/Home'),
  About: () => import('@views/company/About'),
  Services: () => import('@views/services/Services'),
  ServiceDetail: () => import('@views/services/ServiceDetail'),
  ...(IS_SECOND_SITE
    ? {}
    : {
        BusinessEmail: () => import('@views/services/BusinessEmail'),
        ServiceSeo: () => import('@views/services/ServiceSeo'),
        MobileApps: () => import('@views/services/MobileApps'),
        OnlineTools: () => import('@views/services/OnlineTools'),
      }),
  Contact: () => import('@views/company/Contact'),
  ...(IS_SECOND_SITE
    ? {}
    : {
        Live: () => import('@views/company/Live'),
        Start: () => import('@views/start/Start'),
      }),
  Privacy: () => import('@views/legal/Privacy'),
  Terms: () => import('@views/legal/Terms'),
  ...(IS_SECOND_SITE
    ? {}
    : {
        License: () => import('@views/legal/License'),
        Process: () => import('@views/company/Process'),
        Portfolio: () => import('@views/portfolio/Portfolio'),
        Industries: () => import('@views/industries/Industries'),
        Industry: () => import('@views/industries/Industry'),
        Areas: () => import('@views/areas/Areas'),
        Area: () => import('@views/areas/Area'),
        CaseStudy: () => import('@views/portfolio/CaseStudy'),
        Tools: () => import('@views/tools/Tools'),
        ToolPage: () => import('@views/tools/ToolPage'),
        SpeedCheck: () => import('@views/tools/SpeedCheck'),
        Blog: () => import('@views/blog/Blog'),
        BlogPost: () => import('@views/blog/BlogPost'),
        BlogSeries: () => import('@views/blog/BlogSeries'),
        Faq: () => import('@views/company/Faq'),
        // The page a mailed unsubscribe link lands on. It outlived the
        // newsletter it was built beside because it was never only the
        // newsletter's: `api/lead-unsubscribe.js` and
        // `api/outreach/unsubscribe.js` both redirect a click here, so it
        // answers the unsubscribe link in every lead follow-up and every cold
        // email. Studio-only, because the studio is the site that sends them.
        Unsubscribe: () => import('@views/subscription/Unsubscribe'),
      }),
  NotFound: () => import('@views/NotFound'),
  // The console, its sections, and the four screens that exist only to reach
  // it. SessionScope is here rather than above because it is the holder those
  // screens sit under, and routes.jsx reads it only when there are any.
  ...(HAS_ACCOUNTS
    ? {
        Console: () => import('@views/console/Console'),
        ConsoleOverview: () => import('@views/console/pages/traffic/OverviewPage'),
        ConsoleOnboarding: () => import('@views/console/pages/health/OnboardingPage'),
        ConsoleProject: () => import('@views/console/pages/health/ProjectPage'),
        ConsoleLive: () => import('@views/console/pages/traffic/LivePage'),
        ConsoleSites: () => import('@views/console/pages/traffic/SitesPage'),
        ConsolePages: () => import('@views/console/pages/traffic/PagesPage'),
        ConsoleSources: () => import('@views/console/pages/traffic/SourcesPage'),
        ConsoleVisitors: () => import('@views/console/pages/traffic/VisitorsPage'),
        ConsoleVitals: () => import('@views/console/pages/health/VitalsPage'),
        ConsoleServer: () => import('@views/console/pages/health/ServerPage'),
        ConsoleOutreach: () => import('@views/console/pages/email/OutreachPage'),
        ConsoleSettings: () => import('@views/console/pages/studio/SettingsPage'),
        ConsoleBuilds: () => import('@views/console/pages/studio/BuildsPage'),
        ConsoleLeads: () => import('@views/console/pages/studio/LeadsPage'),
        ConsoleStaff: () => import('@views/console/pages/studio/StaffPortalPage'),
        ConsolePayments: () => import('@views/console/pages/studio/PaymentsPage'),
        ConsoleAdmin: () => import('@views/console/pages/studio/AdminPage'),
        ConsoleStatus: () => import('@views/console/pages/health/StatusPage'),
        // The representatives' portal and the three surfaces behind it. Gated
        // with the console above rather than beside it, because what both
        // families need is an account, and a build with no accounts carries no
        // import() for either.
        Login: () => import('@views/auth/Login'),
        Welcome: () => import('@views/auth/Welcome'),
        ForgotPassword: () => import('@views/auth/ForgotPassword'),
        ResetPassword: () => import('@views/auth/ResetPassword'),
        SessionScope: () => import('@components/account/SessionScope'),
      }
    : {}),
}

// What `resolveArrival` below found a key's chunk dead of, keyed as the loaders
// are. Written there and read by the lazy copy here, which is the hand-off that
// was missing: see the note inside `resolveArrival`.
const failedOnArrival = new Map()

export const views = Object.fromEntries(
  Object.entries(loaders).map(([key, factory]) => [
    key,
    // Read at pass time rather than now. This map is built while the module
    // loads, which is before `resolveArrival` has asked for anything, so a
    // value taken here would always be empty; React calls the factory when the
    // view first mounts, which is after.
    lazyWithRetry(factory, { after: () => failedOnArrival.get(key) || null }),
  ])
)

/**
 * The views a path mounts, as modules rather than as lazy() placeholders.
 *
 * A lazy() view that has not resolved suspends, and a boundary that suspends
 * while the browser is hydrating is a boundary React gives up on: it discards
 * the markup the server sent, draws the fallback, and builds the page over
 * again from nothing. The only route this can happen to is the one the visitor
 * landed on - which is precisely the route whose markup was written at build
 * time, so the page they waited for is the page that gets thrown away.
 *
 * Asking for those few modules first costs the fetch the boundary was going to
 * pay for regardless, and hydration then finds the components already in hand.
 * A chunk that will not load resolves to nothing and the lazy() copy carries
 * on from there, retries and error boundary and all.
 *
 * @param {string} pathname - The address the browser opened.
 * @returns {Promise<Record<string, React.ComponentType>>} Views keyed as the
 *   lazy map is, holding every view that arrived.
 */
export async function resolveArrival(pathname) {
  const keys = matchViewKeys(pathname).filter(key => loaders[key])
  // Settled rather than all, so one route's chunk failing does not throw away
  // the modules that did arrive. `Promise.all` rejects on the first failure, and
  // the empty map that followed put hydration back on the lazy copy for views
  // that were already in hand.
  const arrivals = await Promise.allSettled(keys.map(key => loaders[key]()))
  const ready = {}
  keys.forEach((key, index) => {
    const arrival = arrivals[index]
    if (arrival.status === 'fulfilled') {
      ready[key] = arrival.value.default
      return
    }
    // What this key died of, kept for the lazy copy above rather than dropped.
    //
    // This is the one place on the site that asks for a route's chunk with no
    // ladder, no build probe and no report, and it is the first place to ask for
    // the landed route's - ahead of hydration, by design. A rejection here was
    // swallowed whole, and swallowing it is not the same as its not having
    // happened: the built specifier is recorded failed in this document's module
    // map, keyed by URL and never revisited, so every later import() of that
    // exact address is handed the stored rejection with nothing sent. That is
    // the same reading the ladder next door was built on (see `refetch`), and it
    // is measured there.
    //
    // So `lazyWithRetry` opened its pass at that same built address as its
    // attempt 0, spent the rung on a request that was never made, and fired its
    // one supersession probe off a rejection that had never been near the
    // network - on a build that was present and healthy the whole time. `after`
    // was written for exactly this hand-off and nothing in the site ever passed
    // it, so the knowledge died here and the ladder was never told.
    failedOnArrival.set(key, arrival.reason)
  })
  return ready
}
