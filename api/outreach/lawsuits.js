/**
 * Files every business sued in federal court over its website's accessibility
 * in the last two weeks, so the pipeline writes to it while the suit is new.
 *
 * What it does: asks CourtListener for nature-of-suit 446 cases whose
 * complaint talks about a screen reader and a website, filed inside
 * LOOKBACK_DAYS. For each docket not already on file it asks the same search
 * for the words around the site's address in the complaint, reads the site out
 * of them, and looks at the site's home page once to see whether it is a
 * Shopify store. A store is filed as skipped with the reason said; everything
 * else is filed at stage 'found', where enrich finds an address on the site
 * and the sender writes to it with the letter written for a lawsuit. See
 * lib/outreach/prospects/lawsuits.js for why each read is the shape it is.
 *
 * What it reads: CourtListener's public search endpoint, which needs no
 * token, and COURTLISTENER_TOKEN where one is set, which only raises the rate
 * limit. The home page of each new defendant's site.
 *
 * What it writes: `outreach_prospects`, inserted on (source, source_ref) with
 * the case beside the business. A row already on file is left alone, since a
 * suit read again says nothing new and the row may be further along than a
 * search knows.
 *
 * What stops it: sourcing_enabled being false, the same switch the map
 * sweep reads, and the search itself failing.
 */

import { promises as dns } from 'node:dns'

import { servedHereOr404 } from '../../lib/http/guard.js'
import { runJob } from '../../lib/outreach/runtime.js'
import {
  BARE_DOMAIN_TERMS,
  LAWSUIT_SOURCE,
  SHOPIFY_REASON,
  isShopify,
  isShopifyCart,
  isShopifyDns,
  prospectOfSuit,
  siteUrl,
  suitsUrl,
  websiteOfResult,
} from '../../lib/outreach/prospects/lawsuits.js'

const TOKEN = process.env.COURTLISTENER_TOKEN || ''

/**
 * How far back a run looks. Two weeks is inside the window where a defendant
 * is still choosing who fixes the site, and a run every few hours reads the
 * same fortnight over, which is what makes a missed run cost nothing.
 */
const LOOKBACK_DAYS = 14

/** Pages of search results a run reads, twenty suits to a page. */
const PAGES_MAX = 5

/** New dockets one run looks into, since each costs a search and a page fetch. */
const NEW_PER_RUN = 25

const FETCH_TIMEOUT_MS = 15_000

export const config = { maxDuration: 300 }

async function courtlistener(url) {
  const answer = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: 'application/json',
      ...(TOKEN ? { Authorization: `Token ${TOKEN}` } : {}),
    },
  })
  if (!answer.ok) {
    const said = (await answer.text().catch(() => '')).slice(0, 200)
    throw new Error(`courtlistener answered ${answer.status} ${said}`.trim())
  }
  return answer.json()
}

/** Every website suit filed since a day, newest first, up to PAGES_MAX pages. */
async function suitsSince(day) {
  const suits = []
  let url = suitsUrl(day)
  for (let page = 0; url && page < PAGES_MAX; page += 1) {
    const body = await courtlistener(url)
    suits.push(...(body.results ?? []))
    url = body.next ?? null
  }
  return suits
}

/** The site a docket's complaint names, or null where the archive shows none. */
async function siteOf(docketId) {
  for (const terms of [undefined, BARE_DOMAIN_TERMS]) {
    const body = await courtlistener(siteUrl(docketId, terms))
    for (const result of body.results ?? []) {
      const site = websiteOfResult(result)
      if (site) return site
    }
  }
  return null
}

/** The site's home page, or null where it would not answer. */
/**
 * What a site's host and its www resolve to, for `isShopifyDns`. A lookup that
 * fails answers nothing, which reads as not Shopify, the same as before.
 */
async function resolved(site) {
  const host = new URL(site).hostname.replace(/^www\./, '')
  const settle = promise => promise.catch(() => [])
  const [cnames, apex, www] = await Promise.all([
    settle(dns.resolveCname(`www.${host}`)),
    settle(dns.resolve4(host)),
    settle(dns.resolve4(`www.${host}`)),
  ])
  return { cnames, addresses: [...apex, ...www] }
}

/** What a site answers at Shopify's cart path, or null where it would not answer. */
async function cartOf(site) {
  try {
    const answer = await fetch(new URL('/cart.js', site), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TaylorURL)', Accept: 'application/json' },
    })
    return answer.ok ? await answer.text() : null
  } catch {
    return null
  }
}

/**
 * Whether a site is a Shopify store, asked three ways since each can be turned
 * away on its own: the DNS, the cart, and the page.
 */
async function onShopify(site) {
  if (isShopifyDns(await resolved(site))) return true
  if (isShopifyCart(await cartOf(site))) return true
  return isShopify(await homePage(site))
}

async function homePage(site) {
  try {
    const answer = await fetch(site, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TaylorURL)' },
    })
    return answer.ok ? await answer.text() : null
  } catch {
    return null
  }
}

async function onFile(db, refs) {
  if (!refs.length) return new Set()
  const { data, error } = await db
    .from('outreach_prospects')
    .select('source_ref')
    .eq('source', LAWSUIT_SOURCE)
    .in('source_ref', refs)
  if (error) throw new Error(error.message)
  return new Set(data.map(row => row.source_ref))
}

function dayBefore(now, days) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export async function work({ db, settings, counts, now = new Date() }) {
  if (!settings.sourcing_enabled) return { skipped: 'sourcing is switched off' }

  const suits = await suitsSince(dayBefore(now, LOOKBACK_DAYS))
  counts.examined += suits.length

  const refs = suits.map(suit => String(suit.docket_id)).filter(Boolean)
  const known = await onFile(db, refs)
  const fresh = suits.filter(suit => suit.docket_id && !known.has(String(suit.docket_id)))

  let filed = 0
  let stores = 0
  let siteless = 0
  const failures = []
  for (const suit of fresh.slice(0, NEW_PER_RUN)) {
    let site
    try {
      site = await siteOf(suit.docket_id)
    } catch (cause) {
      failures.push(`${suit.caseName}: ${cause.message}`)
      continue
    }
    const row = prospectOfSuit(suit, site)
    if (!row) continue
    // A suit whose complaint names no site the archive shows is still a
    // business in need, but one the pipeline has no way to reach: enrich
    // finds an address on a site, and without one it would guess a domain
    // from the name with no town or phone to prove it by. It is filed so the
    // console shows it and the next run does not ask again.
    if (!site) {
      row.stage = 'unreachable'
      row.site_kind = 'none'
      siteless += 1
    } else if (await onShopify(site)) {
      row.stage = 'skipped'
      row.skip_reason = SHOPIFY_REASON
      stores += 1
    }

    const { error } = await db
      .from('outreach_prospects')
      .upsert(row, { onConflict: 'source,source_ref', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
    filed += 1
    counts.changed += 1
  }

  if (failures.length && !filed) throw new Error(failures[0])

  const writable = filed - stores - siteless
  return {
    suits: suits.length,
    fresh: fresh.length,
    filed,
    stores,
    siteless,
    note: `Read ${suits.length} website suits from the last ${LOOKBACK_DAYS} days: filed ${filed} new, ${writable} to write to, ${stores} on Shopify, ${siteless} with no site named.`,
    ...(fresh.length > NEW_PER_RUN ? { left: fresh.length - NEW_PER_RUN } : {}),
    ...(failures.length ? { failures: failures.slice(0, 3) } : {}),
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runJob({ request, response, job: 'lawsuits', work })
}
