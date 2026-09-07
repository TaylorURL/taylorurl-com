/**
 * The marks.
 *
 * Every one is drawn on the same twenty-four unit grid the blueprint rule
 * behind the pages is set on, in one stroke weight, with square caps and
 * mitred joins. That is what makes them read as drafting rather than as an
 * icon set: a drawing made with a straightedge, not a picture of a thing.
 *
 * They take their colour from the text around them and their size from a
 * class, so a mark sits in a menu row at fourteen pixels and on a card at
 * forty without a second copy existing at either size.
 *
 * Each names one thing this business actually does. A mark that could sit
 * beside any of the entries is a mark that says nothing, so no two share a
 * silhouette: a page, a page replacing a page, a form that submits, something
 * kept safe, a catalogue, a stack of work, a run of steps, a square,
 * a written page, a question, a heartbeat, a tag, an address, a search,
 * a sign on a post, a place on the map, a run of issues, a conversation.
 */

const BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.25,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
  'aria-hidden': 'true',
  focusable: 'false',
}

/** A brand-new website: one page, ruled and set. */
export function MarkFrame(props) {
  return (
    <svg {...BASE} {...props}>
      <rect x="3" y="4.5" width="18" height="15" />
      <path d="M3 9h18" />
      <path d="M6.5 12.5h7M6.5 15.5h9" />
    </svg>
  )
}

/** A redesign: the page that is there, and the page taking its place. */
export function MarkRefit(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 3.5h12v4M3 3.5v11h4" />
      <rect x="8" y="8.5" width="13" height="12" />
      <path d="M8 12.5h13" />
    </svg>
  )
}

/** Booking, ordering, and tools: a field, and the thing it goes through. */
export function MarkPanel(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 4.5h18v5H3z" />
      <path d="M6.5 6.5h6" />
      <path d="M5.5 15l4 4 9-9" />
    </svg>
  )
}

/** Looking after it after launch: the page, and what is kept over it. */
export function MarkGuard(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 4.5h18v6" />
      <path d="M3 4.5v15h7" />
      <path d="M16 10.5l4.5 2v3.5L16 20.5l-4.5-4.5V12.5z" />
    </svg>
  )
}

/** Every service side by side: the catalogue itself. */
export function MarkIndex(props) {
  return (
    <svg {...BASE} {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" />
      <rect x="13.5" y="3.5" width="7" height="7" />
      <rect x="3.5" y="13.5" width="7" height="7" />
      <rect x="13.5" y="13.5" width="7" height="7" />
    </svg>
  )
}

/** Client sites: work behind work. */
export function MarkStack(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M7 4.5h10" />
      <path d="M5 8h14" />
      <rect x="3" y="11.5" width="18" height="9" />
    </svg>
  )
}

/** The process: six steps, each one landing before the next begins. */
export function MarkSteps(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 20.5h4.5V16H12v-4.5h4.5V7H21" />
      <path d="M3 20.5V16" />
    </svg>
  )
}

/** Who builds it: the square every line on the site is drawn against. */
export function MarkSquare(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 4.5h18v3H3z" />
      <path d="M10 7.5h4v13h-4z" />
      <path d="M10 12h4M10 16h4" />
    </svg>
  )
}

/** Notes for owners: a written page, corner turned. */
export function MarkPage(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M4 3.5h10l5.5 5.5v11.5H4z" />
      <path d="M14 3.5v5.5h5.5" />
      <path d="M7 12.5h9.5M7 15.5h9.5M7 18.5h6" />
    </svg>
  )
}

/** Questions and answers: what is asked, and what comes back. */
export function MarkQuery(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M7.5 4.5H3.5v15h4" />
      <path d="M16.5 4.5h4v15h-4" />
      <path d="M9.5 9.5a2.5 2.5 0 015 0c0 2-2.5 2-2.5 4.5" />
      <path d="M12 16.5v1.5" />
    </svg>
  )
}

