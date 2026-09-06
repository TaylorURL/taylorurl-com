/**
 * The visitor who ran a speed check, carried across into the prospect table.
 *
 * An address given to get one answer is not a subscription, and the two tables
 * behind that sentence are different tables. `public.subscribers` is a list a
 * person joined, and joining is something only they can do; nothing here goes
 * near it and nothing here signs anybody up for a newsletter.
 * `public.outreach_prospects` is the studio's own record of businesses it might
 * write to once, and a row on it is not a subscription in either direction. It
 * is a row governed by every rule that governs the ones beside it: `shapeOf`
 * refuses the address before anything else reads it, a domain on
 * `outreach_held_domains` is refused, an address on `suppression` never becomes
 * a row at all, the row carries the same `unsub_token` every other row carries,
 * and it reaches a reader only through the same send queue under the same daily
 * cap and the same sending window as a business found on a map. The bridge adds
 * a lead. It adds no new way to be written to.
 *
 * The suppression rule is worth being exact about, because it is the one that
 * decides whether this is honest. An outreach unsubscribe writes the address to
 * `public.suppression`, and api/speed-check.js reads that same table before it
 * opens the check row, so somebody who has already asked the studio to stop
 * arrives here with `suppressed` set and is refused outright. Asking a stranger
 * for a reading is not a way back onto a list they left.
 *
 * Why the row is worth having. Everything else in this pipeline is a guess made
 * from the outside: a map search returns a business, the enricher finds an
 * address on its site, the audit measures the site, and at no point has anybody
 * at that business expressed the faintest interest in hearing from a web
 * studio. A speed check is the opposite of all of that. Somebody typed their
 * own site into a form, typed their own address underneath it, and waited most
 * of a minute for a number that tells them their site is slow. They named the
 * problem themselves, they named it about their own business, and they did it
 * at the moment they cared enough to go looking. That is the warmest lead this
 * pipeline will ever see.
 *
 * Which is exactly why the check is asked who it speaks for. The form takes an
 * address and a site as two independent fields and neither vouches for the
 * other, so a reading is only a business naming its own problem where the
 * address belongs to the business behind the site. Where it does not, the
 * reading is still a reading and nothing else: `speaksFor` is the question, and
 * `patchFor` is where the answer is spent.
 *
 * What lands in the table is a prospect at stage 'audited' with the reading it
 * already has, so the audit job never spends a PageSpeed report measuring a
 * site that was measured a minute ago, and `source` is the asked-for one, which
 * is what puts it at the head of the send queue ahead of every business that
 * was merely found.
 *
 * Nothing here is allowed to throw into its caller. The bridge runs at the end
 * of the request that gave a visitor their reading, and a refusal from the
 * prospect table is not a reason for that visitor to be told their check
 * failed. Every path answers with a result object, including the paths that
 * went wrong.
 */

import { domainOf, normalise, shapeOf } from './address.js'
import { heldDomainOf, heldDomainsLoaded, loadHeldDomains } from './exclusions.js'
import { bareHost, hostOf } from './platforms.js'
import { ASKED_SOURCE } from './rank.js'

/** What a bridged row records as the origin of its address. */
export const ASKED_EMAIL_SOURCE = 'speed-check'

/**
 * The stage a bridged row rests at, which is where a measured business rests.
 *
 * The reading came with it, so it is past the audit rather than waiting for
 * one, and `homeStage` in lib/outreach/queue.js puts a scored row here too.
 */
const BRIDGED_STAGE = 'audited'

/**
 * The stages a reading is allowed to move a row forward out of.
 *
 * All three are resting places for a business nothing has managed to measure:
 * 'found' is a map result nobody has read yet, 'enriched' is one with an
 * address and no reading, and 'unreachable' is one whose site refused Google's
 * test often enough that the audit gave up on it. A reading is exactly what
 * each of them was short of. Every other stage is left alone, because moving a
 * contacted, replied, unsubscribed or skipped row to 'audited' would walk it
 * backwards past something that actually happened.
 */
const UNMEASURED_STAGES = new Set(['found', 'enriched', 'unreachable'])

/**
 * Labels that are a suffix rather than a name. The last label of a host is
 * always one; these are the ones that turn up as the second-to-last, so
 * 'acme.co.uk' registers Acme the same way 'acme.com' does.
 */
