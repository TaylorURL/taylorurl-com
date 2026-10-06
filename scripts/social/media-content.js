/**
 * What the social media library says, item by item.
 *
 * Every figure and every claim here is lifted from the site's own published
 * data: the articles under `src/app/data/blog/`, the trade and town copy under
 * `src/app/data/towns-and-trades/`, the stored PageSpeed readings in
 * `src/app/data/portfolio.js`, and the FAQ and process pages that read from
 * them. Where a card can be built straight off a data file (a trade, a town, an
 * article cover) it is, so the card moves when the page does. Where the copy is
 * written here, the line it came from is named beside it.
 *
 * Nothing here names a client. `portfolio.js` is read for what was built and
 * what it measured, never who it was for, and `render-media.js` refuses to
 * write any image whose pixels carry a client's name, a shortened name or a
 * host, so a slip here stops the run rather than reaching a feed.
 *
 * `*word*` sets that word in the accent blue.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  PORTFOLIO_PROJECTS,
  PORTFOLIO_AVERAGES,
  formatMeasuredDate,
} from '../../src/app/data/portfolio.js'
import { AREAS } from '../../src/app/data/towns-and-trades/areas.js'
import { INDUSTRY_DETAIL } from '../../src/app/data/towns-and-trades/industryDetail.js'
import { BLOG_POSTS } from '../../src/app/data/blog/index.js'
import { PROCESS_TIMELINE } from '../../src/app/data/pages/home.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * The trade list, read without the icons it imports.
 *
 * `trades.js` pulls its card icons from `lucide-react` and the tool marks from a
 * component, neither of which loads in plain Node. The list itself is data, so
 * the import lines come off and each name they bound is declared empty.
 */
