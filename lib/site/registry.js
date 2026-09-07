import { LLMS_SECTIONS as TAYLORWEBSITE_LLMS_SECTIONS } from './routes/taylorwebsite.js'

/**
 * One record per site this repo builds.
 *
 * Two deployments are cut from one tree. `taylorurl` is the studio site that has
 * always been here; `taylorwebsite` is the subsidiary at taylor.website, selling
 * engineering, tracking repair and outbound to anyone rather than websites to the
 * towns around Baytown. They are the same company and the same design, so what
 * differs between them is content and reach, not identity.
 *
 * This file holds data and nothing else. It imports nothing, names no node
 * builtin and never reads `process`, because the same module is pulled into a
 * browser chunk, a Vercel function, `vite.config.js` and a check script run under
 * bare node, and any one of those four would refuse it otherwise. The key is
 * resolved next door in `current.js`, which is the only file in the repo that
 * reads the environment variable.
 *
 * Every field declared on one record is declared on both. A view compiles for
 * both keys whether or not its route is built for both, so a field that is simply
 * absent reads as `undefined` at a call site that expected a string, and the page
 * renders the word rather than failing. Absent is spelled `null` here, and
 * `scripts/site/check-site-key.js` refuses a record that is missing a field the other
 * one carries.
 */

/**
 * The studio site. Every value is transcribed from where it was hardcoded before
 * this file existed, so the first build after the collapse is byte-identical:
 * `src/app/constants/seo.js` for the origin, `navigation.js` for the contact
 * scalars, `components/Seo.jsx` for the head defaults.
 */
