import { useCallback, useState } from 'react'
import { m } from 'framer-motion'
import { fadeInUp } from '@constants/animations'
import { useScrollSwell } from '@hooks/scroll/useScrollSwell'
import {
  PORTFOLIO_AVERAGES,
  PORTFOLIO_PROJECTS,
  formatMeasuredDate,
  portfolioPreviewSrc,
} from '@data/portfolio'
import { PROCESS_TIMELINE } from '@data/pages/home'
import PaletteShot from '@components/mockups/PaletteShot'
import { Card, Foot, Plane } from './CapabilityCard'

/**
 * What the studio does, shown rather than described.
 *
 * A list of services is a list of claims, and every studio's list says the same
 * four things. So each card carries the actual artefact: a client's site as it
 * draws on a phone and on a desktop, a score taken from Google's own report
 * with the day it was taken, and the board that watches those sites after they
 * launch. A reader can click through to any of it.
 *
 * Nothing on these cards is a figure written for the page. The scores come from
 * the committed portfolio entry with the day they were measured, and the
 * pictures are the captures the portfolio itself renders.
 */

/** The client whose site the first card shows, and the one the score comes from. */
const SHOWN = 'baytowngokarts.com'
const MEASURED = 'djrxexcellence.com'

const projectFor = displayUrl => PORTFOLIO_PROJECTS.find(entry => entry.displayUrl === displayUrl)

/**
 * One committed capture on the plane.
 *
 * A capture that does not arrive leaves the plane, because the browser's own
 * mark for a missing image is a torn page and a line of alt text, and these two
 * sit in the middle of the first card under a heading that says every site on
 * the page is live. A claim can stand on its own; it must never stand beside a
 * broken picture of itself. The frames in `DevicePreview` and the step in
 * `HowItWorksSection` settle the same failure the same way, and all three draw
 * the same captures at the same addresses, so the three agree about what a lost
 * one looks like.
 *
 * The two shots are held separately rather than together, so one that is lost
 * takes only itself off the plane.
 *
 * `complete` with no width is read at mount as well as caught on the event. An
 * image that finished before React attached its handlers fired into nothing,
 * and this page is prerendered, so the fetch starts while the markup is being
 * parsed and that race is lost often rather than rarely.
 */
function CaptureShot({ project, device, width, height, className }) {
  const [lost, setLost] = useState(false)

  const readSettledImage = useCallback(node => {
    if (node && node.complete && node.naturalWidth === 0) setLost(true)
  }, [])

  if (lost) return null

  return (
    <img
      ref={readSettledImage}
      src={portfolioPreviewSrc(project, device)}
      alt={`The ${project.name} website on a ${device === 'phone' ? 'phone' : 'desktop'}`}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onError={() => setLost(true)}
      className={className}
    />
  )
}

/**
 * The client's own site on the plane, in the two shapes it has to work in.
 *
 * The desktop capture is laid out wider than the card and pushed off the right
 * edge, so the plane cuts it: the reader sees a website continuing past the
 * frame rather than a screenshot centred in a margin. The phone stands in front
 * of it at its own height, which is what makes the pair read as two objects on
 * one surface instead of two pictures on one background.
 */
function SitePreview({ project }) {
  return (
    <Plane className="px-8 pt-10 sm:px-10 sm:pt-12">
      <div className="relative ml-[22%] sm:ml-[26%]">
        <CaptureShot
          project={project}
          device="desktop"
          width="1200"
          height="750"
          className="plane-shot block w-[150%] max-w-none sm:w-[135%]"
        />
        <CaptureShot
          project={project}
          device="phone"
          width="390"
          height="844"
          className="plane-shot-near absolute -left-[18%] bottom-[-2.5rem] w-[26%] sm:-left-[20%] sm:w-[24%]"
        />
      </div>
    </Plane>
  )
}

/**
 * One measured score, in the shape the report gives it.
 *
 * The figures stand on their own paper inset into the plane rather than being
 * set directly on it, because a number is read rather than looked at and
 * saturated colour behind small type costs more than it pays.
 *
 * Both numbers and the date are read off the committed portfolio entry, so the
 * card cannot drift from what the site actually scored.
 */
