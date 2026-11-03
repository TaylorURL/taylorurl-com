/**
 * The outline of an article, worked out from the article itself: the sections
 * its headings open, each with an address a link can point at, and how many
 * words it runs to.
 *
 * Every figure here is a pure function of the article, never of the clock or a
 * random draw. The pages are prerendered at build time and hydrated in the
 * browser, and an anchor that came out differently between the two would break
 * every link into the piece.
 */

const TAG = /<[^>]*>/g

/**
 * The words of a block with its emphasis markup taken out.
 *
 * Blog blocks are authored as small HTML strings, so anything that measures one
 * has to read past the tags rather than through them.
 *
 * @param {string} html - A block's raw text.
 * @returns {string} The same text with tags removed and whitespace collapsed.
 */
function plainText(html) {
  return html.replace(TAG, '').replace(/\s+/g, ' ').trim()
}

/**
 * The fragment a heading answers to.
 *
 * @param {string} text - The heading exactly as the article writes it.
 * @returns {string} A lowercase hyphenated id.
 */
function anchorId(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The article's sections, in the order they are read.
 *
 * Two headings in one article can reduce to the same id - "The Bottom Line"
 * twice, or two headings that differ only in punctuation - and a duplicate id
 * sends every link to the first of them. The suffix is applied to the later
 * one so the earlier heading keeps the clean fragment, which is the one likely
 * to be linked from outside.
 *
 * @param {{ content: Array<{ type: string, text: string }> }} post - The article.
 * @returns {Array<{ id: string, text: string, block: number }>} One entry per
 *   h2, carrying its anchor and the index of the block it came from.
 */
function articleSections(post) {
  const taken = new Map()
  const sections = []

  post.content.forEach((block, index) => {
    if (block.type !== 'h2') return
    const base = anchorId(block.text)
    const seen = taken.get(base) || 0
    taken.set(base, seen + 1)
    sections.push({ id: seen === 0 ? base : `${base}-${seen + 1}`, text: block.text, block: index })
  })

  return sections
}

/**
 * How many words the article runs to.
 *
 * The read time on a post is written by hand when it is published, so this is
 * the one length figure the page can state without trusting that somebody
 * updated a string after editing the piece.
 *
 * @param {{ content: Array<{ text: string }> }} post - The article.
 * @returns {number} The word count of the body.
 */
function articleWords(post) {
  return post.content.reduce((total, block) => {
    const words = plainText(block.text)
    return total + (words ? words.split(' ').length : 0)
  }, 0)
}

/**
 * Everything the article page needs to draw itself, measured once.
 *
 * @param {object} post - The article.
 * @returns {{ sections: Array<object>, words: number }}
 */
export function articleFrame(post) {
  return { sections: articleSections(post), words: articleWords(post) }
}
