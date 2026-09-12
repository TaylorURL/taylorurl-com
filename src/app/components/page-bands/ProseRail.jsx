import { Link } from 'react-router-dom'
import { m } from 'framer-motion'
import { staggerChild } from '@constants/animations'
import { GROUNDS } from '@constants/grounds'

// The measure the paragraphs are set to. Held in characters rather than pixels
// so it tracks the type size, and set below the rail's full width because the
// band's own header is the widest line on the page and prose under it reads
// worse at that length than at sixty-odd characters.
const MEASURE = 'max-w-[64ch]'

/**
 * A band set as prose with a rail of place names beside it: paragraphs in a
 * measured column, and the towns and neighborhoods the page also covers listed
 * against a hairline on the right.
 *
 * This is the case against setting the same content as headed cells. A grid of
 * four bolded headings, each with a paragraph under it, is the shape a reader
 * now recognizes as generated copy, and the shape pushes the writing into it:
 * every cell needs a heading, so every heading becomes an epigram, and four of
 * those to a town across thirteen towns reads as one template rather than as
 * anything anybody knew. Prose has no such slot to fill.
 *
 * The rail is pushed to the far edge of the container rather than set against
 * the prose, so its right edge lands under the band's own meta and the spread
 * reads as a margin note on a page rather than as a second column. Below the
 * wide breakpoint it stacks under the prose and takes its hairline on top
 * instead of on its side, so the two never sit as narrow columns side by side.
 *
 * @param {object} props
 * A place carrying a `to` is drawn as a link, because most of these lists name
 * towns with pages of their own and a reader looking down the rail for their
 * own town has nowhere to go otherwise. The band does not work out which ones
 * those are: it is handed them.
 *
 * @param {Array<string>} props.body - The paragraphs, in reading order.
 * @param {Array<{ name: string, to?: string }>} [props.nearby] - Places the
 *   page also covers, each linked where it has a page. Left out or empty, the
 *   prose runs on its own and the rail is not drawn.
 * @param {string} [props.nearbyLabel] - The rail's standing label.
 * @param {'paper' | 'sheet' | 'dark' | 'band'} [props.ground] - Which ground
 *   the band stands on, which is where the two weights of ink come from.
 */
export default function ProseRail({
  body,
  nearby = [],
  nearbyLabel = 'Also Covered',
  ground = 'paper',
}) {
  const tone = GROUNDS[ground]
  const hasRail = nearby.length > 0

  return (
    <div
      className={`flex flex-col gap-10 ${hasRail ? 'lg:flex-row lg:items-start lg:gap-20' : ''}`}
    >
      <div className={`flex flex-col gap-6 ${MEASURE} ${hasRail ? 'lg:flex-1' : ''}`}>
        {body.map((paragraph, index) => (
          <m.p
            key={paragraph.slice(0, 40)}
            {...staggerChild(index)}
            className={`text-[17px] leading-relaxed ${tone.body}`}
          >
            {paragraph}
          </m.p>
        ))}
      </div>

      {hasRail && (
        <m.aside
          {...staggerChild(body.length)}
          className={`shrink-0 border-t pt-6 lg:ml-auto lg:w-56 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1 ${tone.rule}`}
        >
          <p className={`section-label-sm ${tone.meta}`}>{nearbyLabel}</p>
          <ul role="list" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 lg:flex-col lg:gap-2">
            {nearby.map(place => (
              <li key={place.name} className={`text-[15px] leading-snug ${tone.title}`}>
                {place.to ? (
                  <Link
                    to={place.to}
                    className="underline decoration-1 underline-offset-4 transition-colors duration-200 hover:text-accent"
                  >
                    {place.name}
                  </Link>
                ) : (
                  place.name
                )}
              </li>
            ))}
          </ul>
        </m.aside>
      )}
    </div>
  )
}
