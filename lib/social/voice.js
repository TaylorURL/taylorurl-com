/**
 * What a post this studio publishes is allowed to sound like, how long it may
 * run, and what it may call the price.
 *
 * Three rules, and all of them are here rather than in the heads of whoever is
 * writing that day. A queue publishes five days a week to three channels, mostly
 * unattended, and a rule that lives in a person's memory is a rule the first
 * unattended run breaks.
 *
 * The voice is the studio's, never one person's. TaylorURL is more than one
 * pair of hands, and a post written as "I build" contradicts the About page,
 * the contract and whoever actually answers the phone. `firstPerson` is what
 * refuses it before it is scheduled, because a scheduled post is out of reach
 * the moment it publishes.
 *
 * The length is three sentences. Not a style note: a reader meeting a post in a
 * feed gives it about a line and a half before deciding, and the queue's own
 * history is full of six-paragraph posts that were read to the end by nobody. A
 * ceiling written down is the only version of that rule that survives a run
 * nobody watched.
 */

import { BUILD_PRICE, MARKET, MONTHLY_PRICE } from '../../src/app/data/checkout/pricing.js'

/** The most sentences a post may carry, on any channel. */
export const MAX_SENTENCES = 3

/**
 * The longest a block may run and still be read as a headline rather than prose.
 *
 * A headline is not counted, so the exemption has to be bounded or it is a hole
 * anything fits through: a paragraph that happens to end without a full stop
 * would otherwise buy itself out of the rule entirely.
 */
const HEADLINE_WORDS = 12

/**
 * A block carrying an address or a number rather than a sentence.
 *
 * The line a reader acts on is not the writing they had to get through first.
 * A post's link and its phone number are its signature, so they are exempt, and
 * the shapes are named exactly rather than matched loosely — a sentence with a
 * URL in the middle of it is prose, and only a line that is nothing but the
 * address is a sign-off.
 */
const SIGN_OFF =
  /^(?:call or text\s+)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|https?:\/\/\S+|[\w-]+(?:\.[\w-]+)+(?:\/\S*)?)$/i

/** Whether a block is a headline: no terminal punctuation, and short. */
const isHeadline = block =>
  !/[.!?]$/.test(block) && block.split(/\s+/).length <= HEADLINE_WORDS && !block.includes('\n')

/** The blocks of a post, as the reader meets them. */
const blocks = text =>
  String(text ?? '')
    .split(/\n{2,}|\n/)
    .map(block => block.trim())
    .filter(Boolean)

/**
 * The blocks of a post that are prose, which is what the ceiling counts.
 *
 * Everything is prose except the two things a person does not read as writing:
 * the headline the post is named by, and the address or number it signs off
 * with.
 */
const prose = text => blocks(text).filter(block => !SIGN_OFF.test(block) && !isHeadline(block))

/** A passage split into whole sentences, keeping the punctuation on each. */
export function sentences(text) {
  const passage = String(text ?? '').trim()
  if (!passage) return []
  return (passage.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [passage]).map(sentence => sentence.trim())
}

/** How many sentences of prose a post carries. */
export const sentenceCount = text =>
  prose(text).reduce((total, block) => total + sentences(block).length, 0)

/**
 * The words that make a post read as one person rather than as the studio.
 *
 * `I` is matched on its own case because a lowercase `i` between word
 * boundaries is a variable name or a list item, never the pronoun.
 */
const SINGULAR = /\b(?:I|I'm|I've|I'll|I'd)\b|\b(?:me|my|mine|myself)\b/g

/**
 * The phrasings that say the studio is one person without using a pronoun.
 *
 * Kept beside the pronouns because they are the harder half: a post can be
 * written entirely in "we" and still open with "a one-person studio", and that
 * sentence is the one a prospect reads and believes.
 */
const SOLO = /\bone[- ]person\b|\bone[- ]man\b|\bjust me\b|\bsolo (?:studio|shop|developer)\b/gi

/**
 * The first-person wording in a passage, or an empty list where there is none.
 *
 * Answers what was found rather than whether anything was, so a check can name
 * the word it is refusing instead of leaving somebody to reread the post
 * looking for it.
 *
 * @param {string} text A post, or the part of one written by the studio.
 * @returns {string[]} Each offending word or phrase, in the order it appears.
 */
export function firstPerson(text) {
  const passage = String(text ?? '')
  return [...(passage.match(SINGULAR) ?? []), ...(passage.match(SOLO) ?? [])]
}

/**
 * The two figures the site publishes, which are the only ones a post may quote
 * as this studio's price.
 *
 * Read off the same module the pricing page, the care page and the checkout
 * read, so a price that moves moves here in the same commit rather than being
 * typed a second time and left behind. That is the whole failure this catches:
 * the monthly moved from one figure to another, every page followed it, and a
 * post composed a week later carried the old one into the Business Profile
 * queue because nothing between the writer and Buffer knew what the price was.
 */
const PRICED = [
  // A monthly, in the shapes a post writes one: a month, per month, /mo.
  {
    pattern: /\$\s?[\d,]+(?:\.\d{2})?(?=\s*(?:a|per)\s+month\b|\s*\/\s*mo\b)/gi,
    published: MONTHLY_PRICE,
    term: 'a month',
  },
  // The build, paid once, in the shapes a post writes that.
  {
    pattern: /\$\s?[\d,]+(?:\.\d{2})?(?=\s*(?:up front|to build|for the build|one time|once)\b)/gi,
    published: BUILD_PRICE,
    term: 'up front',
  },
]

/**
 * A figure with the punctuation a person writes it with taken back off, so the
 * comparison is arithmetic rather than typography. `$1,000`, `$1000` and
 * `$1,000.00` are one price written three ways, and a check that reads them as
 * three prices is a check that fires on correct copy.
 */
const asAmount = figure => String(figure).replace(/[\s,]/g, '').replace(/\.00$/, '')

/**
 * The figures the site puts next to a term that are somebody else's rather than
 * this studio's.
 *
 * The pricing page sets its own two figures against the band the same work gets
 * quoted in elsewhere, and a post is allowed to make that comparison. So the
 * band's bounds are exempt: a post reading "studios quote $150 to $500 a month"
 * is quoting published data, and a rule that refused it would refuse the one
 * post shape the price is most worth writing about.
 */
const COMPARED = new Set(
  [MARKET.buildLow, MARKET.buildHigh, MARKET.monthlyLow, MARKET.monthlyHigh].map(
    amount => `$${amount}`
  )
)

/**
 * The prices a passage states that are not the ones the site publishes.
 *
 * Only a figure standing next to this studio's own price language is read as a
 * price. A post is free to carry any other number - what a trade charges, what
 * a client's own booking costs, what an hour of somebody's time is worth - and
 * a rule that read every dollar sign as a price claim would refuse all of it.
 *
 * @param {string} text A post, or a caption.
 * @returns {{found: string, published: string, term: string}[]} Each stale
 *   figure, with the figure the site publishes in its place.
 */
export function misquotedPrices(text) {
  const passage = String(text ?? '')
  const wrong = []
  for (const { pattern, published, term } of PRICED) {
    for (const found of passage.match(pattern) ?? []) {
      const amount = asAmount(found)
      if (amount === asAmount(published) || COMPARED.has(amount)) continue
      wrong.push({ found: found.trim(), published, term })
    }
  }
  return wrong
}
