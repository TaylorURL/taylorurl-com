/**
 * Everyone who started a build and left an address, whether or not they
 * finished.
 *
 * The configurator asks for an address on its first step and opens the four
 * screens behind it once there is one. Every visitor who gets that far has
 * said who they are, and until this section existed the only ones the studio
 * ever heard about were the two who pressed a button at the end - the enquiry
 * and the payment. Everybody else was a session in the analytics and nothing
 * else: the warmest traffic the site gets, and the part of it the console
 * could say least about.
 *
 * Read only. There is no verb here that could write to one of these people,
 * because a list of addresses beside a button is a mistake waiting for a slow
 * afternoon. The follow-up is sent by the scheduled job on its own terms, and
 * what this endpoint does is let a person read what it is working from.
 *
 * The figures are counted rather than measured off the rows. A console
 * answering in a couple of seconds cannot carry every lead once there are
 * thousands, so the list is capped and says so, while each total is an exact
 * count that never travels through the cap. A headline that quietly stopped
 * being true at a thousand rows is worse than no headline.
 */

import { servedHereOr404 } from '../lib/http/guard.js'
import { authorizeAdmin, connect } from '../lib/db/clients.js'
import { countOf, tableMissing } from '../lib/db/rows.js'
import { LEADS } from '../lib/leads/record.js'

// What one answer carries. Newest first, so the cap takes the oldest leads
// rather than the ones somebody opened the section to read.
const LIST_ROWS = 500

// The columns the console draws. Named rather than starred so a column added
// to the table later is a decision to show it rather than a thing that appears.
const COLUMNS = [
  'id',
  'email',
  'trade',
  'step',
  'brief',
  'path',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'enquired_at',
  'checkout_at',
  'bought_at',
  'followed_up_at',
  'promo_code',
  'unsubscribed_at',
  'created_at',
  'updated_at',
].join(', ')

/**
 * The counts the strip across the top reads.
 *
 * Each is its own head request, which costs one round trip and carries no
 * rows. Six of them run together because they answer for the same instant and
 * asking them in turn would make the strip six readings of six moments.
 */
async function totals(db) {
  const of = filter => countOf(filter(db.from(LEADS).select('id', { count: 'exact', head: true })))

  const [all, enquired, checkout, bought, followed, gone] = await Promise.all([
    of(query => query),
    of(query => query.not('enquired_at', 'is', null)),
    of(query => query.not('checkout_at', 'is', null)),
    of(query => query.not('bought_at', 'is', null)),
    of(query => query.not('followed_up_at', 'is', null)),
    of(query => query.not('unsubscribed_at', 'is', null)),
  ])

  return { all, enquired, checkout, bought, followed, gone }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'GET only' })
  }

  const wired = connect()
  if (!wired) return response.status(503).json({ error: 'The database is not configured here.' })

  const account = await authorizeAdmin(wired, request.headers.authorization)
  if (account.status) return response.status(account.status).json({ error: account.error })

  try {
    const { data, error } = await wired.db
      .from(LEADS)
      .select(COLUMNS)
      .order('created_at', { ascending: false })
      .limit(LIST_ROWS)

    if (error) {
      // A section reaching a table its migration has not created yet answers
      // as an empty record rather than as a failure, so the console draws the
      // section rather than a refusal nobody can act on.
      if (tableMissing(error)) {
        return response.status(200).json({
          leads: [],
          totals: { all: 0, enquired: 0, checkout: 0, bought: 0, followed: 0, gone: 0 },
          complete: true,
        })
      }
      throw error
    }

    const counted = await totals(wired.db)

    response.setHeader('Cache-Control', 'private, no-store')
    return response.status(200).json({
      leads: data || [],
      totals: counted,
      complete: (data || []).length < LIST_ROWS,
      cap: LIST_ROWS,
    })
  } catch (cause) {
    console.error('leads-admin: %s', cause.message)
    return response.status(500).json({ error: 'The leads could not be read.' })
  }
}