export const taylorurl = {
  key: 'taylorurl',

  // The canonical origin, with no trailing slash, so a path appends directly.
  // Three files declared this independently before the registry; they now read
  // it from here, which is why the sitemap, the feed, every canonical and every
  // og:url are one answer rather than three that happened to agree.
  origin: 'https://www.taylorurl.com',

  // The legal entity, which both sites share. taylor.website is a property of
  // the same company, not a second one, so the reviews, the BBB seal and the
  // Trustpilot standing belong to it as much as they belong to taylorurl.com.
  brandName: 'TaylorURL LLC',
  shortName: 'TaylorURL',

  // The other site, named here rather than looked up.
  //
  // Both sites are one company and a reader should be able to cross between
  // them, which means the chrome has to know an origin that is not its own. The
  // map next door in `sites.js` holds both records and would answer this
  // directly, and it is exactly what must not be reached: the note at the top of
  // that file records that building the map keeps every object it touches, and
  // that the whole of taylor.website's title and origin rode inside
  // taylorurl.com's `Seo` chunk until it moved out. `current.js` picks one record
  // and drops the other, so a field on the record folds to a literal and carries
  // nothing with it.
  //
  // Written by hand on both records, which means the two can disagree.
  // `check-cross-links.js` is what stops them: it asserts this equals the other
  // record's `origin`, and the label the other record's `shortName`.
  siblingOrigin: 'https://taylor.website',
  siblingShortName: 'Taylor',

  supportEmail: 'trenton@taylorurl.com',
  salesEmail: 'trenton@taylorurl.com',

  phone: '(281) 862-8687',
  phoneHref: 'tel:+12818628687',

  // The whole of the location claim. The work is carried out from Baytown and
  // there is nowhere a visitor can be met, so the claim is an area and carries
  // no street line.
  location: 'Baytown, Texas',
  locationShort: 'Baytown, TX',

  // The company's registered mail box, which is a different fact from the line
  // above it. `location` is where the work is carried out and the area it
  // reaches; this is the address the business is written to, and it is in
  // Houston rather than Baytown. It is a mail box and not a place a visitor can
  // be met, so it stands in the colophon and nowhere a reader would take it for
  // an office: the contact block still offers the phone, the email and the area.
  mailingAddress: '3120 Southwest Fwy Ste 101, PMB #841258, Houston, TX 77098-4520',

  logoAlt: 'TaylorURL, custom websites for local businesses in Baytown, TX',

  footerBlurb:
    'Custom websites for plumbers, barbers, restaurants, and contractors around Baytown, ' +
    'Houston, and the rest of Southeast Texas. One person builds your site and keeps it running.',

  head: {
    homeTitle: 'Web Design & Development in Baytown, TX | TaylorURL LLC',
    description:
      'Web design and development in Baytown, TX for shops, restaurants, trades, and local pros around Houston. Custom sites from $1,000, built to get found on Google.',
    image: '/og.png',
    imageAlt:
      'Custom websites for local businesses: design, build, hosting, and getting found on Google, for shops and trades around Baytown and Houston.',
  },

  // What an installed shortcut is called and what the install prompt says about
  // it, filled into `public/site.webmanifest` at build time. The name and the
  // short name are the two above; only the sentence is its own field, because a
  // manifest description is a listing line rather than the search snippet
  // `head.description` is, and the two say different things at different
  // lengths. Transcribed from the manifest as it already shipped.
  installDescription:
    'Custom websites for shops, restaurants, trades, and independent pros around Baytown and Houston.',

  // Whether this deployment is the one that answers the crons. Both Vercel
  // projects register all ten schedules, because `vercel.json` is read by the
  // platform before a build runs and cannot be keyed. The code is what decides,
  // and exactly one record may say true.
  runsSchedules: true,

  // The grouping key the browser error reporter posts under, and what the Pi's
  // ticket queue files a fault against. Two sites reporting the same label would
  // merge into one ticket and be worked as one fault.
  errorLabel: 'TaylorURL',

  // Whether the site publishes articles. Decides the feed autodiscovery link in
  // the head as well as whether feed.xml is written at all.
  blog: true,
  feedTitle: 'TaylorURL Blog',

  // Whether the build publishes the review and local-business structured data.
  // The rating and the client quotes are real and belong to the studio; a second
  // domain publishing them would be claiming a reputation it has not earned
  // under a name nobody left a review for.
  reviews: true,
  localSeo: true,

  // Whether there is a client console here, and with it the sign-in, sign-up and
  // password screens that only exist to reach one. It is `robots.txt` that asks
  // about this: the file names those five paths so a crawler leaves them out of
  // the index, and naming a path a site does not serve tells a crawler about a
  // section that is not there and invites it to go and look.
  console: true,

  // What this deployment measures with, and the accounts each hit is filed
  // against. Two flags rather than one because they are turned on by different
  // people at different moments: the first-party collector wants a row in the
  // analytics table, and the tag block wants a Google property and a Meta pixel
  // that only the account holder can create.
  //
  // They are per-site because sharing the studio's identifiers with a second
  // domain quietly corrupts both. One collector key files two sites' traffic
  // under one record, so the figures the daily maintenance run reads and the
  // rows the console draws would be counting visitors to a site they do not
  // describe. One Meta pixel is worse than untidy: it is a single optimisation
  // signal learning from two different offers, so every lead the subsidiary
  // books teaches the studio's ad delivery to go and find the wrong buyer.
  analytics: true,
  analyticsSiteKey: 'sa_3f6a07135e29f39beffe158c4c89e40b',
  adTracking: true,
  gaId: 'G-SZGX8HZZMB',
  metaPixelId: '2209997659783641',

  // The ad account, and the three actions in it this site can honestly fire. It
  // is a separate identifier from `gaId` because it answers a separate question:
  // the property measures what a reader did, and this decides what the bidding
  // learns from. Importing the property's key events into the ad account was the
  // arrangement before this, and it cost a day of lag and every conversion the
  // import could not match back to a click.
  //
  // The labels are held per action rather than derived from the account id,
  // because the account mints one when an action is created and there is no rule
  // that produces it from anything else. Each is `<adsId>/<label>`, which is the
  // shape `send_to` is read in, so the pair is stored the way it is used.
  adsId: 'AW-18415746315',
  adsLeadSendTo: 'AW-18415746315/XIOACOPdlu8cEIv6p81E',
  adsCallSendTo: 'AW-18415746315/S-cNCPGMl-8cEIv6p81E',
  adsCheckoutSendTo: 'AW-18415746315/cWtLCN2ipO8cEIv6p81E',

  // null means the guide's built-in list, which is the studio's.
  llmsSections: null,

  // Which endpoints this deployment answers on. null is every one of them, which
  // is what the studio has always served and what a repo with a single site
  // means. An empty array would mean none, which is a different statement.
  apiAllowlist: null,

  llmsIntro:
    'TaylorURL LLC is a one-person web design studio in Baytown, Texas, run by Trenton ' +
    'Taylor. He designs, builds, and looks after custom websites for local businesses ' +
    'around Baytown and Houston: shops, ' +
    'restaurants, trades, and independent pros. A site starts at $1,000 up front and $250 a ' +
    'month to run.',
  llmsContact: 'Baytown, TX. Call or text (281) 862-8687. Write to trenton@taylorurl.com.',
}

/**
 * The subsidiary. It carries no portfolio, no industries, no service towns and
 * no local schema, because none of those are true of it: the offer reaches
 * anybody anywhere and has no address to claim.
 *
 * The head copy is deliberately plain. It says what the site sells, and it does
 * not borrow the studio's proof.
 */
