/**
 * Decides which businesses are worth writing to, and reads the contact address
 * each of those publishes on its own website.
 *
 * What it does: sweeps the stored rows against the rules, then takes a batch
 * of prospects at stage 'found' and settles each one. A held domain, a
 * business type that cannot buy, a national brand, a chain domain or a name
 * that says the company is too large stops the row at 'skipped' with the rule
 * that stopped it in skip_reason. Everything else has its website fetched and
 * read twice over: for the signs of a company with departments, which stop it
 * the same way, and for an email address. The home page is read first, then
 * /contact, /contact-us and /about. Only an address at the site's own domain
 * counts, since an address at a directory or a social network belongs to
 * somebody else; among those, a person's own name is taken first, and one
 * printed on a contact page beats one printed anywhere else. Where the site
 * prints no name, its open inbox is taken instead, because at this size of
 * business info@ is the address the owner reads. A department's inbox is no
 * answer at all, so a site that prints nothing but sales@ and dispatch@ is a
 * site with no address on it.
 *
 * The rules live in lib/outreach/exclusions.js beside the reasons they write.
 * Most answer off one row; the domain count needs the whole table, since a
 * franchise only shows itself once its third town has been searched, which is
 * why every run reads the stored rows before it reads its batch. The sweep
 * over those rows applies every row rule, not only the count, so a rule
 * written this week reaches a business enriched last month: a row a rule
 * catches is moved to 'skipped' wherever it had reached, and a row holding an
 * address the sender now refuses is put back to 'found' without it, with its
 * draft retired, so it is read again for a name. Neither touches a row that
 * has already been written to.
 *
 * The sweep reads the rules in both directions. A skipped row no rule catches
 * any more goes back to 'found', so a domain taken off the held list or a
 * brand taken out of a group returns the businesses that rule stopped instead
 * of leaving the lists able only to grow. Only a reason a rule composed comes
 * back: the console's Skip writes a person's own sentence, and a business
 * somebody took out by hand stays out. A rule that reads a site rather than a
 * row is never taken back either, since reviving one would fetch the site,
 * find the same signs and skip it again on a loop.
 *
 * What it reads: `outreach_prospects` at stage 'found', every stored row's
 * host, town and skip reason, and the public pages of the websites those rows
 * name. No credentials.
 *
 * A listing pointing at a platform profile is read differently and not
 * discarded. The business owns no site, which makes it the strongest lead on
 * the list rather than a dead one, so the profile is read for a linked address
 * and the domain rule inverts: the address worth having is the one that is not
 * at the platform. Such a row is marked site_kind 'social' and enriched like
 * any other, and from there the audit's queue passes over it and the send job
 * takes it straight from 'enriched'.
 *
 * What it writes: the same rows. An address found sets email, email_source to
 * the page it was printed on, site_kind, and stage 'enriched'. No website
 * listed, a site that does not answer, a site that prints no address of its
 * own, or a profile that links none stops at 'unreachable' with the reason in
 * skip_reason, which is what that stage means: no way left to reach them.
 *
 * What stops it: an empty queue. Each fetch carries its own short timeout and
 * a batch is small, so a slow site costs one row rather than the run.
 */

import { servedHereOr404 } from '../../lib/http/guard.js'
import { mapWithLimit, runJob } from '../../lib/outreach/runtime.js'
import { field } from '../../lib/db/fields.js'
import {
  bareHost,
  chainDomainReason,
  chainDomainsIn,
  corporateReason,
  corporateSignsIn,
  hostOf,
  platformOf,
  rowRuleOf,
  rowRuleWrote,
} from '../../lib/outreach/exclusions.js'
import { findSite } from '../../lib/outreach/site-search.js'
import { mailboxKind, shapeOf } from '../../lib/outreach/address.js'

