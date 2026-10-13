/**
 * The monthly proof card: the day's PageSpeed readings for the sites the studio
 * keeps for clients, each by trade and town, and their average.
 *
 * `site_speed` holds the latest reading per site and strategy, and it is never
 * more than a few hours old: a scheduled refresh re-measures one site on one
 * strategy every five minutes, round the clock, so the whole table turns over
 * several times a day. On the first weekday of each month, Central time, the Pi
 * reads it at midday, when every row standing was taken that morning, and draws
 * one card from the client sites' rows, queued on the Page, Instagram and the
 * Business Profile. Everything that decides what the card says is here and
 * reads no network, so it can be checked against a fixture.
 *
 * WHICH SITES. A client site is a row in `client_sites` that is not exempt. The
 * studio's own sites are left off by name even if one were ever added there, and
 * a site only counts with both a phone and a desktop reading taken on the day
 * itself: a reading carried over from the night before is not the day's, and a
 * site measured on one strategy only cannot sit in a table of both.
 *
 * HOW A SITE IS NAMED. Never by its name. Its trade and town come from the
 * portfolio entry the site's address belongs to - the trade's own label where
 * `trades.js` has a page for it, else the category the portfolio prints for the
 * site - and its town from the entry's `town`, else the town in its `location`.
 * A site the portfolio says neither of is left off the card entirely, out of the
 * count and the averages as well as the table, so every figure on the card is
 * taken over exactly the rows a reader can see.
 *
 * WHAT THE CARD CLAIMS. What the readings say and nothing else. The averages are
 * written to one decimal rather than rounded to a whole score, because 99.5
 * rounded is a hundred and no site on the card earned that for the set.
 */
import { clockIn, dayIn, formatInstant, instantOf } from '../time/zone.js'
import { CALL } from './generated.js'

/** The studio's own sites, which are never a client's however they are filed. */
export const OURS = [
  'taylorurl.com',
  'taylor.website',
  'domebreak.com',
  'baytownwebdevelopment.com',
]

/** The fewest sites a proof card is drawn over. Fewer is a sample, not a portfolio. */
export const MIN_SITES = 3

/**
 * The last day of a month a missed card is still drawn on.
 *
 * The card belongs to the first weekday. A day whose readings never landed - the
 * refresh stalled, the Pi was down - is made up on the next weekday that has
 * them, inside the first week, and from that day's readings, which is
 * what the card then says. Past the first week the month is left without one
 * rather than given a card that reads as late.
 */
export const CATCH_UP_DAY = 7

const WEEKDAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])

