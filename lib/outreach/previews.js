/**
 * The letters of the draft preview chain, one of the four outreach chains.
 *
 * A preview is a working site on a taylorurl.com subdomain, built in one
 * business's own logo, colours and photos and filed in `preview_sites`. On this
 * chain the draft is the first thing a business ever hears from the studio,
 * then three follow-ups, then the draft comes down. Every letter is a note
 * from Trenton, rendered by lib/outreach/message.js's personal renderer.
 *
 * The first letter closes on a postscript: one line saying where the owner
 * can look Trenton up first, naming the BBB and Trustpilot profiles the
 * reading says are there to be found. The words are lib/outreach/proof.js's;
 * the sender hands the reading in as `proof`, and a letter drafted without one
 * carries no postscript rather than a guess. The follow-ups carry none, since
 * a person does not sign off every reply in a thread the same way.
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
 * stranger reads as a machine however true it is. Compliments read the same
 * way: a line about the year a business opened or how its reviews look is the
 * first thing an owner recognises as a mail merge. So the site takes only the
 * pictures and the two load times from the Pi's set, and the words are a few
 * plain sentences: who Trenton is, what he built, and that he will drive out
 * and talk if they are interested. Every letter ends on that offer and on
 * "Thanks, Trenton", the way a person signs an email.
 *
 * Where the Pi's set lacks the picture the first two letters are built around,
 * the written paragraphs go as they are rather than a letter with a gap in it.
 * The speed test letter does not need that: a business with no load times gets
 * a plain check-in instead, since the Pi's own write-up is the report the rest
 * of the chain stopped sending.
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

/**
 * The business as the letters name it, or null where they should say "your
 * business" instead. A name that is really a web address or a listing's
 * keyword string reads as a mail merge however it is cased.
 */
function sayableName(site) {
  const said = spokenName(site.name)
  const odd = !/\s/.test(said) && /^[a-z0-9]+$/.test(said)
  return !said || odd || said.length > 40 || /'s's|\bInc\.\s/.test(said) ? null : said
}

/** The line every letter ends on before it is signed. */
export const PREVIEW_OFFER = "I'll drive to you and we can talk if you're interested."

/** How every letter is signed above the drawn signature. */
export const PREVIEW_THANKS = 'Thanks,\nTrenton'

/**
 * The three ways the first letter introduces Trenton and the draft, and the
 * line before the offer that goes with each.
 */
const FIRST_LETTERS = [
  them => ({
    opening: [
      'My name is Trenton Taylor. I run a web design business in Baytown.',
      `I made a new website for ${them} to show you what I could do for you. Here's the link:`,
    ],
    close: PREVIEW_OFFER,
  }),
  them => ({
    opening: [
      `I'm Trenton, a web designer in Baytown. I put together a new website for ${them} using the info and photos from your current site and Google listing.`,
    ],
    close: `Take a look when you get a chance. ${PREVIEW_OFFER}`,
  }),
  them => ({
    opening: [
      `This is Trenton Taylor. I do websites for businesses around Baytown and Houston, and I built a sample site for ${them} that I wanted you to see.`,
    ],
    close: PREVIEW_OFFER,
  }),
]

function handTyped(site, nth, email) {
  const { letter } = site
  const them = sayableName(site) ?? 'your business'
  const seed = site.slug
  const first = firstNameOf(email)
  const hi = first ? `Hi ${first},` : 'Hi,'
  const has = key => Boolean(letter.images?.[key]?.src)
  const signed = [PREVIEW_OFFER, PREVIEW_THANKS]
  if (nth < 0) {
    if (!has('hero')) return null
    const { opening, close } = pickFor(seed, FIRST_LETTERS)(them)
    return [hi, ...opening, '{image:hero}', '{link}', close, PREVIEW_THANKS]
  }
  if (nth === 0) {
    if (!has('phones')) return null
    return [
      hi,
      pickFor(seed, [
        `I wanted to follow up on the website I sent you a few days ago. Here's how it looks on a phone:`,
        `I'm following up on the website I made for ${them}. Here's what it looks like on a phone:`,
      ]),
      '{image:phones}',
      '{link}',
      ...signed,
    ]
  }
  if (nth === 1) {
    const times = loadTimes(letter)
    if (!times || !has('speed')) {
      return [
        hi,
        `I wanted to check in again about the website I built for ${them}. You can still see it here: {url}`,
        ...signed,
      ]
    }
    const [theirs, ours] = times
    return [
      hi,
      ...pickFor(seed, [
        [
          `I ran your current website through Google's speed test. On a phone it took ${theirs} seconds to load. The one I built for you loads in ${ours}.`,
          '{image:speed}',
          'You can still see it here: {url}',
        ],
        [
          `One more thing I wanted to show you. Google's speed test has your current website loading in ${theirs} seconds on a phone. The new one I built loads in ${ours}.`,
          '{image:speed}',
          "Here's the link again: {url}",
        ],
      ]),
      ...signed,
    ]
  }
  if (nth === 2) {
    return [
      hi,
      pickFor(seed, [
        `I'll be taking down the website I made for ${them} on Friday. If you'd like me to keep it up, just reply and let me know.`,
        `This is my last email about the website I built for ${them}. I'm planning to take it down on Friday. If you want me to leave it up, just reply and let me know.`,
      ]),
      ...signed,
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
 * The subject is the site's own, `New website for` and the business, rather
 * than the one the Pi filed: a name and a company read like a newsletter, and
 * a follow-up keeps whatever subject its thread opened under. The postscript
 * is read as the letter is drafted, since the letters are filed days before
 * they go.
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
  // A thread that began under another subject keeps it, so a follow-up still
  // lands under the letter it follows.
  const opening = `New website for ${sayableName(site) ?? 'your business'}`
  const base = String(prior?.subject || opening).replace(/^Re:\s*/i, '')
  const subject = nth < 0 ? opening : `Re: ${base}`
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
