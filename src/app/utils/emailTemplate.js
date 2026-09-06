/**
 * Renders a newsletter issue's `body` blocks into the two parts an email
 * carries: HTML and a plaintext alternative.
 *
 * Three properties of email clients shape every line of this file. Script never
 * runs, so nothing here is interactive. Gmail strips SVG, so artwork is PNG.
 * Outlook on Windows lays a message out with Word's engine, which understands
 * table cells and little else — no external stylesheet, no `<style>` block that
 * can be relied on, no flexbox, no margin collapsing. So the layout is nested
 * tables, every rule is an inline style, and spacing lives in cell padding.
 *
 * Every function is pure and touches no DOM, which is what lets the send
 * function call them inside a serverless runtime.
 *
 * One issue does not say the same thing to everybody. A block may be written
 * for one side of the list, and a reader on the other side never sees it. Both
 * parts take the recipient's side and filter through `blocksFor`, so the
 * laid-out half and the plain half of one message hold the same blocks.
 */

import { audienceOf } from '../../../lib/mail/audience.js'
import { BIO_NAME, BIO_PHONE, BIO_PHONE_HREF, bioBlock, bioText } from '../../../lib/mail/bio.js'
import {
  ACCENT,
  HAIRLINE,
  INK,
  INK_FAINT,
  INK_SOFT,
  MONO,
  SANS,
  WIDTH,
  escapeHtml,
  eyebrowMark,
  page,
  rule,
} from '../../../lib/mail/frame.js'
import { blocksFor } from '../../../lib/mail/issues.js'
import { ANNOTATION } from '../../../lib/mail/identity.js'

export { escapeHtml }

/**
 * A link target that is safe to put in an `href`.
 *
 * The body is authored data, and an issue that arrives carrying a `javascript:`
 * or `data:` target would be a link nobody wrote into the site. Only the three
 * schemes an email has any use for survive; anything else renders as inert
 * text with no href at all.
 */
export function safeUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  if (/^(https?:|mailto:)/i.test(raw)) return raw
  return null
}

/**
 * The same link, tagged so an arrival on the site can be traced to the issue
 * that sent it.
 *
 * Only the studio's own addresses are tagged. A link out to a client's site is
 * somebody else's URL: parameters hung off it land in their analytics rather
 * than in this one, and measure nothing here. A link the author already tagged
 * is left exactly as they wrote it.
 *
 * @param {string} value The link as authored.
 * @param {string} campaign Which issue this is, which is its slug.
 * @param {string} siteUrl The origin the studio's own pages are served from.
 * @returns {string} The link, tagged or untouched.
 */
export function campaignUrl(value, campaign, siteUrl) {
  const raw = safeUrl(value)
  if (!raw || !campaign || !/^https?:/i.test(raw)) return value
  let url
  let site
  try {
    url = new URL(raw)
    site = new URL(siteUrl)
  } catch {
    return value
  }
  if (url.host !== site.host) return value
  if (url.searchParams.has('utm_source')) return value
  url.searchParams.set('utm_source', 'newsletter')
  url.searchParams.set('utm_medium', 'email')
  url.searchParams.set('utm_campaign', campaign)
  return url.toString()
}

/**
 * An issue's blocks with every link of its own tagged to the issue.
 *
 * The tagging happens once, over the body, rather than inside each renderer:
 * the laid-out half and the plain half read the same blocks, and a link tagged
 * in one and not the other is two different links in one message.
 */
function tagged(body, campaign, siteUrl) {
  if (!campaign || !Array.isArray(body)) return body
  return body.map(block =>
    block?.type === 'button' && block.href
      ? { ...block, href: campaignUrl(block.href, campaign, siteUrl) }
      : block
  )
}

/**
 * The one-click unsubscribe link for a subscriber, which is both the visible
 * link in the footer and the target of the `List-Unsubscribe` header.
 *
 * @param {string} endpoint - Absolute URL of the unsubscribe function.
 * @param {string} token - The subscriber's `unsub_token`.
 */
