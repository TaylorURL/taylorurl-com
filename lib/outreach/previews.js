/**
 * The letters of the draft preview chain, one of the four outreach chains.
 *
 * A preview is a working site on a taylorurl.com subdomain, built in one
 * business's own logo, colours and photos and filed in `preview_sites`. On this
 * chain the draft is the first thing a business ever hears from the studio,
 * then three follow-ups, then the draft comes down. Every letter is a note
 * from Trenton, rendered by lib/outreach/message.js's personal renderer.
 *
 * Every letter closes on the same kind of postscript: one line sending the
 * owner to the studio's reviews and its accreditation, with the figures read
 * when the letter is drafted. The words are lib/outreach/proof.js's; the
 * sender hands the reading in as `proof`, and a letter drafted without one
 * carries no postscript rather than a guess.
 */

import { firstNameOf } from './first-names.js'
import { previewCampaign, proofLine } from './proof.js'
import { renderPersonalHtml, renderPersonalText } from './message.js'

/** The parent the preview subdomains hang off. */
export const PREVIEW_HOST = 'taylorurl.com'

/** Where a preview lives. */
export const previewUrl = slug => `https://${slug}.${PREVIEW_HOST}`

const fill = (text, url) => String(text).replaceAll('{url}', url)

/**
 * The preview-first letters: the preview as the first thing a business ever
 * hears from the studio, then three follow-ups, then the draft comes down.
 *
 * Each business's letters are written for it on the Pi, from what its own
 * website and Google listing say, and filed on the row as `letter` with
 * `version: 2`. The site renders them and nothing more: the words, the
 * pictures and the subject all come from the row, so a letter is never padded
 * out with a sentence that would fit any business. A row without a written set
 * is not sent at all, rather than sent something generic.
 *
 * The days are counted from the first letter, so a follow-up held back over a
 * weekend does not push the ones after it later. The last letter says the draft
 * comes down, and `expires_at` is when it does.
 */

/** Days after the first letter that each follow-up is owed. */
export const PREVIEW_FIRST_DAYS = [3, 8, 18]

/** Days after the first letter that an unclaimed draft comes down. */
export const PREVIEW_LIFETIME_DAYS = 21

/** The name the preview-first letters are sent under. */
export const PREVIEW_FIRST_SENDER = 'Trenton Taylor'

/** Whether this row carries a written preview-first set. */
export function isPreviewFirst(site) {
  const letter = site?.letter
  return (
    letter?.version === 2 &&
    typeof letter.subject === 'string' &&
    Array.isArray(letter.first) &&
    letter.first.length > 0 &&
    Array.isArray(letter.follow_ups) &&
    letter.follow_ups.length === PREVIEW_FIRST_DAYS.length
  )
}

/** The company form on the end of a filed name. */
const COMPANY_FORM =
  /,?\s+(?:LLC|L\.L\.C\.|Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Ltd\.?|LP|L\.P\.|PLLC)\.?$/i

/** Words left lower case inside a name being taken out of capitals. */
const SMALL_WORDS = new Set(['and', 'of', 'the', 'for', 'at', 'on', 'in', 'to', 'a', 'an'])

/** Initials long enough to pass for a word, kept in capitals. */
const INITIALS = new Set(['HVAC', 'USA', 'CPA', 'DDS', 'ROV', 'SDVOSB', 'MEP', 'EMS', 'ATV', 'RV'])

/** Short words that are words rather than initials, so they are cased like the rest. */
const SHORT_WORDS = new Set(
  'air car pet spa bar inn tea ice oil gas bus dog cat art fix pro top one two big new old red hot sun sea bay day way lab law tax kid'.split(
    ' '
  )
)

/**
 * The business as a person writing to it would say it.
 *
 * The rows are filed under the name the state or the listing gives, which is
 * "XENOS MARINE LLC" or "Torcsill Foundations LLC (Pasadena, TX)". Nobody
 * writes to a business that way, and a letter that does reads as a mail merge
 * however much else in it was written for that business. So the town in
 * brackets and the company form come off, and a name filed all in capitals is
 * put in ordinary case, keeping a word of three letters or fewer as it was,
 * since that is usually initials.
 */
