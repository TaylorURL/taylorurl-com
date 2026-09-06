import { lazyWithRetry } from '@utils/lazyWithRetry'
import { HAS_ACCOUNTS, HAS_NEWSLETTER, matchViewKeys } from '@constants/routes'
import { IS_SECOND_SITE } from '../../lib/site/current.js'

// The import itself, held by name rather than handed straight to lazy(). A
// route's chunk is a thing the page may need to have in hand *before* it
// hydrates, and a lazy() component gives no way to ask for the module behind
// it; the factory does.
//
// Gated the way the route table next door is gated, and on the same two
// constants, because a key this build cannot mount must carry no import() for
// Rollup to find. Both fold to a literal (see lib/site/current.js), so the
// branch that lost is dropped along with every chunk it named. Ungated, this
// map was reachable through Object.entries below whatever the route table said,
// and reachable is all Rollup asks: the subsidiary's dist carried the console
// and its seventeen sections, the sign-in and password screens, and the whole of
// the newsletter, as files nothing on that site could ever ask for.
const loaders = {
  Home: () => import('@views/Home'),
  About: () => import('@views/About'),
  Services: () => import('@views/Services'),
  ServiceDetail: () => import('@views/ServiceDetail'),
  ...(IS_SECOND_SITE
    ? {}
    : {
        BusinessEmail: () => import('@views/BusinessEmail'),
        ServiceSeo: () => import('@views/ServiceSeo'),
        Pricing: () => import('@views/Pricing'),
      }),
  Contact: () => import('@views/Contact'),
  ...(IS_SECOND_SITE
    ? {}
    : {
        Live: () => import('@views/Live'),
        Start: () => import('@views/Start'),
      }),
  Privacy: () => import('@views/Privacy'),
  Terms: () => import('@views/Terms'),
  ...(IS_SECOND_SITE
    ? {}
    : {
        License: () => import('@views/License'),
        Process: () => import('@views/Process'),
        Portfolio: () => import('@views/Portfolio'),
        Industries: () => import('@views/Industries'),
        Industry: () => import('@views/Industry'),
        Areas: () => import('@views/Areas'),
        Area: () => import('@views/Area'),
        CaseStudy: () => import('@views/CaseStudy'),
        Tools: () => import('@views/Tools'),
        ToolPage: () => import('@views/ToolPage'),
        SpeedCheck: () => import('@views/SpeedCheck'),
        Blog: () => import('@views/Blog'),
        BlogPost: () => import('@views/BlogPost'),
        BlogSeries: () => import('@views/BlogSeries'),
        Faq: () => import('@views/Faq'),
      }),
  NotFound: () => import('@views/NotFound'),
  // The archive, an issue's own page, and the two pages a mailed link opens.
  ...(HAS_NEWSLETTER
    ? {
        Notes: () => import('@views/Notes'),
        NotesIssue: () => import('@views/NotesIssue'),
        ConfirmSubscription: () => import('@views/ConfirmSubscription'),
        Unsubscribe: () => import('@views/Unsubscribe'),
      }
    : {}),
  // The console, its sections, and the four screens that exist only to reach
  // it. SessionScope is here rather than above because it is the holder those
  // screens sit under, and routes.jsx reads it only when there are any.
  ...(HAS_ACCOUNTS
    ? {
        Console: () => import('@views/Console'),
        ConsoleOverview: () => import('@views/console/pages/OverviewPage'),
        ConsoleOnboarding: () => import('@views/console/pages/OnboardingPage'),
        ConsoleProject: () => import('@views/console/pages/ProjectPage'),
        ConsoleLive: () => import('@views/console/pages/LivePage'),
        ConsoleSites: () => import('@views/console/pages/SitesPage'),
        ConsolePages: () => import('@views/console/pages/PagesPage'),
        ConsoleSources: () => import('@views/console/pages/SourcesPage'),
        ConsoleVisitors: () => import('@views/console/pages/VisitorsPage'),
        ConsoleVitals: () => import('@views/console/pages/VitalsPage'),
        ConsoleAudience: () => import('@views/console/pages/AudiencePage'),
        ConsoleOutreach: () => import('@views/console/pages/OutreachPage'),
        ConsoleNewsletter: () => import('@views/console/pages/NewsletterPage'),
        ConsoleMail: () => import('@views/console/pages/MailPage'),
        ConsoleSettings: () => import('@views/console/pages/SettingsPage'),
        ConsoleBuilds: () => import('@views/console/pages/BuildsPage'),
        ConsoleLeads: () => import('@views/console/pages/LeadsPage'),
        ConsolePayments: () => import('@views/console/pages/PaymentsPage'),
        ConsoleAdmin: () => import('@views/console/pages/AdminPage'),
        ConsoleStatus: () => import('@views/console/pages/StatusPage'),
        Login: () => import('@views/Login'),
        Signup: () => import('@views/Signup'),
        ForgotPassword: () => import('@views/ForgotPassword'),
        ResetPassword: () => import('@views/ResetPassword'),
        SessionScope: () => import('@components/SessionScope'),
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
