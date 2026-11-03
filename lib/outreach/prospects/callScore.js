/**
 * The order the Call List is worked in, read off measured facts before
 * anybody has rung a number.
 *
 * Three readings of every business, each 0 to 100, multiplied, so a business
 * has to read well on all three to come near the top; one that cannot pay, or
 * whose owner never answers, or that has no use for a site, sinks however well
 * it does on the other two.
 *
 * Owner: will the owner pick up?
 *
 *   base   = 100 × the trade's share of firms with no employees
 *            (`call_trade_metrics.solo_share`, Census 2022, the Houston-area
 *            counties). A trade not on that table takes the table's median.
 *   no storefront (no street number on the address: a truck, a home, a PO box)
 *          → base + (100 − base) × 0.5
 *   registered with the state in the last 12 months
 *          → that + (100 − that) × 0.5
 *   staffed: the company has 2 or more locations, or registered with the
 *   state 20 or more years ago, or has 3 or more officers on file
 *          → at most 100 × (1 − the same share), the Census's "with staff"
 *            side, whatever the lifts above came to
 *   a number for the owner on file, other than the listing's main line (from
 *   a Front Desk call or the owner finder: a licensing board, the business's
 *   own site, a contact service)
 *          → 100 where two independent sources agree on it
 *            (`owner_phone_confirmed`)
 *          → at least 90 where only one gave it, after everything above
 *
 *   Each lift closes half of what is left rather than adding points, so the
 *   reading stays under 100 and a lift is worth most where the trade says
 *   least: a no-storefront barber was already likely to answer his own phone,
 *   a no-storefront restaurant much less so.
 *
 *   A company is every listing on the table joined by phone, own site or
 *   name, and its locations are its distinct street addresses (see
 *   companies.js). A supplier, wholesaler or manufacturer filed under a trade
 *   - by Google's category or by its name - is read by that industry's row of
 *   `call_trade_metrics` instead of the trade's, here and for Budget.
 *
 * Need: does it need a website?
 *
 *   site   = none 100 · Facebook or another social page 85 · a booking page
 *            or a directory listing 60 · a site of its own 25 (a new business
 *            can have one)
 *   need   = site × (0.5 + share ÷ 2), where share is the part of the same
 *            trade's listings, across every listing the sweep has found, that
 *            have a site of their own: restaurants 73%, barber shops 33%. A
 *            trade with fewer than 20 listings, and a row with no trade, take
 *            the share across the whole table.
 *
 *   A business in a trade where nearly everyone has a site is the one being
 *   passed over for it; in a trade where nobody does, nobody is asking.
 *
 * Budget: can it pay?
 *
 *   sales  = the trade's average yearly sales per one-person business
 *            (`call_trade_metrics.avg_sales`), or the table's median for a
 *            trade not on it
 *   budget = 20 + 80 × (ln sales − ln lowest) ÷ (ln highest − ln lowest)
 *
 *   Read on a log scale because the sales run over an order of magnitude -
 *   storage is nine times youth sports - and a straight line would put every
 *   trade but the top two in the bottom third. The lowest trade still scores
 *   20: every trade on the table can pay for a site, some more easily.
 *
 * Timing: a company registered with the state in the last 90 days has the
 * product multiplied by 1.5. Those weeks are when a business is buying the
 * things it starts with.
 *
 * A name: a business whose owner's name is on file - from a front desk, the
 * owner finder or a state record - is multiplied by 1.25, since a call that
 * asks for somebody by name gets put through; by 1.3 where two independent
 * sources agree on the name (`owner_name_confirmed`).
 *
 * Two numbers: a company that can be rung on two or more numbers - the
 * owner's own beside the listing's main line, or another listing of the same
 * one-location company on a number of its own - is multiplied by 1.25. One of
 * them is more likely to be the owner's, and a line the front desk answers
 * has another to try. A company with two or more locations is not counted
 * this way: its other numbers are other branches' front desks.
 *
 *   total  = owner × need × budget ÷ 10,000, × 1.5 when registered in 90 days,
 *            × 1.25 when the owner's name is known, or × 1.3 when it is
 *            confirmed, × 1.25 when there are two or more numbers
 *
 * The calls themselves are the backup. Once a trade has 20 calls somebody
 * picked up (`pickedUp` in calls.js):
 *
 *   - its measured share of owner pick-ups, every pick-up that was not Front
 *     Desk, replaces the Census base for Owner;
 *   - its interest rate - Call Backs and other interested calls over the
 *     owner pick-ups - against the rate across every trade multiplies Need,
 *     held between 0.5 and 1.5, and Need stays at or under 100.
 *
 * Town, reviews and the studio's own work in a trade or town no longer score.
 *
 * Pure: the endpoint reads the rows, the trade table and the calls, this
 * decides, and the call list check works the formulas through by hand.
 */

