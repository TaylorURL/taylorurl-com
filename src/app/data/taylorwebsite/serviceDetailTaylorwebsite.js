/**
 * What each of taylor.website's three service pages says, in the shape
 * `@data/serviceDetail` sets out for the studio's.
 *
 * Split from the lines beside it because the lines are read by the build's
 * route table under plain node, and this is page copy nothing there needs. Same
 * division as `@data/services` and `@data/serviceDetail`.
 */
import { SERVICE_LINES } from './servicesTaylorwebsite.js'

/**
 * The two figures this site quotes, held once each.
 *
 * The copy below reads them and so does the offer node beside it, so a price
 * cannot move on the page and stay put in the markup a search engine reads.
 * Software engineering carries neither, because it is priced per project: an
 * offer node with a figure in it would be publishing a price nobody was quoted.
 */
const TRACKING_FEE = '$1,200'
const OUTBOUND_MONTHLY = '$1,500'

/** Schema.org wants a bare decimal, which is neither of the shapes above. */
const asDecimal = price => price.replace(/[^0-9.]/g, '')

const DETAIL = {
  'software-engineering': {
    title: 'Software built to order.',
    description:
      'Custom applications, integrations, automations, and internal tools, built to order. Priced per project and quoted in writing after a call.',
    lede: 'A job that runs on spreadsheets and email, two systems that never pass anything between them, or work somebody redoes by hand every week. The software that does it instead gets built here.',
    facts: [
      {
        label: 'How long',
        value: 'A week or two for an integration, six to twelve weeks for an application',
      },
      { label: 'Price', value: 'Per project, in writing after the first call' },
      { label: 'Monthly', value: 'None. The project ends when it is done' },
    ],
    covers: [
      {
        title: 'The first read',
        body: 'A call, then a walk through the job as it runs now: the spreadsheet, the email thread, and the steps nobody wrote down. What gets built comes from that.',
      },
      {
        title: 'Built around the job',
        body: 'The screens follow the steps the work already takes, in the order it takes them. Everything the job needs is in it and nothing else is.',
      },
      {
        title: 'Systems wired together',
        body: 'Two tools that hold the same information and never exchange it, connected through their APIs. A record entered once shows up in both without anybody retyping it.',
      },
      {
        title: 'Run on a schedule',
        body: 'The report somebody rebuilds every Monday runs on a schedule instead. When it fails it says so, rather than stopping quietly.',
      },
      {
        title: 'Screens for your staff',
        body: 'A screen with the records they need, the buttons they press, and none of the rest. Access is set per person, so each one sees their own work.',
      },
      {
        title: 'Yours to keep',
        body: 'React, Node, Postgres, and functions on Vercel and Supabase. The repository and the accounts are in your name, so another engineer can pick it up after me.',
      },
    ],
    timeline:
      'A small integration or automation takes a week or two, and a full application six to twelve weeks. The date is agreed in writing before any work starts.',
    running:
      'Priced per project, because no two are the same. You get the number in writing after the first call and agree to it before anything starts. There is nothing monthly behind it: the project ends when it is done.',
  },
  'tracking-repair': {
    title: 'Tracking that reports the leads that came in.',
    description: `Fixing conversion tracking that reports the wrong thing, so the leads your ad platform counts are the ones that came in. Flat fee from ${TRACKING_FEE}.`,
    lede: 'You spend money on ads every month, and the conversions the platform reports do not match the work that came in. The tracking gets fixed, and you get a written account of what was wrong with it.',
    facts: [
      { label: 'How long', value: 'A week or two' },
      { label: 'Price', value: `From ${TRACKING_FEE}, paid once` },
      { label: 'Monthly', value: 'None' },
    ],
    covers: [
      {
        title: 'Conversions moved to leads',
        body: 'A conversion stops firing when a page loads and starts firing on a booked job or a form that reached your inbox.',
      },
      {
        title: 'Enhanced conversions',
        body: 'Switched on and sending back the hashed contact details the platform needs to match a conversion to the click that caused it.',
      },
      {
        title: 'Closed jobs sent back',
        body: 'The leads that turned into paid work go back to the ad platform, so it can tell which clicks were worth buying.',
      },
      {
        title: 'Tags that survive redirects',
        body: 'UTM tags carried through every redirect, so the source is still attached by the time somebody fills the form in.',
      },
      {
        title: 'Booking on another domain',
        body: 'Scheduling and booking tools sit on a domain of their own, and the trail breaks at the handoff. It gets carried across, so a booked job stops reading as direct traffic.',
      },
      {
        title: 'A written account',
        body: 'What was broken, what it was reporting instead, and what changed. It comes with the fix, not in place of it.',
      },
    ],
    offers: [
      {
        '@type': 'Offer',
        name: 'Conversion tracking repair',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        priceSpecification: {
          '@type': 'PriceSpecification',
          minPrice: asDecimal(TRACKING_FEE),
          priceCurrency: 'USD',
        },
      },
    ],
    timeline: 'A week or two, depending on how many places the trail is broken.',
    running: `From ${TRACKING_FEE}, paid once before the work begins. What moves the price is how much of the tracking has to be rebuilt, and you agree to that number before anything starts. There is no monthly attached to it.`,
  },
  outbound: {
    title: 'Cold email from a domain of your own.',
    description: `Cold email sent from a domain registered for you: the list, the writing, the warming, and the replies. From ${OUTBOUND_MONTHLY} a month, with setup billed once.`,
    lede: 'Nobody at your company is sending cold email, or somebody tried it from your main domain and now your ordinary mail lands in spam. The list, the writing, the sending, and the replies all happen from a domain registered for you.',
    facts: [
      { label: 'Ready to send', value: 'Two to three weeks, then a few weeks of warming' },
      { label: 'Price', value: `From ${OUTBOUND_MONTHLY} a month, setup billed once` },
      { label: 'Term', value: 'Month to month, none to sign' },
    ],
    covers: [
      {
        title: 'The list',
        body: 'The companies worth writing to, found and checked one at a time against what you sell. Nothing is bought from a list broker.',
      },
      {
        title: 'Your own sending domain',
        body: 'Messages go out from a domain registered for you and nobody else, with SPF, DKIM, and DMARC set and tested before the first send. Nothing goes out through a pool shared with other senders.',
      },
      {
        title: 'Signed before sending',
        body: 'Before the first message goes out, you and I sign an agreement covering consent and CAN-SPAM. Every send carries a real postal address and a working way to opt out.',
      },
      {
        title: 'The writing',
        body: 'Every message and every follow-up written for the companies it goes to, in the words you use rather than the industry’s. Rewritten as the replies come in.',
      },
      {
        title: 'Warmed up first',
        body: 'A new domain sends a handful of messages a day at first and climbs from there over several weeks. Skipping that is how mail ends up in spam.',
      },
      {
        title: 'Replies handled',
        body: 'Replies are read and answered, follow-ups go out on schedule, and the ones that go quiet get picked up again. Anyone who wants to talk is handed to you with the whole thread attached.',
      },
    ],
    offers: [
      {
        '@type': 'Offer',
        name: 'Outbound email, run month to month',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          minPrice: asDecimal(OUTBOUND_MONTHLY),
          priceCurrency: 'USD',
          unitCode: 'MON',
        },
      },
    ],
    timeline:
      'Two to three weeks to register the domains, set the mail records, and write the sequence, then a few more weeks of warming at low volume before it sends at full rate.',
    running: `From ${OUTBOUND_MONTHLY} a month, billed month to month with no term to sign. The domains, the mailboxes, and the sending tools are set up once and billed once on top of the first month, and you agree to both figures before anything starts.`,
  },
}

export const SERVICE_PAGES = SERVICE_LINES.map(line => ({ ...line, ...DETAIL[line.slug] }))
