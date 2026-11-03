import {
  CallToAction,
  Container,
  Grid,
  PageIntro,
  Section,
  SectionHead,
  SiteShot,
  WorkCard,
} from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'
import { committedStanding } from '@data/reputation/review-standings'
import { bbbAccredited } from '@data/reputation/bbb'
import { PUBLISHES_REVIEWS } from '../../../../../lib/site/current.js'
import { ProofRow, Quote, Reason } from './parts'
import {
  MOBILE_SPEED,
  MONTHLY,
  clientReview,
  clientSite,
  townOf,
  tradeOf,
  workHref,
} from './boardData'

const FEATURED = 'southeastarbor.com'
const STRIP = [
  'baytowngokarts.com',
  'dickinsonbayoufleeting.com',
  'impressivaprinting.com',
  'faded-barbershop.com',
]
const REVIEWED = 'djrxexcellence.com'

/**
 * The four facts under the opening screen. Each is read from the record that
 * holds it - the speed average from the portfolio, the rating and the
 * accreditation from the standings - and a fact whose record is empty is left
 * out rather than shown as a zero.
 */
function proof() {
  const google = PUBLISHES_REVIEWS ? committedStanding('google') : null
  return [
    { value: `${MOBILE_SPEED} / 100`, label: 'Average Google speed score on a phone' },
    PUBLISHES_REVIEWS && bbbAccredited() && { value: 'BBB', label: 'Accredited business' },
    google?.rating && { value: google.rating.toFixed(1), label: 'Rating on Google' },
    { value: 'Same day', label: 'Changes, sent by text' },
  ].filter(Boolean)
}

/**
 * What the monthly plan covers, as the sentence the third reason says. The
 * list is the board's own, so the home page and the plan cannot drift apart.
 */
const lowerFirst = line => line.charAt(0).toLowerCase() + line.slice(1)
const monthlyLine = `Covers ${MONTHLY.slice(0, -1).map(lowerFirst).join(', ')} and ${lowerFirst(MONTHLY.at(-1))}.`

/**
 * The studio's home page.
 *
 * Four things, in the order an owner skimming for ten seconds wants them: what
 * this is and how to ask (with a live client site beside it), four facts that
 * say it is any good, four sites already running, and three reasons with one
 * client in their own words. Then the ask again.
 *
 * It replaced a board of about ten boxes on one screen - speed rings, a text
 * thread, a phone mockup, a row of badges - which said all of this at once and
 * so said none of it first.
 */
export default function HomeBoard() {
  const featured = clientSite(FEATURED)
  const review = clientReview(REVIEWED)

  return (
    <>
      <PageIntro
        display
        eyebrow="Web design · Baytown, TX"
        title="Websites that bring in work."
        lead="I design, build and host websites for local businesses. Most are live in two to four weeks."
        note="Free to ask. You will usually hear back within the hour."
        aside={featured && <SiteShot project={featured} eager />}
        className="pb-8 sm:pb-10"
      />

      <Container>
        <ProofRow items={proof()} />
      </Container>

      <Section label="Recent work">
        <SectionHead title="Recent work" link={{ to: '/portfolio', label: 'See all work' }} />
        <Grid cols={4}>
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

      <Section tone="band" label="Why owners pick me">
        <h2 className={TYPE.h2}>Why owners pick me</h2>
        <div className="mt-8 grid gap-8 sm:mt-10 md:grid-cols-3 md:gap-12">
          <Reason title="Fast on every phone">
            Pages open in about a second. My client sites average {MOBILE_SPEED} out of 100 on
            Google’s speed test.
          </Reason>
          <Reason title="Changes the same day">
            Text me what needs to change. It is usually live that day, and your Google listing
            matches.
          </Reason>
          <Reason title="One monthly price">{monthlyLine}</Reason>
        </div>
        {review && (
          <Quote review={review} className="mt-10 border-t border-[var(--line)] pt-8 sm:mt-12" />
        )}
      </Section>

      <CallToAction />
    </>
  )
}
