/**
 * The preview funnel: of the preview sites sent, how many were opened by a
 * person, how many businesses came to look at their site, what they did there,
 * and how many wrote back - by layout family, by the week the site was sent,
 * and before and after the new layouts.
 *
 * One preview is one business, so every figure counts businesses rather than
 * letters: a business that opened three letters about its site opened once
 * here, and one that visited four times visited once. The time and the taps
 * are the exception, summed over every visit, since they say how much was done
 * rather than by how many.
 *
 * The readings are the Call List's own (lib/outreach/prospects/engaged.js), so
 * the two never tell the owner different things:
 *
 * - Opened is a person opening any letter about the site: an open in the first
 *   ten minutes after a send is a mail system fetching the pictures and is not
 *   counted (`personOpens`). A business on its site followed the link in a
 *   letter, so it opened that letter whether or not its mail let the picture
 *   load. Every open, the machines' included, is kept beside it as `openedAny`.
 * - Visited is a person on the site: a visit begun inside two minutes of a
 *   letter is a link checker (`tooSoonAfter`). A site with a view counted and
 *   no visit filed at all is counted too, since the database only counts a view
 *   once it has ruled out the scanners, the studio and the too-soon.
 * - Replied is a person writing back, which the reader of the rows decides
 *   (lib/outreach/funnel-rows.js): no auto-responder, no bounce. A reply asking
 *   to stop is a person too, but not an interested one, so it is `stopped`.
 *
 * Visited per opened is the rate the funnel exists for. The letter's job is the
 * open; the site's job, and the layout's, is turning an open into a look.
 *
 * Strings and pure functions only, since the console page imports it.
 */

import { dayIn, formatInstant, instantOf } from '../time/zone.js'
import { personOpens, tooSoonAfter, visitMs } from './prospects/engaged.js'

/**
 * The layout families the previews are built in, in the order they are
 * listed, with the name each goes by. A family not here (an older one) is
 * listed after these under its own key.
 */
export const FAMILIES = Object.freeze({
  hvac: 'Home Service',
  outdoor: 'Outdoor',
  industrial: 'Industrial',
  professional: 'Professional',
  health: 'Health',
  roofing: 'Roofing',
})

/**
 * When the new layouts, the rewritten copy and the quality gate took over the
 * previews. A preview built from here on is one of theirs; one built before is
 * the old work. It is read off when the site was built rather than sent, since
 * the layout is decided at the build and a draft built the night before can go
 * out the morning after. The morning batch of 2026-11-05 was built by 9:37 in
 * Texas on the old layouts, and the overhaul landed that afternoon.
 */
export const NEW_LAYOUTS_FROM = '2026-11-05T18:00:00.000Z'

/** A letter filed this close before its preview's own send is still that send. */
const SAME_SEND_MS = 60 * 1000

const instant = value => Date.parse(value ?? '')
const whole = value => Math.max(0, Math.round(Number(value) || 0))

/** A family as it is named on the page: its own name, or its key made readable. */
export function familyLabel(key) {
  if (!key) return 'No Layout On File'
  if (FAMILIES[key]) return FAMILIES[key]
  const text = String(key).replace(/[-_]+/g, ' ').trim()
  return text.replace(/\b[a-z]/g, letter => letter.toUpperCase())
}

/** A `YYYY-MM-DD` date `days` after another, by the calendar alone. */
function shift(date, days) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/**
 * The Monday, in Texas, of the week an instant fell in, as `YYYY-MM-DD`. A
 * week runs Monday to Sunday, the way outreach does: it sends on weekdays.
 */
export function weekOf(value) {
  const date = dayIn(value)
  if (!date) return ''
  const [year, month, day] = date.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return shift(date, -((weekday + 6) % 7))
}

/** The week before a week, by its Monday. */
export const weekBefore = monday => shift(monday, -7)

/** A week as the page names it: "Week of Nov 2". */
export function weekLabel(monday) {
  const said = formatInstant(instantOf(monday, '12:00:00'), { month: 'short', day: 'numeric' })
  return `Week of ${said}`
}

