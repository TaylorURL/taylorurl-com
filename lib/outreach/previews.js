/**
 * The letters that carry a preview site to the business it was built for.
 *
 * A preview is a working site on a taylorurl.com subdomain, built in one
 * business's own logo, colours and photos and filed in `preview_sites`. It is
 * the third letter a cold business receives, after the introduction and the
 * meeting ask, and everything after it is about the same site: a follow-up a
 * week apart, each one a different reason to open the draft, until the
 * business has been sent ten letters in all, when it is taken off the list.
 * All of them are plain letters, rendered by lib/outreach/message.js the way
 * the cold letter is, so they carry the open square, the signature and the way
 * off the list.
 *
 * Each row may carry its own `letter`, written for that business: a subject and
 * the paragraphs, with `{url}` standing for the preview's address. A row
 * without one gets the letter below, which says nothing about the business that
 * the site itself does not show.
 *
 * Every preview letter, in both families below, closes on the same kind of
 * postscript: one line sending the owner to the studio's reviews and its
 * accreditation, with the figures read when the letter is drafted. The words
 * are lib/outreach/proof.js's; the sender hands the reading in as `proof`, and
 * a letter drafted without one carries no postscript rather than a guess.
 */

import { firstNameOf } from './first-names.js'
import { previewCampaign, proofLine } from './proof.js'
import {
  homeUrl,
  renderPersonalHtml,
  renderPersonalText,
  renderPlainHtml,
  renderPlainText,
} from './message.js'

/** The parent the preview subdomains hang off. */
export const PREVIEW_HOST = 'taylorurl.com'

/** How long after each preview letter the next one is owed. */
export const PREVIEW_FOLLOW_UP_DAYS = 7

/** How many letters a business is sent in all, cold ones included, before it is taken off the list. */
export const LETTERS_IN_ALL = 10

/** How many letters come before the preview: the introduction and the meeting ask. */
export const LETTERS_BEFORE_PREVIEW = 2

/** How long after the second letter the preview may go. */
export const PREVIEW_WAIT_DAYS = 5

/**
 * Fewer Google reviews than this and the preview leaves the rating out, so the
 * letters say nothing about reviews either. It decides only what is said: a
 * business with no reviews at all still gets its preview.
 */
export const RATING_SHOWN_FROM = 5

/** Whether this business has enough Google reviews for the letters to mention them. */
export const hasReviews = site => Number(site?.rating_count) >= RATING_SHOWN_FROM

/** Where a preview lives. */
export const previewUrl = slug => `https://${slug}.${PREVIEW_HOST}`

const fill = (text, url) => String(text).replaceAll('{url}', url)

/** The letter a business with no written letter of its own is sent. */
function standardFirst(name, url) {
  return {
    subject: `A draft website for ${name}`,
    paragraphs: [
      `I put together a first draft of a new website for ${name}. It's live here so you can click through it:\n${url}`,
      'It uses your logo, colors and photos, and keeps your phone number one tap away on every screen.',
      "It's a draft, so tell me what you'd change: the wording, the photos, the services, anything that isn't right. Reply with your notes and I'll make the changes.",
    ],
  }
}

/**
 * The follow-ups, in the order they go. Each comes at the draft from a
 * different side, so a business that ignored one is not sent it again in other
 * words. None of them names a domain or says where the site would live.
 */
