/**
 * How the social checks read an instant back off the clock in Baytown.
 *
 * Buffer is told an instant and a cadence promises an hour on the local clock,
 * and the two disagree by an hour for half the year. So a slot is read the way
 * somebody in Baytown would read it, and every check that places a post reads
 * it here, which keeps the slot one check lays out and the slot another judges
 * on the same clock.
 */
import { ZONE } from '../../lib/outreach/sending/schedule.js'

/** The hour, weekday and date an instant falls on, on the clock in Baytown. */
export function localReading(iso) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const at = type => parts.find(part => part.type === type)?.value ?? ''
  return {
    hour: Number(at('hour')) % 24,
    weekday: at('weekday').toLowerCase(),
    date: `${at('year')}-${at('month')}-${at('day')}`,
  }
}
