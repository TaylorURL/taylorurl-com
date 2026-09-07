/**
 * The price, held once.
 *
 * The configurator's price step, the pricing page, and the care page all state
 * the same two figures and the same four things the monthly pays for, so all
 * three read them from here and a figure cannot move on one page and stay put
 * on the others. `PRICE_OFFERS` is the same pair as JSON-LD, for the pages that
 * publish the offer to search engines.
 *
 * Both figures are where a project starts rather than what every project
 * costs. Most land here; a larger build costs more, and the number is settled
 * before any work begins. Every surface states the floor, so a quote above it
 * is a conversation rather than a contradiction of the page.
 */
export const BUILD_PRICE = '$1,000'
export const MONTHLY_PRICE = '$250'

/**
 * The same two figures in cents, which is the only unit a card reader accepts.
 *
 * Kept beside the strings above rather than derived from them: a figure parsed
 * out of its own display text inherits every comma, currency sign and space
 * that text ever grows, and the failure is a charge for the wrong amount. They
 * are checked against each other instead, so the two cannot drift apart
 * without the suite refusing.
 */
export const BUILD_PRICE_CENTS = 100000
export const MONTHLY_PRICE_CENTS = 25000

/** The word that marks both figures as a floor wherever they are shown. */
export const PRICE_PREFIX = 'From'

export const PRICE_FIGURES = [
  {
    amount: BUILD_PRICE,
    prefix: PRICE_PREFIX,
    term: 'Up Front',
    note: 'The build, paid once, before the work begins.',
  },
  {
    amount: MONTHLY_PRICE,
    prefix: PRICE_PREFIX,
    term: 'A Month',
    note: 'Everything the site needs after that, for as long as it runs.',
  },
]

/** What the two figures are: a starting point, and what moves a project above it. */
export const PRICE_BASIS =
  'That is where a site starts, and it is what most of them cost. Booking, ordering, a shop, and the tools behind them are built as part of the site rather than billed on top of it. A bigger project costs more than a smaller one, and you see that number and agree to it before any work begins.'

export const MONTHLY_COVERS = [
  {
    title: 'Maintenance',
    body: 'Hosting, backups, updates, and security handled without being asked.',
  },
  {
    title: 'Changes Any Time',
    body: 'New photos, new prices, a new page. There is no fee for a change.',
  },
  {
    title: 'Realtime Error Monitoring',
    body: 'Every fault the site throws in a visitor’s browser reaches me as it happens.',
  },
  {
    title: 'Found on Google',
    body: 'Organic search work every month, aimed at what people near you actually type.',
  },
]

export const QUOTED_SEPARATELY =
  'Anything past that is quoted on its own, and you agree to the number before the work starts.'

/**
 * Schema.org wants the figure as a bare decimal, which is neither of the two
 * shapes above. It is divided out of the cents rather than typed a third time,
 * so a price change moves one pair of numbers and the markup follows.
 */
const asDecimal = cents => String(cents / 100)

export const PRICE_OFFERS = [
  {
    '@type': 'Offer',
    name: 'Website build',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    priceSpecification: {
      '@type': 'PriceSpecification',
      minPrice: asDecimal(BUILD_PRICE_CENTS),
      priceCurrency: 'USD',
    },
  },
  {
    '@type': 'Offer',
    name: 'Hosting, changes, monitoring, and SEO',
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      minPrice: asDecimal(MONTHLY_PRICE_CENTS),
      priceCurrency: 'USD',
      unitCode: 'MON',
    },
  },
]