const FOLLOW_UPS = [
  (name, url) => [
    `Following up on the draft website I put together for ${name} last week. It's still up here:\n${url}`,
    "What would you change about it? Reply with anything you'd want different and I'll update the draft.",
  ],
  (name, url) => [
    `Most people who look up ${name} will do it on a phone, so that's the best place to try the draft:\n${url}`,
    "Open it on yours and try calling from the top of the page, finding a service, and getting to your hours. If anything takes more than a tap or two, tell me and I'll fix it.",
  ],
  (name, url) => [
    `If you've wondered what it would take to turn the draft for ${name} into your real site, it's mostly a back and forth. You send notes, I change the draft, and you look again until it reads right:\n${url}`,
    "Where it goes live and what it's called is your call. A short reply with what you want changed is enough to start.",
  ],
  (name, url, site) => [
    hasReviews(site)
      ? `Two things would make the draft for ${name} feel more like yours: photos of recent jobs, and the reviews you're proudest of. It has room for both:\n${url}`
      : `One thing would make the draft for ${name} feel more like yours: photos of recent jobs. It has room for them:\n${url}`,
    "Reply with whatever you have, even phone photos, and I'll put them in.",
  ],
  (name, url) => [
    `I may have been writing to the wrong person about this. If someone else at ${name} looks after the website, would you forward them the draft?\n${url}`,
    "Or reply with their email and I'll send it to them directly.",
  ],
  (name, url) => [
    `One question about the draft website for ${name}: is a new site something you're thinking about this year, or not right now?\n${url}`,
    "Either answer helps. If it's not right now, say so and I'll stop writing about it.",
  ],
  (name, url) => [
    `This is the last note I'll send about the draft website for ${name}. It stays up here if you want to look at it later:\n${url}`,
    "If you ever want it finished or changed, reply to this email and I'll pick it up from there.",
  ],
]

/** How many follow-ups there are to send after the first preview letter. */
export const FOLLOW_UP_COUNT = FOLLOW_UPS.length

/**
 * Renders one preview letter in both halves.
 *
 * @param {object} site Row from `preview_sites`, with its prospect's email,
 *   name, unsub_token and Google review count (`rating_count`) beside it.
 * @param {'first'|'follow_up'} kind The first letter or a follow-up.
 * @param {{track: string, unsubscribe: string|null, prior?: {subject: string}, nth?: number,
 *   proof?: object}} context
 *   `nth` is which follow-up, counted from zero; the last one is sent past the end.
 *   `proof` is a reading from `readProof`, which the postscript is written from.
 */
export function previewLetter(
  site,
  kind,
  { track, unsubscribe, prior = null, at = new Date(), nth = 0, proof = null, origin }
) {
  const url = previewUrl(site.slug)
  const name = site.name
  let subject
  let paragraphs
  if (kind === 'first') {
    const own = site.letter?.paragraphs?.length ? site.letter : null
    const base = own ?? standardFirst(name, url)
    subject = fill(base.subject || `A new website for ${name}`, url)
    paragraphs = base.paragraphs.map(text => fill(text, url))
  } else {
    subject = prior?.subject
      ? `Re: ${prior.subject.replace(/^Re:\s*/i, '')}`
      : `Re: A new website for ${name}`
    // A row's own follow-up stands in for the first one only; the rest are the
    // different reasons below, which say nothing the site does not show.
    const own = nth === 0 && site.letter?.follow_up?.length ? site.letter.follow_up : null
    const write = FOLLOW_UPS[Math.min(nth, FOLLOW_UPS.length - 1)]
    paragraphs = (own ?? write(name, url, site)).map(text => fill(text, url))
  }
  const message = {
    subject,
    greeting: firstNameOf(site.email),
    at,
    paragraphs,
    // The picture of the site goes under the first paragraph, which is the one
    // that gives its address, and opens the same address.
    shot: site.shot_url
      ? { src: site.shot_url, href: url, alt: `The draft website for ${name}`, after: 0 }
      : null,
    track,
    origin,
    contact: { unsubscribe, site: homeUrl(track) },
    postscript: proofLine(proof, {
      campaign: previewCampaign('preview', kind === 'first' ? -1 : nth),
      nth: kind === 'first' ? -1 : nth,
    }),
    styled: true,
  }
  return { subject, text: renderPlainText(message), html: renderPlainHtml(message) }
}

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
      campaign: previewCampaign('first', nth, PREVIEW_FIRST_DAYS),
      nth,
    }),
  }
  return { subject, text: renderPersonalText(message), html: renderPersonalHtml(message) }
}
