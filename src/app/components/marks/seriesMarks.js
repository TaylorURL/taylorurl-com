import {
  MarkFind,
  MarkGauge,
  MarkLedger,
  MarkPage,
  MarkRule,
  MarkTrade,
} from '@components/marks/marks'

// The drawing each series is known by. Series data names its mark as a string
// so the register can be read by the sitemap build in plain Node; this is where
// that name becomes a drawing. It lives in a file of its own because two
// readers want it - the series mark component and the bar, which draws the
// shelves as rows - and a component file cannot export a constant without
// costing every component in it its fast refresh.
export const SERIES_MARKS = {
  find: MarkFind,
  gauge: MarkGauge,
  rule: MarkRule,
  page: MarkPage,
  ledger: MarkLedger,
  trade: MarkTrade,
}