/**
 * Prospects one run reads.
 *
 * This is what the send queue is made of, several stages downstream, and the
 * arithmetic runs backwards from there. Roughly a tenth of the businesses read
 * here publish an address a person owns at the site's own domain, which is all
 * the sender will write to, so a day that puts out its full cap needs about ten
 * times that many rows enriched to find them. At eight a run, seventy-two runs
 * a day, the ceiling was five hundred and seventy-six, which is a day's cap of
 * fifty-odd however high the console sets the real one - and the queue running
 * dry looks from the sender's end exactly like a day with nobody left to write
 * to.
 *
 * The bound that matters is the run's own window rather than this number, and
 * the window is not spent the way the depth of the pool suggests. Reading a
 * site is spent waiting, but scanning what comes back is not: every page is
 * matched against the address patterns and the corporate signs, and that is
 * synchronous work on the one thread the run has. Widening the pool buys no
 * parallelism for it. It only puts more bytes through the same thread.
 *
 * Twenty-four is what the job has actually finished at, in thirteen to forty
 * seconds. Forty-eight was tried on the reading that the pool was the whole
 * cost, and it did not finish in two minutes or in five.
 */
const BATCH = 24
/**
 * Prospects fetched at once, which bounds a run at two slow sites deep.
 *
 * Reading a site is spent waiting on somebody else's server, so the pool is
 * sized by the window rather than by the machine. A prospect costs at worst
 * four page reads at six seconds, or six candidate domains at the same six
 * when the listing named no site at all, which is about forty seconds; two of
 * those deep is eighty, inside the five minutes the run is given.
 *
 * It moves with BATCH for that reason. Raising the batch alone would buy the
 * throughput by making the run deeper, which is the one direction the window
 * has nothing left to give.
 */
const CONCURRENCY = 12
/**
 * Why the two numbers above are held where a run has finished, rather than
 * where the arithmetic says they fit.
 *
 * Holding BATCH over CONCURRENCY at two keeps the pool two rows deep whatever
 * the width, so on the reading that a run is spent waiting on other people's
 * servers, doubling both should have cost nothing. It was doubled to
 * forty-eight and twenty-four on 2026-09-04 and the job stopped finishing:
 * every run from 03:10 was killed at the two minutes it then had, and the
 * first run at five minutes was killed too. Twice the work did not take twice
 * the time; it took more than four times it.
 *
 * Waiting is not the whole of a run. Each page that answers is scanned for
 * addresses and for corporate signs, over as much as PAGE_LIMIT of HTML, and
 * that is synchronous work on the single thread this has. A wider pool does
 * not run it in parallel - it queues more of it against the same thread, and
 * the waiting the width was supposed to overlap is already overlapped. So the
 * width buys throughput only until the scanning is what the run is short of,
 * and past that it buys nothing and costs the run.
 *
 * What being wrong here costs is not a slow run. Nothing is written until
 * every site in the pool has been read, so a run killed at the ceiling
 * discards the whole batch and the next one starts on the same rows: fifty-one
 * consecutive runs examined nothing, the queue stood still for eight and a
 * half hours, and every run recorded examined 0, which is what a run with no
 * work to do also records.
 */
const FETCH_TIMEOUT_MS = 6000
/** Characters of a page read; an address printed past this is not found. */
const PAGE_LIMIT = 300_000
const EMAIL_MAX = 254

/**
 * Why a site with no address on it stopped, told apart by whether it answered.
 *
 * The two readings are not the same fact and the retry below turns on which
 * one it is. A site that answered and printed no address has been read, and
 * reading it again next week gets the same nothing. A site that did not answer
 * has not been read at all: it was down for a minute, it was slow past the
 * timeout, or it refused this one request, and none of that is a statement
 * about whether the business publishes an address.
 */
const NO_ADDRESS = 'no address published on the site'
const NO_ANSWER = 'the site did not answer'

/**
 * How long each kind of dead end is left before the site is read again.
 *
 * A site that did not answer has not been read at all, so it is asked again in
 * days: an outage should cost a business a few days on the list rather than
 * its place on it. A site that answered and printed no address has been read,
 * and asking it again next week gets the same nothing - but not next month.
 * Businesses put an address up, change the page it is on, and swap a contact
 * form for a mailbox, and a reading taken once and kept forever is a list that
 * only ever shrinks.
 *
 * Nothing counts the attempts, so the age is the whole bound: a site that
 * never answers is asked once every three days forever, and one that prints
 * nothing is asked once a month, which is the same cost as a row nobody looks
 * at.
 */
const RETRY_AFTER_DAYS = { [NO_ANSWER]: 3, [NO_ADDRESS]: 30 }
/** Rows one retry takes back, so a sweep of them cannot crowd out fresh listings. */
const RETRY_LIMIT = 100