import { dayIn } from '../../time/zone.js'
import { NEW_BUSINESS_SOURCE, outcomeOf, presenceOf } from './calls.js'
import { hostOf, platformOf } from './platforms.js'
import { companyOfOne, storefrontOf } from './companies.js'

export { storefrontOf }

/** A company registered this many days ago or fewer is new, for Owner. */
export const NEW_DAYS = 365
/** And this many or fewer is new enough for the timing multiplier. */
export const FRESH_DAYS = 90
/** What the timing multiplier is. */
export const FRESH_BOOST = 1.5

/** The part of the gap to 100 a listing with no street number closes on Owner. */
export const NO_STOREFRONT_LIFT = 0.5
/** And the part a company registered in the last twelve months closes. */
export const NEW_LIFT = 0.5

/** What each kind of site is worth to Need before the trade is read. */
export const SITE_POINTS = Object.freeze({
  none: 100,
  social: 85,
  booking: 60,
  portal: 60,
  own: 25,
  // A company registered within the year that has a site has the one it
  // started with - the domain bought the week it formed, usually a template
  // or a holding page - and still needs the site it will run on. New
  // businesses are also the owner's first priority on the list.
  newOwn: 70,
})

/** Listings a trade needs before its own share of sites is read rather than the table's. */
export const SHARE_LISTINGS = 20

/** The lowest Budget a trade on the table can score. */
export const BUDGET_FLOOR = 20

/** Calls somebody picked up, in one trade, before its calls replace the Census readings. */
export const MEASURED_AFTER = 20

/** How far a trade's measured interest can move Need, either way. */
export const INTEREST_RANGE = Object.freeze([0.5, 1.5])

/** What two or more numbers for one company multiply the total by. */
export const TWO_NUMBERS_BOOST = 1.25

/** What a known owner's name multiplies the total by. */
export const NAME_BOOST = 1.25

/** And a name two independent sources agree on. */
export const CONFIRMED_NAME_BOOST = 1.3

/** Owner with a number for the owner on file that two sources agree on. */
export const CONFIRMED_CELL_OWNER = 100

/** And with one only one source gave: at least this, since it may be stale or wrong. */
export const UNCONFIRMED_CELL_OWNER = 90

/** A company registered with the state this many years ago or more reads as staffed. */
export const OLD_YEARS = 20

/** And so does one with this many officers on its state record. */
export const OFFICERS_STAFFED = 3

/** And one with this many locations. */
export const LOCATIONS_STAFFED = 2

/** Where a reading stands with no table to read it from: the middle of its scale. */
const NO_READING = Object.freeze({ solo: 0.5, budget: 60 })

/** A trade as a key: the sweep's own spelling, case aside. */
function tradeKey(trade) {
  return String(trade ?? '')
    .trim()
    .toLowerCase()
}

/** The middle of some numbers, the mean of the middle two where there is an even count. */
export function median(values) {
  const sorted = values.filter(Number.isFinite).sort((one, two) => one - two)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value))
}

// ── The readings the trade gives ──────────────────────────────────────────

/**
 * `call_trade_metrics`, by trade, with the medians a trade not on it takes and
 * the two ends Budget is scaled between.
 *
 * @param {Array<{trade: string, solo_share: number|string, avg_sales: number|string|null}>} rows
 */
export function tradeTable(rows = []) {
  const byTrade = new Map()
  for (const row of rows) {
    const solo = Number(row?.solo_share)
    if (!row?.trade || !Number.isFinite(solo)) continue
    const sales =
      row.avg_sales === null || row.avg_sales === undefined ? NaN : Number(row.avg_sales)
    byTrade.set(tradeKey(row.trade), {
      solo,
      sales: Number.isFinite(sales) && sales > 0 ? sales : null,
    })
  }
  const held = [...byTrade.values()]
  const sales = held.map(one => one.sales).filter(value => value !== null)
  return {
    byTrade,
    solo: median(held.map(one => one.solo)),
    sales: median(sales),
    low: sales.length ? Math.min(...sales) : null,
    high: sales.length ? Math.max(...sales) : null,
  }
}

