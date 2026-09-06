/**
 * Ranks the site's pages against what a reader has typed.
 *
 * The order rows come back in is the whole of whether a search box is worth
 * having. A box that returns every page containing the word has handed back a
 * list; the reader still has to do the finding, and doing it in a six-row
 * dropdown is worse than doing it in the menu they already know. So the
 * scoring is about which page the word was most likely meant to name, not
 * about how many times it appears.
 *
 * The expensive failure is the near-miss ordering: a town page outranking the
 * service the reader was actually after, because the town's summary happens to
 * repeat the service's name more often than the service's own page does. It
 * looks like the search works, and it sends somebody to the wrong page while
 * they believe they were shown the right one.
 */

// Everything is compared folded: lowercase, with runs of punctuation and
// spacing treated as one break. A reader typing "seo" must reach "SEO", and a
// reader typing "e-commerce" must reach "ecommerce".
const BREAK = /[^a-z0-9]+/g
// The same class as one character, without the global flag. A global regex
// carries `lastIndex` between calls, so reusing BREAK for a single-character
// test would have it answer differently on alternating rows.
const IS_BREAK = /[^a-z0-9]/

const fold = value => String(value ?? '').toLowerCase()

const termsOf = query => fold(query).split(BREAK).filter(Boolean)

// A term scores against the field it was found in and against how much of that
// field it accounts for: the whole field beats its opening word beats any word
// beats something buried mid-word. A name always outscores a summary however
// well the summary matches -- a page is named for what it is and described for
// what it does, so the name is the stronger statement of the two.
const LABEL = { whole: 140, leads: 80, word: 60, inside: 40 }
// The word the address uses, which is routinely not a word on the page. The
// care page is titled Keeping It Running and lives at /services/care; the SEO
// page is titled Getting Found on Google and lives at /services/seo. A reader
// typing either slug has named the page as exactly as anyone can, and without
// this both of them came back with nothing but articles.
const SLUG = { whole: 100, leads: 50, word: 40, inside: 20 }
const KEYWORD = { whole: 30, leads: 24, word: 20, inside: 16 }
const SUMMARY = { whole: 14, leads: 12, word: 10, inside: 8 }
const SECTION = 6

// A field scores once, at its strongest position, rather than once per
// occurrence. Counting occurrences rewards a long summary for being long.
const scoreField = (field, term, tier) => {
  const at = field.indexOf(term)
  if (at < 0) return 0
  if (at === 0) return field.length === term.length ? tier.whole : tier.leads
  // A hit that starts a word is what a reader typing a partial name means; one
  // that starts mid-word is usually a coincidence of spelling.
  return IS_BREAK.test(field[at - 1]) ? tier.word : tier.inside
}

const scoreTerm = (entry, term) => {
  const name = scoreField(fold(entry.label), term, LABEL)
  if (name) return name

  const slug = scoreField(fold(entry.slug), term, SLUG)
  if (slug) return slug

  const keyword = (entry.keywords || []).reduce(
    (best, word) => Math.max(best, scoreField(fold(word), term, KEYWORD)),
    0
  )
  if (keyword) return keyword

  const summary = scoreField(fold(entry.summary), term, SUMMARY)
  if (summary) return summary

  return fold(entry.section).includes(term) ? SECTION : 0
}

/**
 * Scores one entry. Every term the reader typed has to land somewhere on the
 * entry or it scores nothing: two words are a narrowing, and an entry matching
 * only one of them is not what was asked for.
 */
export function scoreEntry(entry, query) {
  const terms = termsOf(query)
  if (!terms.length) return 0

  let total = 0
  for (const term of terms) {
    const hit = scoreTerm(entry, term)
    if (!hit) return 0
    total += hit
  }

  // The typed phrase landing whole in the name is the strongest thing a reader
  // can say, and term-by-term scoring cannot see it: "new website" scores the
  // same against New Website as against a page holding both words apart.
  const phrase = fold(query).trim()
  if (phrase.includes(' ') && fold(entry.label).includes(phrase)) total += LABEL.whole

  // Between two entries the query fits equally well, the shorter name is the
  // more specific answer.
  return total + Math.max(0, 40 - fold(entry.label).length)
}

/**
 * The ranked rows for a query, best first, capped. Entries are expected in
 * `{ id, kind, section, label, slug, summary, to, href, keywords }` shape; `weight`
 * on an entry is a standing nudge for a kind of page, applied to every query
 * rather than to a particular one.
 */
export function rankEntries(entries, query, limit = 8) {
  if (!termsOf(query).length) return []

  // The weight is added after the entry has earned a place, never before. Added
  // first it is a score of its own, and every page carrying one comes back for
  // every query -- a list where the top row answers what was typed and the
  // seven under it are whatever the site thinks is important reads as a search
  // that half worked, which is worse than one that plainly found nothing.
  const scored = []
  for (const entry of entries) {
    const score = scoreEntry(entry, query)
    if (score > 0) scored.push({ entry, score: score + (entry.weight || 0) })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
    .slice(0, limit)
    .map(row => row.entry)
}

/**
 * Splits a label around the part the query matched, so a row can show why it
 * is in the list. A list that cannot say what it matched on reads as a guess,
 * and the reader checks every row rather than trusting the first.
 */
export function splitMatch(text, query) {
  const source = String(text ?? '')
  const folded = fold(source)
  const phrase = fold(query).trim()

  // The whole phrase if it landed, otherwise the longest single term that did:
  // marking the shortest one lights an "a" in the middle of a word and says
  // nothing about why the row is here.
  const found = [phrase, ...termsOf(query).sort((a, b) => b.length - a.length)]
    .filter(Boolean)
    .map(candidate => ({ candidate, at: folded.indexOf(candidate) }))
    .find(({ at }) => at >= 0)

  if (!found) return { before: source, hit: '', after: '' }

  return {
    before: source.slice(0, found.at),
    hit: source.slice(found.at, found.at + found.candidate.length),
    after: source.slice(found.at + found.candidate.length),
  }
}
