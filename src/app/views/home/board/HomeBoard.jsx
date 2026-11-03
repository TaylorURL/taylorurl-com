import {
  CallToAction,
  DeviceShowcase,
  Grid,
  PageIntro,
  Section,
  SectionHead,
  StatPanel,
  Steps,
  WorkCard,
} from '@components/kit/Kit'
import { committedStanding } from '@data/reputation/review-standings'
import { PUBLISHES_REVIEWS } from '../../../../../lib/site/current.js'
import { Monthly, Quote, TextThread } from './parts'
import {
  MOBILE_SPEED,
  MONTHLY,
  clientReview,
  clientSite,
  townOf,
  tradeOf,
  workHref,
} from './boardData'

const FEATURED = 'baytowngokarts.com'
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
 * The studio's home page.
 *
 * The point and the way to ask on the first screen, beside one client's live
 * site on a laptop and a phone with the speed it was measured at. Then four
 * figures, three more sites, the three steps, what working together is like,
 * one client in their own words, and the ask again.
 *
 * It replaced a board of about ten boxes on one screen, which said all of this
 * at once and so said none of it first.
 */
export default function HomeBoard() {
  const featured = clientSite(FEATURED)
  const review = clientReview(REVIEWED)

  return (
    <>
      <PageIntro
        size="hero"
        title="Websites that bring in work."
        lead="I design, build and host fast websites for local businesses. Most go live in two to four weeks."
        media={featured && <DeviceShowcase project={featured} eager />}
      />

      <Section tight className="!pt-0">
        <StatPanel items={figures()} />
      </Section>

      <Section label="Recent work" className="!pt-6">
        <SectionHead title="Recent work" link={{ to: '/portfolio', label: 'See All Work' }} />
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

      <Section label="After launch">
        <div className="grid gap-5 md:grid-cols-2">
          <TextThread />
          <Monthly items={MONTHLY} />
        </div>
      </Section>

      {review && (
        <Section label="What a client says">
          <Quote review={review} />
        </Section>
      )}

      <CallToAction />
    </>
  )
}