export function unsubscribeUrl(endpoint, token) {
  const base = safeUrl(endpoint)
  if (!base || !token) return null
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}token=${encodeURIComponent(token)}`
}

/**
 * The footer's identity line: who sent the issue.
 *
 * @param {string} senderName
 * @returns {string} The name, trimmed, or an empty string where none was given.
 */
function signOff(senderName) {
  return typeof senderName === 'string' ? senderName.trim() : ''
}

/** A table row wrapping one block's markup in the content column's padding. */
function row(inner, padding = '0 40px') {
  return `<tr><td align="left" style="padding:${padding};font-family:${SANS};">${inner}</td></tr>`
}

function heading(block) {
  const level = block.level === 3 ? 3 : 2
  const size = level === 3 ? 18 : 23
  return row(
    `<h${level} style="margin:0;padding:36px 0 0 0;font-family:${SANS};font-size:${size}px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:${INK};">${escapeHtml(block.text)}</h${level}>`
  )
}

function paragraph(block) {
  return row(
    `<p style="margin:0;padding:14px 0 0 0;font-family:${SANS};font-size:16px;line-height:1.65;color:${INK_SOFT};">${escapeHtml(block.text)}</p>`
  )
}

/**
 * A PNG with its dimensions stated in attributes as well as in the style.
 *
 * Outlook reads the attributes and ignores `max-width`, so a missing `width`
 * renders the file at its natural pixel size and pushes the column open. Alt
 * text is the whole of the image for every reader who blocks images by
 * default, which is most of them.
 */
function image(block) {
  const src = safeUrl(block.src)
  if (!src) return ''
  const width = Math.min(Number(block.width) || WIDTH - 80, WIDTH - 80)
  const ratio = Number(block.width) > 0 && Number(block.height) > 0 ? block.height / block.width : 0
  const height = Math.round(Number(block.height) > 0 ? width * ratio : width * 0.5625)
  return row(
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt || '')}" width="${width}" height="${height}" style="display:block;width:${width}px;height:${height}px;border:0;outline:none;text-decoration:none;" />`,
    '24px 40px 0 40px'
  )
}

/**
 * A rectangle of colour with a link across it, built as a table because a
 * padded anchor is not clickable across its padding in Outlook.
 */
function button(block) {
  const href = safeUrl(block.href)
  const label = escapeHtml(block.text || '')
  if (!href || !label) return ''
  return row(
    `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr><td align="center" bgcolor="${ACCENT}" style="border-radius:4px;">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:15px;font-weight:500;letter-spacing:-0.01em;color:#ffffff;text-decoration:none;">${label}</a>
      </td></tr>
    </table>`,
    '28px 40px 4px 40px'
  )
}

function divider() {
  return row(rule(), '32px 40px 4px 40px')
}

function list(block) {
  const items = Array.isArray(block.items) ? block.items : []
  if (items.length === 0) return ''
  const tag = block.ordered ? 'ol' : 'ul'
  const entries = items
    .map(
      item =>
        `<li style="margin:0 0 10px 0;font-family:${SANS};font-size:16px;line-height:1.6;color:${INK_SOFT};">${escapeHtml(item)}</li>`
    )
    .join('')
  return row(`<${tag} style="margin:0;padding:16px 0 0 22px;">${entries}</${tag}>`)
}

const BLOCKS = { heading, paragraph, image, button, divider, list }

/** Blocks of an unknown type are dropped rather than guessed at. */
function renderBlocks(body, audience) {
  return blocksFor(body, audience)
    .map(block => {
      const render = block && BLOCKS[block.type]
      return render ? render(block) : ''
    })
    .join('')
}

/**
 * Render an issue to email HTML.
 *
 * @param {object} params
 * @param {{title: string, preheader?: string, body?: Array}} params.issue
 * @param {string} params.unsubscribe - The subscriber's unsubscribe URL.
 * @param {string} [params.viewUrl] - The web version of this issue.
 * @param {string} [params.senderName]
 * @param {string|null} [params.audience] - The reader's side of the list. Null draws every block.
 * @returns {string} A complete HTML document.
 */
export function renderIssueHtml({
  issue,
  unsubscribe,
  viewUrl,
  senderName = 'TaylorURL LLC',
  audience = null,
}) {
  const sender = signOff(senderName)
  const unsubHref = safeUrl(unsubscribe)
  const webHref = safeUrl(viewUrl)
  const title = escapeHtml(issue.title || '')

  // The letter's own name on the left and the way out of the inbox on the
  // right, which is the two-sided section head the rest of the studio's mail
  // uses to open a passage.
  const eyebrow = `<tr><td align="left" style="padding:30px 40px 0 40px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;">
      <tr>
        <td align="left" valign="middle">
          ${eyebrowMark('Notes')}
        </td>
        ${
          webHref
            ? `<td align="right" valign="middle" style="font-family:${MONO};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;"><a href="${escapeHtml(webHref)}" style="color:${INK_FAINT};text-decoration:none;">Read on the web</a></td>`
            : '<td></td>'
        }
      </tr>
    </table>
  </td></tr>`

  const standfirst = issue.preheader
    ? `<tr><td align="left" style="padding:12px 40px 0 40px;">
    <p style="margin:0;font-family:${SANS};font-size:17px;line-height:1.5;color:${INK_FAINT};">${escapeHtml(issue.preheader)}</p>
  </td></tr>`
    : ''

  const headline = `<tr><td align="left" style="padding:14px 40px 0 40px;">
    <h1 style="margin:0;font-family:${SANS};font-size:30px;line-height:1.15;font-weight:600;letter-spacing:-0.03em;color:${INK};">${title}</h1>
  </td></tr>`

  // The unsubscribe link is visible, in the body copy's own size, and stated
  // in a sentence rather than hidden behind a word: a footer that only carries
  // the header version is a footer a reader cannot act on.
  const footer = `<tr><td align="left" style="padding:36px 40px 40px 40px;border-top:1px solid ${HAIRLINE};font-family:${SANS};font-size:13px;line-height:1.6;color:${INK_FAINT};">
    ${bioBlock({
      sans: SANS,
      ink: INK,
      body: INK_SOFT,
      hairline: HAIRLINE,
    })}
    ${rule('26px 0 0 0')}
    <p style="margin:20px 0 0 0;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.9;color:${INK_FAINT};">${escapeHtml(sender)}<br />${escapeHtml(ANNOTATION[1])}<br /><a href="${BIO_PHONE_HREF}" style="color:${INK_FAINT};text-decoration:none;">${escapeHtml(BIO_PHONE)}</a></p>
    ${
      unsubHref
        ? `<p style="margin:10px 0 0 0;"><a href="${escapeHtml(unsubHref)}" style="color:${ACCENT};text-decoration:underline;">Unsubscribe</a></p>`
        : ''
    }
  </td></tr>`

  return page({
    title: issue.title || '',
    preheader: issue.preheader,
    content: `${eyebrow}
      ${headline}
      ${standfirst}
      ${renderBlocks(issue.body, audience)}
      <tr><td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>
      ${footer}`,
  })
}

