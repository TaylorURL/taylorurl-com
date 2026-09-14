/**
 * The audit one business gets in writing, after a caller has read it to them
 * down the phone.
 *
 * A caller rings a business, says what Google's test made of their site, and
 * the owner agrees to see it. Everything said on that call is gone the moment
 * it ends: the four numbers, the reason each one is low, the date the reading
 * was taken. This is the same reading as a message, so the owner has it in
 * front of them when they come back to it, and so the person who decides is
 * reading the figures rather than being told about them second hand.
 *
 * It is not a cold letter and it is not a quote. The reader asked for it, so
 * nothing here sells: no client work, no case for the studio, and no figure of
 * any kind. Pricing happens on the call that follows, off what the site
 * actually has to do, and a number in this message would be a number arrived
 * at before anybody had asked what the job is.
 *
 * The reading itself comes from lib/outreach/audit/reading.js, which is the
 * same module the call screen draws. The screen and this message cannot
 * disagree about what a row says, because neither of them reads the row.
 *
 * Drawn on the sheet in frame.js, which is the sheet every message the studio
 * sends opens on, and signed with the studio's name and number alone: the
 * reader has already spoken to a person and is about to again, so a biography
 * under the report would be a stranger introducing himself twice. Both halves
 * are built from one reading, so a client showing the plain part shows the same
 * scores, the same issues and the same call time as one showing the laid-out
 * part.
 *
 * There is nothing to click at the end of it. The caller booked the next call
 * before pressing send, so the message closes on that time rather than on a
 * button: the reader already said yes to a call, and a link asking them to
 * start something would be asking for a second yes they never gave.
 *
 * Every value that comes off the row is escaped on its way in. A business name
 * is typed by whoever sourced it and a report title comes from Google, so
 * neither is the studio's own text, and markup in either would be markup in a
 * message the studio signed.
 */

import {
  ACCENT,
  HAIRLINE,
  INK,
  INK_FAINT,
  INK_SOFT,
  MONO,
  PAGE,
  SANS,
  eyebrowMark,
  page,
  rule,
} from './frame.js'
import { escapeHtml } from './escape.js'
import { BIO_PHONE, BIO_PHONE_HREF } from './bio.js'
import { TRADING_LINE } from './identity.js'
import { auditReading } from '../outreach/audit/reading.js'
import { verify } from '../outreach/audit/bands.js'
import { formatInstant } from '../time/zone.js'

/**
 * The sheet the card is drawn on, which frame.js holds for itself.
 *
 * Written out here rather than imported because the frame does not export it,
 * and every band below has to paint its own ground: a client that inverts the
 * type without inverting the cell leaves pale ink on pale paper, and a cell
 * that states no colour is the one that inverts.
 */
const CARD = '#faf9f5'

/**
 * The ink and the wash each band takes, mirroring the palette in
 * lib/outreach/message.js.
 *
 * That constant is private to the cold letter, and the two are the same three
 * bands said the same way on purpose: a business that had a letter and then an
 * audit should meet one colour for poor rather than two. `plain` is the cell
 * with no number in it, and it takes the page's own ink so it reads as a fact
 * about the report rather than as a verdict on the site.
 */
const BANDS = {
  poor: { ink: '#cf1f1f', wash: '#fef2f2', edge: '#fca5a5' },
  fair: { ink: '#b45309', wash: '#fef5e7', edge: '#fbd89d' },
  good: { ink: '#0f7a56', wash: '#e7f8f2', edge: '#9fe3cd' },
  plain: { ink: INK, wash: PAGE, edge: HAIRLINE },
}

/**
 * What each band is called, in Google's own words.
 *
 * The number moves a few points between runs and the band it lands in does
 * not, so the word beside the number is the part of the reading that holds. It
 * is Google's word rather than one of the studio's, because the reader can
 * open the report and check it.
 */
const BAND_WORDS = {
  poor: 'Poor',
  fair: 'Needs improvement',
  good: 'Good',
  plain: 'Not scored',
}

