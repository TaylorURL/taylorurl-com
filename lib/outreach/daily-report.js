/**
 * The day's outreach as the studio reads it at five: one table of what each
 * chain sent today, how many of those letters were opened, and who wrote back.
 * A reply is listed under the chain its business was written on, with the
 * first of what the person typed; a reply a machine sent is left out.
 *
 * The four chains are the four outreach is made of (see lib/outreach/variants.js).
 * A letter's chain is read off the variant it was written under: the draft
 * preview letters carry none, the lawsuit letters carry a lawsuit variant, and
 * every other cold letter is the introduction's. The new business letters are
 * rows of their own table and carry no open square, so their opens are not
 * tracked rather than nought.
 *
 * The letter is drawn on the sheet the rest of the studio's own mail carries
 * (lib/mail/frame.js), so the recap lands in the inbox looking like the
 * notices beside it.
 *
 * Strings and pure functions only, so the check can render a whole recap
 * without a database or a mail server.
 */

import { formatInstant, instantOf } from '../time/zone.js'
import { escapeHtml } from '../mail/escape.js'
import { newText, readAutoReply } from './sending/replies.js'
import {
  HAIRLINE,
  INK,
  INK_FAINT,
  INK_SOFT,
  MONO,
  SANS,
  eyebrowMark,
  page,
  rule,
} from '../mail/frame.js'

/** The chains in the order the recap lists them. */
export const CHAINS = Object.freeze(['Draft preview', 'Introduction', 'Lawsuit', 'New business'])

/** What stands in the opens column for the chain that has no open square. */
export const NOT_TRACKED = 'not tracked'

/** What stands in the opens column for a chain that sent nothing. */
const NONE = '–'

/**
 * The chain an outreach letter went out on.
 *
 * It is looked up where the caller hands over a registry to look it up in,
 * and only guessed where that answers nothing.
 *
 * The guess is what this did on its own, and it was wrong in both directions
 * the moment a chain was added: a chain called 'lawsuit-appeal' reads as the
 * lawsuit chain, and a chain sharing no word with its letters reads as the
 * introduction. It is kept because a letter retired before the chains existed
 * is still on messages this recap counts, and its id is all there is left of
 * it - so an id the registry does not know is read the way it always was
 * rather than counted as nothing.
 *
 * A letter carrying no variant at all is the draft preview, whose words are
 * written per business and filed on its own row rather than registered.
 *
 * @param {string|null|undefined} variantId
 * @param {((id: string) => string|null)|null} [named] Answers the chain's name
 *   for a letter id, or null where it does not know the id.
 * @returns {string}
 */
export function chainOf(variantId, named = null) {
  if (!variantId) return 'Draft preview'
  const found = typeof named === 'function' ? named(variantId) : null
  if (found) return found
  if (String(variantId).includes('lawsuit')) return 'Lawsuit'
  return 'Introduction'
}

/** A day `days` after a `YYYY-MM-DD` date, by the calendar alone. */
export function shiftDate(date, days) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** The instants a Central day runs between, start included and end not. */
export function windowOf(date) {
  return { from: instantOf(date).toISOString(), to: instantOf(shiftDate(date, 1)).toISOString() }
}

const SUFFIXES = /[\s,]+(llc|l\.l\.c\.|inc\.?|pllc|ltd\.?|corp\.?|co\.?)$/i

/**
 * A filed business name as a person writes it: the state files them in
 * capitals with the entity type on the end.
 */
export function plainName(name) {
  const bare = String(name ?? '')
    .trim()
    .replace(SUFFIXES, '')
  if (bare !== bare.toUpperCase()) return bare
  return bare.toLowerCase().replace(/\b[a-z]/g, letter => letter.toUpperCase())
}

const reasonOf = error =>
  /timeout/i.test(String(error)) ? 'a timeout' : String(error || 'an error')

