import { forwardRef, Fragment } from 'react'
import SeriesMark from '@components/marks/SeriesMark'
import { PulledLine } from '@components/article/ArticleControls'
import { sanitizeBlogHtml } from '@utils/sanitizeBlogHtml'
import '@components/article/article.css'

/**
 * The article's own text.
 *
 * Sections are numbered and ruled rather than simply set larger, so a reader
 * who has scrolled into the middle of a long piece can see where they are
 * without scrolling back to the heading, and so the contents list beside the
 * text has something in the page to point at.
 *
 * The heading ids come from the sections the frame measured rather than being
 * derived again here. Two headings in one article can reduce to the same id,
 * and an anchor that disagreed with the contents list would send half the
 * links in it to the wrong section.
 *
 * Every block carries its own leading rather than the column spacing them,
 * because a heading and a pulled line want a wider gap than two paragraphs do
 * and a single spacing rule on the column would win over both. The paragraph
 * directly under a heading is the exception in the other direction: given the
 * gap two paragraphs take, a heading floats between the section it closes and
 * the one it opens, so it is set closer to the text it introduces than that
 * text is to the paragraph after it.
 *
 * The element is handed back through a ref because the reading gauge measures
 * this box. The head above it and the footer below it are not the article, and
 * a gauge that counted them would read a third of the way through before the
 * first line.
 */
const ArticleBody = forwardRef(function ArticleBody(
  { post, sections, mark, quote, inlineQuote = false },
  ref
) {
  const sectionByBlock = new Map(sections.map(section => [section.block, section]))

  return (
    <div ref={ref} className="article-copy">
      {post.content.map((block, index) => {
        const pulled =
          inlineQuote && quote && quote.before === index ? (
            <PulledLine quote={quote} className="my-12 text-[20px] leading-[1.4] sm:text-[23px]" />
          ) : null
        const opensSection = !pulled && post.content[index - 1]?.type === 'h2'

        if (block.type === 'h2') {
          const section = sectionByBlock.get(index)
          return (
            <Fragment key={index}>
              {pulled}
              <h2
                id={section?.id}
                className="border-hair-paper mt-14 scroll-mt-16 border-t pt-7 text-[24px] font-semibold tracking-tight text-ink-paper first:mt-0 sm:text-[28px]"
              >
                <span className="section-label-sm mb-3.5 flex items-center gap-2.5 text-accent">
                  <SeriesMark mark={mark} className="h-3.5 w-3.5" />
                  <span className="font-mono tabular-nums">
                    {section ? section.number.toString().padStart(2, '0') : ''}
                  </span>
                </span>
                {block.text}
              </h2>
            </Fragment>
          )
        }

        return (
          <Fragment key={index}>
            {pulled}
            <p
              className={
                index === 0
                  ? 'text-[18px] leading-[1.62] text-ink-paper sm:text-[19px]'
                  : `text-[17px] leading-[1.65] text-paper-soft ${opensSection ? 'mt-4' : 'mt-6'}`
              }
              dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(block.text) }}
            />
          </Fragment>
        )
      })}
    </div>
  )
})

export default ArticleBody
