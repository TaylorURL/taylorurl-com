/**
 * Sunday operates in Trenton's local time (Central). Every date or time
 * displayed inside the Sunday admin app goes through these helpers so it
 * doesn't drift if the browser happens to be on a different machine /
 * timezone — and so the UI matches the daemon, which also uses CT.
 *
 * "CST" colloquially means Central Time. The IANA zone America/Chicago
 * handles both CST (UTC-6) and CDT (UTC-5) automatically.
 */
export const SUNDAY_TZ = 'America/Chicago'

function asDate(input) {
  if (input == null) return null
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

function fmt(options) {
  return new Intl.DateTimeFormat('en-US', { timeZone: SUNDAY_TZ, ...options })
}

/** Short month + day. e.g. "Jun 2" (or "Jun 2, 2026" with withYear). */
export function formatShortDate(input, { withYear = false } = {}) {
  const d = asDate(input)
  if (!d) return ''
  return fmt({
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(d)
}

/** Long weekday + date. e.g. "Tuesday, June 2, 2026" */
export function formatLongDate(input) {
  const d = asDate(input)
  if (!d) return ''
  return fmt({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(d)
}

/** HH:MM AM/PM. e.g. "9:00 AM" */
export function formatTime(input) {
  const d = asDate(input)
  if (!d) return ''
  return fmt({ hour: 'numeric', minute: '2-digit' }).format(d)
}

/** Short date + time. e.g. "Jun 2, 9:00 AM" */
export function formatDateTime(input) {
  const d = asDate(input)
  if (!d) return ''
  return fmt({
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

/**
 * Time-only if the timestamp falls on today's CT calendar date,
 * otherwise short date + time. Used by chat bubbles to keep the
 * stamp compact for in-session messages and informative for ones
 * scrolled back to from prior days.
 */
export function formatSmartTimestamp(input) {
  const d = asDate(input)
  if (!d) return ''
  const calendarKey = options =>
    fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(options)
  return calendarKey(d) === calendarKey(new Date()) ? formatTime(d) : formatDateTime(d)
}

/**
 * Relative time: "just now", "5m ago", "2h ago", "Yesterday", "3d ago",
 * or a short CT date for anything older. Age comes from `Date.now()` so
 * the math is timezone-irrelevant — only the fallback formats use CT.
 */
export function formatRelative(input) {
  const d = asDate(input)
  if (!d) return ''
  const ms = Date.now() - d.getTime()
  if (ms < 60_000) return 'just now'
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return formatShortDate(d)
}

/**
 * Format a bare YYYY-MM-DD string as a calendar date in CT.
 *
 * Avoids the JS gotcha where `new Date("2026-06-02")` is parsed as UTC
 * midnight — which would render as "Jun 1" in earlier US time zones.
 * We anchor to UTC-noon instead, which lands on the same calendar day in
 * every zone.
 */
export function formatLocalDateString(yyyyMmDd, { long = false, withYear = false } = {}) {
  if (!yyyyMmDd || typeof yyyyMmDd !== 'string') return ''
  const [year, month, day] = yyyyMmDd.split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  return long ? formatLongDate(date) : formatShortDate(date, { withYear })
}
