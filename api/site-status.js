/**
 * Whether a client's site should be serving, asked by the site itself.
 *
 * Every client site the studio runs carries a small piece of middleware that
 * asks this on each page load, and serves a holding page in place of the site
 * while the answer is yes. The answer is yes when the client has an invoice
 * that has sat unpaid for a week past the day it was owed, which is the rule
 * lib/billing/overdue.js holds.
 *
 * Which client pays for which site is a row in `client_sites`, keyed on the
 * site's address. A row can name no customer, for a site nobody is billed for
 * in Stripe, and it can be exempt, for a site that stays up whatever its
 * invoices say. Either one answers no. So does a site with no row at all: a
 * site the table has never heard of is one nobody decided to switch off.
 *
 * The money is read from Stripe on the request rather than copied into a
 * table, for the reason api/payments-admin.js gives: a copy is a second answer
 * to a question that already has one. What keeps that affordable is the edge.
 * The answer is cached there for five minutes, so a site asks Stripe through
 * this at most once every five minutes per region however much traffic it has,
 * and an invoice paid now brings the site back within the same five.
 *
 * A read that fails answers 503 and is never cached. The middleware reads
 * anything but a clean yes as no, so a Stripe outage or a slow database keeps
 * every client site serving rather than taking them all down together.
 *
 * GET ?site=example.com answers { paused }.
 */

import { holdsSite, siteName } from '../lib/billing/overdue.js'
import { connect } from '../lib/db/clients.js'
import { methodsOr405, servedHereOr404 } from '../lib/http/guard.js'
import { stripeList } from '../lib/stripe/read.js'

/** The read-only key where the deployment holds it, for the reason api/payments-admin.js gives. */
const SECRET_KEY = process.env.STRIPE_READONLY_KEY || process.env.STRIPE_SECRET_KEY || ''

/** How long the edge keeps an answer, and how long past that it may serve it while it asks again. */
const CACHED = 'public, max-age=0, s-maxage=300, stale-while-revalidate=300'

/**
 * Whether the named site is held by an unpaid invoice.
 *
 * Split out from the handler so the check can run it against a stub database
 * and a stub Stripe rather than the real ones.
 *
 * @param {string} site The bare host, as `siteName` reads it.
 * @param {{db: object, list: Function, now: Date}} deps
 * @returns {Promise<boolean>}
 */
export async function isPaused(site, { db, list, now }) {
  const { data, error } = await db
    .from('client_sites')
    .select('stripe_customer, exempt')
    .eq('domain', site)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.exempt || !data.stripe_customer) return false

  const { rows } = await list('invoices', { customer: data.stripe_customer, status: 'open' })
  return rows.some(invoice => holdsSite(invoice, now))
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (!methodsOr405(request, response, ['GET', 'HEAD'])) return

  const site = siteName(request.query?.site)
  if (!site) {
    response.setHeader('Cache-Control', CACHED)
    response.status(400).json({ error: 'Name the site to ask about, as ?site=example.com.' })
    return
  }

  const clients = connect()
  if (!clients || !SECRET_KEY) {
    response.setHeader('Cache-Control', 'no-store')
    response.status(503).json({ error: 'Site status is not configured on this deployment.' })
    return
  }

  try {
    const paused = await isPaused(site, {
      db: clients.db,
      list: (path, query) => stripeList(path, SECRET_KEY, query),
      now: new Date(),
    })
    response.setHeader('Cache-Control', CACHED)
    response.status(200).json({ paused })
  } catch (cause) {
    console.error('site-status: %s could not be read: %s', site, cause.message)
    response.setHeader('Cache-Control', 'no-store')
    response.status(503).json({ error: 'The site status could not be read.' })
  }
}
