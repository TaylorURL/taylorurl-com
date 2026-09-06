/**
 * A notice to the studio's own inbox.
 *
 * Several things a stranger does on the site are worth a message rather than a
 * row: an enquiry, a reply to a cold message, a speed check left with an
 * address attached, a chat thread that left a way to answer it. Each of them
 * reaches a different place before it reaches a person, so the delivery is
 * written once here and the endpoints decide only what to say.
 *
 * The inbox is the one the enquiry form already delivers into, so a notice
 * lands beside the enquiries rather than in a second place to remember.
 *
 * A notice opens on the same black slab a cold message and an issue of the
 * newsletter open on, drawn from the same mark and the same three lines. An
 * inbox holding two designs is an inbox where the studio's own mail is the
 * half that looks like nobody sent it.
 *
 * Every notice leaves marked urgent. Each one is somebody waiting on an
 * answer, and a message that has to be found is a message found late.
 *
 * A notice is never the record. Whatever produced it is stored before this
 * runs, which is what lets a caller treat a refusal as a missing notification
 * instead of a lost message.
 *
 * The same sheet carries a notification sent on a client's behalf, which is
 * why the brand, the envelope and the urgency are arguments here rather than
 * constants. A trading desk telling its owner a setup has fired is the same
 * shape of message as an enquiry reaching this inbox - a heading, a short
 * reading of the facts, and somebody waiting on it - and the only honest
 * difference is whose name is on it and who it goes to. Every default below
 * reproduces the studio's own notice exactly, so a caller that speaks for
 * nobody but the studio passes none of them.
 */

import {
  ACCENT,
  INK,
  INK_FAINT,
  INK_SOFT,
  MONO,
  PAGE,
  SANS,
  STUDIO_BRAND,
  escapeHtml,
  eyebrowMark,
  page,
  rule,
} from './frame.js'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

// Resend accepts a From address only on a domain verified against the account.
const FROM = 'TaylorURL Website <website@taylorurl.com>'

const INBOX = process.env.CONTACT_INBOX || 'trenton@taylorurl.com'

const TIMEOUT_MS = 10000

/**
 * What marks the message urgent where it lands.
 *
 * Four spellings because no two clients read the same one. Outlook and the
 * Microsoft account this inbox runs on take `Importance`, the two `X-` headers
 * are what older Outlook builds and most desktop clients look for, and
 * `Priority` is the one written into the mail standard itself. A client that
 * understands none of them shows an ordinary message.
 */
const URGENT_HEADERS = {
  Importance: 'high',
  Priority: 'urgent',
  'X-Priority': '1 (Highest)',
  'X-MSMail-Priority': 'High',
}

/**
 * What a client shows beside the subject before the message is opened.
 *
 * The rows carry the only facts worth reading at that size, so the first two
 * are what goes there.
 */
function preheader(rows) {
  return rows
    .slice(0, 2)
    .map(([label, value]) => `${label}: ${value}`)
    .join(' · ')
}

/**
 * Which of the studio's own systems is speaking, in the two-sided section head
 * the rest of the mail opens a passage with.
 *
 * An inbox holds every family at once and they read alike at a glance. This is
 * the line that says whether a reply came out of the outreach mailbox or
 * somebody filled in a form, before the subject has been read.
 */
function eyebrow(label, accent) {
  return `<tr><td align="left" style="padding:30px 40px 0 40px;">
    ${eyebrowMark(label, accent)}
  </td></tr>`
}

/**
 * The facts, as a two-column reading rather than a paragraph.
 *
 * The label is set in the mono face at the size the slab's own lines use, so a
 * value that runs long has an edge to run against and the column does not
 * collapse into prose. `white-space:nowrap` on the label is what keeps a
 * two-word label from wrapping and taking the row's height with it.
 */
