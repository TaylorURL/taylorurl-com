/**
 * A proposal's figures, read one way by everything that reads them.
 *
 * The `/proposal` skill prints a sheet and saves what it printed as a profile:
 * the services, the Monthly Fee and the add-ons, each a name, a price and how
 * often it is charged. Three things read that profile back - the page the
 * sheet's QR code opens, the endpoint that turns a choice on that page into a
 * checkout, and the suite that holds the two together - and a figure worked
 * out twice is a figure that can come out two ways. So the reading lives here,
 * once, with no browser and no server in it.
 *
 * Prices arrive in dollars because that is how the skill writes them, and
 * leave in cents because that is the only unit Stripe takes. The conversion
 * refuses anything that is not a whole number of cents rather than rounding it
 * into something plausible: every price on a profile was typed into a chat, and
 * a fraction of a cent there is a typo to be found, not a charge to be guessed.
 *
 * Each line can also carry what a typical agency would charge for it, which
 * the sheet prints beside the price and the page shows the same way. It is
 * there to be read, never charged: nothing that opens a checkout looks at it.
 */

/**
 * How often a line is charged, and what each frequency means to Stripe.
 *
 * Quarterly is three months rather than a frequency of its own, because that
 * is how Stripe spells it. `months` orders them, so the shortest can be found.
 */
export const PERS = {
  once: { word: 'One time', months: 0, perYear: 0 },
  month: { word: 'Monthly', months: 1, perYear: 12, interval: 'month', count: 1, period: 'month' },
  quarter: {
    word: 'Quarterly',
    months: 3,
    perYear: 4,
    interval: 'month',
    count: 3,
    period: 'quarter',
  },
  year: { word: 'Yearly', months: 12, perYear: 1, interval: 'year', count: 1, period: 'year' },
}

/**
 * The most one line may cost. Not a policy about prices: the guard against a
 * zero typed twice, the same one the hand-opened payment link keeps.
 */
const LINE_CEILING_CENTS = 5000000

/** The private key a pay link carries: 18 random bytes, base64url. */
export const PROPOSAL_KEY = /^[A-Za-z0-9_-]{24}$/

/**
 * A price in dollars as whole cents, or null where it is not one.
 *
 * @param {unknown} price
 * @returns {number|null}
 */
export function centsOf(price) {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null
  const cents = Math.round(price * 100)
  if (Math.abs(cents - price * 100) > 1e-6) return null
  if (cents > LINE_CEILING_CENTS) return null
  return cents
}

/**
 * An agency estimate in dollars as whole cents: null where the line has none,
 * undefined where it has one that will not read.
 */
function estimateOf(price) {
  if (price === undefined || price === null) return null
  const cents = centsOf(price)
  return cents === null ? undefined : cents
}

/**
 * One line off a profile, as the page and the checkout use it.
 *
 * `agency` is what a typical agency would charge for the line in the line's
 * own billing, and `agencySetup` a one-time setup the agency adds on top; a
 * profile saved before the sheet carried them reads with `agency` null.
 *
 * @param {unknown} raw A line as the skill saved it.
 * @returns {{name: string, cents: number, per: string, extra: string,
 *   agency: number|null, agencySetup: number}|null}
 */
export function lineOf(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name || name.length > 120) return null
  const per = raw.per ?? 'once'
  if (!Object.prototype.hasOwnProperty.call(PERS, per)) return null
  const cents = centsOf(raw.price)
  if (cents === null) return null
  const extra = typeof raw.extra === 'string' ? raw.extra.trim().slice(0, 120) : ''
  const agency = estimateOf(raw.agency)
  const agencySetup = estimateOf(raw.agency_setup)
  if (agency === undefined || agencySetup === undefined) return null
  if (agency === null && agencySetup !== null) return null
  return { name, cents, per, extra, agency, agencySetup: agencySetup ?? 0 }
}

/**
 * Every line in a saved list, or null when any one of them will not read.
 *
 * All or nothing, because a page that quietly dropped the line it could not
 * read would show a total that leaves out a charge the sheet in their hand
 * carries.
 *
 * @param {unknown} list
 * @returns {Array<{name: string, cents: number, per: string, extra: string}>|null}
 */
export function linesOf(list) {
  if (!Array.isArray(list)) return null
  const lines = list.map(lineOf)
  return lines.every(Boolean) ? lines : null
}

/** What the billing column says, the way the printed sheet says it. */
export function billingWord(line) {
  return line.cents === 0 ? 'No charge' : PERS[line.per].word
}

/** Cents as the dollars a person reads: `$2,500`, or `$12.50` where there are cents. */
export function money(cents) {
  const dollars = cents / 100
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString('en-US')}`
    : `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * What a set of lines comes to.
 *
 * `today` is what the checkout charges before tax: every one-time line and the
 * first period of every recurring one. The rows are the sheet's own totals -
 * first year and each year after when there is a mix, one figure when there is
 * not - so the page and the paper agree line for line.
 *
 * @param {Array<{cents: number, per: string}>} lines
 * @returns {{today: number, rows: Array<[string, number]>}}
 */
