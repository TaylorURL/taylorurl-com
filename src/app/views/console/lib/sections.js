import {
  MarkAccess,
  MarkAt,
  MarkCanvass,
  MarkDials,
  MarkFunnel,
  MarkGauge,
  MarkIndex,
  MarkInflow,
  MarkIssues,
  MarkLedger,
  MarkNow,
  MarkPage,
  MarkPulse,
  MarkQuery,
  MarkReach,
  MarkStack,
  MarkSteps,
  MarkTender,
  MarkTerritory,
} from '@components/marks'

/**
 * The console's sections, in menu order.
 *
 * This is the catalogue the sidebar, the mobile tab strip, and the router all
 * read, so a section exists in exactly one place rather than being listed once
 * per surface and drifting.
 *
 * Status leads, because it is the section every reader can open and the one a
 * signed-out visitor is already looking at.
 *
 * A section does not come and go with the scope. A menu that changes shape
 * underneath someone is a menu they have to re-read: a section that was there a
 * moment ago and is gone now reads as something taken away rather than
 * something waiting, so each answers for its own empty scope instead - Pages
 * with no site in scope says to pick one, and says it in the place the pages
 * would have been.
 *
 * Sites is the one section that cannot do that, because comparison is the whole
 * of what it is. Every site side by side is not a reading that exists when the
 * scope holds one site: the page has nothing to lay beside anything, and the
 * row leads to a heading about comparison over a single figure. So `multiSite`
 * marks it, and it appears only while more than one site is in view - every
 * site at once, or a set of them. This is the shape of the `admin` rule rather
 * than of the `locked` one: not a door to be opened by signing in, but a
 * question that has no answer from where the reader is standing.
 *
 * `mark` is the drawing the sidebar puts beside the label, and the only thing
 * left of a row once the column is collapsed - so no two may share a silhouette.
 *
 * `group` is the heading the sidebar files the section under. Sixteen flat
 * entries is a list to search; four headings of two to six is a shape to aim
 * at, and the grouping follows the question each section answers rather than
 * the feed it reads. Health is whether the site is up and what it costs to
 * open. Traffic is how many came, when, what they read and who they were, and
 * it is the whole of what a client reads. The two headings after it are the
 * studio's own: Email is everything written to a person from this domain, and
 * Studio is the work and the accounts behind the sites. A client never sees
 * either heading, since every section under them is marked `admin`.
 *
 * The one thing that varies within a visit is `locked`. Status is the console's
 * public section, being the uptime monitor's feed, which says nothing about any
 * one account; the rest are an account's own figures and are marked
 * locked for a signed-out reader, who still sees them in the menu and is sent
 * to sign in on clicking one. Settings is locked on the same terms: it is one
 * account's own arrangements, and there is nothing in it to read without one.
 *
 * Outreach, Newsletter, Subscribers, Sent Mail, Builds, Payments and Admin are
 * the other exceptions, and they are the same kind: `admin` marks a section
 * that is not in the menu at all unless the account holds that role. A locked
 * section is one this reader could open by signing in, which is worth showing;
 * a section for a role they will never hold is not an invitation but a list of
 * what somebody else can do, and the endpoints behind them refuse any account
 * that is not an admin, so listing them to a client offers a door that answers
 * only by refusing.
 *
 * Neither mark is what keeps anything private. The collector verifies the
 * session on every request and answers by account, and the admin endpoints
 * refuse any account that is not an admin, so this only decides how the menu
 * reads.
 *
 * `menu: false` keeps a section out of the column while leaving it a section.
 * Settings is reached from the account panel at the head of the column, which is
 * where a reader looks for what belongs to the account rather than to the
 * figures; listing it a second time in the sections underneath puts one door in
 * two places and makes the reader decide which one they meant.
 *
 * `figures: false` takes the account's traffic strip off the top of a section.
 * That strip counts audience across the sites under care - who is on them now,
 * visitors, pageviews, sessions, session length and bounce - and a section
 * answering a different question puts its own figures there instead. Outreach
 * counts businesses being written to, which that strip does not measure.
 *
 * `account: true` marks the section that answers for the account rather than
 * for anything happening on a site. It carries no traffic strip, for the same
 * reason the two above carry none. It is offered no window, no re-read and no
 * feed state either, because all three act on feeds it never reads and a
 * control that changes nothing on screen is one a reader presses twice before
 * deciding the page is broken.
 *
 * `scope: false` marks a section that answers for the account rather than for
 * any one site. Every other section has two readings - the site in scope, or
 * every site at once - and the chooser under the heading is what moves between
 * them. A section with no such pair is offered no chooser, because picking a
 * site over a mailing list or a roll of accounts narrows nothing.
 *
 * `description` is the tooltip the menu shows; `meta` is the same section
 * written for a search result, which needs a fuller sentence than a tooltip
 * does. `title` overrides the head title where the section is known by a name
 * other than its menu label - Status is System Status to anyone outside the
 * console. Each section carries its own pair so no two console URLs answer to
 * one title and one description.
 */