/** The middle of a list of numbers, or null where there are none. */
export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((one, two) => one - two)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * What one preview came to: whether a person opened a letter about it, came
 * to look, and wrote back, and what was done on the site.
 *
 * @param {object} site A row of `preview_sites`.
 * @param {{letters?: object[], sends?: Array<string|null>, sessions?: object[],
 *   replies?: object[]}} held The outbound letters to its business from its
 *   send on, when every letter to the business went, the visits filed against
 *   the site (each with `claims`, its taps on Make It Yours), and the replies
 *   a person typed since the send (each with `stop`).
 */
export function previewOf(site, { letters = [], sends = [], sessions = [], replies = [] } = {}) {
  const sent = instant(site.sent_at)
  const ours = letters.filter(letter => instant(letter.sent_at) >= sent - SAME_SEND_MS)
  const opens = ours.reduce((sum, letter) => sum + personOpens(letter), 0)
  const openedAny = ours.some(letter => letter.opened_at)

  const machine = tooSoonAfter(sends)
  const visits = sessions.filter(session => {
    const began = instant(session.started_at)
    return Number.isFinite(began) && began >= sent - SAME_SEND_MS && !machine(began)
  })
  const counted = whole(site.view_count) > 0 && !sessions.length
  const visited = visits.length > 0 || counted

  const said = replies.filter(reply => instant(reply.sent_at) >= sent - SAME_SEND_MS)
  return {
    family: site.industry || null,
    week: weekOf(site.sent_at),
    built: instant(site.created_at) >= instant(NEW_LAYOUTS_FROM) ? 'new' : 'old',
    opened: opens > 0 || visited,
    openedAny: openedAny || visited,
    visited,
    replied: said.some(reply => !reply.stop),
    stopped: said.some(reply => reply.stop),
    seconds: visits.reduce((sum, visit) => sum + visitMs(visit), 0) / 1000,
    scroll: visits.reduce((deepest, visit) => Math.max(deepest, whole(visit.max_scroll)), 0),
    pages: visits.reduce((sum, visit) => sum + Math.max(1, whole(visit.pages)), 0),
    calls: visits.reduce((sum, visit) => sum + whole(visit.calls), 0),
    emails: visits.reduce((sum, visit) => sum + whole(visit.emails), 0),
    forms: visits.reduce((sum, visit) => sum + whole(visit.form_submits), 0),
    claims: visits.reduce((sum, visit) => sum + whole(visit.claims), 0),
  }
}

/**
 * A run of previews added up: the funnel's figures for a family, a week or the
 * whole of it.
 *
 * `medianSeconds` is the middle of the time each business that looked spent
 * on its site, all its visits together, so one visitor who left a tab open
 * does not stand in for everybody. `visitedPerOpened` is a share from 0 to 1,
 * or null where nobody has opened yet.
 */
export function groupOf(key, label, previews) {
  const looked = previews.filter(one => one.visited)
  const count = test => previews.filter(test).length
  const sum = name => previews.reduce((total, one) => total + one[name], 0)
  const opened = count(one => one.opened)
  const visited = looked.length
  return {
    key,
    label,
    sent: previews.length,
    opened,
    openedAny: count(one => one.openedAny),
    visited,
    replied: count(one => one.replied),
    stopped: count(one => one.stopped),
    visitedPerOpened: opened ? visited / opened : null,
    medianSeconds: median(looked.map(one => one.seconds)),
    totalSeconds: sum('seconds'),
    deepestScroll: previews.reduce((deepest, one) => Math.max(deepest, one.scroll), 0),
    pages: sum('pages'),
    calls: sum('calls'),
    emails: sum('emails'),
    forms: sum('forms'),
    claims: sum('claims'),
  }
}

/** Previews put into groups by a key read off each, in the order the groups were first met. */
function grouped(previews, keyOf) {
  const held = new Map()
  for (const one of previews) {
    const key = keyOf(one)
    if (!held.has(key)) held.set(key, [])
    held.get(key).push(one)
  }
  return held
}

