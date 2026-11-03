import {
  MarkAccess,
  MarkDial,
  MarkDials,
  MarkGauge,
  MarkIndex,
  MarkInflow,
  MarkPulse,
  MarkRack,
  MarkTender,
} from '@components/marks/marks'

/**
 * The console's sections, in menu order.
 *
 * This is the catalogue the sidebar, the mobile tab strip, and the router all
 * read, so a section exists in exactly one place rather than being listed once
 * per surface and drifting.
 *
 * A client reads three: Overview (who is on now and what the window brought),
 * Speed and Status, plus Settings from the account panel. The studio's side is
 * the two things the owner works from - the Inbox of people who wrote back and
 * the Call List - and the money, the accounts and the server.
 *
 * `mark` is the drawing the sidebar puts beside the label, and the only thing
 * left of a row once the column is collapsed - so no two may share a silhouette.
 *
 * `locked` is the one thing that varies within a visit. Status is the console's
 * public section, being the uptime monitor's feed; the rest are an account's
 * own and are locked for a signed-out reader, who still sees them in the menu
 * and is sent to sign in on clicking one.
 *
 * `admin` marks a section only an admin account may open. That mark takes the
 * row out of the menu and `ConsoleFrame` reads it a second time to shut the
 * address, sending anybody else back to the Overview.
 *
 * `menu: false` keeps a section out of the column while leaving it a section:
 * Settings is reached from the account panel.
 *
 * `figures: false` takes the account's traffic strip off the top of a section
 * that answers a different question. `account: true` marks a section that
 * answers for the account rather than for anything happening on a site, and
 * `scope: false` one with no site to choose.
 *
 * `description` is the tooltip the menu shows; `meta` is the same section
 * written for a search result. `title` overrides the head title where the
 * section is known by a name other than its menu label.
 */

export const SECTIONS = [
  {
    id: 'overview',
    mark: MarkIndex,
    group: 'Site',
    path: '',
    label: 'Overview',
    description: 'Who is on the site now, and this month’s visitors, pages and sources.',
    meta: 'The traffic of every site under care on one screen: who is reading right now, visitors and pageviews over the window you pick, the pages carrying the most of it, and where readers came from.',
  },
  {
    id: 'vitals',
    mark: MarkGauge,
    group: 'Site',
    path: 'vitals',
    label: 'Speed',
    description: 'What a page costs to open, on a phone and on a desktop.',
    title: 'Speed - Console',
    meta: 'PageSpeed readings for every site: performance, accessibility, best practices, and SEO, measured on both a throttled phone and a desktop.',
  },
  {
    id: 'status',
    mark: MarkPulse,
    group: 'Site',
    path: 'status',
    label: 'Status',
    description: 'Uptime, open issues, and the last thirty days per site.',
    title: 'Live System Status',
    meta: 'Live uptime for every site TaylorURL hosts and maintains: what is answering right now, any open issue, and the outages of the last thirty days.',
    public: true,
  },
  {
    id: 'inbox',
    mark: MarkInflow,
    group: 'Studio',
    path: 'inbox',
    label: 'Inbox',
    admin: true,
    // A reply is a person writing back rather than anything happening on a
    // site, so the traffic strip, the window and the site chooser all measure
    // something else.
    account: true,
    scope: false,
    figures: false,
    description: 'Everybody who wrote back to an email, and every enquiry, with the conversation.',
    title: 'Inbox - Console',
    meta: 'Every person who answered an outreach email, and every enquiry from the site, the ads and the phone, newest first, with the conversation and the way to answer it.',
  },
  {
    id: 'calls',
    mark: MarkDial,
    group: 'Studio',
    path: 'calls',
    label: 'Call List',
    admin: true,
    // A business to ring is not a site with a window over it, so the traffic
    // strip, the date picker and the site chooser all measure something else.
    account: true,
    scope: false,
    figures: false,
    description: 'The businesses worth ringing, callbacks first, and the result of every call.',
    title: 'Call List - Console',
    meta: 'The businesses worth calling, with the callbacks that are due first and the reason each one is on the list, and the record of every call placed.',
  },
  {
    id: 'payments',
    mark: MarkTender,
    group: 'Studio',
    path: 'payments',
    label: 'Payments',
    admin: true,
    // Money answers for the studio rather than for a site. A client's fee is
    // the same figure whichever site is in scope, so the traffic strip, the
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
  {
    id: 'server',
    mark: MarkRack,
    group: 'Studio',
    path: 'server',
    label: 'Server',
    admin: true,
    // The machine the studio runs, rather than one of the sites it serves.
    // Picking a site over it narrows nothing, there is no window to put over a
    // temperature, and the traffic strip counts an audience this section has
    // none of.
    account: true,
    scope: false,
    figures: false,
    description: 'The machine behind the monitoring, and every routine on it.',
    title: 'Sunday Server - Console',
    meta: 'The Sunday Server, which runs everything visitor-facing that is not a site: how long it has been up, what it is carrying, and whether each of the routines on it is running, behind or stopped.',
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
    description: 'The name on the account and how it signs in.',
    title: 'Account Settings - Console',
    meta: 'Everything about the account rather than the figures in it: the name on it, the address and password it signs in with, two-factor authentication, the sessions it holds, and closing it.',
  },
]

/** The headings the sidebar files sections under, in the order they appear. */
export const GROUPS = ['Site', 'Studio']

/**
 * What each heading reads as. A client sees the first heading only: every
 * section under the second is marked `admin`.
 */
export const GROUP_LABELS = {
  Site: 'Site',
  Studio: 'Studio',
}

/**
 * The menu, with each section marked for whether this reader can open it.
 *
 * `admin` shuts a section to everybody but an admin, and the endpoints behind
 * those sections refuse any other account on every request, so this decides
 * which sections a reader is offered rather than what they may read.
 */
export function menuSections({ signedIn, role }) {
  return SECTIONS.filter(
    section => section.menu !== false && (!section.admin || role === 'admin')
  ).map(section => ({
    ...section,
    locked: !signedIn && !section.public,
  }))
}

/** `/console`, `/console/inbox`, and so on. */
export function sectionHref(section) {
  return section.path ? `/console/${section.path}` : '/console'
}
