import { formatInstant } from '@lib/time/zone.js'
import { outcomeOf, placeOf } from '@lib/outreach/prospects/calls.js'

/**
 * The short notes that come up over and over, as one press each.
 *
 * They fill the box rather than replacing it. A representative ending sixty
 * calls a day will not type the same four words sixty times, and the note is
 * read by whoever picks the business up next - so the press writes the line and
 * leaves the cursor in it, for the half of these that want a name or a time
 * after them.
 */
export const NOTE_STAMPS = Object.freeze([
  'Price objection.',
  'Call back after hours.',
  'Already has someone.',
  'Wants an email first.',
])

/**
 * A call on the record, said the way it is read with a phone ringing: what it
 * came to, and who placed it.
 *
 * @param {{called_at: string, outcome: string, called_by_name: string|null,
 *   note: string|null}} call
 */
export function callLine(call) {
  const came = outcomeOf(call.outcome)?.label ?? call.outcome
  const by = call.called_by_name ? `, ${call.called_by_name}` : ''
  return `${came}${by}`
}

/** The day a call was placed, short enough for a 4.25rem column. */
export function callDay(value) {
  return formatInstant(value, { month: 'short', day: 'numeric' })
}

/** A date and a time, for anything a person has to be somewhere for. */
export function callMoment(value) {
  return formatInstant(value, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * The badges over a business name: where it sits on the list, how busy its
 * trade says it is, and how many times it has been called.
 *
 * Every one of them is a reason the business is on the screen rather than a
 * label about it, which is the test for what belongs up there at all.
 *
 * @param {object} row A business as the list draws it.
 * @returns {{key: string, tone: string, label: string}[]}
 */
export function marksFor(row) {
  const marks = []
  const place = placeOf(row.place)
  if (place) marks.push({ key: 'place', tone: place.tone ?? 'plain', label: place.label })
  // The band as the list worked it out, not a second reading of it here. The
  // two would agree today and the one that drifts is whichever is edited
  // second, and a screen disagreeing with the ranking that handed it the
  // business is worse than a screen that leaves the band off.
  if (row.pull && row.pull !== 'unread') {
    marks.push({
      key: 'pull',
      tone: 'plain',
      label: `${row.pull[0].toUpperCase()}${row.pull.slice(1)}`,
    })
  }
  if (row.tries > 0) {
    marks.push({
      key: 'tries',
      tone: 'plain',
      label: row.tries === 1 ? '1 Call' : `${row.tries} Calls`,
    })
  }
  return marks
}
