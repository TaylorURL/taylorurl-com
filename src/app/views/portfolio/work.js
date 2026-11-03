/**
 * How a portfolio entry is named on a card, shared by the portfolio, the trade
 * pages and the town pages so one site reads the same wherever it is shown.
 *
 * Kept apart from the views so each view file exports nothing but its
 * component, which is what lets the dev server swap it in place on an edit.
 */

/** The trade, as the first half of the portfolio's tagline names it. */
export function tradeOf(project) {
  return project.tagline.split('·')[0].trim()
}

/**
 * Where the work is: the town, or the city its location names. A studio
 * product is said to be one rather than placed somewhere, so it is never read
 * as a client engagement, and a site the portfolio places nowhere gets no
 * place rather than a guess.
 */
export function placeOf(project) {
  if (project.kind === 'product') return 'Studio product'
  return project.town ?? project.location?.split(',')[0].trim() ?? null
}

/** The small line under a card's name: what and where. */
export function detailOf(project) {
  return [tradeOf(project), placeOf(project)].filter(Boolean).join(' · ')
}

/** Where a client site leads: its case study if it has one, the portfolio if not. */
export function studyHref(project) {
  return project.hasStudy ? `/portfolio/${project.slug}` : '/portfolio'
}

/**
 * The facts every trade and town page opens beside: how long a site takes and
 * what comes after launch, as the home page and the about page state them.
 */
export const LAUNCH_FACTS = [
  { label: 'From first call to live', value: 'Two to four weeks' },
  { label: 'After launch', value: 'Hosting, updates and same-day changes' },
]

/**
 * A written heading as a section or a card sets it: without the full stop,
 * the way the home page's section headings stand. Page titles keep theirs.
 */
export function asHeading(title) {
  return title.replace(/\.$/, '')
}

/**
 * A heading written in title case, set in sentence case the way every other
 * heading on the site is: "The Claim, Step by Step" as "The claim, step by
 * step". An acronym keeps its capitals, so "IDX Search" stays "IDX search".
 */
export function sentenceCase(title) {
  return title
    .split(' ')
    .map((word, index) => {
      if (word.length > 1 && word === word.toUpperCase()) return word
      const lower = word.toLowerCase()
      return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower
    })
    .join(' ')
}

/** A list of names as a sentence says it: "A", "A and B", "A, B and C". */
export function joinNames(names) {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
