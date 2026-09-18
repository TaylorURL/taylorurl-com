import { ALL_SERVICES, INCLUDED_SERVICES, SOFTWARE_SERVICES } from '@data/pages/services'
import { SERVICE_MARKS } from '@data/pages/serviceMarks'
import { SERVICE_PAGES as TAYLORWEBSITE_PAGES } from '../taylorwebsite/serviceDetailTaylorwebsite.js'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

/**
 * What each service's own page says, keyed by the slug the service already
 * carries. The name, the summary, and the path stay in `@data/services`, so a
 * service renamed there is renamed on its page, in the menu, and in the sitemap
 * at the same time.
 *
 * - `eyebrow`  The small label above the page title.
 * - `title`    The headline under it. Left out, the page is headed by the
 *              service's name.
 * - `description` What a search result says under the title, inside the 155
 *              characters a result shows.
 * - `lede`     The paragraph under the title on the page itself.
 * - `covers`   What the work includes.
 * - `coversHeading` Optional eyebrow, title and lede for the covers section,
 *              for a service whose list is examples rather than a scope.
 * - `sections` Anything the page says between what it covers and what it
 *              costs: what the work is for, when it earns its place. Each is a
 *              headed mesh of facts, and the page alternates its grounds.
 * - `timeline` How long it takes.
 * - `running`  What it takes to keep running, and how the figure is arrived at.
 * - `cta`      Optional heading, accent and description for the closing
 *              banner, in place of the site's own.
 * - `beside`   One page of this service's own, shown beside the process page
 *              every service page links. Optional, and only where a service
 *              has a neighbour a reader would otherwise confuse it with.
 *
 * Four pages carry none of this. Company email, the search work, the apps and
 * the booking page each make an argument the shared view has no shape for, so
 * each has a view of its own under `@views/services` and holds its words there
 * beside the layout they were written for. What every surface still reads from
 * here is the mark, the name, the summary and the path, so a card and a menu
 * row never have to know which pages are bespoke.
 */
