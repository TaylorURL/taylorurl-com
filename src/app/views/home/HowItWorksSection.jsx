import { useCallback, useState } from 'react'
import { HOW_IT_WORKS_STEPS } from '@data/pages/home'
import { HOME } from '@data/taylorwebsite/homeTaylorwebsite'
import { PORTFOLIO_PROJECTS, portfolioPreviewSrc } from '@data/portfolio'
import { AccentGradient } from '@reactbits/kit'
import PaletteShot from '@components/mockups/PaletteShot'
import Reveal from '@components/page-bands/Reveal'
import { IS_SECOND_SITE } from '../../../../lib/site/current.js'

/**
 * The three steps, each standing on the page it is describing.
 *
 * Three cards saying what happens is three claims, and this band made them
 * about the one part of the site a reader has to act on. So each step now
 * carries the thing itself: the enquiry form with its actual fields, the two
 * figures a price actually starts at, and a client's site as it draws today.
 * All three are pages a reader can open and check, which is the argument the
 * capability band above already makes and the reason it is the strongest band
 * on the page.
 *
 * The steps are set as columns of a schedule rather than as cards. A card draws
 * a box around a claim; a column divided by a rule draws one reading laid
 * beside another, which is what a sequence is. The rules are dashed because a
 * solid one at this length reads as a table's edge, and they run the full
 * height of the band so the eye is handed down a column and across to the next
 * rather than having to work the order out from the numerals.
 *
 * The artefacts stand at the foot of their columns on a lit plane, cut by it
 * rather than fitted inside it. A picture that fits inside its own padding
 * reads as a slide; one that runs out of frame reads as a view of something
 * that carries on past the page. It is the same plane the capability cards use,
 * which is what keeps the two bands one object rather than two designs.
 *
 * The second site draws the columns and no artefacts. It has no portfolio and
 * its pages are not these pages, and a band that showed the studio's form on
 * another company's site would be showing somebody else's business.
 */

/** The client whose live site closes the sequence. */
const LAUNCHED = 'hollingsheadharbor.com'

/**
 * A page of this site, in the palette the reader is already in.
 *
 * Both captures are committed twice, because the shot stands on a plane that
 * follows the light or dark setting and a light capture on a dark plane is a
 * white rectangle in the middle of a dark page. `npm run capture:process-shots`
 * is what regenerates them.
 */
function PageShot({ shot, alt }) {
  return (
    <PaletteShot
      base={`/home/${shot}`}
      narrow={760}
      alt={alt}
      width={1520}
      height={950}
      sizes="(min-width: 1024px) 460px, 92vw"
      className="plane-shot w-[118%] max-w-none"
    />
  )
}

/**
 * A client's own site, off the same capture the portfolio draws.
 *
 * A capture that does not arrive leaves the plane, because the browser's own
 * mark for a missing image is a torn page and a line of alt text set in the
 * middle of the strongest band on the home page. The step reads as a claim with
 * the thing itself behind it, or as a claim standing on its own; it must never
 * read as a claim whose picture is broken. The frames in `DevicePreview` settle
 * the same failure the same way, and this is the same capture at the same
 * address, so the two agree about what a lost one looks like.
 *
 * `complete` with no width is read at mount as well as caught on the event. An
 * image that finished before React attached its handlers fired into nothing,
 * and this page is prerendered, so the fetch starts while the markup is being
 * parsed and that race is lost often rather than rarely.
 */
function ClientShot({ project }) {
  const [lost, setLost] = useState(false)

  const readSettledImage = useCallback(node => {
    if (node && node.complete && node.naturalWidth === 0) setLost(true)
  }, [])

  if (lost) return null

  return (
    <img
      ref={readSettledImage}
      src={portfolioPreviewSrc(project, 'desktop')}
      alt={`The ${project.name} website, live`}
      width="1200"
      height="750"
      loading="lazy"
      decoding="async"
      onError={() => setLost(true)}
      className="plane-shot block w-[118%] max-w-none"
    />
  )
}

