/**
 * How an outreach message is laid out, in both halves of the multipart mail.
 *
 * `api/outreach/send.js` decides what a message says; this module decides what
 * it looks like. It takes one content object and renders it twice, so the HTML
 * half and the plain half state the same figure, the same client sites, the
 * same contact details and the same way off the list, and no edit can move one
 * without moving the other.
 *
 * The message carries no figures for what a build costs. Its job is a reply or
 * a click, and a price read before anyone has spoken is a reason to decide no.
 * /pricing and /start carry the figures for a reader who goes looking.
 *
 * The layout is the site's own language, translated into what a mail client
 * draws. A dark slab opens and closes it with light bands between, the way a
 * page on taylorurl.com sets slabs into paper. A section opens on a mono
 * uppercase label at wide tracking with a short accent rule beside it. Groups
 * of things are one bordered shell divided by hairlines rather than separate
 * boxes with gaps, which is what a table does natively and what the ruled
 * meshes in `@constants/grounds` do on the site. The figure takes the tight
 * negative tracking the site's display type is set in.
 *
 * The reading is one bordered object rather than a run of blocks: the
 * business's own home page, the figure the message is about, what that figure
 * means, whatever else the same report marked short, and where to run it again.
 * Only the performance figure is set at display size and only it carries the
 * band colour, which leaves the categories beside it reading as corroboration
 * that a page was examined rather than as a row of verdicts to argue with. A
 * category already in the good band appears nowhere: it is not a fault, and a
 * hundred printed next to a complaint reads as padding.
 *
 * Tables and inline styles throughout. Outlook renders mail through the Word
 * engine, which has no flexbox, no grid and no reliable support for a
 * stylesheet in the head, so every colour, size and space is an attribute or an
 * inline style on a cell. The one action is a VML rectangle behind the anchor,
 * so it is a button in Outlook rather than a line of styled text. Nothing here
 * reaches a network beyond the images: no tracking pixel, no shortened link, no
 * web font, no script and no external stylesheet.
 *
 * Images are off by default in Outlook and common elsewhere, so no fact lives
 * only in a picture. Every image carries alt text, a stated width and a stated
 * height, and the mark, every figure, the client names, the action and the way
 * off the list are all text. The capture of the reader's own page is the one
 * image carrying no fact of its own: it is the proof that a real page was
 * looked at, and a client that blocks it draws a labelled box naming the
 * business, above a reading that states everything the picture was standing
 * for.
 *
 * The colours are the site's own tokens from src/index.css, flattened to hex
 * against the surface each one sits on, because a mail client resolves no
 * custom property and composites no alpha against a ground it was not told
 * about. The slab is the `data-ground="dark"` palette; everything else is the
 * light field. The three score bands take the darker step each hue needs to
 * clear AA as ink on its own wash, which is the same treatment
 * `--danger-on-paper` gets in the stylesheet.
 */

import { PORTFOLIO_PROJECTS, portfolioEmailPreviewSrc } from '../../src/app/data/portfolio.js'
import { CLIENT_REVIEWS as REVIEWS } from '../../src/app/data/reputation/reviews.js'
import { BIO_NAME, bioBlock, bioText } from '../mail/bio.js'
import { ANNOTATION, TRADING_LINE, WORDMARK } from '../mail/identity.js'
import { ZONE } from '../time/zone.js'

/**
 * The host every address a reader can reach stands on.
 *
 * Outreach leaves from baytownwebdevelopment.com, and a link pointing somewhere
 * other than the domain a message arrived from is what a filter reads as
 * forwarded advertising and what a reader sees on the status bar when they
 * hover one. The environment moves it for a deployment sending under another
 * name.
 */
export const OUTREACH_ORIGIN =
  process.env.OUTREACH_SITE_URL || 'https://www.baytownwebdevelopment.com'

/**
 * The host the pictures in the sheet are served from.
 *
 * The wordmark, the platform's mark and the client previews are the site's own
 * files. A mail client fetches them and no reader reads one off a hover, so
 * they stay on the host that publishes them rather than being routed through a
 * second name.
 */
const SITE = 'https://www.taylorurl.com'

const START_URL = `${OUTREACH_ORIGIN}/start`

/**
 * The campaign a click out of a cold message is tagged with.
 *
 * The link stays a plain address on the studio's own domain rather than a hop
 * through a counter. A redirect in a cold message is read as a link shortener
 * by the filters that decide whether the message arrives at all, and the site
 * already records who arrives and what tag they carried, so the hop would buy
 * nothing the destination cannot already see.
 *
 * `utm_content` carries the message's own token, which is what separates a
 * campaign figure from an answer about one business.
 */
const CAMPAIGN = { source: 'outreach', medium: 'email', name: 'cold' }

/**
 * One page of the studio's own site, tagged so a click can be traced back.
 *
 * The origin is the outreach host unless a caller names another, which the
 * sign-off does: what a reader is given under the name is the studio's own
 * address rather than the one the message happened to leave from.
 */
function taggedUrl(path, track, origin = OUTREACH_ORIGIN) {
  const href = `${origin}${path}`
  if (!track) return href
  const tags = new URLSearchParams({
    utm_source: CAMPAIGN.source,
    utm_medium: CAMPAIGN.medium,
    utm_campaign: CAMPAIGN.name,
    utm_content: track,
  })
  return `${href}?${tags}`
}

/** Where the message's own calls to action point, tagged to the message. */
function startUrl(track) {
  return taggedUrl('/start', track)
}

/**
 * Where a laid-out letter sends somebody who wants to look before they answer.
 *
 * The cold letter carries none of this. It is an introduction and it offers
 * one address, under the sign-off, so a second door pointing at a gallery of
 * work would be the message selling rather than introducing. The paused
 * families still build their own from the same tag.
 *
 * @param {string|null} track The message's own token.
 */
export function workUrl(track) {
  return taggedUrl('/portfolio', track)
}

/**
 * The one address in a cold letter, under the sign-off, tagged the way every
 * other door is.
 *
 * It is the studio's own home page and nothing deeper: not the portfolio, not
 * the enquiry form, not a page about a service. A reader is being asked to
 * ring a person, and the address under the name is there so they can see who
 * that person is before they do, which one line on one page answers.
 *
 * @param {string|null} track The message's own token.
 */
export function homeUrl(track) {
  return taggedUrl('/', track, SITE)
}

/**
 * Where the message's images are fetched from, which is what an open is read
 * off.
 *
 * A scored message hands its capture over through here and is drawn exactly as
 * it was; a message with no capture carries the square this returns for
 * nothing else. Both are the same address, so a mail client fetching either
 * says the same thing.
 */
function trackedImage(track) {
  return `${OUTREACH_ORIGIN}/api/outreach/open?t=${encodeURIComponent(track)}`
}

/** Who the message is from, on the page rather than in the envelope. */
// The name is the bio's, not a second copy of it. A plain letter carries no
// bio paragraph, so the sign-off is the only place it says who wrote it, and
// a name spelled here as well as there is a name that can come apart.
const SIGNATURE = { name: BIO_NAME, studio: 'TaylorURL' }

/**
 * The studio's own inbox, which is the one the enquiry form delivers into and
 * the one the reply reader forwards to. One address rather than a choice of
 * them: a second spelling is a second place a message can sit unread. A proof
 * of a letter goes here and nowhere else.
 */
export const STUDIO_INBOX = 'trenton@taylorurl.com'

/** The address a reader writes to rather than replying. */
const CONTACT_EMAILS = [STUDIO_INBOX]

