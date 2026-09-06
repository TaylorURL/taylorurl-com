import PageHero from '@components/PageHero'
import CtaBanner from '@components/CtaBanner'
import Seo from '@components/Seo'
import { AREA_SERVED, BUSINESS_ID, SITE_URL, breadcrumbSchema } from '@constants/seo'
import {
  BUILD_PRICE,
  INCLUDED_COUNT,
  MARKET,
  MONTHLY_PRICE,
  PRICE_OFFERS,
  PRICE_PREFIX,
} from '@data/pricing'
import ServiceSection from './services/ServiceSection'
import SectionLink from './services/SectionLink'
import PriceRail from './pricing/PriceRail'
import IncludedSheet from './pricing/IncludedSheet'
import MarketTally from './pricing/MarketTally'
import QualityProof from './pricing/QualityProof'
import QuoteSheet from './pricing/QuoteSheet'
import Questions from './pricing/Questions'

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

// The elsewhere range, written the way the page says it out loud. Both ends
// come from the shared figures, so the sentence cannot state a band the drawing
// below it does not draw.
const ELSEWHERE = `${MONEY.format(MARKET.buildLow)} to ${MONEY.format(MARKET.buildHigh)}`

// The questions somebody comparing two quotes actually has. Answered here in
// full, and published as FAQ markup so a search result can carry the answer.
const QUESTIONS = [
  {
    q: `What is in the ${BUILD_PRICE}?`,
    a: 'Design, the writing, the build itself, the domain set up, and launch day. One finished site, with no page or feature billed separately.',
  },
  {
    q: `What is in the ${MONTHLY_PRICE} a month?`,
    a: 'Hosting, daily backups, security, changes whenever you want them, realtime error monitoring, and the organic search work. There is no per-change fee.',
  },
  {
    q: `Why does a web design agency charge ${ELSEWHERE} for this?`,
    a: 'The work is the same work, and you talk to whoever did it. Google grades every client site already live, and those grades are published per site on the portfolio. There is one person here and no floor of them, so nobody is billing you for an account manager, a project manager, a sales commission, or an office.',
  },
  {
    q: 'Are there setup fees or extras?',
    a: 'No setup fee, and nothing on the site is billed on top: booking, ordering, a shop, and the tools behind them are built as part of the site. The two figures are where the price starts, a bigger project costs more, and you agree to that number before anything starts. Two costs sit outside them and neither is mine: Google or Microsoft bill for each mailbox, and no advertising is bought here.',
  },
  {
    q: `Is the ${MONTHLY_PRICE} a month optional?`,
    a: 'No. It is what keeps the site online and looked after, so it runs for as long as the site does. There is no annual term to sign, and it stops whenever you say so. If it does end, the site comes offline; your domain and your content go with you.',
  },
  {
    q: 'Who owns the domain?',
    a: 'You do. It is registered in your name, or it stays in the account you already have. If it needs to move, it moves with you.',
  },
  {
    q: 'What happens to the site if I stop the monthly?',
    a: 'It comes down. Hosting, backups, monitoring, and the search work all sit in the monthly, so nothing is paying to keep it up.',
  },
]

/**
 * The price on a page of its own, because it is what people search for and the
 * only other place it is stated is the last step of the configurator.
 *
 * The page is built in the order somebody actually decides in. The strip under
 * the hero answers the question they came with, because a figure withheld reads
 * as a figure being got ready rather than as an argument being made. The sheet
 * is what the page is for, and it is one object rather than six bands so that
 * thirty-six lines can be read without four screens of scrolling. The tally
 * sets the two figures against what the same work is quoted at elsewhere. Only
 * then does the price itself get a section, at the foot, where a reader who has
 * already read the case arrives at it.
 *
 * Every figure and every line comes from `@data/pricing`, so nothing on this
 * page can disagree with the configurator, the service pages, or the checkout.
 */
export default function Pricing() {
  return (
    <div>
      <Seo
        title="Website Pricing in Baytown, TX"
        description={`Website pricing in Baytown, TX. Web design, hosting, SEO, and monthly maintenance from ${BUILD_PRICE} up front and ${MONTHLY_PRICE} a month. See everything both figures cover.`}
        path="/pricing"
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Pricing', path: '/pricing' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            '@id': `${SITE_URL}/pricing#offer`,
            serviceType: 'Web design, hosting, and maintenance',
            name: 'Small business website, built and looked after',
            description:
              'A custom website built for a local business, then hosted, maintained, monitored, changed on request, and worked on for organic search.',
            provider: { '@id': BUSINESS_ID },
            areaServed: AREA_SERVED,
            offers: PRICE_OFFERS,
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: QUESTIONS.map(item => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          },
        ]}
      />
      {/* The studio's own two figures and nothing else. What anybody else
          charges is an argument, and an argument belongs under the price rather
          than in front of it: a reader who arrived to find out what this costs
          and is met by somebody else's number has to work out whose page they
          are on before they can read the sentence. */}
      <PageHero
        draft="node"
        eyebrow="Price"
        title={`${PRICE_PREFIX} ${BUILD_PRICE} to build it. ${PRICE_PREFIX} ${MONTHLY_PRICE} a month to run it.`}
        description="That is where a small business website starts, and what most of them cost. Web design, hosting, monthly maintenance, and the SEO work that gets you found on Google are all inside those two numbers."
      />

      <PriceRail />

      <ServiceSection
        id="included"
        ground="paper"
        draft="iso"
        eyebrow="What You Get"
        title="Everything both figures cover."
        lede="Web design, web development, hosting, SEO, and the monthly maintenance behind all of it. Six groups, thirty-six lines, and not one of them is an extra."
        meta={
          <p className="section-label-sm text-ink-faint">
            <span className="tabular-nums">{INCLUDED_COUNT}</span> things included
          </p>
        }
      >
        <IncludedSheet />
        <div className="mt-8">
          <SectionLink to="/services/online-tools" label="Booking and Tools" ground="paper" />
        </div>
      </ServiceSection>

      <ServiceSection
        id="tally"
        ground="band"
        draft="ledger"
        eyebrow="The Comparison"
        title={`The same work, quoted at ${ELSEWHERE}.`}
        lede="A web design agency quotes the build, then bills a monthly retainer on top of it. Both sides carry a monthly, so the honest comparison is the whole run rather than the first invoice."
      >
        <MarketTally />
        <QualityProof />
        <div className="mt-8">
          <SectionLink to="/portfolio" label="See the Work" ground="band" />
        </div>
      </ServiceSection>

      <ServiceSection
        id="figures"
        ground="paper"
        draft="column"
        eyebrow="The Figures"
        title="Two numbers, and that is where the price starts."
        lede="The build is paid once. The monthly covers everything the site needs after that, for as long as it runs."
      >
        <QuoteSheet />
      </ServiceSection>

      <ServiceSection
        id="questions"
        ground="band"
        draft="plan"
        eyebrow="Questions"
        title="What people ask before they decide."
      >
        <Questions items={QUESTIONS} ground="band" />
        <div className="mt-8">
          <SectionLink to="/faq" label="More Questions" ground="band" />
        </div>
      </ServiceSection>

      <CtaBanner
        draft="column"
        eyebrow="Let’s Talk"
        heading="Know the price."
        accentText="Start the work."
        description="Pick your trade and the page fills in around it. The plan and the price come first, then the build is paid for and the work starts."
        primaryLabel="Start a Project"
        primaryTo="/start"
        secondaryLabel="See the Services"
        secondaryTo="/services"
      />
    </div>
  )
}