/** System status: the sites answering, minute by minute. */
export function MarkPulse(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 12h4l2-6 3 12 2-6h7" />
    </svg>
  )
}

/** Pricing: the figure carried on the thing it belongs to. */
export function MarkTag(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M12.5 3.5H20.5V11.5L11.5 20.5 3.5 12.5z" />
      <path d="M16 6.5h1.5V8H16z" />
    </svg>
  )
}

/** Business email: mail at the business's own name. */
export function MarkAt(props) {
  return (
    <svg {...BASE} {...props}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M15.5 12v2.5a2.5 2.5 0 005 0V12a8.5 8.5 0 10-4.5 7.5" />
    </svg>
  )
}

/** Getting found on Google: a list, and the search that turns it up. */
export function MarkFind(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 5.5h7M3 10h7M3 14.5h4" />
      <circle cx="15.5" cy="13.5" r="4.5" />
      <path d="M18.5 16.5L20.5 18.5" />
    </svg>
  )
}

/** Leads: the many at the top narrowing to the few who come out of it. */
export function MarkFunnel(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 4.5h18l-7 8v8l-4-2.5v-5.5z" />
      <path d="M7.5 8.5h9" />
    </svg>
  )
}

/** Every trade: the sign a business puts out front. */
export function MarkTrade(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3.5 3.5h17v8h-17z" />
      <path d="M7 7.5h10" />
      <path d="M12 11.5v9" />
      <path d="M8 20.5h8" />
    </svg>
  )
}

/** Service areas: one place, standing on the ground it covers. */
export function MarkArea(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M12 3.5a5.5 5.5 0 00-5.5 5.5c0 4 5.5 9 5.5 9s5.5-5 5.5-9A5.5 5.5 0 0012 3.5z" />
      <circle cx="12" cy="9" r="1.5" />
      <path d="M3 20.5h18" />
    </svg>
  )
}

/** The newsletter: the issues sent so far, side by side. */
export function MarkIssues(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 20.5h18" />
      <path d="M4.5 7.5h4v10h-4z" />
      <path d="M10 4.5h4v13h-4z" />
      <path d="M15.5 10.5h4v7h-4z" />
    </svg>
  )
}

/** Get in touch: a note sent, and the one that comes back. */
export function MarkTalk(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 3h11v6.5H6.5l-3.5 3z" />
      <path d="M10 11h11v6.5h-7.5l-3.5 3z" />
    </svg>
  )
}

/*
 * The console's own set. Same grid, same weight; each names a question a
 * section answers rather than a feature it has.
 */

/** Live: who is on the sites right now. */
export function MarkNow(props) {
  return (
    <svg {...BASE} {...props}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7.5 5.5a8.5 8.5 0 000 13M16.5 18.5a8.5 8.5 0 000-13" />
    </svg>
  )
}

/** Traffic: the shape of the window. */
export function MarkCurve(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 4.5v15h18" />
      <path d="M6 16l4-5 3.5 3L21 6.5" />
      <path d="M17.5 6.5H21V10" />
    </svg>
  )
}

/** Sources: where the visitors came in from. */
export function MarkInflow(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 5h6.5l3.5 7-3.5 7H3" />
      <path d="M13 12h8" />
      <path d="M17.5 8.5L21 12l-3.5 3.5" />
    </svg>
  )
}

/** Places: the countries a site is opened from. */
export function MarkTerritory(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 6.5l6-2.5 6 2.5 6-2.5v14l-6 2.5-6-2.5-6 2.5z" />
      <path d="M9 4v14M15 6.5v14" />
    </svg>
  )
}

/** Vitals: what a page costs to open. */
export function MarkGauge(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M9.5 3.5h5" />
      <path d="M12 3.5v2" />
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 13l3.5-3.5" />
    </svg>
  )
}

/** Audience: the people who agreed to hear from this business. */
export function MarkReach(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 8.5h18v11H3z" />
      <path d="M3 8.5l9-5 9 5" />
    </svg>
  )
}

