import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import SeriesMark from '@components/SeriesMark'
import { seriesNumber } from '@utils/articleLayout'

/**
 * The furniture an article page stands its controls and its commentary in.
 *
 * These are the pieces the reading frames are assembled from. Each one is
 * written once and placed twice - down a rail beside the text, or across a
 * deck above it - because the difference between the frames is where the
 * pieces sit, and a panel that knew which frame it was in would have to be
 * written twice to say the same thing.
 *
 * Nothing here holds state. The reading gauge and the contents list are told
 * where the reader is by the view, which measures it once for both.
 */

/**
 * A titled panel in the rail.
 *
 * The label is a paragraph rather than a heading: an article page already has
 * one h1 and a heading per section, and a rail that added six more would leave
 * the document outline describing the furniture instead of the piece. The
 * section carries the name for a screen reader instead.
 *
 * @param {{ label: string, note?: string, children: import('react').ReactNode }} props
 *   The panel's title, an optional figure set against it on the right, and the
 *   panel's contents.
 */
export function RailPanel({ label, note, children }) {
  return (
    <section aria-label={label} className="panel-static bg-surface-1 overflow-hidden">
      <header className="border-hair-paper flex items-baseline justify-between gap-3 border-b px-5 py-3.5">
        <p className="section-label-sm text-ink-paper">{label}</p>
        {note && (
          <span className="text-paper-faint font-mono text-[11px] tabular-nums">{note}</span>
        )}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

/**
 * The four figures a piece of writing can be measured by, under its headline.
 *
 * The word count is computed from the article rather than read off it, so it
 * is the one figure here that cannot be left behind by an edit.
 *
 * @param {{ post: object, words: number }} props - The article and its length.
 */
export function ArticleFigures({ post, words }) {
  const figures = [
    ['Category', post.category],
    ['Published', post.date],
    ['Read Time', post.readTime],
    ['Words', words.toLocaleString('en-US')],
  ]

  return (
    <dl className="article-figures">
      {figures.map(([label, value]) => (
        <div key={label}>
          <dt className="text-paper-faint section-label-sm">{label}</dt>
          <dd className="mt-2 text-[14px] font-medium leading-none text-ink-paper">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * How much of the article has gone by, and which section it is in.
 *
 * @param {{ progress: number, position: number, total: number }} props - The
 *   share of the body already scrolled past, from 0 to 1, and the reader's
 *   place in the article's sections.
 */
export function ReadingGauge({ progress, position, total }) {
  const percent = Math.round(progress * 100)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[28px] font-medium tabular-nums leading-none tracking-tight text-ink-paper">
          {percent}
          <span className="text-paper-faint ml-0.5 text-[15px]">%</span>
        </span>
        <span className="text-paper-faint font-mono text-[11px] tabular-nums">
          {position.toString().padStart(2, '0')} / {total.toString().padStart(2, '0')}
        </span>
      </div>
      <div
        className="article-gauge mt-3.5"
        role="progressbar"
        aria-label="How far through the article"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  )
}

/**
 * The article's sections, as somewhere to jump to and as a picture of what is
 * left. The entry being read is marked on the rule the list hangs from.
 *
 * @param {{ sections: Array<{ id: string, text: string, number: number }>,
 *   activeId: (string | null) }} props - The sections and the one being read.
 */
export function ArticleContents({ sections, activeId }) {
  return (
    <nav aria-label="Sections in this article" className="article-contents">
      {sections.map(section => (
        <a
          key={section.id}
          href={`#${section.id}`}
          data-active={section.id === activeId}
          className="article-jump text-[13px] leading-snug"
        >
          <span className="mt-[3px] font-mono text-[10px] tabular-nums opacity-60">
            {section.number.toString().padStart(2, '0')}
          </span>
          <span className="flex-1">{section.text}</span>
        </a>
      ))}
    </nav>
  )
}

/**
 * A line taken out of the body and set on its own.
 *
 * @param {{ quote: { text: string }, className?: string }} props - The pulled
 *   line, and the type sizing the frame sets it at.
 */
export function PulledLine({ quote, className = '' }) {
  return (
    <figure className={`article-quote pl-5 ${className}`}>
      <blockquote>{quote.text}</blockquote>
    </figure>
  )
}

/**
 * Where this article stands in its series, and what the rest of it is.
 *
 * The neighbours are numbered from the oldest article, which is the order the
 * series page numbers them in and the order somebody reading a series follows.
 * The data arrives newest first, so the position is read backwards out of it.
 *
 * @param {{ series: object, post: object, limit?: number }} props - The series,
 *   the article being read, and how many of its neighbours to name.
 */
export function SeriesStanding({ series, post, limit = 4 }) {
  const others = series.posts.filter(entry => entry.slug !== post.slug).slice(0, limit)

  return (
    <div>
      <Link
        to={`/blog/series/${series.slug}`}
        className="group flex items-start gap-3 transition-colors"
      >
        <SeriesMark mark={series.mark} className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          <span className="block text-[14px] font-semibold leading-snug text-ink-paper transition-colors group-hover:text-accent">
            {series.name}
          </span>
          <span className="text-paper-faint mt-1 block text-[12px] leading-snug">
            {series.tagline}
          </span>
        </span>
      </Link>

      {others.length > 0 && (
        <ul className="divide-hair-paper border-hair-paper mt-4 divide-y border-t">
          {others.map(entry => (
            <li key={entry.slug}>
              <Link
                to={`/blog/${entry.slug}`}
                className="group flex items-start gap-3 py-2.5 text-[13px] leading-snug text-paper-soft transition-colors hover:text-accent"
              >
                <span className="text-paper-faint mt-px font-mono text-[10px] tabular-nums">
                  {seriesNumber(series, entry.slug).toString().padStart(2, '0')}
                </span>
                <span className="flex-1">{entry.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        to={`/blog/series/${series.slug}`}
        className="section-label-sm group mt-4 inline-flex items-center gap-2 text-accent hover:text-[color:var(--accent-hi)]"
      >
        All {series.posts.length.toString().padStart(2, '0')} in the series
        <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </Link>
    </div>
  )
}

/**
 * What to read after this one.
 *
 * @param {{ posts: Array<object> }} props - The articles to offer, already
 *   chosen and ordered by the caller.
 */
export function ReadNext({ posts }) {
  return (
    <ul className="divide-hair-paper -my-1 divide-y">
      {posts.map(next => (
        <li key={next.slug}>
          <Link
            to={`/blog/${next.slug}`}
            className="group flex items-start gap-3 py-3 transition-colors"
          >
            <span className="flex-1">
              <span className="text-paper-faint section-label-sm flex items-center gap-2">
                <span className="text-accent">{next.category}</span>
                <span aria-hidden="true">·</span>
                <span>{next.readTime}</span>
              </span>
              <span className="mt-1.5 block text-[14px] font-semibold leading-snug text-ink-paper transition-colors group-hover:text-accent">
                {next.title}
              </span>
            </span>
            <ArrowUpRight className="text-paper-faint mt-1 h-3.5 w-3.5 shrink-0 transition-colors group-hover:text-accent" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
