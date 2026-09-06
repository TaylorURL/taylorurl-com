import {
  MarkFind,
  MarkGauge,
  MarkLedger,
  MarkPage,
  MarkRule,
  MarkSeries,
  MarkTrade,
} from '@components/marks'

// The drawing each series and each category is known by. Series data names its
// mark as a string so the register can be read by the sitemap build in plain
// Node; this is where that name becomes a drawing.
const MARKS = {
  find: MarkFind,
  gauge: MarkGauge,
  rule: MarkRule,
  page: MarkPage,
  ledger: MarkLedger,
  trade: MarkTrade,
}

// The categories predate the series and are written on the articles themselves,
// so their marks are keyed on the words the articles use. A category added to an
// article without a line here still renders - it takes the generic series mark
// rather than no mark at all.
const CATEGORY_MARKS = {
  SEO: MarkFind,
  'Site Speed': MarkGauge,
  Design: MarkRule,
  Business: MarkLedger,
  'Tips for Owners': MarkPage,
}

/**
 * @param {{ mark?: string }} props - The key from a series' `mark` field.
 */
export default function SeriesMark({ mark, ...props }) {
  const Drawing = MARKS[mark] || MarkSeries
  return <Drawing {...props} />
}

/**
 * @param {{ category?: string }} props - The category exactly as an article writes it.
 */
export function CategoryMark({ category, ...props }) {
  const Drawing = CATEGORY_MARKS[category] || MarkSeries
  return <Drawing {...props} />
}
