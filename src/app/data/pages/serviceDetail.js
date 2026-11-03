import { ALL_SERVICES, INCLUDED_SERVICES, SOFTWARE_SERVICES } from '@data/pages/services'
import { SERVICE_PAGES as TAYLORWEBSITE_PAGES } from '../taylorwebsite/serviceDetailTaylorwebsite.js'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

/**
 * What each service's own page says, keyed by the slug the service already
 * carries. The name, the summary, and the path stay in `@data/services`, so a
 * service renamed there is renamed on its page, in the menu, and in the sitemap
 * at the same time.
 *
 * - `title`    The page's headline. Left out, the page is headed by the
 *              service's name.
 * - `description` What a search result says under the title, inside the 155
 *              characters a result shows.
 * - `lede`     The sentence under the title on the page itself.
 * - `facts`    Three short label/value pairs beside the headline: how long,
 *              what it costs, what comes after. The full answers are
 *              `timeline` and `running`, which the page's questions carry.
 * - `covers`   What the work includes.
 * - `coversHeading` Optional title and lede for the covers section, for a
 *              service whose list is examples rather than a scope.
 * - `sections` Anything the page says beyond what it covers: what the work is
 *              for, when it earns its place. `as` says how it is drawn - a row
 *              of `cards`, numbered `steps`, or a `question` among the page's
 *              questions, asked as `question`.
 * - `timeline` How long it takes.
 * - `running`  What it takes to keep running, and how the figure is arrived at.
 * - `ask`      Optional wording for the two questions `timeline` and
 *              `running` answer, where the usual wording does not fit.
 * - `example`  Optional client site that shows the work, by the hostname the
 *              portfolio files it under, with one line on what it shows.
 * - `related`  The slugs of the three services the page points on to.
 * - `cta`      Optional title for the closing panel, in place of the site's
 *              own.
 *
 * Four pages carry none of this. Company email, the search work, the apps and
 * the booking page each make an argument the shared view has no shape for, so
 * each has a view of its own under `@views/services` and holds its words there
 * beside the layout they were written for. What every surface still reads from
 * here is the name, the summary and the path, so a card and a menu row never
 * have to know which pages are bespoke.
 */
