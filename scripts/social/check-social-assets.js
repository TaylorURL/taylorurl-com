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
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { CARDS, LIBRARY, landingFor } from '../../lib/social/cards.js'
import { PORTFOLIO_PROJECTS } from '../../src/app/data/portfolio.js'
import {
  AREA_ROUTES,
  BLOG_ROUTES,
  BLOG_SERIES_ROUTES,
  INDUSTRY_ROUTES,
  STATIC_ROUTES,
  TOOL_ROUTES,
} from '../../vite/site-routes.js'
import { cases, check, finish } from '../harness/checks.js'

const FOLDER = join(process.cwd(), 'public', 'social')
const LIBRARY_FOLDER = join(FOLDER, 'library')

/** A reel is 9:16; anything else is letterboxed or cropped in the feed. */
const VERTICAL = 1080 / 1920

/**
 * Facebook and Instagram take far larger video, but Buffer fetches the file
 * from the site when the post is due and the site ships it on every deploy, so
 * a reel is held to a size that costs neither anything.
 */
const MAX_VIDEO_BYTES = 8 * 1024 * 1024

/** Google takes a single still through Buffer, and nothing else. */
const STILL_ONLY = new Set(['googlebusiness'])
const SERVICES = new Set(['facebook', 'instagram', 'googlebusiness'])

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
const SERVED = new Set(
  [STATIC_ROUTES, BLOG_ROUTES, BLOG_SERIES_ROUTES, INDUSTRY_ROUTES, AREA_ROUTES, TOOL_ROUTES]
    .flat()
    .map(route => route.path)
)

check('the folder the catalogue names exists', existsSync(FOLDER))

if (existsSync(FOLDER)) {
  const onDisk = readdirSync(FOLDER).filter(
    name => !name.startsWith('.') && !statSync(join(FOLDER, name)).isDirectory()
  )
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

// The generated library, held to the same rules and to the ones a carousel and a
// reel add: every slide and every poster 4:5 or 9:16 as its kind says, every
// video small enough to ship, and nothing Google cannot take offered to it.
const generated = LIBRARY.filter(entry => entry.generated)
const libraryNamed = new Set()
for (const entry of generated) {
  check(
    `${entry.key} is an image, a carousel or a video`,
    ['image', 'carousel', 'video'].includes(entry.kind)
  )
  check(
    `${entry.key} names its format`,
    typeof entry.format === 'string' && entry.format.length > 0
  )
  check(`${entry.key} names its files`, Array.isArray(entry.files) && entry.files.length > 0)
  if (entry.kind === 'carousel') {
    check(
      `${entry.key} is a carousel of 2 to 10 slides`,
      entry.files.length >= 2 && entry.files.length <= 10
    )
  } else {
    check(`${entry.key} is one file`, entry.files.length === 1)
  }
  check(
    `${entry.key} goes only to channels the queue knows`,
    Array.isArray(entry.channels) &&
      entry.channels.length > 0 &&
      entry.channels.every(name => SERVICES.has(name))
  )
  if (entry.kind !== 'image') {
    check(
      `${entry.key} is not offered to a channel that takes a still alone`,
      !entry.channels.some(name => STILL_ONLY.has(name))
    )
  }

  const stills = entry.kind === 'video' ? [entry.poster].filter(Boolean) : entry.files
  if (entry.kind === 'video') {
    check(`${entry.key} carries a poster`, typeof entry.poster === 'string')
    const path = join(LIBRARY_FOLDER, entry.files[0])
    check(`${entry.key} is served from public/social/library`, existsSync(path))
    check(`${entry.key} is an MP4`, entry.files[0].endsWith('.mp4'))
    if (existsSync(path)) {
      const bytes = statSync(path).size
      check(
        `${entry.key} is under ${MAX_VIDEO_BYTES} bytes, and it is ${bytes}`,
        bytes <= MAX_VIDEO_BYTES
      )
    }
    libraryNamed.add(entry.files[0])
  }
  for (const file of stills) {
    libraryNamed.add(file)
    const path = join(LIBRARY_FOLDER, file)
    check(`${entry.key}: ${file} is served from public/social/library`, existsSync(path))
    if (!existsSync(path)) continue
    const size = pngSize(path)
    check(`${entry.key}: ${file} is a PNG`, size !== null)
    if (!size) continue
    const want = entry.kind === 'video' ? VERTICAL : RATIO
    check(
      `${entry.key}: ${file} is ${entry.kind === 'video' ? '9:16' : '4:5'}, and it is ${size.width}x${size.height}`,
      Math.abs(size.width / size.height - want) < RATIO_TOLERANCE
    )
  }

  const alts = entry.kind === 'video' ? [entry.alt] : entry.alts
  check(
    `${entry.key} carries alt text for every file`,
    alts.length === (entry.kind === 'video' ? 1 : entry.files.length) &&
      alts.every(text => typeof text === 'string' && text.length > 20)
  )

  const haystack =
    `${entry.key} ${entry.files.join(' ')} ${entry.headline ?? ''} ${alts.join(' ')}`.toLowerCase()
  const named = CLIENTS.filter(term => haystack.includes(term))
  check(`${entry.key} names no client, and it names ${named.join(', ')}`, named.length === 0)
  check(`${entry.key} states no price`, !/\$\s?\d/.test(haystack))

  const path = (entry.to ?? '').split('#')[0]
  check(`${entry.key} names a page the site serves, and it is ${entry.to}`, SERVED.has(path))
}

if (existsSync(LIBRARY_FOLDER)) {
  for (const file of readdirSync(LIBRARY_FOLDER).filter(name => !name.startsWith('.'))) {
    check(`${file} is a file the library names`, libraryNamed.has(file))
  }
}

check('every library key is its own', new Set(LIBRARY.map(one => one.key)).size === LIBRARY.length)

// A catalogue that emptied itself would pass every check above it.
check('the catalogue holds cards', CARDS.length > 0)
check('every card key is its own', new Set(CARDS.map(one => one.key)).size === CARDS.length)

await finish()

console.log(
  `social assets holds ${cases.length} checks: ${CARDS.length} cards and ${generated.length} library entries served, sized, and naming no client`
)