/** The line a day's failed new business letters leave under that chain. */
function failedNote(failed) {
  if (!failed.length) return ''
  const reasons = new Set(failed.map(one => reasonOf(one.error)))
  const names = failed.map(one => plainName(one.name))
  if (reasons.size === 1) {
    return `${failed.length} failed on ${[...reasons][0]}: ${names.join(', ')}`
  }
  const each = failed.map((one, index) => `${names[index]} on ${reasonOf(one.error)}`)
  return `${failed.length} failed: ${each.join('; ')}`
}

/** The chain a reply is listed under when nothing ties it to one of the four. */
export const OTHER = 'Other'

/**
 * A receipt a mailbox sends the moment anything arrives. The watch job lets
 * these through under "Re:" because a person's answer opens with the same
 * courtesy, but nobody types that they have received an email.
 */
const RECEIPT =
  /\b(?:we|i)(?:'ve| have)? received your (?:e-?mail|message|inquiry|enquiry|request)\b/

/**
 * Whether a filed reply came from a machine rather than a person. The stored
 * intent is read first, then the reply is read again with today's readers,
 * since a row filed before a reader learned a pattern still carries the
 * verdict it was filed under.
 */
export function isAutomated(reply) {
  if (reply.intent === 'auto_reply') return true
  if (readAutoReply(reply.subject, reply.body).auto) return true
  return RECEIPT.test(String(newText(reply.body)).toLowerCase())
}

const SIGN_OFFS =
  /\b(?:get outlook for (?:ios|android)|sent from my (?:iphone|ipad|android|phone))\b.*$/i
const SAID_LIMIT = 140

/** A body filed as the raw message, headers first, which holds nothing to quote. */
const RAW_HEADERS = /^(?:delivered-to|received|return-path|x-[\w-]+|arc-[\w-]+|dkim-signature):/i

/**
 * The first paragraph of what a person typed, in one line. The paragraph is
 * where the answer is; what follows it is a signature.
 */
export function saidIn(body) {
  const typed = String(newText(body)).trim()
  if (RAW_HEADERS.test(typed)) return ''
  const said = (typed.split(/\r?\n\s*\r?\n/)[0] ?? '')
    .replace(/\s+/g, ' ')
    .replace(SIGN_OFFS, '')
    .trim()
  return said.length > SAID_LIMIT ? `${said.slice(0, SAID_LIMIT - 1).trimEnd()}…` : said
}

/**
 * One day's rows tallied by chain.
 *
 * @param {{outreach?: object[], newBusiness?: object[], failed?: object[], replies?: object[]}} rows
 *   `outreach` holds the day's sent outbound rows (`variant_id`, `opened_at`),
 *   `newBusiness` the sent new business rows, `failed` the new business
 *   letters that failed and were never sent since (`name`, `error`), and
 *   `replies` the day's filed replies (`chain`, `name`, `subject`, `body`,
 *   `intent`), automated ones included: they are dropped here.
 * @param {((id: string) => string|null)|null} [named] Answers a letter id's
 *   chain name, which `chainOf` uses in place of its guess.
 * @returns {{chains: object[], total: number, replies: number}}
 */
export function tallyOf(
  { outreach = [], newBusiness = [], failed = [], replies = [] },
  named = null
) {
  const counts = new Map(CHAINS.map(chain => [chain, { sent: 0, opens: 0, replies: [] }]))
  for (const row of outreach) {
    const chain = chainOf(row.variant_id, named)
    // A chain the recap does not list a lane for still has to be counted
    // somewhere. It gets a lane of its own at the end rather than being added
    // to whichever lane happens to be first, which is what reading
    // `counts.get` without checking used to do: a chain added to the registry
    // and not to the list above took the whole run down.
    //
    // `added` rather than `other`, and the difference is what the lane says.
    // An `other` lane was opened by a reply filed under something that is not
    // a chain at all, so it has no sends to report and says so. This one was
    // opened by a send, and reporting that as nothing would be the recap
    // losing letters it had counted in its own total.
    if (!counts.has(chain)) counts.set(chain, { sent: 0, opens: 0, replies: [], added: true })
    const one = counts.get(chain)
    one.sent += 1
    if (row.opened_at) one.opens += 1
  }
  counts.get('New business').sent = newBusiness.length

  const people = replies.filter(reply => !isAutomated(reply))
  for (const reply of people) {
    const chain = counts.has(reply.chain) ? reply.chain : OTHER
    if (!counts.has(chain)) counts.set(chain, { sent: 0, opens: 0, replies: [], other: true })
    counts.get(chain).replies.push({
      name: plainName(reply.name) || reply.from || 'Someone',
      said: saidIn(reply.body),
      optOut: reply.intent === 'opt_out',
    })
  }

  const chains = [...counts.entries()].map(([chain, { sent, opens, replies: said, other }]) => {
    const isNew = chain === 'New business'
    return {
      chain,
      sent: other ? NONE : sent,
      opens: isNew ? NOT_TRACKED : other || !sent ? NONE : String(opens),
      replies: said,
      note: isNew ? failedNote(failed) : '',
    }
  })
  return { chains, total: outreach.length + newBusiness.length, replies: people.length }
}

const onDay = (date, options) => formatInstant(instantOf(date, '12:00:00'), options)

/** The day as the recap names it: `Tuesday, Oct 27`. */
export const dayName = date =>
  `${onDay(date, { weekday: 'long' })}, ${onDay(date, { month: 'short', day: 'numeric' })}`

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

const sentLine = tally =>
  `${plural(tally.total, 'email', 'emails')} sent today · ${plural(tally.replies, 'reply', 'replies')}`

/** What a reply line says about the person: their words, and a stop asked for. */
const replyLine = reply =>
  `${reply.name}${reply.said ? `: “${reply.said}”` : ''}${reply.optOut ? ' (asked to stop)' : ''}`

const HEAD = `font-family:${MONO};font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${INK_FAINT};padding:0 0 10px 0;border-bottom:1px solid ${HAIRLINE};`
const CELL = `font-family:${SANS};font-size:15px;line-height:1.4;color:${INK};padding:14px 0;border-bottom:1px solid ${HAIRLINE};`
const FAINT = `font-family:${SANS};font-size:13px;color:${INK_FAINT};`
const TOTAL = `font-family:${SANS};font-size:15px;font-weight:600;color:${INK};padding:14px 0 0 0;border-top:2px solid ${INK};`

/** A figure in the right-hand columns, set faint when it is not a count. */
function figure(value) {
  const text = escapeHtml(value)
  return /^\d+$/.test(String(value)) ? text : `<span style="${FAINT}">${text}</span>`
}

const LEFT = `${CELL}text-align:left;vertical-align:top;`
const RIGHT = `${CELL}text-align:right;vertical-align:top;`

/** The lines under a chain's name: a failure note, then each reply. */
function underChain(one) {
  const note = one.note
    ? `<div style="margin-top:4px;font-family:${SANS};font-size:12px;line-height:1.5;color:${INK_FAINT};">${escapeHtml(one.note)}</div>`
    : ''
  const replies = one.replies
    .map(
      reply =>
        `<div style="margin-top:8px;padding-left:10px;border-left:2px solid ${HAIRLINE};font-family:${SANS};font-size:13px;line-height:1.5;color:${INK_SOFT};"><strong style="font-weight:600;color:${INK};">${escapeHtml(reply.name)}</strong>${reply.said ? `: “${escapeHtml(reply.said)}”` : ''}${reply.optOut ? `<span style="${FAINT}font-size:12px;"> (asked to stop)</span>` : ''}</div>`
    )
    .join('')
  return note + replies
}

function tableHtml(tally) {
  const rows = tally.chains
    .map(
      one => `<tr>
          <td align="left" valign="top" style="${LEFT}">${escapeHtml(one.chain)}${underChain(one)}</td>
          <td align="right" valign="top" style="${RIGHT}">${figure(one.sent)}</td>
          <td align="right" valign="top" style="${RIGHT}">${figure(one.opens)}</td>
          <td align="right" valign="top" style="${RIGHT}">${figure(one.replies.length)}</td>
        </tr>`
    )
    .join('')

  return `<tr><td align="left" style="padding:28px 40px 0 40px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;">
      <tr>
        <th align="left" style="${HEAD}text-align:left;">Chain</th>
        <th align="right" width="64" style="${HEAD}width:64px;text-align:right;">Sent</th>
        <th align="right" width="104" style="${HEAD}width:104px;text-align:right;">Email opens</th>
        <th align="right" width="80" style="${HEAD}width:80px;text-align:right;">Replies</th>
      </tr>
      ${rows}
      <tr>
        <td align="left" style="${TOTAL}text-align:left;">Total</td>
        <td align="right" style="${TOTAL}text-align:right;">${escapeHtml(tally.total)}</td>
        <td align="right" style="${TOTAL}text-align:right;"></td>
        <td align="right" style="${TOTAL}text-align:right;">${escapeHtml(tally.replies)}</td>
      </tr>
    </table>
  </td></tr>`
}

function tableText(tally) {
  const rows = [
    ['Chain', 'Sent', 'Email opens', 'Replies'],
    ...tally.chains.map(one => [
      one.chain,
      String(one.sent),
      one.opens,
      String(one.replies.length),
    ]),
    ['Total', String(tally.total), '', String(tally.replies)],
  ]
  const widths = rows[0].map((_, column) => Math.max(...rows.map(row => row[column].length)))
  const line = row =>
    row
      .map((cell, column) => (column ? cell.padStart(widths[column]) : cell.padEnd(widths[column])))
      .join('   ')
      .trimEnd()
  const rule = widths.map(width => '-'.repeat(width)).join('   ')
  const body = rows.map(line)
  return [body[0], rule, ...body.slice(1, -1), rule, body.at(-1)].join('\n')
}

/**
 * The recap as a letter: its subject and both halves.
 *
 * @param {string} date The Central day, `YYYY-MM-DD`.
 * @param {ReturnType<typeof tallyOf>} tally
 * @returns {{subject: string, text: string, html: string}}
 */
export function renderRecap(date, tally) {
  const day = dayName(date)
  const subject = `Outreach recap for ${day}: ${tally.total} sent, ${plural(tally.replies, 'reply', 'replies')}`
  const notes = tally.chains.filter(one => one.note).map(one => `${one.chain}: ${one.note}`)
  const said = tally.chains.flatMap(one =>
    one.replies.map(reply => `${one.chain} reply from ${replyLine(reply)}`)
  )

  const text = [
    '// OUTREACH RECAP',
    '',
    day,
    sentLine(tally),
    '',
    tableText(tally),
    ...(notes.length ? ['', ...notes] : []),
    ...(said.length ? ['', ...said] : []),
    '',
    '--',
    'Sent daily at 5 PM Central',
    '',
  ].join('\n')

  const html = page({
    title: subject,
    preheader: `${sentLine(tally)} · ${tally.chains
      .filter(one => Number(one.sent) > 0)
      .map(one => `${one.chain} ${one.sent}`)
      .join(' · ')}`,
    content: `<tr><td align="left" style="padding:30px 40px 0 40px;">
        ${eyebrowMark('Outreach recap')}
      </td></tr>
      <tr><td align="left" style="padding:14px 40px 0 40px;">
        <h1 style="margin:0;font-family:${SANS};font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:${INK};">${escapeHtml(day)}</h1>
        <p style="margin:8px 0 0 0;font-family:${SANS};font-size:15px;line-height:1.5;color:${INK_SOFT};">${escapeHtml(sentLine(tally))}</p>
      </td></tr>
      ${tableHtml(tally)}
      <tr><td align="left" style="padding:32px 40px 36px 40px;">
        ${rule()}
        <p style="margin:20px 0 0 0;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.9;color:${INK_FAINT};">Sent daily at 5 PM Central</p>
      </td></tr>`,
  })

  return { subject, text, html }
}
