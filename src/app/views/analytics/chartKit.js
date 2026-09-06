import { CHART_HEIGHT } from '../console/lib/tokens'

/**
 * What every chart in the console shares: the tick style, the grid colour,
 * the series ramp and the box a chart draws into.
 *
 * They live apart from the charts so a section that draws a chart of its own
 * imports the same four things rather than carrying copies, and apart from
 * the tooltip card because this file exports no component and can be read by
 * anything.
 */

// A tick is a figure, so it takes the same fixed-advance face as every other
// figure on the page. The class carries it rather than a font stack of its own,
// which is what keeps the axis and the number beside the chart on one face.
export const AXIS = {
  fontSize: 10,
  className: 'font-mono',
  fill: 'var(--paper-ink-soft)',
  // The same size again, as a length recharts can read. Before it draws a
  // tick it measures the text in a hidden span, and it builds that span from
  // `style` alone - the attribute above is never seen. Left unsaid the span
  // measures at the page's own size, which is not ten pixels, and every label
  // carrying a space is broken onto a second line to fit a width it already
  // fits.
  style: { fontSize: '10px' },
}

export const GRID = 'var(--paper-hairline)'

// Ordered so the first categories - the ones a breakdown is usually about -
// are the accent, and the tail stays legible without competing with it. The
// second series is the accent's own hover step, which is a slice nobody can
// tell from the first at legend size, so it is held back to the end of the ramp
// where it never lands next to the colour it repeats.
const SERIES_ORDER = [1, 3, 4, 5, 6, 7, 2]
const SERIES_COLORS = SERIES_ORDER.map(step => `var(--series-${step})`)

export function seriesColor(index) {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

/**
 * The box a chart draws into.
 *
 * A chart given `fill` takes the whole of the box it stands in - a card's
 * remaining height at the desk width, where the console lays every section
 * out to fit the screen. Without it the box is the fixed height the token
 * names, which is what a phone gets, where the card has no height of its own
 * to hand down.
 */
export function frame(fill, height) {
  return fill ? { className: 'h-full min-h-0 w-full' } : { style: { height } }
}

/**
 * The gap a chart keeps from the edges of the card it draws in.
 *
 * The box a chart fills carries no padding of its own, because a chart is
 * given the whole of what the card has left and its bars are meant to run the
 * width of it. So the inset is the chart's own to keep, and a chart that keeps
 * none draws its outermost tick against the card's border - or, where the tick
 * is a name, past it and out of the card altogether.
 */
export const CHART_INSET = 12

// What recharts leaves between the axis and the text hung off it, whether or
// not the tick line is drawn.
const TICK_OFFSET = 8

// The ticks are set in the console's figure face, which advances every glyph
// the same, so the room a label takes is its length times one glyph rather
// than something to be measured.
const GLYPH = AXIS.fontSize * 0.6

/**
 * A name trimmed to the room an axis of this width has, the whole of it left
 * to the tooltip.
 *
 * A name longer than its axis is not cut off by recharts. It is wrapped onto
 * as many lines as it takes, over the row above and the row below, or it is
 * drawn out past the left edge of the card, so an axis of names is given a
 * formatter that trims to what the axis can hold rather than a width and a
 * hope.
 */
export function fitName(width) {
  const chars = Math.max(4, Math.floor((width - TICK_OFFSET) / GLYPH))
  return name => {
    const text = String(name ?? '')
    return text.length > chars ? `${text.slice(0, chars - 1)}…` : text
  }
}

export { CHART_HEIGHT }
