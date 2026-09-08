/**
 * What every plain letter reads off the row, and the lines they share.
 *
 * A plain letter is a few paragraphs a person could have typed: no figure, no
 * capture, no cards, and nothing that reads as a report. So what it says about
 * the site has to be said in seconds and in plain words rather than in a score
 * out of a hundred, and those readings are taken here, off the stored
 * PageSpeed report, so every plain letter describes a site the same way.
 */

import { hostOf } from '../../prospects/platforms.js'

/** The ask every plain letter ends on: one word answers it. */
export const YES = 'A yes is plenty.'

/**
 * Why the letter before this one said nothing about the reader's business.
 *
 * The introduction is written to make no claim about their site, which leaves
 * the letter after it holding a finding and no reason it was not said first.
 * This is that reason, and it makes the two letters read as one person rather
 * than two campaigns arriving three days apart.
 *
 * It stands next to the ask at the end rather than at the top, because a
 * follow-up that opens by referring to the last one has spent its first line
 * on an email the reader may not remember. The finding goes first and this
 * goes after it, where it explains the order without costing the opening.
 */
export const HELD_BACK = "That's what we’d have opened with, if we opened with problems."

/** The largest paint the report can say in seconds before a reader stops waiting. */
const GIVES_UP_AT = 'Most people give up around three.'

/** The address a reader would type, which is the host without its www. */
export function bareHost(website) {
  const host = hostOf(website)
  return host ? host.replace(/^www\./, '') : null
}

/**
 * How long the biggest thing on the page took to show, in seconds, or null
 * where the report did not measure it.
 *
 * Whole seconds past five, one decimal under, since "13.8 seconds" reads as a
 * lab figure and "14 seconds" reads as a wait, and under five the tenth is
 * the difference between fine and not.
 */
export function secondsOf(prospect) {
  const ms = prospect?.audit_raw?.metrics?.largest_contentful_paint?.numeric
  if (typeof ms !== 'number' || !(ms > 0)) return null
  const seconds = ms / 1000
  if (seconds >= 5) return String(Math.round(seconds))
  return String(Math.round(seconds * 10) / 10)
}

/**
 * The opening sentence about how the site loaded, in the words a person would
 * use: seconds where the report has them, the score where it has not.
 */
export function loadLine(prospect) {
  const host = bareHost(prospect.website) ?? 'your site'
  const seconds = secondsOf(prospect)
  if (seconds !== null) {
    return (
      `We loaded ${host} on a phone connection this week. It was ${seconds} seconds before ` +
      `the biggest thing on the page showed up. ${GIVES_UP_AT}`
    )
  }
  if (typeof prospect.audit_score === 'number') {
    return (
      `We ran ${host} through Google's speed test this week, on a phone connection. ` +
      `It puts the site at ${prospect.audit_score} out of 100, and the wait is what that number is about. ${GIVES_UP_AT}`
    )
  }
  return `We tried to load ${host} on a phone connection this week, and Google's test could not put a number on it, which is usually a sign of its own.`
}

/**
 * The report's savings, said the way a person would say them.
 *
 * Lighthouse names an opportunity by the fix it wants: "Reduce unused
 * JavaScript", "Serve images in next-gen formats". A business owner hears
 * neither. Each id the report is likely to raise is put into the words for
 * what is actually wrong with the page, and two ids that mean the same thing
 * to a reader are given the same words, so the list never says one thing
 * twice. An id this table does not know falls back to the report's own title,
 * lowercased, which is at least true.
 */
