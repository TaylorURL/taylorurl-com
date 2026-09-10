import {
  MarkFrame,
  MarkGuard,
  MarkInflow,
  MarkPanel,
  MarkReach,
  MarkRefit,
} from '@components/marks/marks'
import { SERVICE_LINES } from '@data/pages/services'
import { SERVICE_PAGES as TAYLORWEBSITE_PAGES } from '../taylorwebsite/serviceDetailTaylorwebsite.js'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'
import { BUILD_PRICE, MONTHLY_PRICE, PRICE_OFFERS } from '@data/checkout/pricing'

/**
 * What each service line's own page says, keyed by the slug the line already
 * carries. The name, the summary, and the path stay in `@data/services`, so a
 * line renamed there is renamed on its page, in the menu, and in the sitemap at
 * the same time.
 *
 * - `eyebrow`  The small label above the page title.
 * - `description` What a search result says under the title, inside the 155
 *              characters a result shows.
 * - `lede`     The paragraph under the title on the page itself.
 * - `covers`   What the work includes.
 * - `excludes` What it does not, named rather than left to be discovered.
 * - `timeline` How long it takes.
 * - `running`  What it costs to run, in the two figures every service shares.
 * - `beside`   One page of this service's own, shown beside the price and the
 *              process that every service page links. Optional, and only where
 *              a service has a neighbour a reader would otherwise confuse it
 *              with.
 */
const DETAIL = {
  'new-website': {
    mark: MarkFrame,
    eyebrow: 'New Builds',
    description: `A custom website for a Baytown or Houston business: designed, written, built, and launched by a small team. From ${BUILD_PRICE} up front and ${MONTHLY_PRICE} a month to run.`,
    lede: 'Design, writing, build, domain, and launch all happen here, whether you have never had a site or you have a page somebody set up years ago and walked away from.',
    covers: [
      {
        title: 'Design From Scratch',
        body: 'Layout, type, and color drawn for your business. No theme underneath it, so nothing else is wearing the same one.',
      },
      {
        title: 'The Writing',
        body: 'Page copy written from what you tell us on the first call, then edited until it sounds like you talking.',
      },
      {
        title: 'Every Screen',
        body: 'Phones, tablets, and computers. Each one opened and checked by hand.',
      },
      {
        title: 'Domain and Launch',
        body: 'The web address registered or moved across, mail left running, and the site put live.',
      },
      {
        title: 'Found From Day One',
        body: 'Titles, descriptions, structured data, and a sitemap all in place on launch day, so Google can read the site the first time it looks.',
      },
      {
        title: 'Handed Over Working',
        body: 'Photos, hours, prices, and contact details all in, so the site is finished when it goes live.',
      },
    ],
    excludes: [
      {
        title: 'Logo Design',
        body: 'The site is built around the logo you have. If there isn’t one yet, we can point you at people who draw them.',
      },
      {
        title: 'Photography',
        body: 'Photos of the shop, the crew, and the work come from you.',
      },
      {
        title: 'Paid Ads',
        body: 'The tracking a campaign runs on goes in with the build. Buying the ads and running the campaigns is separate work with its own price, and the search work in the monthly is organic.',
      },
    ],
    timeline:
      'Two to four weeks from the first call to launch day, in the six steps the process page sets out.',
    running: `From ${BUILD_PRICE} to build, paid once before the work begins. Then from ${MONTHLY_PRICE} a month to host it, watch it, change it, and carry on the search work. What moves the price is how big the whole project is, and you agree to that number before anything starts.`,
  },
  redesign: {
    mark: MarkRefit,
    eyebrow: 'Redesigns',
    description:
      'Rebuilding a small business site that stopped bringing work in. New design, new pages, old addresses still working, two to four weeks start to finish.',
    lede: 'A site that exists and has stopped bringing work in gets rebuilt from the frame up, and every address your current pages are found under keeps working.',
    covers: [
      {
        title: 'A Read of What’s There',
        body: 'What the current site does well, where it loses people, and which pages are worth carrying over.',
      },
      {
        title: 'Rebuilt, Not Patched',
        body: 'New structure, new pages, new code. Nothing from the old build carries through underneath.',
      },
      {
        title: 'Addresses Kept',
        body: 'Every page worth keeping redirects to its replacement, so old links and search results still land.',
      },
      {
        title: 'Content Carried Over',
        body: 'Text, photos, reviews, and anything else earning its place moves across.',
      },
      {
        title: 'Faster Pages',
        body: 'Built to load quickly on a phone on mobile data, which is where most of your visitors are.',
      },
      {
        title: 'A Clean Switch',
        body: 'Domain, hosting, and mail records moved on a date you pick, with the old site up until the new one answers.',
      },
    ],
    excludes: [
      {
        title: 'Patching the Old Platform',
        body: 'A rebuild leaves WordPress, Wix, and Squarespace behind. There is no theme editing or plugin work here.',
      },
      {
        title: 'A Promised Position',
        body: 'A rebuild fixes what was holding the site back. No one can promise a spot on page one, and anyone who does is guessing.',
      },
      {
        title: 'Logo Design and Photography',
        body: 'Both come from you, the same as on a new build.',
      },
      {
        title: 'Keeping a Page That Isn’t Working',
        body: 'Pages nobody reads come out. You see the list before anything goes.',
      },
    ],
    timeline: 'Two to four weeks. A redesign takes about as long as a new site, because it is one.',
    running: `From ${BUILD_PRICE} to rebuild, paid once before the work begins, then from ${MONTHLY_PRICE} a month to run it. The same two figures as a new build.`,
  },
  /**
   * The one line whose page is not the shared shape.
   *
   * `@views/services/OnlineTools` renders it, and the words are held there
   * beside the layout they were written for, the way business email and the
   * search work hold theirs. What stays here is what every other surface reads:
   * the mark a card and a menu row draw, and - through `SERVICE_LINES` - the
   * name, the summary and the path. A second copy of the page's own covers and
   * limits would sit here rendering nowhere and drift from the page inside a
   * release.
   */
  'online-tools': {
    mark: MarkPanel,
  },
  care: {
    mark: MarkGuard,
    eyebrow: 'After Launch',
    description: `Hosting, backups, security, changes any time, and realtime error monitoring. The monthly, from ${MONTHLY_PRICE}, is what keeps the site online. No per-change fee.`,
    lede: `What the monthly, from ${MONTHLY_PRICE}, pays for. Hosting, backups, security, monitoring, and any change you want, for as long as the site runs.`,
    covers: [
      {
        title: 'Hosting and Backups',
        body: 'Hosting, daily backups, updates, and security handled without being asked.',
      },
      {
        title: 'Changes Any Time',
        body: 'New photos, new prices, a new page. There is no fee for a change and no ticket to file.',
      },
      {
        title: 'Realtime Error Monitoring',
        body: 'Every fault the site throws in a visitor’s browser reaches us as it happens.',
      },
      {
        title: 'Watched Around the Clock',
        body: 'Uptime checked continuously, and what it finds is published on the status page for anyone to read.',
      },
      {
        title: 'Found on Google',
        body: 'Organic search work every month the site is under care. It does not stop at launch day.',
      },
      {
        title: 'A Direct Line to the Team',
        body: 'You text the people who built it. No account manager, no support queue.',
      },
    ],
    excludes: [
      {
        title: 'New Features',
        body: 'A new booking system or a whole new section is its own work, quoted before it starts. Text, photo, and page changes are not.',
      },
      {
        title: 'Your Other Software',
        body: 'The plan covers the website. It does not cover the point of sale, the accounting software, or the phone system.',
      },
      {
        title: 'Ad Spend',
        body: 'The monthly buys no advertising and runs no campaigns. It keeps the tracking under them working, and the search work in it is organic.',
      },
      {
        title: 'A Contract',
        body: 'There is no annual term to sign, no notice period, and no cancellation fee. The monthly is not optional though: it is what keeps the site online, so stopping it takes the site offline at the end of the period you have paid for.',
      },
    ],
    timeline: 'Starts the day the build is paid for and runs for as long as the site is online.',
    running: `From ${MONTHLY_PRICE} a month, the same figure whether one change is asked for or ten.`,
  },
}