async function loadTrades() {
  let source = readFileSync(join(ROOT, 'src/app/data/towns-and-trades/trades.js'), 'utf8')
  const bound = []
  source = source.replace(/^import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]\s*;?/gm, (_, list) => {
    bound.push(
      ...list
        .split(',')
        .map(name => name.trim())
        .filter(Boolean)
    )
    return ''
  })
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(`${bound.map(name => `const ${name} = null;`).join('\n')}\n${source}`).toString('base64')}`
  )
  return module.TRADES
}

const ALL = ['facebook', 'instagram', 'googlebusiness']
const FEED = ['facebook', 'instagram']

const post = slug => {
  const found = BLOG_POSTS.find(entry => entry.slug === slug)
  if (!found) throw new Error(`media-content: no article "${slug}"`)
  return found
}
const project = slug => {
  const found = PORTFOLIO_PROJECTS.find(entry => entry.slug === slug)
  if (!found) throw new Error(`media-content: no portfolio entry "${slug}"`)
  return found
}
const month = iso => formatMeasuredDate(iso).replace(/ \d+,/, '')

// ---------------------------------------------------------------------------
// number
// ---------------------------------------------------------------------------

const NUMBERS = [
  {
    key: 'number-53-percent',
    to: '/blog/why-fast-websites-make-more-money',
    figure: '53%',
    label: 'of mobile visitors leave a page that takes more than *three seconds* to load.',
    cost: 'A site that loads in five seconds has lost half its visitors before they read a word.',
    source: 'Google research, cited in our article on why fast websites make more money.',
  },
  {
    key: 'number-2-5-seconds',
    to: '/blog/how-fast-should-my-website-load',
    figure: '2.5s',
    label: 'is how long Google gives your main content to appear on *the screen*.',
    cost: 'Google counts it when it ranks your page.',
    source: 'Google’s published target, from our article on how fast a site should load.',
  },
  {
    key: 'number-200-ms',
    to: '/blog/how-fast-should-my-website-load',
    figure: '200ms',
    label: 'is how quickly a page should answer *a tap*.',
    cost: 'Google grades every page on it, and counts it when it ranks your page.',
    source: 'Google’s published target, from our article on how fast a site should load.',
  },
  {
    key: 'number-one-tenth',
    to: '/blog/why-your-site-is-fast-on-your-laptop-and-slow-on-a-phone',
    figure: '1/10',
    label: 'of a laptop’s processor is what your customer’s *phone* has to work with.',
    cost: 'The page that snaps open on your desk can sit blank on her phone, and she backs out without calling.',
    source: 'From our article on why a site is fast on a laptop and slow on a phone.',
  },
  {
    key: 'number-42-percent',
    to: '/blog/google-business-profile-the-most-important-free-tool',
    figure: '42%',
    label: 'more requests for directions go to businesses with *photos* on their Google profile.',
    cost: 'A profile with no photos of your shop is sending those drives somewhere else.',
    source: 'Google’s own data, cited in our article on the Google Business Profile.',
  },
  {
    key: 'number-one-in-four',
    to: '/blog/accessibility-the-website-requirement-youre-ignoring',
    figure: '1 in 4',
    label: 'adults in the US has some kind of *disability*.',
    cost: 'Low contrast, missing alt text and unlabeled forms shut them out, and the same fixes help you rank.',
    source: 'From our article on accessibility, the requirement small business sites miss.',
  },
  {
    key: 'number-60-percent',
    to: '/blog/what-google-actually-cares-about-in-2026',
    figure: '60%+',
    label: 'of searches happen on a phone, and for local businesses the share is *higher*.',
    cost: 'Google indexes the phone version of your site first, so that is the version it grades.',
    source: 'From our article on what Google cares about in 2026.',
  },
  {
    key: 'number-20-minutes',
    to: '/blog/google-business-profile-the-most-important-free-tool',
    figure: '20 min',
    label: 'is about how long it takes to set up a Google Business *Profile*.',
    cost: 'A competitor who spent those twenty minutes is sitting above you in local search for that reason alone.',
    source: 'From our articles on the Google Business Profile and on local SEO.',
  },
  {
    key: 'number-90-plus',
    to: '/speed-check',
    figure: '90+',
    label: 'is the mobile PageSpeed score to aim for. Run the test on *your* site.',
    cost: 'Wix, Squarespace and plugin-heavy WordPress sites tend to land between 30 and 60, which is normal for them and still slow.',
    source: 'From our article on how fast a site should load.',
  },
]

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

const CHECKS = [
  {
    key: 'check-off-wifi',
    to: '/blog/what-mobile-first-actually-means',
    headline: 'Open your site on your phone, *off* wifi.',
    steps: [
      'Can you read it without pinching?',
      'Can you hit every button with a thumb?',
      'Does the keyboard hide the submit button on the form?',
      'Does it appear in under three seconds?',
    ],
  },
  {
    key: 'check-incognito',
    to: '/blog/why-your-site-is-fast-on-your-laptop-and-slow-on-a-phone',
    headline: 'See your site the way a *stranger* does.',
    steps: [
      'Open Chrome on your phone.',
      'Tap the three-dot menu and choose New Incognito Tab.',
      'Type your domain in. That skips the cache.',
      'Do it once on wifi and once with wifi off.',
    ],
  },
  {
    key: 'check-pagespeed',
    to: '/blog/how-fast-should-my-website-load',
    headline: 'Get Google’s *own* grade for your site.',
    steps: [
      'Go to pagespeed.web.dev.',
      'Put your address in.',
      'Read the mobile column, not the desktop one.',
      'Aim for 90 or better.',
    ],
  },
  {
    key: 'check-contact-form',
    to: '/blog/why-nobodys-filling-out-your-contact-form',
    headline: 'Fill in your own *contact form* on cell data.',
    steps: [
      'Are the fields big enough to tap?',
      'Does the keyboard cover the submit button?',
      'Does it all fit without scrolling sideways?',
      'Did the message land somewhere you actually look?',
    ],
  },
  {
    key: 'check-phone-number',
    to: '/blog/small-business-website-mistakes',
    headline: 'Find your own phone number in *one* look.',
    steps: [
      'Open your homepage on your phone.',
      'Is the number there without scrolling?',
      'Tap it. Does it dial?',
      'Open another page. Is it there too?',
    ],
  },
  {
    key: 'check-developer-sites',
    to: '/blog/how-to-pick-a-web-developer-without-getting-burned',
    headline: 'Check a developer’s work *before* you sign.',
    steps: [
      'Open the live sites they built, on your phone.',
      'Are they fast?',
      'Can you find the phone number?',
      'Now open the developer’s own site.',
    ],
  },
  {
    key: 'check-google-profile',
    to: '/blog/google-business-profile-the-most-important-free-tool',
    headline: 'Search your own business on *Google*.',
    steps: [
      'Is the profile there, and is it claimed?',
      'Are the hours and the phone number right?',
      'Are the photos of your own shop and crew?',
      'Has anything been posted in the last six months?',
    ],
  },
]

// ---------------------------------------------------------------------------
// disagreement
// ---------------------------------------------------------------------------

const DISAGREEMENTS = [
  {
    key: 'disagree-brochure',
    to: '/blog/your-website-isnt-a-brochure',
    belief: 'A website is a brochure.',
    headline: 'A brochure does not bring in *leads*. A site built to work does.',
    why: 'It greets people, answers their questions and asks for the next step, around the clock, without calling in sick.',
  },
  {
    key: 'disagree-facebook-page',
    to: '/blog/does-my-business-need-a-website',
    belief: 'A Facebook page is enough.',
    headline: 'Facebook changes its algorithm and *nobody* sees your posts.',
    why: 'Every platform you are on belongs to somebody else. A website is the one place online where the rules are yours.',
    dark: true,
  },
  {
    key: 'disagree-long-forms',
    to: '/blog/why-nobodys-filling-out-your-contact-form',
    belief: 'Long forms scare people off.',
    headline: 'The longest form we have built is the one people *finish*.',
    why: 'It gets finished more often than most four-field contact boxes. Friction empties a form, and most of the friction is on a phone.',
  },
  {
    key: 'disagree-laptop',
    to: '/blog/why-your-site-is-fast-on-your-laptop-and-slow-on-a-phone',
    belief: 'It loads fine on the office laptop.',
    headline: 'Your customer is not on the office *laptop*.',
    why: 'Her phone has a tenth of the processor, none of the cache and a signal that drops. Test it there, off wifi.',
    dark: true,
  },
  {
    key: 'disagree-mobile-first',
    to: '/blog/what-mobile-first-actually-means',
    belief: 'Mobile-first means a smaller desktop page.',
    headline: 'It means building for the *worst* place the page gets opened.',
    why: 'A phone on one bar. Start there and the desktop version comes out better too, because everything on it had to earn its place.',
  },
  {
    key: 'disagree-services-list',
    to: '/blog/what-a-plumbers-website-has-to-do',
    belief: 'One Services page covers it.',
    headline: 'People search for the *job*, not the trade.',
    why: 'Water heater leaking, slab leak, repipe cost. Each search is a different person, and a page per job is what catches them.',
    dark: true,
  },
  {
    key: 'disagree-stock-photos',
    to: '/blog/small-business-website-mistakes',
    belief: 'Stock photos look more professional.',
    headline: 'People spot a stock photo in a *second*.',
    why: 'A slightly grainy phone photo of your own work beats a polished picture of someone else’s.',
  },
]

// ---------------------------------------------------------------------------
// before-after
// ---------------------------------------------------------------------------

/**
 * The January readings are the ones printed in "How Fast Should My Website
 * Load?" (January 25, 2026), each the median of three runs. The later readings
 * are read live off `portfolio.js`, so a re-measure moves the card. The subject
 * line describes the site by trade and town only.
 */
const READINGS = [
  {
    key: 'before-after-recreation-baytown',
    slug: 'speedway-146',
    subject: 'A Recreation Site in Baytown',
    then: { mobile: 72, desktop: 74 },
    headline: (then, now) => `Same site, *${now.mobile - then.mobile} points* higher on a phone.`,
  },
  {
    key: 'before-after-scale-shop-huffman',
    slug: 'compound-scale-services',
    subject: 'An Industrial Scale Shop in Huffman',
    then: { mobile: 93 },
    headline: (then, now) => `From ${then.mobile} to *${now.mobile}* on Google’s mobile test.`,
  },
  {
    key: 'before-after-marine-transport',
    slug: 'hollingshead-harbor',
    subject: 'A Marine Transport Company',
    then: { mobile: 91, desktop: 99 },
    headline: (then, now) =>
      `${now.mobile - then.mobile} more points on mobile, and *${now.desktop}* on desktop.`,
  },
  {
    key: 'before-after-barber-liberty',
    slug: 'faded-barber-shop',
    subject: 'A Barber Shop in Liberty',
    then: { mobile: 96, desktop: 70 },
    headline: (then, now) => `Desktop went from ${then.desktop} to *${now.desktop}*.`,
  },
  {
    key: 'before-after-credit-practice-houston',
    slug: 'delux-financial-solutions',
    subject: 'A Credit-Education Practice in Houston',
    then: { mobile: 98, desktop: 100 },
    headline: (then, now) => `*${now.mobile}* on mobile and *${now.desktop}* on desktop.`,
  },
]

const beforeAfter = reading => {
  const now = project(reading.slug).pagespeed
  const pairs = ['mobile', 'desktop']
    .filter(strategy => reading.then[strategy] !== undefined)
    .map(strategy => ({
      strategy: strategy === 'mobile' ? 'Mobile' : 'Desktop',
      before: { when: 'January 2026', score: reading.then[strategy] },
      after: { when: month(now.measured), score: now[strategy] },
    }))
  return {
    ...reading,
    headline: reading.headline(reading.then, now),
    pairs,
    source: `Google PageSpeed Insights. January figures as published in our article on load times; ${month(now.measured)} is the median of ${now.runs} runs.`,
  }
}

// ---------------------------------------------------------------------------
// teaser
// ---------------------------------------------------------------------------

const TEASERS = [
  { slug: 'why-your-site-is-fast-on-your-laptop-and-slow-on-a-phone', accent: 'Phone', dek: 0 },
  { slug: 'what-a-plumbers-website-has-to-do', accent: "Plumber's", dek: 0, dark: true },
  { slug: 'roofers-the-storm-week-your-website-either-handles-or-not', accent: 'Storm', dek: 0 },
  { slug: 'hvac-the-two-seasons-your-website-has-to-be-ready-for', accent: 'Seasons', dek: 0 },
  {
    slug: 'electricians-a-pricing-page-that-stops-tire-kicker-calls',
    accent: 'Tire-Kicker',
    dek: 1,
    dark: true,
  },
  { slug: 'reading-a-web-design-quote-what-each-line-should-mean', accent: 'Quote', dek: 0 },
  { slug: 'what-mobile-first-actually-means', accent: '"Mobile-First"', dek: 1 },
  {
    slug: 'why-your-wix-site-is-costing-you-customers',
    accent: 'Customers',
    dek: 'Wix, Squarespace, and GoDaddy builders are slow, heavy with code you never asked for, and harder for Google to read.',
    dark: true,
  },
  { slug: 'why-nobodys-filling-out-your-contact-form', accent: 'Contact', dek: 1 },
  { slug: 'small-business-website-mistakes', accent: 'Mistakes', dek: 0 },
  {
    slug: 'google-business-profile-the-most-important-free-tool',
    accent: 'Free',
    dek: 0,
    dark: true,
  },
  { slug: 'your-website-isnt-a-brochure', accent: 'Brochure', dek: 1 },
]

const sentences = text => text.split(/(?<=[.?!])\s+/)

const teaser = ({ slug, accent, dek, dark }) => {
  const article = post(slug)
  const headline = article.title.replace(accent, `*${accent}*`)
  if (headline === article.title)
    throw new Error(`media-content: "${accent}" is not in "${article.title}"`)
  return {
    key: `teaser-${slug.split('-').slice(0, 5).join('-')}`,
    to: `/blog/${slug}`,
    eyebrow: `From the Blog · ${article.category}`,
    readTime: article.readTime,
    headline,
    dek: typeof dek === 'string' ? dek : pick(sentences(article.excerpt), dek, slug),
    dark,
  }
}

/** One sentence of an excerpt, refusing an index the excerpt does not reach. */
function pick(list, index, slug) {
  if (index >= list.length)
    throw new Error(`media-content: ${slug} has no sentence ${index} in its excerpt`)
  return list[index]
}

// ---------------------------------------------------------------------------
// trade
// ---------------------------------------------------------------------------

const TRADE_IDS = [
  'plumbing',
  'hvac',
  'electrical',
  'roofing',
  'fencing',
  'auto-repair',
  'towing',
  'restaurant',
  'barber-shop',
  'storage',
  'pest-control',
  'landscaping',
]

const accentLast = title => title.replace(/(\S+?)([.?!]?)$/, '*$1*$2')

// ---------------------------------------------------------------------------
// faq
// ---------------------------------------------------------------------------

/** From `@views/company/Faq`, shortened to the opening sentences of each answer. */
const FAQS = [
  {
    key: 'faq-how-long',
    question: 'How long does a build *take*?',
    answer:
      'Most sites are live in two to four weeks. What usually moves that date is photos and content coming back slowly, so having those ready is the fastest thing you can do.',
  },
  {
    key: 'faq-what-we-need',
    question: 'What do you need to get *started*?',
    answer:
      'Your logo if you have one, whatever photos of the work you already have, and half an hour on the phone. We write the copy and design the site.',
  },
  {
    key: 'faq-redesign',
    question: 'Can you redesign an *existing* site?',
    answer:
      'Yes. We look at what you have, work out which pages are costing you calls, and rebuild it. The layout, the order of the pages and the words all get rethought, not just the colors.',
  },
  {
    key: 'faq-wordpress',
    question: 'Do you use WordPress, Wix or *Squarespace*?',
    answer: `No. Every site is written from scratch, so there is no theme to update and no plugin to break it at midnight. Across the client sites already live, Google’s PageSpeed test averages ${PORTFOLIO_AVERAGES.mobile} on mobile and ${PORTFOLIO_AVERAGES.desktop} on desktop.`,
  },
  {
    key: 'faq-stop-monthly',
    question: 'Can the monthly be *stopped*?',
    answer:
      'Yes, any time. There is no annual term to sign, no notice period and no cancellation fee.',
  },
  {
    key: 'faq-agency',
    question: 'How is this different from an *agency*?',
    answer:
      'You talk to the people building the site. The team is small, so there is no account manager and no ticket queue. You text us, and we make the change.',
  },
  {
    key: 'faq-ownership',
    question: 'Who owns what once the site is *live*?',
    answer:
      'Your domain is registered in your name, and the text, photos, logo and brand marks you supply stay yours. TaylorURL keeps the source code and the platform it runs on.',
  },
  {
    key: 'faq-outside-houston',
    question: 'Do you only work with businesses near *Houston*?',
    answer:
      'No. We are based in Baytown and most clients are around Houston and the bay, but the whole project runs fine by phone, text and email.',
  },
]

// ---------------------------------------------------------------------------
// carousels
// ---------------------------------------------------------------------------

const toBlog = {
  headline: 'The whole article is on *taylorurl.com*.',
  body: 'Free to read, no sign-up, and written for owners rather than developers.',
}

const CAROUSELS = [
  {
    key: 'carousel-plumber-seven-things',
    format: 'trade',
    to: '/blog/what-a-plumbers-website-has-to-do',
    headline: 'Seven things a plumber’s site has to get right',
    eyebrow: 'Trade Playbooks',
    cover: 'Seven things a plumber’s site has to get *right*.',
    sub: 'The person calling is standing in an inch of water with about ninety seconds of patience.',
    slides: [
      {
        points: [
          {
            n: '01',
            title: 'The number at the top',
            body: 'In the header of every page, as a link that dials when tapped.',
          },
          {
            n: '02',
            title: 'The hours, stated',
            body: 'Say when you answer, so the person at 11pm knows whether to call.',
          },
        ],
      },
      {
        points: [
          {
            n: '03',
            title: 'The towns, by name',
            body: 'Baytown, Highlands, Mont Belvieu. People search the place they live, not a metro area.',
          },
          {
            n: '04',
            title: 'A page per job',
            body: 'Water heater, slab leak, repipe. Each is a different search and a different person.',
          },
        ],
      },
      {
        points: [
          {
            n: '05',
            title: 'Your own photos',
            body: 'Two pictures on every job, one before and one after.',
          },
          {
            n: '06',
            title: 'Real reviews',
            body: 'With a first name and a town. “Satisfied Customer” reads like you typed it.',
          },
        ],
      },
      {
        points: [
          {
            n: '07',
            title: 'Fast on one bar',
            body: 'Fast enough to open on cell data in a metal-sided garage, on a phone at four percent. The number has to be tappable before the page finishes loading.',
          },
        ],
      },
    ],
    close: { ...toBlog, path: 'taylorurl.com/blog' },
  },
  {
    key: 'carousel-five-mistakes',
    format: 'check',
    to: '/blog/small-business-website-mistakes',
    headline: 'Five website mistakes small businesses keep making',
    eyebrow: 'Owner’s Handbook',
    cover: 'Five website mistakes small businesses keep *making*.',
    sub: 'They turn up on almost every site we look at, and none of them is hard to fix.',
    slides: [
      {
        points: [
          {
            n: '01',
            title: 'No clear next step',
            body: 'Every page needs one action: call, send the form, book a slot. Put it where a thumb already is.',
          },
          {
            n: '02',
            title: 'Stock photos',
            body: 'Use your crew, your truck, your finished jobs. Phone photos in good light are fine.',
          },
        ],
      },
      {
        points: [
          {
            n: '03',
            title: 'A hidden phone number',
            body: 'Visible without scrolling, in the header and the footer, on every page.',
          },
          {
            n: '04',
            title: 'A layout that breaks on a phone',
            body: 'Tiny text, buttons too small to tap and sideways scrolling lose customers every day.',
          },
        ],
      },
      {
        points: [
          {
            n: '05',
            title: 'Set it and forget it',
            body: 'A site still showing two-year-old hours and photos looks abandoned. Keep the information current and the photos recent.',
          },
        ],
      },
    ],
    close: { ...toBlog, path: 'taylorurl.com/blog' },
  },
  {
    key: 'carousel-roofer-storm-week',
    format: 'trade',
    to: '/blog/roofers-the-storm-week-your-website-either-handles-or-not',
    headline: 'The storm week a roofing site has to handle',
    eyebrow: 'Trade Playbooks',
    cover: 'The storm week your roofing site has to *handle*.',
    sub: 'A hail line rolls through Baytown on a Tuesday. By Wednesday morning half the neighborhood is on the phone.',
    slides: [
      {
        points: [
          {
            n: '01',
            title: 'A number a thumb can reach',
            body: 'In the header on every page, big, and set up so tapping it dials.',
          },
        ],
      },
      {
        points: [
          {
            n: '02',
            title: 'A page for emergency tarping',
            body: 'Someone whose ceiling is coming down wants a tarp on tonight, not an inspection on Friday. Give it a page and a place on the menu.',
          },
        ],
      },
      {
        points: [
          {
            n: '03',
            title: 'An insurance page',
            body: 'The first question after a storm is whether insurance will pay and how the claim gets filed. Say what a claim looks like, plainly.',
          },
        ],
      },
      {
        points: [
          {
            n: '04',
            title: 'A profile that matches the site',
            body: 'Same address, same hours, same phone number on Google as on the site. A mismatch nobody noticed in April costs calls in storm week.',
          },
        ],
      },
    ],
    close: { ...toBlog, path: 'taylorurl.com/blog' },
  },
  {
    key: 'carousel-how-a-build-goes',
    format: 'process',
    to: '/process',
    headline: 'How a build goes, step by step',
    eyebrow: 'How It Works',
    cover: 'How a build goes, step by *step*.',
    sub: 'Six steps, and most sites are live in two to four weeks.',
    slides: [
      {
        points: [
          {
            n: `01 · ${PROCESS_TIMELINE[0].duration}`,
            title: PROCESS_TIMELINE[0].title,
            body: 'You tell us what the business does. We tell you straight whether we are the right fit.',
          },
          {
            n: `02 · ${PROCESS_TIMELINE[1].duration}`,
            title: PROCESS_TIMELINE[1].title,
            body: 'What gets built, what it costs and the date it goes live, in writing, before anything starts.',
          },
        ],
      },
      {
        points: [
          {
            n: `03 · ${PROCESS_TIMELINE[2].duration}`,
            title: PROCESS_TIMELINE[2].title,
            body: 'Real pages with your own photos in them. We keep changing it until it looks like your business.',
          },
          {
            n: `04 · ${PROCESS_TIMELINE[3].duration}`,
            title: PROCESS_TIMELINE[3].title,
            body: 'Built from scratch, with a preview link as it goes up.',
          },
        ],
      },
      {
        points: [
          {
            n: `05 · ${PROCESS_TIMELINE[4].duration}`,
            title: PROCESS_TIMELINE[4].title,
            body: 'You click through every page and list what is off. We fix it and go live the day you say go.',
          },
          {
            n: `06 · ${PROCESS_TIMELINE[5].duration}`,
            title: PROCESS_TIMELINE[5].title,
            body: 'Hosting, backups and changes stay with us. You text us, and we handle it.',
          },
        ],
      },
    ],
    close: {
      headline: 'The whole process is on *taylorurl.com*.',
      body: 'Each step, what you do in it, and what we do.',
      path: 'taylorurl.com/process',
    },
  },
  {
    key: 'carousel-see-it-like-a-customer',
    format: 'check',
    to: '/blog/why-your-site-is-fast-on-your-laptop-and-slow-on-a-phone',
    headline: 'See your site the way a customer does',
    eyebrow: 'Speed & Vitals',
    cover: 'See your site the way a customer *does*.',
    sub: 'It snaps open on your laptop and stalls on a phone in a truck. Here is why, and how to check.',
    slides: [
      {
        points: [
          {
            n: '01',
            title: 'You never load it cold',
            body: 'Your browser already has the fonts and icons from this week. The first paint you see is not the one a customer sees.',
          },
        ],
      },
      {
        points: [
          {
            n: '02',
            title: 'Her phone is not your laptop',
            body: 'A tenth of the processor, none of the cache, and a signal that drops every few seconds.',
          },
        ],
      },
      {
        points: [
          {
            n: '03',
            title: 'Open it the way she does',
            body: 'Chrome on your phone, the three-dot menu, New Incognito Tab, your domain. Once on wifi, once off.',
          },
        ],
      },
      {
        points: [
          {
            n: '04',
            title: 'The images do the most damage',
            body: 'A phone camera shoots four thousand pixels wide. A hero image on a phone shows maybe four hundred. Ask for them compressed.',
          },
        ],
      },
    ],
    close: { ...toBlog, path: 'taylorurl.com/blog' },
  },
  {
    key: 'carousel-contact-form-taken-apart',
    format: 'check',
    to: '/blog/why-nobodys-filling-out-your-contact-form',
    headline: 'A contact form, taken apart',
    eyebrow: 'Design That Sells',
    cover: 'A contact form, taken *apart*.',
    sub: 'Length is a small part of why a form sits empty. The rest is friction, and most of it is on a phone.',
    slides: [
      {
        points: [
          {
            n: '01',
            title: 'Ask for what you will use',
            body: 'Name, phone and what is wrong covers most trades. Budget and how they heard about you can wait.',
          },
        ],
      },
      {
        points: [
          {
            n: '02',
            title: 'No account first',
            body: 'A sign-up wall in front of an inquiry is a door you added to your own building.',
          },
        ],
      },
      {
        points: [
          {
            n: '03',
            title: 'Put it where people decide',
            body: 'In the header, the footer, and next to whatever made them want to call. Three clicks deep is three too many.',
          },
        ],
      },
      {
        points: [
          {
            n: '04',
            title: 'Say what happens after Send',
            body: 'Set an expectation you can keep, then keep it. Ours says you usually get a reply within the hour.',
          },
        ],
      },
    ],
    close: { ...toBlog, path: 'taylorurl.com/blog' },
  },
  {
    key: 'carousel-what-google-grades',
    format: 'number',
    to: '/blog/how-fast-should-my-website-load',
    headline: 'What Google grades on every site',
    eyebrow: 'Speed & Vitals',
    cover: 'What Google grades on every *site*.',
    sub: 'Google publishes the target, then measures every page against it.',
    slides: [
      {
        points: [
          {
            n: '01',
            title: '2.5 seconds',
            body: 'Your main content on the screen within two and a half seconds.',
          },
        ],
      },
      {
        points: [
          {
            n: '02',
            title: '200 milliseconds',
            body: 'The page answers a tap within a fifth of a second.',
          },
        ],
      },
      {
        points: [
          {
            n: '03',
            title: 'Nothing jumps',
            body: 'Nothing moves under somebody’s thumb while the page loads.',
          },
        ],
      },
      {
        points: [
          {
            n: '04',
            title: 'Check yours',
            body: 'Go to pagespeed.web.dev, put your address in and read the mobile column. Aim for 90 or better.',
          },
        ],
      },
    ],
    close: { ...toBlog, path: 'taylorurl.com/blog' },
  },
]

const storageCarousel = () => {
  const detail = INDUSTRY_DETAIL.storage
  return {
    key: 'carousel-storage-site-teardown',
    format: 'trade',
    to: '/industries/storage',
    headline: 'Storage sites that rent the unit at midnight',
    eyebrow: 'Storage Websites',
    cover: accentLast(detail.heroTitle),
    sub: detail.heroDescription,
    slides: [
      { points: [{ n: '01', title: detail.needsTitle, body: detail.needsDescription }] },
      ...detail.build.map((cell, index) => ({
        points: [{ n: String(index + 2).padStart(2, '0'), title: cell.title, body: cell.body }],
      })),
    ],
    close: {
      headline: 'Every trade we build for is on *taylorurl.com*.',
      body: 'What a site for each one has to do, and the software it works alongside.',
      path: 'taylorurl.com/industries',
    },
  }
}

// ---------------------------------------------------------------------------
// videos
// ---------------------------------------------------------------------------

/**
 * Each video is a list of scenes over the content box, timed in seconds, and a
 * caption track written out beside it for the alt text. Feeds autoplay muted,
 * so the words on screen are the whole of what a video says.
 */
function videos(fx, trades) {
  const recreation = project('speedway-146').pagespeed
  const close = (from, to, line, path) => ({
    from,
    to,
    hold: true,
    html: `${fx.head(line, 0.1, 104)}${fx.path(path, 0.9)}`,
  })
  const tradeNames = trades.filter(trade => trade.id !== 'something-else').map(trade => trade.name)
  const measured = month(recreation.measured)

  // What a reader who cannot see each video is given, written from the same
  // content the scenes draw rather than read back off the page.
  const alts = {
    'video-check-off-wifi':
      'Under a minute. Open your site on your phone, off wifi. Four questions: Can you read it without pinching? Can you hit every button with a thumb? Does the keyboard hide the submit button? Does it appear in under three seconds? More checks like this at taylorurl.com/blog.',
    'video-53-percent':
      '53% of mobile visitors leave a page that takes more than three seconds to load. Google research, cited on our blog. A site that loads in five has lost half of them before the first word. Check your own speed at taylorurl.com/speed-check.',
    'video-before-after-recreation-baytown': `A recreation site in Baytown. Same site, same test. January, then ${measured.split(' ')[0]}. Mobile score: 72 in January 2026, ${recreation.mobile} in ${measured}. Desktop score: 74 in January 2026, ${recreation.desktop} in ${measured}. Every score we quote is one you can check yourself. Google PageSpeed Insights. January figures as published on our blog; ${measured} is the median of ${recreation.runs} runs.`,
    'video-disagree-long-forms':
      'Heard in the trade: "Long forms scare people off." The belief is struck through. What actually happens: the longest form we have built is the one people finish. Friction empties a form, and most of it is on a phone. Big fields, a keyboard that leaves the button visible, and no account to make first. Read the whole case at taylorurl.com/blog.',
    'video-how-a-build-goes': `How a build goes, step by step. ${PROCESS_TIMELINE.map(
      step => `${step.step}. ${step.title}, ${step.duration}.`
    ).join(' ')} Most sites are live in two to four weeks. taylorurl.com/process.`,
    'video-teaser-laptop-and-phone':
      'From the blog: Why your site is fast on your laptop and slow on a phone. 10×: your laptop has ten times the processor of the phone your customer is holding, and a connection that does not drop. Read it at taylorurl.com/blog.',
    'video-teaser-plumbers-website':
      'From the blog, Trade Playbooks: What a plumber’s website has to do. Seven things: the number at the top; the hours, stated; the towns, by name; a page per job; your own photos; real reviews; fast on one bar. All seven, explained, at taylorurl.com/blog.',
    'video-phone-call-bar':
      'A call bar that follows. The number pinned to the bottom of every page on a phone. A phone shows a plumbing site scrolling past its job pages, water heaters, slab leaks, drain clearing, repipes and backflow testing, while a blue Call Now bar stays pinned to the bottom of the screen. See what each trade’s site needs at taylorurl.com/industries.',
    'video-2-5-seconds':
      '2.5 seconds is how long Google gives your main content to appear on the screen. Google counts it when it ranks your page. From our article on how fast a site should load. Test your site at taylorurl.com/speed-check.',
    'video-trades-we-build-for': `Whatever the sign out front says. Trades we build for: ${tradeNames.join(', ')}. ${tradeNames.length} trades, each with a page of its own, at taylorurl.com/industries.`,
  }
  const withAlt = list =>
    list.map(video => {
      if (!alts[video.key]) throw new Error(`media-content: ${video.key} has no alt text`)
      return { ...video, alt: alts[video.key] }
    })

  return withAlt([
    {
      key: 'video-check-off-wifi',
      format: 'check',
      to: '/blog/what-mobile-first-actually-means',
      headline: 'The off-wifi check',
      eyebrow: 'Try This Tonight',
      duration: 20,
      poster: 1.6,
      scenes: [
        {
          from: 0,
          to: 4.2,
          html: `${fx.label('Under a Minute', 0)}${fx.head('Open your site on your phone, *off* wifi.', 0.2, 132)}`,
        },
        {
          from: 4.2,
          to: 16.4,
          align: 'top',
          html: `${fx.label('Four Questions', 0)}${fx.steps(
            [
              'Can you read it without pinching?',
              'Can you hit every button with a thumb?',
              'Does the keyboard hide the submit button?',
              'Does it appear in under three seconds?',
            ],
            0.5,
            2.6
          )}`,
        },
        close(16.4, 20, 'More checks like this at *taylorurl.com*.', 'taylorurl.com/blog'),
      ],
    },
    {
      key: 'video-53-percent',
      format: 'number',
      to: '/blog/why-fast-websites-make-more-money',
      headline: '53% leave after three seconds',
      eyebrow: 'Three Seconds',
      duration: 18,
      poster: 3.2,
      scenes: [
        {
          from: 0,
          to: 9,
          html: `${fx.figure(53, { at: 0.3, suffix: '%', dur: 2.2, size: 420 })}${fx.body('of mobile visitors leave a page that takes more than three seconds to load.', 2.4, 60)}${fx.note('Google research, cited on our blog.', 4)}`,
        },
        {
          from: 9,
          to: 14.6,
          html: `${fx.head('A site that loads in five has lost *half* of them before the first word.', 0.1, 112)}`,
        },
        close(14.6, 18, 'Check your own speed at *taylorurl.com*.', 'taylorurl.com/speed-check'),
      ],
    },
    {
      key: 'video-before-after-recreation-baytown',
      format: 'before-after',
      to: '/portfolio',
      headline: 'Same site, measured twice',
      eyebrow: 'Measured by Google',
      duration: 20,
      poster: 9,
      scenes: [
        {
          from: 0,
          to: 3.8,
          html: `${fx.label('A Recreation Site in Baytown', 0)}${fx.head(`Same site, same test. January, then *${month(recreation.measured).split(' ')[0]}*.`, 0.2, 120)}`,
        },
        {
          from: 3.8,
          to: 10.6,
          align: 'top',
          html: `${fx.label('Mobile Score', 0)}${fx.bar('January 2026', 72, { at: 0.4 })}${fx.bar(month(recreation.measured), recreation.mobile, { at: 2.2, after: true })}`,
        },
        {
          from: 10.6,
          to: 16.4,
          align: 'top',
          html: `${fx.label('Desktop Score', 0)}${fx.bar('January 2026', 74, { at: 0.4 })}${fx.bar(month(recreation.measured), recreation.desktop, { at: 2.2, after: true })}`,
        },
        {
          from: 16.4,
          to: 20,
          hold: true,
          html: `${fx.head('Every score we quote is one you can *check yourself*.', 0.1, 104)}${fx.note(`Google PageSpeed Insights. January figures as published on our blog; ${month(recreation.measured)} is the median of ${recreation.runs} runs.`, 0.8)}`,
        },
      ],
    },
    {
      key: 'video-disagree-long-forms',
      format: 'disagreement',
      to: '/blog/why-nobodys-filling-out-your-contact-form',
      headline: 'Long forms do not scare people off',
      eyebrow: 'Heard in the Trade',
      duration: 20,
      poster: 3.2,
      dark: true,
      scenes: [
        {
          from: 0,
          to: 5.4,
          html: `${fx.label('The Belief', 0)}${fx.belief('Long forms scare people off.', 0.2, 2.2, 140)}`,
        },
        {
          from: 5.4,
          to: 11.8,
          html: `${fx.label('What Actually Happens', 0)}${fx.head('The longest form we have built is the one people *finish*.', 0.2, 112)}`,
        },
        {
          from: 11.8,
          to: 16.6,
          html: `${fx.head('Friction empties a form. Most of it is on a *phone*.', 0.1, 112)}${fx.body('Big fields, a keyboard that leaves the button visible, and no account to make first.', 1.6, 52)}`,
        },
        close(16.6, 20, 'Read the whole case on *taylorurl.com*.', 'taylorurl.com/blog'),
      ],
    },
    {
      key: 'video-how-a-build-goes',
      format: 'process',
      to: '/process',
      headline: 'How a build goes',
      eyebrow: 'How It Works',
      duration: 22,
      poster: 9.5,
      scenes: [
        { from: 0, to: 3.6, html: `${fx.head('How a build goes, step by *step*.', 0.2, 136)}` },
        {
          from: 3.6,
          to: 17.6,
          align: 'top',
          html: `<div class="timeline">${PROCESS_TIMELINE.map(
            (step, index) =>
              `<div class="tl-step fx" data-fx="fade" data-at="${0.4 + index * 1.9}"><span class="n">${step.step}</span><span class="t">${step.title}</span><span class="d">${step.duration}</span></div>`
          ).join('')}</div>`,
        },
        {
          from: 17.6,
          to: 22,
          hold: true,
          html: `${fx.head('Most sites are live in two to four *weeks*.', 0.1, 112)}${fx.path('taylorurl.com/process', 1)}`,
        },
      ],
    },
    {
      key: 'video-teaser-laptop-and-phone',
      format: 'teaser',
      to: '/blog/why-your-site-is-fast-on-your-laptop-and-slow-on-a-phone',
      headline: 'Fast on a laptop, slow on a phone',
      eyebrow: 'From the Blog · Site Speed',
      duration: 16,
      poster: 3,
      scenes: [
        {
          from: 0,
          to: 6.4,
          html: `${fx.head('Why your site is fast on your laptop and slow on a *phone*.', 0.2, 124)}`,
        },
        {
          from: 6.4,
          to: 12.4,
          html: `${fx.figure(10, { at: 0.2, suffix: '×', dur: 1.4, size: 360 })}${fx.body('Your laptop has ten times the processor of the phone your customer is holding, and a connection that does not drop.', 1.2, 56)}`,
        },
        close(12.4, 16, 'Read it on *taylorurl.com*.', 'taylorurl.com/blog'),
      ],
    },
    {
      key: 'video-teaser-plumbers-website',
      format: 'teaser',
      to: '/blog/what-a-plumbers-website-has-to-do',
      headline: 'What a plumber’s website has to do',
      eyebrow: 'From the Blog · Trade Playbooks',
      duration: 18,
      poster: 3,
      dark: true,
      scenes: [
        {
          from: 0,
          to: 5.2,
          html: `${fx.label('Trade Playbooks', 0)}${fx.head('What a plumber’s website has to *do*.', 0.2, 140)}`,
        },
        {
          from: 5.2,
          to: 14.4,
          align: 'top',
          html: `${fx.label('Seven Things', 0)}${fx.steps(
            [
              'The number at the top',
              'The hours, stated',
              'The towns, by name',
              'A page per job',
              'Your own photos',
              'Real reviews',
              'Fast on one bar',
            ],
            0.4,
            1.05,
            false
          )}`,
        },
        close(14.4, 18, 'All seven, explained, on *taylorurl.com*.', 'taylorurl.com/blog'),
      ],
    },
    {
      key: 'video-phone-call-bar',
      format: 'behind',
      to: '/industries/plumbing',
      headline: 'A call bar that follows',
      eyebrow: 'Built Phone First',
      duration: 20,
      poster: 6,
      scenes: [
        { from: 0, to: 3.6, html: `${fx.head('A call bar that *follows*.', 0.2, 140)}` },
        {
          from: 3.6,
          to: 16.6,
          align: 'top',
          html: `${fx.body('The number pinned to the bottom of every page on a phone.', 0.2, 50)}