const IN_WORDS = {
  'unused-javascript': 'code the page loads and never runs',
  'duplicated-javascript-insight': 'the same code loaded twice over',
  'legacy-javascript': 'old code shipped for browsers nobody uses',
  'legacy-javascript-insight': 'old code shipped for browsers nobody uses',
  'unused-css-rules': 'styling the page loads and never uses',
  'unminified-javascript': 'code sent with all its padding still in',
  'unminified-css': 'code sent with all its padding still in',
  redirects: 'the address bouncing through redirects before it lands',
  'server-response-time': 'a slow first answer from the server',
  'document-latency-insight': 'a slow first answer from the server',
  'render-blocking-resources': 'files the page waits on before it draws anything',
  'render-blocking-insight': 'files the page waits on before it draws anything',
  'uses-optimized-images': 'photos far bigger than a phone can show',
  'uses-webp-images': 'photos far bigger than a phone can show',
  'modern-image-formats': 'photos far bigger than a phone can show',
  'uses-responsive-images': 'photos far bigger than a phone can show',
  'image-delivery-insight': 'photos far bigger than a phone can show',
  'offscreen-images': 'photos loading before anyone has scrolled to them',
  'uses-text-compression': 'files sent uncompressed',
  'uses-rel-preconnect': 'the main image loading last instead of first',
  'uses-rel-preload': 'the main image loading last instead of first',
  'prioritize-lcp-image': 'the main image loading last instead of first',
  'lcp-discovery-insight': 'the main image loading last instead of first',
  'total-byte-weight': 'a page far heavier than it needs to be',
  'third-party-summary': 'outside scripts the page waits on',
  'third-parties-insight': 'outside scripts the page waits on',
  'font-display': 'text held back until the fonts arrive',
  'font-display-insight': 'text held back until the fonts arrive',
  'dom-size': 'a page built from far too many pieces',
  'dom-size-insight': 'a page built from far too many pieces',
  'cache-insight': 'nothing telling a phone to keep files between visits',
  'uses-long-cache-ttl': 'nothing telling a phone to keep files between visits',
  'modern-http-insight': 'an old connection protocol',
  'network-dependency-tree-insight': 'files that each wait for the one before',
  'critical-request-chains': 'files that each wait for the one before',
}

/** A saving too small to be worth a sentence, in milliseconds. */
const WORTH_NAMING_MS = 100

/** How many causes a plain letter names, which is as many as a sentence holds. */
const FIXES_NAMED = 3

/**
 * Up to three causes of the wait, largest first, in plain words and with no
 * cause named twice.
 *
 * @param {object} prospect A row carrying `audit_raw`, or not.
 * @returns {string[]}
 */
export function fixesOf(prospect) {
  const found = prospect?.audit_raw?.opportunities
  if (!Array.isArray(found)) return []
  const named = []
  for (const entry of found) {
    if (!entry || !(entry.savings_ms >= WORTH_NAMING_MS)) continue
    const phrase =
      IN_WORDS[entry.id] ??
      String(entry.title ?? entry.id ?? '')
        .trim()
        .toLowerCase()
    if (!phrase || named.includes(phrase)) continue
    named.push(phrase)
    if (named.length === FIXES_NAMED) break
  }
  return named
}

/** Three things as one clause: "this, that and the other". */
export function listed(items) {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * One line pointing at the work, or null where the letter has nothing to
 * point at.
 *
 * It names a client and links the studio's own page rather than the client's
 * address. A letter that sends the reader to a go-kart track has spent its one
 * link putting them somewhere with nothing to do next, and they do not come
 * back. Naming the business does the proving; the link does the carrying.
 */
export function workLine(context) {
  const project = context?.work?.[0] ?? null
  const site = context?.site ?? null
  if (!project) return site ? `The work is here: ${site}` : null
  const named = `${project.name} in ${project.town || project.place}`
  if (!site) return `${named} is one you can look at: ${project.url}`
  return `${named} is one of mine. The rest are here: ${site}`
}

/** A subject threaded under the first letter, or the given one where there is no first. */
export const threaded = (context, subject) =>
  context?.prior?.subject ? `Re: ${context.prior.subject}` : subject

/** The shape every plain opener answers with. */
export function plainLetter(subject, paragraphs) {
  return { subject, paragraphs: paragraphs.filter(Boolean), plain: true }
}