export const SECTIONS = [
  {
    id: 'onboarding',
    mark: MarkQuery,
    group: 'Health',
    path: 'onboarding',
    label: 'Your Brief',
    description: 'The questions the build starts from, one at a time.',
    title: 'Your Brief - Console',
    meta: 'Everything the studio needs from a client before their site is drawn: what they want it to do, the business behind it, the customers they are after, the pages they want, and the words and pictures that go on them.',
    // A brief answers for the build rather than for a site, and there is no
    // site yet to put a window over, so the figures strip, the date picker and
    // the site chooser all measure something that is not there.
    account: true,
    scope: false,
    // Only for an account that has bought a build, for the same reason the
    // tracker is. Nobody else has anything to answer.
    project: true,
    duringBuild: true,
  },
  {
    id: 'project',
    mark: MarkSteps,
    group: 'Health',
    path: 'project',
    label: 'Your Site',
    description: 'Where your build has reached, and everything written to you about it.',
    title: 'Your Site - Console',
    meta: 'The build of your website as it happens: the stage the work has reached, what is still needed from you, and every update written along the way.',
    // A project is not a site with a window over it, so the figures strip, the
    // date picker and the site chooser all belong to something else.
    account: true,
    scope: false,
    // Only for an account that has bought a build. Nobody else has anything
    // for this section to say.
    project: true,
    duringBuild: true,
  },
  {
    id: 'status',
    mark: MarkPulse,
    group: 'Health',
    path: 'status',
    label: 'Status',
    description: 'Uptime, open issues, and the last thirty days per site.',
    title: 'Live System Status',
    meta: 'Live uptime for every site TaylorURL hosts and maintains: what is answering right now, any open issue, and the outages of the last thirty days.',
    public: true,
    duringBuild: true,
  },
  {
    id: 'vitals',
    mark: MarkGauge,
    group: 'Health',
    path: 'vitals',
    label: 'Vitals',
    description: 'What a page costs to open, on a phone and on a desktop.',
    title: 'Vitals - Console',
    meta: 'PageSpeed readings for every site: performance, accessibility, best practices, and SEO, measured on both a throttled phone and a desktop.',
  },
  {
    id: 'overview',
    mark: MarkIndex,
    group: 'Traffic',
    path: '',
    label: 'Overview',
    description:
      'Pageviews and sessions over the window, the hours and days they arrive in, and who is reading now.',
    meta: 'The traffic of every site under care in one place: pageviews and sessions over the window you pick, the hours and days readers arrive in, who is on right now, and the pages carrying the most of it.',
  },
  {
    id: 'live',
    mark: MarkNow,
    group: 'Traffic',
    path: 'live',
    label: 'Live',
    description: 'Who is reading right now, which page they are on, and from where.',
    meta: 'Who is reading right now, which page each of them is on, and the part of the world they opened it from, refreshed every few seconds as they move.',
  },
  {
    id: 'sites',
    mark: MarkStack,
    group: 'Traffic',
    path: 'sites',
    label: 'Sites',
    multiSite: true,
    description: 'Every site side by side over the same window.',
    meta: 'Every site under care side by side over the same window, so one week of visitors, pageviews, and session length reads against another site directly.',
  },
  {
    id: 'pages',
    mark: MarkPage,
    group: 'Traffic',
    path: 'pages',
    label: 'Pages',
    description: 'Which pages are read, how they are landed on, and for how long.',
    meta: 'Which pages get read, how visitors land on them, how long each one holds a reader, and which page they were on when they left the site.',
  },
  {
    id: 'sources',
    mark: MarkInflow,
    group: 'Traffic',
    path: 'sources',
    label: 'Sources',
    description: 'Where visitors arrive from, and which campaigns brought them.',
    meta: 'Where visitors arrive from - search, social, referrals, and direct - and which campaign carried each of them in over the window you pick.',
  },
  {
    id: 'visitors',
    mark: MarkTerritory,
    group: 'Traffic',
    path: 'visitors',
    label: 'Visitors',
    description:
      'Where visitors are, and what they read on: countries, cities, devices, browsers, and languages.',
    title: 'Visitors - Console',
    meta: 'Who the visitors are: the countries and cities they open the site from, and the devices, browsers, operating systems, and languages they read it on, counted over the window you pick.',
  },
  {
    id: 'outreach',
    mark: MarkCanvass,
    group: 'Email',
    path: 'outreach',
    label: 'Outreach',
    admin: true,
    scope: false,
    figures: false,
    description: 'Businesses found, what went out to them, and what came back.',
    title: 'Outreach - Console',
    meta: 'Every business the cold email engine has found: the address it reached, the audit behind the approach, the stage it stands at, and every message to and from it.',
  },
  {
    id: 'newsletter',
    mark: MarkIssues,
    group: 'Email',
    path: 'newsletter',
    label: 'Newsletter',
    admin: true,
    scope: false,
    figures: false,
    description: 'The issues, what is written, what has gone out, and what came back.',
    title: 'Newsletter - Console',
    meta: 'Where an issue is written, previewed as the message a reader receives, marked ready, and sent to the people who asked for it, with what each issue did once it landed.',
  },
  {
    id: 'audience',
    mark: MarkReach,
    group: 'Email',
    path: 'audience',
    label: 'Subscribers',
    admin: true,
    // A mailing list is not read over a traffic window, so the strip of
    // traffic figures and the window that moves them answer nothing here.
    account: true,
    scope: false,
    description: 'Everyone on the mailing list, and where each of them stands.',
    title: 'Subscribers - Console',
    meta: 'Every person on the mailing list: the address, the segment it belongs to, where the signup came from, and whether it is subscribed, waiting, or gone.',
  },
  {
    id: 'mail',
    mark: MarkAt,
    group: 'Email',
    path: 'mail',
    label: 'Sent Mail',
    admin: true,
    // What has been sent is not a reading taken over a window, so the strip of
    // traffic figures and the window that moves them answer nothing here.
    account: true,
    scope: false,
    description: 'Every message the site sends, and who it reached.',
    title: 'Sent Mail - Console',
    meta: 'Every message this site sends, laid out as the person on the other end receives it: when it went, the address it reached, and the state it ended in. Any of them can be sent to your own inbox and read as mail.',
  },
  {
    id: 'settings',
    mark: MarkDials,
    group: 'Account',
    path: 'settings',
    label: 'Settings',
    menu: false,
    account: true,
    scope: false,
    description: 'The name on the account, how it signs in, and how it looks.',
    title: 'Account Settings - Console',
    meta: 'Everything about the account rather than the figures in it: the name on it, the address and password it signs in with, two-factor authentication, the light or dark setting, the sessions it holds, and closing it.',
  },
  {
    id: 'builds',
    mark: MarkLedger,
    group: 'Studio',
    path: 'builds',
    label: 'Builds',
    admin: true,
    // A build answers for itself rather than for a site: it exists before the
    // site does, so the traffic strip, the window and the site chooser all
    // measure something that is not there yet.
    account: true,
    scope: false,
    description: 'Every build in the record, what stage it is at, and what it waits on.',
    title: 'Builds - Console',
    meta: 'Every website being built: the stage each one has reached, what is still owed by the client, the updates written to them, and the captures of their own pages attached to each.',
  },
  {
    id: 'leads',
    mark: MarkFunnel,
    group: 'Studio',
    path: 'leads',
    label: 'Leads',
    admin: true,
    // A lead is a person who started a build rather than anything happening on
    // a site, so the traffic strip, the window and the site chooser all
    // measure something else.
    account: true,
    scope: false,
    description: 'Everyone who started a build, and how far each of them got.',
    title: 'Leads - Console',
    meta: 'Every address left on the first step of the configurator: the trade beside it, the screen they reached, where they arrived from, and whether they went on to enquire, open a checkout or pay.',
  },
  {
    id: 'payments',
    mark: MarkTender,
    group: 'Studio',
    path: 'payments',
    label: 'Payments',
    admin: true,
    // Money answers for the studio rather than for a site. A client's fee is
    // the same figure whichever site is in scope, and it is owed for weeks
    // before there is a site to put it against, so the traffic strip, the
    // window and the site chooser all measure something else.
    account: true,
    scope: false,
    description: 'What every client pays, and everything they have paid.',
    title: 'Payments - Console',
    meta: 'Every client who pays for a build or for the care that runs it: what each is on and how often it comes round, what they paid up front, everything received to date, and any arrangement that is not billing the way it should.',
  },
  {
    id: 'admin',
    mark: MarkAccess,
    group: 'Studio',
    path: 'admin',
    label: 'Admin',
    admin: true,
    scope: false,
    description: 'Accounts, the sites they can open, and who owns what.',
    title: 'Admin - Console',
    meta: 'Every account and every site side by side: what each person may open, which site belongs to whom, and the roles that decide both.',
  },
]