<div class="phone fx" data-fx="fade" data-at="0.4" data-alt="A phone showing a plumbing site scrolling past its job pages, water heaters, slab leaks, drain clearing, repipes and backflow testing, while a blue Call Now bar stays pinned to the bottom of the screen."><div class="notch"></div><div class="screen"><div class="status"></div>
<div class="mock fx" data-fx="scroll" data-at="2.2" data-from="0" data-to="-1180" data-dur="8.6">
<div class="logo"></div>
<h3>Plumbing, day or night.</h3><div class="bar" style="width:92%"></div><div class="bar" style="width:70%"></div>
<div class="photo"></div>
${['Water heaters', 'Slab leaks', 'Drain clearing', 'Repipes', 'Backflow testing']
  .map(
    job =>
      `<div class="card"><b>${job}</b><div class="bar" style="width:88%"></div><div class="bar" style="width:62%"></div></div>`
  )
  .join('')}
<div class="photo"></div><div class="bar" style="width:80%"></div><div class="bar" style="width:55%"></div>
</div>
<div class="ring fx" data-fx="ring" data-at="11"></div>
<div class="callbar"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>Call Now</div>
</div></div>`,
        },
        close(
          16.6,
          20,
          'See what each trade’s site needs on *taylorurl.com*.',
          'taylorurl.com/industries'
        ),
      ],
    },
    {
      key: 'video-2-5-seconds',
      format: 'number',
      to: '/blog/how-fast-should-my-website-load',
      headline: 'Google gives you 2.5 seconds',
      eyebrow: 'Google’s Target',
      duration: 18,
      poster: 3.4,
      scenes: [
        {
          from: 0,
          to: 8.4,
          html: `${fx.figure(2.5, { at: 0.3, suffix: 's', decimals: 1, dur: 2.5, size: 420 })}${fx.body('is how long Google gives your main content to appear on the screen.', 2.8, 60)}`,
        },
        {
          from: 8.4,
          to: 14.4,
          html: `${fx.head('Google counts it when it *ranks* your page.', 0.1, 116)}${fx.note('From our article on how fast a site should load.', 1.6)}`,
        },
        close(14.4, 18, 'Test your site at *taylorurl.com*.', 'taylorurl.com/speed-check'),
      ],
    },
    {
      key: 'video-trades-we-build-for',
      format: 'trade',
      to: '/industries',
      headline: 'Whatever the sign out front says',
      eyebrow: 'Trades We Build For',
      duration: 18,
      poster: 1.6,
      scenes: [
        { from: 0, to: 3.4, html: `${fx.head('Whatever the sign out front *says*.', 0.2, 140)}` },
        {
          from: 3.4,
          to: 13.6,
          align: 'top',
          html: `<div class="roll fx" data-fx="fade" data-at="0"><div class="list fx" data-fx="scroll" data-at="0.3" data-from="980" data-to="${-(tradeNames.length * 120) + 260}" data-dur="9.6">${tradeNames
            .map(name => `<div class="item">${name}</div>`)
            .join('')}</div></div>`,
        },
        close(
          13.6,
          18,
          `${tradeNames.length} trades, each with a page of its *own*.`,
          'taylorurl.com/industries'
        ),
      ],
    },
  ])
}

/** The library, in the order the manifest lists it. */
export async function library(fx) {
  const trades = await loadTrades()
  const tradeName = id => trades.find(trade => trade.id === id)?.name ?? id

  const images = [
    ...NUMBERS.map((item, index) => ({
      ...item,
      format: 'number',
      eyebrow: 'By the Numbers',
      headline: `${item.figure} ${item.label}`,
      dark: index % 3 === 2,
    })),
    ...CHECKS.map((item, index) => ({ ...item, format: 'check', dark: index % 3 === 1 })),
    ...DISAGREEMENTS.map(item => ({ ...item, format: 'disagreement' })),
    ...READINGS.map((item, index) => ({
      ...beforeAfter(item),
      format: 'before-after',
      to: '/portfolio',
      dark: index % 2 === 1,
    })),
    ...TEASERS.map(item => ({ ...teaser(item), format: 'teaser' })),
    ...TRADE_IDS.map((id, index) => {
      const detail = INDUSTRY_DETAIL[id]
      const trade = trades.find(entry => entry.id === id)
      return {
        key: `trade-${id}`,
        format: 'trade',
        to: `/industries/${id}`,
        eyebrow: `${trade.name} Websites`,
        headline: accentLast(detail.heroTitle),
        listLabel: 'What the Site Has to Do',
        items: trade.needs,
        dark: index % 4 === 3,
      }
    }),
    // Dickinson is left out: its first word is a client's, and the town's own
    // page leads with that client's work.
    ...AREAS.filter(area => area.profile && area.name !== 'Dickinson').map((area, index) => {
      const counties = area.profile.local.counties
      return {
        key: `area-${area.slug}`,
        format: 'area',
        to: `/areas/${area.slug}`,
        eyebrow: `Where We Build · ${counties.join(' and ')} ${counties.length > 1 ? 'Counties' : 'County'}`,
        town: `${area.name}*.*`,
        headline: area.name,
        title: area.profile.local.title,
        lede: area.profile.lede,
        chips: area.trades.slice(0, 5).map(tradeName),
        dark: index % 4 === 2,
      }
    }),
    ...FAQS.map((item, index) => ({
      ...item,
      headline: item.question,
      format: 'faq',
      to: '/faq',
      dark: index % 4 === 3,
    })),
  ].map(item => ({ ...item, kind: 'image', channels: ALL }))

  const carousels = [...CAROUSELS, storageCarousel()].map(item => ({
    ...item,
    kind: 'carousel',
    channels: FEED,
  }))
  const clips = videos(fx, trades).map(item => ({ ...item, kind: 'video', channels: FEED }))
  return [...images, ...carousels, ...clips]
}
