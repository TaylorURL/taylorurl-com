/**
 * Whether a new company has a site of its own yet, and what is on it.
 *
 * Two kinds of address are tried. A domain the daily lists matched to the
 * company's name was registered in the last few weeks, which is most of the
 * proof on its own, so a page there only has to carry the company's name. A
 * guessed address - the name run together with .com, .net or .co - may well be
 * a business that has held the name for twenty years, so a page there has to
 * carry the name and something that puts it in the company's place as well:
 * its town, its zip or its state.
 *
 * A page that proves it is the company's is read for an email address the way
 * outreach reads one, through `contactFor`, and for a phone number off its
 * `tel:` links or the first number printed on it.
 */

import { contactFor } from '../../api/outreach/enrich.js'
import { hostOf, platformOf } from '../outreach/prospects/platforms.js'
import { USER_AGENT } from '../outreach/prospects/site-search.js'
import { nameWords } from './filings.js'

const FETCH_TIMEOUT_MS = 6000

/** What a registrar's holding page or a parking service says about itself. */
const PARKED = [
  'domain is for sale',
  'buy this domain',
  'this domain may be for sale',
  'parked free',
  'parked domain',
  'sedoparking',
  'hugedomains',
  'godaddy.com/domainsearch',
  'domain has been registered',
  'is registered at namecheap',
  'future home of',
]

/** The endings a guess is tried under, in the order a Texas company picks them. */
const GUESSED = ['com', 'net', 'co']

/** The addresses to try for a company, matched ones first. */
export function candidatesFor(lead) {
  const matched = (lead.candidates ?? []).map(domain => ({ domain, matched: true }))
  const guessed = lead.slug
    ? GUESSED.map(tld => `${lead.slug}.${tld}`)
        .filter(domain => !matched.some(entry => entry.domain === domain))
        .map(domain => ({ domain, matched: false }))
    : []
  return [...matched, ...guessed]
}

/** The words that put a page in the company's place: its town, zip and state. */
function placeMarks(lead) {
  const marks = []
  if (lead.city) marks.push(String(lead.city).toLowerCase())
  if (lead.zip) marks.push(String(lead.zip).slice(0, 5))
  if (lead.state === 'TX') marks.push('texas', ' tx ')
  return marks.filter(Boolean)
}

/**
 * Whether a page is the company's.
 *
 * Every word of the name has to be on it. A guessed address has to carry one
 * of the place marks too, because a guess lands on whoever held the name first.
 */
export function pageIsTheirs(html, lead, matched) {
  const text = ` ${String(html ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')} `
  if (text.trim().length < 200) return false
  if (PARKED.some(mark => text.includes(mark))) return false
  const words = nameWords(lead.name)
  if (!words.length || !words.every(word => text.includes(word))) return false
  if (matched) return true
  return placeMarks(lead).some(mark => text.includes(mark))
}

/** The first US phone number on a page, from a `tel:` link where there is one. */
export function phoneIn(html) {
  const page = String(html ?? '')
  const linked = page.match(/href=["']tel:([^"']+)["']/i)
  const raw = linked
    ? linked[1]
    : (page.replace(/<[^>]+>/g, ' ').match(/\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/) ?? [])[0]
  const digits = String(raw ?? '')
    .replace(/\D/g, '')
    .replace(/^1(?=\d{10}$)/, '')
  return dialable(digits)
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : null
}

/**
 * Whether ten digits can be a real US number. A template's placeholder -
 * (999) 999-9999, (123) 456-7890, a 555 number - is on more new sites than a
 * real one, and a caller handed it rings nobody. An area code or exchange
 * starts 2 to 9, an area code's middle digit is never 9, and one digit
 * repeated ten times is nobody's.
 */
export function dialable(digits) {
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return false
  if (digits[1] === '9') return false
  if (/^(\d)\1{9}$/.test(digits)) return false
  if (digits.slice(3, 6) === '555') return false
  return !['1234567890', '2345678901'].includes(digits)
}

async function home(domain, get) {
  const url = `https://${domain}`
  try {
    const response = await get(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT },
    })
    if (!response?.ok) return null
    const landed = response.url || url
    // A redirect onto a platform is somebody's profile page, not a site of their own.
    if (platformOf(hostOf(landed))) return null
    return { url: landed, html: await response.text().catch(() => '') }
  } catch {
    return null
  }
}

/**
 * What one check finds for a company: the site that proved to be its own, and
 * the email and phone number read off it, or nulls where nothing proved.
 *
 * @param {object} lead A `new_business_leads` row.
 * @param {(url: string, init?: object) => Promise<Response>} [get]
 * @returns {Promise<{website: string|null, found_by: string|null, email: string|null, email_source: string|null, phone: string|null}>}
 */
export async function checkLead(lead, get = fetch) {
  for (const { domain, matched } of candidatesFor(lead)) {
    const page = await home(domain, get)
    if (!page || !pageIsTheirs(page.html, lead, matched)) continue
    const contact = await contactFor(new URL(page.url), get).catch(() => null)
    return {
      website: page.url,
      found_by: matched ? 'new-domain' : 'guess',
      email: contact?.best?.email ?? null,
      email_source: contact?.best?.source ?? null,
      phone: phoneIn(page.html),
    }
  }
  return { website: null, found_by: null, email: null, email_source: null, phone: null }
}

/** Weeks after a company is formed that it is looked for. */
export const CHECK_WEEKS = [1, 3, 6, 10]

/**
 * When a company is next looked for, or null when its last look has been.
 *
 * The weeks count from the day it was formed, so a company that reaches the
 * list two weeks late is looked for at once and then at the next week on the
 * schedule that is still ahead.
 */
export function nextCheckAt(formedOn, now = new Date()) {
  const formed = formedOn ? new Date(`${formedOn}T12:00:00Z`).getTime() : now.getTime()
  for (const weeks of CHECK_WEEKS) {
    const at = formed + weeks * 7 * 24 * 60 * 60 * 1000
    if (at > now.getTime()) return new Date(at).toISOString()
  }
  return null
}
