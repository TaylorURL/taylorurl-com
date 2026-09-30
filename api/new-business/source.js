/**
 * Puts every company Texas has just registered on the new-business list, and
 * matches the companies on it against the domains registered each day.
 *
 * Once a day:
 *
 *   1. Reads the Comptroller's register for every company chartered since a
 *      week before the last day it saw, and files the ones not already on the
 *      list. See lib/new-business/filings.js for why it reads back.
 *   2. Reads the daily lists of newly registered domains and records, on each
 *      company still waiting to be found, any domain its name runs into. A
 *      company filed today is matched against the last LOOKBACK_DAYS of lists,
 *      since the register trails the filings and the domain is often bought
 *      first. A company already on the list is matched against the lists
 *      published since the last run. A match brings the company's next check
 *      forward to now, so the site is read while it is new.
 *
 * What it writes: `new_business_leads`, and the cursor on
 * `new_business_settings`.
 */

import { readAll } from '../../lib/db/rows.js'
import { servedHereOr404 } from '../../lib/http/guard.js'
import { LOOKBACK_DAYS, daysBetween, listFor, matchesFor } from '../../lib/new-business/domains.js'
import { PAGE_SIZE, filingsUrl, leadOf, readFrom } from '../../lib/new-business/filings.js'
import { runNewBusinessJob } from '../../lib/new-business/runtime.js'

export const config = { maxDuration: 300 }

const DAY_MS = 24 * 60 * 60 * 1000
const INSERT_CHUNK = 500

/** Every register row chartered on or after a day. */
async function filings(since, get) {
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const response = await get(filingsUrl(since, offset), { signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error(`data.texas.gov answered ${response.status}`)
    const page = await response.json()
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

/** Which of these taxpayer numbers are already on the list. */
async function known(db, numbers) {
  const on = new Set()
  for (let at = 0; at < numbers.length; at += INSERT_CHUNK) {
    const { data, error } = await db
      .from('new_business_leads')
      .select('taxpayer_number')
      .in('taxpayer_number', numbers.slice(at, at + INSERT_CHUNK))
    if (error) throw new Error(error.message)
    for (const row of data) on.add(row.taxpayer_number)
  }
  return on
}

/** Files new leads and hands back what was filed, with ids. */
async function file(db, leads) {
  const filed = []
  for (let at = 0; at < leads.length; at += INSERT_CHUNK) {
    const { data, error } = await db
      .from('new_business_leads')
      .upsert(leads.slice(at, at + INSERT_CHUNK), {
        onConflict: 'taxpayer_number',
        ignoreDuplicates: true,
      })
      .select('id, slug, candidates, formed_on')
    if (error) throw new Error(error.message)
    filed.push(...data)
  }
  return filed
}

/** Records new matches on a lead and brings its check forward. */
async function record(db, lead, domains, now) {
  const candidates = [...new Set([...(lead.candidates ?? []), ...domains])]
  if (candidates.length === (lead.candidates ?? []).length) return false
  const { error } = await db
    .from('new_business_leads')
    .update({ candidates, next_check_at: now.toISOString(), updated_at: now.toISOString() })
    .eq('id', lead.id)
    .eq('stage', 'waiting')
  if (error) throw new Error(error.message)
  return true
}

/** The day the last run that finished cleanly started, as YYYY-MM-DD, or null. */
async function lastSourced(db) {
  const { data, error } = await db
    .from('new_business_runs')
    .select('started_at')
    .eq('job', 'source')
    .not('finished_at', 'is', null)
    .is('error', null)
    .order('started_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  return data?.[0] ? new Date(data[0].started_at).toISOString().slice(0, 10) : null
}

export async function work({ db, settings, counts, now = new Date(), get = fetch }) {
  const since = readFrom(settings.source_cursor, now)
  const rows = await filings(since, get)
  counts.examined += rows.length

  const leads = rows.map(leadOf).filter(Boolean)
  const already = await known(
    db,
    leads.map(lead => lead.taxpayer_number)
  )
  const fresh = leads.filter(lead => !already.has(lead.taxpayer_number))
  const filed = await file(db, fresh)
  counts.changed += filed.length

  const latest = rows.reduce((max, row) => {
    const day = row.sos_charter_date ? String(row.sos_charter_date).slice(0, 10) : null
    return day && day <= now.toISOString().slice(0, 10) && (!max || day > max) ? day : max
  }, settings.source_cursor ?? null)

  // The lists: every day back to the lookback for the companies filed now, and
  // the days since the last run for the ones already waiting.
  const yesterday = new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10)
  const earliest = new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS).toISOString().slice(0, 10)
  const lastRun = await lastSourced(db)
  const recentFrom = lastRun && lastRun < yesterday ? lastRun : yesterday
  const days = daysBetween(filed.length ? earliest : recentFrom, yesterday)

  const newIds = new Set(filed.map(lead => lead.id))
  const { rows: waiting } = await readAll(
    () =>
      db
        .from('new_business_leads')
        .select('id, slug, candidates', { count: 'exact' })
        .eq('stage', 'waiting')
        .not('slug', 'is', null)
        .order('id'),
    { max: 500_000 }
  )

  let lists = 0
  let matched = 0
  const found = new Map()
  for (const day of days) {
    const labels = await listFor(day, get)
    if (!labels) continue
    lists += 1
    const readsOld = day >= recentFrom
    for (const lead of waiting) {
      if (!readsOld && !newIds.has(lead.id)) continue
      const domains = matchesFor(lead.slug, labels)
      if (!domains.length) continue
      if (!found.has(lead.id)) found.set(lead.id, { lead, domains: [] })
      found.get(lead.id).domains.push(...domains)
    }
  }
  for (const { lead, domains } of found.values()) {
    if (await record(db, lead, domains, now)) matched += 1
  }
  counts.changed += matched

  const { error } = await db
    .from('new_business_settings')
    .update({ source_cursor: latest })
    .eq('id', 1)
  if (error) throw new Error(error.message)

  return {
    since,
    read: rows.length,
    filed: filed.length,
    lists,
    matched,
    note: `Read ${rows.length} companies chartered since ${since}, filed ${filed.length} new, matched ${matched} against ${lists} domain lists.`,
  }
}

export default async function handler(request, response) {
  if (!servedHereOr404(request, response)) return
  await runNewBusinessJob({ request, response, job: 'source', work })
}