// The route a reader already has open in front of them. A message from an
// address nobody recognises gives no sign that a person is on the other end,
// and a reader who half agrees and cannot see one to answer does nothing. It sits with the other two routes rather than in a
// section of its own, because it is the same conversation reached a third way.
const REPLY_REACHES = 'A reply to this message comes straight to us, and we answer it ourselves.'

/**
 * The drafting annotation the site's heroes carry, which names the studio and
 * the town it trades from. It states no coordinate: the studio is a
 * service-area business with no premises, so a point on a map names somewhere
 * nobody can be met.
 */

/** Client sites shown as proof in one message. */
const WORK_SHOWN = 3

// The sheet is 600px because that is the width Outlook's reading pane and every
// desktop client agree on, and it goes fluid below that on its max-width. The
// sheet takes 28px of side padding and the work shell sits inside that with a
// hairline of its own, which is what fixes the preview width at 542. The
// captures are 1200x750, so the height follows from the width rather than being
// chosen, and the file is better than twice the box it is drawn in.
const SHEET_WIDTH = 600
const SHEET_PAD = 28
const PREVIEW_WIDTH = SHEET_WIDTH - SHEET_PAD * 2 - 2
const PREVIEW_HEIGHT = Math.round((PREVIEW_WIDTH * 750) / 1200)

// How the reader's own page is captured, live, at the moment the message is
// opened. `width` on its own answers with a square, which spends better than
// half the sheet's height on one picture; `crop` fixes the render height, and
// 750 against a 1200-pixel render lands on 1280x800. That is the same 16:10 the
// committed portfolio captures are cropped to, so both pictures in one message
// are the same shape and the box above is the box the mesh below draws.
//
// The URL is appended raw rather than encoded, since the service reads it as
// the tail of its own path. A listing carrying a query string still resolves.

/**
 * Where a prospect's page is captured from.
 *
 * Exported because the send job asks for the capture before the message
 * quoting it goes anywhere. The service renders a URL on the first request for
 * it and answers that request with a holding image of its own, so a reader
 * opening a message nobody had asked ahead of would find the service's logo
 * where their own page belongs.
 *
 * @param {string} url The site as the listing gives it.
 * @returns {string} The capture's address.
 */

// The mark, at the size it is drawn and the size it is served. The file is
// 240x72 so a retina screen has two device pixels per drawn pixel, and it is
// the single-ink form the site renders on a dark ground. 120px is what leaves
// the annotation beside it its own 107px on one line at 320px, which is the
// narrowest sheet a client draws.

// The platform the quotes come from, drawn from its own published brand asset
// rather than approximated. The file is 260x64 for the same reason the wordmark
// is twice its drawn size. Both single-ink forms travel, because the mark is
// used unaltered and a single ink only reads on the ground it was cut for: the
// black one for the light strip the work section sits on, the white one for a
// client that has drawn that strip dark. Naming the platform is the whole of
// what it is for, so neither form is recoloured to split the difference.
const TRUSTPILOT = {
  src: `${SITE}/images/email/trustpilot-on-light.png`,
  darkSrc: `${SITE}/images/email/trustpilot-on-dark.png`,
  width: 130,
  height: 32,
}

// The two halves of that swap. The style block in the head and the marks in the
// sheet have to name the same classes, so both are written once here.
const INK_LIGHT = 'ink-light'
const INK_DARK = 'ink-dark'

/**
 * What the rating is, in words.
 *
 * Every quote carried here is a five-star review, so the rating is said once
 * for the set beside the mark rather than drawn on each card. It is text: a row
 * of star characters falls in the ranges an emoji sweep reads as emoji, and the
 * mark beside it already carries the recognition a drawn rating would.
 */
const REVIEW_RATING = '5 Out Of 5'

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
const MONO = "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"

// The type scale, held across every band. Four steps of running text, two of
// mono label, and one display size that only the figure and the closing line
// reach for.
const FIGURE_SIZE = 56
const FIGURE_SIZE_LONG = 40
// The size the corroborating categories take, which is a third of the figure
// they sit under and a step above the running text, so they read as numbers
// without competing with the one the message is about.
const SUPPORT_SIZE = 20
const HEAD_SIZE = 22
const LEAD_SIZE = 16
const BODY_SIZE = 15
const BODY_SM_SIZE = 14
const META_SIZE = 13
const FINE_SIZE = 12
const LABEL_SIZE = 11
const LABEL_SM_SIZE = 10

/** The tracking every uppercase micro-label takes, which is --track-caps. */
const TRACK_CAPS = '0.22em'

// The field, from :root in src/index.css, with every alpha flattened onto the
// surface it is drawn on.
const PAGE = '#f6f6f5'
const SHEET = '#ffffff'
const INK = '#0a0a0a'
const INK_SOFT = '#4f4f4f'
const INK_MUTE = '#676767'
const INK_FAINT = '#737373'
const HAIRLINE = '#e6e6e6'
const HAIRLINE_STRONG = '#d3d3d3'
const ACCENT = '#1a4ed8'
const ACCENT_FILL = '#2b64f0'
const ON_ACCENT = '#ffffff'

// The `data-ground="dark"` palette, which is the slab a light page sets into
// itself. Its accent is the brighter step, since the paper step is too dark to
// read on black.
const SLAB = '#000000'
const SLAB_INK = '#ffffff'
const SLAB_INK_MUTE = '#8c8c8c'
const SLAB_ACCENT = '#3d76ff'

/**
 * The ink, wash and edge each band takes. `plain` belongs to a message with no
 * reading behind it, where the block states what is missing rather than scoring
 * it, and takes the page's own ink so it reads as a fact instead of a verdict.
 */
const BANDS = {
  poor: { ink: '#cf1f1f', wash: '#fef2f2', edge: '#fca5a5' },
  fair: { ink: '#b45309', wash: '#fef5e7', edge: '#fbd89d' },
  good: { ink: '#0f7a56', wash: '#e7f8f2', edge: '#9fe3cd' },
  plain: { ink: INK, wash: PAGE, edge: HAIRLINE_STRONG },
}

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** One value, safe to drop into markup or into an attribute. */
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ENTITIES[character])

/** A phone number as a dialable href, which is digits and a leading plus. */
const dial = phone => `tel:${String(phone).replace(/[^\d+]/g, '')}`

/** One run of type, as the inline declarations a mail client actually reads. */
function type({ size, weight = 400, height = 1.6, color = INK, face = SANS, track, caps }) {
  return [
    `font-family:${face}`,
    `font-size:${size}px`,
    `font-weight:${weight}`,
    `line-height:${height}`,
    `color:${color}`,
    track ? `letter-spacing:${track}` : '',
    caps ? 'text-transform:uppercase' : '',
  ]
    .filter(Boolean)
    .join(';')
}

/** The mono micro-label the site sets every section marker in. */
const label = (color, size = LABEL_SIZE) =>
  type({ size, weight: 600, height: 1.4, color, face: MONO, track: TRACK_CAPS, caps: true })

/**
 * The box a client with images blocked draws the alt text into.
 *
 * The stated width and height reserve it, and the wash, the centring and the
 * muted running text make what lands in it read as a labelled placeholder
 * rather than as a broken image.
 */

