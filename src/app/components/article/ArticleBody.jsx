import { Prose } from '@components/kit/Kit'
import { sanitizeBlogHtml } from '@utils/sanitizeBlogHtml'

/**
 * The article's own text, set in the kit's reading type.
 *
 * The heading ids come from the sections the page measured rather than being
 * derived again here. Two headings in one article can reduce to the same id,
 * and an anchor that disagreed with a link into the piece would send it to the
 * wrong section.
 *
 * @param {{ post: object, sections: Array<{ id: string, block: number }> }} props
 *   The article, and the sections its headings open.
 */
export default function ArticleBody({ post, sections }) {
  const idOf = new Map(sections.map(section => [section.block, section.id]))

  return (
    <Prose>
      {post.content.map((block, index) => {
        if (block.type === 'h2') {
          return (
            <h2 key={index} id={idOf.get(index)} className="scroll-mt-24">
              {block.text}
            </h2>
          )
        }
        return (
          <p
            key={index}
            className={index === 0 ? '!mt-0' : undefined}
            dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(block.text) }}
          />
        )
      })}
    </Prose>
  )
}