export const taylorwebsite = {
  key: 'taylorwebsite',

  origin: 'https://taylor.website',

  brandName: 'TaylorURL LLC',
  shortName: 'Taylor',

  // The other site. The note on the studio's record says why this is a field
  // rather than a lookup, and why a check has to hold the pair together.
  siblingOrigin: 'https://www.taylorurl.com',
  siblingShortName: 'TaylorURL',

  supportEmail: 'trenton@taylorurl.com',
  salesEmail: 'trenton@taylorurl.com',

  phone: '(281) 862-8687',
  phoneHref: 'tel:+12818628687',

  // No locality claim. The whole point of the second site is that the work does
  // not arrive at an address, so a `LocalBusiness` node naming a town would be
  // publishing a limit that is not there.
  location: null,
  // Rendered where the studio prints its town. Empty rather than a placeholder,
  // because a line naming nowhere reads worse than no line.
  locationShort: '',

  // The mail box belongs to the same company and would be true here, but this
  // site prints no address of any kind and a colophon that suddenly named a
  // street would be the one place it did. Null keeps the foot of the page
  // saying what the rest of the record says.
  mailingAddress: null,

  logoAlt: 'Taylor, software engineering, tracking repair, and outbound email',

  footerBlurb:
    'Custom software, conversion tracking repaired so the numbers report what actually ' +
    'happened, and outbound email run from a domain of your own. One person does the work.',

  head: {
    homeTitle: 'Software Engineering, Tracking Repair and Outbound | Taylor',
    description:
      'Custom software, conversion tracking that actually reports what it should, and done-for-you outbound. Built and run by an engineer, for companies anywhere.',
    // Its own card, not the studio's. `public/og.png` is a picture of the studio
    // — a town, an offer in websites, and taylorurl.com printed in the corner —
    // and it was the og:image on all ten of these pages, so every unfurl in
    // Slack, iMessage, LinkedIn and Facebook argued against the page it linked
    // to and against the alt text on the line below. `brand/social/src/` draws
    // this one on the studio card's own chassis.
    image: '/og-taylorwebsite.png',
    imageAlt: 'Software engineering, conversion tracking repair, and done-for-you outbound email.',
  },

  installDescription:
    'Custom software, conversion tracking repair, and done-for-you outbound email, for companies anywhere.',

  runsSchedules: false,

  errorLabel: 'Taylor',

  // No articles at launch. With this false the feed link is cut from the head
  // and no feed.xml is written, so nothing advertises a file that is not there.
  blog: false,
  feedTitle: null,

  reviews: false,
  localSeo: false,

  // No console, so no sign-in, sign-up or password screens either. With this
  // false those five paths leave `robots.txt`, which otherwise published a map
  // of a section this deployment answers 404 on.
  console: false,

  // Off at launch because this site has nothing of its own to file against, not
  // as a position on measurement. Turning either on is filling in the identifier
  // beside it - a row in the analytics table for the collector, a property and a
  // pixel for the tag block - and until those exist the studio's are the only
  // identifiers there are, which is the sharing the other record refuses.
  //
  // Nothing breaks in the meantime. The tag block and the collector are cut from
  // the head, and `recordLead` already reads both tags at the moment of use and
  // reports nothing when neither is there.
  analytics: false,
  analyticsSiteKey: null,
  adTracking: false,
  gaId: null,
  metaPixelId: null,

  // No ad account either, and the four nulls are what keep it that way. A
  // `send_to` naming the studio's account on this domain would file a second
  // site's leads against the studio's bidding, which is the sharing the comment
  // above refuses on the pixel and refuses here for the same reason.
  adsId: null,
  adsLeadSendTo: null,
  adsCallSendTo: null,
  adsCheckoutSendTo: null,

  // The guide's own sections, which describe what this site publishes rather
  // than what the studio publishes. Held beside the routes they organise.
  llmsSections: TAYLORWEBSITE_LLMS_SECTIONS,

  // Two endpoints, and every other one 404s. The enquiry form is the only way
  // off this site, and the version is what a release check reads from outside.
  //
  // `analytics` is absent although the collector sounds like it belongs: that
  // endpoint is the console's summary proxy, read by `useAnalytics`, which only
  // the console pages mount - and this site has no console. The collector the
  // visitor's browser talks to is a Supabase function on its own origin and
  // never passes through here.
  //
  // Everything absent is absent for a reason worth naming: checkout and the
  // Stripe webhook because nothing is sold here; the newsletter and the eight
  // outreach endpoints because a second deployment sending from the same warmed
  // domain on the same schedule is two pipelines wearing one reputation; the
  // admin endpoints and the client portal because there is no console here;
  // speed-check and site-audit because both spend the Google PageSpeed quota and
  // the second project gets its own rate limiter, so the ceiling is doubled
  // rather than shared; and notify because client deployments have that URL
  // compiled into them and it answers at taylorurl.com or nowhere.
  apiAllowlist: ['contact', 'version'],

  llmsIntro:
    'Taylor is Trenton Taylor, an engineer working on his own. He builds custom software to ' +
    'order, repairs conversion tracking so ad spend is measured against the leads that came ' +
    'in, and runs outbound email from a sending domain registered for the client. The work is ' +
    'done for companies anywhere and is quoted per project.',
  llmsContact: 'Write to trenton@taylorurl.com.',
}

/** The key a build falls back to when the environment names none. */
export const DEFAULT_SITE_KEY = 'taylorurl'

/**
 * Every legal value of the SITE variable.
 *
 * Written out rather than derived with `Object.keys(SITES)`, because deriving it
 * makes every importer of the key list an importer of the whole map, and the map
 * is what drags both sites' content into both sites' bundles. `current.js` needs
 * this list to refuse an unknown key and must not pay for the map to get it.
 *
 * `scripts/site/check-site-key.js` asserts this list and `SITES` name the same sites,
 * so writing it by hand cannot drift from the records it describes.
 */
export const SITE_KEYS = ['taylorurl', 'taylorwebsite']