/**
 * The funnel, from the rows the reader gathered.
 *
 * Every family the previews are built in is listed whether or not any was
 * sent yet, since a family the overhaul brought in reading "none sent" says
 * where it stands; an older family is listed only where it sent something.
 * The weeks run newest first, and this week and last week are always there,
 * empty where nothing went.
 *
 * @param {{sites?: object[], letters?: object[], sessions?: object[],
 *   replies?: object[]}} rows `sites` are the sent rows of `preview_sites`;
 *   `letters` every outbound letter sent to their businesses; `sessions` the
 *   visits filed against them, each with `claims`; `replies` the replies a
 *   person typed to them, each with `stop`.
 * @param {{now?: Date}} [options]
 */
export function funnelOf(
  { sites = [], letters = [], sessions = [], replies = [] } = {},
  options = {}
) {
  const now = options.now ?? new Date()
  const byProspect = (rows, key = 'prospect_id') => grouped(rows, row => row[key])
  const lettersOf = byProspect(letters)
  const repliesOf = byProspect(replies)
  const sessionsOf = byProspect(sessions, 'site_id')

  const previews = sites
    .filter(site => Number.isFinite(instant(site.sent_at)))
    .map(site => {
      const own = lettersOf.get(site.prospect_id) ?? []
      return previewOf(site, {
        letters: own,
        sends: own.map(letter => letter.sent_at),
        sessions: sessionsOf.get(site.id) ?? [],
        replies: repliesOf.get(site.prospect_id) ?? [],
      })
    })

  const families = grouped(previews, one => one.family)
  const known = Object.keys(FAMILIES)
  const older = [...families.keys()]
    .filter(key => !known.includes(key))
    .sort((one, two) => families.get(two).length - families.get(one).length)

  const thisWeek = weekOf(now)
  const lastWeek = weekBefore(thisWeek)
  const weeks = grouped(previews, one => one.week)
  for (const monday of [thisWeek, lastWeek]) if (!weeks.has(monday)) weeks.set(monday, [])
  const weekGroup = monday => groupOf(monday, weekLabel(monday), weeks.get(monday) ?? [])

  const builds = grouped(previews, one => one.built)
  const sentAt = sites.map(site => instant(site.sent_at)).filter(Number.isFinite)

  return {
    at: now.toISOString(),
    firstSentAt: sentAt.length ? new Date(Math.min(...sentAt)).toISOString() : null,
    newLayoutsFrom: NEW_LAYOUTS_FROM,
    overall: groupOf('all', 'Every preview', previews),
    families: [...known, ...older].map(key =>
      groupOf(key, familyLabel(key), families.get(key) ?? [])
    ),
    weeks: [...weeks.keys()].sort((one, two) => two.localeCompare(one)).map(weekGroup),
    builds: [
      groupOf('old', 'Old layouts', builds.get('old') ?? []),
      groupOf('new', 'New layouts', builds.get('new') ?? []),
    ],
    thisWeek: weekGroup(thisWeek),
    lastWeek: weekGroup(lastWeek),
  }
}

/** A share said as a whole percentage: "14%". */
export function percent(share) {
  if (share === null || share === undefined || !Number.isFinite(share)) return '–'
  return `${Math.round(share * 100)}%`
}