/** Rows the chain count reads at a time. */
const SWEEP_PAGE = 1000
/** Pages it reads before it stops, which is well past the size of the search grid. */
const SWEEP_PAGES = 10
/** Rows one skip writes at a time. */
const SWEEP_CHUNK = 200

// The stages a rule can still catch a row at. A row already written to is
// history and moving it to 'skipped' would say a message was never sent; a row
// that has already stopped has nowhere further to go.
const SWEEPABLE = new Set(['found', 'enriched', 'audited', 'queued'])

/** What a draft retired by the sweep records, so the row reads as retried rather than lost. */
const RETIRED = 'address passed over: the sender no longer writes to it'

/**
 * The run's window, which is the audit job's and the sender's.
 *
 * Two minutes fitted a batch of twenty-four and stopped fitting one of
 * forty-eight. The width is what the queue needs, so the window is what moves.
 */
export const config = { maxDuration: 300 }

// The pages tried, and what an address printed on each is worth. A contact
// page is where a business puts the address it wants used, so an address found
// there outranks one lifted from a footer.
const PAGES = [
  { path: null, rank: 1 },
  { path: '/contact', rank: 2 },
  { path: '/contact-us', rank: 2 },
  { path: '/about', rank: 1 },
]

const MAILTO = /mailto:([^"'?\s>]+)/gi
const BARE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g

// A retina descriptor in a srcset reads as an address to any pattern that
// takes a word, an at sign and a dotted suffix: logo@2x.png is the shape.
// Nothing ending in a file extension is an address.
const ASSET_ENDING =
  /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp|css|js|json|woff2?|ttf|mp4|webm|pdf|zip)$/i

const USER_AGENT =
  'Mozilla/5.0 (compatible; TaylorURLOutreach/1.0; +https://www.taylorurl.com/contact)'

/** The site as a URL, tolerating a listing that left the scheme off. */
function siteUrl(website) {
  const value = typeof website === 'string' ? website.trim() : ''
  if (!value) return null
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** One page's HTML, or null when the site does not answer with any. */
async function page(url) {
  try {
    const upstream = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT },
    })
    if (!upstream.ok) return null
    if (!(upstream.headers.get('content-type') || '').includes('text/html')) return null
    return (await upstream.text()).slice(0, PAGE_LIMIT)
  } catch {
    return null
  }
}

/**
 * Every address printed on a page, the ones a link points at first.
 *
 * `linkedOnly` drops the addresses read out of plain text. A profile page on a
 * platform carries scripts, tracking payloads and the platform's own contact
 * details, and a mailto is the one address on such a page that somebody chose
 * to publish.
 */
function addressesIn(html, linkedOnly = false) {
  const found = []
  const seen = new Set()

  const keep = value => {
    let email = value.trim().toLowerCase().replace(/\.$/, '')
    try {
      email = decodeURIComponent(email)
    } catch {
      // A stray percent in a mailto is not an escape; the address stands as written.
    }
    if (email.length > EMAIL_MAX || ASSET_ENDING.test(email) || seen.has(email)) return
    seen.add(email)
    found.push(email)
  }

  for (const match of html.matchAll(MAILTO)) keep(match[1])
  if (!linkedOnly) for (const match of html.matchAll(BARE)) keep(match[0])
  return found
}

/** Whether an address belongs to the site printing it rather than to a third party. */
function ownDomain(email, host) {
  const domain = email.slice(email.indexOf('@') + 1)
  const site = bareHost(host)
  return domain === site || site.endsWith(`.${domain}`) || domain.endsWith(`.${site}`)
}

/**
 * What one address on one page is worth.
 *
 * Three kinds are worth having and they are worth an order of magnitude apart,
 * so the kind decides before the page does: any name anywhere on the site is
 * taken over every info@ on it, and any info@ is taken over every sales@. The
 * page then settles ties within a kind, which is how a name on a contact page
 * outranks a name in a footer.
 *
 * A desk is worth having because at this size of business it is read by the
 * owner. It comes last because where a site prints both a name and a desk, the
 * name is the person who decides. Zero is a machine's box, which is the only
 * thing here nobody opens.
 */
function worth(email, rank) {
  const kind = mailboxKind(email.slice(0, email.indexOf('@')))
  if (kind === 'person') return rank * 100
  if (kind === 'general') return rank * 10
  if (kind === 'department') return rank
  return 0
}

