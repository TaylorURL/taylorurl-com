/**
 * Number and time formatting for the analytics console.
 *
 * Every figure here shares one axis label, one tooltip, and one table column
 * with figures of a very different size, so the rules are about keeping columns
 * the same width and keeping a reader from mistaking 1.2k for 1.2.
 */

/** Thousands as `1.2k`, millions as `3.4m`. Anything under a thousand is exact. */
export function compactCount(value) {
  const n = Number(value) || 0
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
  return `${(n / 1_000_000).toFixed(1)}m`
}

/** Full number with separators, for the places that have room for it. */
export function fullCount(value) {
  return (Number(value) || 0).toLocaleString('en-US')
}

/**
 * A span in milliseconds as the largest unit that still reads as a duration:
 * `0s` for nothing measured, `48s`, `3m 20s`, `1h 04m`.
 */
export function duration(ms) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 1000))
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

/** `62.5%`, or a dash when there was nothing to take a percentage of. */
export function percent(value, places = 1) {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(places)}%`
}

/**
 * A bucket label for the traffic chart. Hourly buckets need the clock and daily
 * ones need the date, and the grain the database chose is what decides which.
 */
export function bucketLabel(value, grain) {
  const date = new Date(value)
  if (grain === 'hour') {
    const hour = date.getHours() % 12 || 12
    return `${hour}${date.getHours() >= 12 ? 'p' : 'a'}`
  }
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
}

/** The same bucket spelled out, for a tooltip that has room for it. */
export function bucketTitle(value, grain) {
  const date = new Date(value)
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (grain !== 'hour') return day
  const hour = date.getHours() % 12 || 12
  return `${day}, ${hour}:00 ${date.getHours() >= 12 ? 'PM' : 'AM'}`
}

/** `12a`, `1p` — the x axis of the hour-of-day chart, where a tick has no room. */
export function hourLabel(hour) {
  const h = hour % 12 || 12
  return `${h}${hour >= 12 ? 'p' : 'a'}`
}
