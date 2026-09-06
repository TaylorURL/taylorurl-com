import { ChevronDown } from 'lucide-react'
import ShareBar from '@components/ShareBar'
import {
  ArticleContents,
  PulledLine,
  RailPanel,
  ReadNext,
  ReadingGauge,
  SeriesStanding,
} from '@components/ArticleControls'
import { seriesNote } from '@utils/articleLayout'

/**
 * The two arrangements an article's controls are put in.
 *
 * A rail is for a piece with a spine of sections: the gauge and the contents
 * stand beside the text and stay with the reader, and the commentary - the
 * pulled line, where the piece sits in its series, what to read next - flows
 * down the column after them. A deck is for a short piece, where a rail beside
 * four hundred words is a column of white space: the same controls run across
 * the top instead and the text keeps the full measure underneath.
 *
 * Which one an article gets is decided in `articleLayout`, from the article.
 */

/**
 * The controls and commentary standing beside the text.
 *
 * Only the gauge and the contents are pinned. The rest is as long as the
 * article's series and its shelf of related pieces make it, and a rail pinned
 * whole would have its foot cut off by any viewport shorter than the sum of
 * its panels.
 *
 * The pinned pair travels inside a box that takes whatever height the
 * commentary leaves it. A pinned panel still holds its place in the column, so
 * one held at the top of the viewport descends through everything laid out
 * under it: the pulled line, the series and the shelf of related pieces all
 * pass up behind the gauge and are cut in half by its edge on the way. Given a
 * box of its own the pair travels the length of the article and lifts away as
 * the commentary arrives, which leaves what to read next at the foot of the
 * rail, beside the end of the piece it follows.
 *
 * The pinned pair is also the part that has no meaning on a phone, where the
 * rail has been folded under the article: a gauge below the text it measures
 * reads full whatever the reader did, and the contents have already been
 * carried up above the text as a deck. What is left standing there is the
 * commentary, which is worth reading at the end of a piece.
 *
 * @param {{ post: object, series: (object | null), sections: Array<object>,
 *   reading: { progress: number, activeId: (string | null), activeIndex: number },
 *   quote: (object | null), related: Array<object>, className?: string }} props
 *   - The article, its series and sections, where the reader has got to, the
 *   line pulled out of the body, what to read next, and which side of the text
 *   the rail stands on. The rail is the grid cell rather than something inside
 *   one, because a pinned panel can only travel as far as its own container: a
 *   rail wrapped in a box its own height would unpin the moment its last panel
 *   ended, halfway down the article.
 */
export function ArticleRail({ post, series, sections, reading, quote, related, className = '' }) {
  return (
    <aside className={`flex flex-col gap-4 ${className}`}>
      <div className="hidden flex-1 lg:block">
        <div className="space-y-4 lg:sticky lg:top-[calc(var(--nav-height)+0.5rem)]">
          <RailPanel label="Reading" note={post.readTime}>
            <ReadingGauge
              progress={reading.progress}
              position={sections.length ? reading.activeIndex + 1 : 0}
              total={sections.length}
            />
            <div className="border-hair-paper mt-5 border-t pt-4">
              <ArticleContents sections={sections} activeId={reading.activeId} />
            </div>
          </RailPanel>

          <RailPanel label="Share">
            <ShareBar title={post.title} path={`/blog/${post.slug}`} compact />
          </RailPanel>
        </div>
      </div>

      {quote && (
        <RailPanel label="From the Piece">
          <PulledLine quote={quote} className="text-[15px] leading-[1.45]" />
        </RailPanel>
      )}

      {series && (
        <RailPanel label="Series" note={seriesNote(series, post)}>
          <SeriesStanding series={series} post={post} />
        </RailPanel>
      )}

      {related.length > 0 && (
        <RailPanel label={series ? 'More from the Series' : 'Read Next'}>
          <ReadNext posts={related} />
        </RailPanel>
      )}
    </aside>
  )
}

/**
 * The controls laid across the top of the text instead of beside it.
 *
 * It carries the contents and nothing else. Both frames already end the
 * article with a share row, and a second one in a control block a phone has to
 * scroll past to reach the first paragraph is furniture charged twice.
 *
 * It opens and closes because eight sections listed on a phone is most of the
 * first screen, and a reader who has just tapped an article wants the article.
 * A decked one is opened by the frame instead, where the list is short and is
 * the only navigation the page has.
 *
 * The list inside is the same one the rail carries rather than a row of chips,
 * so a reader who meets both frames meets one contents list drawn one way, and
 * so the eight sections of a long piece fold onto a phone without a row that
 * has to be dragged sideways to be read.
 *
 * @param {{ sections: Array<object>, activeId: (string | null),
 *   open?: boolean, className?: string }} props - The article's sections, the
 *   section being read, and whether the deck stands open.
 */
export function ArticleDeck({ sections, activeId, open = false, className = '' }) {
  return (
    <details
      open={open}
      aria-label="Article controls"
      className={`article-deck panel-static bg-surface-1 overflow-hidden ${className}`}
    >
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-3.5">
        <span className="section-label-sm text-ink-paper">Contents</span>
        <span className="text-paper-faint flex items-center gap-3 font-mono text-[11px] tabular-nums">
          {sections.length.toString().padStart(2, '0')} sections
          <ChevronDown className="article-deck-mark h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </summary>

      <div className="px-5 py-4">
        <ArticleContents sections={sections} activeId={activeId} />
      </div>
    </details>
  )
}

/**
 * The reading bar a decked article carries instead of a rail.
 *
 * It is the one control on that frame that has to stay with the reader, so it
 * is the only thing pinned: a whole deck pinned to the top of a four-hundred
 * word article would take a sixth of the screen the article is being read on,
 * and every jump from its own contents would land the heading underneath it.
 *
 * At the narrowest width the bar holds five things across a phone's measure,
 * so the gutters between them close before the gauge does: the gauge is the
 * one part that has to stay long enough to be read as a length.
 *
 * @param {{ reading: { progress: number, activeIndex: number },
 *   sections: Array<object>, className?: string }} props - Where the reader has
 *   got to, how many sections there are to get through, and where the frame
 *   stands the bar.
 */
export function ArticleStatus({ reading, sections, className = '' }) {
  const percent = Math.round(reading.progress * 100)

  return (
    <div
      className={`panel-static bg-surface-1 sticky top-[calc(var(--nav-height)+0.5rem)] z-[var(--z-sticky)] flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 ${className}`}
    >
      <p className="section-label-sm text-ink-paper">Reading</p>
      <div
        className="article-gauge flex-1"
        role="progressbar"
        aria-label="How far through the article"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ transform: `scaleX(${reading.progress})` }} />
      </div>
      <span className="text-paper-faint font-mono text-[11px] tabular-nums">{percent}%</span>
      <span className="bg-hair-paper h-3 w-px" aria-hidden="true" />
      <span className="text-paper-faint font-mono text-[11px] tabular-nums">
        {(reading.activeIndex + 1).toString().padStart(2, '0')} /{' '}
        {sections.length.toString().padStart(2, '0')}
      </span>
    </div>
  )
}
