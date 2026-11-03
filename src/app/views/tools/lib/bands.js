import { bandOf } from '@lib/outreach/audit/bands.js'

/**
 * Google's three bands, as the page draws them: the word Google uses, the ink a
 * figure in that band is set in, and the stroke its ring is drawn with. Green
 * is the site's own "up" colour, so a score in the good band reads the way a
 * site that is up reads everywhere else.
 *
 * The cut-offs are not restated here. `bandOf` is the one the outreach audit
 * and the speed-check endpoint both file a score by, so a figure on this page
 * lands in the band it lands in anywhere else.
 */
export const BANDS = {
  poor: { label: 'Poor', ink: 'text-[color:var(--danger)]', stroke: 'var(--danger)' },
  fair: { label: 'Needs improvement', ink: 'text-[color:var(--warn)]', stroke: 'var(--warn)' },
  good: { label: 'Good', ink: 'text-[color:var(--live)]', stroke: 'var(--live)' },
  plain: { label: 'Not scored', ink: 'text-ink', stroke: 'transparent' },
}

/** The band a score out of a hundred sits in, as `BANDS` draws it. */
export const toneOf = score => BANDS[bandOf(score)] ?? BANDS.plain

/** The line a run that did not finish carries, under the form rather than a field. */
export const RUN_FAULT = 'text-[14px] leading-snug text-[color:var(--danger)]'
