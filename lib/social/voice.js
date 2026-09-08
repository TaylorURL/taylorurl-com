/**
 * What a post this studio publishes is allowed to sound like, and how long it
 * may run.
 *
 * Two rules, and both are here rather than in the heads of whoever is writing
 * that day. A queue publishes five days a week to three channels, mostly
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
export const prose = text =>
  blocks(text).filter(block => !SIGN_OFF.test(block) && !isHeadline(block))

/** A passage split into whole sentences, keeping the punctuation on each. */
export function sentences(text) {
  const passage = String(text ?? '').trim()
  if (!passage) return []
  return (passage.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [passage]).map(sentence => sentence.trim())
}

/** How many sentences of prose a post carries. */
export const sentenceCount = text =>
  prose(text).reduce((total, block) => total + sentences(block).length, 0)

/** Whether a post is inside the ceiling. */
export const withinCeiling = text => sentenceCount(text) <= MAX_SENTENCES

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