/**
 * An image, and what stands in its place when it does not arrive.
 *
 * A large share of readers see the message with images off before they see
 * anything else, and Outlook blocks them by default. What a client draws in
 * that state is decided almost entirely by the tag: an image with no size
 * collapses, one with no ground leaves a hole in the band it sits in, and one
 * whose alt text inherits nothing is rendered in the client's own default
 * serif at whatever size it likes, which is the thing that reads as broken.
 *
 * So every image in the sheet goes through here. The box is held open by width
 * and height, the ground is the one the image would have covered, and the alt
 * text is typed in the colour that band was designed for, centred in the space
 * the picture would have filled. `outline` and `text-decoration` are named
 * because a linked image inherits both, and an underlined blue caption inside
 * a grey box is the other half of what reads as breakage.
 *
 * A file that carries its own transparency is the exception, and the ground is
 * the reason. Painting one behind a cutout fills every pixel its glyphs do not
 * cover, so the colour named here is drawn as a rectangle the moment the client
 * puts anything else behind it, which is every tinted reading pane and every
 * theme that inverts what the band declared. A cutout therefore states no ground
 * and composites onto whatever the client actually drew. Nothing is lost with
 * images off: the cell behind it already paints the colour its alt text needs.
 *
 * @param {object} spec The image and the band it sits on.
 * @param {string} spec.src Absolute URL; a mail client resolves nothing relative.
 * @param {string} spec.alt What the picture shows, which is what a reader gets instead.
 * @param {number} spec.width Drawn width in pixels.
 * @param {number} spec.height Drawn height in pixels.
 * @param {string} spec.ground The colour behind it, painted unless it is a cutout.
 * @param {string} spec.ink The colour its alt text is set in.
 * @param {boolean} [spec.fluid] Whether it may shrink below its width on a phone.
 * @param {boolean} [spec.cutout] Whether the file carries its own transparency.
 * @param {string} [spec.className] What the dark-ground swap addresses it by.
 * @returns {string} One img tag.
 */
function image({
  src,
  alt,
  width,
  height,
  ground,
  ink,
  fluid = false,
  cutout = false,
  className = '',
}) {
  const box = fluid
    ? `width:100%;max-width:${width}px;height:auto;`
    : `width:${width}px;height:${height}px;`
  return (
    `<img src="${esc(src)}" alt="${esc(alt)}" ` +
    (className ? `class="${className}" ` : '') +
    `width="${width}" height="${height}" ` +
    `style="display:block;${box}border:0;outline:none;text-decoration:none;` +
    (cutout ? '' : `background-color:${ground};`) +
    `text-align:center;` +
    `${type({ size: META_SIZE, height: 1.5, color: ink })};">`
  )
}

/**
 * The same mark in both inks, so the ground the client drew picks one.
 *
 * Compositing a cutout onto the real ground is what keeps a rectangle from
 * appearing behind it, and it is also what leaves the mark's one ink to fend for
 * itself: black glyphs on a band the client has inverted are the same mark
 * unread. So both cuts travel. The light-ground one is drawn by default and the
 * dark-ground one waits behind a query the client answers only on a dark theme,
 * with the attribute Outlook.com stamps on the body carrying the same swap
 * there. A client that reads neither keeps the default, which is the cut its
 * unaltered ground was designed for, and Outlook's own renderer is held to that
 * default by a conditional comment rather than by a rule it would ignore.
 *
 * @param {object} spec The two cuts and the box they share.
 * @param {string} spec.light Absolute URL of the cut for a light ground.
 * @param {string} spec.dark Absolute URL of the cut for a dark one.
 * @param {string} spec.alt What the mark says, which is what a reader gets instead.
 * @param {number} spec.width Drawn width in pixels.
 * @param {number} spec.height Drawn height in pixels.
 * @param {string} spec.ink The colour its alt text is set in.
 * @returns {string} Both marks, one of them hidden.
 */
function markOnEitherGround({ light, dark, alt, width, height, ink }) {
  const cut = { alt, width, height, ink, cutout: true }
  return (
    image({ ...cut, src: light, className: INK_LIGHT }) +
    '<!--[if !mso]><!-->' +
    `<div class="${INK_DARK}" style="display:none;max-height:0;overflow:hidden;">` +
    image({ ...cut, src: dark }) +
    '</div>' +
    '<!--<![endif]-->'
  )
}

/** One row of a stacked table, which is how vertical space is held. */
const cell = (content, style, attributes = '') =>
  `<tr><td ${attributes}style="${style}">${content}</td></tr>`

/** Rows stacked in a full-width table, the layout primitive everything uses. */
const stack = rows =>
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
  `style="border-collapse:collapse;width:100%;">${rows.filter(Boolean).join('')}</table>`

/** One band of the sheet, holding its own padding and its own ground. */
const band = (content, { padding, ground, rule }) =>
  `<tr><td bgcolor="${ground}" style="background-color:${ground};${rule ? `border-top:1px solid ${rule};` : ''}padding:${padding};">${content}</td></tr>`

/** A band's padding, from its top and bottom steps, at the sheet's own inset. */
const pad = (top, bottom = 0) => `${top}px ${SHEET_PAD}px ${bottom}px ${SHEET_PAD}px`

/**
 * A label on the left and its scope on the right, on one baseline.
 *
 * The site's ruled block head and the corner annotation on a mesh cell are the
 * same shape at two sizes, so both go through here. The two labels share one
 * row at 320px, which is the narrowest sheet a client draws, so each is short
 * enough to hold half of it.
 */
function labelRow({ left, right, leftColor, rightColor, ground, size = LABEL_SIZE }) {
  const on = `background-color:${ground};`
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    `bgcolor="${ground}" style="border-collapse:collapse;width:100%;${on}"><tr>` +
    `<td align="left" bgcolor="${ground}" style="${on}${label(leftColor, size)};">${esc(left)}</td>` +
    (right
      ? `<td align="right" bgcolor="${ground}" style="${on}${label(rightColor, size === LABEL_SIZE ? LABEL_SM_SIZE : size)};">${esc(right)}</td>`
      : '') +
    '</tr></table>'
  )
}

/**
 * The short accent rule and the label beside it that opens a band.
 *
 * The rule is a one-pixel row inside a table of its own, because a cell in the
 * outer row grows to the height of the label beside it and draws a block rather
 * than a line. The inner row holds nothing but a space at a one-pixel line
 * height, so the only thing setting its height is the height it is given.
 */
function eyebrow(text, { color, rule, ground }) {
  const on = `background-color:${ground};`
  const hairline =
    '<table role="presentation" width="32" cellpadding="0" cellspacing="0" border="0" ' +
    `style="border-collapse:collapse;width:32px;"><tr>` +
    `<td height="1" bgcolor="${rule}" style="height:1px;line-height:1px;font-size:1px;` +
    `background-color:${rule};">&nbsp;</td></tr></table>`

  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ' +
    `bgcolor="${ground}" style="border-collapse:collapse;${on}"><tr>` +
    `<td width="32" valign="middle" bgcolor="${ground}" style="width:32px;${on}` +
    `line-height:0;font-size:0;">${hairline}</td>` +
    `<td width="12" bgcolor="${ground}" style="width:12px;font-size:1px;line-height:1px;${on}">&nbsp;</td>` +
    `<td valign="middle" bgcolor="${ground}" style="${on}${label(color)};">${esc(text)}</td>` +
    '</tr></table>'
  )
}

/** The mark and where the studio trades, on the slab the message opens with. */
function masthead() {
  const mark = image({
    src: WORDMARK.src,
    alt: 'TaylorURL',
    width: WORDMARK.width,
    height: WORDMARK.height,
    ground: SLAB,
    ink: SLAB_INK,
    cutout: true,
  })

  const annotation = ANNOTATION.map(
    line =>
      `<div style="${label(SLAB_INK_MUTE, LABEL_SM_SIZE)};line-height:1.7;">${esc(line)}</div>`
  ).join('')

  return band(
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
      `bgcolor="${SLAB}" style="border-collapse:collapse;width:100%;background-color:${SLAB};"><tr>` +
      `<td align="left" valign="middle" bgcolor="${SLAB}" style="background-color:${SLAB};line-height:0;font-size:0;">${mark}</td>` +
      `<td align="right" valign="middle" bgcolor="${SLAB}" style="background-color:${SLAB};">${annotation}</td>` +
      '</tr></table>',
    { padding: pad(26, 26), ground: SLAB }
  )
}