const SUFFIX_LABELS = new Set(['co', 'com', 'net', 'org', 'gov', 'edu', 'ac'])

/**
 * Rows read back before the host comparison, which happens here rather than in
 * the query. A registrable domain is specific enough that the loose match
 * behind it returns one row or none in practice.
 */
const MATCH_LIMIT = 20

/**
 * The part of a host somebody actually registered, suffix and all.
 *
 * Two questions in this file turn on it, and they want the same reading. The
 * name a bridged row is filed under comes off the label in front of the suffix,
 * and whether an address belongs to a site is decided by whether the two were
 * registered under the same name. A host carrying nothing to strip comes back
 * as it stands, since a bare label is already the whole of what was registered.
 *
 * @param {string} host A hostname, in any casing, with or without its www.
 * @returns {string}
 */
function registrableOf(host) {
  const labels = bareHost(host).split('.').filter(Boolean)
  if (labels.length < 2) return labels.join('.')

  const twoPart = labels.length > 2 && SUFFIX_LABELS.has(labels[labels.length - 2])
  return labels.slice(twoPart ? -3 : -2).join('.')
}

/**
 * The business name a host carries, which is the only name a speed check gives.
 *
 * A check knows an address and a site and nothing else. The name column will
 * not take a null, and the console shows it, so the domain is read for the one
 * piece of a name it holds: the label the business registered, with its
 * separators opened out into spaces. 'baytown-plumbing.com' is Baytown
 * Plumbing, and a host that yields nothing is kept whole rather than replaced
 * with a placeholder, since the host itself is at least true.
 *
 * @param {string} host A hostname, in any casing, with or without its www.
 * @returns {string}
 */
function nameFromHost(host) {
  const bare = bareHost(host)
  if (!bare) return ''

  const registered = registrableOf(bare).split('.')[0]
  const words = registered.split(/[-_]+/).filter(Boolean)
  if (!words.length) return bare
  return words.map(word => word[0].toUpperCase() + word.slice(1)).join(' ')
}

/**
 * Whether an address belongs to the business behind a site.
 *
 * This is the question a site match cannot answer for itself. api/speed-check.js
 * takes the site and the address as two independent fields and compares them to
 * each other at no point, which is right - somebody measuring a competitor is a
 * real use of the page - but it means a reading arriving here is a URL anybody
 * could have typed alongside an address anybody could have typed. The one thing
 * that ties the two together is the domain the address is at: a mailbox under
 * the name the site is registered under is a mailbox the business hands out,
 * and nobody outside the business has one.
 *
 * A free mailbox can never tie them together, and it needs no list of its own
 * to be refused. An owner checking their own site from a personal Gmail account
 * and a stranger checking that site from a personal Gmail account are the same
 * address at the same domain, and that domain is not the one the site is
 * registered under, so the comparison below already answers no to both. There
 * is nothing further to read that would tell the two apart, which is why the
 * rule is a comparison rather than a judgement.
 *
 * Both sides are read down to the registered domain rather than compared whole,
 * so a mailbox at mail.example.com answers for a site at www.example.com. A
 * subdomain on either side is a choice about hosting, and no business loses its
 * own address by making one.
 *
 * @param {string} email An address, in any casing.
 * @param {string} website The site to answer for, as the table stores it.
 * @returns {boolean}
 */
function speaksFor(email, website) {
  const registered = registrableOf(domainOf(email))
  return Boolean(registered) && registered === registrableOf(hostOf(website))
}

/**
 * Why a check cannot become a prospect, or null when nothing here refuses it.
 *
 * Kept apart from the shaping below so both answers come off one reading of the
 * row: `prospectFromCheck` returns nothing at all, which is what lets a caller
 * treat a returned object as a prospect without checking anything, and `bridge`
 * asks the same question again to say which rule it was.
 *
 * @param {object} check A row from `public.speed_checks`.
 * @returns {string|null}
 */
function refusalOf(check) {
  if (!check || check.status !== 'done') return 'not_finished'
  if (!Number.isFinite(check.score)) return 'no_reading'
  if (check.suppressed) return 'suppressed'
  if (!normalise(check.email)) return 'no_email'
  return null
}