export function spokenName(name) {
  let bare = String(name ?? '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim()
  // "Baytown Plumbing Co LLC" carries two forms, so they come off until none is left.
  for (let last = ''; last !== bare;) {
    last = bare
    bare = bare.replace(COMPANY_FORM, '').trim()
  }
  // A single word shouted inside an otherwise ordinary name ("CEDARBROOK
  // Insurance Group") is put in ordinary case too, initials aside.
  if (!bare || /[a-z]/.test(bare)) {
    return bare.replace(/\b[A-Z]{5,}\b/g, word =>
      INITIALS.has(word) ? word : word[0] + word.slice(1).toLowerCase()
    )
  }
  return bare
    .split(/(\s+)/)
    .map((word, index) => {
      if (!/[A-Z]/.test(word)) return word
      const lower = word.toLowerCase()
      if (INITIALS.has(word)) return word
      if (index > 0 && SMALL_WORDS.has(lower)) return lower
      if (word.length <= 3 && !SHORT_WORDS.has(lower)) return word
      return lower.replace(/(^|[-'/&])([a-z])/g, (_, mark, letter) => mark + letter.toUpperCase())
    })
    .join('')
}

/** The letter's words with the filed name put the way a person says it. */
function spoken(text, name) {
  const said = spokenName(name)
  if (!name || !said || said === name) return text
  const filed = [
    name,
    String(name)
      .replace(/\s*\([^)]*\)\s*$/, '')
      .trim(),
  ]
  const bare = filed[1]
    .replace(
      /,?\s+(?:LLC|L\.L\.C\.|Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Ltd\.?|LP|L\.P\.|PLLC)\.?$/i,
      ''
    )
    .trim()
  let out = String(text)
  for (const form of [...filed, bare]) if (form && form !== said) out = out.replaceAll(form, said)
  return out
}

/**
 * The draft letters as Trenton would type them.
 *
 * The Pi writes a full set for every business: what it found, the pictures,
 * the speed test. Read as written they are a report, and a report from a
 * stranger reads as a machine however true it is. So the site keeps what is
 * only true of that one business, which is the first thing the Pi noticed
 * about it, the two load times it measured, the pictures, and the line it
 * wishes them luck with, and says the rest in a few short sentences a person
 * would type. Where the Pi's set does not hold something a letter needs, the
 * written paragraphs go as they are rather than a letter with a gap in it.
 *
 * The wording varies by business, so two owners who compare notes would not
 * find the same email.
 */

/** A stable pick from a few ways of saying a thing, chosen by the business. */
function pickFor(seed, options) {
  let hash = 0
  for (const char of String(seed ?? '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return options[hash % options.length]
}

/**
 * One or two things only this business would recognise, said in passing: how
 * long it has been going, that it is family owned, what its reviews say. Each
 * is read out of what the Pi wrote and found, and left out where it is not
 * there.
 */
function detailOf(letter, seed) {
  const text = [...(letter.first ?? []), ...(letter.facts ?? [])].join(' ')
  const lines = []
  const year = Number(
    text.match(
      /\b(?:since|founded in|started[^.]{0,40}?in(?: early| late)?)\s+((?:19|20)\d\d)\b/i
    )?.[1]
  )
  const now = new Date().getFullYear()
  if (year && year <= now - 10) {
    lines.push(
      pickFor(seed, [
        `Saw you've been at it since ${year}, that's a good long run.`,
        `${now - year} years in business is no small thing.`,
        `Been around since ${year}, that says a lot.`,
      ])
    )
  }
  if (/family[- ]owned|father and son/i.test(text)) {
    lines.push(
      pickFor(seed, [
        `Love that it's still family owned too.`,
        `And family owned, which I always like to see.`,
      ])
    )
  }
  if (lines.length < 2) {
    const rating = Number(
      text.match(/Google rating of ([0-9.]+)/i)?.[1] ??
        text.match(/\b([0-9]\.[0-9]) from [0-9,]+ Google reviews/i)?.[1]
    )
    const count = Number(
      String(text.match(/([0-9,]+) Google reviews/i)?.[1] ?? '').replace(/,/g, '')
    )
    if (rating >= 4.5 && count >= 5) {
      lines.push(
        rating === 5
          ? `A perfect 5 stars from ${count} reviews is hard to pull off.`
          : `${rating} stars from ${count} reviews is a great look.`
      )
    }
  }
  return lines.join(' ') || null
}

/** The two load times the Pi measured, as [theirs, ours] in seconds, or null. */
function loadTimes(letter) {
  for (const text of [...(letter.facts ?? []), ...(letter.follow_ups ?? []).flat()]) {
    const both = String(text).match(
      /([0-9]+(?:\.[0-9]+)?)\s*(?:s|seconds)\b[^0-9]{0,80}?(?:new (?:one|site)|taylorurl\.com\/?)[^0-9]{0,40}?([0-9]+(?:\.[0-9]+)?)\s*(?:s|seconds)\b/i
    )
    if (both && Number(both[1]) > Number(both[2])) return [both[1], both[2]]
  }
  return null
}

/** The Pi's "Good luck with ..." line from the last letter, or null. */
function goodLuck(letter) {
  const last = (letter.follow_ups ?? []).at(-1) ?? []
  for (const text of last) {
    const line = String(text).match(/Good luck[^.!]*[.!]/)?.[0]
    if (line) return line
  }
  return null
}

function handTyped(site, nth, email) {
  const { letter } = site
  const said = spokenName(site.name)
  // A name that is really a web address or a listing's keyword string reads
  // as a mail merge however it is cased, so the letter says "you" instead.
  const odd = !/\s/.test(said) && /^[a-z0-9]+$/.test(said)
  const name = odd || said.length > 40 || /'s's|\bInc\.\s/.test(said) ? null : said
  const seed = site.slug
  const first = firstNameOf(email)
  const hi = first ? `Hi ${first},` : 'Hi,'
  const has = key => Boolean(letter.images?.[key]?.src)
  if (nth < 0) {
    if (!has('hero')) return null
    const detail = detailOf(letter, seed)
    const opener = pickFor(seed, [
      name
        ? `I was looking at ${name} online this week.`
        : `I was looking at your business online this week.`,
      name ? `I came across ${name} the other day.` : `I came across your business the other day.`,
      name
        ? `I spent a little time looking into ${name} this week.`
        : `I spent a little time looking into your business this week.`,
    ])
    return [
      hi,
      [opener, detail].filter(Boolean).join(' '),
      pickFor(seed, [
        `Instead of just emailing you about websites, I went ahead and built you one:`,
        `So I put together a new website for you to show you what I'd do:`,
        `I figured it'd be easier to show you than tell you, so I built you a new site:`,
      ]),
      '{image:hero}',
      '{link}',
      pickFor(seed, [
        `I built it off your own site and Google listing, so it should already sound like you. What would you change?`,
        `It's just a draft and I only made it for you, so tell me what you'd change and I'll fix it.`,
        `Everything in it came from your site and your Google listing. Anything you'd want different?`,
      ]),
    ]
  }
  if (nth === 0) {
    if (!has('phones')) return null
    return [
      hi,
      pickFor(seed, [
        `Did you get a chance to look at the draft? Most people will find you on their phone, so here's how it looks there:`,
        `Not sure if you saw the site I built for ${name ?? 'you'}. Here's what it looks like on a phone, which is where most people will see it:`,
      ]),
      '{image:phones}',
      '{link}',
    ]
  }
  if (nth === 1) {
    const times = loadTimes(letter)
    if (!times || !has('speed')) return null
    const [theirs, ours] = times
    return [
      hi,
      pickFor(seed, [
        `Quick thing I noticed. Your current site takes ${theirs} seconds to load on a phone. The draft I made loads in ${ours}.`,
        `I ran your current site through Google's speed test. ${theirs} seconds on a phone, versus ${ours} for the draft.`,
      ]),
      '{image:speed}',
      `People don't wait around on slow sites, they just call the next one on the list. The draft's still up here: {url}`,
    ]
  }
  if (nth === 2) {
    return [
      hi,
      pickFor(seed, [
        `I'm going to take ${name ? `the ${name} draft` : 'your draft'} down on Friday. If you want me to keep it up, just reply "keep it".`,
        `Heads up, I'm taking down the draft I built for ${name ?? 'you'} on Friday. Reply "keep it" and I'll leave it up.`,
      ]),
      [
        `No worries if the timing's off.`,
        goodLuck(letter) ? spoken(goodLuck(letter), site.name) : null,
      ]
        .filter(Boolean)
        .join(' '),
    ]
  }
  return null
}

const IMAGE_TOKEN = /^\{image:([a-z0-9_-]+)\}$/i

/**
 * Turns one written paragraph into the block the personal renderer draws.
 * `{image:key}` is that picture, `{link}` is the preview's address on its own
 * line, and `{url}` inside a sentence is the address itself.
 */
function blockOf(paragraph, url, images) {
  const text = String(paragraph).trim()
  const picture = text.match(IMAGE_TOKEN)
  if (picture) {
    const image = images?.[picture[1]]
    if (!image?.src) throw new Error(`the letter names a picture it does not carry: ${picture[1]}`)
    return {
      image: { src: image.src, href: url, alt: image.alt || '', width: image.width || 560 },
    }
  }
  if (text === '{link}') return { link: url }
  const lead = text.match(/^(.*?)\{url\}$/)
  if (lead && !lead[1].includes('{url}')) return { link: url, lead: lead[1] }
  return { text: fill(text, url) }
}

/**
 * Renders one preview-first letter in both halves.
 *
 * The postscript is the one thing in it the row did not write: the letters
 * are filed days before they go, and the figures in it are read as each one
 * is drafted.
 *
 * @param {object} site Row from `preview_sites` carrying a version 2 `letter`.
 * @param {number} nth -1 for the first letter, 0 onward for each follow-up.
 * @param {{track: string, prior?: {subject: string}, proof?: object}} context
 */
export function previewFirstLetter(
  site,
  nth,
  { track, prior = null, proof = null, origin, email = null }
) {
  if (!isPreviewFirst(site)) throw new Error(`${site?.slug} carries no preview-first letter`)
  const url = previewUrl(site.slug)
  const { letter } = site
  const written = nth < 0 ? letter.first : letter.follow_ups[nth]
  if (!Array.isArray(written) || !written.length) {
    throw new Error(`${site.slug} has no follow-up ${nth + 1} written`)
  }
  const paragraphs =
    handTyped(site, nth, email) ?? written.map(paragraph => spoken(paragraph, site.name))
  const base = String(prior?.subject || letter.subject).replace(/^Re:\s*/i, '')
  const subject = nth < 0 ? letter.subject : `Re: ${base}`
  const message = {
    subject,
    blocks: paragraphs.map(paragraph => blockOf(paragraph, url, letter.images)),
    track,
    origin,
    postscript: proofLine(proof, {
      campaign: previewCampaign(nth, PREVIEW_FIRST_DAYS),
      nth,
    }),
  }
  return { subject, text: renderPersonalText(message), html: renderPersonalHtml(message) }
}
