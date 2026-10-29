/**
 * The letters of the trigger-based chains: one named defect, said plainly.
 *
 * Every one of these chains fires on something that just happened to one
 * business - a certificate that expired, a listing with no photographs, a site
 * on a builder it has outgrown, a run of new reviews - and the sentence naming
 * it was written when it was found and stored on the row. So the letter opens
 * on that sentence rather than on a figure composed again at send time from
 * numbers that may have moved since.
 *
 * They are short on purpose. A business whose home page is erroring does not
 * need three paragraphs; it needs to know somebody noticed and that it can be
 * fixed this week. The second letter offers the phone, the way the lawsuit
 * chain's does, because by then the reader has had the first one.
 *
 * Nothing here invents a reason to hurry. Where there is urgency it is the
 * reader's own - their certificate really has expired - and where there is
 * none the letter does not pretend otherwise.
 */

import { BIO_NAME, BIO_PHONE } from '../../../mail/bio.js'
import { bareHost, plainLetter, threaded } from './shared.js'
import { plainName } from './research.js'

/** The subject every one of these carries, which is who is writing. */
export const FAULT_SUBJECT = `${BIO_NAME}, TaylorURL`

/** The site as a letter names it, or 'your website' where the row holds none. */
const site = prospect => bareHost(prospect.website) ?? 'your website'

/**
 * The sentence the trigger wrote, with its first letter capitalised, or null.
 *
 * It is stored rather than composed here because the figure in it was true
 * when the fault was found. A letter that recomputed it would be a letter
 * about a certificate that expired 'in 3 days' because the row was swept three
 * days ago.
 */
function says(prospect) {
  const said = String(prospect?.fault_says ?? '').trim()
  return said ? said.charAt(0).toUpperCase() + said.slice(1) : null
}

/** How a reader gets back, which is the reply button and the number. */
const back = context => `Just reply here, or call me at ${context?.phone ?? BIO_PHONE}.`

// ── Something is broken ─────────────────────────────────────────────────

export function brokenSiteOpener(prospect, where, shot, context = {}) {
  const said = says(prospect)
  const name = plainName(prospect.name)
  return plainLetter(FAULT_SUBJECT, [
    said
      ? `${said} on ${site(prospect)}, so anyone trying to find ${name} right now is getting a warning instead of your website.`
      : `Something is wrong with ${site(prospect)} at the moment.`,
    `I'm Trenton, I build websites for local businesses ${where}. I can have it sorted today if you want it sorted today - it's usually a small job.`,
    back(context),
  ])
}

export function brokenSiteAgainOpener(prospect, where, shot, context = {}) {
  return plainLetter(threaded(context, FAULT_SUBJECT), [
    `Following up on ${site(prospect)} - as far as I can see it's still down.`,
    `If you've got somebody on it, ignore me. If not, I can look at it today. ${back(context)}`,
  ])
}

export function brokenSiteLastOpener(prospect, where, shot, context = {}) {
  return plainLetter(threaded(context, FAULT_SUBJECT), [
    `Last one from me about ${site(prospect)}. If it's still not right and you'd rather not deal with it yourself, I'll quote the fix and you can decide from there.`,
    back(context),
  ])
}

// ── The listing ─────────────────────────────────────────────────────────

export function listingOpener(prospect, where) {
  const said = says(prospect)
  const name = plainName(prospect.name)
  return plainLetter(FAULT_SUBJECT, [
    said
      ? `${said}, which is the first thing most people see when they look ${name} up.`
      : `I had a look at ${name}'s Google listing this week.`,
    `I'm Trenton, I build websites for local businesses ${where}, and I fix listings alongside them. It's a short job and it's usually the cheapest thing a local business can do for itself.`,
    `Want me to go through it with you? Just reply with a day that suits.`,
  ])
}

export function listingAgainOpener(prospect, where, shot, context = {}) {
  const name = plainName(prospect.name)
  return plainLetter(threaded(context, FAULT_SUBJECT), [
    `Checking back about ${name}'s Google listing. Still happy to go through what I'd change - it's a half-hour job at most.`,
    back(context),
  ])
}

