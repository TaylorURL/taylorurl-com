import { PenLine } from 'lucide-react'
import Mesh from '@components/mesh/Mesh'
import { meshLadder, meshSpans } from '@constants/mesh'
import BlockHead from './BlockHead'
import PortfolioPreview from '@components/mockups/PortfolioPreview'
import { GROUND } from '../lib/ground'

/** The answer a visitor gives when the design they want is not on the wall. */
export const SOMETHING_DIFFERENT = 'something-different'

/** The rungs the compact ladder the wall runs on names, narrowest first. */
const RUNGS = ['base', 'sm', 'lg', 'xl']

const CELL_FOCUS =
  'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2'

const CHECKED = 'bg-[color:var(--accent-fill)] peer-focus-visible:outline-[color:var(--on-accent)]'
const UNCHECKED = 'bg-paper hover:bg-[color:var(--wash-paper)] peer-focus-visible:outline-accent'

const NAME = 'text-[14px] font-medium leading-snug'
const META = 'section-label-sm'

/**
 * How the blank slate is arranged where it covers more than one column, and
 * how it returns to a column of its own beside that.
 *
 * The mark sits in a box locked to sixteen by ten, the same box a capture
 * fills, so the cell handed a whole row would draw one as tall as the row is
 * wide. It turns on its side instead: the mark takes a column of its own and
 * rules against the name rather than under it, which leaves the cell as tall
 * as the words in it however many columns it covers.
 */
const SIDE = {
  slate: { base: 'flex-row', sm: 'sm:flex-row', lg: 'lg:flex-row', xl: 'xl:flex-row' },
  frame: {
    base: 'aspect-auto w-28 border-b-0 border-r',
    sm: 'sm:aspect-auto sm:w-28 sm:border-b-0 sm:border-r',
    lg: 'lg:aspect-auto lg:w-28 lg:border-b-0 lg:border-r',
    xl: 'xl:aspect-auto xl:w-28 xl:border-b-0 xl:border-r',
  },
  body: {
    base: 'justify-center p-8',
    sm: 'sm:justify-center sm:p-8',
    lg: 'lg:justify-center lg:p-8',
    xl: 'xl:justify-center xl:p-8',
  },
}

const STACK = {
  slate: { base: 'flex-col', sm: 'sm:flex-col', lg: 'lg:flex-col', xl: 'xl:flex-col' },
  frame: {
    base: 'aspect-[16/10] w-full border-b border-r-0',
    sm: 'sm:aspect-[16/10] sm:w-full sm:border-b sm:border-r-0',
    lg: 'lg:aspect-[16/10] lg:w-full lg:border-b lg:border-r-0',
    xl: 'xl:aspect-[16/10] xl:w-full xl:border-b xl:border-r-0',
  },
  body: {
    base: 'justify-start p-5',
    sm: 'sm:justify-start sm:p-5',
    lg: 'lg:justify-start lg:p-5',
    xl: 'xl:justify-start xl:p-5',
  },
}

/**
 * The classes one part of the blank slate takes across the wall's rungs, from
 * the columns it covers at each.
 *
 * The narrowest width states its arrangement outright, since the wall already
 * runs two columns there and the slate can cover both, and every rung above it
 * is stated only where it changes, so a width the slate turns on its side
 * cannot carry that into the next.
 *
 * @param {Record<string, number>} spans Columns covered, keyed by breakpoint.
 * @param {'slate' | 'frame' | 'body'} part Which part of the cell.
 * @returns {string} The classes.
 */
function arrangement(spans, part) {
  const classes = []
  let sideBelow = null

  RUNGS.forEach(at => {
    if (!spans[at]) return
    const side = spans[at] > 1
    if (side !== sideBelow) classes.push(side ? SIDE[part][at] : STACK[part][at])
    sideBelow = side
  })

  return classes.join(' ')
}

/** One selectable design, drawn as the site it belongs to. */
function DesignCell({ value, checked, onToggle, cell, flow = 'flex-col', children }) {
  return (
    <label className={`relative flex cursor-pointer ${cell}`}>
      <input
        type="checkbox"
        name="designs"
        value={value}
        checked={checked}
        onChange={() => onToggle(value)}
        className="peer sr-only"
      />
      <span
        className={`${CELL_FOCUS} flex h-full w-full ${flow} transition duration-200 ease-out-soft ${
          checked ? CHECKED : UNCHECKED
        }`}
      >
        {children}
      </span>
    </label>
  )
}

/**
 * The design wall: every client site on it, the ones built for this trade
 * first, and the answer for a business that wants none of them.
 *
 * A visitor takes as many as they like, because what a set of designs has in
 * common carries a direction that one of them cannot. The controls are
 * checkboxes inside a fieldset named by the block's own heading, so the group
 * carries one name and the tab order runs over every design in it. The input
 * is taken out of the flow and the cell beside it takes the checked and
 * focused treatment, which keeps the hit area the whole card.
 *
 * The answer for a business that wants none of them closes the mesh as a cell
 * of its own, so it is counted with the rest when the columns are chosen and
 * the wall ends on a full row. Closing the row is what makes it the one cell
 * that can be handed several columns, and a mark in a box locked to sixteen by
 * ten drawn that wide is a mark in a box as tall as the row, so the wall's own
 * columns are read here and the slate turns on its side wherever it covers
 * more than one.
 *
 * @param {{ options: Array<object>, chosen: string[],
 *   onToggle: (value: string) => void }} props
 */
export default function DesignChoice({ options, chosen, onToggle }) {
  const cells = [...options, null]
  const columns = meshLadder(cells.length, 'compact')
  const slate = meshSpans(cells.length, columns)

  return (
    <fieldset aria-labelledby="design-head" className="m-0 border-0 p-0">
      <BlockHead id="design-head" label="Designs You Like" meta="Pick as many as you want" />
      <Mesh items={cells} ground="paper" columns={columns}>
        {(project, index, cell) => {
          const value = project ? project.url : SOMETHING_DIFFERENT
          const checked = chosen.includes(value)
          const name = project ? project.name : 'None of These'
          const meta = project ? project.town && `${project.town}, Texas` : 'Drawn From Scratch'

          return (
            <DesignCell
              key={value}
              value={value}
              checked={checked}
              onToggle={onToggle}
              cell={cell}
              flow={project ? undefined : arrangement(slate, 'slate')}
            >
              {project ? (
                <span
                  className={`bg-surface-1 block aspect-[16/10] w-full overflow-hidden border-b ${GROUND.rule}`}
                >
                  <PortfolioPreview project={project} />
                </span>
              ) : (
                <span
                  className={`flex items-center justify-center ${GROUND.rule} ${arrangement(slate, 'frame')}`}
                >
                  <PenLine
                    className={`h-7 w-7 ${checked ? 'text-[color:var(--on-accent)]' : 'text-accent'}`}
                    strokeWidth={1.25}
                    aria-hidden="true"
                  />
                </span>
              )}
              <span
                className={`flex flex-1 flex-col gap-2 ${project ? 'p-5' : arrangement(slate, 'body')}`}
              >
                <span
                  className={`${NAME} ${checked ? 'text-[color:var(--on-accent)]' : 'text-ink-paper'}`}
                >
                  {name}
                </span>
                {meta && (
                  <span
                    className={`${META} ${checked ? 'text-[color:var(--on-accent)] opacity-70' : 'text-paper-faint'}`}
                  >
                    {meta}
                  </span>
                )}
              </span>
            </DesignCell>
          )
        }}
      </Mesh>
    </fieldset>
  )
}