/** The greeting and the one line that says why the message exists. */
function lede({ marker, greeting, lines }) {
  return band(
    stack([
      cell(eyebrow(marker, { color: ACCENT, rule: ACCENT, ground: SHEET }), 'padding:0 0 20px 0'),
      cell(esc(`Hi ${greeting},`), type({ size: LEAD_SIZE, weight: 500, height: 1.5, color: INK })),
      ...lines.map(line =>
        cell(
          esc(line),
          `${type({ size: BODY_SIZE, height: 1.65, color: INK_SOFT })};padding-top:14px`
        )
      ),
    ]),
    { padding: pad(34), ground: SHEET }
  )
}

/** Paragraphs of running text under something the reader has just looked at. */
function prose(paragraphs, { top }) {
  return band(
    stack(
      paragraphs.map((paragraph, index) =>
        cell(
          esc(paragraph),
          `${type({ size: BODY_SIZE, height: 1.65, color: INK_SOFT })};padding-top:${index === 0 ? 0 : 14}px`
        )
      )
    ),
    { padding: pad(top), ground: SHEET }
  )
}

/**
 * The reader's own home page, captured at the moment the message is opened.
 *
 * It sits flush inside the reading's border, at the width and shape the client
 * previews further down take, so the two pictures in the message are one shape.
 * Nothing in it is a fact the message needs: it is the evidence that a page was
 * looked at, and a client with images off draws a box naming the business over
 * a reading that still states everything.
 */
function siteShot(site) {
  // No capture, no box. A reserved frame that never fills is worse than a
  // reading with no picture: it reads as a message that broke, and the figures
  // under it are the part that had to be believed.
  if (!site.shot) return ''
  return (
    '<tr><td style="padding:0;font-size:0;line-height:0;">' +
    image({
      src: site.shot,
      alt: `The home page of ${site.name}`,
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
      ground: PAGE,
      ink: INK_MUTE,
      fluid: true,
    }) +
    '</td></tr>'
  )
}

/** Columns the supporting strip is ruled into, whether or not all are filled. */
const SUPPORT_COLUMNS = 3

/**
 * The categories the same report marked short, beside the one it was run for.
 *
 * Labels and figures are two rows of one table rather than a column each, so
 * every figure shares a baseline whatever a label does when the column is too
 * narrow to hold it. The strip is always ruled into thirds and the unused ones
 * are left empty, so one shortfall and three sit in the same grid rather than
 * one stretching to fill the sheet.
 *
 * They carry the page's own ink and no band colour: colour in this message says
 * which band the performance reading fell in, and a second use of it would open
 * a second verdict beside the one the message is about.
 */
function supportRow(entries) {
  const width = `${Math.floor(100 / SUPPORT_COLUMNS)}%`
  const on = `background-color:${PAGE};`
  const spare = SUPPORT_COLUMNS - entries.length
  const across = (content, style) =>
    entries
      .map(
        entry =>
          `<td width="${width}" align="left" bgcolor="${PAGE}" ` +
          `style="width:${width};${on}${style};">${content(entry)}</td>`
      )
      .join('') +
    (spare
      ? `<td width="${spare * Math.floor(100 / SUPPORT_COLUMNS)}%" bgcolor="${PAGE}" ` +
        `style="${on}font-size:1px;line-height:1px;">&nbsp;</td>`
      : '')

  const heads = across(
    entry => esc(entry.label),
    `${label(INK_FAINT, LABEL_SM_SIZE)};padding:0 10px 0 0`
  )
  const figures = across(
    entry => esc(entry.value),
    `${type({ size: SUPPORT_SIZE, weight: 600, height: 1.2, color: INK, track: '-0.02em' })};padding:6px 10px 0 0`
  )

  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    `bgcolor="${PAGE}" style="border-collapse:collapse;width:100%;${on}">` +
    `<tr>${heads}</tr><tr>${figures}</tr></table>`
  )
}

/**
 * Where the reading can be taken again, and what about it holds when it is.
 *
 * It is laid out as a row of the reading with its own label, the same way the
 * shortfalls beside it are, rather than as a footnote under them: a reader
 * deciding whether a stranger's figure is real should not have to hunt for the
 * way to check it. The link is set in the page's own ink under a rule rather
 * than in the accent, since the accent belongs to the one thing the message
 * asks for and this is not it. Its text is the host it goes to.
 */
function verifyNote(note) {
  const link =
    `<a href="${esc(note.href)}" style="color:${INK};text-decoration:underline;">` +
    `${esc(note.link)}</a>`
  return stack([
    cell(
      labelRow({
        left: note.label,
        right: note.meta,
        leftColor: INK_FAINT,
        rightColor: INK_FAINT,
        ground: PAGE,
        size: LABEL_SM_SIZE,
      }),
      'padding:0 0 10px 0'
    ),
    cell(
      `${esc(note.lead)} ${link}. ${esc(note.tail)}`,
      `padding:0;${type({ size: BODY_SM_SIZE, height: 1.6, color: INK_SOFT })}`
    ),
  ])
}

/**
 * The reading, as one object: the page it was taken on, the figure it turns on,
 * what that figure means, the categories beside it, and where to take it again.
 *
 * A figure is the one thing in the message a reader can check against their own
 * site, so it is the largest type on the page and the only thing set in the
 * tight negative tracking the site's display type takes. The block is one
 * bordered object divided by hairlines rather than a coloured box: the band
 * shows in the ink, in the wash behind its label strip and in the edge under
 * it, which leaves the colour saying what the reading means without the border
 * shouting it. Long values step down a size so a phone still holds them on one
 * line.
 *
 * The capture opens the block, so the first thing under the greeting is the
 * reader's page rather than a number about it. The shortfalls and the note
 * close it on the page's own wash, a step down in size each time, so the block
 * reads as one figure with its evidence under it rather than as a row of
 * scores. A reading with nothing short in it renders the object without them.
 */
function figureBlock(figure) {
  const tone = BANDS[figure.band] ?? BANDS.plain
  const size = String(figure.value).length > 3 ? FIGURE_SIZE_LONG : FIGURE_SIZE

  const strip =
    `<tr><td bgcolor="${tone.wash}" style="background-color:${tone.wash};` +
    `border-bottom:1px solid ${tone.edge};padding:12px 18px;">` +
    labelRow({
      left: figure.label,
      right: figure.meta,
      leftColor: tone.ink,
      rightColor: INK_FAINT,
      ground: tone.wash,
    }) +
    '</td></tr>'

  const reading =
    `<tr><td bgcolor="${SHEET}" style="background-color:${SHEET};padding:26px 18px 24px 18px;">` +
    stack([
      cell(
        esc(figure.value),
        type({ size, weight: 700, height: 1.02, color: tone.ink, track: '-0.04em' })
      ),
      figure.unit && cell(esc(figure.unit), `${label(tone.ink)};padding-top:12px`),
    ]) +
    '</td></tr>'

  const meaning =
    `<tr><td bgcolor="${SHEET}" style="background-color:${SHEET};` +
    `border-top:1px solid ${HAIRLINE};padding:16px 18px 18px 18px;` +
    `${type({ size: BODY_SM_SIZE, height: 1.6, color: INK_SOFT })};">${esc(figure.meaning)}</td></tr>`

  const foot = (content, style) =>
    `<tr><td bgcolor="${PAGE}" style="background-color:${PAGE};` +
    `border-top:1px solid ${HAIRLINE};${style}">${content}</td></tr>`

  const support = figure.also?.length
    ? foot(
        stack([
          cell(
            labelRow({
              left: 'Also Under 90',
              right: 'Same Report',
              leftColor: INK_FAINT,
              rightColor: INK_FAINT,
              ground: PAGE,
              size: LABEL_SM_SIZE,
            }),
            'padding:0 0 10px 0'
          ),
          cell(supportRow(figure.also), 'padding:0'),
        ]),
        'padding:14px 18px 16px 18px;'
      )
    : ''

  const note = figure.note ? foot(verifyNote(figure.note), 'padding:14px 18px 16px 18px;') : ''

  const block =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    `bgcolor="${SHEET}" style="border-collapse:collapse;width:100%;background-color:${SHEET};` +
    `border:1px solid ${HAIRLINE_STRONG};">` +
    `${figure.site ? siteShot(figure.site) : ''}${strip}${reading}${meaning}${support}${note}</table>`

  return band(block, { padding: pad(30), ground: SHEET })
}

