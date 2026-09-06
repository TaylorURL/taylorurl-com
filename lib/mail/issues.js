/**
 * What an issue is, what state it is in, and what a person may write into it.
 *
 * The three statuses the table allows are one vocabulary shared by the page
 * that writes an issue and the run that mails it, so the word the composer
 * sets and the word the sender reads cannot drift apart:
 *
 *   draft      being written; the send refuses it
 *   scheduled  ready to go out, on its date or when somebody presses send
 *   sent       gone; nothing sends it again and nothing rewrites it
 *
 * The body is a list of blocks rather than markup, because the same content is
 * drawn twice — once as email tables and once as a web page — and a blob of
 * HTML authored for one of them is wrong in the other. So the block types are
 * fixed, every field on them is checked here, and an issue that reaches the
 * database is one both renderers can already draw.
 *
 * A block also carries who it is for. One issue speaks to two lists at once -
 * people whose sites the studio runs, and people it has only written to - and
 * a block marked for one of them is drawn for that one alone. A block carrying
 * no marker reaches both, which is what leaves every issue written before this
 * existed rendering exactly as it did.
 */

import { AUDIENCES } from './audience.js'

/** Unfinished writing. */
export const DRAFT = 'draft'
/** Ready: the writing is done and the issue may go out. */
export const READY = 'scheduled'
/** Delivered, and final. */
export const SENT = 'sent'

/** The six block types both renderers draw. */
export const BLOCK_TYPES = ['heading', 'paragraph', 'image', 'button', 'divider', 'list']

/**
 * The types that say something.
 *
 * A rule is spacing between two things, so an issue whose whole copy for one
 * side is a rule is an issue with nothing to say to that side. That is the
 * distinction {@link hasContentFor} answers on.
 */
export const CONTENT_TYPES = BLOCK_TYPES.filter(type => type !== 'divider')

/** Ceilings, so one issue is a document rather than an unbounded write. */
export const LIMITS = {
  slug: 120,
  title: 200,
  preheader: 200,
  text: 5000,
  href: 2000,
  blocks: 200,
  items: 100,
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * The slug as it is stored, or null where it is not one.
 *
 * A slug is the issue's address on the web and the tag every open and click is
 * filed under, so it is lowercase, hyphenated and nothing else.
 */
export function issueSlug(value) {
  const slug = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return slug.length <= LIMITS.slug && SLUG.test(slug) ? slug : null
}

/** A trimmed string, capped, or null where the column takes a null. */
function text(value, max) {
  const trimmed = typeof value === 'string' ? value.trim().slice(0, max) : ''
  return trimmed || null
}

/** A link the renderers will actually draw. Anything else is dropped. */
function href(value) {
  const raw = typeof value === 'string' ? value.trim().slice(0, LIMITS.href) : ''
  if (!raw) return null
  return /^(https?:|mailto:|\/)/i.test(raw) ? raw : null
}

function size(value) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null
}

/**
 * The side a block is written for: one of {@link AUDIENCES}, `''` for a block
 * that reaches everybody, and null for a marker naming no side at all.
 *
 * The third answer is why this is a function rather than a comparison. A
 * marker nobody can read is a block whose readership was never decided, and
 * both of the other answers would decide it by accident - as everybody, which
 * is the leak, or as one side, which is a guess.
 */
function marker(value) {
  if (value === undefined || value === null || value === '') return ''
  const name = typeof value === 'string' ? value.trim() : ''
  return AUDIENCES.includes(name) ? name : null
}

/**
 * One authored block, reduced to the fields its type carries.
 *
 * Unknown types and blocks that would draw nothing come back null. A heading
 * with no text is not a heading a reader would see; a button with no target is
 * a rectangle that does nothing; an image with no source is an empty box. Each
 * of them renders as nothing in both renderers already, and keeping it would
 * only leave a gap in the composer that nobody can explain.
 *
 * A block whose marker names no side joins them. It is refused at the door
 * rather than stored, so the composer shows it gone on the next read instead of
 * an issue holding copy that both renderers will silently drop.
 */
export function readBlock(block) {
  if (!block || typeof block !== 'object') return null
  const side = marker(block.audience)
  if (side === null) return null
  const shaped = shapeBlock(block)
  if (!shaped) return null
  return side ? { ...shaped, audience: side } : shaped
}