export function listingLastOpener(prospect, where, shot, context = {}) {
  return plainLetter(threaded(context, FAULT_SUBJECT), [
    `Last note from me on the listing. If you ever want a second pair of eyes on it, or on the website, I'm here.`,
    back(context),
  ])
}

// ── The site is on a builder it has outgrown ────────────────────────────

export function builderOpener(prospect, where) {
  const said = says(prospect)
  return plainLetter(FAULT_SUBJECT, [
    said
      ? `${said}, and it shows - on a phone especially.`
      : `I had a look at ${site(prospect)} this week.`,
    `I'm Trenton, I build websites for local businesses ${where}. I move sites off builders like that onto something that loads properly and that you still own outright.`,
    `Worth a quick call? Reply with a day that works and I'll tell you what I'd do with it.`,
  ])
}

export function builderAgainOpener(prospect, where, shot, context = {}) {
  return plainLetter(threaded(context, FAULT_SUBJECT), [
    `Following up about ${site(prospect)}. If you want to see what it would look like rebuilt, I'll put a page together so you're not deciding off a description.`,
    back(context),
  ])
}

export function builderLastOpener(prospect, where, shot, context = {}) {
  return plainLetter(threaded(context, FAULT_SUBJECT), [
    `Last one on this. If the site is doing its job, ignore me entirely - and if it stops doing it, you know where I am.`,
    back(context),
  ])
}

// ── The business is growing ─────────────────────────────────────────────

export function growingOpener(prospect, where) {
  const said = says(prospect)
  const name = plainName(prospect.name)
  return plainLetter(FAULT_SUBJECT, [
    said
      ? `${said}, which is a good run. Congratulations.`
      : `${name} seems to be having a good year.`,
    `I'm Trenton, I build websites for local businesses ${where}. The reason I'm writing is that this is usually the point where the website starts holding a business back rather than helping it.`,
    `If that sounds about right, reply with a day and I'll tell you what I'd change first.`,
  ])
}

export function growingAgainOpener(prospect, where, shot, context = {}) {
  const name = plainName(prospect.name)
  return plainLetter(threaded(context, FAULT_SUBJECT), [
    `Checking back on this. If ${name} is still growing and the website hasn't kept up, that's the job I do.`,
    back(context),
  ])
}

// ── Asking again, a long time later ─────────────────────────────────────

export function againOpener(prospect, where) {
  const name = plainName(prospect.name)
  return plainLetter(FAULT_SUBJECT, [
    `I wrote to ${name} a while back and never heard anything, which is fair enough - it was a cold email.`,
    `I'm Trenton, I build websites for local businesses ${where}. Things change, so I thought I'd ask once more rather than assume.`,
    `If a website is on the list this year, reply and I'll tell you what I'd do. If it isn't, say so and I'll leave you alone.`,
  ])
}

export function againLastOpener(prospect, where, shot, context = {}) {
  return plainLetter(threaded(context, FAULT_SUBJECT), [
    `That's me done - I won't write again. If a website ever comes up, ${back(context).toLowerCase()}`,
  ])
}

// ── A working relationship rather than a sale ───────────────────────────

export function partnerOpener(prospect, where) {
  const name = plainName(prospect.name)
  return plainLetter(FAULT_SUBJECT, [
    `I came across ${name} while looking at businesses around ${prospect.town ?? 'the area'}. I'm not writing to sell you anything.`,
    `I'm Trenton, I build websites for local businesses ${where}. You talk to the same small businesses I do, every week, and some of them need a website - so I'd rather you had my name than not.`,
    `If it's useful the other way round, I'll happily send people to you as well. Reply if you'd like to put faces to it.`,
  ])
}

export function partnerAgainOpener(prospect, where, shot, context = {}) {
  return plainLetter(threaded(context, FAULT_SUBJECT), [
    `Following up on this - still happy to be the person you send website questions to, and to send work back the other way.`,
    back(context),
  ])
}

export function partnerLastOpener(prospect, where, shot, context = {}) {
  return plainLetter(threaded(context, FAULT_SUBJECT), [
    `Last note. If a client ever asks you who does websites, I'd be glad if you thought of me. ${back(context)}`,
  ])
}