/**
 * Who the message is signed by: the portrait in its frame, the name, the
 * studio the name trades as, and the short account of the person behind both.
 *
 * A name and a studio say what the sender is called and nothing about who
 * wrote the letter, which is the question a cold message leaves open. The
 * whole unit is the arrangement the site's own pages use, so a reader who
 * follows a link from here meets the same face on the page.
 */
function signOff() {
  return band(
    bioBlock({
      sans: SANS,
      ink: INK,
      body: INK_SOFT,
      hairline: HAIRLINE_STRONG,
      subtitle: SIGNATURE.studio,
      subtitleStyle: label(INK_FAINT, LABEL_SM_SIZE),
    }),
    { padding: pad(26), ground: SHEET }
  )
}

/** The ruled head a section opens on: what it is, and what it is scoped to. */
function sectionHead(title, meta) {
  return band(
    stack([
      cell(
        labelRow({
          left: title,
          right: meta,
          leftColor: ACCENT,
          rightColor: INK_FAINT,
          ground: SHEET,
        }),
        `padding-bottom:12px;border-bottom:1px solid ${HAIRLINE}`
      ),
    ]),
    { padding: pad(36), ground: SHEET }
  )
}

/**
 * What a client said, under the site they said it about.
 *
 * The quote sits inside a rule rather than in a box of its own, which keeps it
 * part of the card it belongs to. A testimonial standing on its own is
 * something to be taken on trust; the same words under the address they are
 * about are one click from being checked, which is the only reason they are
 * worth carrying.
 */
function reviewQuote(review) {
  const words = stack([
    cell(`“${esc(review.quote)}”`, type({ size: BODY_SM_SIZE, height: 1.6, color: INK_SOFT })),
    cell(esc(review.name), `${label(INK_FAINT, LABEL_SM_SIZE)};padding-top:10px`),
  ])

  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="border-collapse:collapse;width:100%;"><tr>' +
    `<td style="border-left:2px solid ${HAIRLINE_STRONG};padding:0 0 0 14px;">${words}</td>` +
    '</tr></table>'
  )
}

/**
 * Where the quotes come from and what they are rated, said once for the set.
 *
 * A badge on every card would read as three separate claims. One line under the
 * mesh reads as one set of reviews on one platform, which is what it is. The
 * mark is an image and the rating is text, so a client with images off keeps
 * the whole statement.
 */
function reviewSource() {
  const mark = markOnEitherGround({
    light: TRUSTPILOT.src,
    dark: TRUSTPILOT.darkSrc,
    alt: 'Trustpilot',
    width: TRUSTPILOT.width,
    height: TRUSTPILOT.height,
    ink: INK_MUTE,
  })

  return (
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ' +
    `bgcolor="${PAGE}" style="border-collapse:collapse;background-color:${PAGE};"><tr>` +
    `<td valign="middle" bgcolor="${PAGE}" style="background-color:${PAGE};line-height:0;font-size:0;">${mark}</td>` +
    `<td width="16" bgcolor="${PAGE}" style="width:16px;font-size:1px;line-height:1px;background-color:${PAGE};">&nbsp;</td>` +
    `<td valign="middle" bgcolor="${PAGE}" style="background-color:${PAGE};${label(INK_FAINT, LABEL_SM_SIZE)};">${esc(REVIEW_RATING)}</td>` +
    '</tr></table>'
  )
}

/**
 * The client sites, as one ruled mesh.
 *
 * The sites are a single bordered shell divided by hairlines rather than three
 * cards with gaps between them, which is how every group on the site is drawn
 * and what stops three previews reading as three unrelated adverts. Each
 * preview is the whole width of the shell with the name, the town, the address
 * and what that client said beneath it, so a reader with images turned off
 * loses the picture and keeps every fact it was carrying. The image states its
 * own width and height, which is what reserves the box a client with images
 * blocked draws the alt text into, and the alt text is styled so that box reads
 * as a labelled placeholder rather than as a fault.
 */
function workMesh(projects) {
  const cells = projects.map((project, index) => {
    const preview = `${SITE}${portfolioEmailPreviewSrc(project)}`
    const picture =
      `<a href="${esc(project.url)}" style="display:block;color:${INK_MUTE};text-decoration:none;">` +
      image({
        src: preview,
        alt: `A preview of the ${project.name} website`,
        width: PREVIEW_WIDTH,
        height: PREVIEW_HEIGHT,
        ground: PAGE,
        ink: INK_MUTE,
        fluid: true,
      }) +
      '</a>'

    // The divider between two sites is the top rule of the second, so the mesh
    // draws one hairline between neighbours and none against its own border.
    const divider = index === 0 ? '' : `border-top:1px solid ${HAIRLINE};`

    // The name, the place and the address stack. At 320px the cell holds
    // either a name or a place on one row and not both.
    const details = stack([
      cell(
        esc(project.name),
        type({ size: LEAD_SIZE + 1, weight: 600, height: 1.3, color: INK, track: '-0.02em' })
      ),
      cell(esc(project.place), `${label(INK_FAINT, LABEL_SM_SIZE)};padding-top:6px`),
      cell(
        `<a href="${esc(project.url)}" style="color:${ACCENT};text-decoration:none;">${esc(project.displayUrl)}</a>`,
        `${type({ size: FINE_SIZE, weight: 600, height: 1.45, color: ACCENT, face: MONO })};padding-top:10px`
      ),
      project.review && cell(reviewQuote(project.review), 'padding-top:16px'),
    ])

    return (
      `<tr><td style="${divider}padding:0;font-size:0;line-height:0;">${picture}</td></tr>` +
      `<tr><td style="padding:16px 18px 18px 18px;">${details}</td></tr>`
    )
  })

  // The set is attributed only where it has something to attribute.
  const source = projects.some(project => project.review)
    ? `<tr><td bgcolor="${PAGE}" style="background-color:${PAGE};` +
      `border-top:1px solid ${HAIRLINE};padding:14px 18px;">${reviewSource()}</td></tr>`
    : ''

  const shell =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    `bgcolor="${SHEET}" style="border-collapse:collapse;width:100%;background-color:${SHEET};` +
    `border:1px solid ${HAIRLINE};">${cells.join('')}${source}</table>`

  return band(shell, { padding: pad(16), ground: SHEET })
}

/**
 * The one action, on the slab that closes the message.
 *
 * The anchor is drawn twice: a VML rectangle Word fills and centres, and the
 * table every other client reads. Each is hidden from the other by the
 * conditional comment around it, so exactly one arrives.
 */
