import {
  MarkFind,
  MarkGauge,
  MarkLedger,
  MarkPage,
  MarkRule,
  MarkSeries,
} from '@components/marks/marks'
import { SERIES_MARKS } from './seriesMarks'

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
  const Drawing = SERIES_MARKS[mark] || MarkSeries
  return <Drawing {...props} />
}

/**
 * @param {{ category?: string }} props - The category exactly as an article writes it.
 */
export function CategoryMark({ category, ...props }) {
  const Drawing = CATEGORY_MARKS[category] || MarkSeries
  return <Drawing {...props} />
}
