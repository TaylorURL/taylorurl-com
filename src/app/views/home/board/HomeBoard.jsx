import {
  CallToAction,
  Grid,
  Masthead,
  Readouts,
  Section,
  SectionHead,
  TextLink,
  WorkCard,
} from '@components/kit/Kit'
import { committedStanding } from '@data/reputation/review-standings'
import { COMPANY_PHONE } from '@constants/navigation'
import { PUBLISHES_REVIEWS } from '../../../../../lib/site/current.js'
import { Monthly, Quote, Steps, TextThread } from './parts'
import {
  MOBILE_SPEED,
  MONTHLY,
  clientReview,
  clientSite,
  townOf,
  tradeOf,
  workHref,
} from './boardData'

// The three sites standing under the headline, live and measured. Chosen to be
// three different kinds of business, so a reader sees their own somewhere.
const WALL = ['southeastarbor.com', 'baytowngokarts.com', 'faded-barbershop.com']
const REVIEWED = 'djrxexcellence.com'

const STEPS = [
  {
    title: 'Tell me about the business',
    body: 'Call, text or send the form. Two minutes is enough.',
  },
  {
    title: 'Get a plan and a price',
    body: 'In writing, before any work starts. You pay nothing to ask.',
  },
  {
    title: 'Go live in two to four weeks',
    body: 'You see it come together, and nothing launches until you say so.',
  },
]

/**
 * The figures under the masthead. Each is read from the record that holds it -
 * the speed average from the portfolio, the rating from the standings - and a
 * figure whose record is empty is left out rather than shown as a zero.
 */
function figures() {
  const google = PUBLISHES_REVIEWS ? committedStanding('google') : null
  return [
    { value: String(MOBILE_SPEED), label: 'Average mobile speed score' },
    { value: '2–4', label: 'Weeks to go live' },
    { value: 'Same day', label: 'Changes, by text' },
    google?.rating && { value: google.rating.toFixed(1), label: 'Rating on Google' },
  ].filter(Boolean)
}

/**
 * The studio's home page.
 *
 * A night masthead with the point in very large type and three client sites
 * running under it, measured. Then the figures, the three steps, what working
 * together is like (a text answered the same morning, and one monthly price),
 * one client in their own words, and the ask again in signal blue.
 *
 * It replaced a board of about ten boxes on one screen, which said all of this
 * at once and so said none of it first.
 */
export default function HomeBoard() {
  const review = clientReview(REVIEWED)
  const wall = WALL.map(clientSite).filter(Boolean)

  return (
    <>
      <Masthead
        size="hero"
        kicker={`Web studio / Baytown, TX / Call or text ${COMPANY_PHONE}`}
        title="Websites that bring in work"
        lead="I design, build and host fast websites for local businesses around Houston. Most go live in two to four weeks."
        below={
          <>
            <Grid cols={3} className="gap-y-10">
              {wall.map((project, index) => (
                <WorkCard
                  key={project.displayUrl}
                  project={project}
                  to={workHref(project)}
                  detail={`${tradeOf(project)} / ${townOf(project)}`}
                  tone="night"
                  eager={index === 0}
                />
              ))}
            </Grid>
            <TextLink to="/portfolio" label="See all the work" className="mt-10" />
          </>
        }
      />

      <Readouts items={figures()} />

      <Section label="How it works">
        <SectionHead
          number="01"
          kicker="How it works"
          title="Three steps. No surprises."
          lead="You talk to the person who builds it, from the first call to launch day and every change after."
        />
        <Steps steps={STEPS} />
      </Section>

      <Section label="Working together">
        <SectionHead number="02" kicker="After launch" title="One person, on call." />
        <div className="grid gap-6 md:grid-cols-2">
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
