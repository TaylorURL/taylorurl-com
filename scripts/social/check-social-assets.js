/**
 * Holds the card catalogue to the files the site actually serves, and to the
 * rule that no client is named.
 *
 * Buffer stores an asset as the URL it was handed and fetches it when the post
 * is due, which puts hours or weeks between a card going missing and anything
 * saying so. By then the post has failed on the account rather than on a branch.
 * So the catalogue and `public/social/` are checked against each other here,
 * where a mismatch costs a pull request instead of a day the account said
 * nothing.
 *
 * The second half is the rule the whole set is filtered by. The brand folder
 * holds cards naming a client outright — the site cards, the score dials, the
 * review quotes — and a card is one `cp` away from being in the catalogue. A
 * post naming a client publishes that client's business to an audience they did
 * not agree to be shown to, and a scheduled post is out of reach the moment it
 * publishes, so the guard belongs before the merge and not in anybody's memory.
 *
 *   npm run check:social-assets
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CARDS, landingFor } from '../../lib/social/cards.js'
import { PORTFOLIO_PROJECTS } from '../../src/app/data/portfolio.js'
import { STATIC_ROUTES } from '../../vite/site-routes.js'

const FOLDER = join(process.cwd(), 'public', 'social')

/**
 * The card families that name a client by construction.
 *
 * A `site-` card is a client's sector, town and address; a `speed-` card is
 * their name over their own scores; a `review-` card is a reviewer and the
 * business they wrote about. None of the three can be made safe by rewording
 * the alt text, so the prefix is refused rather than the wording checked.
 */
const FORBIDDEN_PREFIXES = ['site-', 'speed-', 'review-']

/** Instagram gives a 4:5 image the tallest frame in the feed. */
const RATIO = 1080 / 1350

/** How far from 4:5 a card may sit before Instagram would crop it. */
const RATIO_TOLERANCE = 0.01

const failures = []
let checks = 0

function check(what, ok) {
  checks += 1
  if (!ok) failures.push(what)
}

/**
 * A PNG's pixel dimensions, read off the IHDR chunk rather than decoded.
 *
 * The header is the first 24 bytes of every PNG and carries the two figures
 * this needs, so nothing has to be added to the tree to read them.
 */
function pngSize(path) {
  const head = readFileSync(path).subarray(0, 24)
  if (head.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) }
}

/**
 * Every way a reader would recognise a client in a string.
 *
 * The first word or two of a name is still the name, so a name is matched whole
 * and by its leading words. The host is matched with and without the extension,
 * because a card saying "smyrnatools" names the same business the address does.
 */
function clientTerms() {
  const terms = new Set()
  for (const project of PORTFOLIO_PROJECTS) {
    if (project.kind !== 'client') continue
    if (project.name) {
      terms.add(project.name.toLowerCase())
      const words = project.name.split(/\s+/)
      if (words.length > 1) terms.add(words.slice(0, 2).join(' ').toLowerCase())
    }
    if (project.displayUrl) {
      const host = project.displayUrl.toLowerCase()
      terms.add(host)
      terms.add(host.replace(/\.[a-z]+$/, ''))
    }
  }
  return [...terms].filter(term => term.length > 3)
}

const CLIENTS = clientTerms()

/**
 * The pages the site actually serves, which is what a card's destination is
 * held against. A link to a page that was renamed or never existed fails in
 * front of whoever tapped it, weeks after the post was written and with no
 * way to edit it.
 */
const SERVED = new Set(STATIC_ROUTES.map(route => route.path))

check('the folder the catalogue names exists', existsSync(FOLDER))

if (existsSync(FOLDER)) {
  const onDisk = readdirSync(FOLDER).filter(name => !name.startsWith('.'))
  const named = new Set(CARDS.map(one => one.file))

  for (const card of CARDS) {
    const path = join(FOLDER, card.file)
    check(`${card.key} is served from public/social`, existsSync(path))

    if (!existsSync(path)) continue
    const size = pngSize(path)
    check(`${card.key} is a PNG`, size !== null)
    if (!size) continue

    // A card cropped by Instagram is a card whose bottom line is gone, and the
    // wordmark sits on that line.
    const ratio = size.width / size.height
    check(
      `${card.key} is 4:5, and it is ${size.width}x${size.height}`,
      Math.abs(ratio - RATIO) < RATIO_TOLERANCE
    )
  }

  // A file nobody names is shipped on every deploy and posted by nothing. More
  // to the point, it is how a client card arrives in the folder unnoticed.
  for (const file of onDisk) {
    check(`${file} is a card the catalogue names`, named.has(file))
  }
}

for (const card of CARDS) {
  // Non-null in Buffer's schema, so a card without one cannot be posted at all,
  // and a card with an empty one is posted to everybody who cannot see it.
  check(`${card.key} carries alt text`, typeof card.alt === 'string' && card.alt.length > 20)

  check(
    `${card.key} is not from a family that names a client`,
    !FORBIDDEN_PREFIXES.some(prefix => card.key.startsWith(prefix))
  )

  const haystack = `${card.key} ${card.file} ${card.alt}`.toLowerCase()
  const named = CLIENTS.filter(term => haystack.includes(term))
  check(`${card.key} names no client, and it names ${named.join(', ')}`, named.length === 0)

  // A card with no destination is a card posted against the front door, which
  // is the arrangement that put a quarter of the site's traffic on a page
  // saying none of what the post said.
  const path = (card.to ?? '').split('#')[0]
  check(`${card.key} names the page it is about`, SERVED.has(path))

  // The tags are what make the answer readable a quarter from now. A card
  // whose link cannot be built is one whose posts go out untagged, and an
  // untagged arrival is filed as having come from nowhere.
  const landing = card.to ? landingFor(card, 'facebook') : ''
  check(
    `${card.key} builds a tagged link that keeps its fragment`,
    landing.includes(`utm_campaign=${card.key}`) &&
      landing.includes('utm_source=fb') &&
      (!card.to.includes('#') || landing.endsWith(`#${card.to.split('#')[1]}`))
  )
}

// A catalogue that emptied itself would pass every check above it.
check('the catalogue holds cards', CARDS.length > 0)
check('every card key is its own', new Set(CARDS.map(one => one.key)).size === CARDS.length)

if (failures.length) {
  for (const failure of failures) console.error(`social assets: ${failure}`)
  process.exit(1)
}

console.log(
  `social assets holds ${checks} checks: ${CARDS.length} cards served, 4:5, and naming no client`
)