function readings(rows) {
  if (rows.length === 0) return ''
  const body = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td valign="top" style="padding:0 20px 10px 0;font-family:${MONO};font-size:10px;letter-spacing:0.14em;text-transform:uppercase;line-height:1.9;color:${INK_FAINT};white-space:nowrap;">${escapeHtml(label)}</td>
          <td valign="top" style="padding:0 0 10px 0;font-family:${SANS};font-size:15px;line-height:1.5;color:${INK};">${escapeHtml(value)}</td>
        </tr>`
    )
    .join('')

  return `<tr><td align="left" style="padding:22px 40px 0 40px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${body}</table>
  </td></tr>`
}

/**
 * Whatever the notice carries, held apart from the studio's own reading of it.
 *
 * A reply, a transcript and a message off a form are all somebody else's
 * words, and a frame that sets them in the same face as the rows above turns
 * what a stranger wrote into something the studio appears to be saying. The
 * tint and the rule down the left are the whole of the distinction.
 */
function carried(body, accent) {
  if (!body) return ''
  return `<tr><td align="left" style="padding:26px 40px 0 40px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;width:100%;background-color:${PAGE};border-left:2px solid ${accent};">
      <tr><td style="padding:18px 20px;font-family:${SANS};font-size:15px;line-height:1.6;color:${INK_SOFT};white-space:pre-wrap;">${escapeHtml(body)}</td></tr>
    </table>
  </td></tr>`
}

/**
 * The one thing a notification asks the reader to do.
 *
 * A message naming something that happened without offering a way to it is a
 * message that ends in a search bar, which is a poor place to leave somebody
 * who has just been told a trade is on. The address is drawn twice on purpose:
 * as the button, and as itself underneath, because a client that will not
 * render a table-and-anchor button still renders the line.
 */
function action(link, accent) {
  if (!link || !link.url) return ''
  const href = escapeHtml(link.url)
  return `<tr><td align="left" style="padding:28px 40px 0 40px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr><td align="center" bgcolor="${accent}" style="border-radius:4px;">
        <a href="${href}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:15px;font-weight:500;letter-spacing:-0.01em;color:#ffffff;text-decoration:none;">${escapeHtml(link.label)}</a>
      </td></tr>
    </table>
    <p style="margin:14px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.6;word-break:break-all;"><a href="${href}" style="color:${accent};text-decoration:underline;">${href}</a></p>
  </td></tr>`
}

/**
 * Where an answer written from here goes.
 *
 * The address is on Reply-To rather than in the body, so a reader looking at
 * the message has no way of telling whether hitting reply reaches the person
 * the notice is about or the domain the notice came from. This is the line
 * that says which. A notice nobody can answer closes on the rule alone.
 *
 * A message sent for somebody else closes on their name as well. The studio's
 * own notices land in the studio's own inbox and need no signature; a
 * notification about a client's product reaches a reader who has to be able to
 * tell, from the message alone, which of the things they own has spoken.
 */
function closing(replyTo, footer) {
  const said = replyTo
    ? `<p style="margin:20px 0 0 0;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.9;color:${INK_FAINT};">Replying reaches <a href="mailto:${escapeHtml(replyTo)}" style="color:${INK_FAINT};text-decoration:none;">${escapeHtml(replyTo)}</a></p>`
    : ''
  const signed = footer
    ? `<p style="margin:${replyTo ? '10px' : '20px'} 0 0 0;font-family:${MONO};font-size:10px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.9;color:${INK_FAINT};">${escapeHtml(footer)}</p>`
    : ''

  return `<tr><td align="left" style="padding:32px 40px ${replyTo || footer ? '36px' : '16px'} 40px;">
    ${rule()}
    ${said}${signed}
  </td></tr>`
}

/** The rows and the body, on the sheet the rest of the studio's mail carries. */
function noticeHtml({ label, heading, rows, body, replyTo, link, brand }) {
  const accent = brand.accent || ACCENT
  return page({
    title: heading,
    brand,
    preheader: preheader(rows) || body.replace(/\s+/g, ' ').trim().slice(0, 140),
    content: `${eyebrow(label, accent)}
      <tr><td align="left" style="padding:14px 40px 0 40px;">
        <h1 style="margin:0;font-family:${SANS};font-size:26px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:${INK};">${escapeHtml(heading)}</h1>
      </td></tr>
      ${readings(rows)}
      ${carried(body, accent)}${action(link, accent)}
      ${closing(replyTo, brand.footer || '')}`,
  })
}

/**
 * The same thing as text, for a client that takes the plain half.
 *
 * It keeps the frame's order rather than the frame itself, so the two halves
 * of one notice say the same things in the same sequence and a reader on
 * either side is reading the same message.
 */
function noticeText({ label, heading, rows, body, replyTo, link, brand }) {
  const lines = [`// ${label.toUpperCase()}`, '', heading, '']
  for (const [name, value] of rows) lines.push(`${name}: ${value}`)
  if (body) lines.push('', body)
  if (link && link.url) lines.push('', link.label, link.url)
  if (replyTo || brand.footer) lines.push('', '--')
  if (replyTo) lines.push(`Replying reaches ${replyTo}`)
  if (brand.footer) lines.push(brand.footer)
  return lines.join('\n')
}