const DETAIL = {
  'new-website': {
    title: 'Designed around your business, not a template.',
    description:
      'A custom website for a Baytown or Houston business: designed, written, built, and launched from scratch. I quote the job before work starts.',
    lede: 'Design, writing, build, domain, and launch all happen here, whether you have never had a site or you have a page somebody set up years ago and walked away from.',
    facts: [
      { label: 'How long', value: 'Two to four weeks' },
      { label: 'Price', value: 'One build fee, then a monthly' },
      { label: 'Before work starts', value: 'Both figures in writing' },
    ],
    covers: [
      {
        title: 'Design from scratch',
        body: 'Layout, type, and color drawn for your business. No theme underneath it, so nothing else is wearing the same one.',
      },
      {
        title: 'The writing',
        body: 'Page copy written from what you tell me on the first call, then edited until it sounds like you talking.',
      },
      {
        title: 'Every screen',
        body: 'Phones, tablets, and computers. Each one opened and checked by hand.',
      },
      {
        title: 'Domain and launch',
        body: 'The web address registered or moved across, mail left running, and the site put live.',
      },
      {
        title: 'Found from day one',
        body: 'Titles, descriptions, structured data, and a sitemap all in place on launch day, so Google can read the site the first time it looks.',
      },
      {
        title: 'Handed over working',
        body: 'Photos, hours, prices, and contact details all in, so the site is finished when it goes live.',
      },
    ],
    timeline:
      'Two to four weeks from the first call to launch day, in the six steps the process page sets out.',
    running:
      'One fee to build it, paid once before the work begins, then a monthly to host it, watch it, change it, and carry on the search work. What moves both is how big the whole project is, so you get the two figures in writing and agree to them before anything starts.',
    example: {
      host: 'dickinsonbayoufleeting.com',
      line: 'Two gated waterfront yards let by the month, with the rate and the phone number on every screen, because a phone on one bar out on a dock is what the site has to load on.',
    },
    related: ['redesign', 'online-tools', 'care'],
  },
  redesign: {
    title: 'Rebuilt from the frame up.',
    description:
      'Rebuilding a small business site that stopped bringing work in. New design, new pages, old addresses still working, two to four weeks start to finish.',
    lede: 'A site that has stopped bringing work in gets rebuilt from the frame up, and every address your current pages are found under keeps working.',
    facts: [
      { label: 'How long', value: 'Two to four weeks' },
      { label: 'Price', value: 'Priced the way a new build is' },
      { label: 'Old addresses', value: 'Kept working, with redirects' },
    ],
    covers: [
      {
        title: 'A read of what’s there',
        body: 'What the current site does well, where it loses people, and which pages are worth carrying over.',
      },
      {
        title: 'Rebuilt, not patched',
        body: 'New structure, new pages, new code. Nothing from the old build carries through underneath.',
      },
      {
        title: 'Addresses kept',
        body: 'Every page worth keeping redirects to its replacement, so old links and search results still land.',
      },
      {
        title: 'Content carried over',
        body: 'Text, photos, reviews, and anything else earning its place moves across.',
      },
      {
        title: 'Faster pages',
        body: 'Built to load quickly on a phone on mobile data, which is where most of your visitors are.',
      },
      {
        title: 'A clean switch',
        body: 'Domain, hosting, and mail records moved on a date you pick, with the old site up until the new one answers.',
      },
    ],
    timeline: 'Two to four weeks. A redesign takes about as long as a new site, because it is one.',
    running:
      'One fee to rebuild it, paid once before the work begins, then a monthly to run it. I price it the way I price a new build.',
    example: {
      host: 'faded-barbershop.com',
      line: 'Fades, beard shaping, and straight razor shaves on Main Street in Liberty. Friday is the walk-in day, which is the one thing most callers are ringing to find out.',
    },
    related: ['new-website', 'seo', 'care'],
  },
  care: {
    title: 'What the monthly pays for.',
    description:
      'Hosting, backups, security, changes any time, and realtime error monitoring. The monthly is what keeps the site online. No per-change fee.',
    lede: 'Hosting, backups, security, monitoring, and any change you want, for as long as the site runs.',
    facts: [
      { label: 'Starts', value: 'The day the build is paid for' },
      { label: 'Changes', value: 'Any time, with no per-change fee' },
      { label: 'Price', value: 'One monthly fee, the same for one change or ten' },
    ],
    covers: [
      {
        title: 'Hosting and backups',
        body: 'Hosting, daily backups, updates, and security handled without being asked.',
      },
      {
        title: 'Changes any time',
        body: 'New photos, new prices, a new page. There is no fee for a change and no ticket to file.',
      },
      {
        title: 'Realtime error monitoring',
        body: 'Every fault the site throws in a visitor’s browser reaches me as it happens.',
      },
      {
        title: 'Watched around the clock',
        body: 'Uptime checked continuously, and what it finds is published on the status page for anyone to read.',
      },
      {
        title: 'Found on Google',
        body: 'Organic search work every month the site is under care. It does not stop at launch day.',
      },
      {
        title: 'Text me directly',
        body: 'Changes go straight to my phone. No account manager, no support queue.',
      },
    ],
    timeline: 'Starts the day the build is paid for and runs for as long as the site is online.',
    running: 'One monthly fee, the same whether you ask for one change or ten.',
    ask: {
      timeline: 'When does it start?',
      running: 'What does it cost?',
    },
    related: ['seo', 'business-email', 'new-website'],
  },
  'ad-tracking': {
    title: 'The tracking installed before the first ad runs.',
    description:
      'Meta Pixel, Google Ads tag, Tag Manager, and GA4 installed on a Baytown business website and firing on real leads, set up before you spend on ads.',
    lede: 'The Meta Pixel, the Google Ads tag, and the analytics behind them, firing on the things that matter: a booked job, a form that reached your inbox, a call.',
    facts: [
      { label: 'Installed', value: 'While the site is built' },
      { label: 'On a site I build', value: 'Part of the price of the site' },
      { label: 'On a site somebody else built', value: 'Quoted on its own, in writing' },
    ],
    covers: [
      {
        title: 'Meta Pixel',
        body: 'Installed and firing on real events, a booking or a form sent, rather than on page loads alone.',
      },
      {
        title: 'Conversions API',
        body: 'The same events sent from the server as well as the browser, so a blocked browser does not lose them.',
      },
      {
        title: 'Google Ads tag',
        body: 'The tag in place with enhanced conversions switched on, so Google counts the lead and not the click.',
      },
      {
        title: 'Tag Manager and analytics',
        body: 'Google Tag Manager carrying the tags, and Google Analytics 4 reporting against the same events the ads count.',
      },
      {
        title: 'Where the lead came from',
        body: 'The campaign, the ad, and the click carried through the form, so every lead says what brought it in.',
      },
      {
        title: 'Written into the code',
        body: 'Events and audiences built into the site rather than pasted into a dashboard, where the next page change breaks them.',
      },
    ],
    sections: [
      {
        id: 'early',
        as: 'steps',
        title: 'Worth more in year two than it was at launch',
        items: [
          {
            title: 'Launch day',
            body: 'The pixel fires on the first visitor. The conversion events already have their names. Nothing is waiting on a second project or a second invoice.',
          },
          {
            title: 'Six months in',
            body: 'The retargeting audience holds six months of real visitors, and the ad platforms have a conversion history to read.',
          },
          {
            title: 'The day you advertise',
            body: 'There is nothing to install and nobody spends a month teaching the platforms what the site already knows. The first campaign runs against data the site has been collecting since it went live.',
          },
        ],
      },
      {
        id: 'platforms',
        as: 'question',
        question: 'Which accounts does it all run through?',
        lede: 'I open each one in the business’s name, set it up inside your own account, and leave it there.',
        items: [
          {
            title: 'Meta',
            body: 'Facebook and Instagram ads, through the Pixel and the Conversions API.',
          },
          {
            title: 'Google Ads',
            body: 'Search and display campaigns, with enhanced conversions sending.',
          },
          {
            title: 'Google Analytics 4',
            body: 'Every visit and every event, reported in the account opened in your name.',
          },
          {
            title: 'Google Tag Manager',
            body: 'A tag added next year needs no code change.',
          },
          {
            title: 'Google Ad Manager',
            body: 'Where the site carries advertising of its own.',
          },
          {
            title: 'Your own accounts',
            body: 'Nothing holds the site hostage to an account somebody else owns. Each platform bills its own charges.',
          },
        ],
      },
    ],
    timeline:
      'Installed while the site is built, and tested before launch by firing every event and reading it back on each platform. On a site that already exists it is a few days of work.',
    running:
      'On a site I build, the tracking is part of the price of the site. On a site somebody else built, I quote it on its own, and you get the figure in writing first. Each ad platform bills its own charges.',
    ask: { running: 'What does it cost?' },
    related: ['seo', 'online-tools', 'new-website'],
  },
  'desktop-apps': {
    title: 'Software that lives on the computer at the counter.',
    description:
      'Desktop software for Windows and Mac, built for Baytown businesses: the front desk, the back office, the workshop, wired to the website and quoted in writing.',
    lede: 'The program the front desk runs all day, built for Windows and Mac around how the work already runs, and wired to the same records as the website.',
    facts: [
      { label: 'Runs on', value: 'Windows and Mac' },
      { label: 'How long', value: 'Longer than a website, dated in writing' },
      { label: 'Price', value: 'One build fee, then a monthly' },
    ],
    covers: [
      {
        title: 'Windows and Mac',
        body: 'Built once and shipped for both, so the office machine and the laptop at home open the same program.',
      },
      {
        title: 'Drawn for the job',
        body: 'Screens laid out for the steps the work takes, in the order it takes them, with nothing on them the job does not need.',
      },
      {
        title: 'Works offline',
        body: 'Keeps working when the internet drops, and catches up on its own when it comes back.',
      },
      {
        title: 'Wired to the site',
        body: 'The app and the website read the same bookings, orders, and customers, so nothing is entered twice.',
      },
      {
        title: 'Talks to the hardware',
        body: 'Receipt printers, barcode scanners, label printers, and card readers, driven from the program rather than from a browser tab.',
      },
      {
        title: 'Updates itself',
        body: 'A new version arrives on its own, and nobody walks round the building installing it.',
      },
    ],
    sections: [
      {
        id: 'uses',
        as: 'cards',
        title: 'What a local business runs on a desktop',
        items: [
          {
            title: 'Point of sale',
            body: 'The ticket, the receipt, the drawer, and the day’s takings, on a screen that never asks anyone to sign in again.',
          },
          {
            title: 'The workshop screen',
            body: 'Today’s jobs, what is waiting on parts, and what is ready to go out, on the monitor in the bay.',
          },
          {
            title: 'The back office',
            body: 'Invoicing, stock, staff hours, and the reports somebody rebuilds in a spreadsheet every week.',
          },
          {
            title: 'A kiosk',
            body: 'Check-in, ordering, or sign-up on a screen customers use themselves, locked to that one job.',
          },
        ],
      },
      {
        id: 'fit',
        as: 'question',
        question: 'Do I need a desktop app, or is the site enough?',
        lede: 'Most of what a business does runs in a browser. Which one you need gets settled on the first call, before I quote anything.',
        items: [
          {
            title: 'The site is enough when',
            body: 'The work is done from different machines in different places, and nothing on it needs a printer or a scanner.',
          },
          {
            title: 'A desktop app earns its place when',
            body: 'One machine runs the same job all day, the internet cannot be trusted, or the program has to drive hardware on the desk.',
          },
        ],
      },
    ],
    timeline:
      'Longer than a website, because there is a program to build and a back end for it to talk to. You get the finish date in writing with the price.',
    running:
      'One fee to build it, paid once before the work begins, then a monthly to host the back end, publish updates, and keep it running on every machine. What moves the price is how much the program has to do.',
    related: ['mobile-apps', 'automation', 'ai-integration'],
  },
  automation: {
    title: 'The work you still do by hand, done by software.',
    description:
      'Business automation for Baytown companies and freelancers: reports, follow-ups, and copying between systems, built to run on their own and quoted in writing.',
    lede: 'Stock that counts itself down as sales come in. Every job application in one list, sorted by who can start Monday. The day’s numbers in your inbox at seven.',
    facts: [
      { label: 'How long', value: 'A week or two for one automation' },
      { label: 'Price', value: 'Quoted per project, in writing' },
      { label: 'After that', value: 'A monthly keeps it running' },
    ],
    covers: [
      {
        title: 'A read of the job',
        body: 'A walk through the work as it runs now: the spreadsheet, the email thread, and the steps nobody wrote down. What gets built comes from that.',
      },
      {
        title: 'Systems wired together',
        body: 'Two tools that hold the same information and never exchange it, connected so a record entered once shows up in both.',
      },
      {
        title: 'Run on a schedule',
        body: 'The report somebody rebuilds every Monday runs on its own instead. When it fails it says so, rather than stopping quietly.',
      },
      {
        title: 'Set off by an event',
        body: 'A form sent, a payment landing, a job marked done. Each one kicks off whatever used to happen by hand next.',
      },
      {
        title: 'In the tools you have',
        body: 'Built around Jobber, Housecall Pro, QuickBooks, Toast, Google Sheets, or whatever you already run, wherever they allow it.',
      },
      {
        title: 'Yours to keep',
        body: 'The code, the accounts, and the schedules in your name, so another engineer can pick it up after me.',
      },
    ],
    sections: [
      {
        id: 'uses',
        as: 'cards',
        title: 'What gets automated first',
        items: [
          {
            title: 'Follow-ups',
            body: 'The quote chased, the review asked for, the reminder sent the morning of the appointment, without anyone remembering to.',
          },
          {
            title: 'The weekly numbers',
            body: 'Sales, hours, and what is owed, pulled from where they live and put in front of you on a schedule.',
          },
          {
            title: 'Copying between systems',
            body: 'The order retyped into the accounts, the customer retyped into the mailing list. Each is entered once and the software copies it across.',
          },
          {
            title: 'Invoicing and chasing',
            body: 'The invoice sent when the job closes, and the reminder sent when it goes unpaid.',
          },
        ],
      },
      {
        id: 'who',
        as: 'question',
        question: 'Is it for a business with a crew, or one person doing all of it?',
        items: [
          {
            title: 'A business with staff',
            body: 'The jobs that eat an office manager’s week, taken off the desk so the people are on the work that pays.',
          },
          {
            title: 'A freelancer',
            body: 'The admin that runs into the evening: quotes, invoices, reminders, and the books. Built so the evenings are yours again.',
          },
        ],
      },
    ],
    timeline:
      'A single automation takes a week or two. A run of them across the business is scoped as one project, and you get the dates in writing before any work starts.',
    running:
      'I quote it per project, and you get the figure in writing before anything starts. What moves it is how many systems are involved and how much each has to do. After that a monthly keeps it running, watched, and fixed when a tool it talks to changes.',
    ask: { running: 'What does it cost?' },
    example: {
      host: 'smyrnatools.com',
      line: 'Every mixer, tractor, and trailer a concrete producer owns, the operators running them, and the plant figures they produce, behind one sign-in, with the weekly reports sent by role.',
    },
    related: ['ai-integration', 'desktop-apps', 'mobile-apps'],
  },
  'ai-integration': {
    title: 'AI built around how your business runs.',
    description:
      'AI integration for Baytown businesses. I set up AI to manage email, help with the daily work, and take repetitive jobs off your team.',
    lede: 'No two businesses use it the same way, so I do not sell it as a package. Tell me where your time goes and I will work out what AI can take off it.',
    facts: [
      { label: 'How long', value: 'A sorted inbox can run in a week or two' },
      { label: 'Price', value: 'Quoted per project, after a call' },
      { label: 'AI usage', value: 'Billed to an account in your name' },
    ],
    coversHeading: {
      title: 'A few places it can start',
      lede: 'These are examples. I work out with you what to build, because it depends on the business.',
    },
    covers: [
      {
        title: 'Email management',
        body: 'AI sorts the inbox as mail arrives, drafts or sends the routine replies, and puts the messages that need you at the top.',
      },
      {
        title: 'Help running the business',
        body: 'Scheduling, notes, reminders, and answers pulled from your own records, so less of the day goes on keeping track.',
      },
      {
        title: 'Automated systems',
        body: 'I map out the repetitive work and set it up to run on its own, so your team gets those hours back.',
      },
      {
        title: 'Customer questions',
        body: 'An assistant on the site that answers at two in the morning and hands the conversation to you when it needs a person.',
      },
      {
        title: 'Paperwork',
        body: 'Invoices, quotes, and forms read as they arrive, with what matters pulled out and filed where it goes.',
      },
      {
        title: 'Something else',
        body: 'If a job takes time and follows a pattern, AI can probably take some of it. Tell me about it.',
      },
    ],
    sections: [
      {
        id: 'how',
        as: 'steps',
        title: 'A conversation first, then a plan for your business',
        items: [
          {
            title: 'A call about the work',
            body: 'You walk me through where the hours go. You do not need to know what AI can do before we talk.',
          },
          {
            title: 'A plan in writing',
            body: 'I tell you what AI can take on, how I would build it, and what it costs, in writing.',
          },
          {
            title: 'Built into what you use',
            body: 'I build it into the inbox, the site, and the tools you already run, so there is no new app to learn.',
          },
        ],
      },
      {
        id: 'data',
        as: 'question',
        question: 'What is it allowed to read, and where does that go?',
        items: [
          {
            title: 'Your accounts',
            body: 'I open the AI accounts in the business’s name, so what it reads and what it costs are yours to see.',
          },
          {
            title: 'Not used for training',
            body: 'Customer records are read to do the job and not used to train anyone’s model. The provider settings that say so are set before it reads anything.',
          },
          {
            title: 'A log of every action',
            body: 'What it read, what it drafted, and what it sent, written down where you can look.',
          },
        ],
      },
    ],
    timeline:
      'It depends on what gets built. Something like a sorted inbox can be running in a week or two, and I scope larger systems as one project. Either way you get the dates in writing before any work starts.',
    running:
      'I quote each project on its own and give you the figure in writing after we talk, before anything starts. After that you pay a monthly and I keep it running, and the AI provider bills its usage to an account in your name.',
    ask: { running: 'What does it cost?' },
    related: ['automation', 'business-email', 'desktop-apps'],
    cta: 'Tell me what eats your week.',
  },
}