/**
 * A person on a contact page, which is the most a site can give.
 *
 * The reader stops looking at it, so it has to be the top of the scale above
 * and not a figure of its own: set below it, a site would stop on its best
 * page and never read the one that prints the owner's name.
 */
const BEST_WORTH = 200

/**
 * The best address printed on one page at the site's own domain, or null when
 * it prints none worth having.
 *
 * Exported for the check that reads a page without fetching one.
 */
export function contactIn(html, host, rank) {
  let best = null
  for (const email of addressesIn(html)) {
    if (!ownDomain(email, host)) continue
    const score = worth(email, rank)
    if (score > (best?.score ?? 0)) best = { email, score }
  }
  return best
}

/**
 * The address the site publishes, the page it was printed on, and every sign
 * on the pages read that the business is too large to buy.
 */
async function contactFor(url) {
  let answered = false
  let best = null
  const signs = []

  for (const { path, rank } of PAGES) {
    const target = path ? new URL(path, url.origin).toString() : url.toString()
    const html = await page(target)
    if (html === null) continue
    answered = true

    for (const sign of corporateSignsIn(html)) if (!signs.includes(sign)) signs.push(sign)

    const found = contactIn(html, url.hostname, rank)
    if (found && found.score > (best?.score ?? 0)) best = { ...found, source: target }

    // A person on the contact page is the best this can do, so the remaining
    // pages are not worth the wait.
    if (best && best.score >= BEST_WORTH) break
  }

  return { answered, best, signs }
}

/** What the rules read off every stored prospect, in pages up to the cap. */
async function storedRows(db) {
  const rows = []
  for (let page = 0; page < SWEEP_PAGES; page += 1) {
    const from = page * SWEEP_PAGE
    const { data, error } = await db
      .from('outreach_prospects')
      .select('id, name, trade, website, email, town, stage, skip_reason, business_status')
      .order('created_at', { ascending: true })
      .range(from, from + SWEEP_PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < SWEEP_PAGE) break
  }
  return rows
}

/** Ids in chunks, so a rule catching forty rows costs a handful of statements. */
function* chunked(ids) {
  for (let at = 0; at < ids.length; at += SWEEP_CHUNK) yield ids.slice(at, at + SWEEP_CHUNK)
}

/**
 * Applies every rule to every stored row that can still be caught, and takes
 * back the ones no rule holds any more.
 *
 * A row a rule stops is moved to 'skipped' with the rule as its reason. A
 * chain host earns that reading the moment its third town is searched, which
 * is long after the rows in its first towns were enriched and audited, and a
 * rule written by hand reaches rows enriched before it existed the same way.
 *
 * A rule read backwards is the same rule. A domain comes off the held list, a
 * brand comes out of a group, a term comes out of the size list: the business
 * behind every row that rule stopped is one the pipeline would write to if it
 * met it today, and leaving it at 'skipped' would mean the lists only ever
 * grow. So a skipped row the rules no longer catch goes back to 'found' and is
 * read again from its site, which is where a row this run has never seen
 * starts.
 *
 * Only a reason a rule composed is taken back, which `rowRuleWrote` decides.
 * The console's Skip writes a sentence somebody typed, and a business a person
 * took out stays out however the lists read later. The reason is matched on the
 * way in as well as read on the way out, so a hand skip written between this
 * run's read and its write is not overwritten by what the row said before it.
 *
 * A row the rules pass but whose address the sender would now refuse is put
 * back to 'found' without the address, so the next batch reads its site again
 * for a name. The draft written to the old address is retired at the same
 * time, because the sender reuses a draft as it was written, and a draft to
 * sales@ going out under a person's name is the one outcome the retake exists
 * to prevent.
 *
 * Rows carrying the same outcome are written in one statement per chunk.
 */