/**
 * The part of each trade's listings with a site of their own, read across
 * every listing on the table, and the same across the whole table.
 *
 * @param {Array<{trade: string|null, site_kind: string|null}>} listings
 */
export function tradeSites(listings = []) {
  const counts = new Map()
  let all = 0
  let own = 0
  for (const one of listings) {
    const has = one?.site_kind === 'own'
    all += 1
    if (has) own += 1
    if (!one?.trade) continue
    const key = tradeKey(one.trade)
    const held = counts.get(key) ?? { listings: 0, own: 0 }
    held.listings += 1
    if (has) held.own += 1
    counts.set(key, held)
  }
  const byTrade = new Map()
  for (const [key, held] of counts) {
    if (held.listings >= SHARE_LISTINGS) byTrade.set(key, held.own / held.listings)
  }
  return { byTrade, overall: all ? own / all : 0 }
}

/**
 * What the calls so far say, by trade: how many were picked up, how many of
 * those by a front desk, and how many owners wanted to hear more.
 *
 * @param {Array<{outcome: string, interested: boolean|null, trade: string|null}>} calls
 */
export function tradeCalls(calls = []) {
  const blank = () => ({ reached: 0, frontDesk: 0, interested: 0 })
  const byTrade = new Map()
  const all = blank()
  for (const call of calls) {
    const outcome = outcomeOf(call?.outcome)
    if (!outcome?.pickedUp) continue
    const key = call?.trade ? tradeKey(call.trade) : null
    const held = key ? (byTrade.get(key) ?? blank()) : null
    for (const tally of held ? [all, held] : [all]) {
      tally.reached += 1
      // A front desk's interest is not the business's, so it is not counted.
      if (outcome.frontDesk) tally.frontDesk += 1
      else if (call.interested === true) tally.interested += 1
    }
    if (key) byTrade.set(key, held)
  }
  return { byTrade, all }
}

/** Everything the scores read that is not on the row, built once per read of the list. */
export function factsOf({ metrics = [], listings = [], calls = [] } = {}) {
  return { trades: tradeTable(metrics), sites: tradeSites(listings), calls: tradeCalls(calls) }
}

/** A trade's calls, where there are enough of them to stand in for the Census. */
function measuredOf(facts, key) {
  const held = facts?.calls?.byTrade?.get(key)
  return held && held.reached >= MEASURED_AFTER ? held : null
}

// ── What the row says ─────────────────────────────────────────────────────

/**
 * What the business has for a site: `none`, `social`, `booking`, `portal`, or
 * `own`.
 *
 * A listing the map sweep found is read the way the sweep filed it, since the
 * sweep has already decided whether the site it names is the business's own. A
 * new company is read off its address: the mirror files the company it can
 * only ring as having no site, because there is no address on it to write to,
 * and the company still has the site the pipeline found.
 */
export function siteOf(row) {
  if (row?.source !== NEW_BUSINESS_SOURCE && row?.site_kind !== 'own') return presenceOf(row)
  const host = hostOf(row?.website)
  if (!host) return 'none'
  if (platformOf(host)) return presenceOf({ ...row, site_kind: 'social' })
  return 'own'
}

/** A number as its ten digits, or null where it is not a whole US number. */
function tenDigits(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return ten.length === 10 ? ten : null
}

/**
 * The owner's own number as ten digits, or null where the row has none.
 *
 * It is written two ways: by a Front Desk call, and by the owner finder that
 * reads a business's own pages for the person behind it. Either way it only
 * counts where it is a whole number and not the listing's main line, which
 * is the line that rings the front desk in the first place.
 */
export function ownerDigits(row) {
  const owner = tenDigits(row?.owner_phone)
  return owner && owner !== tenDigits(row?.phone) ? owner : null
}

/**
 * Days since a company was registered, read as calendar days in the studio's
 * zone, or null where the row carries no date. A filing dated ahead - a
 * company whose charter takes effect next month - is a day old.
 */
export function daysSince(date, now = new Date()) {
  const [year, month, day] = String(date ?? '')
    .split('-')
    .map(Number)
  if (!year || !month || !day) return null
  const [thisYear, thisMonth, today] = dayIn(now).split('-').map(Number)
  const days =
    (Date.UTC(thisYear, thisMonth - 1, today) - Date.UTC(year, month - 1, day)) / 86_400_000
  return Math.max(0, Math.round(days))
}