/**
 * One finished speed check as a row ready for `outreach_prospects`, or null
 * where it must not become one.
 *
 * Pure, and deliberately so. Everything it decides is decided from the check
 * row itself, which is what lets the shape of a bridged prospect be checked
 * without a database in front of it.
 *
 * There is no place id, because a person who typed their own address is not a
 * map result and inventing one would put a row on the sourcing job's conflict
 * key that the sourcing job could then overwrite. Identity is `source_ref`
 * instead, which is the check's own id, and that is what makes a replayed check
 * find the row it already made rather than making a second one.
 *
 * `audit_at` is taken from the check's own timestamps rather than from the
 * clock, so the reading is stamped with when it was actually taken and the
 * audit job's staleness window counts from the right moment.
 *
 * @param {object} check A row from `public.speed_checks`.
 * @returns {object|null}
 */
export function prospectFromCheck(check) {
  if (refusalOf(check)) return null

  const host = hostOf(check.site) || bareHost(check.host)

  return {
    place_id: null,
    name: nameFromHost(host) || host || normalise(check.email),
    website: check.site,
    email: normalise(check.email),
    email_source: ASKED_EMAIL_SOURCE,
    source: ASKED_SOURCE,
    source_ref: check.id,
    stage: BRIDGED_STAGE,
    site_kind: 'own',
    audit_score: check.score,
    accessibility_score: check.accessibility_score ?? null,
    best_practices_score: check.best_practices_score ?? null,
    seo_score: check.seo_score ?? null,
    audit_raw: check.audit_raw ?? null,
    audit_at: check.finished_at ?? check.created_at ?? null,
  }
}

/** The four scores and their stamp, which is all a linked row is ever owed. */
function scoresFrom(prospect) {
  return {
    audit_score: prospect.audit_score,
    accessibility_score: prospect.accessibility_score,
    best_practices_score: prospect.best_practices_score,
    seo_score: prospect.seo_score,
    audit_raw: prospect.audit_raw,
    audit_at: prospect.audit_at,
  }
}

/** What a match has to carry for the update to be decided without a second read. */
const MATCH_COLUMNS = 'id, email, website, stage, contacted_at'

/** Whether this check has already been bridged, as the row it was bridged to. */
async function bridgedAlready(db, checkId) {
  const { data, error } = await db
    .from('outreach_prospects')
    .select('id')
    .eq('source_ref', checkId)
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] ?? null
}

/**
 * The prospect this check belongs to, by address first and by site second, and
 * which of the two found it.
 *
 * The address is the stronger of the two and is asked first: it is the thing
 * the studio would actually write to, and two rows carrying it are already
 * deduped by the send queue. The site is asked second because a business can be
 * on file from a map sweep with no address at all, and that row is the one most
 * worth finding - it is a listing the enricher never got an address off, and
 * the person running the check may be the one person able to give it one.
 *
 * Which pass answered is carried back rather than dropped, because the two are
 * worth different amounts. An address already on a row is the business
 * identifying itself; a site is public and typing one proves nothing about who
 * typed it. `patchFor` is where that difference is spent.
 *
 * `email` is a citext column, so the database folds the case itself; the value
 * is normalised on the way in regardless, since that is the form every other
 * caller stores and compares.
 *
 * The host is compared here rather than in the query because there is no host
 * column to compare against - the table stores whole URLs - and a substring
 * match on a URL is not a match on a host. The loose pattern narrows the read
 * to a row or two and `hostOf` settles it exactly.
 */
async function matchFor(db, prospect, matchLimit) {
  const { data: byEmail, error: emailError } = await db
    .from('outreach_prospects')
    .select(MATCH_COLUMNS)
    .eq('email', prospect.email)
    .order('created_at', { ascending: true })
    .limit(1)
  if (emailError) throw new Error(emailError.message)
  if (byEmail?.[0]) return { row: byEmail[0], by: 'email' }

  const host = hostOf(prospect.website)
  if (!host) return null

  const { data: bySite, error: siteError } = await db
    .from('outreach_prospects')
    .select(MATCH_COLUMNS)
    .ilike('website', `%${host}%`)
    .order('created_at', { ascending: true })
    .limit(matchLimit)
  if (siteError) throw new Error(siteError.message)

  const row = (bySite ?? []).find(candidate => hostOf(candidate.website) === host)
  return row ? { row, by: 'site' } : null
}