function textBlock(block) {
  switch (block.type) {
    case 'heading':
      return `\n${String(block.text || '').toUpperCase()}\n`
    case 'paragraph':
      return String(block.text || '')
    case 'image': {
      const src = safeUrl(block.src)
      const alt = block.alt || 'Image'
      return src ? `[${alt}: ${src}]` : `[${alt}]`
    }
    case 'button': {
      const href = safeUrl(block.href)
      return href ? `${block.text || 'Open'}: ${href}` : ''
    }
    case 'divider':
      return '--------------------------------------------------'
    case 'list': {
      const items = Array.isArray(block.items) ? block.items : []
      return items.map(item => `  - ${item}`).join('\n')
    }
    default:
      return ''
  }
}

/**
 * Render an issue to the plaintext alternative. It carries the same
 * unsubscribe link as the HTML part, because a client showing this part is a
 * client where the HTML footer's link does not exist.
 *
 * @param {object} params - Same shape as {@link renderIssueHtml}.
 * @returns {string}
 */
export function renderIssueText({
  issue,
  unsubscribe,
  viewUrl,
  senderName = 'TaylorURL LLC',
  audience = null,
}) {
  const sender = signOff(senderName)
  const unsubHref = safeUrl(unsubscribe)
  const webHref = safeUrl(viewUrl)
  const blocks = blocksFor(issue.body, audience)

  const parts = [issue.title || '', '']
  if (issue.preheader) parts.push(issue.preheader, '')
  for (const block of blocks) {
    const rendered = block ? textBlock(block) : ''
    if (rendered) parts.push(rendered, '')
  }
  if (webHref) parts.push(`Read this on the web: ${webHref}`, '')
  parts.push('--', BIO_NAME, bioText(), '')
  if (sender) parts.push(sender)
  parts.push(BIO_PHONE)
  if (unsubHref) {
    parts.push(`Unsubscribe: ${unsubHref}`)
  }
  return parts
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Both parts of one subscriber's copy, plus the link the RFC 8058 headers
 * point at, so a sender builds a message with a single call.
 *
 * The recipient's side of the list is read off their own row, so a sender that
 * knows who it is mailing cannot fail to know which blocks they get. A caller
 * naming `audience` outright overrides it, which is how the composer draws both
 * copies of an issue against one recipient.
 *
 * @param {object} params
 * @param {object} params.issue - The `newsletter_issues` row.
 * @param {{unsub_token: string, source?: string}} params.subscriber - The `subscribers` row.
 * @param {string} params.unsubscribeEndpoint - Absolute URL of the unsubscribe function.
 * @param {string} [params.siteUrl] - Origin the web version is served from.
 * @param {string} [params.audience] - The side to draw, in place of the subscriber's own.
 * @returns {{subject: string, html: string, text: string, unsubscribeUrl: string|null, audience: string}}
 */
export function renderIssueEmail({
  issue,
  subscriber,
  unsubscribeEndpoint,
  siteUrl = 'https://www.taylorurl.com',
  audience = audienceOf(subscriber),
}) {
  const unsubscribe = unsubscribeUrl(unsubscribeEndpoint, subscriber?.unsub_token)
  const campaign = issue.slug || null
  const viewUrl = campaign ? campaignUrl(`${siteUrl}/notes/${campaign}`, campaign, siteUrl) : null
  const carried = { ...issue, body: tagged(issue.body, campaign, siteUrl) }
  return {
    subject: issue.title || '',
    html: renderIssueHtml({ issue: carried, unsubscribe, viewUrl, audience }),
    text: renderIssueText({ issue: carried, unsubscribe, viewUrl, audience }),
    unsubscribeUrl: unsubscribe,
    audience,
  }
}