/** Outreach: one sender, and the businesses being reached from it. */
export function MarkCanvass(props) {
  return (
    <svg {...BASE} {...props}>
      <rect x="3" y="8.5" width="6" height="7" />
      <path d="M9 12h3.5" />
      <path d="M12.5 5v14" />
      <path d="M12.5 5h8M12.5 12h8M12.5 19h8" />
    </svg>
  )
}

/** Admin: who may open what. */
export function MarkAccess(props) {
  return (
    <svg {...BASE} {...props}>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M3 20.5c0-3.5 2.5-5.5 5.5-5.5s5.5 2 5.5 5.5" />
      <path d="M15.5 6.5H21M15.5 10.5H21M18 6.5v4" />
    </svg>
  )
}

/** Settings: the account's own controls, each set where its owner put it. */
export function MarkDials(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3 7.5h4.5M13.5 7.5h7.5" />
      <circle cx="10.5" cy="7.5" r="3" />
      <path d="M3 16.5h6.5M15.5 16.5h5.5" />
      <circle cx="12.5" cy="16.5" r="3" />
    </svg>
  )
}

/** Layout and colour: the set square the page is drawn against. */
export function MarkRule(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3.5 20.5V3.5l17 17z" />
      <path d="M7 17h2M7 13.5h2M10.5 17h2" />
    </svg>
  )
}

/** Money: what the work costs, and what it returns. */
export function MarkLedger(props) {
  return (
    <svg {...BASE} {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" />
      <path d="M3.5 8.5h17" />
      <path d="M7 12.5h4M7 16.5h4" />
      <path d="M16 17.5v-5.5l-2 2M16 12l2 2" />
    </svg>
  )
}

/** A running series: the issues in it, one behind the next. */
export function MarkSeries(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M7.5 6.5h13v14h-13z" />
      <path d="M5 4.5v14M3.5 6.5v10" />
      <path d="M10.5 11h7M10.5 15h4" />
    </svg>
  )
}

/** Passing it on: one page, and the two it reaches. */
export function MarkShare(props) {
  return (
    <svg {...BASE} {...props}>
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <path d="M8 11l8-4M8 13l8 4" />
    </svg>
  )
}

/** The address itself: two links of it, taken to be copied. */
export function MarkLink(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M9.5 15a5 5 0 010-7l3.5-3.5a5 5 0 017 7L18 13.5" />
      <path d="M14.5 9a5 5 0 010 7l-3.5 3.5a5 5 0 01-7-7L6 10.5" />
    </svg>
  )
}

/** A code to be scanned: the three corners a reader locks onto, and the field. */
export function MarkScan(props) {
  return (
    <svg {...BASE} {...props}>
      <path d="M3.5 3.5h6v6h-6zM14.5 3.5h6v6h-6zM3.5 14.5h6v6h-6z" />
      <path d="M5.5 5.5h2v2h-2zM16.5 5.5h2v2h-2zM5.5 16.5h2v2h-2z" />
      <path d="M14.5 14.5h2.5v2.5h-2.5zM18.5 18.5h2v2h-2zM14.5 20.5h2M20.5 14.5v2" />
    </svg>
  )
}

/** What is paid: a stack of coins, counted from the side. */
export function MarkTender(props) {
  return (
    <svg {...BASE} {...props}>
      <ellipse cx="12" cy="6" rx="8" ry="2.5" />
      <path d="M4 6v6c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5V6" />
      <path d="M4 12v6c0 1.38 3.58 2.5 8 2.5s8-1.12 8-2.5v-6" />
    </svg>
  )
}

/** The call list: a handset off its rest, and the line it is placed down. */
export function MarkDial(props) {
  return (
    <svg {...BASE} {...props}>
      <rect x="3" y="3.5" width="5" height="5" />
      <rect x="16" y="15.5" width="5" height="5" />
      <path d="M8 8.5l8 7" />
    </svg>
  )
}
