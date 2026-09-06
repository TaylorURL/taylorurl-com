/**
 * Dates for the notes pages.
 *
 * Every format is pinned. A publish time rendered in the machine's own zone
 * comes out one day earlier in the build than it does for a reader east of it,
 * and the prerendered page and the live one would disagree on the date of the
 * same issue. Any fixed zone settles that; the one an issue is dated in is the
 * one it was written in.
 */
import { ZONE } from '@lib/time/zone.js'

const SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: ZONE,
})

const LONG = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: ZONE,
})

function parse(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** `Aug 27, 2026`, or an empty string when there is no usable date. */
export function issueDate(value) {
  const date = parse(value)
  return date ? SHORT.format(date) : ''
}

/** `August 27, 2026`, for the one date a page gives its own line. */
export function issueDateLong(value) {
  const date = parse(value)
  return date ? LONG.format(date) : ''
}

/** The `YYYY-MM-DD` form structured data and `<time>` elements take. */
export function issueDateIso(value) {
  const date = parse(value)
  return date ? date.toISOString() : null
}