/** One run of type, as the inline declarations a mail client actually reads. */
function sans({ size, weight = 400, height = 1.6, color = INK, track = '' }) {
  return `font-family:${SANS};font-size:${size}px;font-weight:${weight};line-height:${height};color:${color}${track ? `;letter-spacing:${track}` : ''}`
}

/** The mono micro-label every section in the studio's mail is marked with. */
function mono({ size = 10, color = INK_FAINT }) {
  return `font-family:${MONO};font-size:${size}px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;line-height:1.7;color:${color}`
}

/** One band of the card, painting its own ground. */
function band(content, padding) {
  return `<tr><td align="left" bgcolor="${CARD}" style="background-color:${CARD};padding:${padding};">${content}</td></tr>`
}

/** One score, as the cell it is drawn in. */
function scoreCell(score, gutter) {
  const tone = BANDS[score.band] ?? BANDS.plain
  const figure = score.value === null ? BAND_WORDS.plain : String(score.value)
  const said =
    score.value === null ? 'Google answered nothing for this one' : BAND_WORDS[score.band]

  return (
    `<td width="50%" valign="top" style="width:50%;padding:${gutter};">` +
    '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;">' +
    `<tr><td bgcolor="${tone.wash}" style="background-color:${tone.wash};border:1px solid ${tone.edge};padding:16px 18px;">` +
    `<div style="${mono({ color: INK_SOFT })}">${escapeHtml(score.label)}</div>` +
    `<div style="${sans({ size: score.value === null ? 20 : 40, weight: 700, height: 1.1, color: tone.ink, track: '-0.03em' })};padding-top:6px;">${escapeHtml(figure)}</div>` +
    `<div style="${sans({ size: 13, height: 1.5, color: tone.ink })};padding-top:4px;">${escapeHtml(said)}</div>` +
    '</td></tr></table></td>'
  )
}

/**
 * The four scores, two across and two down.
 *
 * Two columns rather than four, because four cells side by side are 130 pixels
 * wide on a phone and the figure in them is the largest type in the message.
 * The gutter is padding inside each half rather than a column of its own, so
 * the two halves are an even fifty per cent whatever the client makes of a
 * spacer cell.
 */
function scoreGrid(scores) {
  const row = pair =>
    `<tr>${scoreCell(pair[0], '0 6px 0 0')}${pair[1] ? scoreCell(pair[1], '0 0 0 6px') : '<td width="50%" style="width:50%;">&nbsp;</td>'}</tr>`
  const spacer =
    '<tr><td colspan="2" height="12" style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>'
  const rows = []
  for (let at = 0; at < scores.length; at += 2) rows.push(row(scores.slice(at, at + 2)))

  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;">${rows.join(spacer)}</table>`
}

/**
 * What the report found, as sentences rather than as audit names.
 *
 * The reading has already turned Lighthouse's own titles into what they mean
 * for the person who owns the page, and it has already dropped the categories
 * that scored well. So this draws whatever it was handed, in the order it was
 * handed it, and a reading with nothing short in it draws nothing at all.
 */
function issueList(issues) {
  if (!issues.length) return ''
  const rows = issues
    .map(
      issue =>
        `<tr>
          <td width="10" valign="top" style="width:10px;padding:0 12px 10px 0;line-height:0;font-size:0;"><table role="presentation" border="0" cellpadding="0" cellspacing="0" width="10" style="border-collapse:collapse;width:10px;"><tr><td height="10" bgcolor="${ACCENT}" style="height:10px;line-height:10px;font-size:0;background-color:${ACCENT};">&nbsp;</td></tr></table></td>
          <td valign="top" style="padding:0 0 10px 0;${sans({ size: 15, color: INK_SOFT })};">${escapeHtml(issue.text)}</td>
        </tr>`
    )
    .join('')

  return (
    `<div style="${mono({ size: 11, color: INK_FAINT })};padding-bottom:12px;">What The Report Found</div>` +
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;">${rows}</table>`
  )
}

