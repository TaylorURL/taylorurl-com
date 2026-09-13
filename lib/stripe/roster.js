/**
 * Which of the money in the Stripe account belongs to a website client, and
 * how to read an invoice that predates the checkout.
 *
 * One account takes payments for more than one trade. Alongside the builds and
 * the care that runs them it has carried go-kart hire and a game store, and a
 * console section that listed those beside a client would be a section nobody
 * could read a figure off. So the money is sorted before it is shown, and the
 * sorting is a rule rather than a list wherever a rule will do it.
 *
 * The rule that does nearly all of the work: a website client is a Stripe
 * customer. Every build and every monthly is billed to a customer record
 * because an invoice needs one, while the other trades take card payments at a
 * counter with no customer attached at all. That one test removes every go-kart
 * hire and every game-store sale without naming any of them, and it keeps
 * working for whatever either trade sells next.
 *
 * What the rule cannot do is tell a client from the studio’s own card, or from
 * somebody who paid one invoice years ago and never came back. Those facts are
 * about named people, so they are rows in `stripe_roster` rather than lines in
 * this file. The repository is public and a customer is not: an id, an address
 * and the reason a person is not a client are the customer’s, and the database
 * is the only place they belong. Nothing here names anybody.
 *
 * Everything else is read off the invoice. An invoice states its lines and what
 * each one came to, so what a client paid to have the site made and what they
 * pay to keep it running are two figures Stripe already holds separately, even
 * on the one invoice that charged for both at once. Nothing here restates an
 * amount: money has one source and it is Stripe.
 */

/**
 * A roster holding nothing.
 *
 * What a caller must never quietly fall back to: an empty roster reports the
 * studio’s own card as a client and reads an up-front fee as a monthly one.
 * Wrong figures on a money screen are worse than no screen, so a caller that
 * cannot load the roster refuses rather than substitutes this.
 *
 * @returns {{notClients: Map<string, string>, setupInvoices: Map<string, string>, offStripe: Map<string, string>}}
 */
function emptyRoster() {
  return { notClients: new Map(), setupInvoices: new Map(), offStripe: new Map() }
}

/**
 * The roster, read from the database.
 *
 * Each row carries its reason alongside its id, because a bare list of ids is a
 * list nobody can audit a year later, and the first time one of them turns out
 * to be a real client the reason is the only thing that says so.
 *
 * @param {object} db A service-role Supabase client.
 * @returns {Promise<{notClients: Map, setupInvoices: Map, offStripe: Map}|null>}
 *   The roster, or null where the table could not be read.
 */
export async function loadRoster(db) {
  const { data, error } = await db.from('stripe_roster').select('kind, ref, note')
  if (error) {
    console.error('roster: the roster could not be read', error.message)
    return null
  }

  const roster = emptyRoster()
  // The three things the roster records, and what each one is keyed on.
  // `not_client` is a Stripe customer id whose money is not a client’s.
  // `setup_invoice` is an invoice id that is an up-front fee in full, whatever
  // its lines say. `off_stripe` is the address of a client the studio bills by
  // hand, whom no Stripe subscription renews.
  const into = {
    not_client: roster.notClients,
    setup_invoice: roster.setupInvoices,
    off_stripe: roster.offStripe,
  }
  for (const row of data || []) {
    const bucket = into[row?.kind]
    if (bucket && row.ref) bucket.set(row.ref, row.note || '')
  }
  return roster
}

/** The words a line uses for the fee that has the site made. */
const SETUP_WORDS = /set[- ]?up/i

/** The words a line uses for a fee charged once a year rather than once a month. */
const YEARLY_WORDS = /annual|yearly/i

/**
 * Whether this customer's money is a website client's.
 *
 * @param {object} customer A Stripe customer.
 * @param {{notClients: Map<string, string>}} roster The roster.
 * @returns {boolean}
 */
export function isClient(customer, roster) {
  return Boolean(customer?.id) && !roster.notClients.has(customer.id)
}

/**
 * The address a client is known by.
 *
 * Two customer records can carry one person: a client invoiced under their own
 * name in the first month and under the business afterwards is two records and
 * one client, and reading them apart would halve their history and show the
 * up-front fee against a client who appears to pay nothing. The address is what
 * puts them back together, so it is what the record is keyed on.
 *
 * @param {object} customer A Stripe customer.
 * @returns {string|null}
 */
export function clientKey(customer) {
  const email = customer?.email
  return typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null
}

/**
 * What of an invoice was the up-front fee for the build.
 *
 * Read line by line rather than off the total, because one invoice can carry
 * both fees at once: the client who paid for the year in advance was charged
 * the setup and the first year together, and calling that whole total an
 * up-front fee would overstate what the build cost by the price of a year.
 *
 * @param {object} invoice A Stripe invoice.
 * @param {{setupInvoices: Map<string, string>}} roster The roster.
 * @returns {number} Cents of up-front fee, or zero where the invoice held none.
 */
export function setupCents(invoice, roster) {
  if (!invoice) return 0
  if (roster.setupInvoices.has(invoice.id)) return invoice.total || 0
  return (invoice.lines?.data || [])
    .filter(line => SETUP_WORDS.test(line?.description || ''))
    .reduce((sum, line) => sum + (line.amount || 0), 0)
}

/**
 * The recurring fee an invoice carries, where it carries one.
 *
 * A subscription's own invoice is not read through here - the subscription
 * states its price and its interval directly, and is the better answer whenever
 * it exists. This is for the invoices written by hand, where the line's own
 * words are the only thing that says whether the fee comes round in a month or
 * in a year.
 *
 * An invoice the roster calls an up-front fee has no recurring part at all,
 * however its lines are worded. That is the whole reason the roster records it.
 *
 * @param {object} invoice A Stripe invoice.
 * @param {{setupInvoices: Map<string, string>}} roster The roster.
 * @returns {{cents: number, interval: string}|null}
 */
export function recurringLine(invoice, roster) {
  if (!invoice || roster.setupInvoices.has(invoice.id)) return null
  const lines = (invoice.lines?.data || []).filter(
    line => !SETUP_WORDS.test(line?.description || '')
  )
  if (!lines.length) return null

  const cents = lines.reduce((sum, line) => sum + (line.amount || 0), 0)
  if (!cents) return null

  const yearly = lines.some(line => YEARLY_WORDS.test(line?.description || ''))
  return { cents, interval: yearly ? 'year' : 'month' }
}
