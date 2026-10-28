import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import ReviewStandingBadge from '@components/reviews/ReviewStandingBadge'
import useReviewStandings from '@hooks/reviews/useReviewStandings'
import { COMPANY_PHONE, COMPANY_PHONE_HREF } from '@constants/navigation'
import {
  ArrowLink,
  CallActions,
  Availability,
  Person,
  PhoneFrame,
  Quote,
  ScoreRing,
  SiteFrame,
  TextThread,
} from './parts'
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

/** What the primary key says on this page: the thing a reader gets, not the form. */
const START_LABEL = 'Get a plan and a price'

/**
 * The wide row's columns for however many ratings are showing, written out in
 * full so the stylesheet carries each one. A network whose rating is stale or
 * did not arrive is left out, and the rest share the row instead of leaving a
 * hole where it would have been.
 */
const WIDE_COLUMNS = {
  1: 'xl:grid-cols-1',
  2: 'xl:grid-cols-2',
  3: 'xl:grid-cols-3',
  4: 'xl:grid-cols-4',
}

/**
 * Every network the business is rated on, one badge to a column, directly
 * under the offer. The same standings the home page's reviews band draws, read
 * through the same hook, so a stale or empty rating is dropped here exactly as
 * it is dropped there. Laid out flat rather than in the band's carousel: four
 * badges fit the board's four columns, and a reader skimming should not have
 * to wait for the one that matters to glide past.
 */
function Standings() {
  const standings = useReviewStandings().filter(Boolean)
  if (standings.length === 0) return null
  return (
    <ul
      aria-label="Ratings on the listings this business is reviewed on"
      className={`grid gap-3 sm:col-span-2 sm:grid-cols-2 xl:col-span-4 xl:row-start-3 ${
        WIDE_COLUMNS[standings.length] ?? 'xl:grid-cols-4'
      }`}
    >
      {standings.map(standing => (
        <li key={standing.key} className="min-w-0">
          <ReviewStandingBadge standing={standing} />
        </li>
      ))}
    </ul>
  )
}

const TILE = 'rounded-[var(--r-feature)]'
const CARD = `${TILE} border-hair-paper border bg-[color:var(--paper-field)]`
const TITLE = 'text-[20px] font-semibold leading-[1.15] tracking-[-0.025em]'
const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]'

/**
 * The studio's home page. A board rather than a scroll, built for an owner who
 * gives the page ten seconds: what they get and how to ask for it, then the
 * proof in the order they doubt it - is it fast, who picks up, what clients
 * say, what happens after launch, what the monthly covers, what has been
 * built - and the ask again once they have seen it.
 *
 * Every figure is read off the portfolio and the review records, so the board
 * cannot quote a score or a count the site no longer holds.
 *
 * Layout. Four columns from `xl`, where the container stops growing and every
 * tile has the width its copy was set for; two columns from `sm`; one below.
 * The tiles are in the order a phone stacks them and the wide grid places them
 * by row and column, so a narrow screen reads the offer, the proof and the way
 * in, in that order. The first two rows are set at 300 so the board holds its
 * shape on the first screen, and the second may grow past that rather than let
 * the byline's two-line hours run out of its tile; the third grows with
 * whichever tile needs the room.
 *
 * Each tile that holds the number carries a `data-call-place`, which is how
 * `@components/chrome/Layout` attributes a tap on a `tel:` link, so a call can
 * be traced to the tile it came from.
 */