/** Whether the row carries the owner's name. */
export function nameKnown(row) {
  return Boolean(String(row?.owner_name ?? '').trim())
}

/**
 * Whether the owner's name is one two independent sources agree on - the
 * state record and the county's assumed-name filing, say, or a front desk and
 * the business's own site. Only a name on the row can be confirmed.
 */
export function nameConfirmed(row) {
  return nameKnown(row) && row?.owner_name_confirmed === true
}

/**
 * What is known about the owner's own number: `confirmed` where two sources
 * agree on it, `unconfirmed` where one gave it, and null where the row has no
 * number for the owner other than the listing's own.
 *
 * @returns {'confirmed'|'unconfirmed'|null}
 */
export function cellOf(row) {
  if (!ownerDigits(row)) return null
  return row?.owner_phone_confirmed === true ? 'confirmed' : 'unconfirmed'
}

/**
 * Every number the business can be rung on, ten digits each: the owner's own
 * first where there is one, then the listing's main line, then the numbers the
 * company's other listings carry where the company is at one location. A
 * company at two or more is held to its own two, since the rest ring other
 * branches.
 *
 * @returns {string[]}
 */
export function numbersOf(row) {
  const company = companyFor(row)
  const seen = new Set()
  const add = phone => {
    const ten = tenDigits(phone)
    if (ten) seen.add(ten)
  }
  add(ownerDigits(row))
  add(row?.phone)
  if ((company.locations ?? 1) <= 1) for (const ten of company.numbers ?? []) add(ten)
  return [...seen]
}

/**
 * The company a row belongs to: the one the endpoint read off every listing
 * (`row.company`, from `companiesOf`), or the row on its own.
 */
export function companyFor(row) {
  return row?.company ?? companyOfOne(row)
}

/**
 * Whether a calendar date is at least `years` before today in the studio's
 * zone. Null where there is no date.
 */
