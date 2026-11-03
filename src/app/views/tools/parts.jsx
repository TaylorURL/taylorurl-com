import { CheckList, Container, Section } from '@components/kit/Kit'
import { TYPE } from '@components/kit/styles'

/*
 * The pieces every free tool's page is built from, in the kit's "Refined" look:
 * a short heading over the tool itself, the tool in a card, what it found under
 * it, and a few plain notes at the foot.
 */

/**
 * The first screen of a tool: a short headline, one sentence, and the
 * tool straight under them in the same glow, so the box to type in is on the
 * first screen rather than a scroll away.
 *
 * @param {object} props
 * @param {string} props.title - The headline, a short sentence.
 * @param {string} [props.lead] - The sentence under it.
 * @param {boolean} [props.narrow] - Holds the card to a reading width, for a
 *   tool that asks for an address or two rather than laying out a workbench.
 * @param {import('react').ReactNode} props.children - The tool's card, and
 *   whatever stands under it before the page moves on.
 */
export function ToolHero({ title, lead, narrow = false, children }) {
  return (
    <section className="glow pb-14 pt-10 sm:pb-20 sm:pt-16">
      <Container>
        <div className="max-w-[640px]">
          <h1 className={TYPE.display}>{title}</h1>
          {lead && <p className={`${TYPE.lead} mt-5 max-w-[34rem]`}>{lead}</p>}
        </div>
        <div className={`mt-10 space-y-10 sm:mt-12 ${narrow ? 'max-w-[760px]' : ''}`}>
          {children}
        </div>
      </Container>
    </section>
  )
}

/**
 * A tool that makes something: its controls in the wider column, and beside
 * them the thing they are making, held in view on a wide screen while the
 * controls scroll past it.
 *
 * On a phone the thing being made comes straight after the one control that
 * has to be answered, and the optional ones follow it, so the result is on the
 * screen as soon as there is one rather than under every setting there is.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.first - The control that has to be
 *   answered before there is anything to show.
 * @param {import('react').ReactNode} props.preview - The thing being made.
 * @param {import('react').ReactNode} props.children - The rest of the
 *   controls, stacked in the order they are used.
 */
export function ToolStep({ first, preview, children }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-14">
      <div className="min-w-0 space-y-8 lg:col-start-1">{first}</div>
      <div className="min-w-0 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        {preview}
      </div>
      <div className="min-w-0 space-y-8 lg:col-start-1">{children}</div>
    </div>
  )
}

/**
 * The few things worth knowing before the file is used, as a ticked list at
 * the foot of the tool.
 *
 * @param {{ title: string, items: Array<{ title: string, body?: string }> }} props
 */
export function ToolNotes({ title, items }) {
  return (
    <Section tight label={title} className="!pt-0">
      <h2 className={TYPE.h3}>{title}</h2>
      <CheckList items={items} className="mt-6 max-w-[720px]" />
    </Section>
  )
}

/**
 * A ring drawn to a score out of a hundred, in the colour of the band Google
 * files it under. A score that did not come back is an empty track.
 *
 * @param {object} props
 * @param {number | null} props.score - The score, or nothing.
 * @param {string} props.stroke - The band's colour.
 * @param {number} [props.size] - Its width and height, in pixels.
 * @param {number} [props.width] - The width of the ring.
 */
export function ScoreRing({ score, stroke, size = 34, width = 3 }) {
  const radius = (size - width - 1) / 2
  const length = 2 * Math.PI * radius
  const share = typeof score === 'number' ? Math.max(0, Math.min(score, 100)) / 100 : 0
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="shrink-0 -rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(244,243,238,0.12)"
        strokeWidth={width}
      />
      {share > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - share)}
        />
      )}
    </svg>
  )
}
