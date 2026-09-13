/**
 * The frame an article is read in, worked out from the article itself.
 *
 * Thirty-three posts rendered through one template is thirty-three visits to
 * the same page with the words swapped, and a reader following a series meets
 * that page four times in a row. So the frame is chosen per post, from the
 * thing that actually differs between them: how many sections the piece
 * carries. A long piece with a spine of headings has somewhere for a contents
 * rail to point and earns the two-column frame; a three-heading piece does
 * not, and a rail beside it is a column of white space next to a column of
 * text, so its controls run across the top instead and the text keeps the
 * full measure.
 *
 * Every choice here is a pure function of the article, never of the clock or
 * a random draw. The pages are prerendered at build time and hydrated in the
 * browser, and a frame that disagreed between the two would swap layouts under
 * the reader on the first paint.
 */

/** A wide column of text with the controls standing to its right. */
export const RAIL_RIGHT = 'rail-right'

/** The same frame mirrored, which is what keeps the blog from reading as one page. */
export const RAIL_LEFT = 'rail-left'

/** One column at full measure, with the controls laid across the top. */
export const DECK = 'deck'

/** Under this many sections there is not enough spine to hang a rail on. */
const RAIL_MIN_SECTIONS = 4

/** How often a rail stands on the left, out of five. */
const LEFT_IN_FIVE = 2

/** The length a pulled line has to fall inside to stand on its own. */
const QUOTE_MIN_CHARS = 58
const QUOTE_MAX_CHARS = 190

const TAG = /<[^>]*>/g
const EMPHASIS = /<strong>([\s\S]*?)<\/strong>/g
const SENTENCE_BREAK = /(?<=[.?!])\s+/

/**
 * The words of a block with its emphasis markup taken out.
 *
 * Blog blocks are authored as small HTML strings, so anything that measures or
 * quotes one has to read past the tags rather than through them.
 *
 * @param {string} html - A block's raw text.
 * @returns {string} The same text with tags removed and whitespace collapsed.
 */
function plainText(html) {
  return html.replace(TAG, '').replace(/\s+/g, ' ').trim()
}

/**
 * A stable number for a slug.
 *
 * One choice in here has nothing in the article to make it on - which side the
 * rail stands on - and it still has to come out the same on every render. This
 * is the ordinary string hash, kept unsigned so the modulo below cannot land
 * on a negative index.
 *
 * @param {string} slug - The article's slug.
 * @returns {number} A non-negative integer, stable for that slug.
 */