export default function HomeBoard() {
  const featured = clientSite(FEATURED)

  return (
    <div className="bg-paper text-ink-paper">
      <section
        aria-labelledby="glance-offer"
        className="container-rail pb-20 pt-24 sm:pb-28 sm:pt-28"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:grid-rows-[300px_minmax(300px,auto)_auto_minmax(300px,auto)]">
          <div
            data-call-place="home-offer"
            className={`${TILE} flex flex-col justify-between gap-12 bg-[color:var(--accent-fill)] p-7 text-[color:var(--on-accent)] sm:col-span-2 sm:p-10 xl:col-start-1 xl:row-span-2 xl:row-start-1`}
          >
            <p className="font-mono text-[11px] uppercase leading-none tracking-[0.08em]">
              Web design / Baytown, TX
            </p>
            <div>
              <h1
                id="glance-offer"
                className="max-w-[11ch] text-[clamp(2.75rem,5vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.05em]"
              >
                Websites that bring in work.
              </h1>
              <p className="mt-5 max-w-[40ch] text-[17px] leading-[1.55]">
                I design, write and build each one from scratch for local businesses, then host it
                and keep it fast. Most are live in{' '}
                <span className="whitespace-nowrap">two to four weeks.</span>
              </p>
              <CallActions
                className="mt-8"
                startLabel={START_LABEL}
                startClass="btn-secondary-paper focus-visible:outline-[color:var(--on-accent)]"
                phoneClass="bg-[color:var(--paper-ink)] text-[color:var(--paper)] hover:opacity-90 focus-visible:outline-[color:var(--on-accent)]"
              />
              <p className="mt-4 text-[14px] leading-snug">
                Free to ask. You’ll usually hear back within the hour.
              </p>
            </div>
          </div>

          <section
            aria-labelledby="glance-speed"
            className={`${CARD} flex flex-col justify-between gap-5 p-6 sm:p-7 xl:col-start-4 xl:row-start-1`}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="glance-speed" className={`${TITLE} max-w-[9ch]`}>
                Fast on every phone
              </h2>
              <ScoreRing score={MOBILE_SPEED} size={84} />
            </div>
            <p className="text-[14px] leading-snug text-paper-soft">
              Average Google PageSpeed score across my client sites, out of 100.
            </p>
          </section>

          <section
            aria-labelledby="glance-call"
            data-call-place="home-byline"
            className={`${CARD} flex flex-col justify-between gap-4 p-6 xl:col-start-4 xl:row-start-2`}
          >
            <Person size={64} stacked eager />
            <div>
              <h2 id="glance-call" className="sr-only">
                Call or text
              </h2>
              <a
                href={COMPANY_PHONE_HREF}
                className={`inline-block rounded-[var(--r-control)] text-[26px] font-semibold tabular-nums tracking-[-0.03em] transition-colors hover:text-[color:var(--accent-loud)] ${FOCUS}`}
              >
                {COMPANY_PHONE}
              </a>
              <p className="text-paper-faint mt-1 text-[14px]">Call or text.</p>
              <Availability className="mt-3" />
            </div>
          </section>

          <Link
            to={workHref(featured)}
            className={`${TILE} bg-surface-2 group flex h-[440px] flex-col items-center gap-5 overflow-hidden px-6 pt-6 text-center sm:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:h-auto ${FOCUS}`}
          >
            <span>
              <span className="text-paper-faint block font-mono text-[11px]">
                {featured.displayUrl}
              </span>
              <span className="mt-1 block text-[15px] font-medium">{featured.name}</span>
              <span className="text-paper-faint mt-0.5 block text-[13px]">
                {tradeOf(featured)}, {townOf(featured)}
              </span>
            </span>
            <PhoneFrame
              project={featured}
              eager
              className="w-[220px] flex-shrink-0 transition-transform duration-300 ease-out-soft group-hover:-translate-y-1"
            />
          </Link>

          <Standings />

          <section
            id="testimonials"
            aria-labelledby="glance-reviews"
            className={`${CARD} flex min-w-0 flex-col justify-center p-6 sm:col-span-2 sm:p-9 xl:col-start-1 xl:row-start-4`}
          >
            <h2 id="glance-reviews" className="sr-only">
              What clients say
            </h2>
            <Quote review={clientReview(REVIEWED)} size="text-[22px] sm:text-[26px]" />
          </section>

          <section
            aria-labelledby="glance-changes"
            className={`${CARD} flex flex-col gap-5 p-5 sm:p-6 xl:col-start-3 xl:row-start-4`}
          >
            <h2 id="glance-changes" className={TITLE}>
              Changes, same day
            </h2>
            <TextThread />
          </section>

          <section
            aria-labelledby="glance-monthly"
            className={`panel-plane ${TILE} p-6 sm:p-7 xl:col-start-4 xl:row-start-4`}
          >
            <h2 id="glance-monthly" className={`${TITLE} text-[color:var(--plane-ink)]`}>
              One monthly covers it
            </h2>
            <ul className="mt-5 flex flex-col gap-3">
              {MONTHLY.map(item => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[15px] leading-snug text-[color:var(--plane-ink)]"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="glance-work"
            className={`${CARD} p-6 sm:col-span-2 sm:p-9 xl:col-span-4`}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="glance-work" className={TITLE}>
                My work
              </h2>
              <ArrowLink to="/portfolio" className="flex-shrink-0">
                See them all
              </ArrowLink>
            </div>
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
              {STRIP.map(host => {
                const project = clientSite(host)
                return (
                  <li key={host}>
                    <Link
                      to={workHref(project)}
                      className={`group block rounded-[var(--r-card)] ${FOCUS}`}
                    >
                      <SiteFrame
                        project={project}
                        className="transition-transform duration-300 ease-out-soft group-hover:-translate-y-1"
                      />
                      <span className="mt-3 block truncate text-[14px] font-medium">
                        {project.name}
                      </span>
                      <span className="text-paper-faint mt-0.5 block truncate text-[13px]">
                        {tradeOf(project)}, {townOf(project)}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>

          <section
            aria-labelledby="glance-start"
            data-call-place="home-closing"
            className={`panel-plane ${TILE} flex flex-col gap-7 p-7 sm:col-span-2 sm:p-10 lg:flex-row lg:items-center lg:justify-between xl:col-span-4`}
          >
            <div>
              <h2
                id="glance-start"
                className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-[color:var(--plane-ink)]"
              >
                Tell me about the business.
              </h2>
              <p className="mt-3 max-w-[48ch] text-[16px] leading-[1.55] text-[color:var(--plane-ink-soft)]">
                You’ll get a plan and a price in writing before any work starts.
              </p>
            </div>
            <div className="flex flex-col gap-4 lg:items-end">
              <CallActions startLabel={START_LABEL} />
              <Availability />
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}
