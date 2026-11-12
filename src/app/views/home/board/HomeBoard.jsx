import {
  CallToAction,
  DeviceShowcase,
  FeatureRow,
  Grid,
  PageIntro,
  PhoneShot,
  Section,
  SectionHead,
  StatPanel,
  Statement,
  Steps,
  WorkCard,
} from '@components/kit/Kit'
import BlogCarousel from '../BlogCarousel'
import { committedStanding } from '@data/reputation/review-standings'
import { PUBLISHES_REVIEWS } from '../../../../../lib/site/current.js'
import { BbbAccredited, Monthly, QuoteCycle, TextThread } from './parts'
import {
  MOBILE_SPEED,
  MONTHLY,
  clientReviews,
  clientSite,
  townOf,
  tradeOf,
  workHref,
} from './boardData'

const FEATURED = 'baytowngokarts.com'
const FAST = 'southeastarbor.com'
const FOUND = 'dickinsonbayoufleeting.com'
const STRIP = ['southeastarbor.com', 'dickinsonbayoufleeting.com', 'faded-barbershop.com']
const REVIEWED = 'djrxexcellence.com'

const STEPS = [
  {
    title: 'Tell me about the business',
    body: 'Call, text or send the form. Two minutes is enough.',
  },
  {
    title: 'Get a plan and a price',
    body: 'In writing, before any work starts. Asking is free.',
  },
  {
    title: 'Go live in two to four weeks',
    body: 'I host it, keep it fast, and make changes when you text.',
  },
]

/**
 * The speech bubbles drifting round the statement under the first screen, the
 * way whatsapp.com floats "Hello!" and "Bonjour" round its own: the kind of
 * texts that go back and forth once a site is live.
 */
const BUBBLES = [
  'Closing at 3 Friday. Can you put that on the site?',
  'Done. Your Google hours match too.',
  'Can we add the new menu?',
  'It’s live.',
  'Got three calls off the site this week',
  'New photos are up.',
]

/**
 * The figures under the first screen. Each is read from the record that holds
 * it - the speed average from the portfolio, the rating from the standings -
 * and a figure whose record is empty is left out rather than shown as a zero.
 */
function figures() {
  const google = PUBLISHES_REVIEWS ? committedStanding('google') : null
  return [
    { value: String(MOBILE_SPEED), label: 'Average mobile speed score' },
    { value: '2–4 weeks', label: 'From first call to live' },
    { value: 'Same day', label: 'Changes, sent by text' },
    google?.rating && { value: google.rating.toFixed(1), label: 'Rating on Google' },
  ].filter(Boolean)
}

/**
 * The studio's home page, laid out after whatsapp.com's.
 *
 * One big rounded first screen with the offer, the way in and a client's live
 * site on a laptop and a phone; a centred statement with texts drifting round
 * it; the four figures; then wide alternating feature rows - fast, found on
 * Google, changed the same day - each beside a client site on a phone or the
 * thread it happened in, one of them on the darker slab; the recent work, the
 * three steps and what the monthly covers; the clients in their own words; the
 * newest articles sliding sideways on a tinted band; and the ask again.
 */
export default function HomeBoard() {
  const featured = clientSite(FEATURED)
  const fast = clientSite(FAST)
  const found = clientSite(FOUND)
  const reviews = clientReviews(REVIEWED)

  return (
    <>
      <PageIntro
        size="hero"
        title="Websites that bring in work."
        lead="I design, build and host fast websites for local businesses. Most go live in two to four weeks."
        media={featured && <DeviceShowcase project={featured} eager />}
      />

      <Statement bubbles={BUBBLES}>
        A fast website, a plan and a price in writing, and one person who answers when you call.
        That’s how local businesses around Baytown get found.
      </Statement>

      <Section tight className="!pt-0">
        <StatPanel items={figures()} />
      </Section>

      <FeatureRow
        title="Sites that load before they leave"
        body={`Every site is built by hand and measured on Google’s phone test. The average mobile score across the portfolio is ${MOBILE_SPEED}.`}
        link={{ to: '/speed-check', label: 'Check your speed' }}
        media={fast && <PhoneShot project={fast} score />}
      />

      <FeatureRow
        deep
        flip
        title="Found on Google"
        accent="Google"
        body="SEO, a Google Business Profile that matches the site, and ad tracking come with every build, so the calls you get can be traced back to where they came from."
        link={{ to: '/services', label: 'See what’s included' }}
        media={found && <PhoneShot project={found} />}
      />

      <FeatureRow
        title="Changes, the same day"
        body="Text me what needs to change. Hours, prices, a new photo: it’s live the same day, and the hosting, backups and updates are handled."
        link={{ to: '/process', label: 'How it works' }}
        media={
          <div className="mx-auto max-w-[460px]">
            <TextThread />
          </div>
        }
      />

      <Section label="Recent work">
        <SectionHead title="Recent work" link={{ to: '/portfolio', label: 'See all work' }} />
        <Grid cols={3}>
          {STRIP.map(host => {
            const project = clientSite(host)
            if (!project) return null
            return (
              <WorkCard
                key={host}
                project={project}
                to={workHref(project)}
                detail={`${tradeOf(project)} · ${townOf(project)}`}
              />
            )
          })}
        </Grid>
      </Section>

      <Section label="How it works">
        <SectionHead title="How it works" />
        <Steps items={STEPS} />
      </Section>

      <FeatureRow
        flip
        title="Everything after launch, one price"
        accent="one price"
        body="No surprise invoices. Hosting, backups, updates, search work and changes are one line on one bill."
        link={{ to: '/faq', label: 'Questions' }}
        media={
          <div className="mx-auto max-w-[460px]">
            <Monthly items={MONTHLY} />
          </div>
        }
      />

      {reviews.length > 0 && (
        <Section label="What clients say">
          <QuoteCycle reviews={reviews} aside={PUBLISHES_REVIEWS && <BbbAccredited />} />
        </Section>
      )}

      <CallToAction />

      <BlogCarousel last />
    </>
  )
}