/**
 * Everything the two figures buy, grouped the way somebody comparing quotes
 * reads it.
 *
 * A price is only a number until it is set against what it covers, and the
 * page's own emphasis is this list rather than the figures at the foot of it.
 * So it is held here beside the price it explains: a thing that stops being
 * included is a thing that comes out of one array, and the count and the
 * schedule both move with it.
 *
 * Names and nothing else. Each of these carried a sentence of its own until
 * thirty-six of them were set out together and the section became a page of
 * prose nobody was going to read - which is the opposite of what a list this
 * long is for. A reader comparing quotes is scanning for words they already
 * know, and the words are the whole of what they need; the sentence explaining
 * a thing they were only checking for the presence of is what buries it. The
 * line under each group heading carries the context, and the service pages
 * carry the detail.
 *
 * Six groups of six. The even count is not decoration - the schedule sets a
 * group out two and three columns wide, and a group that does not divide by
 * both ends on a short row.
 *
 * Every heading is the words the buyer already has. Somebody pricing a website
 * is holding two or three quotes that say web design, hosting, SEO and
 * maintenance, and a list that renames those things is a list they cannot lay
 * beside the others.
 */
export const INCLUDED_GROUPS = [
  {
    key: 'build',
    title: 'Web Design and Development',
    note: 'The website itself, designed for your business and then written in code.',
    items: [
      'Custom Web Design',
      'Website Copywriting',
      'Custom Code, Not WordPress',
      'Mobile Friendly',
      'Accessible (ADA and WCAG)',
      'Domain Setup and Launch',
    ],
  },
  {
    key: 'runs',
    title: 'Hosting, Security, and Backups',
    note: 'Everything that keeps the website online. You never touch a server.',
    items: [
      'Fast Website Hosting',
      'SSL Certificate (HTTPS)',
      'Daily Backups',
      '24/7 Uptime Monitoring',
      'Realtime Error Monitoring',
      'Speed Tested Every Day',
    ],
  },
  {
    key: 'monthly',
    title: 'Monthly Website Maintenance',
    note: 'What the monthly buys, whether you ask for one change or ten.',
    items: [
      'Website Updates Any Time',
      'Software and Security Updates',
      'Monthly SEO Work',
      'One Person to Call',
      'One Flat Monthly',
      'Website Analytics',
    ],
  },
  {
    key: 'tools',
    title: 'Booking, Ordering, and Online Tools',
    note: 'Built into the website rather than billed on top of it.',
    items: [
      'Online Booking and Scheduling',
      'Online Ordering and Payments',
      'Quote and Contact Forms',
      'Customer Logins and Accounts',
      'Connects to Your Software',
      'Back-Office Screens',
    ],
  },
  {
    key: 'found',
    title: 'SEO and Getting Found on Google',
    note: 'In place on launch day, then worked on every month after it.',
    items: [
      'Page Titles and Descriptions',
      'Google Rich Results',
      'Sitemap and Google Indexing',
      'Google Business Profile',
      'Local SEO for Your Towns',
      'Found by AI Search',
    ],
  },
  {
    key: 'yours',
    title: 'What You Own',
    note: 'Nothing here is held back to keep you.',
    items: [
      'Your Domain Name',
      'Your Words and Photos',
      'A Written Plan First',
      'No Contract to Sign',
      'Business Email Set Up',
      'Your Price, Agreed Up Front',
    ],
  },
]

/** How many things the two figures cover, counted rather than typed. */
export const INCLUDED_COUNT = INCLUDED_GROUPS.reduce(
  (total, group) => total + group.items.length,
  0
)

/**
 * What the same work is quoted at elsewhere.
 *
 * These are ranges rather than anybody's price list, and the page says so where
 * it draws them. They are the band a custom build with hosting, monitoring,
 * changes, and monthly search work behind it lands in when it is quoted by a
 * studio or an agency, and the monthly is the care plan that comes with it.
 *
 * Whole dollars, because the comparison is arithmetic - a term multiplied out
 * over a run of years - rather than a charge anybody takes. The two figures on
 * this side are the cents above divided down, so the studio's half of the
 * comparison cannot drift from the studio's own price.
 */
export const MARKET = {
  buildLow: 5000,
  buildHigh: 10000,
  monthlyLow: 150,
  monthlyHigh: 500,
  build: BUILD_PRICE_CENTS / 100,
  monthly: MONTHLY_PRICE_CENTS / 100,
  basis:
    'Those are the ranges a custom build with hosting, monitoring, changes, and monthly search work behind it gets quoted in. They are a band rather than anybody’s price list, and the two figures beside them are this studio’s own.',
}