/** The headings the sidebar files sections under, in the order they appear. */
export const GROUPS = ['Health', 'Traffic', 'Email', 'Studio']

/**
 * The menu, with each section marked for whether this reader can open it.
 *
 * `inView` is how many sites the current scope covers, which is what decides a
 * `multiSite` section. It is left undefined until the account's sites have been
 * read, and an undefined count keeps the section: a row that appears a second
 * after the page does reads as the menu still loading, where one that vanishes
 * a second after the page does reads as something being taken away.
 *
 * `onboarding` is the other way round, and deliberately so. While a site is
 * being built there is nothing for the traffic sections to report, so the menu
 * closes down to the few that can answer rather than offering a dozen rows of
 * empty tables. A missing flag leaves the whole menu standing, because a
 * console that hides most of itself while it works out what is going on is
 * worse than one that briefly shows too much.
 */
export function menuSections({ signedIn, role, inView, hasProject, onboarding }) {
  const comparing = inView === undefined || inView > 1
  return SECTIONS.filter(
    section =>
      section.menu !== false &&
      (!section.admin || role === 'admin') &&
      (!section.multiSite || comparing) &&
      (!section.project || hasProject) &&
      (!onboarding || section.duringBuild === true)
  ).map(section => ({
    ...section,
    locked: !signedIn && !section.public,
  }))
}

/** `/console`, `/console/live`, and so on. */
export function sectionHref(section) {
  return section.path ? `/console/${section.path}` : '/console'
}