const DETAIL = {
  'new-website': {
    eyebrow: 'New Builds',
    description:
      'A custom website for a Baytown or Houston business: designed, written, built, and launched by a small team. We quote the job before work starts.',
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
    timeline:
      'Two to four weeks from the first call to launch day, in the six steps the process page sets out.',
    running:
      'One fee to build it, paid once before the work begins, then a monthly to host it, watch it, change it, and carry on the search work. What moves both is how big the whole project is, so you get the two figures in writing and agree to them before anything starts.',
  },
  redesign: {
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
    timeline: 'Two to four weeks. A redesign takes about as long as a new site, because it is one.',
    running:
      'One fee to rebuild it, paid once before the work begins, then a monthly to run it. We price it the way we price a new build.',
  },
  care: {
    eyebrow: 'After Launch',
    description:
      'Hosting, backups, security, changes any time, and realtime error monitoring. The monthly is what keeps the site online. No per-change fee.',
    lede: 'What the monthly pays for. Hosting, backups, security, monitoring, and any change you want, for as long as the site runs.',
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
    timeline: 'Starts the day the build is paid for and runs for as long as the site is online.',
    running: 'One monthly fee, the same whether you ask for one change or ten.',
  },
  'ad-tracking': {
    eyebrow: 'Ad Tracking',
    title: 'The tracking installed before the first ad runs.',
    description:
      'Meta Pixel, Google Ads tag, Tag Manager, and GA4 installed on a Baytown business website and firing on real leads, set up before you spend on ads.',
    lede: 'The Meta Pixel, the Google Ads tag, and the analytics behind them, installed on the site and firing on the things that matter: a booked job, a form that reached your inbox, a call. Put in while the site is built, so the day you advertise there is nothing left to install.',
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
        title: 'Google Ads Tag',
        body: 'The tag in place with enhanced conversions switched on, so Google counts the lead and not the click.',
      },
      {
        title: 'Tag Manager and Analytics',
        body: 'Google Tag Manager carrying the tags, and Google Analytics 4 reporting against the same events the ads count.',
      },
      {
        title: 'Where the Lead Came From',
        body: 'The campaign, the ad, and the click carried through the form, so every lead says what brought it in.',
      },
      {
        title: 'Written Into the Code',
        body: 'Events and audiences built into the site rather than pasted into a dashboard, where the next page change breaks them.',
      },
    ],
    sections: [
      {
        id: 'early',
        eyebrow: 'Why It Goes In Early',
        title: 'Worth more in year two than it was at launch.',
        lede: 'None of it is worth much the day it is installed, and all of it is worth more every month it has been running.',
        items: [
          {
            title: 'Launch Day',
            body: 'The pixel fires on the first visitor. The conversion events already have their names. Nothing is waiting on a second project or a second invoice.',
          },
          {
            title: 'Six Months In',
            body: 'The retargeting audience holds six months of real visitors, and the ad platforms have a conversion history to read.',
          },
          {
            title: 'The Day You Advertise',
            body: 'There is nothing to install and nobody spends a month teaching the platforms what the site already knows. The first campaign runs against data the site has been collecting since it went live.',
          },
        ],
        columns: { base: 1, lg: 3 },
      },
      {
        id: 'platforms',
        eyebrow: 'What It Connects To',
        title: 'The accounts it all runs through.',
        lede: 'We open each one in the business’s name, set it up inside your own account, and leave it there.',
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
            title: 'Your Own Accounts',
            body: 'Nothing holds the site hostage to an account somebody else owns. Each platform bills its own charges.',
          },
        ],
        columns: { base: 1, sm: 2, lg: 3 },
      },
    ],
    timeline:
      'Installed while the site is built, and tested before launch by firing every event and reading it back on each platform. On a site that already exists it is a few days of work.',
    running:
      'On a site we build, the tracking is part of the price of the site. On a site somebody else built, we quote it on its own, and you get the figure in writing first. Each ad platform bills its own charges.',
  },
  'desktop-apps': {
    eyebrow: 'Desktop Apps',
    title: 'Software that lives on the computer at the counter.',
    description:
      'Desktop software for Windows and Mac, built for Baytown businesses: the front desk, the back office, the workshop, wired to the website and quoted in writing.',
    lede: 'The program the front desk runs all day, the screen in the workshop, the tool the office opens every morning. Built for Windows and Mac around how the work already runs, and wired to the same records as the website.',
    covers: [
      {
        title: 'Windows and Mac',
        body: 'Built once and shipped for both, so the office machine and the laptop at home open the same program.',
      },
      {
        title: 'Drawn for the Job',
        body: 'Screens laid out for the steps the work takes, in the order it takes them, with nothing on them the job does not need.',
      },
      {
        title: 'Works Offline',
        body: 'Keeps working when the internet drops, and catches up on its own when it comes back.',
      },
      {
        title: 'Wired to the Site',
        body: 'The app and the website read the same bookings, orders, and customers, so nothing is entered twice.',
      },
      {
        title: 'Talks to the Hardware',
        body: 'Receipt printers, barcode scanners, label printers, and card readers, driven from the program rather than from a browser tab.',
      },
      {
        title: 'Updates Itself',
        body: 'A new version arrives on its own, and nobody walks round the building installing it.',
      },
    ],
    sections: [
      {
        id: 'uses',
        eyebrow: 'What It Is For',
        title: 'What a local business runs on a desktop.',
        lede: 'Four jobs a program on the machine does better than a page in a browser.',
        items: [
          {
            title: 'Point of Sale',
            body: 'The ticket, the receipt, the drawer, and the day’s takings, on a screen that never asks anyone to sign in again.',
          },
          {
            title: 'The Workshop Screen',
            body: 'Today’s jobs, what is waiting on parts, and what is ready to go out, on the monitor in the bay.',
          },
          {
            title: 'The Back Office',
            body: 'Invoicing, stock, staff hours, and the reports somebody rebuilds in a spreadsheet every week.',
          },
          {
            title: 'A Kiosk',
            body: 'Check-in, ordering, or sign-up on a screen customers use themselves, locked to that one job.',
          },
        ],
        columns: { base: 1, sm: 2, lg: 4 },
      },
      {
        id: 'fit',
        eyebrow: 'Browser or Desktop',
        title: 'When you need one, and when the site is enough.',
        lede: 'Most of what a business does runs in a browser. We settle which you need on the first call, before we quote anything.',
        items: [
          {
            title: 'The Site Is Enough When',
            body: 'The work is done from different machines in different places, and nothing on it needs a printer or a scanner.',
          },
          {
            title: 'A Desktop App Earns Its Place When',
            body: 'One machine runs the same job all day, the internet cannot be trusted, or the program has to drive hardware on the desk.',
          },
        ],
        columns: { base: 1, sm: 2 },
      },
    ],
    timeline:
      'Longer than a website, because there is a program to build and a back end for it to talk to. You get the finish date in writing with the price.',
    running:
      'One fee to build it, paid once before the work begins, then a monthly to host the back end, publish updates, and keep it running on every machine. What moves the price is how much the program has to do.',
  },
  automation: {
    eyebrow: 'Automation',
    title: 'The work you still do by hand, done by software.',
    description:
      'Business automation for Baytown companies and freelancers: reports, follow-ups, and copying between systems, built to run on their own and quoted in writing.',
    lede: 'Stock that counts itself down as sales come in. Every job application in one list, sorted by who can start Monday. The day’s numbers pulled from the software you already use, checked, and in your inbox at seven. Whatever you still do by hand, it gets built to run on its own.',
    covers: [
      {
        title: 'A Read of the Job',
        body: 'A walk through the work as it runs now: the spreadsheet, the email thread, and the steps nobody wrote down. What gets built comes from that.',
      },
      {
        title: 'Systems Wired Together',
        body: 'Two tools that hold the same information and never exchange it, connected so a record entered once shows up in both.',
      },
      {
        title: 'Run on a Schedule',
        body: 'The report somebody rebuilds every Monday runs on its own instead. When it fails it says so, rather than stopping quietly.',
      },
      {
        title: 'Set Off by an Event',
        body: 'A form sent, a payment landing, a job marked done. Each one kicks off whatever used to happen by hand next.',
      },
      {
        title: 'In the Tools You Have',
        body: 'Built around Jobber, Housecall Pro, QuickBooks, Toast, Google Sheets, or whatever you already run, wherever they allow it.',
      },
      {
        title: 'Yours to Keep',
        body: 'The code, the accounts, and the schedules in your name, so another engineer can pick it up after us.',
      },
    ],
    sections: [
      {
        id: 'uses',
        eyebrow: 'What It Is For',
        title: 'What gets automated first.',
        lede: 'Four jobs that come up in nearly every business, and a freelancer has all four with nobody to hand them to.',
        items: [
          {
            title: 'Follow-Ups',
            body: 'The quote chased, the review asked for, the reminder sent the morning of the appointment, without anyone remembering to.',
          },
          {
            title: 'The Weekly Numbers',
            body: 'Sales, hours, and what is owed, pulled from where they live and put in front of you on a schedule.',
          },
          {
            title: 'Copying Between Systems',
            body: 'The order retyped into the accounts, the customer retyped into the mailing list. Each is entered once and the software copies it across.',
          },
          {
            title: 'Invoicing and Chasing',
            body: 'The invoice sent when the job closes, and the reminder sent when it goes unpaid.',
          },
        ],
        columns: { base: 1, sm: 2, lg: 4 },
      },
      {
        id: 'who',
        eyebrow: 'Who It Is For',
        title: 'A business with a crew, or one person doing all of it.',
        items: [
          {
            title: 'A Business With Staff',
            body: 'The jobs that eat an office manager’s week, taken off the desk so the people are on the work that pays.',
          },
          {
            title: 'A Freelancer',
            body: 'The admin that runs into the evening: quotes, invoices, reminders, and the books. Built so the evenings are yours again.',
          },
        ],
        columns: { base: 1, sm: 2 },
      },
    ],
    timeline:
      'A single automation takes a week or two. A run of them across the business is scoped as one project, and you get the dates in writing before any work starts.',
    running:
      'We quote it per project, and you get the figure in writing before anything starts. What moves it is how many systems are involved and how much each has to do. After that a monthly keeps it running, watched, and fixed when a tool it talks to changes.',
  },
  'ai-integration': {
    eyebrow: 'AI Integration',
    title: 'AI built around how your business runs.',
    description:
      'AI integration for Baytown businesses, shaped to each one: email that manages itself, a hand with the daily work, and systems that cut the workload.',
    lede: 'No two businesses use it the same way, so it is not sold as a package. For one it is an inbox that sorts and answers itself. For another it is an assistant that keeps the day on track, or automated systems that take hours of work off the team every week. Tell us where your time goes and we will work out what AI can take off it.',
    coversHeading: {
      eyebrow: 'What It Can Do',
      title: 'A few places it can start.',
      lede: 'Examples, not a menu. What gets built for you depends on the business, and we work that out together.',
    },
    covers: [
      {
        title: 'Email Management',
        body: 'The inbox sorted as mail arrives, routine replies drafted or sent, and the messages that need you put at the top.',
      },
      {
        title: 'Help Running the Business',
        body: 'Scheduling, notes, reminders, and answers pulled from your own records, so less of the day goes on keeping track.',
      },
      {
        title: 'Automated Systems',
        body: 'The repetitive work mapped out and set up to run on its own, so your team gets those hours back.',
      },
      {
        title: 'Customer Questions',
        body: 'An assistant on the site that answers at two in the morning and hands the conversation to you when it needs a person.',
      },
      {
        title: 'Paperwork',
        body: 'Invoices, quotes, and forms read as they arrive, with what matters pulled out and filed where it goes.',
      },
      {
        title: 'Something Else',
        body: 'If a job takes time and follows a pattern, AI can probably take some of it. Tell us about it.',
      },
    ],
    sections: [
      {
        id: 'how',
        eyebrow: 'How It Starts',
        title: 'A conversation first, then a plan for your business.',
        items: [
          {
            title: 'A Call About the Work',
            body: 'You walk us through where the hours go. You do not need to know what AI can do before we talk.',
          },
          {
            title: 'A Plan in Writing',
            body: 'We tell you what AI can take on, how we would build it, and what it costs, in writing.',
          },
          {
            title: 'Built Into What You Use',
            body: 'It goes into the inbox, the site, and the tools you already run, rather than another app to learn.',
          },
        ],
        columns: { base: 1, sm: 3 },
      },
      {
        id: 'data',
        eyebrow: 'Your Data',
        title: 'What it is allowed to read, and where that goes.',
        items: [
          {
            title: 'Your Accounts',
            body: 'We open the AI accounts in the business’s name, so what it reads and what it costs are yours to see.',
          },
          {
            title: 'Not Used for Training',
            body: 'Customer records are read to do the job and not used to train anyone’s model. The provider settings that say so are set before it reads anything.',
          },
          {
            title: 'A Log of Every Action',
            body: 'What it read, what it drafted, and what it sent, written down where you can look.',
          },
        ],
        columns: { base: 1, sm: 3 },
      },
    ],
    timeline:
      'It depends on what gets built. Something like a sorted inbox can be running in a week or two, and larger systems are scoped as one project. Either way you get the dates in writing before any work starts.',
    running:
      'Each project is quoted on its own, because no two are the same. You get the figure in writing after we talk, before anything starts. After that a monthly keeps it running, and the AI provider bills its usage to an account in your name.',
    cta: {
      heading: 'Tell us what',
      accentText: 'eats your week.',
      description:
        'Say what the business does and which work takes the most time. We read every message and answer it ourselves, usually within the hour, and set up a call to work out what AI can take on.',
    },
  },
}

/** A service with its mark and, where the shared view renders it, its page. */
const attach = service => ({
  ...service,
  mark: SERVICE_MARKS[service.slug],
  ...DETAIL[service.slug],
})

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
 * @param {string} [slug] - A service to leave out, normally the current page.
 * @returns {object[]} Every other service, as cards linking to their own pages.
 */
export function otherServices(slug) {
  return SERVICE_PAGES.filter(page => page.slug !== slug)
}
