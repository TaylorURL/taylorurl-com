/**
 * The zone every time in this project is read in.
 *
 * A stored timestamp is an instant. The evening a person reads off it belongs
 * to a place, and `Intl` left to itself answers with the place the code is
 * running: the visitor's laptop in the browser, UTC inside a function. The
 * same row then reads as two different evenings depending on which of those
 * rendered it, and a day bucket built the second way is a day that starts at
 * six in the previous afternoon.
 *
 * Every business under this roof keeps Central hours, so Central is the answer
 * both sides owe. It is named rather than offset because the offset moves twice
 * a year, and a fixed -06:00 is wrong for two thirds of the calendar.
 */
export const ZONE = 'America/Chicago'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A value that may be an instant, coerced to one.
 *
 * A bare `YYYY-MM-DD` is not an instant and is refused here rather than
 * quietly parsed: the platform reads it as UTC midnight, which is the previous
 * evening in Central, and a date that renders as the day before is the whole
 * failure this module exists to end. Those go to `formatDate` instead.
 *
 * @param {Date|string|number} value
 * @returns {Date|null} null when the value is absent or unreadable
 */
function instant(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string' && DATE_ONLY.test(value)) return null
  const at = value instanceof Date ? value : new Date(value)
  return Number.isNaN(at.getTime()) ? null : at
}

/**
 * An instant, written the way it was lived in Central.
 *
 * @param {Date|string|number} value
 * @param {Intl.DateTimeFormatOptions} [options]
 * @param {string} [fallback] what to render when there is no readable instant
 * @returns {string}
 */
export function formatInstant(value, options = {}, fallback = '—') {
  const at = instant(value)
  if (!at) return fallback
  return at.toLocaleString('en-US', { timeZone: ZONE, ...options })
}

/**
 * A calendar date, written without being moved.
 *
 * A day a person picked on a form is a square on a calendar rather than a
 * moment, and shifting it into a zone is how it lands on the day before. It is
 * read as UTC midnight and written back out of UTC, so the square it came from
 * is the square it prints.
 *
 * @param {string|Date} value a `YYYY-MM-DD` date, or a Date already at its noon
 * @param {Intl.DateTimeFormatOptions} [options]
 * @param {string} [fallback]
 * @returns {string}
 */
export function formatDate(value, options = {}, fallback = '—') {
  const text = value instanceof Date ? dayIn(value) : String(value ?? '')
  if (!DATE_ONLY.test(text)) return fallback
  const at = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(at.getTime())) return fallback
  return at.toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  })
}

/**
 * The calendar date an instant fell on in Central, as `YYYY-MM-DD`.
 *
 * This is the key a day bucket is built on. Built from a UTC date instead, an
 * evening after six lands under tomorrow, which is how a day's totals come out
 * split across two rows.
 *
 * @param {Date|string|number} [value]
 * @returns {string}
 */
export function dayIn(value = new Date()) {
  const at = instant(value)
  if (!at) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

/**
 * The clock an instant showed in Central, broken into numbers.
 *
 * The window a job opens and closes on is arithmetic rather than text, and
 * reading it back out of a formatted string is where a leading zero or a
 * twelve-hour clock gets a comparison wrong.
 *
 * @param {Date|string|number} [value]
 * @returns {{date: string, weekday: string, hour: number, minute: number, minutes: number}|null}
 */
export function clockIn(value = new Date()) {
  const at = instant(value)
  if (!at) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at)
  const at_ = type => parts.find(part => part.type === type)?.value ?? '0'
  const hour = Number(at_('hour')) % 24
  const minute = Number(at_('minute'))
  return {
    date: `${at_('year')}-${at_('month')}-${at_('day')}`,
    weekday: parts.find(part => part.type === 'weekday')?.value ?? '',
    hour,
    minute,
    minutes: hour * 60 + minute,
  }
}

/**
 * How far ahead of UTC the zone was at an instant, in milliseconds.
 *
 * Read from the zone database rather than from the machine, because the same
 * code runs from a workstation in Texas and from a function in UTC, and an
 * offset taken off whichever clock happens to be underneath puts the two five
 * hours apart.
 *
 * @param {Date} instant
 * @returns {number}
 */
export function offsetAt(instant) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant)
  const at = type => Number(parts.find(part => part.type === type)?.value ?? 0)
  const reading = Date.UTC(
    at('year'),
    at('month') - 1,
    at('day'),
    at('hour') % 24,
    at('minute'),
    at('second')
  )
  return reading - instant.getTime()
}

/**
 * The instant a wall-clock reading in the zone actually happens at.
 *
 * Applied twice. The offset has to be read at an instant, and the only instant
 * available to read it at is the answer being solved for, so the first pass is
 * a guess and the second lands on the right side of a daylight saving boundary
 * the guess may have fallen the wrong side of.
 *
 * @param {string} date A `YYYY-MM-DD` calendar date in the zone.
 * @param {string} [time] A `HH:MM:SS` reading on that day.
 * @returns {Date}
 */
export function instantOf(date, time = '00:00:00') {
  const wall = new Date(`${date}T${time}Z`).getTime()
  const first = new Date(wall - offsetAt(new Date(wall)))
  return new Date(wall - offsetAt(first))
}