async function sweep(db, rows, chains) {
  const byReason = new Map()
  const byTaken = new Map()
  const retakes = []
  for (const row of rows) {
    const held = row.stage === 'skipped'
    if (!held && !SWEEPABLE.has(row.stage)) continue

    const host = hostOf(row.website)
    const towns = chains.get(host)
    const reason = rowRuleOf(row) ?? (towns ? chainDomainReason(host, towns) : null)

    // A row already skipped is only ever read for whether it may come back.
    // Writing it to 'skipped' a second time would move updated_at on every row
    // the rules still catch, every twenty minutes, for nothing.
    if (held) {
      if (reason || !rowRuleWrote(row.skip_reason)) continue
      if (!byTaken.has(row.skip_reason)) byTaken.set(row.skip_reason, [])
      byTaken.get(row.skip_reason).push(row.id)
      continue
    }

    if (reason) {
      if (!byReason.has(reason)) byReason.set(reason, [])
      byReason.get(reason).push(row.id)
      continue
    }

    if (row.email && shapeOf(row.email)) retakes.push(row.id)
  }

  let skipped = 0
  for (const [reason, ids] of byReason) {
    for (const chunk of chunked(ids)) {
      const { error } = await db
        .from('outreach_prospects')
        .update({ stage: 'skipped', skip_reason: reason })
        .in('id', chunk)
      if (error) throw new Error(error.message)
      skipped += chunk.length
    }
  }

  let taken = 0
  for (const [reason, ids] of byTaken) {
    for (const chunk of chunked(ids)) {
      // The two guards can each refuse a row, so what came back is counted
      // rather than what was asked for: a run reporting rows it did not change
      // is a run whose count says nothing.
      const { data, error } = await db
        .from('outreach_prospects')
        .update({ stage: 'found', skip_reason: null })
        .in('id', chunk)
        .eq('stage', 'skipped')
        .eq('skip_reason', reason)
        .select('id')
      if (error) throw new Error(error.message)
      taken += data.length
    }
  }

  let retaken = 0
  for (const chunk of chunked(retakes)) {
    const retired = await db
      .from('outreach_messages')
      .update({ status: 'failed', error: RETIRED })
      .eq('direction', 'outbound')
      .eq('status', 'drafted')
      .in('prospect_id', chunk)
    if (retired.error) throw new Error(retired.error.message)

    const { error } = await db
      .from('outreach_prospects')
      .update({ stage: 'found', email: null, email_source: null, skip_reason: null })
      .in('id', chunk)
    if (error) throw new Error(error.message)
    retaken += chunk.length
  }

  return { skipped, taken, retaken }
}

/**
 * The address a platform profile links to, which is the business's own mailbox
 * somewhere else.
 *
 * Everywhere else an address counts only at the site's own domain, since an
 * address on somebody else's page belongs to somebody else. On a profile the
 * site's own domain is the platform's, so the test inverts: an address at any
 * platform is the platform's and every other one is the business's.
 */
export function profileContact(html) {
  let best = null
  for (const email of addressesIn(html, true)) {
    if (platformOf(email.slice(email.indexOf('@') + 1))) continue
    const score = worth(email, 1)
    if (score > (best?.score ?? 0)) best = { email, score }
  }
  return best
}

/** That address, once the profile page has been fetched. */
async function contactOnProfile(url) {
  const html = await page(url.toString())
  if (html === null) return null
  const best = profileContact(html)
  return best ? { ...best, source: url.toString() } : null
}

/**
 * What one prospect's row becomes once the rules and its site have been read.
 *
 * The rules run before the fetch, in the order of what they cost. Everything
 * that reads off the row itself goes first, the chain count is a lookup in a
 * map already built, and only a row that survives all of it is worth a
 * request. The site is then read for the signs of a company too large to buy
 * before its address is taken, since an address at such a company is not one
 * to write to.
 */
async function resolve(prospect, chains) {
  const host = hostOf(prospect.website)

  const rule = rowRuleOf(prospect)
  if (rule) return { stage: 'skipped', skip_reason: rule }

  const url = siteUrl(prospect.website)
  if (!url) {
    // A listing with no website field means Google was not told about a site,
    // not that there is none. Saying so to a business whose site is the first
    // result for its own name ends the message at its first sentence, so the
    // claim is checked against the domains a business of that name would hold
    // before it is allowed to stand.
    const hidden = await findSite(prospect)
    if (hidden) {
      return { stage: 'found', site_kind: 'own', website: hidden, skip_reason: null }
    }
    return { stage: 'unreachable', site_kind: 'none', skip_reason: 'no website listed' }
  }

  const platform = platformOf(host)
  if (platform) {
    const best = await contactOnProfile(url)
    if (best) {
      return {
        stage: 'enriched',
        site_kind: 'social',
        email: best.email,
        email_source: field(best.source, 2000),
      }
    }
    // The profile gave up no address, so the same check runs here: a business
    // whose listing points at a profile may still hold a site of its own, and
    // the opener about having no site is wrong for it.
    const hidden = await findSite(prospect)
    if (hidden) {
      return { stage: 'found', site_kind: 'own', website: hidden, skip_reason: null }
    }
    return {
      stage: 'unreachable',
      site_kind: 'social',
      skip_reason: `the ${platform} profile links no address`,
    }
  }

  const towns = chains.get(host)
  if (towns) return { stage: 'skipped', skip_reason: chainDomainReason(host, towns) }

  const { answered, best, signs } = await contactFor(url)
  if (signs.length) return { stage: 'skipped', skip_reason: corporateReason(signs) }
  if (best) {
    return {
      stage: 'enriched',
      site_kind: 'own',
      email: best.email,
      email_source: field(best.source, 2000),
    }
  }
  return {
    stage: 'unreachable',
    site_kind: 'own',
    skip_reason: answered ? NO_ADDRESS : NO_ANSWER,
  }
}