/**
 * One notice, both halves of it, ready to hand over.
 *
 * An endpoint names what the notice is and what it holds; the frame is decided
 * here. Pairing the two renderers at each caller instead would be the same two
 * lines written out at every endpoint that tells the studio something, and one
 * more place for the halves to drift apart.
 *
 * @param {object} notice
 * @param {string} notice.label Which system is speaking, for the eyebrow.
 * @param {string} notice.subject The subject line, which is also the heading.
 * @param {Array<[string, string]>} [notice.rows] The facts, label and value.
 * @param {string} [notice.body] Whatever the notice carries in somebody else's
 *   words: a reply, a transcript, a message off a form.
 * @param {string} [notice.replyTo] Where an answer written from the inbox goes.
 * @param {{label: string, url: string}} [notice.link] The one thing the reader
 *   is asked to open.
 * @param {object} [notice.brand] Who the message is from. Defaults to the
 *   studio, which is what every notice the studio sends itself is.
 * @returns {{subject: string, text: string, html: string, replyTo?: string}}
 */
export function notice({
  label,
  subject,
  rows = [],
  body = '',
  replyTo,
  link,
  brand = STUDIO_BRAND,
}) {
  const drawn = { label, heading: subject, rows, body, replyTo, link, brand }
  return {
    subject,
    text: noticeText(drawn),
    html: noticeHtml(drawn),
    ...(replyTo ? { replyTo } : {}),
  }
}

/**
 * Hands one notice to Resend.
 *
 * `replyTo` is what makes an answer go to the person the notice is about
 * rather than to the sending domain, so a reply written from the inbox reaches
 * them without the address being copied out of the body by hand.
 *
 * The envelope is an argument with the studio's own on it as the default. A
 * message sent for a client leaves from that client's sending identity and
 * reaches one of their people, and each recipient is handed over on their own
 * call rather than in a shared `to`, which is the only way a list of them
 * never learns about each other. Urgency is on the envelope for the same
 * reason: four headers that mark every message high are four headers that mark
 * none of them, so only the messages that say they are urgent carry them.
 *
 * The key travels in the request header and is scrubbed out of anything the
 * endpoint says back, so a refusal quoting the credential reaches no log.
 *
 * @param {object} notice The subject, the two bodies and the reply address.
 * @param {string} key The Resend key.
 * @param {object} [envelope] Who it leaves as, who it reaches, and whether it
 *   is marked urgent. Every default is what the studio's own notices send.
 * @param {string} [envelope.from] The sending identity.
 * @param {string[]} [envelope.to] The recipients of this one call.
 * @param {boolean} [envelope.urgent] Whether the urgent headers ride along.
 * @param {Record<string, string>} [envelope.headers] Headers this one message
 *   needs and no other does. A notice to the studio needs none; a message that
 *   goes to a stranger needs the two `List-Unsubscribe` headers, because a bulk
 *   sender without them is a bulk sender Gmail and Yahoo put in spam however
 *   good the unsubscribe link in the body is.
 * @param {number} [envelope.timeoutMs] How long the handover is given.
 * @returns {Promise<string|null>} The provider's id for the message, which is
 *   the only thing that makes a delivery reconcilable afterwards.
 */
export async function sendNotice({ subject, text, html, replyTo }, key, envelope = {}) {
  if (!key) throw new Error('no resend key')

  const {
    from = FROM,
    to = [INBOX],
    urgent = true,
    headers = null,
    timeoutMs = TIMEOUT_MS,
  } = envelope

  // The urgent pair and a caller's own are one set. Written this way round so a
  // caller cannot quietly drop the urgency headers by passing any header at all.
  const sent = { ...(urgent ? URGENT_HEADERS : {}), ...(headers || {}) }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const upstream = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject,
        text,
        ...(html ? { html } : {}),
        ...(Object.keys(sent).length ? { headers: sent } : {}),
      }),
    })

    if (!upstream.ok) {
      const said = await upstream.text().catch(() => '')
      const detail = said.replaceAll(key, '[redacted]').slice(0, 300)
      throw new Error(`resend returned ${upstream.status} ${detail}`.trim())
    }

    // A message that was accepted and whose answer could not be read is a
    // message that went. The id is what makes it reconcilable afterwards and
    // losing it costs a record; treating the unreadable answer as a refusal
    // would cost the send, and the caller would send it again.
    try {
      const answer = await upstream.json()
      return typeof answer?.id === 'string' ? answer.id : null
    } catch {
      return null
    }
  } finally {
    clearTimeout(timer)
  }
}

export { INBOX, URGENT_HEADERS }