function yearsBefore(date, years, now) {
  const [year, month, day] = String(date ?? '')
    .split('-')
    .map(Number)
  if (!year || !month || !day) return null
  const then = `${String(year + years).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return then <= dayIn(now)
}

/**
 * What the business's size says, and whether it reads as staffed: two or more
 * locations, a state registration twenty or more years old, or three or more
 * officers on the state record. A signal nobody has read - no registration
 * date, no officer count - says nothing.
 *
 * @returns {{locations: number, registered: number|null, officers: number|null,
 *   old: boolean, staffed: boolean}}
 */
export function sizeOf(row, now = new Date()) {
  const company = companyFor(row)
  const locations = company.locations ?? 1
  const registeredOn = company.registeredOn ?? row?.registered_on ?? null
  const officers = company.officers ?? row?.officer_count ?? null
  const old = yearsBefore(registeredOn, OLD_YEARS, now) === true
  return {
    locations,
    registered: registeredOn ? Number(String(registeredOn).slice(0, 4)) : null,
    officers: Number.isInteger(officers) ? officers : null,
    old,
    staffed:
      locations >= LOCATIONS_STAFFED ||
      old ||
      (Number.isInteger(officers) && officers >= OFFICERS_STAFFED),
  }
}

/** The industry the row's company really is, or null where it is its trade. */
export function industryFor(row) {
  return companyFor(row).industry ?? null
}

/**
 * The trade-table row the business is read by: its industry's where it has
 * one the table carries, its trade's otherwise.
 */
function readingOf(row, facts) {
  const byTrade = facts?.trades?.byTrade
  const industry = industryFor(row)
  return (industry && byTrade?.get(industry)) || byTrade?.get(tradeKey(row?.trade)) || null
}

/** The share of firms with no employees the business is read by. */
export function soloOf(row, facts) {
  return readingOf(row, facts)?.solo ?? facts?.trades?.solo ?? NO_READING.solo
}

// ── The three scores ──────────────────────────────────────────────────────

/** Owner, unrounded. */
export function ownerScore(row, facts, now = new Date()) {
  const cell = cellOf(row)
  if (cell === 'confirmed') return CONFIRMED_CELL_OWNER
  const solo = soloOf(row, facts)
  // A trade's calls are about the trade; a supplier filed under it is read by
  // its own industry's Census reading instead.
  const measured = industryFor(row) ? null : measuredOf(facts, tradeKey(row?.trade))
  let score = measured
    ? (100 * (measured.reached - measured.frontDesk)) / measured.reached
    : 100 * solo
  if (storefrontOf(row?.address) === false) score += (100 - score) * NO_STOREFRONT_LIFT
  const age = daysSince(row?.formed_on, now)
  if (age !== null && age <= NEW_DAYS) score += (100 - score) * NEW_LIFT
  // A staffed business is read from the other side of the Census: the owner
  // answers about as often as the trade's firms with employees are the ones
  // the owner runs alone, which is to say rarely.
  if (sizeOf(row, now).staffed) score = Math.min(score, 100 * (1 - solo))
  // A number only one source gave rings the owner more often than not, past
  // any front desk; it never reads lower than the business would without it.
  if (cell === 'unconfirmed') score = Math.max(score, UNCONFIRMED_CELL_OWNER)
  return score
}

/** The part of a trade's listings with a site of their own, as Need reads it. */
export function shareOf(row, facts) {
  return facts?.sites?.byTrade?.get(tradeKey(row?.trade)) ?? facts?.sites?.overall ?? 0
}

/** Need, unrounded. */
export function needScore(row, facts, now = new Date()) {
  const site = siteOf(row)
  const age = daysSince(row?.formed_on, now)
  const points =
    site === 'own' && row?.source === NEW_BUSINESS_SOURCE && age !== null && age <= NEW_DAYS
      ? SITE_POINTS.newOwn
      : SITE_POINTS[site]
  let need = points * (0.5 + shareOf(row, facts) / 2)
  const measured = measuredOf(facts, tradeKey(row?.trade))
  const all = facts?.calls?.all
  const owners = measured ? measured.reached - measured.frontDesk : 0
  const allOwners = all ? all.reached - all.frontDesk : 0
  const overall = allOwners ? all.interested / allOwners : 0
  if (measured && owners > 0 && overall > 0) {
    need *= clamp(measured.interested / owners / overall, ...INTEREST_RANGE)
  }
  return Math.min(100, need)
}

/** Budget, unrounded. */
export function budgetScore(row, facts) {
  const table = facts?.trades
  if (!table?.low || !table?.high || table.high <= table.low) return NO_READING.budget
  const sales = readingOf(row, facts)?.sales ?? table.sales
  const spread =
    (Math.log(sales) - Math.log(table.low)) / (Math.log(table.high) - Math.log(table.low))
  return BUDGET_FLOOR + (100 - BUDGET_FLOOR) * clamp(spread, 0, 1)
}

/**
 * Everything the list ranks a business by and says about it.
 *
 * `owner`, `need` and `budget` are rounded for the page; `total` is the
 * product of the unrounded three, to one place, and is what the list sorts on.
 * `share`, `storefront`, `site`, `industry`, `size`, `named`, `nameConfirmed`,
 * `cell` and `numbers` are the readings the reasons line names.
 *
 * @param {object} row A business, with `formed_on` where it is a new company
 *   and `company` where the endpoint has read its listings together.
 * @param {ReturnType<typeof factsOf>} facts
 * @param {Date} [now]
 */
export function scoreOf(row, facts, now = new Date()) {
  const owner = ownerScore(row, facts, now)
  const need = needScore(row, facts, now)
  const budget = budgetScore(row, facts)
  const age = daysSince(row?.formed_on, now)
  const fresh = age !== null && age <= FRESH_DAYS
  const named = nameKnown(row)
  const confirmed = nameConfirmed(row)
  const boost = confirmed ? CONFIRMED_NAME_BOOST : named ? NAME_BOOST : 1
  const numbers = numbersOf(row).length
  const total =
    ((owner * need * budget) / 10_000) *
    (fresh ? FRESH_BOOST : 1) *
    boost *
    (numbers >= 2 ? TWO_NUMBERS_BOOST : 1)
  return {
    owner: Math.round(owner),
    need: Math.round(need),
    budget: Math.round(budget),
    total: Math.round(total * 10) / 10,
    fresh,
    named,
    nameConfirmed: confirmed,
    cell: cellOf(row),
    numbers,
    share: shareOf(row, facts),
    storefront: storefrontOf(row?.address),
    site: siteOf(row),
    industry: industryFor(row),
    size: sizeOf(row, now),
  }
}