function slugSeed(slug) {
  let seed = 0
  for (let index = 0; index < slug.length; index += 1) {
    seed = (seed * 31 + slug.charCodeAt(index)) >>> 0
  }
  return seed
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
 * @returns {Array<{ id: string, text: string, number: number, block: number }>}
 *   One entry per h2, carrying its anchor, its position in the article's own
 *   numbering, and the index of the block it came from.
 */
function articleSections(post) {
  const taken = new Map()
  const sections = []

  post.content.forEach((block, index) => {
    if (block.type !== 'h2') return
    const base = anchorId(block.text)
    const seen = taken.get(base) || 0
    taken.set(base, seen + 1)
    sections.push({
      id: seen === 0 ? base : `${base}-${seen + 1}`,
      text: block.text,
      number: sections.length + 1,
      block: index,
    })
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
 * The line the frame pulls out of the body and sets beside it.
 *
 * A pulled line is a teaser, so it is taken from further down the article than
 * the place it is set: the candidates all sit past the second section, and the
 * aside stands at the end of the first. Set beside the paragraph it came from
 * it would read as a stutter rather than a pull.
 *
 * The sentences the author emphasised are taken first, because that marking is
 * the only thing in the data that says a line carries the point. Roughly half
 * the articles emphasise nothing, so the second pass reads whole sentences off
 * the paragraphs instead, which is the ordinary editorial pick. Either way the
 * line has to be long enough to stand up on its own and has to end where a
 * sentence ends, and of the ones that qualify the frame takes whichever sits
 * nearest the middle of the piece.
 *
 * @param {{ content: Array<{ type: string, text: string }> }} post - The article.
 * @param {Array<{ block: number }>} sections - The article's sections.
 * @returns {{ text: string, block: number, before: number } | null} The line,
 *   the block it was taken from, and the block index the aside stands in front
 *   of. Nothing where no sentence in the article qualifies.
 */
function articleQuote(post, sections) {
  // Both the line and the place it stands are read off the second section, so
  // an article without one has nowhere to put an aside and gets none.
  if (sections.length < 2) return null

  const opening = sections[1].block
  const middle = (post.content.length - 1) / 2
  let emphasised = null
  let plain = null

  const offer = (text, index) => {
    if (text.length < QUOTE_MIN_CHARS || text.length > QUOTE_MAX_CHARS) return null
    if (!/[.?!]$/.test(text)) return null
    return { text, block: index, distance: Math.abs(index - middle) }
  }

  const keep = (held, candidate) =>
    candidate && (!held || candidate.distance < held.distance) ? candidate : held

  post.content.forEach((block, index) => {
    if (block.type !== 'p' || index <= opening) return

    for (const match of block.text.matchAll(EMPHASIS)) {
      emphasised = keep(emphasised, offer(plainText(match[1]), index))
    }

    for (const sentence of plainText(block.text).split(SENTENCE_BREAK)) {
      plain = keep(plain, offer(sentence.trim(), index))
      if (plain && plain.block === index) break
    }
  })

  const picked = emphasised || plain
  return picked ? { text: picked.text, block: picked.block, before: opening } : null
}

/**
 * Which of the three frames this article is read in.
 *
 * @param {{ slug: string }} post - The article.
 * @param {number} sectionCount - How many sections it carries.
 * @returns {string} One of the frame constants above.
 */
function articleLayout(post, sectionCount) {
  if (sectionCount < RAIL_MIN_SECTIONS) return DECK
  return slugSeed(post.slug) % 5 < LEFT_IN_FIVE ? RAIL_LEFT : RAIL_RIGHT
}

/**
 * Everything the article page needs to draw itself, measured once.
 *
 * The view reads the frame from here rather than working any of it out inline,
 * because the sections are needed in three places at once - the body's
 * anchors, the contents list, and the reading gauge - and measuring them three
 * times is three chances for the three to disagree.
 *
 * @param {object} post - The article.
 * @returns {{ layout: string, sections: Array<object>, words: number,
 *   quote: ({ text: string, block: number } | null), railed: boolean }}
 */
export function articleFrame(post) {
  const sections = articleSections(post)
  const layout = articleLayout(post, sections.length)
  return {
    layout,
    sections,
    words: articleWords(post),
    quote: articleQuote(post, sections),
    railed: layout !== DECK,
  }
}

/**
 * Which article this is in its series, counting from the oldest.
 *
 * The series data arrives newest first, because that is the order the blog
 * lists everything in, while a series is read the way it was written. The
 * series page numbers its entries this way as well, and the two have to agree
 * or an article is the fifth in one place and the fourth in another.
 *
 * @param {{ posts: Array<{ slug: string }> }} series - The series.
 * @param {string} slug - The article's slug.
 * @returns {number} Its number in the series, or 0 where it is not in one.
 */
export function seriesNumber(series, slug) {
  const place = series.posts.findIndex(entry => entry.slug === slug)
  return place < 0 ? 0 : series.posts.length - place
}

/**
 * The article's standing in its series, as a figure for a panel head.
 *
 * @param {object} series - The series.
 * @param {{ slug: string }} post - The article being read.
 * @returns {string} The article's number against the length of the series.
 */
export function seriesNote(series, post) {
  const total = series.posts.length
  return `${seriesNumber(series, post.slug).toString().padStart(2, '0')} / ${total.toString().padStart(2, '0')}`
}