/** When the reading was taken, and the address it was taken on. */
function measuredLine(at, site) {
  const when = formatInstant(at, { month: 'long', day: 'numeric', year: 'numeric' }, '')
  if (!when) return ''
  const said = site ? `Measured ${when} on ${site}` : `Measured ${when}`
  return `<p style="margin:0;${sans({ size: 13, color: INK_FAINT })};word-break:break-word;">${escapeHtml(said)}</p>`
}

/**
 * Where the reading can be taken again.
 *
 * A stranger quoting a number is making a claim. Handing over the link that
 * runs Google's own test on the reader's own address is making one they can
 * settle in half a minute, and the note is worded for that in bands.js, so it
 * is drawn from there rather than written again.
 */
function verifyNote(site) {
  if (!site) return ''
  const note = verify(site)
  return (
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;background-color:${PAGE};border:1px solid ${HAIRLINE};">` +
    `<tr><td bgcolor="${PAGE}" style="background-color:${PAGE};padding:18px 20px;">` +
    `<div style="${mono({ size: 11, color: INK_FAINT })}">${escapeHtml(note.label)}</div>` +
    `<p style="margin:10px 0 0 0;${sans({ size: 14, color: INK_SOFT })};">${escapeHtml(note.lead)} <a href="${escapeHtml(note.href)}" style="color:${ACCENT};text-decoration:underline;">${escapeHtml(note.link)}</a>. ${escapeHtml(note.tail)}</p>` +
    '</td></tr></table>'
  )
}

