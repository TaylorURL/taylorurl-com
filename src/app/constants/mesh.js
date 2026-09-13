/**
 * How a ruled mesh divides, and what its last cell spans so the final row ends
 * flush.
 *
 * A mesh cell draws its own top and left rule, so an item count that does not
 * divide by the column count leaves the shortfall drawn as empty boxes rather
 * than as space. Two answers close it, and a mesh takes whichever fits: the
 * columns are chosen from the item count wherever a divisor sits near the
 * density the cells want, and the last cell absorbs the remainder wherever none
 * does.
 *
 * Every column and span class is written out. The stylesheet is built by
 * reading these files, and a name assembled at runtime is a name it never sees.
 */

/** The breakpoints a ladder names, narrowest first. */
const BREAKPOINTS = ['base', 'sm', 'md', 'lg', 'xl']

/** The widest a mesh runs, and the widest a cell spans. */
const WIDEST = 6

const COLUMN_CLASS = {
  base: {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  },
  sm: {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
    5: 'sm:grid-cols-5',
    6: 'sm:grid-cols-6',
  },
  md: {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5',
    6: 'md:grid-cols-6',
  },
  lg: {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
    6: 'lg:grid-cols-6',
  },
  xl: {
    1: 'xl:grid-cols-1',
    2: 'xl:grid-cols-2',
    3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-4',
    5: 'xl:grid-cols-5',
    6: 'xl:grid-cols-6',
  },
}

const SPAN_CLASS = {
  base: {
    1: 'col-span-1',
    2: 'col-span-2',
    3: 'col-span-3',
    4: 'col-span-4',
    5: 'col-span-5',
    6: 'col-span-6',
  },
  sm: {
    1: 'sm:col-span-1',
    2: 'sm:col-span-2',
    3: 'sm:col-span-3',
    4: 'sm:col-span-4',
    5: 'sm:col-span-5',
    6: 'sm:col-span-6',
  },
  md: {
    1: 'md:col-span-1',
    2: 'md:col-span-2',
    3: 'md:col-span-3',
    4: 'md:col-span-4',
    5: 'md:col-span-5',
    6: 'md:col-span-6',
  },
  lg: {
    1: 'lg:col-span-1',
    2: 'lg:col-span-2',
    3: 'lg:col-span-3',
    4: 'lg:col-span-4',
    5: 'lg:col-span-5',
    6: 'lg:col-span-6',
  },
  xl: {
    1: 'xl:col-span-1',
    2: 'xl:col-span-2',
    3: 'xl:col-span-3',
    4: 'xl:col-span-4',
    5: 'xl:col-span-5',
    6: 'xl:col-span-6',
  },
}

/**
 * The column ladders, by how much room a cell needs.
 *
 * - `compact` A mark and a short label: trades, tools, thumbnails.
 * - `card`    A heading and a line or two of prose.
 * - `feature` A capture and a paragraph beside it.
 *
 * `cols` is the count a rung runs at, and `upto` the widest it takes in
 * exchange for dividing the items exactly.
 */
const MESH_SCALES = {
  compact: [
    { at: 'base', cols: 2, upto: 2 },
    { at: 'sm', cols: 3, upto: 3 },
    { at: 'lg', cols: 4, upto: 5 },
    { at: 'xl', cols: 6, upto: 6 },
  ],
  card: [
    { at: 'base', cols: 1, upto: 1 },
    { at: 'sm', cols: 2, upto: 2 },
    { at: 'lg', cols: 3, upto: 4 },
  ],
  feature: [
    { at: 'base', cols: 1, upto: 1 },
    { at: 'md', cols: 2, upto: 2 },
    { at: 'lg', cols: 3, upto: 4 },
  ],
}

/**
 * The columns a mesh of `count` items runs at, chosen from the count itself.
 *
 * The narrowest rung runs at the scale's own count, since a phone holds
 * whatever the cell needs and nothing wider. Every rung above it takes the
 * widest count that divides the items exactly, sits between the rung below and
 * that rung's ceiling, and is at least two; where none does, the scale's count
 * stands and the last cell closes the row.
 *
 * @param {number} count How many items the mesh holds.
 * @param {'compact' | 'card' | 'feature'} [scale] How much room a cell needs.
 * @returns {Record<string, number>} Columns keyed by breakpoint.
 */
export function meshLadder(count, scale = 'compact') {
  const rungs = MESH_SCALES[scale] || MESH_SCALES.compact
  const ladder = {}
  let below = 0

  rungs.forEach(({ at, cols, upto }, index) => {
    let chosen = cols

    if (index > 0) {
      const floor = Math.max(below, 2)
      for (let option = upto; option >= floor; option -= 1) {
        if (count % option === 0) {
          chosen = option
          break
        }
      }
      if (chosen < below) chosen = below
    }

    ladder[at] = chosen
    below = chosen
  })

  return ladder
}

/**
 * How many columns the last cell covers at each breakpoint of a ladder, which
 * is one plus whatever the final row is short.
 *
 * A cell wide enough to hold a whole row is a cell whose own contents may need
 * arranging differently, so the widths are readable rather than only being
 * turned into classes.
 *
 * @param {number} count How many items the mesh holds.
 * @param {Record<string, number>} ladder Columns keyed by breakpoint.
 * @returns {Record<string, number>} Spans keyed by breakpoint.
 */
export function meshSpans(count, ladder) {
  const spans = {}

  BREAKPOINTS.forEach(at => {
    const cols = ladder[at]
    if (!cols) return
    const over = count % cols
    spans[at] = over === 0 ? 1 : Math.min(cols - over + 1, WIDEST)
  })

  return spans
}

/**
 * The classes a mesh takes: the columns for the grid, and the span its last
 * cell carries so the final row ends flush at every breakpoint.
 *
 * A rung that runs at the same width as the rung below it adds no class, and a
 * span is restated whenever it changes, so a wide cell at one breakpoint cannot
 * carry its width into the next.
 *
 * @param {number} count How many items the mesh holds.
 * @param {Record<string, number>} ladder Columns keyed by breakpoint.
 * @returns {{ columns: string, fill: string }} Classes for the grid and for its
 *   last cell.
 */
export function meshLayout(count, ladder) {
  const spans = meshSpans(count, ladder)
  const columns = []
  const fill = []
  let widthBelow = 0
  let spanBelow = 0

  BREAKPOINTS.forEach(at => {
    const cols = ladder[at]
    if (!cols) return

    if (cols !== widthBelow) columns.push(COLUMN_CLASS[at][cols])

    const span = spans[at]
    if (span !== spanBelow && !(span === 1 && spanBelow <= 1)) fill.push(SPAN_CLASS[at][span])

    widthBelow = cols
    spanBelow = span
  })

  return { columns: columns.join(' '), fill: fill.join(' ') }
}