/** A service with, where the shared view renders it, its page. */
const attach = service => ({ ...service, ...DETAIL[service.slug] })

/**
 * Every service with its page content attached, for whichever site is
 * building.
 *
 * The studio's pages publish no offer node, because the studio quotes each
 * project rather than listing a figure a crawler could read back. The
 * subsidiary's pages each carry their own, because there the three are priced
 * separately and stated on the page.
 *
 * The studio's pages are built inside the branch rather than in a const above
 * it. A `const` holding a `.map()` call reads as possibly side-effecting, so the
 * bundler keeps it even where nothing references it, and `DETAIL` with it -
 * which is how the whole of the studio's service copy was still in the
 * subsidiary's chunk after the selection had already picked the other pages.
 */
export const SERVICE_PAGES = IS_SECOND_SITE ? TAYLORWEBSITE_PAGES : ALL_SERVICES.map(attach)

/** What comes with every site, as cards. */
export const INCLUDED_SERVICE_PAGES = IS_SECOND_SITE ? [] : INCLUDED_SERVICES.map(attach)

/** The software quoted as its own project, as cards. */
export const SOFTWARE_SERVICE_PAGES = IS_SECOND_SITE ? [] : SOFTWARE_SERVICES.map(attach)

/**
 * @param {string} slug - Last segment of a service page's path.
 * @returns {object|null} The service and its page content, or null for a slug
 *   no service carries.
 */
export function servicePage(slug) {
  return SERVICE_PAGES.find(page => page.slug === slug) || null
}

/**
 * The services a page points on to: the ones it names in `related`, in that
 * order, or every other service where it names none. Three at most.
 *
 * @param {string} slug - The current page's slug, which is never among them.
 * @param {string[]} [named] - The slugs the page picked.
 * @returns {object[]} Service pages, as cards linking to their own pages.
 */
export function relatedServices(slug, named) {
  const picked = named
    ? named.map(servicePage).filter(Boolean)
    : SERVICE_PAGES.filter(page => page.slug !== slug)
  return picked.filter(page => page.slug !== slug).slice(0, 3)
}