/**
 * Businesses that stopped at a dead end, offered back to the queue.
 *
 * A row stops at 'unreachable' either because its site was read and printed no
 * address, or because the site never answered. Neither is permanent, and
 * without this both are: a site down for the minute the enricher happened to
 * read it is a business off the list for good, and so is one that had no
 * address on it the week before it put one up.
 *
 * They come back on different clocks, because the two say different things.
 * See RETRY_AFTER_DAYS.
 *
 * They go back to 'found', which is where the batch below takes its work from,
 * so a retry is an ordinary enrichment rather than a second path through the
 * same code. A row that fails again comes straight back here, and the age is
 * what keeps that from being a loop: it is asked once every
 * RETRY_UNANSWERED_AFTER_DAYS and no oftener, however many times it fails.
 *
 * The address is not cleared, because a row here has none. The reason is,
 * since a row at 'found' has not been read yet and carrying last week's
 * failure would have the console reporting it as the reason it is waiting.
 *
 * @param {object} db A service-role client.
 * @param {Date} now The moment the age is measured from.
 * @returns {Promise<number>} How many came back.
 */
async function retryUnreachable(db, now) {
  let taken = 0
  for (const [reason, days] of Object.entries(RETRY_AFTER_DAYS)) {
    if (taken >= RETRY_LIMIT) break
    const before = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await db
      .from('outreach_prospects')
      .update({ stage: 'found', skip_reason: null })
      .eq('stage', 'unreachable')
      .eq('skip_reason', reason)
      .is('email', null)
      .not('website', 'is', null)
      .lt('updated_at', before)
      .select('id')
      .limit(RETRY_LIMIT - taken)
    if (error) throw new Error(error.message)
    taken += data?.length ?? 0
  }
  return taken
}

export async function work({ db, counts, now = new Date() }) {
  const stored = await storedRows(db)
  const chains = chainDomainsIn(stored)
  const swept = await sweep(db, stored, chains)
  counts.changed += swept.skipped + swept.taken + swept.retaken

  // Offered back before the batch is read, so what comes back is work this
  // same run can do rather than work the next one finds.
  const retried = await retryUnreachable(db, now)
  counts.changed += retried

  const { data: queue, error } = await db
    .from('outreach_prospects')
    .select('id, name, town, trade, website, business_status')
    .eq('stage', 'found')
    .order('created_at', { ascending: true })
    .limit(BATCH)
  if (error) throw new Error(error.message)
  if (!queue.length) return { chains: chains.size, ...swept, retried, queue: 0 }

  const outcomes = await mapWithLimit(queue, CONCURRENCY, async prospect => {
    counts.examined += 1
    return { id: prospect.id, ...(await resolve(prospect, chains)) }
  })

  const tally = { enriched: 0, unreachable: 0, skipped: 0 }
  for (const { id, ...update } of outcomes) {
    const written = await db.from('outreach_prospects').update(update).eq('id', id)
    if (written.error) throw new Error(written.error.message)
    counts.changed += 1
    if (update.stage === 'enriched') tally.enriched += 1
    else if (update.stage === 'skipped') tally.skipped += 1
    else tally.unreachable += 1
  }

  return { chains: chains.size, ...swept, retried, queue: queue.length, ...tally }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runJob({ request, response, job: 'enrich', work })
}