/**
 * Every service line with its page content attached, for whichever site is
 * building.
 *
 * `offers` is what the page's service node publishes, and it is the same pair
 * for all four studio lines: the studio sells one build and one monthly, and a
 * line is a thing that build covers rather than a price of its own. The
 * subsidiary's pages each carry their own, because there the three are priced
 * separately and two of the three carry no monthly at all.
 *
 * The studio's pages are built inside the branch rather than in a const above
 * it. A `const` holding a `.map()` call reads as possibly side-effecting, so the
 * bundler keeps it even where nothing references it, and `DETAIL` with it -
 * which is how the whole of the studio's service copy was still in the
 * subsidiary's chunk after the selection had already picked the other pages.
 */
export const SERVICE_PAGES = IS_SECOND_SITE
  ? TAYLORWEBSITE_PAGES
  : SERVICE_LINES.map(line => ({ ...line, ...DETAIL[line.slug], offers: PRICE_OFFERS }))

/**
 * The two services that are not one of the four lines. Both are real work with
 * a page of their own, and neither is a stage of a build, so they carry their
 * own name and summary rather than a slug in `@data/services`.
 */
export const EXTRA_SERVICES = IS_SECOND_SITE
  ? []
  : [
      {
        path: '/services/business-email',
        name: 'Business Email',
        summary: 'Mail on your own domain, set up and moved across.',
        mark: MarkReach,
      },
      {
        path: '/services/seo',
        name: 'Getting Found on Google',
        summary: 'Organic search work, included in the monthly.',
        mark: MarkInflow,
      },
    ]

/**
 * @param {string} slug - Last segment of a service page's path.
 * @returns {object|null} The line and its page content, or null for a slug no
 *   service line carries.
 */
export function servicePage(slug) {
  return SERVICE_PAGES.find(page => page.slug === slug) || null
}

/**
 * @param {string} [slug] - A service to leave out, normally the current page.
 * @returns {object[]} The service lines, as cards linking to their own pages.
 */
export function otherServices(slug) {
  return SERVICE_PAGES.filter(page => page.slug !== slug)
}
