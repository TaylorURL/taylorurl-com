import { Link } from 'react-router-dom'
import { m } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { fadeInUp } from '@constants/animations'
import { PUBLIC } from '../../../../lib/mail/audience.js'
import { blocksFor } from '../../../../lib/mail/issues.js'

/*
 * The web rendering of an issue's blocks.
 *
 * The same six block types the email template draws, given the typography and
 * motion a browser can hold: a reading measure, reveals on scroll, and links
 * that behave like links. The two renderers share the data and nothing else.
 *
 * Sections are ruled and numbered the way `@components/ArticleBody` rules and
 * numbers them, because a reader who meets a long piece of writing on this site
 * meets it in one language whichever page it was published on.
 *
 * The archive is open, so it draws the unmarked blocks alone. A block written
 * for one side of the list addresses a reader the page does not have, and this
 * is the same filter the send runs, asked for an audience no block can be
 * marked with.
 */

/** A site path, an absolute web address, or nothing. */
function safeHref(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  if (raw.startsWith('/')) return raw
  if (/^(https?:|mailto:)/i.test(raw)) return raw
  return null
}

const BUTTON = 'btn btn-primary group'

function Heading({ block, number }) {
  if (block.level === 3) {
    return (
      <m.div {...fadeInUp} className="pt-2">
        <h3 className="text-[19px] font-semibold tracking-tight text-ink-paper sm:text-[21px]">
          {block.text}
        </h3>
      </m.div>
    )
  }

  return (
    <m.div {...fadeInUp} className="border-hair-paper border-t pt-7">
      <h2 className="text-[24px] font-semibold tracking-tight text-ink-paper sm:text-[28px]">
        <span className="section-label-sm mb-3.5 block font-mono tabular-nums text-accent">
          {String(number).padStart(2, '0')}
        </span>
        {block.text}
      </h2>
    </m.div>
  )
}

function Paragraph({ block }) {
  return (
    <m.p {...fadeInUp} className="text-[17px] leading-[1.65] text-paper-soft">
      {block.text}
    </m.p>
  )
}

/**
 * Dimensions come through as attributes as well as classes, so the space an
 * image will take is reserved before it arrives and the paragraph beneath it
 * does not jump.
 */
function Figure({ block }) {
  const src = safeHref(block.src)
  if (!src) return null
  return (
    <m.figure {...fadeInUp} className="edge overflow-hidden">
      <img
        src={src}
        alt={block.alt || ''}
        width={block.width || undefined}
        height={block.height || undefined}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full"
      />
      {block.alt && (
        <figcaption className="border-hair-paper text-paper-faint section-label-sm border-t px-4 py-3">
          {block.alt}
        </figcaption>
      )}
    </m.figure>
  )
}

function Button({ block }) {
  const href = safeHref(block.href)
  const label = block.text
  if (!href || !label) return null
  const arrow = (
    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
  )
  return (
    <m.div {...fadeInUp} className="pt-2">
      {href.startsWith('/') ? (
        <Link to={href} className={BUTTON}>
          {label}
          {arrow}
        </Link>
      ) : (
        <a href={href} className={BUTTON} rel="noopener noreferrer" target="_blank">
          {label}
          {arrow}
        </a>
      )}
    </m.div>
  )
}

function Divider() {
  return (
    <m.div {...fadeInUp} className="flex items-center gap-3 py-4" aria-hidden="true">
      <span className="h-px w-8 bg-accent" />
      <span className="h-px flex-1 bg-[color:var(--paper-hairline)]" />
    </m.div>
  )
}

function List({ block }) {
  const items = Array.isArray(block.items) ? block.items : []
  if (items.length === 0) return null
  const Tag = block.ordered ? 'ol' : 'ul'
  return (
    <m.div {...fadeInUp}>
      <Tag
        className={`space-y-3 pl-6 text-[17px] leading-[1.65] text-paper-soft ${
          block.ordered ? 'list-decimal' : 'list-disc'
        } marker:text-accent`}
      >
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </Tag>
    </m.div>
  )
}

const BLOCKS = {
  heading: Heading,
  paragraph: Paragraph,
  image: Figure,
  button: Button,
  divider: Divider,
  list: List,
}

/**
 * @param {object} props
 * @param {Array<object>} [props.body] - The issue's ordered blocks.
 */
export default function IssueBody({ body }) {
  const blocks = blocksFor(body, PUBLIC)
  // Numbered over the blocks the page actually draws, so a section keeps the
  // number a reader can count to rather than the one it held in the draft.
  let section = 0

  return (
    <div className="space-y-6">
      {blocks.map((block, index) => {
        const Block = block && BLOCKS[block.type]
        if (!Block) return null
        if (block.type === 'heading' && block.level !== 3) section += 1
        return <Block key={index} block={block} number={section} />
      })}
    </div>
  )
}
