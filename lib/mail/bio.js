/**
 * The line about who is writing, carried by the site and by every message the
 * studio sends.
 *
 * A cold message, a newsletter issue and a confirmation all arrive from an
 * address the reader has no reason to recognise, and each one built its own
 * sign-off: a name, a company, or nothing at all. None of them said who the
 * person behind the address is, so the sentences the home and contact pages
 * carry are held here and drawn into all three.
 *
 * The site reads this module too, through the `@lib` alias, so a change to the
 * wording moves the pages and the mail together, and
 * `scripts/mail/check-email-bio.js` renders all three families to prove each one
 * still draws it.
 */

import { IS_SECOND_SITE } from '../site/current.js'
import { escapeHtml as esc } from './escape.js'

/** The name the bio is written in the voice of. */
export const BIO_NAME = 'Trenton Taylor'

/**
 * The title set against the name, and the one the structured data claims.
 *
 * TaylorURL is a team, and the title has to say which seat this one person
 * holds in it rather than what he does with his day. "Software Engineer" was
 * true of the whole company when the whole company was him; against a page
 * that opens on a small team of experts it reads as a job listing, and leaves
 * a reader to guess whether the name is the founder or the only one who turned
 * up. So the title is the seat.
 */
export const BIO_TITLE = 'Founder and CEO'

/**
 * The portrait, in the one format every mail client draws.
 *
 * The site serves the same photograph as WebP at two densities, which Outlook
 * on Windows renders as nothing at all. This is the 160px source written out
 * as JPEG and drawn at 80, so the frame is sharp on a retina screen and
 * present on the clients that would otherwise show a gap.
 */
export const BIO_PORTRAIT = 'https://www.taylorurl.com/images/trenton-taylor-email.jpg'

/** The side of the square the portrait is drawn at, in pixels. */
const PORTRAIT_SIZE = 80

/**
 * The number the studio answers on, in the spacing a reader expects. Every
 * message carries it and every directory listing is matched against it, so it
 * is held beside the name rather than formatted where it is drawn.
 */
export const BIO_PHONE = '(281) 862-8687'

/** The same number as a dialable href, which is digits and a leading plus. */
export const BIO_PHONE_HREF = 'tel:+12818628687'

/**
 * The bio itself, one paragraph, the same words wherever it is drawn.
 *
 * Where it is drawn is two sites and three families of message, and only the
 * last sentence moves between them: the studio builds websites for owners
 * around Baytown, and taylor.website sells three services to companies
 * anywhere, so a second site printing the first one's last sentence would be
 * describing an offer it does not make.
 *
 * The mail is the studio's alone - the sending domain, the newsletter and the
 * outreach pipeline all answer on the deployment that owns the schedules - so
 * every message goes out in the studio's wording, and `scripts/check-email-bio`
 * renders the three families under an unset SITE to prove it.
 */
const STUDIO_BIO_TEXT =
  'I was a district manager. We needed software, so I built it. I left that job to do this ' +
  'full time. I now lead a small team that builds and looks after websites for business ' +
  'owners across Southeast Texas.'

const SECOND_SITE_BIO_TEXT =
  'I was a district manager. We needed software, so I built it. I left that job to do this ' +
  'full time. I now lead a small team that builds software to order, repairs conversion ' +
  'tracking, and runs outbound email for companies that need one of the three.'

export const BIO_TEXT = IS_SECOND_SITE ? SECOND_SITE_BIO_TEXT : STUDIO_BIO_TEXT

/**
 * The bio as inline HTML, with no wrapper of its own.
 *
 * Each family of message lays its own bands out and none of them agree on what
 * a paragraph is, so this returns the prose and stops there — the caller
 * supplies the row, the padding and the ground it sits on.
 *
 * @returns {string} The bio, escaped.
 */
export function bioHtml() {
  return esc(BIO_TEXT)
}

/**
 * The portrait, the name and the bio as one unit: a framed square on the left
 * with the name and the prose set against it, which is the arrangement the
 * home and contact pages use.
 *
 * The frame is a hairline border on the image itself rather than a bordered
 * cell around it, because a cell with padding draws a gap between the rule and
 * the photograph that the site's frame does not have. The corner radius is
 * ignored by Outlook on Windows and honoured everywhere else, so the frame is
 * the site's rounded square where a client can draw one and a plain square
 * where it cannot.
 *
 * Every colour and face is passed in rather than read from the sheet, because
 * the band this sits in is the caller's: an issue sets it against the footer's
 * ground and a confirmation against the card's, and a block that chose for
 * itself would be the one thing in the band that had not been told where it
 * was.
 *
 * @param {object} options
 * @param {string} options.sans Font stack the name and prose are set in.
 * @param {string} options.ink Colour of the name.
 * @param {string} options.body Colour of the prose.
 * @param {string} options.hairline Colour of the frame.
 * @param {string} [options.subtitle] A line between the name and the prose.
 * @param {string} [options.subtitleStyle] Declarations for that line.
 * @returns {string} One table's worth of markup, with no band around it.
 */
export function bioBlock({ sans, ink, body, hairline, subtitle = '', subtitleStyle = '' }) {
  const portrait =
    `<img src="${BIO_PORTRAIT}" width="${PORTRAIT_SIZE}" height="${PORTRAIT_SIZE}" ` +
    `alt="${esc(BIO_NAME)}" style="display:block;width:${PORTRAIT_SIZE}px;` +
    `height:${PORTRAIT_SIZE}px;border:1px solid ${hairline};border-radius:6px;" />`

  const name =
    `<p style="margin:0;font-family:${sans};font-size:15px;line-height:1.4;` +
    `font-weight:600;color:${ink};">${esc(BIO_NAME)}</p>`

  const second = subtitle ? `<p style="margin:6px 0 0 0;${subtitleStyle}">${esc(subtitle)}</p>` : ''

  const prose =
    `<p style="margin:10px 0 0 0;font-family:${sans};font-size:13px;line-height:1.65;` +
    `color:${body};">${bioHtml()}</p>`

  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="border-collapse:collapse;width:100%;"><tr>' +
    `<td width="${PORTRAIT_SIZE}" valign="top" style="width:${PORTRAIT_SIZE}px;` +
    `line-height:0;font-size:0;">${portrait}</td>` +
    '<td width="18" style="width:18px;font-size:1px;line-height:1px;">&nbsp;</td>' +
    `<td valign="top">${name}${second}${prose}</td>` +
    '</tr></table>'
  )
}

/**
 * The bio as plain text, for the part a client shows where the laid-out half
 * is not rendered.
 *
 * @returns {string} The bio as one paragraph of text.
 */
export function bioText() {
  return BIO_TEXT
}
