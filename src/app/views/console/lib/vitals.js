/**
 * The three timings Google calls a page's vitals, and the edges it judges each
 * of them at.
 *
 * These are the figures underneath the performance score rather than the score
 * again, which is what makes them worth a card beside a table that already
 * prints the score. A score of ninety-four says a page is fine; four seconds
 * to the largest paint says which second of the load to go and look at.
 *
 * `good` and `poor` are Google's published thresholds, not thresholds of ours,
 * so a reading here and a reading in a PageSpeed report fall in the same band.
 * Blocking time stands in for interaction latency, which is the vital Google
 * measures on real visits and Lighthouse cannot measure in a lab; its two
 * edges are Lighthouse's own for the metric it does measure.
 *
 * `ceilings` is the ladder the axis climbs: it ends at the first of these that
 * holds every reading, so an account whose slowest paint is 1.8 seconds is
 * drawn against 2.5 rather than against ten, and every mark has room. Each
 * rung is one of the metric's own edges or a doubling past the last of them,
 * so the zoom always lands somewhere a reader can name.
 *
 * The lowest rung is the good edge, which means an account wholly inside good
 * is drawn on an undivided green field ending at the edge it is inside of.
 * Standing the axis off at the poor edge instead would keep both edges in
 * view, and it costs the whole point of the card: every blocking time in this
 * account is under two hundred milliseconds, and against six hundred that is
 * fifteen dots in the left third with two thirds of the card empty. The
 * widening is the signal. A site crossing an edge pulls the axis out to the
 * next rung, and the band it crossed into appears underneath it.
 *
 * They live here rather than in the chart that draws them because the page
 * above it needs the name of the one on show for its heading, and the switch
 * between them needs all three.
 */
export const VITALS = [
  {
    key: 'lcp_ms',
    label: 'LCP',
    name: 'Largest Contentful Paint',
    good: 2500,
    poor: 4000,
    ceilings: [2500, 4000, 6000, 10000],
    // A tick is read at a glance and a tooltip is read on purpose, so the tick
    // drops a trailing nought the tooltip keeps.
    tick: ms => `${+(ms / 1000).toFixed(1)}s`,
    value: ms => `${(ms / 1000).toFixed(1)}s`,
  },
  {
    key: 'tbt_ms',
    label: 'TBT',
    name: 'Total Blocking Time',
    good: 200,
    poor: 600,
    ceilings: [200, 600, 1200, 3000],
    tick: ms => `${Math.round(ms)}ms`,
    value: ms => `${Math.round(ms)}ms`,
  },
  {
    key: 'cls',
    label: 'CLS',
    name: 'Cumulative Layout Shift',
    good: 0.1,
    poor: 0.25,
    ceilings: [0.1, 0.25, 0.5, 1],
    tick: value => String(+value.toFixed(2)),
    value: value => Number(value).toFixed(3),
  },
]

/** The vital a key names, the first of them standing in for one that is not. */
export const vitalFor = key => VITALS.find(entry => entry.key === key) ?? VITALS[0]