function Score({ project }) {
  const rows = [
    { label: 'Mobile', value: project.pagespeed.mobile },
    { label: 'Desktop', value: project.pagespeed.desktop },
  ]
  return (
    <Plane className="p-8 sm:p-10">
      <div className="plane-inset p-6 sm:p-7">
        <p className="text-[13px] font-medium text-paper-soft">{project.name}</p>
        <dl className="mt-5 grid grid-cols-2 gap-6">
          {rows.map(row => (
            <div key={row.label}>
              <dt className="text-paper-faint text-[13px]">{row.label}</dt>
              <dd className="display-3 mt-1 font-mono tabular-nums leading-none tracking-tight text-ink-paper">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-5 text-[13px] leading-relaxed text-[color:var(--plane-ink-soft)]">
        Google PageSpeed, {formatMeasuredDate(project.pagespeed.measured)}. You can run it on any of
        these sites yourself.
      </p>
    </Plane>
  )
}

/**
 * The board itself, in the palette the reader is already in.
 *
 * The shot is a capture of a real page rather than a drawing of one, so it
 * carries the ground it was taken on. Both palettes are captured, and the card
 * shows the one matching the setting, which is what keeps a white rectangle
 * from standing in the middle of a dark page.
 *
 * The card never gives the shot more than a few hundred points of width, so the
 * full capture is worth its weight only to a screen dense enough to spend them:
 * every other screen takes the narrow cut, which is a third of the bytes for a
 * picture nobody can tell apart from the wide one.
 */
function StatusBoardShot() {
  return (
    <Plane className="px-8 pt-10 sm:px-10 sm:pt-12">
      <PaletteShot
        base="/home/status-board"
        narrow={768}
        alt="The status board, showing every site under care and its uptime"
        width={1200}
        height={750}
        sizes="(min-width: 640px) 384px, 92vw"
        className="plane-shot w-[128%] max-w-none"
      />
    </Plane>
  )
}

/**
 * The six steps, drawn on the plane as type rather than as a picture of type.
 *
 * A capture would carry its own white ground into a dark page and would be
 * unreadable to anything that reads text, so the steps are set in markup: an
 * ordered list, ruled into columns at the width where six fit and stacked
 * below it, taking the plane's own ink in whichever palette the reader chose.
 *
 * The gap-px grid over a hairline ground is what draws the rules, so the same
 * markup rules vertically in a row and horizontally in a stack without a
 * second set of borders to keep in agreement.
 */
function ProcessTimeline() {
  return (
    <ol className="plane-inset grid grid-cols-1 gap-px overflow-hidden bg-[color:var(--plane-hairline)] sm:grid-cols-3 lg:grid-cols-6">
      {PROCESS_TIMELINE.map(step => (
        <li
          key={step.step}
          className="flex flex-col gap-3 bg-[color:var(--paper-field)] p-5 sm:p-6"
        >
          <span className="font-mono text-[13px] font-semibold leading-none text-accent">
            {step.step}
          </span>
          <span className="h-1.5 w-1.5 bg-accent" aria-hidden="true" />
          <span className="text-[15px] font-semibold leading-snug tracking-tight text-[color:var(--plane-ink)] [text-wrap:balance]">
            {step.title}
          </span>
          <span className="mt-auto font-mono text-[12px] leading-none text-[color:var(--plane-ink-soft)]">
            {step.duration}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default function CapabilitiesSection() {
  const shown = projectFor(SHOWN)
  const measured = projectFor(MEASURED)
  // Set narrower than the rail, so it grows off its own left edge rather than
  // out of the line the card grid below it is set to.
  const heading = useScrollSwell({ origin: 'left' })

  return (
    <section className="section-y-lg border-hair-paper relative overflow-hidden border-t bg-paper">
      <div className="container-rail relative">
        <m.div {...fadeInUp}>
          <m.h2
            ref={heading.ref}
            style={heading.style}
            className="display-3 max-w-[20ch] font-semibold leading-[1.06] tracking-tightest text-ink-paper [text-wrap:balance]"
          >
            Every site on this page is live.{' '}
            <span className="text-paper-soft">
              Built for a business nearby, and we still look after every one of them.
            </span>
          </m.h2>
        </m.div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {shown ? (
            <Card
              index={0}
              wide
              to="/portfolio"
              cta="See the Work"
              title="Built for the phone first"
              blurb="Most people find you on a phone. If the site fights them there, they leave. Yours is built for that screen first, then opened up for a desktop."
            >
              <SitePreview project={shown} />
            </Card>
          ) : null}

          {/* The label is an instruction, so it goes where the instruction can
              be carried out. It used to open the SEO service page, which
              explains the report rather than running one: the reader who came
              to see their own score arrived at a page about the studio. */}
          {measured?.pagespeed ? (
            <Card
              index={1}
              to="/speed-check"
              cta="Run the Report"
              title="Scores you can check yourself"
              blurb={`Google grades every site on four things, and the report is free. The client sites average ${PORTFOLIO_AVERAGES.mobile} on mobile and ${PORTFOLIO_AVERAGES.desktop} on desktop.`}
            >
              <Score project={measured} />
            </Card>
          ) : null}

          <Card
            index={2}
            to="/console/status"
            cta="Open the Board"
            title="Watched after launch"
            blurb="Every site we look after reports its uptime and its errors to a page anyone can open. When something breaks, we know before you call."
          >
            <StatusBoardShot />
          </Card>

          <Card
            index={3}
            wide
            to="/process"
            cta="See the Process"
            title="A small team, start to finish"
            blurb="You talk to whoever is building it. No account manager in between, and the same people answering after launch as before it."
          >
            <Foot className="p-8 sm:p-10">
              <p className="max-w-[52ch] text-[15px] leading-relaxed text-paper-soft">
                Six steps from your first message to launch day, and you see the site at every one
                of them.
              </p>
            </Foot>
            <Plane className="px-8 pb-10 pt-10 sm:px-10 sm:pb-12 sm:pt-12">
              <ProcessTimeline />
            </Plane>
          </Card>
        </div>
      </div>
    </section>
  )
}