/**
 * What each step has to show, in the order the steps run.
 *
 * Held beside the steps rather than inside them because the words belong to
 * both sites and the artefacts belong to one, and because a picture is chosen
 * against what a step claims rather than written with it.
 */
function artefactFor(index, launched) {
  if (index === 0)
    return <PageShot shot="step-enquiry" alt="The enquiry form, with the fields it asks for" />
  if (index === 1) return <PageShot shot="step-plan" alt="The two figures a price starts from" />
  return launched ? <ClientShot project={launched} /> : null
}

/** One step, as a column of the schedule. */
function Step({ item, index, launched }) {
  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--r-control)] bg-[color:var(--wash-accent)] font-mono text-[13px] font-semibold leading-none text-accent">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="section-label-sm text-paper-faint">{item.stage}</span>
      </div>

      {/* The bar beside the title is the step's mark on the column, and it
            stops at the title: a rule down a paragraph reads as a pull quote,
            which is a different thing being said. */}
      <h3 className="display-6 mt-7 border-l-2 border-[color:var(--accent)] pl-4 font-semibold leading-[1.2] tracking-tight text-ink-paper [text-wrap:balance]">
        {item.title}
      </h3>
      <p className="mt-4 max-w-[42ch] text-[15px] leading-relaxed text-paper-soft">
        {item.description}
      </p>

      {IS_SECOND_SITE ? null : (
        <div className="panel-plane mt-9 px-6 pt-7 sm:px-7 sm:pt-8 lg:mt-auto">
          {artefactFor(index, launched)}
        </div>
      )}
    </li>
  )
}

export default function HowItWorksSection() {
  const launched = PORTFOLIO_PROJECTS.find(entry => entry.displayUrl === LAUNCHED)

  return (
    <section className="section-y-lg border-hair-paper relative overflow-hidden border-t bg-paper">
      <Reveal className="container-rail relative">
        <div className="border-hair-paper grid items-end gap-10 border-b pb-12 lg:grid-cols-[1.4fr_1fr]">
          {IS_SECOND_SITE ? (
            <>
              <div>
                <p className="section-label mb-5 text-accent">{HOME.how.eyebrow}</p>
                <h2 className="display-2 font-semibold leading-[1.02] tracking-tightest text-ink-paper [text-wrap:balance]">
                  {HOME.how.headingLine} <br />
                  <AccentGradient>{HOME.how.accentText}</AccentGradient>
                </h2>
              </div>
              <p className="max-w-md text-[16px] leading-relaxed text-paper-soft lg:text-right">
                {HOME.how.lede}
              </p>
            </>
          ) : (
            <>
              <div>
                <p className="section-label mb-5 text-accent">Process</p>
                <h2 className="display-2 font-semibold leading-[1.02] tracking-tightest text-ink-paper [text-wrap:balance]">
                  How it works <br />
                  <AccentGradient>in three steps.</AccentGradient>
                </h2>
              </div>
              <p className="max-w-md text-[16px] leading-relaxed text-paper-soft lg:text-right">
                First message to live website, usually two to four weeks. A small team to talk to,
                and we keep it online after that.
              </p>
            </>
          )}
        </div>

        <div className="relative mt-14">
          {/* The rules are drawn over the gutters rather than off the columns'
              own edges. Hung on the columns they would have to be paid for in
              padding, and a column that pays for a rule is narrower than the one
              that does not - which is invisible in the text and plain at the
              foot, where three shots of one aspect come out three heights. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden grid-cols-3 gap-x-12 lg:grid"
          >
            <div />
            <div className="border-hair-paper -ml-6 border-l border-dashed" />
            <div className="border-hair-paper -ml-6 border-l border-dashed" />
          </div>

          <ol className="grid gap-x-12 gap-y-14 lg:grid-cols-3 lg:gap-y-0">
            {HOW_IT_WORKS_STEPS.map((item, i) => (
              <Step key={item.step} item={item} index={i} launched={launched} />
            ))}
          </ol>
        </div>
      </Reveal>
    </section>
  )
}
