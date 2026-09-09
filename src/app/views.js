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
        Pricing: () => import('@views/pricing/Pricing'),
      }),
  Contact: () => import('@views/company/Contact'),
  ...(IS_SECOND_SITE
    ? {}
    : {
        Live: () => import('@views/company/Live'),
        Start: () => import('@views/start/Start'),
        Payment: () => import('@views/start/Payment'),
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
        ConsoleOutreach: () => import('@views/console/pages/email/OutreachPage'),
        ConsoleSettings: () => import('@views/console/pages/studio/SettingsPage'),
        ConsoleBuilds: () => import('@views/console/pages/studio/BuildsPage'),
        ConsoleLeads: () => import('@views/console/pages/studio/LeadsPage'),
        ConsoleCalls: () => import('@views/console/pages/studio/CallsPage'),
        ConsolePayments: () => import('@views/console/pages/studio/PaymentsPage'),
        ConsoleAdmin: () => import('@views/console/pages/studio/AdminPage'),
        ConsoleStatus: () => import('@views/console/pages/health/StatusPage'),
        Login: () => import('@views/auth/Login'),
        Signup: () => import('@views/auth/Signup'),
        ForgotPassword: () => import('@views/auth/ForgotPassword'),
        ResetPassword: () => import('@views/auth/ResetPassword'),
        SessionScope: () => import('@components/account/SessionScope'),
      }
    : {}),
}

export const views = Object.fromEntries(
  Object.entries(loaders).map(([key, factory]) => [key, lazyWithRetry(factory)])
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
 *   lazy map is, or an empty map if any of them failed to arrive.
 */
export async function resolveArrival(pathname) {
  const keys = matchViewKeys(pathname).filter(key => loaders[key])
  try {
    const modules = await Promise.all(keys.map(key => loaders[key]()))
    return Object.fromEntries(keys.map((key, index) => [key, modules[index].default]))
  } catch {
    return {}
  }
}
