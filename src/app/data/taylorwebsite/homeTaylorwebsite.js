/**
 * What taylor.website's home page says.
 *
 * The studio's home page is a proof wall: a client's site as it draws on a
 * phone, a PageSpeed score taken off Google's own report, the board that
 * watches those sites after they launch, and the reviews the owners left. This
 * site has none of those, and it must not borrow them - a second domain
 * publishing the first one's client work and the first one's ratings is
 * claiming a record nobody built under that name.
 *
 * So what stands in their place is the offer stated exactly. Each of the three
 * lines carries its price and how long it takes, which is a harder thing to
 * publish than a testimonial and the only proof a site with no history has to
 * give. Every figure here is the one its own service page states; nothing is a
 * number written for this page.
 *
 * `terms` is keyed by the slug `./servicesTaylorwebsite.js` already carries, so
 * the name and the one-line summary a card shows are the ones the menu and
 * llms.txt show, and a line renamed there is renamed here.
 */
import { Clock, FileWarning, ReceiptText } from 'lucide-react'
import { SERVICE_LINES } from './servicesTaylorwebsite.js'

/**
 * What each line costs and how long it runs.
 *
 * The two rows are the same two questions for every line, so the cards read as
 * one schedule rather than as three write-ups, and a reader comparing them is
 * comparing like with like.
 */
const TERMS = {
  'software-engineering': {
    blurb:
      'Applications, integrations, automations, and internal tools. The screens follow the steps the work already takes, and the repository is in your name from the first commit.',
    price: 'Per project, quoted in writing after the first call',
    timeline: 'A week or two for an integration, six to twelve weeks for a full application',
  },
  'tracking-repair': {
    blurb:
      'A conversion stops firing on a page load and starts firing on a booked job. Hashed contact details go back to the ad platform, so a conversion matches the click that caused it.',
    price: 'From $1,200, paid once before the work begins',
    timeline: 'A week or two, depending on how many places the trail is broken',
  },
  outbound: {
    blurb:
      'A sending domain registered in your name, with SPF, DKIM, and DMARC set and tested, then warmed over several weeks. Lists are researched one company at a time and nothing is bought from a broker.',
    price: 'From $1,500 a month, month to month, with setup billed once',
    timeline: 'Two to three weeks to set up, then a few more weeks of warming at low volume',
  },
}

export const HOME = {
  hero: {
    eyebrow: 'TaylorURL LLC · Companies anywhere',
    headline: ['Software built.', 'Tracking fixed.'],
    headlineAccent: 'Outbound run.',
    lede: 'The same small team does all three. A scope and a price in writing before any work starts, and a written account of what was done at the end.',
  },

  lines: {
    heading: 'Three services, priced before you commit.',
    tail: 'Each one names what it covers and how long it takes.',
    cta: 'See What It Covers',
    rows: [
      { label: 'Price', key: 'price' },
      { label: 'Timeline', key: 'timeline' },
    ],
    cards: SERVICE_LINES.map(line => ({ ...line, ...TERMS[line.slug] })),
  },

  how: {
    eyebrow: 'Process',
    headingLine: 'From first message',
    accentText: 'to handover.',
    lede: 'A small team from the first message to the handover, and a price agreed in writing before any work starts.',
  },

  steps: [
    {
      step: '1',
      stage: 'You Start',
      title: 'Tell us what the work is',
      description:
        'Send the form and say what you need built or fixed and what it has to do when it is done. A few sentences is plenty. You usually get a reply within the hour.',
    },
    {
      step: '2',
      stage: 'We Scope It',
      title: 'A price and a date in writing',
      description:
        'A call, then a read of how the job runs now. What gets built, how long it takes, what it costs, and what is not included, all before anything is charged.',
    },
    {
      step: '3',
      stage: 'We Build',
      title: 'The work, then the handover',
      description:
        'You see where it stands as it goes rather than in a status email. At the end the repositories and the accounts are in your name, with a written account of what was done.',
    },
  ],

  cta: {
    eyebrow: 'Let’s Talk',
    heading: 'Get a scope and a price',
    accentText: 'before you commit',
    description:
      'Say what the work is and what it has to do when it is done. You usually get a reply within the hour, and it costs nothing to find out whether it is a fit.',
    replies: [
      { Icon: Clock, label: 'Usually a reply within the hour' },
      { Icon: ReceiptText, label: 'A scope and a price before any work starts' },
      { Icon: FileWarning, label: 'What is not included, named up front' },
    ],
  },
}