/** The next call, as a person says it: the day, the date and the hour. */
function nextCallSaid(at) {
  const when = formatInstant(
    at,
    { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
    ''
  )
  return when ? `${when} Central` : ''
}

/**
 * When the studio rings back, which is the one thing the reader does next.
 *
 * The time is drawn large and on its own line, because it is the only part of
 * the message the reader has to act on, and it is followed by the number to
 * ring where the hour stops suiting them. That sentence names who moves it,
 * because a time that "can be changed" has nobody changing it.
 */
function nextCallBand(at) {
  const when = nextCallSaid(at)
  if (!when) return ''
  return (
    `<div style="${mono({ size: 11, color: INK_FAINT })};padding-bottom:10px;">Your Next Call</div>` +
    `<p style="margin:0;${sans({ size: 22, weight: 600, height: 1.25, color: INK, track: '-0.02em' })};">${escapeHtml(when)}</p>` +
    `<p style="margin:12px 0 0 0;${sans({ size: 15, color: INK_SOFT })};">Have this open when we ring. We go through the report with you on the line, and we price the job off what the site has to do.</p>` +
    `<p style="margin:12px 0 0 0;${sans({ size: 14, color: INK_FAINT })};">If that time stops working, ring us on <a href="${BIO_PHONE_HREF}" style="color:${ACCENT};text-decoration:underline;">${escapeHtml(BIO_PHONE)}</a> and we move it.</p>`
  )
}

/**
 * Who sent it and how to ring them.
 *
 * The studio's registered name and town, and its number. No portrait and no
 * biography, because the reader booked a call with a person this morning and
 * the report is that person's follow-through rather than an introduction. And
 * no unsubscribe link, because this is not a list: one copy goes to the one
 * person who asked for it on the phone.
 */
function footer() {
  return (
    `<p style="margin:0;${mono({ size: 10, color: INK_FAINT })}">${escapeHtml(TRADING_LINE)}</p>` +
    `<p style="margin:6px 0 0 0;${mono({ size: 10, color: INK_FAINT })}">Or ring <a href="${BIO_PHONE_HREF}" style="color:${INK_FAINT};text-decoration:none;">${escapeHtml(BIO_PHONE)}</a></p>`
  )
}

/** The scores as one line, which is what a client shows beside the subject. */
function preheaderOf(scores) {
  return scores
    .map(score => `${score.label} ${score.value === null ? 'not scored' : score.value}`)
    .join(', ')
}

/**
 * The same message as text, for a client that takes the plain half.
 *
 * It keeps the laid-out order rather than the layout, so a reader on either
 * side is reading the same message: the same four scores, the same findings,
 * the same date, the same link to the test and the same call time.
 */
function auditText({ name, site, scores, issues, at, nextCall }) {
  const when = formatInstant(at, { month: 'long', day: 'numeric', year: 'numeric' }, '')
  const note = site ? verify(site) : null
  const lines = ['// YOUR SITE AUDIT', '', `Here is the audit of the ${name} website.`, '']

  lines.push(
    site
      ? `We ran Google's PageSpeed Insights on ${site} and asked it for the phone version. The test is free, it is Google's own, and it grades four things out of a hundred.`
      : "We ran Google's PageSpeed Insights on your site and asked it for the phone version. The test is free, it is Google's own, and it grades four things out of a hundred."
  )

  lines.push('', 'THE SCORES')
  for (const score of scores) {
    lines.push(
      score.value === null
        ? `${score.label}: not scored`
        : `${score.label}: ${score.value} (${BAND_WORDS[score.band]})`
    )
  }

  if (issues.length) {
    lines.push('', 'WHAT THE REPORT FOUND')
    for (const issue of issues) lines.push(`- ${issue.text}`)
  }

  if (when) lines.push('', site ? `Measured ${when} on ${site}` : `Measured ${when}`)

  if (note) {
    lines.push('', note.label.toUpperCase(), `${note.lead} ${note.href}`, note.tail)
  }

  const ring = nextCallSaid(nextCall)
  if (ring) {
    lines.push(
      '',
      'YOUR NEXT CALL',
      ring,
      'Have this open when we ring. We go through the report with you on the line, and we price the job off what the site has to do.',
      `If that time stops working, ring us on ${BIO_PHONE} and we move it.`
    )
  }

  lines.push('', '--', TRADING_LINE, `Or ring ${BIO_PHONE}`)

  return lines.join('\n')
}

/**
 * One business's audit, both halves of it, ready to hand over.
 *
 * @param {object} options
 * @param {object} options.prospect The row, carrying the audit columns and the
 *   name, trade and town the message is addressed about.
 * @param {Date|string} options.nextCall When the caller booked the next call
 *   for, which the message closes on.
 * @param {Date} [options.now] The instant the reading's age is read against.
 * @returns {{subject: string, text: string, html: string, preheader: string}}
 */
export function auditEmail({ prospect, nextCall, now = new Date() }) {
  const reading = auditReading(prospect, now)
  const name = String(prospect?.name || 'your business')
  const site = reading.website || prospect?.website || ''
  const preheader = preheaderOf(reading.scores)

  const opening = site
    ? `We ran Google's PageSpeed Insights on ${escapeHtml(site)} and asked it for the phone version. The test is free, it is Google's own, and it grades four things out of a hundred.`
    : "We ran Google's PageSpeed Insights on your site and asked it for the phone version. The test is free, it is Google's own, and it grades four things out of a hundred."

  const content = [
    band(eyebrowMark('Your Site Audit'), '30px 40px 0 40px'),
    band(
      `<h1 style="margin:0;${sans({ size: 26, weight: 600, height: 1.2, color: INK, track: '-0.02em' })};">Here is the audit of the ${escapeHtml(name)} website</h1>`,
      '14px 40px 0 40px'
    ),
    band(
      `<p style="margin:0;${sans({ size: 15, color: INK_SOFT })};">${opening}</p>`,
      '16px 40px 0 40px'
    ),
    band(scoreGrid(reading.scores), '24px 40px 0 40px'),
    reading.issues.length ? band(issueList(reading.issues), '28px 40px 0 40px') : '',
    band(measuredLine(reading.at, site), '22px 40px 0 40px'),
    band(verifyNote(site), '22px 40px 0 40px'),
    nextCallSaid(nextCall) ? band(nextCallBand(nextCall), '28px 40px 0 40px') : '',
    band(`${rule('0 0 18px 0')}${footer()}`, '32px 40px 32px 40px'),
  ]
    .filter(Boolean)
    .join('\n')

  return {
    subject: 'Your website audit from TaylorURL',
    preheader,
    text: auditText({
      name,
      site,
      scores: reading.scores,
      issues: reading.issues,
      at: reading.at,
      nextCall,
    }),
    html: page({ title: `The ${name} website audit`, preheader, content }),
  }
}