/** Seconds said as a person says them: "12 sec", "4 min", "1 hr 5 min". */
export function timeSaid(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '–'
  const rounded = Math.round(seconds)
  if (rounded < 60) return `${rounded} sec`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const left = minutes % 60
  return left ? `${hours} hr ${left} min` : `${hours} hr`
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

/**
 * Visited per opened for one group, in words: "3 of 21 who opened came to
 * look (14%)", "nobody has opened one yet" or "none sent yet".
 */
export function rateWords(group) {
  if (!group?.sent) return 'none sent yet'
  if (!group.opened) return 'nobody has opened one yet'
  return `${group.visited} of ${group.opened} who opened came to look (${percent(group.visitedPerOpened)})`
}

/**
 * The whole funnel in one sentence: "Of 274 preview sites sent, 21 were
 * opened by a person and 3 of those businesses came to look (14%). Nobody has
 * written back yet."
 */
export function overallWords(funnel) {
  const all = funnel?.overall
  if (!all?.sent) return 'No preview site has been sent yet.'
  const looked = all.opened
    ? ` and ${all.visited} of those ${all.visited === 1 ? 'business' : 'businesses'} came to look (${percent(all.visitedPerOpened)})`
    : ''
  const opened = plural(all.opened, 'was', 'were')
  const wrote = all.replied
    ? `${plural(all.replied, 'business has', 'businesses have')} written back.`
    : 'Nobody has written back yet.'
  return `Of ${plural(all.sent, 'preview site', 'preview sites')} sent, ${opened} opened by a person${looked}. ${wrote}`
}

/** The day the new layouts took over, as the page says it: "Nov 5". */
export const newLayoutsDay = () =>
  formatInstant(NEW_LAYOUTS_FROM, { month: 'short', day: 'numeric' })

/**
 * The new layouts against the old, in a sentence: "New layouts (built from
 * Nov 5): none sent yet." until one goes, then "New layouts: 2 of 10 who
 * opened came to look (20%), against 13% on the old ones."
 */
export function buildsWords(funnel) {
  const [old, fresh] = funnel?.builds ?? []
  if (!fresh?.sent) return `New layouts (built from ${newLayoutsDay()}): none sent yet.`
  const against =
    old?.visitedPerOpened === null || old?.visitedPerOpened === undefined
      ? ''
      : `, against ${percent(old.visitedPerOpened)} on the old ones`
  return `New layouts: ${rateWords(fresh)}${fresh.opened ? against : ''}.`
}

/**
 * This week against last week, in a sentence: "This week: 0 of 8 who opened
 * came to look (0%). Last week: 3 of 16 (19%)."
 */
export function weeksWords(funnel) {
  const now = funnel?.thisWeek
  const before = funnel?.lastWeek
  const short = group =>
    !group?.sent
      ? 'none sent'
      : !group.opened
        ? 'none opened yet'
        : `${group.visited} of ${group.opened} (${percent(group.visitedPerOpened)})`
  const lead = now?.sent ? rateWords(now) : 'none sent yet'
  return `This week: ${lead}. Last week: ${short(before)}.`
}

/**
 * What a group's visitors did, in a line: "median 1 min, 3 min in all · read
 * 75% of the way down · 1 call · 1 form". Null where nobody came to look.
 */
export function doneWords(group) {
  if (!group?.visited) return null
  const said = [`median ${timeSaid(group.medianSeconds)}, ${timeSaid(group.totalSeconds)} in all`]
  if (group.deepestScroll >= 100) said.push('read to the bottom')
  else if (group.deepestScroll > 0) said.push(`read ${group.deepestScroll}% of the way down`)
  else said.push('did not scroll')
  if (group.calls) said.push(plural(group.calls, 'call tapped', 'calls tapped'))
  if (group.emails) said.push(plural(group.emails, 'email tapped', 'emails tapped'))
  if (group.forms) said.push(plural(group.forms, 'form sent', 'forms sent'))
  if (group.claims)
    said.push(`Make It Yours tapped ${group.claims === 1 ? 'once' : `${group.claims} times`}`)
  return said.join(' · ')
}

/**
 * The line the 5 PM recap carries: this week's visited per opened next to
 * last week's, each counted over the previews sent that week. Null where
 * neither week sent one, since a line of noughts says nothing.
 *
 * "Preview sites visited per opened: 2 of 15 this week (13%), 1 of 9 last
 * week (11%)."
 */
export function weeksLine(funnel) {
  const now = funnel?.thisWeek
  const before = funnel?.lastWeek
  if (!now?.sent && !before?.sent) return null
  const one = (group, when) =>
    !group?.sent
      ? `none sent ${when}`
      : !group.opened
        ? `none opened ${when}`
        : `${group.visited} of ${group.opened} ${when} (${percent(group.visitedPerOpened)})`
  return `Preview sites visited per opened: ${one(now, 'this week')}, ${one(before, 'last week')}.`
}
