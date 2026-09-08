/**
 * The one message a lead who did not finish ever gets.
 *
 * Somebody typed an address into the configurator, answered some of the five
 * screens and left - or typed three answers into the short checkout and did not
 * use the card. An hour later this asks what stopped them and puts half the
 * up-front fee on the table if the answer was the price. One message, not a
 * sequence: a second and a third chase is what turns a warm lead into a
 * complaint, and a complaint lands on the same sending reputation the
 * newsletter and the outreach pipeline run on.
 *
 * Where they left is the caller's to say. The screen they stopped on names
 * itself out of the step, and the page they pick it back up on arrives as
 * `startUrl`, because a person handed the short checkout has no configurator to
 * return to.
 *
 * It is written to be answered rather than clicked. The reply address is the
 * studio's own and the message says plainly that a reply is read by a person,
 * because the useful half of this is finding out why five people in a row
 * stopped on the same screen - which no click ever says.
 *
 * Nothing here touches a runtime API, so both bodies render without an
 * environment or a database client. `scripts/mail/preview-emails.mjs` renders them
 * to put the message in an inbox, which is the only way to see what actually
 * arrives.
 */

import { BIO_NAME, BIO_PHONE, BIO_PHONE_HREF, BIO_TEXT, bioBlock } from '../mail/bio.js'
import { TRADING_LINE } from '../mail/identity.js'
import {
  ACCENT,
  HAIRLINE,
  INK,
  INK_FAINT,
  INK_SOFT,
  MONO,
  SANS,
  escapeHtml,
  page,
  rule,
} from '../mail/frame.js'

const HEADLINE = 'You started a website and did not finish it.'

/** The screens the configurator runs, for naming where somebody stopped. */
const STEPS = [
  'the first question',
  'the work and the designs',
  'the look',
  'the price',
  'the payment screen',
]

/** How far they reached, in the words a person would use. */
function stoppedAt(step) {
  return STEPS[step] || STEPS[0]
}

/** The subject line, which names the offer rather than the abandonment. */
export function followUpSubject(trade) {
  return trade
    ? `Half off the build for your ${trade.toLowerCase()} website`
    : 'Half off the build on the website you started'
}

/**
 * Both halves of the follow-up.
 *
 * @param {object} lead
 * @param {string} [lead.trade] The trade they picked, where they picked one.
 * @param {number} [lead.step] The furthest screen they reached.
 * @param {string} lead.code The discount code, good once.
 * @param {string} lead.expires When the code stops working, written out.
 * @param {string} lead.startUrl Where picking it back up begins.
 * @param {string} lead.unsubscribeUrl The one click that stops all of this.
 * @returns {{subject: string, text: string, html: string}}
 */
export function followUpMessage({ trade = '', step = 0, code, expires, startUrl, unsubscribeUrl }) {
  const subject = followUpSubject(trade)
  const opening = trade
    ? `You picked ${trade.toLowerCase()} on our site and got as far as ${stoppedAt(step)}.`
    : `You started a website on our site and got as far as ${stoppedAt(step)}.`

  const preheader = `${code} takes half off the up-front fee. It works once, and it stops working ${expires}.`

  const lines = [
    opening,
    '',
    'Nothing came of it, which is usually one of two things: the price, or you got busy.',
    '',
    `If it was the price, this fixes half of it. Use ${code} at the checkout and the up-front build fee is half. It works once and it stops working ${expires}. The monthly is unchanged.`,
    '',
    `Pick it back up: ${startUrl}`,
    '',
    'If it was something else, hit reply and tell us what stopped you. We read these ourselves, and knowing what did not work is worth more to us than the sale.',
    '',
    '--',
    BIO_NAME,
    BIO_TEXT,
    '',
    BIO_PHONE,
    TRADING_LINE,
    '',
    `Unsubscribe: ${unsubscribeUrl}`,
  ]

  const start = escapeHtml(startUrl)
  const unsub = escapeHtml(unsubscribeUrl)
  const shown = escapeHtml(code)

  const content = `<tr><td align="left" style="padding:30px 40px 0 40px;">
        <h1 style="margin:0;font-family:${SANS};font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:${INK};">${HEADLINE}</h1>
      </td></tr>
      <tr><td align="left" style="padding:14px 40px 0 40px;">
        <p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.65;color:${INK_SOFT};">${escapeHtml(opening)}</p>
        <p style="margin:14px 0 0 0;font-family:${SANS};font-size:16px;line-height:1.65;color:${INK_SOFT};">Nothing came of it, which is usually one of two things: the price, or you got busy.</p>
      </td></tr>
      <tr><td align="left" style="padding:26px 40px 0 40px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;border:1px solid ${HAIRLINE};">
          <tr><td align="left" style="padding:20px 22px;">
            <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.9;color:${INK_FAINT};">Half off the up-front fee</p>
            <p style="margin:8px 0 0 0;font-family:${MONO};font-size:22px;font-weight:600;letter-spacing:0.04em;line-height:1.3;color:${INK};">${shown}</p>
            <p style="margin:10px 0 0 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${INK_SOFT};">Enter it at the checkout. It works once, it stops working ${escapeHtml(expires)}, and the monthly is unchanged.</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="left" style="padding:26px 40px 4px 40px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr><td align="center" bgcolor="${ACCENT}" style="border-radius:4px;">
            <a href="${start}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:15px;font-weight:500;letter-spacing:-0.01em;color:#ffffff;text-decoration:none;">Pick It Back Up</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="left" style="padding:24px 40px 0 40px;">
        <p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.65;color:${INK_SOFT};">If it was something else, hit reply and tell us what stopped you. We read these ourselves, and knowing what did not work is worth more to us than the sale.</p>
      </td></tr>
      <tr><td align="left" style="padding:36px 40px 40px 40px;border-top:1px solid ${HAIRLINE};">
        ${bioBlock({ sans: SANS, ink: INK, body: INK_SOFT, hairline: HAIRLINE })}
        ${rule('26px 0 0 0')}
        <p style="margin:20px 0 0 0;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.9;color:${INK_FAINT};"><a href="${BIO_PHONE_HREF}" style="color:${INK_FAINT};text-decoration:none;">${BIO_PHONE}</a></p>
        <p style="margin:6px 0 0 0;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.9;color:${INK_FAINT};">${escapeHtml(TRADING_LINE)}</p>
        <p style="margin:10px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.6;"><a href="${unsub}" style="color:${ACCENT};text-decoration:underline;">Unsubscribe</a></p>
      </td></tr>`

  return {
    subject,
    text: lines.join('\n'),
    html: page({ title: HEADLINE, preheader, content }),
  }
}