/** One block reduced to the fields its type carries, before its marker. */
function shapeBlock(block) {
  switch (block.type) {
    case 'heading': {
      const body = text(block.text, LIMITS.text)
      return body ? { type: 'heading', text: body, level: block.level === 3 ? 3 : 2 } : null
    }
    case 'paragraph': {
      const body = text(block.text, LIMITS.text)
      return body ? { type: 'paragraph', text: body } : null
    }
    case 'image': {
      const src = href(block.src)
      if (!src) return null
      const width = size(block.width)
      const height = size(block.height)
      return {
        type: 'image',
        src,
        alt: text(block.alt, LIMITS.title) || '',
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
      }
    }
    case 'button': {
      const target = href(block.href)
      const label = text(block.text, LIMITS.title)
      return target && label ? { type: 'button', text: label, href: target } : null
    }
    case 'divider':
      return { type: 'divider' }
    case 'list': {
      const items = (Array.isArray(block.items) ? block.items : [])
        .slice(0, LIMITS.items)
        .map(item => text(item, LIMITS.text))
        .filter(Boolean)
      return items.length ? { type: 'list', items, ordered: block.ordered === true } : null
    }
    default:
      return null
  }
}

/** An authored body, reduced to the blocks both renderers can draw. */
export function readBody(body) {
  return (Array.isArray(body) ? body : []).slice(0, LIMITS.blocks).map(readBlock).filter(Boolean)
}

/**
 * The blocks of an issue one side of the list is shown.
 *
 * Every renderer and every count runs through here, so the laid-out half, the
 * plain half and the check that an issue has anything to say are answering one
 * question rather than three that agree by inspection. A block dropped from one
 * part and kept in the other is a message contradicting itself, and it is the
 * fault this would otherwise ship with.
 *
 * A marker naming no side matches nobody, which is the same refusal
 * {@link readBlock} makes on the way in, answered again on the way out for a
 * body that never went through it.
 *
 * @param {Array} body The issue's blocks.
 * @param {string|null} [audience] One of {@link AUDIENCES}, or null for every block.
 * @returns {Array} The blocks that side is shown, in order.
 */
export function blocksFor(body, audience = null) {
  const blocks = Array.isArray(body) ? body : []
  if (!audience) return blocks
  return blocks.filter(block => {
    const side = typeof block?.audience === 'string' ? block.audience : ''
    return !side || side === audience
  })
}

/**
 * Whether an issue says anything to one side of the list.
 *
 * A copy carrying a masthead, a title and a footer is a message with nothing in
 * it, which is what an issue written entirely for the other side would post.
 *
 * @param {Array} body The issue's blocks.
 * @param {string|null} [audience] One of {@link AUDIENCES}, or null for every block.
 * @returns {boolean}
 */
export function hasContentFor(body, audience = null) {
  return blocksFor(body, audience).some(block => CONTENT_TYPES.includes(block?.type))
}

/**
 * Why this issue cannot be sent, or null when it can.
 *
 * The two refusals are different facts and read differently. A draft is not
 * finished, which is a thing the writer fixes by marking it ready. An issue
 * already sent is finished, and pressing send again is a mistake with no fix -
 * the mail has landed.
 *
 * @param {{status?: string, slug?: string}} issue
 * @returns {{status: number, error: string}|null}
 */
export function sendRefusal(issue) {
  if (issue?.status === SENT) {
    return { status: 409, error: 'That issue has already gone out. It cannot be sent again.' }
  }
  if (issue?.status !== READY) {
    return { status: 409, error: 'Mark the issue ready before sending it.' }
  }
  return null
}

/**
 * Why this issue cannot go to these sides of the list, or null when it can.
 *
 * The whole run stops rather than the empty copies being left out of it. An
 * issue with nothing to say to one side is a writer who marked a block wrongly,
 * and the fix is one edit; sending to the other side first and reporting the
 * gap afterwards turns that edit into a second issue, because the half that
 * went out cannot be recalled.
 *
 * The sides are the ones the run actually holds recipients for, so an issue
 * written for clients alone still goes out on a night when no prospect is owed
 * a copy.
 *
 * @param {{body?: Array}} issue
 * @param {string[]} audiences The sides the run is about to mail.
 * @returns {{status: number, error: string}|null}
 */
export function contentRefusal(issue, audiences) {
  const empty = (Array.isArray(audiences) ? audiences : []).filter(
    audience => !hasContentFor(issue?.body, audience)
  )
  if (empty.length === 0) return null
  const sides = empty.join(' and ')
  return {
    status: 409,
    error: `This issue has no blocks the ${sides} side can read, so that copy would arrive empty. Nothing was sent.`,
  }
}
