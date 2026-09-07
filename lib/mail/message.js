/**
 * Both halves of the confirmation message, built from the two links that
 * differ between one signup and the next.
 *
 * Nothing here touches a runtime API, so the bodies render without an
 * environment or a database client: `scripts/mail/check-email-bio.js` renders them
 * to prove the bio is there, `scripts/mail/preview-emails.mjs` renders them to put
 * the message in an inbox, and the console previews the confirmation by
 * importing this file rather than by holding a second copy of the markup. All
 * of them read the same markup the sender delivers.
 *
 * The bio comes from `./bio.js`, which is the one copy of those sentences, and
 * the sheet from `./frame.js`, so the first thing a new subscriber sees of the
 * studio is the same sheet an issue and a notice are drawn on.
 */

import { BIO_NAME, BIO_PHONE, BIO_PHONE_HREF, BIO_TEXT, bioBlock } from './bio.js'
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
} from './frame.js'

const PITCH =
  'Short notes on getting found on Google and turning visitors into paying customers, sent only when there is something worth saying.'

const HEADLINE = 'Confirm your email address and you are on the list.'

/**
 * @param {string} confirmUrl The address that moves the row from pending to confirmed.
 * @param {string} unsubUrl The address that takes it off the list.
 * @returns {{text: string, html: string}} Both halves of the message.
 */
export function confirmationBodies(confirmUrl, unsubUrl) {
  const text = [
    HEADLINE,
    '',
    confirmUrl,
    '',
    PITCH,
    '',
    'If you did not sign up, ignore this email and nothing happens.',
    '',
    '--',
    BIO_NAME,
    BIO_TEXT,
    '',
    BIO_PHONE,
    '',
    `Unsubscribe: ${unsubUrl}`,
  ].join('\n')

  const confirm = escapeHtml(confirmUrl)
  const unsub = escapeHtml(unsubUrl)

  const content = `<tr><td align="left" style="padding:30px 40px 0 40px;">
        <h1 style="margin:0;font-family:${SANS};font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:${INK};">${HEADLINE}</h1>
      </td></tr>
      <tr><td align="left" style="padding:14px 40px 0 40px;">
        <p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.65;color:${INK_SOFT};">${PITCH}</p>
      </td></tr>
      <tr><td align="left" style="padding:28px 40px 4px 40px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr><td align="center" bgcolor="${ACCENT}" style="border-radius:4px;">
            <a href="${confirm}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:15px;font-weight:500;letter-spacing:-0.01em;color:#ffffff;text-decoration:none;">Confirm Subscription</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="left" style="padding:24px 40px 0 40px;">
        <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:${INK_FAINT};">If the button does not work, open this address:</p>
        <p style="margin:8px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.6;word-break:break-all;"><a href="${confirm}" style="color:${ACCENT};text-decoration:underline;">${confirm}</a></p>
      </td></tr>
      <tr><td align="left" style="padding:20px 40px 0 40px;">
        <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:${INK_FAINT};">If you did not sign up, ignore this email and nothing happens.</p>
      </td></tr>
      <tr><td align="left" style="padding:36px 40px 40px 40px;border-top:1px solid ${HAIRLINE};">
        ${bioBlock({ sans: SANS, ink: INK, body: INK_SOFT, hairline: HAIRLINE })}
        ${rule('26px 0 0 0')}
        <p style="margin:20px 0 0 0;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.9;color:${INK_FAINT};"><a href="${BIO_PHONE_HREF}" style="color:${INK_FAINT};text-decoration:none;">${BIO_PHONE}</a></p>
        <p style="margin:10px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.6;"><a href="${unsub}" style="color:${ACCENT};text-decoration:underline;">Unsubscribe</a></p>
      </td></tr>`

  const html = page({ title: HEADLINE, preheader: PITCH, content })

  return { text, html }
}
