import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import Mesh from '@components/mesh/Mesh'
import { portfolioPreviewSrc, portfolioScreenshotServiceUrl } from '@data/portfolio'
import { GROUNDS } from '@constants/grounds'
import { meshLadder, meshSpans } from '@constants/mesh'

// The stage a capture fills, stated on the element as well as on its box so
// the space is held from the markup alone.
const PREVIEW_BOX = { width: 1280, height: 800 }

/**
 * How a card is arranged at a breakpoint where it covers more than one column,
 * and how it returns to a single column above that.
 *
 * A capture is locked to sixteen by ten, so a card handed a whole row would
 * draw one as tall as the row is wide. The card turns on its side instead: the
 * capture takes its height from the text beside it and rules against it rather
 * than under it.
 */
const SPLIT = {
  frame: {
    md: 'md:aspect-auto md:border-b-0 md:border-r',
    lg: 'lg:aspect-auto lg:border-b-0 lg:border-r',
  },
  body: { md: 'md:justify-center md:p-10', lg: 'lg:justify-center lg:p-10' },
  article: { md: 'md:grid-cols-[1.15fr_1fr]', lg: 'lg:grid-cols-[1.15fr_1fr]' },
}

const STACK = {
  frame: {
    md: 'md:aspect-[16/10] md:border-b md:border-r-0',
    lg: 'lg:aspect-[16/10] lg:border-b lg:border-r-0',
  },
  body: { md: 'md:justify-start md:p-6', lg: 'lg:justify-start lg:p-6' },
  article: { md: 'md:grid-cols-1', lg: 'lg:grid-cols-1' },
}

/**
 * The classes one part of a card takes across the breakpoints, from the columns
 * it covers at each. A phone runs one column, so the narrowest width is always
 * the stacked arrangement and only a change from it is stated.
 *
 * @param {Record<string, number>} spans Columns covered, keyed by breakpoint.
 * @param {'frame' | 'body' | 'article'} part Which part of the card.
 * @returns {string} The classes, or an empty string for a card that never
 *   covers more than its own column.
 */
function arrangement(spans, part) {
  const classes = []
  let splitBelow = false

  ;['md', 'lg'].forEach(at => {
    const split = (spans[at] || 1) > 1
    if (split !== splitBelow) classes.push(split ? SPLIT[part][at] : STACK[part][at])
    splitBelow = split
  })

  return classes.join(' ')
}

/**
 * A live client site, shown as the answer to whether this work exists. The
 * committed capture is the source; a site whose capture has not been taken
 * falls back to a server-rendered screenshot of the page itself, so the card
 * always shows the real thing.
 *
 * The card is the hover target and the capture is what answers it, which is
 * why both carry a class the stylesheet names: a pointer anywhere on the card
 * crops the picture a little tighter inside its frame, and the link at the
 * foot stays the one thing a keyboard lands on.
 */
function WorkCard({ project, tone, cell, spans, feature, headingTag }) {
  const Heading = headingTag
  const [useFallback, setUseFallback] = useState(false)
  const src = useFallback
    ? portfolioScreenshotServiceUrl(project, 'desktop')
    : portfolioPreviewSrc(project, 'desktop')

  return (
    <article className={`work-card grid ${tone.surface} ${cell} ${arrangement(spans, 'article')}`}>
      <div
        className={`bg-surface-1 aspect-[16/10] w-full overflow-hidden border-b ${tone.rule} ${arrangement(
          spans,
          'frame'
        )}`}
      >
        <img
          src={src}
          alt={`${project.name} website`}
          width={PREVIEW_BOX.width}
          height={PREVIEW_BOX.height}
          loading="lazy"
          decoding="async"
          onError={() => setUseFallback(true)}
          className="work-capture h-full w-full object-cover object-top transition-transform duration-200 ease-out-soft"
        />
      </div>
      <div
        className={`flex flex-col gap-4 p-6 ${feature ? 'justify-center sm:p-10' : ''} ${arrangement(
          spans,
          'body'
        )}`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="section-label text-accent">{project.tagline}</p>
          {project.town && <p className={`section-label-sm ${tone.meta}`}>{project.town}, Texas</p>}
        </div>
        <Heading
          className={`font-semibold leading-tight tracking-tight ${tone.title} ${
            feature ? 'display-5 tracking-tightest' : 'text-[19px]'
          }`}
        >
          {project.name}
        </Heading>
        <p
          className={`leading-relaxed ${tone.body} ${feature ? 'text-[15px] sm:text-[16px]' : 'text-[14px]'}`}
        >
          {project.description}
        </p>
        <a
          href={project.url}
          target="_blank"
          rel="noreferrer"
          className={`group mt-auto inline-flex min-h-[44px] items-center gap-2 self-start border-b pb-1 text-[14px] font-semibold transition duration-200 ease-out-soft hover:text-accent ${tone.ruleStrong} ${tone.title}`}
        >
          {project.displayUrl}
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </a>
      </div>
    </article>
  )
}

/**
 * Client sites laid out on a ruled mesh, each card carrying the town it was
 * built for where the work belongs to one place.
 *
 * One site takes the full width and turns on its side, so the strongest case
 * the page can make is also the largest thing on it. The card that closes a
 * short last row is given the same treatment at whatever widths it covers more
 * than one column, which is what keeps the mesh from ending on an empty box.
 *
 * @param {object} props
 * @param {Array<object>} props.projects - Entries from `@data/portfolio`.
 * @param {'paper' | 'dark' | 'band'} [props.ground] - Which ground the mesh sits on.
 * @param {'h3' | 'h4'} [props.headingTag] - Heading level for a card's name,
 *   set by whatever heading the surrounding band already carries.
 */
export default function WorkMesh({ projects, ground = 'paper', headingTag = 'h3' }) {
  const tone = GROUNDS[ground]
  const columns = meshLadder(projects.length, 'feature')
  const spans = meshSpans(projects.length, columns)
  const last = projects.length - 1

  return (
    <Mesh items={projects} ground={ground} columns={columns}>
      {(project, index, cell) => (
        <WorkCard
          key={project.url}
          project={project}
          tone={tone}
          cell={cell}
          spans={index === last ? spans : {}}
          feature={projects.length === 1}
          headingTag={headingTag}
        />
      )}
    </Mesh>
  )
}