/** A site's address as the comparison reads it: the host, lowercase, without `www.`. */
export const hostOf = value => {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
  if (!text) return ''
  try {
    return new URL(text.includes('://') ? text : `https://${text}`).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * The first Monday-to-Friday date of the month a date falls in.
 *
 * @param {string} date `YYYY-MM-DD`, a calendar date in Central.
 * @returns {string} `YYYY-MM-DD`.
 */
export function firstWeekday(date) {
  const month = date.slice(0, 7)
  for (let day = 1; day <= 7; day += 1) {
    const candidate = `${month}-${String(day).padStart(2, '0')}`
    if (WEEKDAYS.has(clockIn(instantOf(candidate, '12:00:00')).weekday)) return candidate
  }
  throw new Error(`no weekday in the first week of ${month}`)
}

/**
 * Whether today, in Central, is a day a proof card is drawn on.
 *
 * @param {Date} [now]
 * @returns {{due: boolean, date: string, month: string, first: string, reason: string}}
 */
export function dueOn(now = new Date()) {
  const { date, weekday } = clockIn(now)
  const month = date.slice(0, 7)
  const first = firstWeekday(date)
  const day = Number(date.slice(8))
  const answer = (due, reason) => ({ due, date, month, first, reason })
  if (!WEEKDAYS.has(weekday)) return answer(false, 'a weekend')
  if (date < first) return answer(false, `before ${first}, the first weekday`)
  if (day > CATCH_UP_DAY) return answer(false, 'past the first week of the month')
  return answer(true, date === first ? 'the first weekday' : 'catching up a missed first weekday')
}

/**
 * How a portfolio site is named on the card, or null where it cannot be.
 *
 * @param {object} project An entry from `PORTFOLIO_PROJECTS`.
 * @param {Map<string, string>} tradeNames Trade id to the label on its page.
 * @returns {{trade: string|null, town: string|null, label: string}|null}
 */
export function describeSite(project, tradeNames) {
  if (!project || project.kind !== 'client') return null
  const slug = project.trades?.[0]
  const category = String(project.tagline ?? '')
    .split('·')[0]
    .trim()
  // The trade pages title their trades in Title Case and the portfolio writes
  // its categories in sentence case; a table mixing the two reads as two
  // lists, so both are set in sentence case, keeping an acronym as written.
  const named = (slug && tradeNames.get(slug)) || category || ''
  const trade = named
    ? named.charAt(0) + named.slice(1).replace(/\b[A-Z][a-z]/g, letters => letters.toLowerCase())
    : null
  const town =
    project.town ||
    String(project.location ?? '')
      .split(',')[0]
      .trim() ||
    null
  if (!trade && !town) return null
  return { trade, town, label: [trade, town].filter(Boolean).join(' · ') }
}

/** An average to one decimal, with a whole number written whole. */
export const average = values =>
  values.length
    ? String(Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10)
    : null

/**
 * The card's figures, from the rows the database holds.
 *
 * @param {object} options
 * @param {{domain: string, exempt: boolean}[]} options.clientSites Rows from `client_sites`.
 * @param {{url: string, strategy: string, performance: number, fetched_at: string}[]} options.readings
 *   Rows from `site_speed`.
 * @param {object[]} options.projects `PORTFOLIO_PROJECTS`.
 * @param {Map<string, string>} options.tradeNames Trade id to label.
 * @param {string} options.date The Central date the readings must have been taken on.
 * @returns {{date: string, sites: object[], count: number, mobile: string|null,
 *   desktop: string|null, left: {host: string, why: string}[]}}
 */
export function proofFrom({ clientSites, readings, projects, tradeNames, date }) {
  const ours = new Set(OURS)
  const clients = new Set(
    clientSites
      .filter(row => !row.exempt)
      .map(row => hostOf(row.domain))
      .filter(host => host && !ours.has(host))
  )
  const byHost = new Map()
  for (const project of projects) {
    const host = hostOf(project.displayUrl ?? project.url)
    if (host) byHost.set(host, project)
  }

  const measured = new Map()
  for (const reading of readings) {
    const host = hostOf(reading.url)
    if (!clients.has(host)) continue
    if (dayIn(reading.fetched_at) !== date) continue
    if (!Number.isFinite(reading.performance)) continue
    const entry = measured.get(host) ?? {}
    entry[reading.strategy] = reading.performance
    measured.set(host, entry)
  }

  const sites = []
  const left = []
  for (const host of [...clients].sort()) {
    const scores = measured.get(host)
    if (!scores) {
      left.push({ host, why: `no reading taken on ${date}` })
      continue
    }
    if (!Number.isFinite(scores.mobile) || !Number.isFinite(scores.desktop)) {
      left.push({ host, why: 'measured on one strategy only' })
      continue
    }
    const named = describeSite(byHost.get(host), tradeNames)
    if (!named) {
      left.push({ host, why: 'the portfolio states neither its trade nor its town' })
      continue
    }
    sites.push({ ...named, mobile: scores.mobile, desktop: scores.desktop })
  }
  // Best phone score first, then by name, so the table reads the same way every
  // month and the eye lands on the strategy the studio is judged by.
  sites.sort(
    (a, b) => b.mobile - a.mobile || b.desktop - a.desktop || a.label.localeCompare(b.label)
  )

  return {
    date,
    sites,
    count: sites.length,
    mobile: average(sites.map(site => site.mobile)),
    desktop: average(sites.map(site => site.desktop)),
    left,
  }
}

/** Where a month's proof card is stored in the bucket. */
export const proofPath = month => `proof/${month}.png`

const dateOf = date => instantOf(date, '12:00:00')
const longDate = date =>
  formatInstant(dateOf(date), { month: 'long', day: 'numeric', year: 'numeric' })
const dayAndMonth = date => formatInstant(dateOf(date), { month: 'long', day: 'numeric' })

/** What the card shows, as the `proof` template takes it. */
export function proofCardItem(proof) {
  return {
    eyebrow: 'Measured by Google',
    counter: formatInstant(dateOf(proof.date), { month: 'short', day: 'numeric', year: 'numeric' }),
    headline: `The *${proof.count}* client sites we keep, scored on PageSpeed`,
    mobile: proof.mobile,
    desktop: proof.desktop,
    sites: proof.sites,
    source: `Google PageSpeed Insights performance scores out of 100, read on ${longDate(proof.date)}.`,
  }
}

/** What a reader who cannot see the card is given: every figure on it, in order. */
export function proofAlt(proof) {
  const rows = proof.sites
    .map(
      site =>
        `${site.label.replace(' · ', ' in ')}: ${site.mobile} on a phone, ${site.desktop} on a desktop.`
    )
    .join(' ')
  return (
    `Google PageSpeed performance scores for the ${proof.count} client sites we keep, read on ${longDate(proof.date)}. ` +
    `Average ${proof.mobile} out of 100 on a phone and ${proof.desktop} on a desktop. ${rows}`
  )
}

/** Where the Page sends a reader who wants the same reading of their own site. */
export const SPEED_CHECK =
  'https://www.taylorurl.com/speed-check?utm_source=fb&utm_medium=social&utm_campaign=monthly-proof'

/**
 * Each channel's post for the proof card.
 *
 * The first sentence is what an owner gets from it - work they can judge by a
 * number Google takes rather than by anything the studio says about itself - and
 * the second is the reading, stated once, with the date it was taken. The Page
 * ends on the speed check, which runs the same test on the reader's own site;
 * Instagram on the number, because a caption carries no link anybody can tap;
 * the Business Profile on nothing, because its button does the asking.
 *
 * @param {{date: string, count: number, mobile: string, desktop: string}} proof
 * @returns {Record<string, string>}
 */
export function proofTexts(proof) {
  const what =
    'Once a month we publish how the client sites we keep score on Google PageSpeed, so you can judge our work by the numbers.'
  const reading = `On ${dayAndMonth(proof.date)}, the ${proof.count} sites on the card averaged ${proof.mobile} out of 100 on a phone and ${proof.desktop} on a desktop.`
  return {
    facebook: `${what}\n${reading}\nRun the same free test on your own site.\n\n${SPEED_CHECK}`,
    instagram: `${what}\n${reading}\n\n${CALL}`,
    googlebusiness: `${what}\n${reading}`,
  }
}