/**
 * What a matched row is updated with.
 *
 * A row that has already been written to gets the scores and nothing else. Its
 * stage, its source and its address are the record of a message that actually
 * left, and rewriting any of them would leave the table disagreeing with what
 * the business was sent.
 *
 * A row found by its site, where the address does not speak for that site, gets
 * the same treatment for a different reason. All that match establishes is that
 * somebody typed a URL, and a URL is public: it is no evidence that the person
 * who typed it has anything to do with the business behind it. Spending it as
 * evidence would write a stranger's mailbox onto a business's row, promote the
 * row past 'found', which is the only stage api/outreach/enrich.js reads, and
 * stamp it as a business that asked - so the business's own address would never
 * be looked for again, and the first message off the queue would be a pitch
 * about a plumber sent to somebody who is not the plumber. The scores are still
 * taken, because a measurement of that site is a measurement of that site
 * whoever asked for it. Everything that would speak for the business is left
 * exactly as it was, which is what keeps the row in front of the enricher.
 *
 * A row found by its address, or by a site the address speaks for, gets the
 * scores, the source, and the check id as its `source_ref`, which is what puts
 * it at the head of the send queue and what makes the same check bridged twice
 * find this row rather than make a second one. Its stage moves to 'audited'
 * only out of the three stages that mean nothing has measured it; every other
 * stage stays exactly where it is. Its address is filled in only where it had
 * none, which is the whole point of matching on the site: a map listing the
 * enricher could not find an address for is one message away from being useful,
 * and an owner running a check on their own site is the one person who arrives
 * here carrying the missing piece.
 */
function patchFor(match, prospect) {
  const patch = scoresFrom(prospect)
  const { row } = match
  if (row.contacted_at) return patch
  if (match.by === 'site' && !speaksFor(prospect.email, row.website)) return patch

  patch.source = prospect.source
  patch.source_ref = prospect.source_ref
  if (UNMEASURED_STAGES.has(row.stage)) patch.stage = BRIDGED_STAGE
  if (!normalise(row.email)) {
    patch.email = prospect.email
    patch.email_source = prospect.email_source
  }
  return patch
}

/**
 * Files a finished speed check as a prospect, or says why it did not.
 *
 * The order is cheapest and most refusing first. What the check itself
 * disqualifies is settled with no query at all; the address rules and the held
 * domains come next, since both can refuse a row that would otherwise cost two
 * reads; then the replay guard, which is what keeps a check that ran twice from
 * becoming two businesses; then the match, and only then a write.
 *
 * The held-domain list has to be installed before either address rule can be
 * asked, and `shapeOf` throws rather than guessing when it is not, so this
 * loads it where a caller has not. That makes the bridge safe to call from a
 * check script as well as from the middle of a request that already loaded it.
 *
 * Nothing raises. A caller is a route that has already given somebody their
 * reading, and it is owed a result rather than an exception.
 *
 * @param {object} db A service-role client.
 * @param {object} check A row from `public.speed_checks`.
 * @param {object} [options]
 * @param {number} [options.matchLimit] Rows the site match reads back before
 *   the exact host comparison.
 * @returns {Promise<{action: 'linked'|'created'|'refused', reason?: string, id?: string}>}
 */
export async function bridge(db, check, options = {}) {
  const matchLimit = options.matchLimit ?? MATCH_LIMIT

  try {
    const refused = refusalOf(check)
    if (refused) return { action: 'refused', reason: refused }

    const prospect = prospectFromCheck(check)

    if (!heldDomainsLoaded() && !(await loadHeldDomains(db))) {
      return { action: 'refused', reason: 'rules_unavailable' }
    }

    const shape = shapeOf(prospect.email)
    if (shape) return { action: 'refused', reason: shape.reason }
    if (heldDomainOf(hostOf(prospect.website))) {
      return { action: 'refused', reason: 'held_host' }
    }

    const already = await bridgedAlready(db, prospect.source_ref)
    if (already) return { action: 'refused', reason: 'already_bridged', id: already.id }

    const match = await matchFor(db, prospect, matchLimit)
    if (match) {
      const { error } = await db
        .from('outreach_prospects')
        .update(patchFor(match, prospect))
        .eq('id', match.row.id)
      if (error) throw new Error(error.message)
      return { action: 'linked', id: match.row.id }
    }

    const { data, error } = await db
      .from('outreach_prospects')
      .insert(prospect)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return { action: 'created', id: data.id }
  } catch (cause) {
    console.error('outreach bridge: %s: %s', check?.id ?? 'no check', cause.message)
    return { action: 'refused', reason: 'unavailable' }
  }
}