function ctaBlock({ headline, action, phone, href = START_URL }) {
  const buttonType = type({
    size: FINE_SIZE,
    weight: 600,
    height: 1.2,
    color: ON_ACCENT,
    face: MONO,
    track: '0.18em',
    caps: true,
  })

  const outlook =
    '<!--[if mso]>' +
    '<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" ' +
    `href="${esc(href)}" style="height:50px;v-text-anchor:middle;width:214px;" arcsize="0%" ` +
    `strokecolor="${ACCENT_FILL}" fillcolor="${ACCENT_FILL}"><w:anchorlock/>` +
    `<center style="color:${ON_ACCENT};font-family:${MONO};font-size:${FINE_SIZE}px;` +
    `font-weight:600;letter-spacing:2px;">${esc(action.toUpperCase())}</center>` +
    '</v:roundrect><![endif]-->'

  const everywhereElse =
    '<!--[if !mso]><!-->' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ' +
    'style="border-collapse:collapse;"><tr>' +
    `<td align="center" bgcolor="${ACCENT_FILL}" style="background-color:${ACCENT_FILL};">` +
    `<a href="${esc(href)}" style="display:block;padding:17px 30px;text-decoration:none;${buttonType};">` +
    `${esc(action)}</a></td></tr></table>` +
    '<!--<![endif]-->'

  // The routes that are not the button, in one run under it. Neither is a
  // second destination: they are the same conversation reached another way, and
  // for most readers the reply is the shorter one.
  const routes = [
    esc(REPLY_REACHES),
    phone
      ? `Or call <a href="${esc(dial(phone))}" style="color:${SLAB_ACCENT};text-decoration:none;">${esc(phone)}</a>.`
      : '',
  ]
    .filter(Boolean)
    .join(' ')

  const alternative = cell(
    routes,
    `${type({ size: META_SIZE, height: 1.5, color: SLAB_INK_MUTE })};padding-top:16px`
  )

  return band(
    stack([
      cell(
        eyebrow('// Next Step', { color: SLAB_ACCENT, rule: SLAB_ACCENT, ground: SLAB }),
        'padding:0 0 18px 0'
      ),
      cell(
        esc(headline),
        `${type({ size: HEAD_SIZE, weight: 600, height: 1.2, color: SLAB_INK, track: '-0.03em' })};padding-bottom:22px`
      ),
      cell(outlook + everywhereElse, 'padding:0'),
      alternative,
    ]),
    { padding: pad(34, 34), ground: SLAB }
  )
}

/** Where the message came from, and the one click that stops it. */
function footer({ phone, unsubscribe }) {
  const link = (href, text, color) =>
    `<a href="${esc(href)}" style="color:${color};text-decoration:none;">${esc(text)}</a>`

  const control =
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" ' +
    'style="border-collapse:collapse;"><tr>' +
    `<td align="center" bgcolor="${PAGE}" style="background-color:${PAGE};` +
    `border:1px solid ${HAIRLINE_STRONG};">` +
    `<a href="${esc(unsubscribe)}" style="display:block;padding:12px 20px;text-decoration:none;` +
    `${label(INK_SOFT, LABEL_SIZE)};">Unsubscribe</a></td></tr></table>`

  return band(
    stack([
      cell(esc(SIGNATURE.studio), label(INK)),
      phone &&
        cell(
          link(dial(phone), phone, INK_SOFT),
          `${type({ size: META_SIZE, height: 1.6, color: INK_SOFT })};padding-top:12px`
        ),
      ...CONTACT_EMAILS.map(email =>
        cell(
          link(`mailto:${email}`, email, INK_SOFT),
          `${type({ size: META_SIZE, height: 1.6, color: INK_SOFT })};padding-top:2px`
        )
      ),
      unsubscribe && cell(control, `padding-top:20px;border-top:1px solid ${HAIRLINE}`),
      unsubscribe &&
        cell(
          'One click takes this address off the list.',
          `${type({ size: FINE_SIZE, height: 1.55, color: INK_MUTE })};padding-top:12px`
        ),
    ]),
    { padding: pad(22, 26), ground: PAGE, rule: HAIRLINE }
  )
}

/**
 * The document the bands are set into.
 *
 * The outer table paints the page ground on a cell rather than leaving it to
 * the body, because a dark-mode client inverts an unpainted ground and leaves
 * the sheet floating on whatever it chose. Every band inside states its own
 * ground for the same reason. The hidden line at the top is the preview a
 * client shows beside the subject.
 *
 * The one style block is the head's only rule and exists for the marks alone. A
 * ground stated on a cell is a request rather than a guarantee, and the clients
 * that ignore the light scheme declared above are the ones that hand a cutout
 * mark a ground it was never cut for. The query is how those clients say so,
 * `[data-ogsc]` is how Outlook.com says the same thing, and everything else in
 * the sheet stays inline, where no client can strip it.
 */