export function totals(lines) {
  const today = lines.reduce((sum, line) => sum + line.cents, 0)
  const once = lines.filter(line => line.per === 'once').reduce((sum, line) => sum + line.cents, 0)
  const yearly = lines
    .filter(line => line.per !== 'once')
    .reduce((sum, line) => sum + line.cents * PERS[line.per].perYear, 0)
  if (yearly && once) {
    return {
      today,
      rows: [
        ['First year', once + yearly],
        ['Each year after', yearly],
      ],
    }
  }
  if (yearly) return { today, rows: [['Per year', yearly]] }
  return { today, rows: [['Total', once]] }
}

/**
 * What a typical agency would charge for the same lines, totalled the way the
 * sheet totals its own, or null where any line has no estimate: a comparison
 * that left a line out would make the agency look cheaper than it is.
 *
 * @param {Array<{per: string, agency: number|null, agencySetup: number}>} lines
 * @returns {Array<[string, number]>|null}
 */
export function agencyTotals(lines) {
  const theirs = agencyLines(lines)
  return theirs ? totals(theirs).rows : null
}

/** The same lines at what an agency charges, its setups as one one-time line. */
function agencyLines(lines) {
  if (!lines.length || lines.some(line => line.agency === null || line.agency === undefined)) {
    return null
  }
  const setups = lines.reduce((sum, line) => sum + (line.agencySetup || 0), 0)
  const priced = lines.map(line => ({ cents: line.agency, per: line.per }))
  return setups ? [...priced, { cents: setups, per: 'once' }] : priced
}

/** The first year and each year after, in cents, whatever shape the totals take. */
function yearsOf(lines) {
  const once = lines.filter(line => line.per === 'once').reduce((sum, line) => sum + line.cents, 0)
  const yearly = lines
    .filter(line => line.per !== 'once')
    .reduce((sum, line) => sum + line.cents * PERS[line.per].perYear, 0)
  return { first: once + yearly, after: yearly }
}

/**
 * What these lines save against a typical agency: the first year and each year
 * after, in cents, or null where the agency figure cannot be totalled.
 *
 * @param {Array<{cents: number, per: string, agency: number|null, agencySetup: number}>} lines
 * @returns {{first: number, after: number}|null}
 */
export function savingsOf(lines) {
  const theirs = agencyLines(lines)
  if (!theirs) return null
  const a = yearsOf(theirs)
  const b = yearsOf(lines)
  return { first: a.first - b.first, after: a.after - b.after }
}

/**
 * The add-ons a visitor ticked, as lines, or the reason the choice cannot stand.
 *
 * Matched by exact name against the add-ons on the profile and nothing else, so
 * the only thing a request can do is pick from what the sheet offered; a name
 * that is not there, or one named twice, is refused rather than ignored.
 *
 * @param {Array<{name: string}>} offered The add-ons on the profile.
 * @param {unknown} names What the page sent.
 * @returns {{lines: Array<object>}|{error: string}}
 */
export function picked(offered, names) {
  if (names === undefined || names === null) return { lines: [] }
  if (!Array.isArray(names) || names.some(name => typeof name !== 'string')) {
    return { error: 'The add-ons have to be a list of names.' }
  }
  if (new Set(names).size !== names.length) return { error: 'An add-on was named twice.' }
  const lines = []
  for (const name of names) {
    const line = offered.find(addon => addon.name === name)
    if (!line) return { error: `${name} is not an add-on on this proposal.` }
    lines.push(line)
  }
  return { lines }
}

/**
 * How a set of lines is charged.
 *
 * Stripe's checkout opens one subscription and every recurring price on it has
 * to share one interval; asked for a monthly fee and a quarterly add-on
 * together it refuses outright. So the shortest interval among the recurring
 * lines is the subscription the checkout opens, and every other recurring line
 * is charged its first period at the checkout as a one-time line and gets a
 * subscription of its own once the payment has cleared, starting one period
 * on. The visitor pays everything due today in one place, and nothing is
 * charged twice.
 *
 * Lines that cost nothing are left off: there is nothing to charge, and a $0
 * line on a receipt reads as a mistake.
 *
 * @param {Array<{name: string, cents: number, per: string}>} lines
 * @returns {{
 *   mode: 'payment'|'subscription',
 *   base: string|null,
 *   now: Array<{line: object, recurring: object|null}>,
 *   later: Array<object>,
 * }}
 */
export function checkoutPlan(lines) {
  const charged = lines.filter(line => line.cents > 0)
  const recurring = charged.filter(line => line.per !== 'once')
  if (!recurring.length) {
    return {
      mode: 'payment',
      base: null,
      now: charged.map(line => ({ line, recurring: null })),
      later: [],
    }
  }
  const base = recurring.reduce(
    (shortest, line) => (PERS[line.per].months < PERS[shortest].months ? line.per : shortest),
    recurring[0].per
  )
  return {
    mode: 'subscription',
    base,
    now: charged.map(line => ({ line, recurring: line.per === base ? PERS[base] : null })),
    later: recurring.filter(line => line.per !== base),
  }
}