function shell({ subject, preheader, bands, tracker = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="x-ua-compatible" content="ie=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
<style>
@media (prefers-color-scheme: dark) {
.${INK_LIGHT} { display: none !important; }
.${INK_DARK} { display: block !important; max-height: none !important; overflow: visible !important; }
}
[data-ogsc] .${INK_LIGHT} { display: none !important; }
[data-ogsc] .${INK_DARK} { display: block !important; max-height: none !important; overflow: visible !important; }
</style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:${PAGE};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${PAGE};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE}" style="border-collapse:collapse;width:100%;background-color:${PAGE};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="${SHEET_WIDTH}" cellpadding="0" cellspacing="0" border="0" bgcolor="${SHEET}" style="border-collapse:collapse;width:100%;max-width:${SHEET_WIDTH}px;background-color:${SHEET};border:1px solid ${HAIRLINE};">
${bands.join('\n')}
</table>
</td></tr>
</table>
${tracker}
</body>
</html>`
}

/**
 * The laid-out half of the message.
 *
 * @param {object} message Content object shared with `renderText`.
 * @returns {string} A complete HTML document.
 */
export function renderHtml(message) {
  const { figure, work, contact } = message
  const track = message.track || null

  // The capture is fetched through the studio's own address rather than
  // straight off the storage it sits on, which is what turns a picture a mail
  // client was going to fetch anyway into a reading of whether the message was
  // opened. What the reader sees is the same capture at the same size.
  const seen =
    figure && track && figure.site?.shot
      ? { ...figure, site: { ...figure.site, shot: trackedImage(track) } }
      : figure

  // A business with no site of its own has no capture, so its message would
  // fetch nothing and report nothing. The square is what it carries instead,
  // and it is the only message that carries one. A letter with no figure at
  // all, which a follow-up may be, carries the square too.
  const tracker =
    track && !figure?.site?.shot
      ? `<img src="${esc(trackedImage(track))}" alt="" width="1" height="1" ` +
        'style="display:block;width:1px;height:1px;border:0;">'
      : ''

  return shell({
    subject: message.subject,
    preheader: figure?.meaning ?? message.after?.[0] ?? message.lines?.[0] ?? message.subject,
    tracker,
    bands: [
      masthead(),
      lede({ marker: message.marker, greeting: message.greeting, lines: message.lines }),
      figure ? figureBlock(seen) : '',
      prose(message.after, { top: 26 }),
      signOff(),
      work.length ? sectionHead('Live Work', 'Southeast Texas') : '',
      work.length ? workMesh(work) : '',
      ctaBlock({
        headline: message.close,
        action: 'Start a Project',
        phone: contact.phone,
        href: startUrl(track),
      }),
      footer(contact),
    ].filter(Boolean),
  })
}

/**
 * The plain half of the message, built from the same content object, so the two
 * halves cannot state a different figure, a different piece of work or a
 * different way off the list.
 *
 * @param {object} message Content object shared with `renderHtml`.
 * @returns {string} The message as text.
 */
export function renderText(message) {
  const { figure, work, contact } = message
  // A blank line between paragraphs, which is what the laid-out half draws as
  // the space between two prose rows.
  const paragraphs = items => items.flatMap((item, index) => (index ? ['', item] : [item]))
  const lines = [`Hi ${message.greeting},`, '', ...paragraphs(message.lines), '']

  // The capture the laid-out half opens the reading with, said the only way
  // text can say it: the address the reading was taken on. A letter with no
  // figure, which a follow-up may be, goes straight from its lines to what
  // follows them.
  if (figure) {
    if (figure.site) lines.push('THE PAGE MEASURED', figure.site.url, '')

    lines.push(`${figure.label.toUpperCase()} (${figure.meta.toUpperCase()})`)
    lines.push([figure.value, figure.unit].filter(Boolean).join(' '))
    lines.push(figure.meaning, '')

    if (figure.also?.length) {
      lines.push('ALSO UNDER 90 (SAME REPORT)')
      for (const entry of figure.also) lines.push(`${entry.label} ${entry.value}`)
      lines.push('')
    }
    // The address goes on a line of its own, so a mail client turning it into
    // a link does not take the full stop with it.
    if (figure.note) {
      lines.push(`${figure.note.label.toUpperCase()} (${figure.note.meta.toUpperCase()})`)
      lines.push(`${figure.note.lead} the link below. ${figure.note.tail}`, figure.note.href, '')
    }
  }

  lines.push(...paragraphs(message.after), '')
  lines.push(SIGNATURE.name, SIGNATURE.studio, '', bioText(), '')

  if (work.length) {
    lines.push('LIVE WORK', '')
    for (const project of work) {
      lines.push(`${project.name} - ${project.place}`, project.url)
      if (project.review) lines.push(`"${project.review.quote}"`, project.review.name)
      lines.push('')
    }
    if (work.some(project => project.review)) {
      lines.push(`Trustpilot, ${REVIEW_RATING.toLowerCase()}.`, '')
    }
  }

  lines.push(message.close)
  lines.push(`Start a project: ${startUrl(message.track || null)}`)
  lines.push(REPLY_REACHES)
  if (contact.phone) lines.push(`Or call ${contact.phone}.`)

  lines.push('', SIGNATURE.studio)
  if (contact.phone) lines.push(contact.phone)
  lines.push(...CONTACT_EMAILS)

  if (contact.unsubscribe) {
    lines.push('', `Unsubscribe: ${contact.unsubscribe}`)
    lines.push('One click takes this address off the list.')
  }

  return lines.join('\n')
}

/**
 * The plain letter, laid out the way a mail client lays out a message a
 * person typed: paragraphs in the client's own reading face, the studio's own
 * signature under them, the way off the list under that, and nothing else in
 * the envelope but the one square that says whether it was opened. No
 * masthead, no figure, no capture, no cards, no button. The two halves are
 * built from one content object the way the laid-out letter's are, so neither
 * can say a paragraph the other does not.
 *
 * The signature is the one drawing the family allows, and it is allowed
 * because it is the thing that makes a typed note look typed: mail leaves
 * every desk in this studio signed, and a cold letter that closes in bare text
 * closes unlike every other letter the same reader would get back. It carries
 * the name in its alt text, so a client holding pictures back loses the
 * drawing and not the sign-off.
 */
const PLAIN_INK = '#111111'
const PLAIN_MUTE = '#737373'
const PLAIN_TYPE = `font-family:${SANS};font-size:15px;line-height:1.6;color:${PLAIN_INK};`
const PLAIN_LINK = /https?:\/\/[^\s<]+/g

/**
 * The studio's own email signature, the file every mailbox here signs with.
 *
 * It is drawn rather than typed, so the letter closes the way a reply from
 * this desk closes and the reader sees one signature whichever of the two
 * reached them first. The file is 560x122 for the same reason the wordmark is
 * twice its drawn size, and it carries no ground of its own, so a client that
 * paints the sheet dark paints behind it rather than around it.
 */
const PLAIN_SIGNATURE = {
  src: `${SITE}/images/email/signature.png`,
  width: 280,
  height: 61,
}

/** Noon, in minutes from midnight, which is where the morning ends. */
const MIDDAY = 12 * 60

/**
 * Morning or afternoon, read off the clock the reader keeps.
 *
 * Every business written to is in Southeast Texas and the sending window is
 * Central office hours, so the half of the day the letter greets is the half
 * the reader is in rather than the half a function happened to run in. The
 * moment is passed rather than taken, because the greeting has to be the same
 * answer for a message drafted at eight and read back in a check at four.
 *
 * @param {Date} at The moment the letter is written for.
 * @returns {'morning'|'afternoon'}
 */
export function partOfDay(at) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at)
  const of = type => Number(parts.find(part => part.type === type)?.value ?? '0')
  return (of('hour') % 24) * 60 + of('minute') < MIDDAY ? 'morning' : 'afternoon'
}

/** One paragraph, with the lines inside it kept as lines and its addresses made links. */
/**
 * The address a link is shown as, which is not the address it points at.
 *
 * A tagged link is a hundred characters of tracking, and a letter that prints
 * that in the middle of a sentence stops looking like something a person
 * typed, which is the whole of what this family is. So the tags travel in the
 * href where a mail client keeps them and the reader sees the address they
 * would have typed. The plain half has nowhere to hide them and carries the
 * whole thing, which is what a text part has always looked like.
 */
const shownAs = href =>
  href
    .replace(/^https?:\/\//i, '')
    .split(/[?#]/)[0]
    .replace(/\/$/, '')

function plainParagraph(text) {
  const html = esc(text)
    .split('\n')
    .map(line =>
      line.replace(
        PLAIN_LINK,
        href => `<a href="${href}" style="color:${PLAIN_INK};">${shownAs(href)}</a>`
      )
    )
    .join('<br>')
  return `<p style="margin:0 0 16px 0;${PLAIN_TYPE}">${html}</p>`
}

/**
 * The greeting: the half of the day it arrives in, and the name where the
 * address gave one.
 *
 * A letter that says good morning at nine has been read by somebody having
 * their morning, and one that says it at four has been read by a machine. The
 * half is written into the message rather than left to the reader's client,
 * which is why the sender redrafts a letter still sitting in the queue when
 * the half it was written for has passed.
 */
const plainGreeting = (name, at) =>
  name ? `Good ${partOfDay(at)}, ${name},` : `Good ${partOfDay(at)},`

/**
 * The laid-out half of a plain letter, which is barely laid out at all.
 *
 * @param {object} message Content object shared with `renderPlainText`.
 * @returns {string} A complete HTML document.
 */
export function renderPlainHtml(message) {
  const { contact } = message
  const track = message.track || null
  const tracker = track
    ? `<img src="${esc(trackedImage(track))}" alt="" width="1" height="1" ` +
      'style="display:block;width:1px;height:1px;border:0;">'
    : ''
  // The sign-off, which is the whole of what the letter offers: the studio's
  // own signature, drawn, with the studio's own address behind it. The name
  // and the studio ride in the alt text, so a client holding the pictures back
  // still shows a letter somebody signed rather than a gap above the footer.
  const drawn =
    `<img src="${esc(PLAIN_SIGNATURE.src)}" alt="${esc(`${SIGNATURE.name}, ${SIGNATURE.studio}`)}" ` +
    `width="${PLAIN_SIGNATURE.width}" height="${PLAIN_SIGNATURE.height}" ` +
    `style="display:block;width:${PLAIN_SIGNATURE.width}px;height:${PLAIN_SIGNATURE.height}px;` +
    `max-width:100%;border:0;">`
  const signature = contact.site
    ? `<a href="${esc(contact.site)}" style="display:inline-block;text-decoration:none;">${drawn}</a>`
    : drawn
  // The footer a plain letter carries: who is writing and where they trade,
  // and the way off the list. Small and grey, the way a footer under a typed
  // note is, but present, because a cold message that names no registered
  // studio is one both the reader and the filters read as something other than
  // a person writing.
  const off =
    `<p style="margin:28px 0 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${PLAIN_MUTE};">` +
    esc(TRADING_LINE) +
    (contact.unsubscribe
      ? `<br><a href="${esc(contact.unsubscribe)}" style="color:${PLAIN_MUTE};">Unsubscribe</a>`
      : '') +
    '</p>'

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(message.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${SHEET};">
<div style="max-width:560px;padding:20px 16px;">
<p style="margin:0 0 16px 0;${PLAIN_TYPE}">${esc(plainGreeting(message.greeting, message.at))}</p>
${message.paragraphs.map(plainParagraph).join('\n')}
<p style="margin:0;line-height:0;font-size:0;">${signature}</p>
${off}
</div>
${tracker}
</body>
</html>`
}

/**
 * The plain half of a plain letter, built from the same content object.
 *
 * @param {object} message Content object shared with `renderPlainHtml`.
 * @returns {string} The message as text.
 */
export function renderPlainText(message) {
  const { contact } = message
  const lines = [plainGreeting(message.greeting, message.at), '']
  for (const paragraph of message.paragraphs) lines.push(paragraph, '')
  lines.push(SIGNATURE.name, SIGNATURE.studio)
  // The number and then the address, as a person writes them under their name.
  // The tags ride in the laid-out half's href and the plain half shows the
  // address as it would be typed, so a signature with a tracking string on the
  // end of it earns nothing the letter has not already recorded.
  if (contact.phone) lines.push(contact.phone)
  if (contact.site) lines.push(shownAs(contact.site))
  lines.push('', TRADING_LINE)
  if (contact.unsubscribe) lines.push(`Unsubscribe: ${contact.unsubscribe}`)
  return lines.join('\n')
}

/**
 * The trades whose search term differs from the slug the portfolio files work
 * under. Every other term slugifies onto its own slug, so only the ones that
 * disagree are named here.
 */
const TRADE_ALIASES = {
  accountant: 'accounting',
  'auto repair': 'auto-repair',
  'concrete contractor': 'concrete',
  electrician: 'electrical',
  'fencing contractor': 'fencing',
  'go kart track': 'recreation',
  'hvac contractor': 'hvac',
  'industrial contractor': 'industrial',
  plumber: 'plumbing',
  'real estate agency': 'real-estate',
  'roofing contractor': 'roofing',
  'towing service': 'towing',
}

/**
 * Whether a piece of work is actually in the business's own trade.
 *
 * `workFor` puts the closest work first whether or not anything matches, so
 * the first card is the closest available and not necessarily a close one. A
 * letter that calls it "the closest thing to your line of work" is telling a
 * pest control company that a go-kart track is in their line of work, which
 * is the one claim in the message a reader can check in a second. This is
 * what a letter asks before making that claim.
 *
 * @param {object|null} project An entry as `workFor` returns one.
 * @param {string|null|undefined} trade The business's own trade.
 */
export function sharesTrade(project, trade) {
  const wanted = tradeSlug(trade)
  return Boolean(wanted && project?.trades?.includes(wanted))
}

/**
 * A sourcing term as the trade slug `PORTFOLIO_PROJECTS` carries.
 *
 * The two vocabularies are written by different hands. A term is what somebody
 * would search for and a slug is what the portfolio files a build under, and
 * where the two words differ the fall-through slug matches nothing: "real
 * estate agency" reads as `real-estate-agency`, the work is filed under
 * `real-estate`, and a realtor is shown a go-kart track instead of the realtor
 * site built for one. The alias is the whole of what stands between those two.
 *
 * So a term sourced against goes in here whenever the portfolio holds work in
 * that trade under another word. A term with no matching work needs no entry:
 * it falls through, matches nothing, and `sharesTrade` keeps the letter from
 * claiming otherwise.
 */
function tradeSlug(trade) {
  const term = String(trade ?? '')
    .toLowerCase()
    .trim()
  if (!term) return ''
  return (
    TRADE_ALIASES[term] ??
    term
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
  )
}

/** Where a client trades, from its own field or from its case study. */
function townOf(project) {
  return project.town ?? project.location?.split(',')[0].trim() ?? null
}

/**
 * What a client said about their own site, against the site they said it about.
 *
 * Each is the reviewer's own words trimmed to the sentences that carry, and
 * nothing else: the spelling is theirs and stays theirs, because a review
 * corrected into clean prose reads as one written by whoever is quoting it.
 * They are keyed on the site so a quote can only ever appear under the work it
 * is about, which is what a reader can check in one click.
 */

/**
 * The line under a site's name, which says what a reader would find by
 * clicking it. A local build is placed by its town, which is the fact that
 * matters to a business hiring nearby. A studio product has no town to give,
 * so it is placed by what it does instead of being left with a blank line or
 * dropped from the studio's own work.
 *
 * @param {object} project Portfolio entry.
 * @returns {string} One short line, already reading as a place or a sector.
 */
function placeOf(project) {
  const town = townOf(project)
  if (town) return `${town}, Texas`
  // A tagline carries the sector ahead of its separator and the detail after
  // it. The card has room for the sector, which is the half that says what a
  // reader would find on the other end of the link.
  return String(project.tagline ?? '')
    .split('\u00b7')[0]
    .trim()
}

// Client work placed by its town, and a studio product only where its own
// owner left a review, since the mesh is proof and a product with nobody
// speaking for it proves less than the site beside it. A card carries a quote
// where one was left and carries the work alone where it was not, because a
// borrowed quote under the wrong site is the one thing here a reader cannot
// check.
const SHOWABLE = PORTFOLIO_PROJECTS.filter(project => {
  const review = REVIEWS[project.displayUrl] ?? null
  if (project.kind === 'client') return Boolean(townOf(project))
  return Boolean(review)
}).map(project => ({
  name: project.name,
  town: townOf(project) ?? '',
  place: placeOf(project),
  url: project.url,
  displayUrl: project.displayUrl,
  trades: project.trades,
  review: REVIEWS[project.displayUrl] ?? null,
}))

/**
 * The client sites one prospect is shown.
 *
 * A business in a trade a client already works in sees that client first,
 * because the closest proof is a site doing the same job. Everything after it
 * is ordered by town, so a business with no matching trade still sees work from
 * where it trades. The sort is stable, which leaves the portfolio's own order
 * deciding ties.
 *
 * @param {{ trade?: string, town?: string }} prospect The business being written to.
 * @returns {Array<object>} Up to three entries, each carrying a name, a town and a link.
 */
export function workFor(prospect) {
  const wanted = tradeSlug(prospect.trade)
  const near = String(prospect.town ?? '')
    .toLowerCase()
    .trim()

  // Trade first, then town, and a card carrying a quote ahead of one that does
  // not where the two are otherwise level. The quote only ever settles a tie,
  // so the closest work still leads whether or not anybody wrote about it.
  const rank = project => {
    const closeness =
      wanted && project.trades.includes(wanted)
        ? 0
        : near && project.town.toLowerCase() === near
          ? 1
          : 2
    return closeness * 2 + (project.review ? 0 : 1)
  }

  return [...SHOWABLE].sort((first, second) => rank(first) - rank(second)).slice(0, WORK_SHOWN)
}
